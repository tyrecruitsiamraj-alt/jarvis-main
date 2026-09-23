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
import {
  loadRosterBuScope,
  normalizeDepartmentCode,
  isAllowedDepartmentCode,
  type DepartmentScope,
} from '../_lib/departmentScope.js';

const rosterTable = tableInAppSchema('job_staff_roster');
const excludedTable = tableInAppSchema('job_staff_picker_excluded');
const jobsTable = tableInAppSchema('jobs');
const unitAssignmentsTable = tableInAppSchema('siamraj_unit_assignments');
const usersTable = tableInAppSchema('users');

type Role = 'recruiter' | 'screener' | 'opl' | 'online';

function isRole(v: unknown): v is Role {
  return v === 'recruiter' || v === 'screener' || v === 'opl' || v === 'online';
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
    onlines: [] as string[],
    pickerExcludedRecruiters: [] as string[],
    pickerExcludedScreeners: [] as string[],
    pickerExcludedOpls: [] as string[],
    pickerExcludedOnlines: [] as string[],
    directory: [] as StaffDirectoryEntry[],
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
  const onlines: string[] = [];
  for (const r of rosterRows) {
    if (r.role === 'recruiter') recruiters.push(r.display_name);
    else if (r.role === 'screener') screeners.push(r.display_name);
    else if (r.role === 'opl') opls.push(r.display_name);
    else if (r.role === 'online') onlines.push(r.display_name);
  }

  const pickerExcludedRecruiters: string[] = [];
  const pickerExcludedScreeners: string[] = [];
  const pickerExcludedOpls: string[] = [];
  const pickerExcludedOnlines: string[] = [];
  for (const e of exRows) {
    if (e.role === 'recruiter') pickerExcludedRecruiters.push(e.name_norm);
    else if (e.role === 'screener') pickerExcludedScreeners.push(e.name_norm);
    else if (e.role === 'opl') pickerExcludedOpls.push(e.name_norm);
    else if (e.role === 'online') pickerExcludedOnlines.push(e.name_norm);
  }

  return {
    directory: await fetchStaffDirectory(scope),
    recruiters: dedupe(recruiters),
    screeners: dedupe(screeners),
    opls: dedupe(opls),
    onlines: dedupe(onlines),
    pickerExcludedRecruiters: dedupe(pickerExcludedRecruiters),
    pickerExcludedScreeners: dedupe(pickerExcludedScreeners),
    pickerExcludedOpls: dedupe(pickerExcludedOpls),
    pickerExcludedOnlines: dedupe(pickerExcludedOnlines),
    bu: scope.mode === 'code' ? scope.code : null,
    buMode: scope.mode,
  };
}

/**
 * **สมุดรายชื่อเจ้าหน้าที่** — ชื่อเล่น + สายงาน + เบอร์ จาก `users` (110 + 114)
 *
 * เจ้าของเคาะ 23 ก.ย. 2569 ว่า **หน้าผู้ใช้งานคือตัวจริง** แล้วสั่งให้ย้ายมาที่เดียว
 * **แบบเป็นขั้น** — ระหว่างทาง dropdown ผู้รับผิดชอบบนใบขอ *รวม* ชื่อจากสองที่
 * (หน้าทีม `job_staff_roster` + ชุดนี้) ของเดิมจึงไม่หายระหว่างทยอยกรอก
 * (ย้ำคำสั่งเดิม 1 ก.ย.: *"กำหนดทั้ง Role คัดสรร ชื่อเล่น และเบอร์โทรทีเดียว"*)
 *
 * 🔴 **ส่งทุกคนที่ตั้งสายงานไว้ แม้ยังไม่มีเบอร์** — ใบขอใช้แค่ชื่อ ไม่ต้องมีเบอร์ก็เลือกได้
 * ฝั่งที่ต้องการเบอร์ (ช่อง "เจ้าหน้าที่ที่ติดตาม" หน้า Follow) กรองเอาเองที่ปลายทาง
 * ⇒ ที่นี่เป็น **ชุดเดียว** ห้ามแตกเป็นสองเส้นตามผู้ใช้ ไม่งั้นนิยาม "ใครอยู่สายไหน" เพี้ยนสองที่
 * 🔴 **ชื่อในลิสต์ = ช่อง "ชื่อเล่น" เท่านั้น** (เจ้าของย้ำ 23 ก.ย. 2569: *"ใบขอก็เอาช่อง
 * ชื่อเล่นมาให้เขาเลือกไง"*) — ยังไม่กรอกชื่อเล่น = **ไม่โผล่ในลิสต์**
 * เคยตกไปใช้ `full_name` เป็นทางถอย แล้วได้ชื่ออังกฤษจาก Microsoft (Netnapha Yotsanun)
 * ไปนั่งปนใน dropdown ผู้รับผิดชอบทั้งที่ไม่มีใครเรียกชื่อนั้น และไม่มีทางตรงกับหน้าทีม
 * ⇒ กติกาชัดตัวเดียว: **กรอกชื่อเล่น = โผล่ · ไม่กรอก = ไม่โผล่**
 * ⚠️ ชื่อเล่นต้องสะกดตรงกับหน้าทีม — จับคู่สองที่ด้วยชื่อเท่านั้น ไม่มี id ผูกกัน
 */
