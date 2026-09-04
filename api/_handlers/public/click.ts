import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { readJsonBody, getString } from '../../_lib/body.js';
import { recordPublicClick } from '../../_lib/publicClicks.js';

/**
 * `POST /api/public/click` — นับคลิกบนหน้าสาธารณะ (ไม่ต้องล็อกอิน)
 *
 * เจ้าของถาม 3 ก.ย. 2569: *"แท็กจำนวนคลิกได้ไหม ในหน้าสาธารณะ"*
 *
 * 🔴 **นับยอดรายวันเท่านั้น ไม่เก็บว่าใครกด** — ไม่มี IP / user-agent / คุกกี้
 * 🔴 **คืน 204 เสมอแม้เขียนไม่สำเร็จ** — การนับคลิกห้ามทำให้หน้าสมัครงานสะดุด
 *    (หน้านี้คือหน้าที่คนจริงกำลังจะสมัครงาน · ตัวนับพังก็แค่เลขหาย ไม่ใช่คนสมัครไม่ได้)
 */
export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') return sendError(res, 405, 'Method not allowed');
  // เพดานกันยิงถล่ม — คนจริงกดไม่กี่ครั้งต่อรอบเข้าเว็บ
  if (!rateLimitOrReject(req, res, 'public-click', 120, 10 * 60 * 1000)) return;

  try {
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    await recordPublicClick({
      action: getString(body.action) ?? '',
      jobRef: getString(body.job_ref),
      postingId: getString(body.posting_id),
      linkCode: getString(body.link_code),
      embedded: body.embedded === true,
    }).catch(() => undefined);
    return res.status(204).end?.() ?? res.status(204).json({});
  } catch (e) {
    // ตัวนับล้มห้ามส่ง error กลับไปให้หน้าสมัครงานเห็น
    void handleApiError;
    void e;
    return res.status(204).end?.() ?? res.status(204).json({});
  }
}
