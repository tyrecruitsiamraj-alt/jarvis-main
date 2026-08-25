/**
 * POST /api/application-call-choice { ids: string[], choice: 'manual' | 'ai' }
 *
 * เส้นเดียวของ **"ใครจะโทรหาคนนี้"** — ใช้สองที่ที่เจ้าของเคาะให้เป็นเรื่องเดียวกัน:
 *
 * 1. **ปุ่ม "เก็บไปโทรเอง"** (Phase 3 ข้อ ② · เจ้าของเคาะ 22 ส.ค. 2569)
 *    เดิมเป็นสองปุ่มที่คนงงว่าต่างกันตรงไหน: "เก็บไปติดต่อ" (claim บนใบ) กับ
 *    "ดึงเข้าถังโทร" (hold ที่เบอร์ กัน AI โทรทับ) → **รวมเป็นปุ่มเดียว**
 *    กดทีเดียวได้ทั้งสองอย่าง = จองใบ + ล็อกเบอร์ (`choice: 'manual'`)
 *
 * 2. **กอง "เลือกวิธีโทร"** (Phase 5.9) — ใบที่ worker ถอด claim เพราะดองเกิน 1 วัน
 *    ต้องเลือก [โทรเอง] (`manual`) หรือ [ส่ง AI โทร] (`ai`) · ไม่เลือกใน 1 วัน
 *    worker ส่ง AI เอง (`auto_ai` — เส้นนี้ไม่รับค่านั้น คนเลือกเองไม่ใช่ auto)
 *
 * 🔴 กติกาที่ห้ามพลาด
 * - claim กับ hold **คนละกุญแจ** (ใบ vs เบอร์ E.164) จึงต้องยิงทั้งคู่ · hold คือตัวที่
 *   กัน AI โทรทับจริง (`listHeldPhones()` ใน insertQueueItems) — claim อย่างเดียวไม่กัน
 * - ใบไม่มีเบอร์/ไม่ผูกใบขอ **ล็อกไม่ได้** → รายงานเป็น skipped ไม่ใช่เงียบ
 * - ส่ง AI ผ่าน `enqueueLumosInterviewForApplications()` → `insertQueueItems()` เท่านั้น
 *   (คอขวดเดียวที่มีด่าน held/suppressed/declined/quiet-hours ครบ)
 * - เลือกแล้วต้องออกจากกองรอ (`call_choice` ไม่เป็น null) ไม่งั้น worker ส่ง AI ทับคนที่
 *   เพิ่งกดเก็บไปโทรเอง
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { isApplicationInWriteScope } from '../_lib/applicationScope.js';
import { acquireCallHold } from '../_lib/candidateCallHolds.js';
import { enqueueLumosInterviewForApplications } from '../_lib/lumosDispatch.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { logError } from '../_lib/logger.js';

const tbl = tableInAppSchema('public_job_applications');

/** เพดานต่อครั้ง — ปุ่ม "ทั้งหมด" ในแท็บไม่สนใจกดทีเดียวได้หลายสิบคน แต่ไม่ควรเป็นพัน */
const MAX_IDS = 200;

type Row = {
  id: string;
  full_name: string;
  phone: string | null;
  job_id: string | null;
  department_code: string | null;
  job_title: string | null;
  unit_name: string | null;
  position_interest: string | null;
  claimed_by: string | null;
  claimed_by_name: string | null;
};

export type CallChoiceResult = {
  choice: 'manual' | 'ai';
  /** สำเร็จตามที่เลือก */
  done: number;
  /** ทำไม่ได้ + เหตุผลรายคน (ต้องเห็นบนจอ ไม่ใช่หายเงียบ) */
  skipped: Array<{ name: string; reason: string }>;
};

function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

/** ปั๊มว่าเลือกวิธีไหนแล้ว — ออกจากกองรอทันที (worker จะไม่ส่ง AI ทับ) */
async function stampChoice(ids: string[], choice: 'manual' | 'ai', name: string | null): Promise<void> {
  if (ids.length === 0) return;
  try {
    await dbQuery(
      `update ${tbl}
          set call_choice = $2, call_choice_at = now(), call_choice_by_name = $3, updated_at = now()
        where id = any($1::uuid[])`,
      [ids, choice, name],
    );
  } catch (e) {
    // ยังไม่รัน 104 → ปุ่มยังทำงานหลักได้ (claim/hold/ส่ง AI) แค่ไม่มีการจดวิธี
    if (!isUndefinedColumn(e)) throw e;
    logError('callChoice.stamp.skipped', e, { reason: 'migration 104 ยังไม่รัน' });
  }
}

