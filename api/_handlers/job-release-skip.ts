/**
 * `/api/job-release-skip` — ตั้ง / ยกเลิก "ไม่ปล่อย + เหตุผล" ของใบขอ (migration 129 · 29 ก.ย. 2569)
 *
 *   GET    → ทุกใบที่ตั้ง "ไม่ปล่อย" (กล่องงานติดชิป · หน้าทีม Online นับก้อน "ไม่อนุมัติ")
 *   POST   → ตั้ง `{ jobId, reason, note }` (กดซ้ำ = เปลี่ยนเหตุผล)
 *   DELETE → ยกเลิก (`?jobId=` — body ของ DELETE ไม่ถึง handler ในเซิร์ฟเวอร์ท้องถิ่น · บทเรียนทะเบียนปล่อย)
 *
 * 🔴 กติกา:
 * 1. ต้องส่ง **id เต็ม** ของใบ (`siamraj-sql:` / `siamraj-pre:`) — แบบเดียวกับทะเบียนปล่อย
 * 2. ใบที่ **ปล่อยขึ้นหน้าสาธารณะอยู่** ตั้ง "ไม่ปล่อย" ไม่ได้ (409) — ต้องดึงลงก่อน (กันสถานะขัดกันเอง)
 * 3. เหตุผลตรวจด้วย `validateReleaseSkip` ตัวเดียวกับฟอร์ม · "อื่น ๆ" ต้องพิมพ์เหตุผล
 * 4. rbac key เดียวกับการปล่อย (`recruit-postings`) — คนที่ตัดสินใจปล่อยได้ คือคนที่ตัดสินใจไม่ปล่อยได้
 */
import { handleApiError, sendError, withRbac, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { clearReleaseSkip, listReleaseSkips, markReleaseSkip } from '../_lib/jobReleaseSkips.js';
import { isReleased, loadReleasedJobKeys } from '../_lib/jobPublicReleases.js';
import { validateReleaseSkip } from '../../src/lib/jobReleaseSkips.js';

const JOB_ID_RE = /^siamraj-(sql|pre):[^\s]{1,80}$/;

function readJobId(req: AuthedReq): string {
  const b = (req.body ?? {}) as { jobId?: unknown };
  const q = (req.query ?? {}) as { jobId?: unknown };
  const raw = typeof b.jobId === 'string' ? b.jobId : typeof q.jobId === 'string' ? q.jobId : '';
  return raw.trim();
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      const skips = await listReleaseSkips();
      return res.status(200).json({ skips, total: skips.length });
    }

    if (method !== 'POST' && method !== 'DELETE') return sendError(res, 405, 'Method not allowed');

    const jobId = readJobId(req);
    if (!JOB_ID_RE.test(jobId)) {
      return sendError(res, 400, 'Bad request', 'ต้องระบุ jobId เป็น id เต็มของใบขอ (siamraj-sql:… / siamraj-pre:…)');
    }

    if (method === 'DELETE') {
      const count = await clearReleaseSkip(jobId);
      return res.status(200).json({ ok: true, action: 'cleared', count });
    }

    const body = (req.body ?? {}) as { reason?: unknown; note?: unknown };
    const v = validateReleaseSkip({ reason: body.reason, note: body.note });
    if (v.ok === false) return sendError(res, 400, 'Bad request', v.message);

    if (isReleased(await loadReleasedJobKeys(), jobId)) {
      return sendError(res, 409, 'Conflict', 'ใบนี้อยู่บนหน้าสาธารณะแล้ว — ดึงลงก่อนถึงจะตั้ง “ไม่ประกาศ” ได้');
    }

    const skip = await markReleaseSkip(jobId, v.reason, v.note, {
      id: req.user?.sub ?? null,
      // JwtUserPayload มีแค่ sub/email/role — แบบเดียวกับทะเบียนปล่อย
      name: req.user?.email ?? null,
    });
    return res.status(200).json({ ok: true, action: 'skipped', skip });
  } catch (err) {
    return handleApiError(res, err, 'job-release-skip');
  }
}

export default withRbac(handler, 'recruit-postings');
