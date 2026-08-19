import { withRbac, handleApiError, sendError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readSwitches, readStaleItems, CONFIRMED_OWNER_LIMIT_MIN } from '../_lib/systemHealthStore.js';
import { computeHealthChecks, getLastHealthChecks } from '../_lib/systemHealthWorker.js';

/**
 * สถานะระบบ — ไฟ 4 ดวง + สวิตช์ที่เปิดอยู่ + ของค้างที่ยังไม่มีใครรับ
 *
 * `GET`  → ผลรอบล่าสุดของยามเฝ้า (ไม่ยิง ERP · เบา เปิดรีเฟรชได้)
 * `POST` → สั่งตรวจเดี๋ยวนี้ (ปุ่ม "ตรวจเดี๋ยวนี้")
 *
 * ⚠️ ไฟ ERP อ้างผลรอบล่าสุดของตัวย้ายใบสมัคร ไม่ได้ยิง ERP เอง —
 * ไม่งั้นคนเปิดหน้านี้ค้างไว้จะกลายเป็นตัวถล่ม ERP
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method !== 'GET' && method !== 'POST') {
      return sendError(res, 405, 'Method not allowed', 'Use GET or POST (ตรวจเดี๋ยวนี้)');
    }

    // รอบแรกหลังบูต ยามเฝ้ายังไม่เดิน — ตรวจให้เลยจะได้ไม่เห็นหน้าว่าง
    const cached = getLastHealthChecks();
    // ⚠️ ใช้ computeHealthChecks (ไม่แจ้งเตือน) — การเด้งแจ้งเตือนเป็นงานของยามเฝ้าที่เดียว
    const checks =
      method === 'POST' || cached.checks.length === 0 ? await computeHealthChecks() : cached.checks;
    const at = getLastHealthChecks().at;

    const [switches, stale] = await Promise.all([readSwitches(), readStaleItems()]);
    return res.status(200).json({
      checkedAt: at,
      checks,
      switches,
      stale,
      confirmedOwnerLimitMinutes: CONFIRMED_OWNER_LIMIT_MIN,
    });
  } catch (e) {
    return handleApiError(res, e, `system-health ${method}`, { userId: req.user.sub });
  }
}

export default withRbac(handler, 'system-health');
