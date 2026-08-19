import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logInfo, logWarn } from './logger.js';
import { loadBoardPhoneSet } from './applicationBoardLink.js';
import {
  pickAutoMoveTarget,
  type AutoMoveApplication,
  type AutoMoveTargetJob,
} from '../../src/lib/applicationAutoMove.js';

const APPS = tableInAppSchema('public_job_applications');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');

/**
 * ตัวเดินย้ายใบสมัครอัตโนมัติ (098 · เจ้าของสั่ง 17 ส.ค. 2569)
 *
 * ใบขอที่คนสมัครไว้ถูกปิด → ใบสมัครค้างชี้ใบที่ตายแล้ว ไม่มีใครหยิบไปทำ
 * ตัวนี้ย้ายไปใบที่ **ยังเปิด + ตำแหน่งเดียวกัน + จังหวัดเดียวกัน** (อำเภอตรงขึ้นก่อน)
 *
 * 🔴 **การตัดสินใจทั้งหมดอยู่ที่ `src/lib/applicationAutoMove.ts` (pure + เทสต์ + mutation)**
 * ไฟล์นี้ทำแค่สองอย่าง: หยิบข้อมูลมาป้อน กับเขียนผลลง DB
 * ห้ามเขียนเงื่อนไข "ย้ายได้ไหม" ซ้ำที่นี่ — สองที่เพี้ยนกันเมื่อไหร่คือย้ายผิดคนโดยไม่มีใครรู้
 *
 * 🔴 **ไม่ทับ `job_id` ทิ้ง** — เก็บใบเดิมไว้ที่ `moved_from_job_id` เสมอ ย้อนกลับได้
 */

export type AutoMoveResult = {
  scanned: number;
  moved: number;
  skipped: number;
  /** เหตุผลที่ไม่ย้าย นับรวม — ไว้ตอบว่า "ทำไมไม่ย้ายสักคน" */
  reasons: Record<string, number>;
  /** ⚠️ `applicant` มีไว้ให้คนอ่านว่า "ย้ายใครไปไหน" — ระบบยังตัดสินด้วย id เท่านั้น */
  details: Array<{
    applicationId: string;
    applicant: string | null;
    from: string;
    to: string;
    reason: string;
  }>;
};

type AppRow = AutoMoveApplication & { job_id: string };

/** ใบที่คนนี้เคยปฏิเสธ — ห้ามเสนอซ้ำ (กติกาถาวรของระบบ ไม่ใช่แค่ 30 วัน) */
async function declinedJobIdsByPhone(phones: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  const list = [...new Set(phones.filter(Boolean))];
  if (list.length === 0) return out;
  try {
    const { rows } = await dbQuery<{ phone: string; job_ref: string }>(
      `select coalesce(q.payload->>'recipient_phone', q.payload->>'phone') as phone,
              q.job_ref
         from ${QUEUE} q
        where coalesce(q.last_outcome, q.result->>'outcome') = 'declined'
          and coalesce(q.payload->>'recipient_phone', q.payload->>'phone') = any($1::text[])`,
      [list],
    );
    for (const r of rows) {
      if (!r.phone || !r.job_ref) continue;
      const set = out.get(r.phone) ?? new Set<string>();
      set.add(r.job_ref);
      out.set(r.phone, set);
    }
  } catch (e) {
    // อ่านประวัติปฏิเสธไม่ได้ = **ไม่ย้ายเลยดีกว่าย้ายทับใบที่เขาปฏิเสธไปแล้ว**
    logWarn('application.autoMove.declinedLookupFailed', { error: String(e) });
    throw e;
  }
  return out;
}

/**
 * `openJobs` = ใบขอที่ยังเปิดอยู่ (ผู้เรียกดึงจาก feed มาให้ — ไฟล์นี้ไม่ยิง ERP เอง)
 * `dryRun` = คิดให้ดูว่าจะย้ายอะไรบ้าง แต่ไม่เขียนจริง
 */
