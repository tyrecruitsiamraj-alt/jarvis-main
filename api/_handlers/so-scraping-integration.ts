/**
 * ═══ So Scraping → Jarvis: คนที่คอมเมนต์ใต้โพสต์รับสมัครงาน (เจ้าของ 22 ต.ค. 2569) ═══
 *
 * POST /api/integrations/so-scraping/leads    — รับคอมเมนต์ทีละอัน
 * POST /api/integrations/so-scraping/ai-call  — ส่งเข้า AI โทร (Lumos)
 * ยืนยันตัว: header `x-api-key` (`withIntegrationKey` · key ชื่อ `so-scraping`)
 *
 * Choice เจ้าของ:
 * - มีเบอร์ = ใบสมัครหน้าผู้สมัคร Journey เดียวกับเจ้าหน้าที่เพิ่มเอง (`parseStaffApplication` minimal · กันซ้ำ 14 วัน `lockAndFindRepeat`)
 *   ช่องทาง "Facebook คอมเมนต์" · ผู้รับผิดชอบ = ผู้สรรหาของใบขอ · "ซ้ำก็คือซ้ำ" (ไม่สร้างใบใหม่ ผูก lead กับใบเดิม)
 * - ไม่มีเบอร์ = เก็บใน `so_scraping_comment_leads` เฉย ๆ
 * - AI ยังไม่โทรจนกว่าเรียก ai-call (ตัวส่งอัตโนมัติข้ามใบ So Scraping ที่ยังไม่เลือกวิธีโทร) · ai-call ใช้ `chooseAi` ตัวเดียวกับปุ่ม "ส่ง AI โทร"
 * - เบอร์ติด `candidate_call_suppression` หรือมีคนถือ (`candidate_call_holds`) = do_not_call
 * - ส่งซ้ำ (comment_url เดิม) = ตอบแถวเดิม `duplicate: true`
 * 🔴 ไม่บันทึกความยินยอม PDPA แทนเจ้าหน้าที่ (ไม่มีคนยืนยัน) — ดู `docs` ในรายงานเจ้าของ
 */
import { randomUUID } from 'node:crypto';
import { sendError, type ApiReq, type ApiRes } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { dbQuery, dbTransaction } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { logError, logInfo } from '../_lib/logger.js';
import { withIntegrationKey } from '../_lib/integrationKeyAuth.js';
import { lockAndFindRepeat } from '../_lib/applicationRepeatGuard.js';
import { getSiamrajUnitRequestById } from '../_lib/siamrajUnitRequests.js';
import { isRequestClosedForApply } from '../_lib/requestClosedForApply.js';
import { attachAssignments } from './siamraj-unit-requests.js';
import { chooseAi, type CallChoiceRow } from './application-call-choice.js';
import { parseStaffApplication, STAFF_INSERT_COLUMNS, STAFF_INSERT_VALUES, staffInsertParams } from '../../src/lib/staffApplicationInput.js';
import { publicJobPositionLabel } from '../../src/lib/unitRequestDisplay.js';
import {
  normalizeCommentPhone,
  parseSoScrapingLead,
  splitCommenterName,
  SO_SCRAPING_CHANNEL_LABEL,
  SO_SCRAPING_CREATED_BY,
  SO_SCRAPING_KEY_NAME,
} from '../../src/lib/soScrapingLeads.js';
import type { JobRequest } from '../../src/types/index.js';

const LEADS = tableInAppSchema('so_scraping_comment_leads');
const APPS = tableInAppSchema('public_job_applications');
const SUPPRESS = tableInAppSchema('candidate_call_suppression');
const HOLDS = tableInAppSchema('candidate_call_holds');

const MAX_LEADS_PER_CALL = 200;
const UUID = /^[0-9a-f-]{36}$/i;
const e164 = (phone10: string) => `+66${phone10.slice(1)}`;

type LeadRow = { id: string; request_no: string; application_id: string | null; duplicate: boolean; do_not_call: boolean; commenter_name: string | null; phone: string | null };

/** ห้ามโทร = อยู่ในรายชื่อห้ามโทร (ยังไม่หมดเวลา) หรือมีเจ้าหน้าที่ถือเบอร์อยู่ */
export async function isDoNotCall(phone10: string): Promise<boolean> {
  const { rows } = await dbQuery<{ hit: boolean }>(
    `select exists (select 1 from ${SUPPRESS} s where s.phone_e164 = $1 and (s.suppressed_until is null or s.suppressed_until > now()))
         or exists (select 1 from ${HOLDS} h where h.phone_e164 = $1 and h.released_at is null and (h.expires_at is null or h.expires_at > now())) as hit`,
    [e164(phone10)],
  );
  return Boolean(rows[0]?.hit);
}

