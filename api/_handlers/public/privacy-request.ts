/**
 * POST /api/public/privacy-request — ผู้สมัครยื่นคำขอใช้สิทธิ์ข้อมูลส่วนบุคคลเอง (ไม่ต้องล็อกอิน · 18 ต.ค. 2569)
 * ลิงก์อยู่ในข้อตกลง PDPA บนหน้าสมัคร · ขอลบ/ขอให้หยุดติดต่อ = หยุดโทรทันที · เจ้าหน้าที่โทรกลับยืนยันตัวตนก่อนทำต่อ
 * 🔴 ตอบเหมือนกันทุกกรณีที่บันทึกได้ — ไม่บอกว่าเบอร์นี้มีข้อมูลในระบบหรือไม่ (กันคนนอกใช้ส่องว่าใครเคยสมัคร)
 */
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { readJsonBody } from '../../_lib/body.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { auditFromAnonymous } from '../../_lib/audit.js';
import { applicantClientIp } from '../../_lib/applicationRepeatGuard.js';
import { createPdpaRequest } from '../../_lib/pdpaRequests.js';
import { validatePdpaRequest } from '../../../src/lib/pdpaRequests.js';

export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') return sendError(res, 405, 'Method not allowed');
  if (!rateLimitOrReject(req, res, 'public-privacy-request', 3, 10 * 60 * 1000)) return;
  try {
    const parsed = validatePdpaRequest(await readJsonBody(req));
    if (!parsed.ok) return sendError(res, 400, 'Bad request', parsed.message);
    const { row } = await createPdpaRequest(parsed.value, { source: 'public', byName: null, clientIp: applicantClientIp(req) });
    void auditFromAnonymous(req, { userName: 'หน้าคำขอข้อมูลส่วนบุคคล' }, {
      action: 'pdpa_request.create',
      entityType: 'pdpa_request',
      entityId: row.id,
      after: { kind: row.kind, source: 'public' },
    }).catch(() => {});
    return res.status(201).json({ ok: true, dueAt: row.due_at });
  } catch (e) {
    return handleApiError(res, e, 'public-privacy-request');
  }
}
