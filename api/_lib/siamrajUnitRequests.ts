import { dbQuery } from './postgres.js';
import { getSiamrajSqlServerConfig } from './siamrajSqlServer.js';
import {
  getSiamrajSqlServerUnitRequestById,
  listSiamrajSqlServerUnitRequests,
  SIAMRAJ_UNIT_REQUESTS_MAX_LIMIT,
} from './siamrajSqlServerRequests.js';
import {
  listSiamrajSqlServerThroughput,
  listResignationUnitRanking,
  type SiamrajThroughputRecord,
  type ResignationUnitRank,
} from './siamrajSqlServerThroughput.js';
import { listSiamrajSqlServerClosedRequests } from './siamrajSqlServerClosed.js';
import {
  getSiamrajSqlServerPrequestById,
  isPrequestId,
  listSiamrajSqlServerPrequests,
} from './siamrajSqlServerPrequests.js';
import { inferJobTypeFromDescription, primaryJobRoleLabel } from './siamrajJobMapping.js';
import { toBangkokYmd } from './businessDate.js';
import { listSiamrajSqlServerUnits } from './siamrajSqlServerUnits.js';
import { jobAllowedByDepartmentScope, loadUserDepartmentScope } from './departmentScope.js';
import { rememberJobSites } from './jobSiteMap.js';
import type { DepartmentScope } from './departmentScope.js';
import type { UserRole } from './auth.js';

export type SiamrajDbSource = 'postgres' | 'sqlserver';

export function getSiamrajDbSource(): SiamrajDbSource | null {
  const explicit = (process.env.SIAMRAJ_DB_SOURCE || 'auto').toLowerCase();
  const hasSql = !!getSiamrajSqlServerConfig();
  const hasPg = !!getSiamrajSchema();

  if (explicit === 'sqlserver' && hasSql) return 'sqlserver';
  if (explicit === 'postgres' && hasPg) return 'postgres';
  if (explicit === 'auto' || explicit === '') {
    if (hasSql) return 'sqlserver';
    if (hasPg) return 'postgres';
  }
  return null;
}

function normalizeLookupId(id: string): string {
  const t = id.trim();
  if (t.startsWith('siamraj-sql:')) return t.slice('siamraj-sql:'.length);
  if (t.startsWith('siamraj:')) return t.slice('siamraj:'.length);
  return t;
}

/**
 * id นี้เป็นใบขอจาก **ERP** ไหม (ไม่ใช่ของตาราง `jarvis_rm.jobs` ฝั่งเรา) — **ที่เดียว**
 *
 * 🔴 ครอบ prefix ทั้งสามแบบที่ระบบสร้างจริง: `siamraj:` (เส้น pg เก่า) ·
 * `siamraj-sql:` (ใบขอจริง) · `siamraj-pre:` (**ใบล่วงหน้า**)
 * เดิมแต่ละ handler เขียน `startsWith` ของตัวเองแล้ว **ลืมใบล่วงหน้าทุกที่** →
 * id แบบ `siamraj-pre:` หลุดไปคิวรีตารางฝั่งเรา แล้ว **ตาย 500 เพราะ cast `::uuid` ไม่ได้**
 * (ไม่ใช่แค่ 404) · เจอตอนแก้บั๊ก pre:/sql: 23 ส.ค. 2569
 */
export function isErpJobId(id: string): boolean {
  return /^siamraj[a-z-]*:/.test(id.trim());
}

function quotePgIdent(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

export function getSiamrajSchema(): string | null {
  const s = (process.env.SIAMRAJ_SCHEMA || process.env.SO_OPERATION_SCHEMA || '').trim();
  if (!s) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) return null;
  return s;
}

export function isSiamrajUnitRequestsEnabled(): boolean {
  const flag = (process.env.SIAMRAJ_UNIT_REQUESTS_ENABLED || 'true').toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  return !!getSiamrajDbSource();
}

function fq(schema: string, table: string): string {
  return `${quotePgIdent(schema)}.${quotePgIdent(table)}`;
}

