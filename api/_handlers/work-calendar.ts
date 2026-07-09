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
  createWorkCalendarEntry,
  parseCreateWorkCalendarInput,
  parseUpdateWorkCalendarInput,
  toWorkCalendarResponse,
  updateWorkCalendarEntry,
  type WorkCalendarRow,
} from '../_lib/workCalendarService.js';

const tbl = tableInAppSchema('work_calendar');

const isDateYmd = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const from = getString(req.query?.from);
      const to = getString(req.query?.to);
      const employeeId = getString(req.query?.employee_id);

      const defaultFrom = () => {
        const d = new Date();
        d.setDate(d.getDate() - 60);
        return d.toISOString().slice(0, 10);
      };
      const defaultTo = () => {
        const d = new Date();
        d.setDate(d.getDate() + 120);
        return d.toISOString().slice(0, 10);
      };

      const f = from && isDateYmd(from) ? from : defaultFrom();
      const t = to && isDateYmd(to) ? to : defaultTo();

      const params: unknown[] = [f, t];
      let where = `where work_date >= $1::date and work_date <= $2::date`;
      if (employeeId) {
        params.push(employeeId);
        where += ` and employee_id = $${params.length}::uuid`;
      }

      const { rows } = await dbQuery<WorkCalendarRow>(
        `select * from ${tbl} ${where} order by work_date asc, employee_id asc`,
        params,
      );
      return res.status(200).json(rows.map(toWorkCalendarResponse));
    } catch (e) {
      respondServiceError(res, e, 'work-calendar GET', { userId: req.user.sub });
      return;
    }
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      const input = parseCreateWorkCalendarInput(raw);
      const row = await createWorkCalendarEntry(input, {
        userId: req.user.sub,
        userEmail: req.user.email,
        role: req.user.role,
        requestId: resolveRequestId(req),
        ipAddress: resolveClientIp(req),
        userAgent: resolveUserAgent(req),
      });
      return res.status(201).json(toWorkCalendarResponse(row));
    } catch (e) {
      respondServiceError(res, e, 'work-calendar POST', { userId: req.user.sub });
      return;
    }
  }

  if (method === 'PATCH') {
    try {
      const raw = await readJsonBody(req);
      const input = parseUpdateWorkCalendarInput(raw);
      const row = await updateWorkCalendarEntry(input, {
        userId: req.user.sub,
        userEmail: req.user.email,
        role: req.user.role,
        requestId: resolveRequestId(req),
        ipAddress: resolveClientIp(req),
        userAgent: resolveUserAgent(req),
      });
      return res.status(200).json(toWorkCalendarResponse(row));
    } catch (e) {
      respondServiceError(res, e, 'work-calendar PATCH', { userId: req.user.sub });
      return;
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'work-calendar');
