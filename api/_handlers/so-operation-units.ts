import { dbQuery } from '../_lib/postgres.js';
import {
  withAuth,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { buildSoOperationUnitsSelectSql } from '../_lib/soOperationUnits.js';

type Row = { id: string; name: string };

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  const built = buildSoOperationUnitsSelectSql();
  if (!built) {
    return sendError(
      res,
      501,
      'so_operation_not_configured',
      'Set SO_OPERATION_SCHEMA and SO_OPERATION_UNITS_TABLE to read units from the so-operation schema.',
    );
  }

  try {
    const { rows } = await dbQuery<Row>(built.sql);
    const out = rows.map((r) => {
      const name = String(r.name ?? '').trim();
      const idRaw = String(r.id ?? '').trim();
      return { id: idRaw || name, name };
    });
    return res.status(200).json(out.filter((u) => u.name.length > 0));
  } catch (e) {
    return handleApiError(res, e, 'so-operation-units GET', { userId: req.user.sub });
  }
}

export default withAuth(handler);