export type StaffDirectoryEntry = { name: string; phone: string; lanes: string[] };

async function fetchStaffDirectory(scope: DepartmentScope): Promise<StaffDirectoryEntry[]> {
  const params: string[] = [];
  let where = `is_active and nickname is not null and trim(nickname) <> ''
       and job_lanes is not null and array_length(job_lanes, 1) >= 1`;
  if (scope.mode === 'code') {
    params.push(scope.code);
    where += ` and (department_code = $1 or department_code is null)`;
  }
  const { rows } = await dbQuery<{ name: string; phone: string | null; lanes: string[] | null }>(
    `select trim(nickname) as name,
            coalesce(trim(phone), '') as phone, job_lanes as lanes
       from ${usersTable}
      where ${where}
      order by 1 asc`,
    params,
  );
  const seen = new Set<string>();
  const out: StaffDirectoryEntry[] = [];
  for (const r of rows) {
    const name = (r.name || '').trim();
    if (!name) continue;
    const k = normName(name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name, phone: (r.phone || '').trim(), lanes: r.lanes ?? [] });
  }
  return out;
}

type RosterEntry = { name: string; bu: string | null };

/** Roster rows with their BU, for the admin management tab (one row per BU). */
async function fetchManageEntries(scope: DepartmentScope) {
  const out = {
    recruiters: [] as RosterEntry[],
    screeners: [] as RosterEntry[],
    opls: [] as RosterEntry[],
    onlines: [] as RosterEntry[],
  };
  if (scope.mode === 'none') return out;
  const w = scopeWhere(scope);
  const { rows } = await dbQuery<{ role: string; display_name: string; department_code: string | null }>(
    `select role, display_name, department_code from ${rosterTable} ${w.sql}
     order by role asc, lower(trim(display_name)) asc`,
    w.params,
  );
  for (const r of rows) {
    const entry: RosterEntry = { name: r.display_name, bu: r.department_code ?? null };
    if (r.role === 'recruiter') out.recruiters.push(entry);
    else if (r.role === 'screener') out.screeners.push(entry);
    else if (r.role === 'opl') out.opls.push(entry);
    else if (r.role === 'online') out.onlines.push(entry);
  }
  return out;
}

type ScopeResult =
  | { ok: true; scope: DepartmentScope }
  | { ok: false; status: number; message: string };

/**
 * Resolve the effective roster scope. When the caller passes an explicit `bu`
 * (the roster tab's BU selector) we honour it — admins may pick any BU, other
 * roles only their own department. Without `bu`, fall back to the user's own
 * department (admins → all).
 */
