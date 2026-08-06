import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { isSiamrajRequestInScope } from '../_lib/siamrajUnitRequests.js';
import {
  listRecruitPostings,
  getRecruitPosting,
  createRecruitPosting,
  createPostingLink,
  setPostingStatus,
  updateRecruitPosting,
  type UpdatePostingPatch,
} from '../_lib/recruitPostings.js';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/**
 * ประกาศรับสมัคร + ลิงก์ต่อช่องทาง
 *
 * BU scope มี 2 ทาง เพราะประกาศมี 2 ชนิด:
 *  - ผูกใบขอ  → เช็คสิทธิ์ที่ใบขอ (isSiamrajRequestInScope) เหมือนเส้นอื่นทั้งระบบ
 *  - ประกาศลอย → ไม่มีใบขอให้เช็ค จึงใช้ department_code ของตัวประกาศเอง
 *    (ตอนสร้างบังคับให้เลือก BU ที่ validatePostingInput)
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    const scope = await loadUserDepartmentScope(req.user);
    const scopedCodes = scope.mode === 'code' ? [scope.code] : null;

    if (method === 'GET') {
      const id = getQuery(req, 'id');
      if (id) {
        const posting = await getRecruitPosting(id);
        if (!posting) return sendError(res, 404, 'Not found', 'ไม่พบประกาศนี้');
        if (!(await canAccessPosting(posting.jobId, posting.departmentCode, req, scope))) {
          return sendError(res, 404, 'Not found', 'ไม่พบประกาศนี้');
        }
        return res.status(200).json(posting);
      }

      const jobId = getQuery(req, 'jobId');
      if (jobId && !(await isSiamrajRequestInScope(req.user, jobId))) {
        return sendError(res, 404, 'Not found', 'ไม่พบใบขอนี้');
      }
      const items = await listRecruitPostings({
        jobId: jobId || null,
        standaloneOnly: getQuery(req, 'standalone') === '1',
        departmentCodes: scopedCodes,
      });
      return res.status(200).json(items);
    }

    if (method === 'POST') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');

      // เพิ่มลิงก์ให้ประกาศที่มีอยู่แล้ว
      if (typeof body.postingId === 'string' && body.postingId) {
        const posting = await getRecruitPosting(body.postingId);
        if (!posting) return sendError(res, 404, 'Not found', 'ไม่พบประกาศนี้');
        if (!(await canAccessPosting(posting.jobId, posting.departmentCode, req, scope))) {
          return sendError(res, 404, 'Not found', 'ไม่พบประกาศนี้');
        }
        const link = await createPostingLink(posting.id, {
          channelId: typeof body.channelId === 'string' ? body.channelId : null,
          label: typeof body.channelLabel === 'string' ? body.channelLabel : null,
          note: typeof body.note === 'string' ? body.note : null,
        });
        return res.status(201).json(link);
      }

      const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
      if (jobId && !(await isSiamrajRequestInScope(req.user, jobId))) {
        return sendError(res, 404, 'Not found', 'ไม่พบใบขอนี้');
      }
      // ประกาศลอย: ผู้ใช้ที่ถูกล็อก BU สร้างข้าม BU ตัวเองไม่ได้
      const departmentCode = typeof body.departmentCode === 'string' ? body.departmentCode.trim() : '';
      if (!jobId && scope.mode === 'code' && departmentCode.toUpperCase() !== scope.code.toUpperCase()) {
        return sendError(res, 403, 'Forbidden', 'สร้างประกาศข้าม BU ไม่ได้');
      }

      const created = await createRecruitPosting({
        jobId: jobId || null,
        standaloneKind: typeof body.standaloneKind === 'string' ? body.standaloneKind : null,
        departmentCode: departmentCode || null,
        title: String(body.title ?? ''),
        detail: typeof body.detail === 'string' ? body.detail : null,
        locationText: typeof body.locationText === 'string' ? body.locationText : null,
        salaryText: typeof body.salaryText === 'string' ? body.salaryText : null,
        contactName: typeof body.contactName === 'string' ? body.contactName : null,
        contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone : null,
        channels: Array.isArray(body.channels)
          ? body.channels.filter(isPlainObject).map((c) => ({
              channelId: typeof c.channelId === 'string' ? c.channelId : null,
              label: typeof c.label === 'string' ? c.label : null,
              note: typeof c.note === 'string' ? c.note : null,
            }))
          : [],
        createdByUserId: req.user?.sub ?? null,
        createdByName: req.user?.email ?? null,
      });
      return res.status(201).json(created);
    }

    if (method === 'PATCH') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');
      const id = typeof body.id === 'string' ? body.id : getQuery(req, 'id');
      if (!id) return sendError(res, 400, 'Bad request', 'ต้องระบุ id');
      const posting = await getRecruitPosting(id);
      if (!posting) return sendError(res, 404, 'Not found', 'ไม่พบประกาศนี้');
      if (!(await canAccessPosting(posting.jobId, posting.departmentCode, req, scope))) {
        return sendError(res, 404, 'Not found', 'ไม่พบประกาศนี้');
      }
      // แก้เนื้อหาประกาศ — ส่งฟิลด์ไหนมาแก้เฉพาะฟิลด์นั้น (mockup rev.3 ข้อ 04)
      // BU/ใบขอของประกาศแก้ที่นี่ไม่ได้ตามกติกาใน updateRecruitPosting
      const patch: UpdatePostingPatch = {};
      if (typeof body.title === 'string') patch.title = body.title;
      if ('detail' in body) patch.detail = typeof body.detail === 'string' ? body.detail : null;
      if ('locationText' in body) {
        patch.locationText = typeof body.locationText === 'string' ? body.locationText : null;
      }
      if ('salaryText' in body) {
        patch.salaryText = typeof body.salaryText === 'string' ? body.salaryText : null;
      }
      if ('contactName' in body) {
        patch.contactName = typeof body.contactName === 'string' ? body.contactName : null;
      }
      if ('contactPhone' in body) {
        patch.contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone : null;
      }

      const updated = Object.keys(patch).length > 0 ? await updateRecruitPosting(id, patch) : null;

      // status ส่งมาก็เปลี่ยนด้วย — ไม่ส่งมาให้คงค่าเดิม (เดิมไม่ส่ง = เปิด ทำให้แก้เนื้อหาแล้วประกาศที่ปิดกลับมาเปิดเอง)
      if (typeof body.status === 'string') {
        const status = body.status === 'closed' ? 'closed' : 'open';
        await setPostingStatus(id, status);
        return res.status(200).json({ ...(updated ?? posting), status });
      }
      return res.status(200).json(updated ?? posting);
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/ต้องระบุ|ต้องเลือก|ยาวเกิน|ไม่สำเร็จ/.test(msg)) return sendError(res, 400, 'Bad request', msg);
    return handleApiError(res, e, 'recruit-postings', { userId: req.user?.sub });
  }
}

async function canAccessPosting(
  jobId: string | null,
  departmentCode: string | null,
  req: AuthedReq,
  scope: Awaited<ReturnType<typeof loadUserDepartmentScope>>,
): Promise<boolean> {
  if (scope.mode === 'all') return true;
  if (scope.mode === 'none') return false;
  if (jobId) return isSiamrajRequestInScope(req.user, jobId);
  return (departmentCode || '').toUpperCase() === scope.code.toUpperCase();
}

export default withRbac(handler, 'recruit-postings');
