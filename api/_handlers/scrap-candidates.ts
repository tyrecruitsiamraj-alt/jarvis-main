/**
 * /api/scrap-candidates — รายชื่อจาก Scrap (So Scraping) ของใบขอ (เจ้าของ 17 พ.ย. 2569 · ตรรกะ `api/_lib/scrapCandidates.ts`)
 * GET ?job=<job id หรือเลขใบขอ> → รายชื่อของใบนั้น (แท็บ Scrap ในหน้าใบขอ)
 * GET ?all=1                    → ทุกใบที่เห็นได้ (แท็บผู้สมัคร ▾ Scrap ของหน้างานสรรหา)
 * POST { action: 'to_contact', job_id, candidate_ids } → สร้าง/ใช้ใบสมัครเดิม แล้วเก็บเข้าการติดต่อ (Lead) ของคนกด
 * สิทธิ์ resource เดียวกับผู้สมัคร (`job-applications`) · ผู้ใช้ที่ล็อก BU เห็นเฉพาะใบขอใน BU ตัวเอง (`loadScopedJobIdSet`)
 * AI ไม่โทรเอง: ใบสร้างในชื่อ So Scraping + เป็น Lead — ตัวส่งอัตโนมัติข้ามทั้งสองแบบ
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { staffEntryDepartment } from '../_lib/applicationScope.js';
import { getSiamrajUnitRequestById, loadScopedJobIdSet } from '../_lib/siamrajUnitRequests.js';
import { isRequestClosedForApply, REQUEST_CLOSED_APPLY_MESSAGE } from '../_lib/requestClosedForApply.js';
import { attachAssignments } from './siamraj-unit-requests.js';
import { addScrapToContact, listScrapCandidates, listScrapRequestNos, requestNoOfJobId, scrapJobIdOf } from '../_lib/scrapCandidates.js';
import { countScrapResults, SCRAP_TO_CONTACT_MAX } from '../../src/lib/scrapCandidates.js';
import { publicJobPositionLabel } from '../../src/lib/unitRequestDisplay.js';
import type { JobRequest } from '../../src/types/index.js';

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const REQUEST_NO = /^[A-Za-z]{2,4}\d{7}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** job id หรือเลขใบขอเปล่า → เลขใบขอ (ใบขอจริงใน ERP เท่านั้น — So Scraping ผูกด้วยเลขใบขอ) */
function requestNoFrom(raw: string): string | null {
  const s = raw.trim();
  if (REQUEST_NO.test(s)) return s.toUpperCase();
  return requestNoOfJobId(s);
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    const scoped = await loadScopedJobIdSet(req.user);
    const canSee = (requestNo: string) => !scoped || scoped.has(scrapJobIdOf(requestNo));

    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      if (one(req.query?.all) === '1') {
        const reqs = (await listScrapRequestNos()).filter((r) => canSee(r.request_no));
        const rows = await listScrapCandidates(reqs.map((r) => r.request_no));
        return res.status(200).json({ requests: reqs, counts: countScrapResults(rows), rows });
      }
      const requestNo = requestNoFrom(String(one(req.query?.job) ?? ''));
      if (!requestNo) return res.status(200).json({ request_no: null, counts: countScrapResults([]), rows: [] });
      if (!canSee(requestNo)) return sendError(res, 403, 'Forbidden', 'ใบขอนี้อยู่นอก BU ของคุณ');
      const rows = await listScrapCandidates([requestNo]);
      return res.status(200).json({ request_no: requestNo, counts: countScrapResults(rows), rows });
    }

    if (method !== 'POST') {
      res.setHeader?.('Allow', 'GET, POST');
      return sendError(res, 405, 'Method not allowed');
    }
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    if (body.action !== 'to_contact') return sendError(res, 400, 'bad_request', 'action ไม่ถูกต้อง');
    const requestNo = requestNoFrom(String(body.job_id ?? ''));
    if (!requestNo) return sendError(res, 400, 'bad_request', 'ไม่พบใบขอ');
    const ids = [...new Set((Array.isArray(body.candidate_ids) ? body.candidate_ids : []).filter((x): x is string => typeof x === 'string' && UUID.test(x)))];
    if (ids.length === 0) return sendError(res, 400, 'bad_request', 'เลือกรายชื่ออย่างน้อย 1 คน');
    if (ids.length > SCRAP_TO_CONTACT_MAX) return sendError(res, 400, 'bad_request', `เก็บได้ครั้งละไม่เกิน ${SCRAP_TO_CONTACT_MAX} คน`);
    if (!canSee(requestNo)) return sendError(res, 403, 'Forbidden', 'ใบขอนี้อยู่นอก BU ของคุณ');

    const jobId = scrapJobIdOf(requestNo);
    if (await isRequestClosedForApply(jobId)) return sendError(res, 409, 'closed', REQUEST_CLOSED_APPLY_MESSAGE);
    const job = (await getSiamrajUnitRequestById(jobId, { mode: 'all' })) as JobRequest | null;
    if (!job || job.id !== jobId) return sendError(res, 404, 'not_found', `ไม่พบใบขอ ${requestNo} ที่ยังเปิดอยู่`);
    await attachAssignments([job]);
    const dept = await staffEntryDepartment(req.user);
    if (!dept.ok) return sendError(res, 403, 'Forbidden', 'บัญชีนี้ยังไม่ได้ตั้ง BU — ติดต่อผู้ดูแลระบบ');

    const operator =
      (req.user as { full_name?: string; username?: string }).full_name || (req.user as { username?: string }).username || null;
    const results = await addScrapToContact(
      { id: job.id, title: publicJobPositionLabel(job), unitName: job.unit_name ?? null, recruiterName: job.recruiter_name ?? null },
      requestNo,
      ids,
      { userId: req.user.sub, name: operator, departmentCode: dept.code },
    );
    void auditFromAuthed(req, {
      action: 'scrap_candidates.to_contact',
      entityType: 'job',
      entityId: job.id,
      after: {
        added: results.filter((r) => r.outcome === 'added').length,
        existing: results.filter((r) => r.outcome === 'existing').length,
        skipped: results.filter((r) => r.outcome === 'skipped').length,
      },
    }).catch(() => {});
    return res.status(200).json({ results });
  } catch (e) {
    return handleApiError(res, e, 'scrap-candidates', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
