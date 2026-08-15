/**
 * GET /api/matching/contact-history?phone=08xxxxxxxx → { items: [...] }
 *
 * ประวัติการติดต่อผู้สมัคร "รวมทุกทาง" (คนโทรเอง + AI โทร) เรียงใหม่→เก่า
 * ตอบคำถามก่อนยกหู: คนนี้ถูกติดต่ออะไรไปแล้วบ้าง — เมื่อวาน AI เพิ่งโทรแล้ว
 * เขาขอเลื่อนหรือเปล่า จะได้ไม่โทรทับจนผู้สมัครรำคาญ
 *
 * คีย์คือ "เบอร์ E.164" เหตุผลเดียวกับล็อกโทร: คนเดียวมีหลาย ref
 * (card_id / iRecruit id / follow-*) แต่เบอร์ที่ดังมีเบอร์เดียว
 *
 * ⚠️ ไม่ส่งเบอร์กลับไปในผลลัพธ์ — หน้าเว็บมีเบอร์อยู่แล้ว (มันเป็นคนส่งมาถาม)
 * และแถวประวัติของใบขอแผนกอื่นต้องไม่พาเบอร์/ข้อความภายในรั่วออกไป
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { dbQuery, isPgUndefinedTable } from '../_lib/postgres.js';
import { toE164Thai } from '../_lib/thaiPhone.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

export type ContactHistoryItem = {
  /** 'human' = คนโทรเอง (จากล็อกโทร) · 'ai' = คิว Lumos */
  kind: 'human' | 'ai';
  at: string;
  jobRef: string | null;
  /** ผลโทร (ศัพท์ Lumos outcome ชุดเดียวกันทั้งสองทาง) — null = ยังไม่มีผล */
  outcome: string | null;
  /** ไม่สนใจแบบไหน: job = ไม่เอางานนี้ · all = ไม่หางานแล้ว (เฉพาะฝั่งคน) */
  scope: string | null;
  /** ใครโทร (ฝั่งคน) — ฝั่ง AI เป็น null */
  byName: string | null;
  /** สถานะคิว (ฝั่ง AI): pending/delivered/completed/failed/cancelled */
  queueStatus: string | null;
  attemptCount: number | null;
};

const LIMIT_PER_SOURCE = 15;

async function handler(req: AuthedReq, res: ApiRes) {
  try {
    return await handleGet(req, res);
  } catch (e) {
    return handleApiError(res, e, 'matching-contact-history');
  }
}

async function handleGet(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }
  res.setHeader?.('Cache-Control', 'no-store');

  const phone = toE164Thai(getQuery(req, 'phone'));
  if (!phone) return sendError(res, 400, 'Bad request', 'ต้องระบุเบอร์โทรที่ถูกต้อง');

  const items: ContactHistoryItem[] = [];

  // ฝั่งคน — ประวัติล็อกโทรทุกครั้งของเบอร์นี้ (รวมที่ปล่อยแล้ว)
  try {
    const { rows } = await dbQuery<{
      held_at: string;
      request_no: string | null;
      job_id: string;
      held_by_name: string | null;
      result_outcome: string | null;
      result_scope: string | null;
    }>(
      `select held_at, request_no, job_id, held_by_name, result_outcome, result_scope
         from candidate_call_holds
        where phone_e164 = $1
        order by held_at desc
        limit $2`,
      [phone, LIMIT_PER_SOURCE],
    );
    for (const r of rows) {
      items.push({
        kind: 'human',
        at: r.held_at,
        jobRef: r.request_no || r.job_id,
        outcome: r.result_outcome,
        scope: r.result_scope,
        byName: r.held_by_name,
        queueStatus: null,
        attemptCount: null,
      });
    }
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e; // ตารางยังไม่ migrate = ข้ามเฉย ๆ
  }

  // ฝั่ง AI — คิว Lumos ของเบอร์นี้ (เบอร์อยู่ใน payload ตาราง ~5 พันแถว query ตรงไหว)
  try {
    const { rows } = await dbQuery<{
      updated_at: string;
      job_ref: string;
      status: string;
      attempt_count: number | null;
      last_outcome: string | null;
      result_outcome: string | null;
    }>(
      // เบอร์อยู่คนละคีย์ตามช่องทาง: reminder/board ใช้ recipient_phone · interview/iRecruit
      // ใช้ phone — coalesce สองคีย์ ไม่งั้นประวัติฝั่ง iRecruit หายทั้งหมด (โทรทับทันที)
      `select updated_at, job_ref, status, attempt_count,
              last_outcome, result->>'outcome' as result_outcome
         from lumos_dispatch_queue
        where coalesce(payload->>'recipient_phone', payload->>'phone') = $1
        order by updated_at desc
        limit $2`,
      [phone, LIMIT_PER_SOURCE],
    );
    for (const r of rows) {
      items.push({
        kind: 'ai',
        at: r.updated_at,
        jobRef: r.job_ref,
        // แถวเก่าก่อน migration 070 คอลัมน์ last_outcome ว่าง — ถอยไปอ่าน result
        outcome: r.last_outcome || r.result_outcome,
        scope: null,
        byName: null,
        queueStatus: r.status,
        attemptCount: r.attempt_count,
      });
    }
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return res.status(200).json({ items: items.slice(0, 20) });
}

export default withRbac(handler, 'matching-proposals');
