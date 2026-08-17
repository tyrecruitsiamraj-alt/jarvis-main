/**
 * master "เหตุผล" ของงานสรรหา (RM) — ปุ่ม "เหตุผล" บนบอร์ดและหน้า RM
 *
 * ยกมาจาก `recruit_master_reason` ของ iRecruit (85 แถว) · ดู `migrations/076_recruit_reasons.sql`
 * ⚠️ ความหมายของรหัส ('1'/'2'/'3' · 'A'/'C') อยู่ที่ `src/lib/recruitRmMasters.ts` ที่เดียว
 */
import { dbQuery, isPgUniqueViolation } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import {
  isRmReasonOutcome,
  isRmReasonProcess,
  type RmReasonOutcome,
  type RmReasonProcess,
} from '../../src/lib/recruitRmMasters.js';
import type { RecruitReason } from '../../src/lib/recruitReasons.js';

const reasonsTable = tableInAppSchema('recruit_reasons');

const MAX_NAME = 200;

type ReasonRow = {
  id: string;
  process_code: string;
  outcome_code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

function mapReason(r: ReasonRow): RecruitReason {
  return {
    id: r.id,
    processCode: r.process_code,
    outcomeCode: r.outcome_code,
    name: r.name,
    sortOrder: Number(r.sort_order) || 0,
    isActive: !!r.is_active,
  };
}

function cleanName(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  return s ? s.slice(0, MAX_NAME) : null;
}

export async function listRecruitReasons(
  options: { includeInactive?: boolean; processCode?: string; outcomeCode?: string } = {},
): Promise<RecruitReason[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (!options.includeInactive) where.push('is_active = true');
  if (isRmReasonProcess(options.processCode)) {
    params.push(options.processCode);
    where.push(`process_code = $${params.length}`);
  }
  if (isRmReasonOutcome(options.outcomeCode)) {
    params.push(options.outcomeCode);
    where.push(`outcome_code = $${params.length}`);
  }
  const { rows } = await dbQuery<ReasonRow>(
    `SELECT id, process_code, outcome_code, name, sort_order, is_active
       FROM ${reasonsTable}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY process_code, outcome_code, sort_order, lower(name)`,
    params,
  );
  return rows.map(mapReason);
}

export async function createRecruitReason(input: {
  processCode: unknown;
  outcomeCode: unknown;
  name: unknown;
  sortOrder?: unknown;
}): Promise<RecruitReason> {
  const name = cleanName(input.name);
  if (!name) throw new Error('ต้องระบุชื่อเหตุผล');
  if (!isRmReasonProcess(input.processCode)) throw new Error('ขั้นตอนไม่ถูกต้อง');
  if (!isRmReasonOutcome(input.outcomeCode)) throw new Error('ผลของขั้นตอนไม่ถูกต้อง');
  const processCode: RmReasonProcess = input.processCode;
  const outcomeCode: RmReasonOutcome = input.outcomeCode;
  const sortOrder = Number(input.sortOrder);
  try {
    const { rows } = await dbQuery<ReasonRow>(
      `INSERT INTO ${reasonsTable} (process_code, outcome_code, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, process_code, outcome_code, name, sort_order, is_active`,
      [processCode, outcomeCode, name, Number.isFinite(sortOrder) ? sortOrder : 100],
    );
    return mapReason(rows[0]);
  } catch (e) {
    if (isPgUniqueViolation(e)) throw new Error('มีเหตุผลชื่อนี้ในขั้นตอนนี้อยู่แล้ว');
    throw e;
  }
}

export async function updateRecruitReason(
  id: string,
  patch: { name?: unknown; sortOrder?: unknown; isActive?: unknown },
): Promise<RecruitReason | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.name !== undefined) {
    const name = cleanName(patch.name);
    if (!name) throw new Error('ชื่อเหตุผลว่างไม่ได้');
    params.push(name);
    sets.push(`name = $${params.length}`);
  }
  if (patch.sortOrder !== undefined) {
    params.push(Number(patch.sortOrder) || 0);
    sets.push(`sort_order = $${params.length}`);
  }
  if (patch.isActive !== undefined) {
    params.push(!!patch.isActive);
    sets.push(`is_active = $${params.length}`);
  }
  if (sets.length === 0) return null;
  params.push(id);
  try {
    const { rows } = await dbQuery<ReasonRow>(
      `UPDATE ${reasonsTable} SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $${params.length}
        RETURNING id, process_code, outcome_code, name, sort_order, is_active`,
      params,
    );
    return rows[0] ? mapReason(rows[0]) : null;
  } catch (e) {
    if (isPgUniqueViolation(e)) throw new Error('มีเหตุผลชื่อนี้ในขั้นตอนนี้อยู่แล้ว');
    throw e;
  }
}

/**
 * ปิดการใช้งานเหตุผล — **ไม่ลบทิ้ง**
 * เหตุผลถูกอ้างจากผลการติดต่อย้อนหลัง ลบแล้วรายงานเก่าจะอ่านไม่ออกว่าปิดเพราะอะไร
 * (ระบบเดิมก็ใช้ `status = 'inactive'` ไม่ได้ลบเช่นกัน — มีของจริง 5 แถว)
 */
export async function deactivateRecruitReason(id: string): Promise<RecruitReason | null> {
  return updateRecruitReason(id, { isActive: false });
}