/** โทรเอง = จองใบ (claim) + ล็อกเบอร์กัน AI ทับ (hold) — สองกุญแจต้องได้ทั้งคู่ */
async function chooseManual(req: AuthedReq, rows: Row[]): Promise<CallChoiceResult> {
  const skipped: CallChoiceResult['skipped'] = [];
  const okIds: string[] = [];

  for (const r of rows) {
    if (r.claimed_by && r.claimed_by !== req.user.sub) {
      skipped.push({ name: r.full_name, reason: 'มีเจ้าหน้าที่คนอื่นเก็บไปแล้ว' });
      continue;
    }
    // ① จองใบ — DB ตัดสินการชน (เงื่อนไขใน WHERE) ไม่ใช่ลำดับโค้ด
    const { rows: claimed } = await dbQuery<{ id: string }>(
      `update ${tbl}
          set claimed_by = $2, claimed_by_name = $3, claimed_at = now(),
              status = case when status = 'new' then 'contacted' else status end,
              updated_at = now()
        where id = $1 and (claimed_by is null or claimed_by = $2)
        returning id`,
      [r.id, req.user.sub, req.user.email || null],
    );
    if (claimed.length === 0) {
      skipped.push({ name: r.full_name, reason: 'มีเจ้าหน้าที่คนอื่นเก็บไปก่อน' });
      continue;
    }

    // ② ล็อกเบอร์ — ตัวที่กัน AI โทรทับจริง · ล็อกไม่ได้ต้องบอกว่าทำไม (ใบยังถูกจองแล้ว)
    if (!r.phone?.trim() || !r.job_id?.trim()) {
      okIds.push(r.id);
      skipped.push({
        name: r.full_name,
        reason: !r.phone?.trim()
          ? 'เก็บใบแล้ว แต่ไม่มีเบอร์ให้ล็อก — AI อาจโทรทับได้'
          : 'เก็บใบแล้ว แต่ใบไม่ผูกใบขอ ล็อกเบอร์ไม่ได้ — AI อาจโทรทับได้',
      });
      continue;
    }
    const hold = await acquireCallHold({
      phone: r.phone,
      source: 'application',
      candidateRef: r.id,
      candidateName: r.full_name,
      jobId: r.job_id,
      userId: req.user.sub,
      userName: req.user.email || null,
    });
    /**
     * 🔴 ล็อกเบอร์ไม่สำเร็จ **ทุกเหตุผล** ต้องรายงาน ไม่ใช่เฉพาะ `taken`
     * เจอจริงตอนตรวจ 23 ส.ค. 2569: เบอร์ 11 หลักแปลง E.164 ไม่ได้ → `no_phone`
     * แล้วโค้ดเงียบ → คนอ่านว่า "เก็บสำเร็จ" ทั้งที่ **AI ยังโทรทับได้**
     * (ใบยังถูกจองสำเร็จแล้ว จึงนับเป็น done ต่อไป — แต่ต้องพูดความจริงเรื่องล็อก)
     */
    if (!hold.ok) {
      skipped.push({
        name: r.full_name,
        reason:
          hold.reason === 'taken'
            ? `เบอร์นี้ ${hold.hold.heldByName || 'คนอื่น'} ถือไปโทรอยู่ — เก็บใบให้แล้วแต่ยังโทรทับกันได้`
            : 'เก็บใบแล้ว แต่เบอร์นี้ใช้กับระบบโทรไม่ได้ ล็อกไม่ได้ — AI อาจโทรทับได้ (แก้เบอร์ก่อน)',
      });
    }
    okIds.push(r.id);
  }

  await stampChoice(okIds, 'manual', req.user.email || null);
  return { choice: 'manual', done: okIds.length, skipped };
}

