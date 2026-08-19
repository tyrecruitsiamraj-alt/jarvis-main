import { withRbac, handleApiError, sendError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import {
  getAutoMoveWorkerConfig,
  getLastAutoMoveRun,
  runAutoMoveOnce,
} from '../_lib/applicationAutoMoveWorker.js';

/**
 * สถานะตัวตั้งเวลาย้ายใบสมัครอัตโนมัติ (เจ้าของสั่ง 19 ส.ค. 2569:
 * *"แบบ 1 ก็ดี แต่ทำให้มันมีบอกหน่อยว่าย้ายใครไปไหน"*)
 *
 * `GET`  → ค่าตั้งปัจจุบัน + ผลรอบล่าสุด (ไม่ยิง ERP ไม่แตะข้อมูล — อ่านจากหน่วยความจำล้วน)
 * `POST` → สั่งเดินหนึ่งรอบเดี๋ยวนี้ **แบบลองดูเสมอ** ไม่ต้องรอรอบถัดไป
 *
 * 🔴 เส้นนี้สั่งย้ายจริงไม่ได้โดยตั้งใจ — การย้ายจริงมีทางเดียวคือ
 * `POST /api/application-auto-move` (คนกดเอง) หรือ worker ที่เปิด `APPLICATION_AUTO_MOVE_APPLY`
 * ไม่งั้นปุ่มบนหน้าตั้งค่าจะกลายเป็นปุ่มย้ายคนจริงโดยไม่ได้ตั้งใจ
 *
 * ⚠️ ผลรอบล่าสุดอยู่ในหน่วยความจำของ process — บน Vercel (serverless) จะว่างเสมอ
 * ของจริงรันเป็น process เดียวบนเครื่อง on-prem จึงใช้ได้
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      return res.status(200).json({ config: getAutoMoveWorkerConfig(), lastRun: getLastAutoMoveRun() });
    }
    if (method === 'POST') {
      const lastRun = await runAutoMoveOnce({ apply: false });
      return res.status(200).json({ config: getAutoMoveWorkerConfig(), lastRun });
    }
    return sendError(res, 405, 'Method not allowed', 'Use GET or POST (ลองดูหนึ่งรอบ)');
  } catch (e) {
    return handleApiError(res, e, `application-auto-move-status ${method}`, { userId: req.user.sub });
  }
}

export default withRbac(handler, 'job-applications');
