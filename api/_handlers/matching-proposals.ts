import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  listProposalsForJob,
  listProposalsForJobs,
  upsertProposal,
  updateProposal,
  normalizeSource,
  normalizeStatus,
  findActiveConflict,
  listActiveProposals,
  isActiveProposalStatus,
} from '../_lib/candidateProposals.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/** ประวัติการเสนอ/จองตัว/ลงงานผู้สมัคร ต่อใบขอ (board/iRecruit) */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      if (getQuery(req, 'active') === '1') {
        const items = await listActiveProposals();
        return res.status(200).json({ items });
      }

      const jobIds = getQuery(req, 'jobIds');
      if (jobIds.trim()) {
        const ids = jobIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 500);
        const map = await listProposalsForJobs(ids);
        const byJob: Record<string, unknown[]> = {};
        for (const [k, v] of map) byJob[k] = v;
        return res.status(200).json({ byJob });
      }

      const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
      if (!jobId.trim()) return sendError(res, 400, 'Bad request', 'jobId or jobIds is required');
      const items = await listProposalsForJob(jobId);
      return res.status(200).json({ items });
    } catch (e) {
      return handleApiError(res, e, 'matching-proposals GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST' || method === 'PUT') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;
      const jobId = getString(body.job_id) || getString(body.jobId);
      const candidateRef = getString(body.candidate_ref) || getString(body.candidateRef);
      const source = normalizeSource(body.source);
      if (!jobId) return sendError(res, 400, 'Bad request', 'job_id is required');
      if (!candidateRef) return sendError(res, 400, 'Bad request', 'candidate_ref is required');
      if (!source) return sendError(res, 400, 'Bad request', 'source must be board or irecruit');

      const targetStatus = normalizeStatus(body.status) ?? 'reserved';
      if (isActiveProposalStatus(targetStatus)) {
        const conflict = await findActiveConflict(source, candidateRef, jobId);
        if (conflict) {
          return sendError(
            res,
            409,
            'Conflict',
            `ผู้สมัครนี้ถูกจองอยู่กับใบขออื่นแล้ว (${conflict.request_no || conflict.job_id}) — ต้องยกเลิกก่อนจึงจะจองใบนี้ได้`,
            { conflict },
          );
        }
      }

      const item = await upsertProposal({
        jobId,
        requestNo: getString(body.request_no) ?? getString(body.requestNo),
        source,
        candidateRef,
        candidateName: body.candidate_name ?? body.candidateName,
        candidatePhone: body.candidate_phone ?? body.candidatePhone,
        candidatePosition: body.candidate_position ?? body.candidatePosition,
        tier: body.tier,
        reason: body.reason,
        status: body.status,
        userId: req.user.sub,
        userName: getString(body.proposed_by_name) || getString(body.operator_name) || req.user.email,
      });

      await auditFromAuthed(req, {
        action: 'candidate_proposal.upsert',
        entityType: 'candidate_proposal',
        entityId: item.id,
        after: {
          job_id: item.job_id,
          source: item.source,
          candidate_ref: item.candidate_ref,
          status: item.status,
        },
      });

      return res.status(200).json(item);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/is required|must be|invalid/i.test(message)) {
        return sendError(res, 400, 'Bad request', message);
      }
      return handleApiError(res, e, 'matching-proposals POST', { userId: req.user.sub });
    }
  }

  if (method === 'PATCH') {
    try {
      const id = getQuery(req, 'id');
      if (!id.trim()) return sendError(res, 400, 'Bad request', 'id query is required');
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;
      const item = await updateProposal(id, {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
        ...(body.proposed_by_name !== undefined ? { proposedByName: body.proposed_by_name } : {}),
      });
      if (!item) return sendError(res, 404, 'Not found', 'ไม่พบการเสนอนี้');

      await auditFromAuthed(req, {
        action: 'candidate_proposal.update',
        entityType: 'candidate_proposal',
        entityId: item.id,
        after: { status: item.status },
      });

      return res.status(200).json(item);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/is required|must be|invalid|nothing to update/i.test(message)) {
        return sendError(res, 400, 'Bad request', message);
      }
      return handleApiError(res, e, 'matching-proposals PATCH', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'matching-proposals');
