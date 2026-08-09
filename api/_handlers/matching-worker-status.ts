import { getWorkerStatus } from '../_lib/matchPrecomputeWorker.js';
import { sendError, withAuth, type AuthedReq, type ApiRes } from '../_lib/http.js';

/**
 * สถานะ worker ที่คิดผลแมทล่วงหน้า — หน้า Matching ใช้โชว์ "AI กำลังประมวลผล n ใบ"
 *
 * ครอบ withAuth เพราะเป็น endpoint เดียวของ /api/matching/* ที่เคยเปิดโล่ง
 * (เจอตอน audit ก่อนขึ้น production — ตัวอื่นครอบ withRbac หมด)
 * ข้อมูลเป็นแค่ตัวนับ ไม่มีข้อมูลคน จึงไม่ต้องผูก rbac key เฉพาะ — ล็อกอินก็พอ
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');
  return res.status(200).json(getWorkerStatus());
}

export default withAuth(handler);
