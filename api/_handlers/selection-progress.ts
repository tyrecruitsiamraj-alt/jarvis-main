/**
 * `GET/PATCH /api/selection-progress` — ขั้นในกระบวนการจ้างของ **คนที่ยังไม่มีใบสมัคร**
 *
 * 🔴 เจ้าของเคาะ 22 ส.ค. 2569: *"สถานะผู้สมัคร รวมเป็นชุดเดียว — **คนจาก match ใช้ด้วย**"*
 * เส้น `PATCH /api/job-applications {id, selection_status}` ใช้ได้เฉพาะคนที่มีใบสมัคร
 * (คีย์ด้วย id ใบ) · คนที่ AI จับคู่มาจากบอร์ด/iRecruit ไม่มีแถวนั้น → ต้องมีเส้นนี้
 *
 * ⚠️ คีย์คือ **(jobId, phone)** — เบอร์เป็นคีย์คน (บทเรียนล็อกโทร 068: คนเดียวมีหลายรหัส
 * แต่เบอร์มีเบอร์เดียว) · ตัวกลางเดียวที่เขียนคือ `selectionProgressStore.saveProgress`
 * ซึ่ง dual-write ตารางกลาง 105 + คอลัมน์เดิม 094 (ถ้ารู้ใบสมัคร)
 *
 * ⚠️ **BU scope**: ต้องเห็นใบขอนั้นก่อนถึงจะตั้งขั้นให้ใครในใบขอนั้นได้
 * (ด่านเดียวกับเส้นอื่นที่แตะใบขอ ERP — `loadScopedJobIdSet`)
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { loadScopedJobIdSet } from '../_lib/siamrajUnitRequests.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { isSelectionStatus, normalizePrepChecklist } from '../../src/lib/selectionProgress.js';
import { loadProgressByJob, saveProgress } from '../_lib/selectionProgressStore.js';

/** อ่านได้ครั้งละไม่เกินเท่านี้ (ป๊อปรายชื่อของใบขอเดียว ไม่ควรเกินนี้) */
const MAX_PHONES = 300;

async function assertJobInScope(req: AuthedReq, jobId: string): Promise<boolean> {
  const scoped = await loadScopedJobIdSet(req.user);
  return !scoped || scoped.has(jobId);
}

async function handleGet(req: AuthedReq, res: ApiRes) {
  const jobId = (getString(req.query?.jobId) ?? '').trim();
  if (!jobId) return sendError(res, 400, 'Bad request', 'ต้องระบุ jobId');
  if (!(await assertJobInScope(req, jobId))) {
    return sendError(res, 403, 'Forbidden', 'ไม่มีสิทธิ์ดูใบขอของแผนกอื่น');
  }
  const raw = getString(req.query?.phones) ?? '';
  const phones = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_PHONES);
  if (phones.length === 0) return res.status(200).json({ items: [] });

  const map = await loadProgressByJob(jobId, phones);
  res.setHeader?.('Cache-Control', 'no-store');
  return res.status(200).json({
    items: [...map.values()].map((r) => ({
      job_id: r.jobId,
      phone_e164: r.phoneE164,
      selection_status: r.selectionStatus,
      prep_checklist: r.prepChecklist,
      unit_site_code: r.unitSiteCode,
      unit_name: r.unitName,
      updated_by_name: r.updatedByName,
    })),
  });
}

async function handlePatch(req: AuthedReq, res: ApiRes) {
  const raw = (await readJsonBody(req)) as Record<string, unknown> | null;
  const jobId = (getString(raw?.jobId) ?? '').trim();
  const phone = (getString(raw?.phone) ?? '').trim();
  if (!jobId || !phone) return sendError(res, 400, 'Bad request', 'ต้องระบุ jobId และ phone');
  if (!(await assertJobInScope(req, jobId))) {
    return sendError(res, 403, 'Forbidden', 'ไม่มีสิทธิ์แก้ใบขอของแผนกอื่น');
  }

  const hasStatus = raw?.selection_status !== undefined;
  const hasChecklist = raw?.prep_checklist !== undefined;
  const hasUnit = raw?.unit_site_code !== undefined || raw?.unit_name !== undefined;
  if (!hasStatus && !hasChecklist && !hasUnit) {
    return sendError(res, 400, 'Bad request', 'ไม่มีอะไรให้บันทึก');
  }
  if (hasStatus && raw?.selection_status !== null && !isSelectionStatus(raw?.selection_status)) {
    return sendError(res, 400, 'Bad request', 'ขั้นไม่ถูกต้อง');
  }

  const saved = await saveProgress({
    jobId,
    phone,
    ...(hasStatus
      ? { selectionStatus: isSelectionStatus(raw?.selection_status) ? raw.selection_status : null }
      : {}),
    ...(hasChecklist ? { prepChecklist: normalizePrepChecklist(raw?.prep_checklist) } : {}),
    ...(hasUnit
      ? {
          unitSiteCode: getString(raw?.unit_site_code) ?? null,
          unitName: getString(raw?.unit_name) ?? null,
        }
      : {}),
    actor: { id: req.user.sub, name: req.user.email ?? null },
  });

  if (!saved.ok) {
    return sendError(
      res,
      400,
      'Bad request',
      saved.reason === 'no_phone' ? 'เบอร์นี้ใช้กับระบบไม่ได้ (ต้องเป็นมือถือ 10 หลัก)' : 'ต้องระบุใบขอ',
    );
  }

  void auditFromAuthed(req, {
    action: 'selection_progress.update',
    entityType: 'selection_progress',
    entityId: `${jobId}::${saved.row.phoneE164}`,
    after: {
      selection_status: saved.row.selectionStatus,
      prep_checklist: saved.row.prepChecklist,
      unit_site_code: saved.row.unitSiteCode,
    },
  });

  return res.status(200).json({
    item: {
      job_id: saved.row.jobId,
      phone_e164: saved.row.phoneE164,
      selection_status: saved.row.selectionStatus,
      prep_checklist: saved.row.prepChecklist,
      unit_site_code: saved.row.unitSiteCode,
      unit_name: saved.row.unitName,
      updated_by_name: saved.row.updatedByName,
    },
  });
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') return await handleGet(req, res);
    if (method === 'PATCH') return await handlePatch(req, res);
    res.setHeader?.('Allow', 'GET, PATCH');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'selection-progress', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
