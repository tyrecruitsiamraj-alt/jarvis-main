import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  listJobPostingRequests,
  listActiveJobPostingsForJob,
  listLatestJobPostingsForJob,
  listLatestJobPostingsForBoard,
  getJobPostingRequestById,
  createJobPostingRequest,
  updateJobPostingRequest,
  normalizeJobPostingStatus,
  normalizeJobPostingRequestType,
} from '../_lib/jobPostingRequests.js';
import { isSiamrajRequestInScope, loadScopedRequestNoSet } from '../_lib/siamrajUnitRequests.js';
import { listLinkedSoGroups, listSoAccounts, listSoWorkers, unknownSoGroupIds } from '../_lib/soScrapingGroups.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';

const POSTINGS = tableInAppSchema('recruit_postings');
const LINKS = tableInAppSchema('recruit_posting_links');
const REQUESTS = tableInAppSchema('job_posting_requests');

/** โค้ดลิงก์ในแคปชั่นต้องเป็นลิงก์ของประกาศที่เปิดอยู่ของใบนี้จริง (ทุกโพสต์ต้องมีลิงก์สมัครที่เปิดได้ · 20 ต.ค. 2569) */
async function linkCodeBelongsToJob(code: string, jobId: string): Promise<boolean> {
  const { rows } = await dbQuery<{ ok: number }>(
    `select 1 as ok from ${LINKS} l join ${POSTINGS} p on p.id = l.posting_id
      where l.code = $1 and p.job_id = $2 and p.status = 'open' limit 1`,
    [code, jobId],
  );
  return rows.length > 0;
}

/** กลุ่มที่ใบนี้เพิ่งสั่งโพสต์ไป (3 วัน · ไม่นับที่ยกเลิก/ไม่รับงาน) — ป๊อปเตือนโพสต์ซ้ำ กันบัญชีโดนแบน */
async function recentGroupsOfJob(jobId: string): Promise<string[]> {
  try {
    const { rows } = await dbQuery<{ g: string }>(
      `select distinct jsonb_array_elements_text(job_snapshot->'group_ids') as g from ${REQUESTS}
        where job_id = $1 and request_type = 'content' and status not in ('cancelled', 'rejected')
          and created_at > now() - interval '3 days' and jsonb_typeof(job_snapshot->'group_ids') = 'array'`,
      [jobId],
    );
    return rows.map((r) => r.g);
  } catch {
    return [];
  }
}
import { soSnapshotError } from '../../src/lib/soScraping.js';

const OUT_OF_SCOPE = 'ไม่มีสิทธิ์เข้าถึงใบขอของแผนกอื่น';