async function resolveScope(req: AuthedReq, requestedRaw: string | null): Promise<ScopeResult> {
  const requested = normalizeDepartmentCode(requestedRaw);
  if (requested) {
    if (!isAllowedDepartmentCode(requested)) {
      return { ok: false, status: 400, message: 'BU ไม่ถูกต้อง' };
    }
    if (req.user.role === 'admin') {
      return { ok: true, scope: { mode: 'code', code: requested } };
    }
    const own = await loadRosterBuScope(req.user);
    if (own.mode === 'code' && own.code === requested) {
      return { ok: true, scope: own };
    }
    return { ok: false, status: 403, message: 'ไม่มีสิทธิ์เข้าถึง BU นี้' };
  }
  return { ok: true, scope: await loadRosterBuScope(req.user) };
}

/** Resolve a single BU value the caller is allowed to write to (for set-bu). */
async function authorizeBu(
  req: AuthedReq,
  raw: string | null,
): Promise<{ ok: true; bu: string | null } | { ok: false; status: number; message: string }> {
  const r = await resolveScope(req, raw);
  if (!r.ok) return r;
  if (r.scope.mode === 'none') return { ok: false, status: 400, message: 'เลือก BU ก่อน' };
  return { ok: true, bu: writeBu(r.scope) };
}

async function jobStaffHandler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      if (getString(req.query?.manage)) {
        // admin manages every BU; other roles see their own department + legacy rows
        const manageScope: DepartmentScope =
          req.user.role === 'admin' ? { mode: 'all' } : await loadRosterBuScope(req.user);
        const entries = await fetchManageEntries(manageScope);
        return res.status(200).json({ ...entries, canManageAllBu: req.user.role === 'admin' });
      }
      const resolved = await resolveScope(req, getString(req.query?.bu));
      if (!resolved.ok) return sendError(res, resolved.status, 'Forbidden', resolved.message);
      return res.status(200).json(await fetchState(resolved.scope));
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
      const bodyPre = raw as Record<string, unknown>;
      const resolved = await resolveScope(req, getString(bodyPre.bu));
      if (!resolved.ok) return sendError(res, resolved.status, 'Forbidden', resolved.message);
      const scope = resolved.scope;
      if (scope.mode === 'none') {
        return sendError(res, 400, 'Bad request', 'เลือก BU ก่อนจัดการรายชื่อ');
      }
      const bu = writeBu(scope);

      const body = bodyPre;
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

      if (op === 'set-bu') {
        const name = getString(body.name);
        if (!name) return sendError(res, 400, 'Bad request', 'name is required');
        const nn = normName(name);
        if (!nn) return sendError(res, 400, 'Bad request', 'name is empty');

        const fromAuth = await authorizeBu(req, getString(body.fromBu));
        if (!fromAuth.ok) return sendError(res, fromAuth.status, 'Forbidden', fromAuth.message);
        const toAuth = await authorizeBu(req, getString(body.toBu));
        if (!toAuth.ok) return sendError(res, toAuth.status, 'Forbidden', toAuth.message);
        const fromBu = fromAuth.bu;
        const toBu = toAuth.bu;
        if (fromBu === toBu) return res.status(200).json(await fetchState(scope));

        const { rows: existing } = await dbQuery(
          `select 1 from ${rosterTable}
           where role = $1 and lower(trim(display_name)) = $2 and department_code is not distinct from $3
           limit 1`,
          [role, nn, toBu],
        );
        if (existing.length > 0) {
          // target BU already has this name — drop the source row (merge)
          await dbQuery(
            `delete from ${rosterTable}
             where role = $1 and lower(trim(display_name)) = $2 and department_code is not distinct from $3`,
            [role, nn, fromBu],
          );
        } else {
          await dbQuery(
            `update ${rosterTable} set department_code = $4
             where role = $1 and lower(trim(display_name)) = $2 and department_code is not distinct from $3`,
            [role, nn, fromBu, toBu],
          );
        }
        await auditFromAuthed(req, {
          action: 'job_staff.set_bu',
          entityType: 'job_staff',
          entityId: role,
          after: { op: 'set-bu', role, name: name.trim(), fromBu, toBu },
        });
        return res.status(200).json(await fetchState(scope));
      }

      return sendError(res, 400, 'Bad request', 'Unknown op; use add, remove, rename, or set-bu');
    } catch (e) {
      return handleApiError(res, e, 'job-staff POST', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(jobStaffHandler, 'job-staff');
