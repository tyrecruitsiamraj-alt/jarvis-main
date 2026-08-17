import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { listRecruitJobTitles } from '../_lib/recruitJobTitles.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/**
 * master "ตำแหน่งงาน" ของงานสรรหา (RM) — `GET /api/recruit/job-titles`
 *
 * `?all=1` = เอาที่ปิดใช้งานแล้วมาด้วย (รายงานย้อนหลังต้องหาชื่อเจอ)
 * `?department=LBD` = เฉพาะ BU นั้น + ตำแหน่งที่ไม่ระบุ BU
 *
 * ⚠️ **อ่านอย่างเดียว** — ไม่มีหน้าจอจัดการ master นี้ (เจ้าของสั่งเอาปุ่ม "ตำแหน่งงาน"
 * ออก 11 ส.ค. 2569) · ยกข้อมูลด้วย `scripts/import-recruit-job-titles.mts`
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      return res.status(200).json(
        await listRecruitJobTitles({
          includeInactive: getQuery(req, 'all') === '1',
          departmentCode: getQuery(req, 'department'),
        }),
      );
    }
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'recruit-job-titles', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'recruit-job-titles');
