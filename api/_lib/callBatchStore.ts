/**
 * ชุดส่งงานโทร ฝั่ง server — สร้าง / อนุมัติ / ยกเลิก / ถอนคนออก / ปล่อยเข้าคิว
 *
 * ความหมายของสถานะอยู่ที่ src/lib/callBatch.ts (ใช้ร่วมกับหน้าเว็บ)
 *
 * ไม่มี cron — ปล่อยชุดที่ถึงเวลาแบบ lazy: `releaseDueCallBatches()` ถูกเรียก
 * ก่อนอ่านรายการชุด และก่อนเสิร์ฟคิวให้ Lumos (ซึ่ง Lumos ยิงเข้ามาเรื่อย ๆ อยู่แล้ว)
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { notifyRoles } from './appNotifications.js';
import { tableInAppSchema } from './schema.js';
import { CALL_BATCH_UNDO_MINUTES, type CallBatch, type CallBatchStatus } from '../../src/lib/callBatch.js';

const batchTable = tableInAppSchema('lumos_call_batches');
const itemTable = tableInAppSchema('lumos_call_batch_items');

type BatchRow = {
  id: string;
  channel: string;
  job_id: string;
  request_no: string | null;
  status: string;
  release_at: string | null;
  created_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  dispatched_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  note: string | null;
  created_at: string;
};

type ItemRow = {
  id: string;
  batch_id: string;
  source: string;
  candidate_ref: string;
  candidate_name: string | null;
  removed_at: string | null;
};

const BATCH_COLS = `id, channel, job_id, request_no, status, release_at, created_by_name,
  approved_by_name, approved_at, dispatched_at, cancelled_at, cancel_reason, note, created_at`;

function mapBatch(r: BatchRow, items: CallBatch['items']): CallBatch {
  return {
    id: r.id,
    channel: r.channel === 'interview' ? 'interview' : 'reminder',
    jobId: r.job_id,
    requestNo: r.request_no,
    status: r.status as CallBatchStatus,
    releaseAt: r.release_at,
    createdByName: r.created_by_name,
    approvedByName: r.approved_by_name,
    approvedAt: r.approved_at,
    dispatchedAt: r.dispatched_at,
    cancelledAt: r.cancelled_at,
    cancelReason: r.cancel_reason,
    note: r.note,
    createdAt: r.created_at,
    items,
  };
}

async function attachItems(rows: BatchRow[]): Promise<CallBatch[]> {
  if (rows.length === 0) return [];
  const { rows: items } = await dbQuery<ItemRow>(
    `select id, batch_id, source, candidate_ref, candidate_name, removed_at
       from ${itemTable} where batch_id = any($1::uuid[]) order by created_at`,
    [rows.map((r) => r.id)],
  );
  const byBatch = new Map<string, CallBatch['items']>();
  for (const i of items) {
    const list = byBatch.get(i.batch_id) ?? [];
    list.push({
      id: i.id,
      source: i.source === 'irecruit' ? 'irecruit' : 'board',
      candidateRef: i.candidate_ref,
      candidateName: i.candidate_name,
      removed: !!i.removed_at,
    });
    byBatch.set(i.batch_id, list);
  }
  return rows.map((r) => mapBatch(r, byBatch.get(r.id) ?? []));
}

export type CreateBatchInput = {
  channel: 'reminder' | 'interview';
  jobId: string;
  requestNo?: string | null;
  items: Array<{ source: 'board' | 'irecruit'; candidateRef: string; candidateName?: string | null }>;
  note?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  /** ข้ามขั้นอนุมัติ (โหมด auto ในอนาคต) — อนุมัติให้ทันทีโดยระบบ */
  autoApprove?: boolean;
};

