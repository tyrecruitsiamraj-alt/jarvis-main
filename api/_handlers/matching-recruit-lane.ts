/**
 * เลนสรรหา — "หาคนเพิ่ม + ส่ง AI โทร" ข้าม 3 แหล่ง (R2b · เจ้าของเคาะ 16 ส.ค. 2569)
 *
 * GET /api/matching/recruit-lane?jobId=...&send=1
 *   - ค้นคนที่ **ยังไม่สมัคร** จาก iRecruit + ฐานใหม่ So Recruit + ถัง Checklist
 *   - `send=1` → ส่งเขียว+เหลืองเข้าคิว Lumos ทันที ไม่ต้องอนุมัติ (นิยามเลนสรรหา)
 *   - ไม่ใส่ `send` = ค้นดูเฉย ๆ (ไม่แตะคิว)
 *
 * ⚠️ แยก resource จาก `matching-irecruit-candidates` ตั้งใจ — เตรียมไว้ให้ A4
 * แยกสิทธิ์ทีมสรรหา/คัดสรรได้โดยไม่ต้องรื้อ route
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getSiamrajUnitRequestById } from '../_lib/siamrajUnitRequests.js';
import { loadMatchingBuScope } from '../_lib/departmentScope.js';
import { getOllamaConfig } from '../_lib/ollamaClient.js';
import { matchRecruitLaneCandidatesForJob } from '../_lib/recruitLaneMatcher.js';
import { enqueueLumosInterviewForRecruitLane } from '../_lib/lumosDispatch.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method !== 'GET') {
      return sendError(res, 405, 'Method not allowed', 'Read-only recruit-lane matching');
    }
    // ⚠️ ไม่บังคับ iRecruit config เหมือนเลนคัดสรร — เลนนี้มี 3 แหล่ง
    // iRecruit ล่ม/ไม่ได้ตั้งค่า ต้องยังค้นจากฐานใหม่ + Checklist ได้ (ธงบอกอยู่ใน sources[])
    if (!getOllamaConfig()) {
      return sendError(res, 503, 'Service unavailable', 'ตั้งค่า OLLAMA_BASE_URL / OLLAMA_MODEL ก่อน');
    }

    const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
    if (!jobId.trim()) {
      return sendError(res, 400, 'Bad request', 'jobId is required');
    }

    // จำกัดตามแผนก — ห้ามอ้าง jobId ข้ามแผนกเพื่อดึงกองผู้สมัครของใบขออื่น
    const job = await getSiamrajUnitRequestById(jobId, await loadMatchingBuScope(req.user));
    if (!job) {
      return sendError(res, 404, 'Not found', 'ไม่พบใบขอ ERP');
    }

    const result = await matchRecruitLaneCandidatesForJob(jobId, job as Record<string, unknown>, {
      owner: getQuery(req, 'owner') || undefined,
      refresh: getQuery(req, 'refresh') === '1',
    });

    const dispatch =
      getQuery(req, 'send') === '1'
        ? await enqueueLumosInterviewForRecruitLane(job as Record<string, unknown>, result)
        : null;

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({ ...result, dispatch });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/เชื่อมต่อ Ollama|ตั้งค่า OLLAMA|ไม่พบโมเดล|ตอบกลับว่าง|ใช้เวลานานเกินไป/i.test(message)) {
      return sendError(res, 503, 'Service unavailable', message);
    }
    return handleApiError(res, e, 'matching-recruit-lane');
  }
}

export default withRbac(handler, 'matching-recruit-lane');