export type SiamrajUnitRequestRow = {
  act_saleco_id: string;
  request_no: string | null;
  act_saleco_datetime: string | Date | null;
  act_saleco_effective_date: string | Date | null;
  site_code: string | null;
  status: string | null;
  staff_fullname: string | null;
  staff_id: string | null;
  mobile_phone: string | null;
  job_description_code_1: string | null;
  job_description_code_2: string | null;
  staff_title_code: string | null;
  requester_name: string | null;
  requester_email: string | null;
  request_action_name: string | null;
  request_action_code: string | null;
  request_position_unit: number | null;
  resignation: string | null;
  reason_leaving_main_code: string | null;
  reason_main_name: string | null;
  reason_sub_name: string | null;
  vehicle_type_code: string | null;
  vehicle_type_name: string | null;
  vehicle_remark: string | null;
  vehicle_kind_code: string | null;
  rm_staffing_ack_at: string | Date | null;
  act_saleco_need_staff: boolean | null;
};

function toIso(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function toYmd(v: string | Date | null | undefined): string {
  return toBangkokYmd(v);
}

export function mapSiamrajRow(r: SiamrajUnitRequestRow) {
  const reasonParts = [r.reason_main_name, r.reason_sub_name].filter(Boolean);
  const vehicleParts = [r.vehicle_type_name, r.vehicle_remark].filter(Boolean);
  const roleLabel = primaryJobRoleLabel(r.job_description_code_1, r.staff_title_code, r.job_description_code_1);
  const jobType = inferJobTypeFromDescription(r.job_description_code_1, r.job_description_code_2, r.staff_title_code);

  return {
    id: `siamraj:${r.act_saleco_id}`,
    externalId: r.act_saleco_id,
    source: 'siamraj' as const,
    readOnly: true,
    // เส้น postgres ไม่มีคอลัมน์แผนกให้ดึง — ผู้ใช้ที่ถูกจำกัดแผนกจะไม่เห็นแถวจากเส้นนี้ (fail-closed)
    department_code: undefined as string | undefined,
    request_no: r.request_no || undefined,
    submittedByName: r.requester_name?.trim() || undefined,
    submittedByEmail: r.requester_email?.trim() || undefined,
    submittedAt: toIso(r.act_saleco_datetime) || undefined,
    required_date: toYmd(r.act_saleco_effective_date) || toYmd(r.act_saleco_datetime) || new Date().toISOString().slice(0, 10),
    lastWorkingDay: toYmd(r.act_saleco_effective_date) || undefined,
    unit_name: r.site_code || '—',
    site_code: r.site_code || undefined,
    position_units: r.request_position_unit ?? undefined,
    location_address: r.site_code || '',
    request_action_code: r.request_action_code || undefined,
    request_action_name: r.request_action_name || undefined,
    resigned_employee_name: r.staff_fullname?.trim() || undefined,
    resigned_reason: reasonParts.length ? reasonParts.join(' — ') : undefined,
    vehicle_required: vehicleParts.length ? vehicleParts.join(' ') : r.vehicle_type_code || undefined,
    contact_name: undefined,
    contact_phone: r.mobile_phone?.trim() || undefined,
    status: r.rm_staffing_ack_at ? 'closed' : 'open',
    siamraj_status: r.status || undefined,
    need_staff: r.act_saleco_need_staff ?? undefined,
    staff_title_code: r.staff_title_code || undefined,
    job_description_code_1: roleLabel || r.job_description_code_1 || undefined,
    job_description_code_2: r.job_description_code_2 || undefined,
    request_date: toYmd(r.act_saleco_datetime) || new Date().toISOString().slice(0, 10),
    created_at: toIso(r.act_saleco_datetime) || new Date().toISOString(),
    urgency: 'advance' as const,
    total_income: 0,
    job_type: jobType,
    /**
     * 🔴 ค่าโครงสร้าง ไม่ใช่ของจริง — ERP ไม่มีฟิลด์นี้ และ CHECK ของตาราง `jobs`
     * รับได้แค่ private/government/bank จึงยัด 'private' ไว้ให้ type ผ่าน
     * **ห้ามเอาไปแสดง/ค้นหา** — ราชการ/เอกชนของจริงอยู่ที่ `unit_sector`
     * (แปะโดย `attachUnitSector` · แสดงผ่าน `jobSectorLabel` ที่เดียว)
     */
    job_category: 'private' as const,
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
  };
}

const BASE_SELECT = `
  h.act_saleco_id,
  h.request_no,
  h.act_saleco_datetime,
  h.act_saleco_effective_date,
  h.site_code,
  h.status,
  h.staff_fullname,
  h.staff_id,
  h.mobile_phone,
  h.job_description_code_1,
  h.job_description_code_2,
  h.staff_title_code,
  trim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS requester_name,
  u.email AS requester_email,
  ma.request_action_name,
  ma.request_action_code,
  p.request_position_unit,
  a.resignation,
  a.reason_leaving_main_code,
  rm.name AS reason_main_name,
  rs.name AS reason_sub_name,
  a.vehicle_type_code,
  vt.name AS vehicle_type_name,
  a.vehicle_remark,
  a.vehicle_kind_code,
  h.rm_staffing_ack_at,
  h.act_saleco_need_staff
`;

function buildFromClause(schema: string): string {
  const head = fq(schema, 'activity_to_saleco_head');
  const body = fq(schema, 'activity_to_saleco');
  const pos = fq(schema, 'activity_to_saleco_request_position');
  const activity = fq(schema, 'ms_activity');
  const user = fq(schema, 'sys_user');
  const reasonMain = fq(schema, 'ms_reason_leaving_main');
  const reasonSub = fq(schema, 'ms_reason_leaving_sub');
  const vehicleType = fq(schema, 'ms_vehicle_type');

  return `
    FROM ${head} h
    LEFT JOIN ${user} u ON u.id = h.created_by_user_id
    LEFT JOIN ${activity} ma ON ma.request_action_code = h.request_action_code
    LEFT JOIN ${body} a ON a.act_saleco_id::text = h.act_saleco_id::text
    LEFT JOIN ${pos} p ON p.act_saleco_id::text = h.act_saleco_id::text AND p.seq = 1
    LEFT JOIN ${reasonMain} rm ON rm.code = a.reason_leaving_main_code
    LEFT JOIN ${reasonSub} rs ON rs.code = a.reason_leaving_sub_code
    LEFT JOIN ${vehicleType} vt ON vt.code = a.vehicle_type_code
  `;
}

function staffingQueueWhere(): string {
  return `
    h.act_saleco_need_staff = true
    AND h.rm_staffing_ack_at IS NULL
    AND h.status IN ('OP', 'PA', 'RE', 'IP')
  `;
}

export async function listSiamrajUnitRequests(options: {
  limit?: number;
  mode?: string;
  departmentScope?: DepartmentScope;
}) {
  const source = getSiamrajDbSource();
  if (!source) return [];

  if (source === 'sqlserver') {
    /**
     * ใบขอจริง + **ใบขอล่วงหน้า** รวมกองเดียวกัน (เจ้าของสั่ง 17 ส.ค. 2569:
     * *"ทำเหมือนใบขอใบนึงเลย"*) — ทั้งบอร์ด ตัวกรอง AI แมท ใช้ของเดิมได้หมด
     * เพราะรูปข้อมูลเหมือนกัน · แยกกันด้วยธง `is_prequest` กับ id ที่ขึ้นต้นต่างกัน
     *
     * ⚠️ ใบล่วงหน้าล้มต้อง **ไม่ลากใบจริงล้มไปด้วย** — ใบจริงคืองานที่ต้องส่งคนวันนี้
     */
    const [real, pre] = await Promise.all([
      listSiamrajSqlServerUnitRequests(options),
      listSiamrajSqlServerPrequests({
        limit: options.limit,
        departmentScope: options.departmentScope,
      }).catch(() => []),
    ]);
    const all = [...real, ...pre] as typeof real;
    /**
     * จำหน่วยงาน (site_code) ของใบขอไว้ฝั่งเรา (Phase 6.8 · migration 106)
     * — คิว/ล็อกเก็บแค่ job_ref จึงกันเสนอซ้ำระดับหน่วยงานไม่ได้ถ้าไม่มีแมปนี้
     * ⚠️ ไม่ await: feed ใบขอคือของหลัก ห้ามรอ/ห้ามล้มเพราะตัวช่วยกันซ้ำ
     */
    void rememberJobSites(all as Array<{ id?: unknown; site_code?: unknown; unit_name?: unknown }>);
    return all;
  }

  const schema = getSiamrajSchema();
  if (!schema) return [];

  const limit = Math.min(Math.max(options.limit ?? 200, 1), SIAMRAJ_UNIT_REQUESTS_MAX_LIMIT);
  const mode = (options.mode || process.env.SIAMRAJ_UNIT_REQUESTS_MODE || 'staffing_queue').toLowerCase();
  const where = mode === 'all' ? '1=1' : staffingQueueWhere();

  const { rows } = await dbQuery<SiamrajUnitRequestRow>(
    `SELECT ${BASE_SELECT}
     ${buildFromClause(schema)}
     WHERE ${where}
     ORDER BY h.act_saleco_datetime DESC NULLS LAST
     LIMIT $1`,
    [limit],
  );

  const mapped = rows.map(mapSiamrajRow);
  void rememberJobSites(mapped as Array<{ id?: unknown; site_code?: unknown; unit_name?: unknown }>);
  const scope = options.departmentScope;
  if (!scope || scope.mode === 'all') return mapped;
  return mapped.filter((j) => jobAllowedByDepartmentScope(j, scope));
}

export async function getSiamrajUnitRequestById(
  id: string,
  departmentScope?: DepartmentScope,
  options?: {
    /** true = เปิดใบที่ปิด/ยกเลิกแล้วได้ (หน้ารายละเอียดเท่านั้น) — เส้น AI/บอร์ดห้ามส่ง */
    includeClosed?: boolean;
  },
) {
  const source = getSiamrajDbSource();
  if (!source) return null;

  let item:
    | Awaited<ReturnType<typeof getSiamrajSqlServerUnitRequestById>>
    | ReturnType<typeof mapSiamrajRow>
    | null =
    source === 'sqlserver'
      ? // ใบขอล่วงหน้ามี id คนละ prefix — ต้องแยกไปอ่านคนละตาราง ไม่งั้นเปิดใบไม่เจอ
        isPrequestId(id)
        ? ((await getSiamrajSqlServerPrequestById(id)) as never)
        : await getSiamrajSqlServerUnitRequestById(normalizeLookupId(id), options)
      : null;

  if (source !== 'sqlserver') {
    const schema = getSiamrajSchema();
    if (!schema) return null;

    const lookupId = normalizeLookupId(id);
    const { rows } = await dbQuery<SiamrajUnitRequestRow>(
      `SELECT ${BASE_SELECT}
       ${buildFromClause(schema)}
       WHERE h.act_saleco_id::text = $1 OR h.request_no = $1
       LIMIT 1`,
      [lookupId],
    );
    item = rows[0] ? mapSiamrajRow(rows[0]) : null;
  }

  if (!item) return null;
  if (departmentScope && !jobAllowedByDepartmentScope(item, departmentScope)) return null;
  return item;
}

export type ScopeUser = { sub: string; role: UserRole };

/**
 * ผู้ใช้เห็นใบขอนี้ได้ตามแผนกไหม (admin เห็นทุกใบ) — ใช้ก่อน read/write ต่อใบเดียว
 * กัน IDOR: staff แผนกหนึ่งอ้าง request_no/jobId ของอีกแผนกไม่ได้
 */
export async function isSiamrajRequestInScope(user: ScopeUser, requestNoOrId: string): Promise<boolean> {
  return (await checkSiamrajRequestScope(user, requestNoOrId)).ok;
}

/**
 * เหมือน `isSiamrajRequestInScope` แต่**บอกเหตุผล** — ให้ API ขึ้นข้อความที่ถูกต้อง
 *
 * 🔴 **ต้องส่ง `includeClosed`** (เจ้าของเจอจริง 18 ส.ค. 2569) — ของเดิมไม่ส่ง ทำให้
 * **ใบที่ปิด/ยกเลิกแล้วหาไม่เจอ** แล้วถูกตีความว่า "เป็นใบของแผนกอื่น"
 * เคสจริง: `samtipap` supervisor **LBD** เปิดใบ `OPL6901006` ที่ไซต์ก็ **LBD**
 * (ตรงกันเป๊ะ) แต่ใบเปิดมาตั้งแต่ ม.ค. และปิดไปแล้ว → เด้ง 403 บอกผิดสาเหตุ
 *
 * 🔴 **อ่านใบโดยไม่ผูก scope ก่อน** แล้วค่อยเทียบ BU เอง — ต้องรู้ให้ได้ว่า
 * "ไม่มีใบนี้" กับ "มีแต่คนละ BU" ต่างกัน ถ้าอ่านแบบผูก scope จะได้ `null` เหมือนกันทั้งคู่
 */
export async function checkSiamrajRequestScope(
  user: ScopeUser,
  requestNoOrId: string,
): Promise<
  | { ok: true }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'no_department' }
  | { ok: false; reason: 'other_bu'; requestBu: string | null; userBu: string | null }
