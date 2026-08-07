/**
 * ชุดส่งงานโทร — นิยามกลางที่ทั้งหน้าเว็บและ API ใช้ร่วมกัน
 * ดู migrations/071_lumos_call_batches.sql ว่าทำไมต้องมีชั้นนี้
 */

export const CALL_BATCH_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'dispatched',
  'cancelled',
] as const;
export type CallBatchStatus = (typeof CALL_BATCH_STATUSES)[number];

export function isCallBatchStatus(v: unknown): v is CallBatchStatus {
  return typeof v === 'string' && (CALL_BATCH_STATUSES as readonly string[]).includes(v);
}

export const CALL_BATCH_STATUS_LABEL: Record<CallBatchStatus, string> = {
  draft: 'ร่าง',
  pending_approval: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว — รอปล่อย',
  dispatched: 'ส่งเข้าคิวแล้ว',
  cancelled: 'ยกเลิก',
};

/**
 * ช่วงถอนคำหลังอนุมัติ (นาที) — อนุมัติแล้วยังยกเลิก/ถอนคนออกได้ในช่วงนี้
 * ค่านี้เจ้าของยังไม่เคาะตัวเลขตรง ๆ · ใช้ 10 นาทีตามที่เสนอไว้ใน docs/lumos-hybrid-flow.md
 * เปลี่ยนที่นี่ที่เดียว (ยังไม่ทำหน้าตั้งค่าเพราะรอเจ้าของยืนยันตัวเลขก่อน)
 */
export const CALL_BATCH_UNDO_MINUTES = 10;

export type CallBatchItem = {
  id: string;
  source: 'board' | 'irecruit';
  candidateRef: string;
  candidateName: string | null;
  removed: boolean;
};

export type CallBatch = {
  id: string;
  channel: 'reminder' | 'interview';
  jobId: string;
  requestNo: string | null;
  status: CallBatchStatus;
  releaseAt: string | null;
  createdByName: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  dispatchedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  note: string | null;
  createdAt: string;
  items: CallBatchItem[];
};

/** ยังแก้รายชื่อ/ยกเลิกได้ไหม — ก่อนเข้าคิวจริงเท่านั้น */
export function canEditBatch(batch: Pick<CallBatch, 'status'>): boolean {
  return batch.status === 'draft' || batch.status === 'pending_approval' || batch.status === 'approved';
}

/** เหลือเวลาถอนคำอีกกี่มิลลิวินาที (ติดลบ = ถึงเวลาปล่อยแล้ว) */
export function undoMsLeft(batch: Pick<CallBatch, 'status' | 'releaseAt'>, now: number): number {
  if (batch.status !== 'approved' || !batch.releaseAt) return 0;
  return new Date(batch.releaseAt).getTime() - now;
}

/** จำนวนคนที่จะถูกโทรจริง (ไม่นับคนที่ถอนออก) */
export function activeItemCount(batch: Pick<CallBatch, 'items'>): number {
  return batch.items.filter((i) => !i.removed).length;
}
