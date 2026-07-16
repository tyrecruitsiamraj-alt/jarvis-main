import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { auditFromAuthed } from '../_lib/audit.js';

const tbl = tableInAppSchema('app_feedback');

type FeedbackKind = 'feature' | 'change' | 'bug' | 'other';
type FeedbackStatus = 'open' | 'in_progress' | 'done' | 'wontfix';

type Row = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  kind: string;
  title: string;
  body: string;
  page_path: string | null;
  status: string;
  admin_note: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function isKind(v: unknown): v is FeedbackKind {
  return v === 'feature' || v === 'change' || v === 'bug' || v === 'other';
}

function isStatus(v: unknown): v is FeedbackStatus {
  return v === 'open' || v === 'in_progress' || v === 'done' || v === 'wontfix';
}

function canManage(role: string): boolean {
  return role === 'admin' || role === 'supervisor';
}

function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function toRow(r: Row) {
  return {
    id: r.id,
    user_id: r.user_id,
    user_email: r.user_email,
    user_name: r.user_name,
    kind: r.kind as FeedbackKind,
    title: r.title,
    body: r.body,
    page_path: r.page_path || undefined,
    status: r.status as FeedbackStatus,
    admin_note: r.admin_note || undefined,
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
  };
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const status = getString(req.query?.status);
      const mine = getString(req.query?.mine) === '1';
      const manage = canManage(req.user.role);

      const params: unknown[] = [];
      const where: string[] = [];

      if (!manage || mine) {
        params.push(req.user.sub);
        where.push(`user_id = $${params.length}`);
      }
      if (status && isStatus(status)) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }

      const sql = `
        select *
        from ${tbl}
        ${where.length ? `where ${where.join(' and ')}` : ''}
        order by created_at desc
        limit 200
      `;
      const { rows } = await dbQuery<Row>(sql, params);
      return res.status(200).json({ items: rows.map(toRow), can_manage: manage });
    } catch (e) {
      return handleApiError(res, e, 'app-feedback GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const kind = b.kind;
      const title = getString(b.title)?.trim();
      const body = getString(b.body)?.trim();
      const page_path = getString(b.page_path)?.trim() || null;

      if (!isKind(kind)) {
        return sendError(res, 400, 'Bad request', 'kind ต้องเป็น feature / change / bug / other');
      }
      if (!title || title.length < 3) {
        return sendError(res, 400, 'Bad request', 'หัวข้อต้องมีอย่างน้อย 3 ตัวอักษร');
      }
      if (!body || body.length < 5) {
        return sendError(res, 400, 'Bad request', 'รายละเอียดต้องมีอย่างน้อย 5 ตัวอักษร');
      }
      if (title.length > 200) {
        return sendError(res, 400, 'Bad request', 'หัวข้อยาวเกินไป');
      }
      if (body.length > 5000) {
        return sendError(res, 400, 'Bad request', 'รายละเอียดยาวเกินไป');
      }

      const nameLookup = await dbQuery<{ full_name: string; email: string }>(
        `select full_name, email from ${tableInAppSchema('users')} where id = $1 limit 1`,
        [req.user.sub],
      );
      const profile = nameLookup.rows[0];
      const userName = profile?.full_name?.trim() || req.user.email;
      const userEmail = profile?.email?.trim() || req.user.email;

      const { rows } = await dbQuery<Row>(
        `
        insert into ${tbl}
          (user_id, user_email, user_name, kind, title, body, page_path)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning *
        `,
        [
          req.user.sub,
          userEmail,
          userName,
          kind,
          title,
          body,
          page_path && page_path.startsWith('/') ? page_path.slice(0, 300) : null,
        ],
      );
      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to create request');

      await auditFromAuthed(req, {
        action: 'app_feedback.create',
        entityType: 'app_feedback',
        entityId: row.id,
        after: { kind, title, status: row.status },
      });

      return res.status(201).json({ item: toRow(row) });
    } catch (e) {
      return handleApiError(res, e, 'app-feedback POST', { userId: req.user.sub });
    }
  }

  if (method === 'PATCH') {
    try {
      if (!canManage(req.user.role)) {
        return sendError(res, 403, 'Forbidden', 'เฉพาะ Supervisor / Admin จัดการสถานะได้');
      }
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const id = getString(b.id);
      if (!id) return sendError(res, 400, 'Bad request', 'id required');

      const status = b.status;
      const admin_note_raw = b.admin_note;
      const hasStatus = status !== undefined;
      const hasNote = admin_note_raw !== undefined;
      if (!hasStatus && !hasNote) {
        return sendError(res, 400, 'Bad request', 'ต้องระบุ status หรือ admin_note');
      }
      if (hasStatus && !isStatus(status)) {
        return sendError(res, 400, 'Bad request', 'สถานะไม่ถูกต้อง');
      }
      const admin_note =
        admin_note_raw === null || admin_note_raw === ''
          ? null
          : typeof admin_note_raw === 'string'
            ? admin_note_raw.trim().slice(0, 2000)
            : null;
      if (hasNote && admin_note_raw !== null && admin_note_raw !== '' && admin_note === null) {
        return sendError(res, 400, 'Bad request', 'admin_note ต้องเป็นข้อความ');
      }

      const { rows: beforeRows } = await dbQuery<Row>(
        `select * from ${tbl} where id = $1 limit 1`,
        [id],
      );
      const before = beforeRows[0];
      if (!before) return sendError(res, 404, 'Not found');

      const { rows } = await dbQuery<Row>(
        `
        update ${tbl}
        set
          status = coalesce($2, status),
          admin_note = case when $3::boolean then $4 else admin_note end,
          updated_at = now()
        where id = $1
        returning *
        `,
        [id, hasStatus ? status : null, hasNote, admin_note],
      );
      const row = rows[0];
      if (!row) return sendError(res, 404, 'Not found');

      await auditFromAuthed(req, {
        action: 'app_feedback.update',
        entityType: 'app_feedback',
        entityId: row.id,
        before: { status: before.status, admin_note: before.admin_note },
        after: { status: row.status, admin_note: row.admin_note },
      });

      return res.status(200).json({ item: toRow(row) });
    } catch (e) {
      return handleApiError(res, e, 'app-feedback PATCH', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'app-feedback');