/** เก็บเฉพาะคำขอโพสของใบขอที่ผู้ใช้เห็นได้ (null = เห็นทุกแผนก) — job_snapshot มีข้อมูลใบขอในตัว */
function scopePostings<T extends { job_id: string; request_no: string | null }>(
  items: T[],
  scoped: Set<string> | null,
): T[] {
  if (scoped === null) return items;
  return items.filter((p) => {
    const rn = (p.request_no || '').trim();
    return rn ? scoped.has(rn) : false;
  });
}

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/** คำขอ "โพสหางานใหม่" — สร้าง ID ให้ทีมอื่นรับไปทำคอนเทนต์/โพสหาคนต่อ */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
      if (jobId.trim()) {
        if (!(await isSiamrajRequestInScope(req.user, jobId))) {
          return sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
        }
        // `active` = คำขอ active ทุกประเภทของใบนี้ (ตั้งแต่ 080 มีได้ทั้ง Content และ Scraping)
        // — คง `item` ไว้ด้วยเพื่อไม่ให้ client เดิมพัง (อ่านตัวล่าสุดเหมือนเคย)
        const active = await listActiveJobPostingsForJob(jobId);
        // `latest` = คำขอล่าสุดต่อประเภท ทุกสถานะ — ป๊อปโชว์ผลที่ So Scraping เขียนกลับ (20 ต.ค. 2569)
        const latest = await listLatestJobPostingsForJob(jobId);
        return res.status(200).json({ item: active[0] ?? null, active, latest, recent_groups: await recentGroupsOfJob(jobId) });
      }
      // กลุ่ม Facebook ของ So Scraping ที่มีบัญชีผูก — อ่านอย่างเดียว (ป๊อปสั่งโพสต์ · 20 ต.ค. 2569)
      if (getQuery(req, 'groups') === '1') {
        return res.status(200).json({ groups: await listLinkedSoGroups() });
      }
      // ป๊อป Autopost (20 ต.ค. 2569): บัญชี · กลุ่ม · worker — อ่านอย่างเดียว (บัญชีเลือกแค่คอลัมน์ที่ไม่ลับ)
      if (getQuery(req, 'autopost') === '1') {
        const [accounts, groups, workers] = await Promise.all([listSoAccounts(), listLinkedSoGroups(), listSoWorkers()]);
        return res.status(200).json({ accounts, groups, workers });
      }
      // ป้ายสถานะบนการ์ดกล่องงาน + ตัวกรอง (20 ต.ค. 2569) — ล่าสุดต่อ (ใบ, ประเภท) ของใบที่ผู้ใช้เห็นได้
      if (getQuery(req, 'board') === '1') {
        const scoped = await loadScopedRequestNoSet(req.user);
        const items = scopePostings(await listLatestJobPostingsForBoard(), scoped);
        return res.status(200).json({ items });
      }
      const status = normalizeJobPostingStatus(getQuery(req, 'status'));
      const scoped = await loadScopedRequestNoSet(req.user);
      const items = scopePostings(
        await listJobPostingRequests(status ? { status } : undefined),
        scoped,
      );
      return res.status(200).json({ items });
    } catch (e) {
      return handleApiError(res, e, 'matching-job-postings GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST' || method === 'PUT') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;
      const jobId = getString(body.job_id) || getString(body.jobId);
      if (!jobId) return sendError(res, 400, 'Bad request', 'job_id is required');
      if (!(await isSiamrajRequestInScope(req.user, jobId))) {
        return sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
      }

      const rawSnapshot = body.job_snapshot ?? body.jobSnapshot;
      const requestType = normalizeJobPostingRequestType(body.request_type ?? body.requestType) ?? 'content';
      const jobSnapshot =
        rawSnapshot && typeof rawSnapshot === 'object' && !Array.isArray(rawSnapshot)
          ? (rawSnapshot as Record<string, unknown>)
          : null;
      // ตรวจซ้ำฝั่ง server ด้วยกติกาเดียวกับจอ (So Scraping · 20 ต.ค. 2569) — ข้อความบอกว่าต้องทำอะไร
      const snapError = soSnapshotError(requestType, jobSnapshot);
      if (snapError) return sendError(res, 400, 'Bad request', snapError);
      if (requestType === 'content' && Array.isArray(jobSnapshot?.group_ids)) {
        const picked = jobSnapshot.group_ids.filter((x): x is string => typeof x === 'string');
        const unknown = await unknownSoGroupIds(picked);
        if (unknown.length > 0) return sendError(res, 400, 'Bad request', 'มีกลุ่มที่ไม่อยู่ในระบบ So Scraping แล้ว — ปิดป๊อปแล้วเลือกใหม่');
        // Autopost: บัญชีต้องมีจริง · กลุ่มต้องเป็นของบัญชีนั้น · worker ต้องมีจริง · ลิงก์ต้องเป็นของใบนี้
        if (typeof jobSnapshot.account_id === 'string') {
          const accounts = await listSoAccounts();
          const acc = accounts.find((a) => a.id === jobSnapshot.account_id);
          if (!acc) return sendError(res, 400, 'Bad request', 'ไม่พบบัญชี Facebook นี้ในระบบ So Scraping แล้ว');
          if (picked.some((g) => !acc.groupIds.includes(g))) {
            return sendError(res, 400, 'Bad request', `มีกลุ่มที่บัญชี ${acc.name} โพสต์ไม่ได้ — เลือกกลุ่มใหม่`);
          }
          if (acc.pausedUntil && Date.parse(acc.pausedUntil) > Date.now()) {
            return sendError(res, 400, 'Bad request', `บัญชี ${acc.name} ถูกพักอยู่ — เลือกบัญชีอื่น`);
          }
          const worker = jobSnapshot.worker_id;
          if (typeof worker === 'string' && !(await listSoWorkers()).some((w) => w.name === worker)) {
            return sendError(res, 400, 'Bad request', 'ไม่พบ worker นี้ในระบบ So Scraping แล้ว');
          }
          const code = typeof jobSnapshot.link_code === 'string' ? jobSnapshot.link_code : '';
          if (!code || !(await linkCodeBelongsToJob(code, jobId))) {
            return sendError(res, 400, 'Bad request', 'ลิงก์สมัครไม่ใช่ของใบนี้หรือประกาศปิดไปแล้ว — เลือกลิงก์ใหม่');
          }
        }
      }
      const item = await createJobPostingRequest({
        jobId,
        requestNo: getString(body.request_no) ?? getString(body.requestNo),
        requestType,
        reason: body.reason,
        userId: req.user.sub,
        userName: req.user.email,
        jobSnapshot,
      });

      await auditFromAuthed(req, {
        action: 'job_posting_request.create',
        entityType: 'job_posting_request',
        entityId: item.id,
        after: { job_id: item.job_id, request_type: item.request_type, status: item.status },
      });

      return res.status(200).json(item);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/is required|must be|invalid/i.test(message)) {
        return sendError(res, 400, 'Bad request', message);
      }
      return handleApiError(res, e, 'matching-job-postings POST', { userId: req.user.sub });
    }
  }

  if (method === 'PATCH') {
    try {
      const id = getQuery(req, 'id');
      if (!id.trim()) return sendError(res, 400, 'Bad request', 'id query is required');
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;

      // จำกัดตาม BU — กันแก้/ปิดคำขอโพสของใบขอแผนกอื่นด้วยการเดา id
      const existing = await getJobPostingRequestById(id);
      if (!existing) return sendError(res, 404, 'Not found', 'ไม่พบคำขอนี้');
      if (!(await isSiamrajRequestInScope(req.user, existing.request_no || existing.job_id))) {
        return sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
      }

      const item = await updateJobPostingRequest(id, {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      });
      if (!item) return sendError(res, 404, 'Not found', 'ไม่พบคำขอนี้');

      await auditFromAuthed(req, {
        action: 'job_posting_request.update',
        entityType: 'job_posting_request',
        entityId: item.id,
        after: { status: item.status },
      });

      return res.status(200).json(item);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/is required|must be|invalid|nothing to update/i.test(message)) {
        return sendError(res, 400, 'Bad request', message);
      }
      return handleApiError(res, e, 'matching-job-postings PATCH', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'matching-job-postings');