> {
  const scope = await loadUserDepartmentScope(user);
  if (scope.mode === 'all') return { ok: true };
  if (scope.mode === 'none') return { ok: false, reason: 'no_department' };

  // ไม่ผูก scope + เปิดใบที่ปิดแล้วได้ → แยก "ไม่มีใบ" ออกจาก "คนละ BU" ได้จริง
  const item = (await getSiamrajUnitRequestById(requestNoOrId, undefined, {
    includeClosed: true,
  })) as { department_code?: string | null } | null;
  if (!item) return { ok: false, reason: 'not_found' };

  const requestBu = (item.department_code || '').trim().toUpperCase() || null;
  const userBu = scope.code.trim().toUpperCase();
  if (requestBu && requestBu === userBu) return { ok: true };
  return { ok: false, reason: 'other_bu', requestBu, userBu };
}

/**
 * เซ็ต request_no ที่ผู้ใช้เห็นได้ (null = เห็นทุกแผนก เช่น admin) — ไว้กรองรายการ bulk
 * (เช่น proposals ต่อหลายใบ) โดยไม่ต้อง query ทีละใบ
 */
export async function loadScopedRequestNoSet(user: ScopeUser): Promise<Set<string> | null> {
  const scope = await loadUserDepartmentScope(user);
  if (scope.mode === 'all') return null;
  if (scope.mode === 'none') return new Set<string>();
  const items = (await listSiamrajUnitRequests({
    limit: SIAMRAJ_UNIT_REQUESTS_MAX_LIMIT,
    departmentScope: scope,
  })) as Array<{ request_no?: string | null }>;
  const set = new Set<string>();
  for (const it of items) {
    const rn = String(it.request_no || '').trim();
    if (rn) set.add(rn);
  }
  return set;
}