export async function createCallBatch(input: CreateBatchInput): Promise<CallBatch | null> {
  if (input.items.length === 0) return null;
  const status: CallBatchStatus = input.autoApprove ? 'approved' : 'pending_approval';
  const releaseSql = input.autoApprove
    ? `now() + interval '${CALL_BATCH_UNDO_MINUTES} minutes'`
    : 'null';

  const { rows } = await dbQuery<BatchRow>(
    `insert into ${batchTable}
       (channel, job_id, request_no, status, release_at, created_by_user_id, created_by_name,
        approved_by_name, approved_at, note)
     values ($1,$2,$3,$4, ${releaseSql}, $5,$6,
             ${input.autoApprove ? "'ระบบ (โหมดอัตโนมัติ)'" : 'null'},
             ${input.autoApprove ? 'now()' : 'null'}, $7)
     returning ${BATCH_COLS}`,
    [
      input.channel,
      input.jobId,
      input.requestNo ?? null,
      status,
      input.createdByUserId ?? null,
      input.createdByName ?? null,
      input.note ?? null,
    ],
  );
  const batch = rows[0];
  if (!batch) return null;

  for (const item of input.items) {
    await dbQuery(
      `insert into ${itemTable} (batch_id, source, candidate_ref, candidate_name)
       values ($1,$2,$3,$4)
       on conflict (batch_id, source, candidate_ref) do nothing`,
      [batch.id, item.source, item.candidateRef, item.candidateName ?? null],
    );
  }

  // เด้งบอกคนอนุมัติ — เดิมชุดรออนุมัตินอนเงียบจนกว่าจะมีคนเปิดหน้าจอเอง
  // ครอบคลุมทุกทางเข้า (ปุ่มในหน้า Matching + โหมด assist จัดชุดเอง) เพราะทุกทางผ่านที่นี่
  // notifyRoles กลืน error เอง — ชุดต้องสร้างสำเร็จแม้ตารางแจ้งเตือนยังไม่ migrate
  if (status === 'pending_approval') {
    await notifyRoles(['admin', 'supervisor'], {
      type: 'batch_pending',
      title: `📋 ชุดส่งงานโทรรออนุมัติ — ${input.items.length.toLocaleString('th-TH')} คน`,
      body: `ใบขอ ${input.requestNo || input.jobId} · สร้างโดย ${input.createdByName || 'ระบบ'}`,
      link: '/matching/my-calls',
      dedupeKey: `batch_pending:${batch.id}`,
    });
  }

  return (await attachItems([batch]))[0] ?? null;
}

export async function getCallBatch(id: string): Promise<CallBatch | null> {
  try {
    const { rows } = await dbQuery<BatchRow>(`select ${BATCH_COLS} from ${batchTable} where id = $1`, [id]);
    return rows[0] ? ((await attachItems(rows))[0] ?? null) : null;
  } catch (e) {
    if (isPgUndefinedTable(e)) return null;
    throw e;
  }
}

/** ชุดที่ยังไม่จบ (รออนุมัติ / รอปล่อย) + ชุดที่เพิ่งส่งไป — สำหรับแผงอนุมัติ (หน้างานโทร) */
export async function listCallBatches(limit = 50): Promise<CallBatch[]> {
  try {
    await releaseDueCallBatches();
    const { rows } = await dbQuery<BatchRow>(
      `select ${BATCH_COLS} from ${batchTable}
        order by (status in ('pending_approval','approved')) desc, created_at desc
        limit $1`,
      [Math.min(Math.max(limit, 1), 200)],
    );
    return attachItems(rows);
  } catch (e) {
    if (isPgUndefinedTable(e)) return [];
    throw e;
  }
}

/** อนุมัติ — ตั้งเวลาปล่อยไว้ข้างหน้าเพื่อให้ยังถอนคำได้ */
export async function approveCallBatch(
  id: string,
  approver: { userId?: string | null; name?: string | null },
): Promise<CallBatch | null> {
  const { rows } = await dbQuery<BatchRow>(
    `update ${batchTable}
        set status = 'approved',
            release_at = now() + interval '${CALL_BATCH_UNDO_MINUTES} minutes',
            approved_by_user_id = $2, approved_by_name = $3, approved_at = now(), updated_at = now()
      where id = $1 and status in ('draft', 'pending_approval')
      returning ${BATCH_COLS}`,
    [id, approver.userId ?? null, approver.name ?? null],
  );
  return rows[0] ? ((await attachItems(rows))[0] ?? null) : null;
}

