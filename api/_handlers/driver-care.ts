import { dbQuery } from '../_lib/postgres.js';
import {
  withAuthDataRoute,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import {
  ensureTodayRiskScores,
  recalculateRiskScores,
  riskT,
  actionT,
  empT,
  wcT,
} from '../_lib/driverCareRisk.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  return typeof v === 'string' ? v.trim() : '';
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(nextFollowUp: string | null, status: string): boolean {
  if (!nextFollowUp || status === 'closed') return false;
  return nextFollowUp < todayYmd();
}

async function getOverview(scoreDate: string) {
  const { rows: riskRows } = await dbQuery<{
    risk_level: string;
    total_risk_score: number;
    main_reason: string;
    client_name: string | null;
  }>(
    `select r.risk_level, r.total_risk_score, r.main_reason,
            (select w.client_name from ${wcT} w
             where w.employee_id = r.employee_id order by w.work_date desc limit 1) as client_name
     from ${riskT} r
     where r.score_date = $1::date`,
    [scoreDate],
  );

  const metrics = {
    activeDrivers: riskRows.length,
    highRisk: riskRows.filter((r) => r.risk_level === 'high').length,
    mediumRisk: riskRows.filter((r) => r.risk_level === 'medium').length,
    watchRisk: riskRows.filter((r) => r.risk_level === 'watch').length,
    lowRisk: riskRows.filter((r) => r.risk_level === 'low').length,
    pendingAction: 0,
    inProgressAction: 0,
    overdueAction: 0,
  };

  const { rows: statusRows } = await dbQuery<{ status: string; cnt: string }>(
    `select status, count(*)::text as cnt from ${actionT} group by status`,
  );
  const { rows: overdueRows } = await dbQuery<{ cnt: string }>(
    `select count(*)::text as cnt from ${actionT}
     where status <> 'closed' and next_follow_up_date < current_date`,
  );

  metrics.pendingAction = Number(statusRows.find((s) => s.status === 'pending')?.cnt || 0);
  metrics.inProgressAction = Number(statusRows.find((s) => s.status === 'in_progress')?.cnt || 0);
  metrics.overdueAction = Number(overdueRows[0]?.cnt || 0);

  const levelMap = new Map<string, number>();
  for (const r of riskRows) {
    levelMap.set(r.risk_level, (levelMap.get(r.risk_level) || 0) + 1);
  }

  const siteMap = new Map<string, number>();
  for (const r of riskRows) {
    if (r.risk_level === 'high' || r.risk_level === 'medium') {
      const site = r.client_name?.trim() || '—';
      siteMap.set(site, (siteMap.get(site) || 0) + 1);
    }
  }

  const reasonMap = new Map<string, number>();
  for (const r of riskRows) {
    if (r.risk_level !== 'low') {
      const key = r.main_reason.slice(0, 80);
      reasonMap.set(key, (reasonMap.get(key) || 0) + 1);
    }
  }

  return {
    metrics,
    riskByLevel: ['high', 'medium', 'watch', 'low'].map((level) => ({
      level,
      count: levelMap.get(level) || 0,
    })),
    topSites: [...siteMap.entries()]
      .map(([siteName, count]) => ({ siteName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    topReasons: [...reasonMap.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    actionStatus: ['pending', 'in_progress', 'closed'].map((status) => ({
      status,
      count: Number(statusRows.find((s) => s.status === status)?.cnt || 0),
    })),
  };
}

async function getRiskList(scoreDate: string, filters: Record<string, string>) {
  const params: unknown[] = [scoreDate];
  let where = `r.score_date = $1::date`;

  if (filters.riskLevel) {
    params.push(filters.riskLevel);
    where += ` and r.risk_level = $${params.length}`;
  }
  if (filters.site) {
    params.push(`%${filters.site}%`);
    where += ` and coalesce(site.client_name, '') ilike $${params.length}`;
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where += ` and (e.first_name ilike $${params.length} or e.last_name ilike $${params.length} or e.employee_code ilike $${params.length})`;
  }

  const { rows } = await dbQuery<{
    risk_score_id: string;
    employee_id: string;
    employee_code: string;
    driver_name: string;
    site_name: string | null;
    risk_score: number;
    risk_level: string;
    main_reason: string;
    recommended_action: string;
    action_status: string | null;
    last_action_date: string | Date | null;
    next_follow_up_date: string | Date | null;
  }>(
    `select r.id as risk_score_id, e.id as employee_id, e.employee_code,
            e.first_name || ' ' || e.last_name as driver_name,
            site.client_name as site_name,
            r.total_risk_score as risk_score, r.risk_level, r.main_reason, r.recommended_action,
            la.status as action_status,
            la.action_date as last_action_date,
            la.next_follow_up_date
     from ${riskT} r
     join ${empT} e on e.id = r.employee_id
     left join lateral (
       select w.client_name from ${wcT} w
       where w.employee_id = r.employee_id order by w.work_date desc limit 1
     ) site on true
     left join lateral (
       select a.status, a.action_date, a.next_follow_up_date
       from ${actionT} a
       where a.employee_id = r.employee_id
       order by a.action_date desc limit 1
     ) la on true
     where ${where}`,
    params,
  );

  let items = rows.map((r) => {
    const status = (r.action_status || 'pending') as string;
    const nextFu = r.next_follow_up_date ? String(r.next_follow_up_date).slice(0, 10) : null;
    const overdue = isOverdue(nextFu, status);
    return {
      riskScoreId: r.risk_score_id,
      employeeId: r.employee_id,
      employeeCode: r.employee_code,
      driverName: r.driver_name,
      siteName: r.site_name || '—',
      clientName: r.site_name || '—',
      supervisorName: 'ทีมปฏิบัติการ',
      riskScore: r.risk_score,
      riskLevel: r.risk_level,
      mainReason: r.main_reason,
      recommendedAction: r.recommended_action,
      actionStatus: overdue ? 'overdue' : status,
      overdueFlag: overdue,
      lastActionDate: r.last_action_date ? String(r.last_action_date).slice(0, 10) : null,
      nextFollowUpDate: nextFu,
    };
  });

  if (filters.actionStatus) {
    items = items.filter((i) =>
      filters.actionStatus === 'overdue' ? i.overdueFlag : i.actionStatus === filters.actionStatus,
    );
  }
  if (filters.supervisor) {
    items = items.filter((i) => i.supervisorName.includes(filters.supervisor));
  }

  const levelOrder: Record<string, number> = { high: 0, medium: 1, watch: 2, low: 3 };
  items.sort((a, b) => {
    const lo = (levelOrder[a.riskLevel] ?? 9) - (levelOrder[b.riskLevel] ?? 9);
    if (lo !== 0) return lo;
    if (a.overdueFlag !== b.overdueFlag) return a.overdueFlag ? -1 : 1;
    return b.riskScore - a.riskScore;
  });

  return items;
}

async function getActions(filters: Record<string, string>) {
  const params: unknown[] = [];
  const where: string[] = ['1=1'];

  if (filters.status) {
    params.push(filters.status);
    where.push(`a.status = $${params.length}`);
  }
  if (filters.riskLevel) {
    params.push(filters.riskLevel);
    where.push(`r.risk_level = $${params.length}`);
  }
  if (filters.actionBy) {
    params.push(`%${filters.actionBy}%`);
    where.push(`coalesce(a.action_by_name, '') ilike $${params.length}`);
  }
  if (filters.overdueOnly === '1') {
    where.push(`a.status <> 'closed' and a.next_follow_up_date < current_date`);
  }

  const { rows } = await dbQuery<{
    action_id: string;
    risk_score_id: string | null;
    employee_id: string;
    employee_code: string;
    driver_name: string;
    risk_level: string;
    risk_score: number;
    action_by_name: string | null;
    action_type: string;
    issue_found: string;
    action_taken: string;
    result: string;
    status: string;
    action_date: string | Date;
    next_follow_up_date: string | Date | null;
  }>(
    `select a.id as action_id, a.risk_score_id, a.employee_id, e.employee_code,
            e.first_name || ' ' || e.last_name as driver_name,
            coalesce(r.risk_level, 'low') as risk_level,
            coalesce(r.total_risk_score, 0) as risk_score,
            a.action_by_name, a.action_type, a.issue_found, a.action_taken,
            a.result, a.status, a.action_date, a.next_follow_up_date
     from ${actionT} a
     join ${empT} e on e.id = a.employee_id
     left join ${riskT} r on r.id = a.risk_score_id
     where ${where.join(' and ')}
     order by a.action_date desc`,
    params,
  );

  return rows.map((r) => {
    const nextFu = r.next_follow_up_date ? String(r.next_follow_up_date).slice(0, 10) : null;
    const overdue = isOverdue(nextFu, r.status);
    return {
      actionId: r.action_id,
      riskScoreId: r.risk_score_id,
      employeeId: r.employee_id,
      employeeCode: r.employee_code,
      driverName: r.driver_name,
      riskLevel: r.risk_level,
      riskScore: r.risk_score,
      actionByName: r.action_by_name,
      actionType: r.action_type,
      issueFound: r.issue_found,
      actionTaken: r.action_taken,
      result: r.result,
      status: r.status,
      actionDate: String(r.action_date).slice(0, 10),
      nextFollowUpDate: nextFu,
      overdueFlag: overdue,
    };
  });
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const action = getQuery(req, 'action');
  const view = getQuery(req, 'view');

  try {
    if (method === 'GET') {
      const scoreDate = await ensureTodayRiskScores();
      if (view === 'overview') {
        return res.status(200).json(await getOverview(scoreDate));
      }
      if (view === 'risk-list') {
        return res.status(200).json(
          await getRiskList(scoreDate, {
            riskLevel: getQuery(req, 'riskLevel'),
            site: getQuery(req, 'site'),
            supervisor: getQuery(req, 'supervisor'),
            actionStatus: getQuery(req, 'actionStatus'),
            search: getQuery(req, 'search'),
          }),
        );
      }
      if (view === 'actions') {
        return res.status(200).json(
          await getActions({
            status: getQuery(req, 'status'),
            riskLevel: getQuery(req, 'riskLevel'),
            actionBy: getQuery(req, 'actionBy'),
            overdueOnly: getQuery(req, 'overdueOnly'),
          }),
        );
      }
      return sendError(res, 400, 'Bad request', 'view required: overview | risk-list | actions');
    }

    if (method === 'POST' && action === 'recalculate') {
      const count = await recalculateRiskScores();
      return res.status(200).json({ ok: true, recalculated: count });
    }

    if (method === 'POST' && action === 'log') {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const employeeId = getString(b.employeeId);
      const riskScoreId = getString(b.riskScoreId) || null;
      const actionType = getString(b.actionType);
      const contactStatus = getString(b.contactStatus) || 'contacted';
      const issueFound = getString(b.issueFound);
      const actionTaken = getString(b.actionTaken);
      const result = getString(b.result);
      const status = getString(b.status) || 'pending';
      const nextFollowUp = getString(b.nextFollowUpDate) || null;

      if (!employeeId || !actionType || !issueFound || !actionTaken || !result) {
        return sendError(res, 400, 'Bad request', 'Missing required fields');
      }

      const { rows } = await dbQuery<{ id: string }>(
        `insert into ${actionT} (
          risk_score_id, employee_id, action_by, action_by_name,
          action_type, contact_status, issue_found, action_taken, result,
          next_follow_up_date, status, updated_at
        ) values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10::date, $11, now())
        returning id`,
        [
          riskScoreId,
          employeeId,
          req.user.sub,
          req.user.email || 'User',
          actionType,
          contactStatus,
          issueFound,
          actionTaken,
          result,
          nextFollowUp,
          status,
        ],
      );
      return res.status(201).json({ ok: true, id: rows[0]?.id });
    }

    if (method === 'PATCH' && action === 'update-action') {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const id = getString(b.id);
      if (!id) return sendError(res, 400, 'Bad request', 'id required');

      const status = b.status !== undefined ? getString(b.status) : undefined;
      const result = b.result !== undefined ? getString(b.result) : undefined;
      const actionTaken = b.actionTaken !== undefined ? getString(b.actionTaken) : undefined;
      const nextFollowUp =
        b.nextFollowUpDate === null ? null : b.nextFollowUpDate !== undefined ? getString(b.nextFollowUpDate) : undefined;

      const { rows } = await dbQuery<{ id: string }>(
        `update ${actionT} set
          status = coalesce($2, status),
          result = coalesce($3, result),
          action_taken = coalesce($4, action_taken),
          next_follow_up_date = case when $5::text = '__skip__' then next_follow_up_date when $5 is null then null else $5::date end,
          closed_date = case when coalesce($2, status) = 'closed' then now() else closed_date end,
          updated_at = now()
         where id = $1::uuid
         returning id`,
        [id, status || null, result || null, actionTaken || null, nextFollowUp === undefined ? '__skip__' : nextFollowUp],
      );
      if (!rows[0]) return sendError(res, 404, 'Not found', 'Action not found');
      return res.status(200).json({ ok: true, id: rows[0].id });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'driver-care', { userId: req.user.sub });
  }
}

export default withAuthDataRoute(handler);