/**
 * เซ็ต job id ที่ผู้ใช้เห็นได้ (null = เห็นทุกแผนก) — สำหรับตารางที่เก็บ job_id เป็น
 * 'siamraj-sql:<request_no>' (เช่น public_job_applications) แทนที่จะเก็บ request_no เปล่า
 */
export async function loadScopedJobIdSet(user: ScopeUser): Promise<Set<string> | null> {
  const scope = await loadUserDepartmentScope(user);
  if (scope.mode === 'all') return null;
  if (scope.mode === 'none') return new Set<string>();
  const items = (await listSiamrajUnitRequests({
    limit: SIAMRAJ_UNIT_REQUESTS_MAX_LIMIT,
    departmentScope: scope,
  })) as Array<{ id?: string | null; request_no?: string | null }>;
  const set = new Set<string>();
  for (const it of items) {
    const id = String(it.id || '').trim();
    if (id) set.add(id);
    // เผื่อบางแถวเก็บเลขใบขอเปล่า ๆ ไม่มี prefix
    const rn = String(it.request_no || '').trim();
    if (rn) set.add(rn);
  }
  return set;
}

export type { SiamrajThroughputRecord, ResignationUnitRank };

export async function listSiamrajThroughput(options: {
  from: string;
  to: string;
  departmentScope?: DepartmentScope;
}): Promise<SiamrajThroughputRecord[]> {
  const source = getSiamrajDbSource();
  if (source === 'sqlserver') {
    return listSiamrajSqlServerThroughput(options);
  }
  return [];
}