export async function cancelCallBatch(
  id: string,
  by: { name?: string | null; reason?: string | null },
): Promise<CallBatch | null> {
  const { rows } = await dbQuery<BatchRow>(
    `update ${batchTable}
        set status = 'cancelled', cancelled_at = now(), cancelled_by_name = $2,
            cancel_reason = $3, release_at = null, updated_at = now()
      where id = $1 and status in ('draft', 'pending_approval', 'approved')
      returning ${BATCH_COLS}`,
    [id, by.name ?? null, by.reason ?? null],
  );
  return rows[0] ? ((await attachItems(rows))[0] ?? null) : null;
}

/** ถอนคนออกจากชุด (ก่อนเข้าคิวจริง) — ไม่ลบแถว เก็บไว้ว่าใครถอน */
export async function removeCallBatchItem(
  batchId: string,
  itemId: string,
  byName: string | null,
): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(
    `update ${itemTable} i
        set removed_at = now(), removed_by_name = $3
      where i.id = $2 and i.batch_id = $1 and i.removed_at is null
        and exists (
          select 1 from ${batchTable} b
           where b.id = $1 and b.status in ('draft', 'pending_approval', 'approved')
        )
      returning i.id`,
    [batchId, itemId, byName],
  );
  return rows.length > 0;
}

/**
 * ปล่อยชุดที่ถึงเวลาแล้วเข้าคิวจริง
 *
 * คืนรายการชุดที่ถูกปล่อย — ตัวเรียกต้องเอาไป enqueue เอง เพราะ enqueue อยู่ใน
 * lumosDispatch.ts ซึ่ง import ไฟล์นี้ (จะเรียกกลับก็เป็นวงกลม)
 *
 * ทำเป็น 2 ขั้นแบบ claim-then-work: mark เป็น dispatched ก่อนด้วยเงื่อนไข status='approved'
 * ทำให้ 2 request ที่เข้ามาพร้อมกันไม่ปล่อยชุดเดียวกันซ้ำ (คนแรกชนะที่ DB)
 */
export async function claimDueCallBatches(): Promise<CallBatch[]> {
  try {
    const { rows } = await dbQuery<BatchRow>(
      `update ${batchTable}
          set status = 'dispatched', dispatched_at = now(), updated_at = now()
        where id in (
          select id from ${batchTable}
           where status = 'approved' and release_at is not null and release_at <= now()
           for update skip locked
        )
        returning ${BATCH_COLS}`,
    );
    return attachItems(rows);
  } catch (e) {
    if (isPgUndefinedTable(e)) return [];
    throw e;
  }
}

/**
 * เรียกแบบ fire-and-forget จากจุดที่มีคนเข้ามาบ่อย ๆ (อ่านรายการชุด / Lumos ดึงคิว)
 * ตัว enqueue จริงถูกเสียบเข้ามาทีหลังผ่าน setCallBatchDispatcher() เพื่อเลี่ยง import วงกลม
 */
type BatchDispatcher = (batch: CallBatch) => Promise<void>;
let dispatcher: BatchDispatcher | null = null;

export function setCallBatchDispatcher(fn: BatchDispatcher): void {
  dispatcher = fn;
}

export async function releaseDueCallBatches(): Promise<number> {
  if (!dispatcher) return 0;
  const due = await claimDueCallBatches();
  let sent = 0;
  for (const batch of due) {
    try {
      await dispatcher(batch);
      sent += 1;
    } catch {
      /* ชุดนี้ส่งไม่สำเร็จ — สถานะเป็น dispatched แล้ว ไม่วนซ้ำ (ดูใน log ของ enqueue) */
    }
  }
  return sent;
}
