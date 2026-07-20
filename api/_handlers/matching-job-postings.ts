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
  listJobPostingRequests,
  getActiveJobPostingForJob,
  createJobPostingRequest,
  updateJobPostingRequest,
  normalizeJobPostingStatus,
} from '../_lib/jobPostingRequests.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/** คำขอ "โพสหางานใหม่" — สร้าง ID ให้ทีมอื่นรับไปทำคอนเทนต์/โพสหาคนต่อ */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
      if (jobId.trim()) {
        const item = await getActiveJobPostingForJob(jobId);
        return res.status(200).json({ item });
      }
      const status = normalizeJobPostingStatus(getQuery(req, 'status'));
      const items = await listJobPostingRequests(status ? { status } : undefined);
      return res.status(200).json({ items });
    } catch (e) {
      return handleApiError(res, e, 'matching-job-postings GET', { userId: req.user.sub });
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
      if (!jobId) return sendError(res, 400, 'Bad request', 'job_id is required');

      const item = await createJobPostingRequest({
        jobId,
        requestNo: getString(body.request_no) ?? getString(body.requestNo),
        reason: body.reason,
        userId: req.user.sub,
        userName: req.user.email,
      });

      await auditFromAuthed(req, {
        action: 'job_posting_request.create',
        entityType: 'job_posting_request',
        entityId: item.id,
        after: { job_id: item.job_id, status: item.status },
      });

      return res.status(200).json(item);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/is required|must be|invalid/i.test(message)) {
        return sendError(res, 400, 'Bad request', message);
      }
      return handleApiError(res, e, 'matching-job-postings POST', { userId: req.user.sub });
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
      const item = await updateJobPostingRequest(id, {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      });
      if (!item) return sendError(res, 404, 'Not found', 'ไม่พบคำขอนี้');

      await auditFromAuthed(req, {
        action: 'job_posting_request.update',
        entityType: 'job_posting_request',
        entityId: item.id,
        after: { status: item.status },
      });

      return res.status(200).json(item);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/is required|must be|invalid|nothing to update/i.test(message)) {
        return sendError(res, 400, 'Bad request', message);
      }
      return handleApiError(res, e, 'matching-job-postings PATCH', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'matching-job-postings');
