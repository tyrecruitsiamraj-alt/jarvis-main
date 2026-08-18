import { withRbac, handleApiError, sendError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { getString } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { listSiamrajUnitRequests } from '../_lib/siamrajUnitRequests.js';
import { runApplicationAutoMove } from '../_lib/applicationAutoMoveRunner.js';
import { inferDistrictFromAddress, inferProvinceFromAddress } from '../../src/lib/parseThaiJobAddress.js';
import { publicJobPositionLabel } from '../../src/lib/unitRequestDisplay.js';
import type { AutoMoveTargetJob } from '../../src/lib/applicationAutoMove.js';
import type { JobRequest } from '../../src/types/index.js';

/**
 * ย้ายใบสมัครอัตโนมัติเมื่อใบขอถูกปิด (098 · เจ้าของสั่ง 17 ส.ค. 2569)
 *
 * `GET  /api/application-auto-move` → **ลองคิดให้ดู ไม่เขียนจริง** (dry run)
 * `POST /api/application-auto-move` → ย้ายจริง
 *
 * ⚠️ แยก GET/POST โดยตั้งใจ — ตัวนี้เดินเองแล้วแตะข้อมูลคนจริง
 * ต้องดูก่อนได้เสมอว่า "รอบนี้จะย้ายใครไปไหน" ก่อนสั่งย้าย
 */

/** แปลงใบขอจาก feed เป็นรูปที่ตัวจับคู่กิน — จังหวัด/อำเภอใช้ค่าที่เจ้าหน้าที่แก้ก่อนค่าที่เดา */
function toTargetJob(j: JobRequest): AutoMoveTargetJob {
  const addr = j.location_address || '';
  return {
    id: j.id,
    request_no: j.request_no ?? null,
    unit_name: j.unit_name ?? null,
    province: (j.override_province || inferProvinceFromAddress(addr) || '') || null,
    district: (j.override_district || inferDistrictFromAddress(addr) || '') || null,
    position: publicJobPositionLabel(j) || null,
  };
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'Use GET (ลองดู) or POST (ย้ายจริง)');
  }
  try {
    const items = (await listSiamrajUnitRequests({ limit: 500, mode: 'all' })) as unknown as JobRequest[];
    // ใบที่ยังเปิดอยู่เท่านั้น — ตัวจับคู่เชื่อว่าที่ส่งมาเปิดหมดแล้ว
    const openJobs = items
      .filter((j) => j.status === 'open' || j.status === 'in_progress')
      .map(toTargetJob);

    const rawLimit = Number(getString(req.query?.limit) ?? '');
    const result = await runApplicationAutoMove(openJobs, {
      dryRun: method === 'GET',
      limit: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined,
    });

    if (method === 'POST' && result.moved > 0) {
      await auditFromAuthed(req, {
        action: 'application.auto_move',
        entityType: 'public_job_application',
        entityId: `batch:${result.moved}`,
        after: { moved: result.moved, details: result.details.slice(0, 50) },
      });
    }
    return res.status(200).json({ ...result, dryRun: method === 'GET', openJobs: openJobs.length });
  } catch (e) {
    return handleApiError(res, e, `application-auto-move ${method}`, { userId: req.user.sub });
  }
}

export default withRbac(handler, 'job-applications');