function method(req: ApiReq, res: ApiRes): boolean {
  if ((req.method || '').toUpperCase() === 'POST') return true;
  res.setHeader?.('Allow', 'POST');
  sendError(res, 405, 'Method not allowed');
  return false;
}

async function postLead(req: ApiReq, res: ApiRes) {
  if (!method(req, res)) return;
  try {
    const parsed = parseSoScrapingLead(await readJsonBody(req));
    if (!parsed.ok) return sendError(res, 400, 'Bad request', parsed.message);
    const v = parsed.value;

    // ส่งซ้ำ (comment_url เดิม) = แถวเดิม
    const prev = await dbQuery<LeadRow>(`select * from ${LEADS} where comment_url = $1 limit 1`, [v.comment_url]);
    if (prev.rows[0]) {
      const p = prev.rows[0];
      return res.status(200).json({ lead_id: p.id, candidate_id: p.application_id, duplicate: true, do_not_call: p.do_not_call });
    }

    const job = (await getSiamrajUnitRequestById(`siamraj-sql:${v.request_no}`, { mode: 'all' })) as JobRequest | null;
    if (!job) return sendError(res, 404, 'Not found', `ไม่พบใบขอ ${v.request_no} ที่ยังเปิดอยู่`);
    await attachAssignments([job]);

    const phone = normalizeCommentPhone(v.phone);
    const doNotCall = phone ? await isDoNotCall(phone) : false;
    let applicationId: string | null = null;
    let duplicate = false;

    if (phone) {
      const name = splitCommenterName(v.commenter_name);
      const app = parseStaffApplication(
        {
          first_name: name.first,
          last_name: name.last,
          phone,
          job_id: job.id,
          job_title: publicJobPositionLabel(job),
          unit_name: job.unit_name ?? null,
          responsible_name: job.recruiter_name ?? null,
          channel_label: SO_SCRAPING_CHANNEL_LABEL,
        },
        { minimal: true },
      );
      if (app.ok) {
        applicationId = await dbTransaction(async (client) => {
          // Journey เดียวกับเจ้าหน้าที่เพิ่มเอง — สมัครซ้ำภายใน 14 วัน = ซ้ำ ผูก lead กับใบเดิม
          const hit = await lockAndFindRepeat(client, { phone: app.value.phone });
          if (hit) {
            duplicate = true;
            const { rows } = await client.query<{ id: string }>(
              `select id::text as id from ${APPS} where phone_e164 = $1 order by created_at desc limit 1`,
              [e164(phone)],
            );
            return rows[0]?.id ?? null;
          }
          const { rows } = await client.query<{ id: string }>(
            `insert into ${APPS} as a (${STAFF_INSERT_COLUMNS}) values (${STAFF_INSERT_VALUES}) returning a.id::text as id`,
            staffInsertParams(app.value, SO_SCRAPING_CREATED_BY, null),
          );
          return rows[0]?.id ?? null;
        });
      }
    }

    const { rows } = await dbQuery<{ id: string }>(
      `insert into ${LEADS} (request_no, job_id, commenter_name, phone, comment_text, comment_url, post_url, group_name, commented_at,
                             application_id, duplicate, do_not_call)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (comment_url) do update set updated_at = now()
       returning id::text as id`,
      [v.request_no, job.id, v.commenter_name, phone ?? v.phone, v.comment_text, v.comment_url, v.post_url, v.group_name, v.commented_at, applicationId, duplicate, doNotCall],
    );
    logInfo('soScraping.lead', { request_no: v.request_no, has_phone: Boolean(phone), application: Boolean(applicationId), duplicate, doNotCall });
    return res.status(201).json({ lead_id: rows[0]?.id ?? null, candidate_id: applicationId, duplicate, do_not_call: doNotCall });
  } catch (e) {
    logError('soScraping.lead', e);
    return sendError(res, 500, 'Server error', 'บันทึกคอมเมนต์ไม่สำเร็จ');
  }
}

