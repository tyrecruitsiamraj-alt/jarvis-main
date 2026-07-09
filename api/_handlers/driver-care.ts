import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import {
  riskT,
  actionT,
  empT,
  wcT,
} from '../_lib/driverCareRisk.js';
import {
  resolveReadScoreDate,
  emptyOverviewPayload,
} from '../_lib/driverCareRead.js';
import { bangkokBusinessDateYmd } from '../_lib/businessDate.js';
import {
  parseActionLogInput,
  parseActionUpdateInput,
} from '../_lib/driverCareActionValidation.js';
import { DomainError } from '../_lib/domainErrors.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { auditFromAuthed } from '../_lib/audit.js';

const skillT = tableInAppSchema('driver_care_skill');
const knowledgeT = tableInAppSchema('driver_care_knowledge');

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  return typeof v === 'string' ? v.trim() : '';
}

function todayYmd(): string {
  return bangkokBusinessDateYmd();
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
     where status <> 'closed' and next_follow_up_date < $1::date`,
    [todayYmd()],
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
    params.push(todayYmd());
    where.push(`a.status <> 'closed' and a.next_follow_up_date < $${params.length}::date`);
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

type SkillRow = {
  id: string;
  title: string;
  category: string;
  description: string;
  file_url: string | null;
  sort_order: number;
  created_by_name: string | null;
  updated_at: string | Date;
};

type KnowledgeRow = {
  id: string;
  title: string;
  category: string;
  summary: string | null;
  content: string;
  file_url: string | null;
  file_name: string | null;
  sort_order: number;
  created_by_name: string | null;
  updated_at: string | Date;
};

function mapSkillRow(r: SkillRow) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    fileUrl: r.file_url,
    sortOrder: r.sort_order,
    createdByName: r.created_by_name,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

function mapKnowledgeRow(r: KnowledgeRow) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    summary: r.summary,
    content: r.content,
    fileUrl: r.file_url,
    fileName: r.file_name,
    sortOrder: r.sort_order,
    createdByName: r.created_by_name,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

async function getSkills() {
  const { rows } = await dbQuery<SkillRow>(
    `select id, title, category, description, file_url, sort_order, created_by_name, updated_at
     from ${skillT}
     where is_active = true
     order by sort_order asc, title asc`,
  );
  return rows.map(mapSkillRow);
}

async function getKnowledge() {
  const { rows } = await dbQuery<KnowledgeRow>(
    `select id, title, category, summary, content, file_url, file_name, sort_order, created_by_name, updated_at
     from ${knowledgeT}
     where is_active = true
     order by sort_order asc, updated_at desc`,
  );
  return rows.map(mapKnowledgeRow);
}

async function saveSkill(req: AuthedReq, b: Record<string, unknown>) {
  const id = getString(b.id);
  const title = getString(b.title)?.trim();
  const category = getString(b.category) || 'intervention';
  const description = getString(b.description) || '';
  const fileUrl = getString(b.fileUrl) || null;
  const sortOrder = Number(b.sortOrder);
  const byName = req.user.email || 'User';

  if (!title) return null;

  if (id) {
    const { rows } = await dbQuery<SkillRow>(
      `update ${skillT} set
        title = $2, category = $3, description = $4, file_url = $5,
        sort_order = $6, updated_at = now()
       where id = $1::uuid and is_active = true
       returning id, title, category, description, file_url, sort_order, created_by_name, updated_at`,
      [id, title, category, description, fileUrl, Number.isFinite(sortOrder) ? sortOrder : 0],
    );
    if (!rows[0]) return null;
    return mapSkillRow(rows[0]);
  }

  const { rows } = await dbQuery<SkillRow>(
    `insert into ${skillT} (title, category, description, file_url, sort_order, created_by_name)
     values ($1, $2, $3, $4, $5, $6)
     returning id, title, category, description, file_url, sort_order, created_by_name, updated_at`,
    [title, category, description, fileUrl, Number.isFinite(sortOrder) ? sortOrder : 0, byName],
  );
  return rows[0] ? mapSkillRow(rows[0]) : null;
}

async function saveKnowledge(req: AuthedReq, b: Record<string, unknown>) {
  const id = getString(b.id);
  const title = getString(b.title)?.trim();
  const category = getString(b.category) || 'pre_resign_behavior';
  const summary = getString(b.summary) || null;
  const content = getString(b.content) || '';
  const fileUrl = getString(b.fileUrl) || null;
  const fileName = getString(b.fileName) || null;
  const sortOrder = Number(b.sortOrder);
  const byName = req.user.email || 'User';

  if (!title) return null;

  if (id) {
    const { rows } = await dbQuery<KnowledgeRow>(
      `update ${knowledgeT} set
        title = $2, category = $3, summary = $4, content = $5,
        file_url = $6, file_name = $7, sort_order = $8, updated_at = now()
       where id = $1::uuid and is_active = true
       returning id, title, category, summary, content, file_url, file_name, sort_order, created_by_name, updated_at`,
      [
        id,
        title,
        category,
        summary,
        content,
        fileUrl,
        fileName,
        Number.isFinite(sortOrder) ? sortOrder : 0,
      ],
    );
    return rows[0] ? mapKnowledgeRow(rows[0]) : null;
  }

  const { rows } = await dbQuery<KnowledgeRow>(
    `insert into ${knowledgeT} (
      title, category, summary, content, file_url, file_name, sort_order, created_by_name
    ) values ($1, $2, $3, $4, $5, $6, $7, $8)
    returning id, title, category, summary, content, file_url, file_name, sort_order, created_by_name, updated_at`,
    [
      title,
      category,
      summary,
      content,
      fileUrl,
      fileName,
      Number.isFinite(sortOrder) ? sortOrder : 0,
      byName,
    ],
  );
  return rows[0] ? mapKnowledgeRow(rows[0]) : null;
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const action = getQuery(req, 'action');
  const view = getQuery(req, 'view');

  try {
    if (method === 'GET') {
      const requestedScoreDate = getQuery(req, 'scoreDate') || undefined;
      const readMeta = await resolveReadScoreDate(requestedScoreDate);

      if (view === 'overview') {
        if (!readMeta.scoreDate) {
          return res.status(200).json(emptyOverviewPayload(readMeta));
        }
        const overview = await getOverview(readMeta.scoreDate);
        return res.status(200).json({ ...readMeta, ...overview });
      }
      if (view === 'risk-list') {
        if (!readMeta.scoreDate) {
          return res.status(200).json({ ...readMeta, items: [] });
        }
        const items = await getRiskList(readMeta.scoreDate, {
          riskLevel: getQuery(req, 'riskLevel'),
          site: getQuery(req, 'site'),
          supervisor: getQuery(req, 'supervisor'),
          actionStatus: getQuery(req, 'actionStatus'),
          search: getQuery(req, 'search'),
        });
        return res.status(200).json({ ...readMeta, items });
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
      if (view === 'skills') {
        return res.status(200).json(await getSkills());
      }
      if (view === 'knowledge') {
        return res.status(200).json(await getKnowledge());
      }
      return sendError(res, 400, 'Bad request', 'view required: overview | risk-list | actions | skills | knowledge');
    }

    if (method === 'POST' && action === 'log') {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      let validated;
      try {
        validated = parseActionLogInput(raw as Record<string, unknown>);
      } catch (e) {
        if (e instanceof DomainError) {
          return sendError(res, e.statusCode, e.errorLabel, e.message);
        }
        throw e;
      }

      const { rows: empCheck } = await dbQuery<{ id: string }>(
        `select id from ${empT} where id = $1::uuid and status = 'active' limit 1`,
        [validated.employeeId],
      );
      if (!empCheck[0]) {
        return sendError(res, 400, 'Bad request', 'employeeId not found or inactive');
      }

      const { rows } = await dbQuery<{ id: string }>(
        `insert into ${actionT} (
          risk_score_id, employee_id, action_by, action_by_name,
          action_type, contact_status, issue_found, action_taken, result,
          next_follow_up_date, status, updated_at
        ) values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10::date, $11, now())
        returning id`,
        [
          validated.riskScoreId,
          validated.employeeId,
          req.user.sub,
          req.user.email || 'User',
          validated.actionType,
          validated.contactStatus,
          validated.issueFound,
          validated.actionTaken,
          validated.result,
          validated.nextFollowUpDate,
          validated.status,
        ],
      );
      const actionId = rows[0]?.id;
      if (actionId) {
        await auditFromAuthed(req, {
          action: 'driver_care.action.log',
          entityType: 'driver_care_action',
          entityId: actionId,
          after: { employeeId: validated.employeeId, actionType: validated.actionType, status: validated.status },
        });
      }
      return res.status(201).json({ ok: true, id: actionId });
    }

    if (method === 'POST' && action === 'save-skill') {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const saved = await saveSkill(req, raw as Record<string, unknown>);
      if (!saved) return sendError(res, 400, 'Bad request', 'title required');
      await auditFromAuthed(req, {
        action: 'driver_care.skill.save',
        entityType: 'driver_care_skill',
        entityId: String((saved as { id?: string }).id || 'skill'),
        after: saved,
      });
      return res.status(200).json(saved);
    }

    if (method === 'POST' && action === 'save-knowledge') {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const saved = await saveKnowledge(req, raw as Record<string, unknown>);
      if (!saved) return sendError(res, 400, 'Bad request', 'title required');
      await auditFromAuthed(req, {
        action: 'driver_care.knowledge.save',
        entityType: 'driver_care_knowledge',
        entityId: String((saved as { id?: string }).id || 'knowledge'),
        after: saved,
      });
      return res.status(200).json(saved);
    }

    if (method === 'PATCH' && (action === 'delete-skill' || action === 'delete-knowledge')) {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const id = getString((raw as Record<string, unknown>).id);
      if (!id) return sendError(res, 400, 'Bad request', 'id required');
      const table = action === 'delete-skill' ? skillT : knowledgeT;
      const { rows } = await dbQuery<{ id: string }>(
        `update ${table} set is_active = false, updated_at = now() where id = $1::uuid returning id`,
        [id],
      );
      if (!rows[0]) return sendError(res, 404, 'Not found', 'Record not found');
      await auditFromAuthed(req, {
        action: action === 'delete-skill' ? 'driver_care.skill.archive' : 'driver_care.knowledge.archive',
        entityType: action === 'delete-skill' ? 'driver_care_skill' : 'driver_care_knowledge',
        entityId: rows[0].id,
        before: { id },
        after: { is_active: false },
      });
      return res.status(200).json({ ok: true, id: rows[0].id });
    }

    if (method === 'PATCH' && action === 'update-action') {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      let validated;
      try {
        validated = parseActionUpdateInput(raw as Record<string, unknown>);
      } catch (e) {
        if (e instanceof DomainError) {
          return sendError(res, e.statusCode, e.errorLabel, e.message);
        }
        throw e;
      }

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
        [
          validated.id,
          validated.status || null,
          validated.result || null,
          validated.actionTaken || null,
          validated.nextFollowUpDate === undefined ? '__skip__' : validated.nextFollowUpDate,
        ],
      );
      if (!rows[0]) return sendError(res, 404, 'Not found', 'Action not found');
      await auditFromAuthed(req, {
        action: 'driver_care.action.update',
        entityType: 'driver_care_action',
        entityId: rows[0].id,
        after: {
          status: validated.status,
          result: validated.result,
          actionTaken: validated.actionTaken,
          nextFollowUp: validated.nextFollowUpDate,
        },
      });
      return res.status(200).json({ ok: true, id: rows[0].id });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'driver-care', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'driver-care', {
  hintFromReq: (req) => {
    const v = req.query?.action;
    return typeof v === 'string' ? v.trim() : undefined;
  },
});
