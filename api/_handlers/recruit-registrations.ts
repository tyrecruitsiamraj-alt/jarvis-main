import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getIrecruitSqlServerConfig } from '../_lib/irecruitSqlServer.js';
import { listRecruitRegistrations } from '../_lib/recruitRegisterSql.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    if (method === 'GET' && getQuery(req, 'meta') === '1') {
      const cfg = getIrecruitSqlServerConfig();
      return res.status(200).json({
        enabled: Boolean(cfg),
        sqlServer: cfg ? { host: cfg.server, database: cfg.database } : null,
        owner: (process.env.RECRUIT_REGISTER_OWNER || 'RM').trim(),
        readOnly: true,
      });
    }

    if (method !== 'GET') {
      return sendError(res, 405, 'Method not allowed', 'Read-only feed from iRecruit');
    }

    if (!getIrecruitSqlServerConfig()) {
      return sendError(
        res,
        503,
        'Service unavailable',
        'ตั้งค่า IRECRUIT_DB_HOST / IRECRUIT_DB_USER / IRECRUIT_DB_NAME บนเซิร์ฟเวอร์ก่อน',
      );
    }

    const limitRaw = getQuery(req, 'limit');
    const limit = limitRaw ? Number(limitRaw) : 200;
    const owner = getQuery(req, 'owner') || undefined;
    const items = await listRecruitRegistrations({ limit, owner });
    return res.status(200).json(items);
  } catch (e) {
    return handleApiError(res, e, 'recruit-registrations');
  }
}

export default withRbac(handler, 'recruit-registrations');