/** อันดับหน่วยงานที่มีใบขอลาออกบ่อยในช่วง — [] เมื่อไม่ได้ต่อ SQL Server */
export async function listSiamrajResignationUnitRanking(options: {
  from: string;
  to: string;
  departmentScope?: DepartmentScope;
  limit?: number;
}): Promise<ResignationUnitRank[]> {
  const source = getSiamrajDbSource();
  if (source === 'sqlserver') {
    return listResignationUnitRanking(options);
  }
  return [];
}

/**
 * รายชื่อ **หน่วยงานทั้งชุด** สำหรับกล่องเลือกหน่วยงานของหน้า Follow (18 ส.ค. 2569)
 * — [] เมื่อไม่ได้ต่อ SQL Server (กล่องจะถอยไปใช้ชุดจากใบขอเปิดเหมือนเดิม)
 */
export async function listSiamrajUnits(options: {
  sinceYear?: number;
  departmentScope?: DepartmentScope;
}) {
  const source = getSiamrajDbSource();
  if (source === 'sqlserver') {
    return listSiamrajSqlServerUnits(options);
  }
  return [];
}

/** รายการใบขอที่ปิด/แจ้งเข้าในช่วง — สำหรับ drill-down การ์ด "ปิดใบขอ" (เลขตรงกับ throughput) */
export async function listSiamrajClosedRequests(options: {
  from: string;
  to: string;
  limit?: number;
  departmentScope?: DepartmentScope;
}) {
  const source = getSiamrajDbSource();
  if (source === 'sqlserver') {
    return listSiamrajSqlServerClosedRequests(options);
  }
  return [];
}
