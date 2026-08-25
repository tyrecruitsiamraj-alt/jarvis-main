/**
 * `/api/job-public-release` — ปล่อย / ดึงลง ใบขอบนหน้าสาธารณะ
 *
 * เจ้าของเคาะ 22 ส.ค. 2569: **ทุกใบต้องกดปล่อย** (กลับด้านจากเดิมที่ขึ้นเองทุกใบ)
 *   GET    → รายการที่ปล่อยแล้ว (บอร์ดใช้ติดชิป/นับตัวเลข)
 *   POST   → ปล่อย (รับได้ทีละใบหรือหลายใบ — bulk release ของวันเปลี่ยนผ่าน)
 *   DELETE → ดึงลง
 *
 * 🔴 กติกา:
 * 1. **ต้องส่ง id เต็ม** (`siamraj-sql:OPL6908001`) ไม่ใช่เลขที่ใบขอเปล่า ๆ — ไม่งั้นเวลาเทียบ
 *    กับ feed จะไม่ตรง (กับดัก pre:/sql: ของโปรเจกต์)
 * 2. เป็นการเปลี่ยน "สิ่งที่คนนอกเห็น" → บันทึกว่าใครกด (`released_by`) ไว้ตรวจย้อนได้
 * 3. rbac ผูกกับ key เดียวกับการแก้ประกาศ (`recruit-postings`) — คนที่แก้ประกาศได้
 *    คือคนที่ตัดสินใจปล่อยได้ ไม่ต้องเพิ่มสิทธิ์ชุดใหม่ให้ทีมต้องมาขอ
 */
import {
  handleApiError,
  sendError,
  withRbac,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { listReleases, releaseJobs, unreleaseJobs } from '../_lib/jobPublicReleases.js';

/**
 * อ่าน jobIds จาก body **หรือ query** — รับทั้ง `jobId` เดี่ยวและ `jobIds` เป็นอาเรย์
 *
 * ⚠️ ต้องรับทาง query ด้วยเพราะ **DELETE ที่มี body ไม่ถึง handler** ในเซิร์ฟเวอร์ท้องถิ่น
 * (เจอจริงตอนตรวจ 23 ส.ค. 2569: POST ผ่าน แต่ DELETE ตอบ "ต้องระบุ jobId")
 * เป็นพฤติกรรมมาตรฐานของ body parser หลายตัวที่ข้าม DELETE — จึงห้ามพึ่ง body ตัวเดียว
 */
function readJobIds(req: AuthedReq): string[] {
  const b = (req.body ?? {}) as { jobId?: unknown; jobIds?: unknown };
  const q = (req.query ?? {}) as { jobId?: unknown; jobIds?: unknown };
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') out.push(x);
  };
  push(b.jobId);
  push(b.jobIds);
  push(q.jobId);
  // query แบบ ?jobIds=a,b — คั่นด้วย comma
  if (typeof q.jobIds === 'string') push(q.jobIds.split(','));
  else push(q.jobIds);
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      const releases = await listReleases();
      return res.status(200).json({ releases, total: releases.length });
    }

    if (method === 'POST' || method === 'DELETE') {
      const jobIds = readJobIds(req);
      if (jobIds.length === 0) {
        return sendError(res, 400, 'ต้องระบุ jobId หรือ jobIds (id เต็มของใบขอ)');
      }
      // เพดานกันกดพลาดทั้งฐาน — bulk release ของวันเปลี่ยนผ่านทำเป็นชุดก็พอ
      if (jobIds.length > 300) {
        return sendError(res, 400, 'ปล่อย/ดึงลงได้ไม่เกิน 300 ใบต่อครั้ง');
      }

      if (method === 'DELETE') {
        const removed = await unreleaseJobs(jobIds);
        return res.status(200).json({ ok: true, action: 'unreleased', count: removed });
      }

      const note = typeof (req.body as { note?: unknown })?.note === 'string'
        ? String((req.body as { note?: string }).note).slice(0, 500)
        : null;
      const count = await releaseJobs(
        jobIds,
        // JwtUserPayload มีแค่ sub/email/role — ชื่อที่โชว์บนบอร์ดใช้อีเมลไปก่อน
        { id: req.user?.sub ?? null, name: req.user?.email ?? null },
        note,
      );
      return res.status(200).json({ ok: true, action: 'released', count });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (err) {
    return handleApiError(res, err, 'job-public-release');
  }
}

export default withRbac(handler, 'recruit-postings');
