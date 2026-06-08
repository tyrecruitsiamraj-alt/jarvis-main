import { dbQuery } from '../_lib/postgres.js';
import {
  withAuthStaffCreateSupervisorMutate,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import {
  buildSoOperationUnitsSelectSql,
  buildSoOperationUnitInsertSql,
  buildSoOperationUnitUpdateSql,
  resolveSoOperationUnitsMeta,
} from '../_lib/soOperationUnits.js';

type Row = { id: string; name: string };

function mapRow(r: Row): { id: string; name: string } {
  const name = String(r.name ?? '').trim();
  const idRaw = String(r.id ?? '').trim();
  return { id: idRaw || name, name };
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  const meta = resolveSoOperationUnitsMeta();
  if (!meta) {
    return sendError(
      res,
      501,
      'so_operation_not_configured',
      'Set SO_OPERATION_SCHEMA. Optional: SO_OPERATION_UNITS_TABLE (default activity_to_saleco_request_position).',
    );
  }

  if (method === 'GET') {
    const built = buildSoOperationUnitsSelectSql();
    if (!built) {
      return sendError(res, 501, 'so_operation_not_configured', 'Invalid so-operation units configuration.');
    }
    try {
      const { rows } = await dbQuery<Row>(built.sql);
      const out = rows.map(mapRow).filter((u) => u.name.length > 0);
      return res.status(200).json(out);
    } catch (e) {
      return handleApiError(res, e, 'so-operation-units GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const name = getString(b.name).trim();
      if (!name) return sendError(res, 400, 'Bad request', 'name required');

      const insertBuilt = buildSoOperationUnitInsertSql(meta);
      if (!insertBuilt) return sendError(res, 500, 'Internal server error', 'Cannot build insert');

      const { rows } = await dbQuery<Row>(insertBuilt.sql, [name]);
      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to create unit');
      return res.status(201).json(mapRow(row));
    } catch (e) {
      return handleApiError(res, e, 'so-operation-units POST', { userId: req.user.sub });
    }
  }

  if (method === 'PATCH') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const id = getString(b.id).trim();
      const name = getString(b.name).trim();
      if (!id) return sendError(res, 400, 'Bad request', 'id required');
      if (!name) return sendError(res, 400, 'Bad request', 'name required');

      const sql = buildSoOperationUnitUpdateSql(meta);
      const { rows } = await dbQuery<Row>(sql, [id, name]);
      const row = rows[0];
      if (!row) return sendError(res, 404, 'Not found', 'Unit not found');
      return res.status(200).json(mapRow(row));
    } catch (e) {
      return handleApiError(res, e, 'so-operation-units PATCH', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withAuthStaffCreateSupervisorMutate(handler);