/** ส่ง AI = ปั๊มก่อนแล้วเข้าคิวผ่านคอขวดเดิม (ด่านกันซ้ำ/กันเบอร์ที่คนถือทำงานครบ) */
async function chooseAi(req: AuthedReq, rows: Row[]): Promise<CallChoiceResult> {
  const skipped: CallChoiceResult['skipped'] = [];
  const byJob = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.job_id?.trim()) {
      skipped.push({ name: r.full_name, reason: 'ใบไม่ผูกใบขอ — ส่งเข้าคิวโทรไม่ได้' });
      continue;
    }
    if (!r.phone?.trim()) {
      skipped.push({ name: r.full_name, reason: 'ไม่มีเบอร์โทร' });
      continue;
    }
    const list = byJob.get(r.job_id) ?? [];
    list.push(r);
    byJob.set(r.job_id, list);
  }

  let done = 0;
  for (const [jobId, apps] of byJob) {
    // ปั๊มก่อนส่ง — ล้มกลางทางแล้วใบยังออกจากกองรอ ดีกว่ารอบถัดไปยิงซ้ำคนเดิม
    await stampChoice(apps.map((a) => a.id), 'ai', req.user.email || null);
    const outcome = await enqueueLumosInterviewForApplications(jobId, apps, { autoPush: true });
    done += outcome.queued;
    for (const s of outcome.skipped) {
      skipped.push({ name: s.name, reason: s.reason });
    }
    // เข้าคิวไม่ได้เพราะซ้ำแถวเดิมที่ยัง active — บอกตรง ๆ ว่าอยู่ในคิวแล้ว
    for (const ref of outcome.duplicated) {
      const app = apps.find((a) => `app-${a.id}` === ref);
      if (app) skipped.push({ name: app.full_name, reason: 'อยู่ในคิว AI อยู่แล้ว' });
    }
  }
  return { choice: 'ai', done, skipped };
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || '').toUpperCase() !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const raw = (await readJsonBody(req)) as Record<string, unknown> | null;
    const choice = raw?.choice;
    if (choice !== 'manual' && choice !== 'ai') {
      return sendError(res, 400, 'Bad request', 'choice ต้องเป็น manual หรือ ai');
    }
    const ids = Array.isArray(raw?.ids)
      ? [...new Set(raw.ids.filter((v): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)))]
      : [];
    if (ids.length === 0) return sendError(res, 400, 'Bad request', 'ต้องระบุ ids ของใบสมัคร');
    if (ids.length > MAX_IDS) {
      return sendError(res, 400, 'Bad request', `ทำได้ครั้งละไม่เกิน ${MAX_IDS} คน`);
    }

    const { rows } = await dbQuery<Row>(
      `select a.id, a.full_name, a.phone, a.job_id, a.department_code,
              a.job_title, a.unit_name, a.position_interest, a.claimed_by, a.claimed_by_name
         from ${tbl} a
        where a.id = any($1::uuid[])`,
      [ids],
    );
    if (rows.length === 0) return sendError(res, 404, 'Not found', 'ไม่พบใบสมัคร');

    // BU scope ต่อใบ — กันเดา id แล้วไปแตะใบของแผนกอื่น (ด่านเดียวกับ patchClaim)
    const allowed: Row[] = [];
    const skippedScope: CallChoiceResult['skipped'] = [];
    for (const r of rows) {
      if (await isApplicationInWriteScope(req.user, r)) allowed.push(r);
      else skippedScope.push({ name: r.full_name, reason: 'ใบสมัครนี้อยู่นอกแผนกของคุณ' });
    }
    if (allowed.length === 0) {
      return sendError(res, 403, 'Forbidden', 'ใบสมัครที่เลือกอยู่นอกแผนกของคุณ');
    }

    const result = choice === 'manual' ? await chooseManual(req, allowed) : await chooseAi(req, allowed);
    result.skipped = [...skippedScope, ...result.skipped];

    void auditFromAuthed(req, {
      action: `application.call_choice.${choice}`,
      entityType: 'job_application',
      entityId: allowed.length === 1 ? allowed[0].id : `bulk:${allowed.length}`,
      after: { choice, done: result.done, skipped: result.skipped.length },
    });

    return res.status(200).json(result);
  } catch (e) {
    return handleApiError(res, e, 'application-call-choice', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
