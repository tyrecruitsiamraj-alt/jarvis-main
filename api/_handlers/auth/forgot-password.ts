import {
  type ApiReq,
  sendError,
  handleApiError,
  type ApiRes,
} from '../../_lib/http.js';
import { readJsonBody, getString } from '../../_lib/body.js';

/** ยังไม่ส่งอีเมลจริง — ตอบกลับแบบเป็นมิตรและไม่เปิดเผยว่ามีอีเมลในฐานหรือไม่ */
async function forgotPasswordHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'POST').toUpperCase();
  if (method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const raw = await readJsonBody(req);
    if (typeof raw !== 'object' || raw === null) {
      return sendError(res, 400, 'Bad request', 'Invalid JSON body');
    }
    const email = getString((raw as Record<string, unknown>).email)?.toLowerCase();
    if (!email) {
      return sendError(res, 400, 'Bad request', 'email is required');
    }

    return res.status(200).json({
      message:
        'ระบบยังไม่ส่งลิงก์รีเซ็ตรหัสผ่านทางอีเมลอัตโนมัติ กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อรีเซ็ตรหัสผ่าน',
    });
  } catch (e) {
    return handleApiError(res, e, 'auth/forgot-password');
  }
}

export default forgotPasswordHandler;
