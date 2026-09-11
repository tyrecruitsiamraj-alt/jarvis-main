/**
 * ═══ กล่องรับผลดิบจาก Lumos (11 ก.ย. 2569) ═══
 *
 * เจ้าของถาม: *"งงเพราะอะไรผลรอบแรกไม่ขึ้น ไม่เข้าใจ ต่อให้บอกว่า completed
 * มันก็ต้องขึ้นนะ"*
 *
 * ตอบไม่ได้ เพราะของเดิม `applyLumosResult()` จับคู่ไม่ได้แล้ว **ทิ้งเงียบ**
 * ⇒ แยกไม่ออกระหว่าง **เขาไม่ส่ง** (เรื่องของเขา) กับ **ส่งแล้วเราจับคู่ไม่ได้** (เรื่องของเรา)
 * เรามี log ขาออกละเอียดแล้ว แต่ขาเข้ายังไม่มีอะไรเลย
 *
 * ไฟล์นี้จดทุกใบที่เขายิงเข้ามา **ก่อน**ตัดสินว่าจับคู่ได้หรือไม่
 *
 * 🔴 **จดไม่สำเร็จห้ามทำให้ ingest ล้ม** — Lumos จะยิงซ้ำ และการรับผลสำคัญกว่าการจด
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError, logWarn } from './logger.js';

const inboxTable = tableInAppSchema('lumos_result_inbox');

export type LumosInboxRecord = {
  channel: 'reminder' | 'interview';
  clientRef: string | null;
  planId: string | null;
  stepId: string | null;
  stepPosition: number | null;
  status: string | null;
  outcome: string | null;
  matched: boolean;
  /** เหตุที่จับคู่ไม่ได้ — `null` เมื่อจับคู่ได้ */
  unmatchedReason: string | null;
  payload: unknown;
};

/** แกะค่าที่ใช้ค้นบ่อยออกจากผลดิบ — ไม่รู้จักก็เป็น null ไม่ต้องเดา */
export function readInboxFields(result: unknown): Omit<
  LumosInboxRecord,
  'channel' | 'matched' | 'unmatchedReason' | 'payload'
> {
  const o = (typeof result === 'object' && result !== null ? result : {}) as Record<string, unknown>;
  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null;
  const pos = Number(o.step_position);
  return {
    clientRef: str(o.client_contact_id) ?? str(o.client_candidate_id),
    planId: str(o.plan_id),
    stepId: str(o.step_id),
    stepPosition: Number.isInteger(pos) && pos >= 0 ? pos : null,
    status: str(o.status),
    outcome: str(o.outcome),
  };
}

export async function recordLumosResultInbox(rec: LumosInboxRecord): Promise<void> {
  try {
    await dbQuery(
      `insert into ${inboxTable}
         (channel, client_ref, plan_id, step_id, step_position, status, outcome,
          matched, unmatched_reason, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        rec.channel,
        rec.clientRef,
        rec.planId,
        rec.stepId,
        rec.stepPosition,
        rec.status,
        rec.outcome,
        rec.matched,
        rec.unmatchedReason,
        JSON.stringify(rec.payload ?? null),
      ],
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // ยังไม่ได้รัน migration 119 — เตือนแล้วไปต่อ ห้ามทำให้การรับผลล้ม
    if (/lumos_result_inbox/i.test(msg)) {
      logWarn('lumos.inbox: ยังไม่มีตาราง (ยังไม่ได้รัน migration 119?)');
      return;
    }
    logError('lumos.inbox: จดผลขาเข้าไม่สำเร็จ', e, { clientRef: rec.clientRef });
  }
}
