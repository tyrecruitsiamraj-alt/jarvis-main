import {
  withAuth,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import {
  getSiamrajDbSource,
  getSiamrajSchema,
  isSiamrajUnitRequestsEnabled,
  listSiamrajUnitRequests,
  getSiamrajUnitRequestById,
} from '../_lib/siamrajUnitRequests.js';
import { getSiamrajSqlServerConfig } from '../_lib/siamrajSqlServer.js';

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
      return res.status(200).json({
        enabled: isSiamrajUnitRequestsEnabled(),
        dbSource: getSiamrajDbSource(),
        schema: getSiamrajSchema(),
        sqlServer: getSiamrajSqlServerConfig()
          ? { host: getSiamrajSqlServerConfig()?.server, database: getSiamrajSqlServerConfig()?.database }
          : null,
        postgresFallback: false,
        readOnly: true,
        mode: process.env.SIAMRAJ_UNIT_REQUESTS_MODE || 'all',
      });
    }

    if (method !== 'GET') {
      return sendError(res, 405, 'Method not allowed', 'Read-only feed from Siamraj');
    }

    if (!isSiamrajUnitRequestsEnabled()) {
      return sendError(
        res,
        503,
        'Service unavailable',
        'ตั้งค่า SIAMRAJ_SCHEMA / SO_OPERATION_SCHEMA หรือ DB_HOST+DB_USER+DB_NAME บนเซิร์ฟเวอร์ก่อน',
      );
    }

    const id = getQuery(req, 'id');
    if (id) {
      const item = await getSiamrajUnitRequestById(id);
      if (!item) return sendError(res, 404, 'Not found', 'ไม่พบใบขอ');
      return res.status(200).json(item);
    }

    const limit = Number(getQuery(req, 'limit') || '200');
    const mode = getQuery(req, 'mode');
    const items = await listSiamrajUnitRequests({ limit, mode });
    return res.status(200).json(items);
  } catch (e) {
    return handleApiError(res, e, 'siamraj-unit-requests');
  }
}

export default withAuth(handler, { roles: ['staff', 'supervisor', 'admin'] });
