/**
 * `GET /api/appointment-overdue` — นัดที่เลยวันเกิน 24 ชม. ยังไม่ลงผลมา/ไม่มา (แถบแดงบนหัวกล่องงาน · 20 ต.ค. 2569)
 * คืน `{ mine, all }` = ของฉัน (คนบันทึกนัด) · ทั้งหมด — นับอย่างเดียว ไม่มีชื่อ/เบอร์
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { isPgUndefinedTable } from '../_lib/postgres.js';
import { countOverdueAppointments } from '../_lib/appointmentResultReminder.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') return sendError(res, 405, 'Method not allowed');
  try {
    const me = UUID_RE.test(String(req.user.sub ?? '')) ? String(req.user.sub) : null;
    const [all, mine] = await Promise.all([countOverdueAppointments(null), me ? countOverdueAppointments(me) : Promise.resolve(0)]);
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({ all, mine });
  } catch (e) {
    // ตารางผลนัดยังไม่ migrate = ยังไม่มีอะไรให้เตือน
    if (isPgUndefinedTable(e)) return res.status(200).json({ all: 0, mine: 0 });
    return handleApiError(res, e, 'appointment-overdue', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