export async function runApplicationAutoMove(
  openJobs: readonly AutoMoveTargetJob[],
  opts: { dryRun?: boolean; limit?: number } = {},
): Promise<AutoMoveResult> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  const openIds = new Set(openJobs.map((j) => j.id));
  const result: AutoMoveResult = { scanned: 0, moved: 0, skipped: 0, reasons: {}, details: [] };

  const { rows } = await dbQuery<AppRow & { phone_e164: string | null; full_name: string | null }>(
    `select a.id, a.job_id, a.province, a.district, a.position_interest, a.job_title,
            a.status, a.moved_at, a.phone_e164, a.full_name
       from ${APPS} a
      where a.job_id is not null and trim(a.job_id) <> ''
        and a.moved_at is null
        and coalesce(a.status, 'new') = 'new'
      order by a.created_at desc
      limit $1`,
    [limit],
  );

  const bump = (reason: string) => {
    result.skipped += 1;
    result.reasons[reason] = (result.reasons[reason] ?? 0) + 1;
  };

  // ใบที่ยังเปิดอยู่ = ไม่ต้องย้าย · เหลือเฉพาะใบที่ใบขอหายไปจาก feed แล้ว
  const orphans = rows.filter((r) => !openIds.has(r.job_id));
  result.scanned = orphans.length;
  if (orphans.length === 0) return result;

  const declined = await declinedJobIdsByPhone(
    orphans.map((r) => r.phone_e164 ?? '').filter(Boolean),
  );

  /**
   * 🔴 "ขึ้นบอร์ดแล้ว" ไม่ใช่คอลัมน์ — เป็น derived จากการจับคู่**เบอร์**กับบอร์ด ERP
   * ต้องเช็คที่นี่ ไม่งั้นคนที่ได้งานแล้วโดนย้ายไปใบใหม่ (แล้วมีคนโทรไปเสนองานซ้ำ)
   *
   * ⚠️ ERP อ่านไม่ได้ = คืน `null` ซึ่งแปลว่า **เช็คไม่ได้** ไม่ใช่ "ไม่มีใครบนบอร์ด"
   * เช็คไม่ได้ → **ไม่ย้ายเลยทั้งรอบ** (เดินต่อแบบเดาคือย้ายคนที่ได้งานแล้ว)
   */
  let boardPhones: Set<string> | null = null;
  try {
    boardPhones = await loadBoardPhoneSet();
  } catch {
    boardPhones = null;
  }
  if (boardPhones === null) {
    result.skipped = orphans.length;
    result.reasons['อ่านบอร์ด ERP ไม่ได้ — ไม่ย้ายทั้งรอบ'] = orphans.length;
    logWarn('application.autoMove.boardUnavailable', { scanned: orphans.length });
    return result;
  }

  for (const row of orphans) {
    const decision = pickAutoMoveTarget(
      { ...row, on_board: boardPhones.has(row.phone_e164 ?? '') },
      openJobs,
      declined.get(row.phone_e164 ?? '') ?? new Set<string>(),
    );
    if (!decision.move) {
      bump(decision.reason);
      continue;
    }
    if (opts.dryRun) {
      result.moved += 1;
      result.details.push({
        applicationId: row.id,
        applicant: row.full_name ?? null,
        from: row.job_id,
        to: decision.job.id,
        reason: decision.reason,
      });
      continue;
    }
    try {
      /**
       * ⚠️ `moved_at is null` ใน WHERE = กันย้ายซ้ำเมื่อมีสองรอบวิ่งพร้อมกัน
       * (ไม่ใส่ = รอบที่สองย้ายคนเดิมต่อไปอีกใบ แล้ว `moved_from_job_id` ชี้ผิด)
       */
      const upd = await dbQuery<{ id: string }>(
        `update ${APPS}
            set moved_from_job_id = job_id,
                job_id = $2,
                moved_at = now(),
                moved_reason = $3
          where id = $1 and moved_at is null and coalesce(status,'new') = 'new'
          returning id`,
        [row.id, decision.job.id, decision.reason],
      );
      if (upd.rows.length === 0) {
        bump('มีรอบอื่นย้ายไปแล้ว');
        continue;
      }
      result.moved += 1;
      result.details.push({
        applicationId: row.id,
        applicant: row.full_name ?? null,
        from: row.job_id,
        to: decision.job.id,
        reason: decision.reason,
      });
    } catch (e) {
      logWarn('application.autoMove.updateFailed', { applicationId: row.id, error: String(e) });
      bump('เขียนไม่สำเร็จ');
    }
  }

  logInfo('application.autoMove.done', {
    scanned: result.scanned,
    moved: result.moved,
    skipped: result.skipped,
    dryRun: Boolean(opts.dryRun),
  });
  return result;
}