async function postAiCall(req: ApiReq, res: ApiRes) {
  if (!method(req, res)) return;
  try {
    const raw = (await readJsonBody(req)) as Record<string, unknown> | null;
    const requestNo = typeof raw?.request_no === 'string' ? raw.request_no.trim().toUpperCase() : '';
    const leadIds = Array.isArray(raw?.lead_ids) ? [...new Set(raw.lead_ids.filter((x): x is string => typeof x === 'string' && UUID.test(x)))] : [];
    if (!requestNo) return sendError(res, 400, 'Bad request', 'ต้องส่ง request_no');
    if (leadIds.length === 0) return sendError(res, 400, 'Bad request', 'ต้องส่ง lead_ids');
    if (leadIds.length > MAX_LEADS_PER_CALL) return sendError(res, 400, 'Bad request', `ส่งได้ครั้งละไม่เกิน ${MAX_LEADS_PER_CALL} คน`);

    const { rows: leads } = await dbQuery<LeadRow>(`select * from ${LEADS} where id = any($1::uuid[]) and request_no = $2`, [leadIds, requestNo]);
    const byId = new Map(leads.map((l) => [l.id, l]));
    const skipped: Array<{ lead_id: string; name: string | null; reason: string }> = [];
    const toCall: LeadRow[] = [];
    for (const id of leadIds) {
      const l = byId.get(id);
      if (!l) skipped.push({ lead_id: id, name: null, reason: 'ไม่พบ lead นี้ในใบขอนี้' });
      else if (!l.application_id) skipped.push({ lead_id: id, name: l.commenter_name, reason: 'ไม่มีเบอร์' });
      else if (l.phone && normalizeCommentPhone(l.phone) && (await isDoNotCall(normalizeCommentPhone(l.phone)!))) {
        skipped.push({ lead_id: id, name: l.commenter_name, reason: 'ห้ามโทร' });
      } else toCall.push(l);
    }

    const added: Array<{ lead_id: string; candidate_id: string; name: string }> = [];
    if (toCall.length > 0) {
      const { rows: apps } = await dbQuery<CallChoiceRow>(
        `select a.id::text as id, a.full_name, a.phone, a.job_id, a.department_code, a.job_title, a.unit_name, a.position_interest,
                a.province, a.claimed_by, a.claimed_by_name, a.age, a.created_by_name
           from ${APPS} a where a.id = any($1::uuid[])`,
        [[...new Set(toCall.map((l) => l.application_id!))]],
      );
      const closed = new Set<string>();
      for (const jobId of new Set(apps.map((a) => a.job_id?.trim()).filter((j): j is string => Boolean(j)))) {
        if (await isRequestClosedForApply(jobId)) closed.add(jobId);
      }
      // ตัวเดียวกับปุ่ม "ส่ง AI โทร" ของเจ้าหน้าที่ — ด่านซ้ำ/อายุเกิน/ใบขอปิด/อยู่ในคิวแล้ว ครบ
      const result = await chooseAi(SO_SCRAPING_CREATED_BY, apps, false, closed);
      const appById = new Map(apps.map((a) => [a.id, a]));
      const skippedNames = [...result.skipped];
      for (const l of toCall) {
        const app = appById.get(l.application_id!);
        const i = app ? skippedNames.findIndex((s) => s.name === app.full_name) : -1;
        if (!app) skipped.push({ lead_id: l.id, name: l.commenter_name, reason: 'ไม่พบใบสมัคร' });
        else if (i >= 0) {
          skipped.push({ lead_id: l.id, name: app.full_name, reason: skippedNames[i].reason });
          skippedNames.splice(i, 1);
        } else added.push({ lead_id: l.id, candidate_id: app.id, name: app.full_name });
      }
    }
    // batch_id = รหัสคำขอนี้ (ระบบเราไม่ใช้ชุดโทรรออนุมัติ — คนเข้าคิว AI ทันที)
    const batchId = randomUUID();
    logInfo('soScraping.aiCall', { batchId, request_no: requestNo, added: added.length, skipped: skipped.length });
    return res.status(200).json({ batch_id: batchId, added, skipped });
  } catch (e) {
    logError('soScraping.aiCall', e);
    return sendError(res, 500, 'Server error', 'ส่งเข้า AI โทรไม่สำเร็จ');
  }
}

export const soScrapingLeadsHandler = withIntegrationKey(SO_SCRAPING_KEY_NAME, postLead);
export const soScrapingAiCallHandler = withIntegrationKey(SO_SCRAPING_KEY_NAME, postAiCall);
