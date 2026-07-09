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

async function fetchState() {
  const { rows: rosterRows } = await dbQuery<{ role: string; display_name: string }>(
    `select role, display_name from ${rosterTable} order by role asc, display_name asc`,
  );
  const { rows: exRows } = await dbQuery<{ role: string; name_norm: string }>(
    `select role, name_norm from ${excludedTable} order by role asc, name_norm asc`,
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
    recruiters,
    screeners,
    opls,
    pickerExcludedRecruiters,
    pickerExcludedScreeners,
    pickerExcludedOpls,
  };
}

async function jobStaffHandler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const state = await fetchState();
      return res.status(200).json(state);
    } catch (e) {
      return handleApiError(res, e, 'job-staff GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST') {
    try {
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
          `delete from ${excludedTable} where role = $1 and name_norm = $2`,
          [role, nn],
        );
        await dbQuery(
          `
          insert into ${rosterTable} (role, display_name)
          select $1, $2
          where not exists (
            select 1 from ${rosterTable} r
            where r.role = $1 and lower(trim(r.display_name)) = lower(trim($2::text))
          )
        `,
          [role, name.trim()],
        );
        const state = await fetchState();
        await auditFromAuthed(req, {
          action: 'job_staff.add',
          entityType: 'job_staff',
          entityId: role,
          after: { op: 'add', role, name: name.trim() },
        });
        return res.status(200).json(state);
      }

      if (op === 'remove') {
        const name = getString(body.name);
        if (!name) return sendError(res, 400, 'Bad request', 'name is required');
        const nn = normName(name);
        if (!nn) return sendError(res, 400, 'Bad request', 'name is empty');

        await dbQuery(
          `delete from ${rosterTable} where role = $1 and lower(trim(display_name)) = $2`,
          [role, nn],
        );
        await dbQuery(
          `insert into ${excludedTable} (role, name_norm) values ($1, $2) on conflict do nothing`,
          [role, nn],
        );
        const state = await fetchState();
        await auditFromAuthed(req, {
          action: 'job_staff.remove',
          entityType: 'job_staff',
          entityId: role,
          after: { op: 'remove', role, name: name.trim() },
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
        if (on === nn) return res.status(200).json(await fetchState());

        await dbQuery(
          `delete from ${rosterTable} where role = $1 and lower(trim(display_name)) = $2`,
          [role, on],
        );
        await dbQuery(
          `insert into ${rosterTable} (role, display_name)
           select $1, $2
           where not exists (
             select 1 from ${rosterTable} r
             where r.role = $1 and lower(trim(r.display_name)) = lower(trim($2::text))
           )`,
          [role, newName.trim()],
        );
        await dbQuery(
          `insert into ${excludedTable} (role, name_norm) values ($1, $2) on conflict do nothing`,
          [role, on],
        );
        await dbQuery(`delete from ${excludedTable} where role = $1 and name_norm = $2`, [role, nn]);

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

        const state = await fetchState();
        await auditFromAuthed(req, {
          action: 'job_staff.rename',
          entityType: 'job_staff',
          entityId: role,
          after: { op: 'rename', role, oldName: oldName.trim(), newName: newName.trim() },
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
