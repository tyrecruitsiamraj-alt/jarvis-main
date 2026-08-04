import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

/**
 * Master "สถานะทำงาน" ของใบขอ (migration 062) — Admin เพิ่ม/แก้/ปิดใช้งานได้จากหน้าตั้งค่า
 * ค่า built-in 9 ตัวลบไม่ได้ (โค้ด/dashboard อ้างชื่อตรง ๆ) แต่ปิดใช้งานได้
 */
const table = tableInAppSchema('work_status_master');
const usageTable = tableInAppSchema('siamraj_unit_work_status');

export type WorkStatusMasterRow = {
  code: string;
  label: string;
  date_label: string;
  sort_order: number;
  is_builtin: boolean;
  is_active: boolean;
};

/** ค่าเดิมที่ hardcode ไว้ — ใช้เป็น fallback เมื่อยังไม่ได้รัน migration 062 */
export const BUILTIN_WORK_STATUSES: WorkStatusMasterRow[] = [
  { code: 'in_progress', label: 'ดำเนินการ', date_label: 'วันที่', sort_order: 10, is_builtin: true, is_active: true },
  { code: 'on_hold', label: 'ชะลอ', date_label: 'วันที่ชะลอ', sort_order: 20, is_builtin: true, is_active: true },
  { code: 'evaluating', label: 'เริ่มประเมิน', date_label: 'วันที่เริ่มประเมิน', sort_order: 30, is_builtin: true, is_active: true },
  { code: 'waiting_inform', label: 'รอแจ้งเข้า', date_label: 'วันที่แจ้งเข้า', sort_order: 40, is_builtin: true, is_active: true },
  { code: 'waiting_interview', label: 'รอสัมภาษณ์', date_label: 'วันนัดสัมภาษณ์', sort_order: 50, is_builtin: true, is_active: true },
  { code: 'waiting_result', label: 'รอผลสัมภาษณ์', date_label: 'วันที่สัมภาษณ์', sort_order: 60, is_builtin: true, is_active: true },
  { code: 'waiting_start', label: 'รอเริ่มงาน', date_label: 'วันที่เริ่มงาน', sort_order: 70, is_builtin: true, is_active: true },
  { code: 'daily_work', label: 'งานรายวัน', date_label: 'วันที่เริ่มงานรายวัน', sort_order: 80, is_builtin: true, is_active: true },
  { code: 'daily_pay', label: 'จ่ายรายวัน', date_label: 'วันที่จ่ายรายวัน', sort_order: 90, is_builtin: true, is_active: true },
];

const CODE_RE = /^[a-z][a-z0-9_]{1,39}$/;

function isMissingTable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /work_status_master/i.test(msg) && /(does not exist|relation)/i.test(msg);
}

