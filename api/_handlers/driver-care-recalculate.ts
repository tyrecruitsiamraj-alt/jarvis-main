import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { recalculateRiskScores } from '../_lib/driverCareRisk.js';
import { bangkokBusinessDateYmd, isValidYmd } from '../_lib/businessDate.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { DomainError } from '../_lib/domainErrors.js';

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const raw = await readJsonBody(req);
    let scoreDate = bangkokBusinessDateYmd();
    if (typeof raw === 'object' && raw !== null) {
      const requested = getString((raw as Record<string, unknown>).scoreDate);
      if (requested) {
        if (!isValidYmd(requested)) {
          return sendError(res, 400, 'Bad request', 'scoreDate must be YYYY-MM-DD');
        }
        scoreDate = requested;
      }
    }

    const count = await recalculateRiskScores(scoreDate);
    await auditFromAuthed(req, {
      action: 'driver_care.recalculate',
      entityType: 'driver_care',
      entityId: 'risk_scores',
      after: { scoreDate, recalculated: count, ruleVersion: 'v1' },
    });
    return res.status(200).json({ ok: true, scoreDate, recalculated: count });
  } catch (e) {
    if (e instanceof DomainError) {
      return sendError(res, e.statusCode, e.errorLabel, e.message);
    }
    return handleApiError(res, e, 'driver-care-recalculate', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'driver-care-recalculate');
