import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  sendError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { respondServiceError } from '../_lib/domainErrors.js';
import { getString, readJsonBody } from '../_lib/body.js';
import {
  resolveClientIp,
  resolveRequestId,
  resolveUserAgent,
} from '../_lib/audit.js';
import { tableInAppSchema } from '../_lib/schema.js';
import {
  createJobAssignment,
  parseCreateAssignmentInput,
  toAssignmentResponse,
  type JobAssignmentRow,
} from '../_lib/jobAssignmentService.js';
import { isPgUniqueViolation } from '../_lib/postgres.js';

const table = tableInAppSchema('job_assignments');

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const jobId = getString(req.query?.job_id);
      if (!jobId) return sendError(res, 400, 'Bad request', 'job_id query is required');

      if (jobId.startsWith('siamraj:') || jobId.startsWith('siamraj-sql:')) {
        return res.status(200).json([]);
      }

      const { rows } = await dbQuery<JobAssignmentRow>(
        `select * from ${table} where job_id = $1::uuid order by created_at desc`,
        [jobId],
      );
      return res.status(200).json(rows.map(toAssignmentResponse));
    } catch (e) {
      respondServiceError(res, e, 'job-assignments GET', { userId: req.user.sub });
      return;
    }
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      const input = parseCreateAssignmentInput(raw);
      const row = await createJobAssignment(input, {
        userId: req.user.sub,
        userEmail: req.user.email,
        role: req.user.role,
        requestId: resolveRequestId(req),
        ipAddress: resolveClientIp(req),
        userAgent: resolveUserAgent(req),
      });
      return res.status(201).json(toAssignmentResponse(row));
    } catch (e) {
      if (isPgUniqueViolation(e)) {
        sendError(
          res,
          409,
          'Conflict',
          'Candidate is already actively assigned to this job',
        );
        return;
      }
      respondServiceError(res, e, 'job-assignments POST', { userId: req.user.sub });
      return;
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'job-assignments');