function trimTo(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** รายการทั้งหมด (รวมที่ปิดใช้งาน) — เรียงตาม sort_order แล้ว code */
export async function listWorkStatusMaster(): Promise<WorkStatusMasterRow[]> {
  try {
    const { rows } = await dbQuery<WorkStatusMasterRow>(
      `select code, label, date_label, sort_order, is_builtin, is_active
         from ${table}
        order by sort_order asc, code asc`,
    );
    return rows.length > 0 ? rows : BUILTIN_WORK_STATUSES;
  } catch (e) {
    // ยังไม่ได้รัน migration → คืนค่า built-in เพื่อไม่ให้ dropdown ทั้งระบบว่าง
    if (isMissingTable(e)) return BUILTIN_WORK_STATUSES;
    throw e;
  }
}

/** โค้ดที่ยังเปิดใช้งาน — ใช้ validate ตอนบันทึกสถานะใบขอ */
export async function activeWorkStatusCodes(): Promise<string[]> {
  const rows = await listWorkStatusMaster();
  return rows.filter((r) => r.is_active).map((r) => r.code);
}

export type CreateWorkStatusInput = {
  code: unknown;
  label: unknown;
  dateLabel?: unknown;
  sortOrder?: unknown;
};

export async function createWorkStatus(input: CreateWorkStatusInput): Promise<WorkStatusMasterRow> {
  const code = trimTo(input.code, 40).toLowerCase();
  if (!CODE_RE.test(code)) {
    throw new Error('code ต้องเป็น a-z ตัวเล็ก ตัวเลข หรือ _ ความยาว 2–40 ตัว และเริ่มด้วยตัวอักษร');
  }
  const label = trimTo(input.label, 60);
  if (!label) throw new Error('ต้องระบุชื่อสถานะ');
  const dateLabel = trimTo(input.dateLabel, 60) || 'วันที่';
  const sortRaw = Number(input.sortOrder);
  const sortOrder = Number.isFinite(sortRaw) ? Math.max(0, Math.floor(sortRaw)) : 500;

  const { rows } = await dbQuery<WorkStatusMasterRow>(
    `insert into ${table} (code, label, date_label, sort_order, is_builtin, is_active)
     values ($1, $2, $3, $4, false, true)
     returning code, label, date_label, sort_order, is_builtin, is_active`,
    [code, label, dateLabel, sortOrder],
  );
  return rows[0];
}

export type UpdateWorkStatusInput = {
  label?: unknown;
  dateLabel?: unknown;
  sortOrder?: unknown;
  isActive?: unknown;
};

export async function updateWorkStatus(
  code: string,
  patch: UpdateWorkStatusInput,
): Promise<WorkStatusMasterRow | null> {
  const key = trimTo(code, 40).toLowerCase();
  if (!key) throw new Error('code is required');

  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.label !== undefined) {
    const label = trimTo(patch.label, 60);
    if (!label) throw new Error('ชื่อสถานะว่างไม่ได้');
    params.push(label);
    sets.push(`label = $${params.length}`);
  }
  if (patch.dateLabel !== undefined) {
    params.push(trimTo(patch.dateLabel, 60) || 'วันที่');
    sets.push(`date_label = $${params.length}`);
  }
  if (patch.sortOrder !== undefined) {
    const n = Number(patch.sortOrder);
    if (!Number.isFinite(n)) throw new Error('sort_order ต้องเป็นตัวเลข');
    params.push(Math.max(0, Math.floor(n)));
    sets.push(`sort_order = $${params.length}`);
  }
  if (patch.isActive !== undefined) {
    params.push(patch.isActive === true || patch.isActive === 'true');
    sets.push(`is_active = $${params.length}`);
  }
  if (sets.length === 0) throw new Error('nothing to update');

  sets.push('updated_at = now()');
  params.push(key);
  const { rows } = await dbQuery<WorkStatusMasterRow>(
    `update ${table} set ${sets.join(', ')} where code = $${params.length}
     returning code, label, date_label, sort_order, is_builtin, is_active`,
    params,
  );
  return rows[0] ?? null;
}

/** จำนวนใบขอที่ใช้สถานะนี้อยู่ — ใช้บอกผู้ใช้ว่าทำไมลบไม่ได้ */
export async function countWorkStatusUsage(code: string): Promise<number> {
  const { rows } = await dbQuery<{ n: string }>(
    `select count(*)::text as n from ${usageTable} where status = $1`,
    [code],
  );
  return Number(rows[0]?.n ?? 0);
}

export type DeleteWorkStatusResult = {
  ok: boolean;
  reason?: 'not_found' | 'builtin' | 'in_use';
  usage?: number;
};

export async function deleteWorkStatus(code: string): Promise<DeleteWorkStatusResult> {
  const key = trimTo(code, 40).toLowerCase();
  if (!key) return { ok: false, reason: 'not_found' };

  const { rows } = await dbQuery<{ is_builtin: boolean }>(
    `select is_builtin from ${table} where code = $1 limit 1`,
    [key],
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: 'not_found' };
  // built-in ลบไม่ได้ — โค้ดฝั่ง dashboard/KPI อ้างชื่อเหล่านี้ตรง ๆ (ปิดใช้งานได้แทน)
  if (row.is_builtin) return { ok: false, reason: 'builtin' };

  const usage = await countWorkStatusUsage(key);
  if (usage > 0) return { ok: false, reason: 'in_use', usage };

  await dbQuery(`delete from ${table} where code = $1`, [key]);
  return { ok: true };
}
