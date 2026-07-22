import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { loadRosterBuScope, type DepartmentScope } from '../_lib/departmentScope.js';

const rosterTable = tableInAppSchema('job_staff_roster');
const excludedTable = tableInAppSchema('job_staff_picker_excluded');
const jobsTable = tableInAppSchema('jobs');
const unitAssignmentsTable = tableInAppSchema('siamraj_unit_assignments');

type Role = 'recruiter' | 'screener' | 'opl';

function isRole(v: unknown): v is Role {
  return v === 'recruiter' || v === 'screener' || v === 'opl';
}

function normName(s: string): string {
  return s.trim().toLowerCase();
}

/** BU value written on new rows; null for the "all"/global scope. */
function writeBu(scope: DepartmentScope): string | null {
  return scope.mode === 'code' ? scope.code : null;
}

/** WHERE clause + params limiting reads to the scope's visible rows. */
function scopeWhere(scope: DepartmentScope): { sql: string; params: string[] } {
  // 'code' → own BU rows + legacy NULL rows; 'all' → everything; 'none' handled by caller.
  if (scope.mode === 'code') {
    return { sql: `where department_code = $1 or department_code is null`, params: [scope.code] };
  }
  return { sql: '', params: [] };
}

/** Case-insensitive de-dupe, preserving first-seen order. */
function dedupe(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const k = normName(n);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

async function fetchState(scope: DepartmentScope) {
  const empty = {
    recruiters: [] as string[],
    screeners: [] as string[],
    opls: [] as string[],
    pickerExcludedRecruiters: [] as string[],
    pickerExcludedScreeners: [] as string[],
    pickerExcludedOpls: [] as string[],
    bu: scope.mode === 'code' ? scope.code : null,
    buMode: scope.mode,
  };
  if (scope.mode === 'none') return empty;

  const w = scopeWhere(scope);
  const { rows: rosterRows } = await dbQuery<{ role: string; display_name: string }>(
    `select role, display_name from ${rosterTable} ${w.sql} order by role asc, display_name asc`,
    w.params,
  );
  const { rows: exRows } = await dbQuery<{ role: string; name_norm: string }>(
    `select role, name_norm from ${excludedTable} ${w.sql} order by role asc, name_norm asc`,
    w.params,
  );

  const recruiters: string[] = [];
  const screeners: string[] = [];
  const opls: string[] = [];
  for (const r of rosterRows) {
    if (r.role === 'recruiter') recruiters.push(r.display_name);
    else if (r.role === 'screener') screeners.push(r.display_name);
    else if (r.role === 'opl') opls.push(r.display_name);
  }

  const pickerExcludedRecruiters: string[] = [];
  const pickerExcludedScreeners: string[] = [];
  const pickerExcludedOpls: string[] = [];
  for (const e of exRows) {
    if (e.role === 'recruiter') pickerExcludedRecruiters.push(e.name_norm);
    else if (e.role === 'screener') pickerExcludedScreeners.push(e.name_norm);
    else if (e.role === 'opl') pickerExcludedOpls.push(e.name_norm);
  }

  return {
    recruiters: dedupe(recruiters),
    screeners: dedupe(screeners),
    opls: dedupe(opls),
    pickerExcludedRecruiters: dedupe(pickerExcludedRecruiters),
    pickerExcludedScreeners: dedupe(pickerExcludedScreeners),
    pickerExcludedOpls: dedupe(pickerExcludedOpls),
    bu: scope.mode === 'code' ? scope.code : null,
    buMode: scope.mode,
  };
}

async function jobStaffHandler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const scope = await loadRosterBuScope(req.user);

  if (method === 'GET') {
    try {
      return res.status(200).json(await fetchState(scope));
    } catch (e) {
      return handleApiError(res, e, 'job-staff GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST') {
    try {
      if (scope.mode === 'none') {
        return sendError(res, 400, 'Bad request', 'บัญชีนี้ยังไม่ได้ตั้งแผนก — ตั้งแผนกก่อนจัดการรายชื่อ');
      }
      const bu = writeBu(scope);

      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;
      const op = body.op;
      const role = body.role;

      if (!isRole(role)) {
        return sendError(res, 400, 'Bad request', 'role must be recruiter, screener, or opl');
      }

      if (op === 'add') {
        const name = getString(body.name);
        if (!name) return sendError(res, 400, 'Bad request', 'name is required');
        const nn = normName(name);
        if (!nn) return sendError(res, 400, 'Bad request', 'name is empty');

        await dbQuery(
          `delete from ${excludedTable}
           where role = $1 and name_norm = $2 and department_code is not distinct from $3`,
          [role, nn, bu],
        );
        await dbQuery(
          `
          insert into ${rosterTable} (role, display_name, department_code)
          select $1, $2, $3
          where not exists (
            select 1 from ${rosterTable} r
            where r.role = $1
              and lower(trim(r.display_name)) = lower(trim($2::text))
              and (r.department_code is not distinct from $3 or r.department_code is null)
          )
        `,
          [role, name.trim(), bu],
        );
        const state = await fetchState(scope);
        await auditFromAuthed(req, {
          action: 'job_staff.add',
          entityType: 'job_staff',
          entityId: role,
          after: { op: 'add', role, name: name.trim(), bu },
        });
        return res.status(200).json(state);
      }

      if (op === 'remove') {
        const name = getString(body.name);
        if (!name) return sendError(res, 400, 'Bad request', 'name is required');
        const nn = normName(name);
        if (!nn) return sendError(res, 400, 'Bad request', 'name is empty');

        await dbQuery(
          `delete from ${rosterTable}
           where role = $1 and lower(trim(display_name)) = $2 and department_code is not distinct from $3`,
          [role, nn, bu],
        );
        await dbQuery(
          `insert into ${excludedTable} (role, name_norm, department_code)
           select $1, $2, $3
           where not exists (
             select 1 from ${excludedTable}
             where role = $1 and name_norm = $2 and department_code is not distinct from $3
           )`,
          [role, nn, bu],
        );
        const state = await fetchState(scope);
        await auditFromAuthed(req, {
          action: 'job_staff.remove',
          entityType: 'job_staff',
          entityId: role,
          after: { op: 'remove', role, name: name.trim(), bu },
        });
        return res.status(200).json(state);
      }

      if (op === 'rename') {
        const oldName = getString(body.oldName);
        const newName = getString(body.newName);
        if (!oldName || !newName) {
          return sendError(res, 400, 'Bad request', 'oldName and newName are required');
        }
        const on = normName(oldName);
        const nn = normName(newName);
        if (!on || !nn) return sendError(res, 400, 'Bad request', 'Invalid names');
        if (on === nn) return res.status(200).json(await fetchState(scope));

        await dbQuery(
          `delete from ${rosterTable}
           where role = $1 and lower(trim(display_name)) = $2 and department_code is not distinct from $3`,
          [role, on, bu],
        );
        await dbQuery(
          `insert into ${rosterTable} (role, display_name, department_code)
           select $1, $2, $3
           where not exists (
             select 1 from ${rosterTable} r
             where r.role = $1
               and lower(trim(r.display_name)) = lower(trim($2::text))
               and (r.department_code is not distinct from $3 or r.department_code is null)
           )`,
          [role, newName.trim(), bu],
        );
        await dbQuery(
          `insert into ${excludedTable} (role, name_norm, department_code)
           select $1, $2, $3
           where not exists (
             select 1 from ${excludedTable}
             where role = $1 and name_norm = $2 and department_code is not distinct from $3
           )`,
          [role, on, bu],
        );
        await dbQuery(
          `delete from ${excludedTable}
           where role = $1 and name_norm = $2 and department_code is not distinct from $3`,
          [role, nn, bu],
        );

        if (role === 'recruiter') {
          await dbQuery(
            `update ${jobsTable} set recruiter_name = $1
             where recruiter_name is not null
             and lower(trim(recruiter_name)) = lower(trim($2::text))`,
            [newName.trim(), oldName.trim()],
          );
        } else if (role === 'screener') {
          await dbQuery(
            `update ${jobsTable} set screener_name = $1
             where screener_name is not null
             and lower(trim(screener_name)) = lower(trim($2::text))`,
            [newName.trim(), oldName.trim()],
          );
        } else {
          await dbQuery(
            `update ${unitAssignmentsTable} set opl_name = $1
             where opl_name is not null
             and lower(trim(opl_name)) = lower(trim($2::text))`,
            [newName.trim(), oldName.trim()],
          );
        }

        const state = await fetchState(scope);
        await auditFromAuthed(req, {
          action: 'job_staff.rename',
          entityType: 'job_staff',
          entityId: role,
          after: { op: 'rename', role, oldName: oldName.trim(), newName: newName.trim(), bu },
        });
        return res.status(200).json(state);
      }

      return sendError(res, 400, 'Bad request', 'Unknown op; use add, remove, or rename');
    } catch (e) {
      return handleApiError(res, e, 'job-staff POST', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(jobStaffHandler, 'job-staff');
