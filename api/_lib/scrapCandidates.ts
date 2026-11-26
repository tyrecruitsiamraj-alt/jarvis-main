/**
 * ═══ รายชื่อจาก Scrap ฝั่งเซิร์ฟเวอร์ (เจ้าของ 17 พ.ย. 2569) — ตรรกะ/คำอยู่ `src/lib/scrapCandidates.ts` ═══
 * อ่านสดจากฐานของ So Scraping (schema `so-candidate-data` ฐานเดียวกัน · อ่านอย่างเดียว) ผูกใบขอด้วย
 * `scrape_tasks.source_request_no` (So Scraping มีงานเดียวต่อเลขใบขอ) · ไม่คัดลอกมาเก็บ
 * "เก็บเข้าการติดต่อ" = สร้างใบสมัครด้วย Journey เดียวกับคอมเมนต์จาก So Scraping (กันซ้ำ 14 วัน `lockAndFindRepeat`)
 * แล้วเก็บเป็น Lead ของคนกด (คำสั่งเดียวกับปุ่ม "เก็บเข้า Lead" ของแท็บผู้สมัคร)
 */
import type { QueryResultRow } from 'pg';
import { dbQuery, dbTransaction } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { lockAndFindRepeat } from './applicationRepeatGuard.js';
import { parseStaffApplication, STAFF_INSERT_COLUMNS, STAFF_INSERT_VALUES, staffInsertParams } from '../../src/lib/staffApplicationInput.js';
import { SO_SCRAPING_CREATED_BY } from '../../src/lib/soScrapingLeads.js';
import { CALLED_SQL } from './applicantOverviewSql.js';
import { loadStaffDisplay } from './staffDisplay.js';
import {
  scrapAge,
  scrapChannelLabel,
  scrapDisplayName,
  scrapGender,
  scrapPhone10,
  scrapBringerOf,
  scrapResultOf,
  scrapSplitName,
  type ScrapCandidateRow,
  type ScrapOrderLite,
  type ScrapOrderView,
  type ScrapInJarvis,
  type ScrapPlatform,
  type ScrapToContactResult,
} from '../../src/lib/scrapCandidates.js';

/** schema ของ So Scraping (ชื่อมีขีด ต้องครอบเครื่องหมายคำพูด) */
const CAND = '"so-candidate-data"';
const APPS = tableInAppSchema('public_job_applications');

/**
 * อ่านตารางของ So Scraping แบบมีเวลาหยุดรอ (บทเรียน 24 พ.ย. 2569) — So Scraping ค้าง UPDATE 21 นาที ตัวเพิ่มคอลัมน์รอคิว
 * คำสั่งอ่านรายชื่อ Scrap ของเรา 13 ตัวรอตาม ช่องต่อฐานเต็ม ทั้งบริษัทล็อกอิน Jarvis ไม่ได้
 * ⇒ ธุรกรรมอ่านอย่างเดียว · รอล็อกไม่เกิน 2 วิ · คำสั่งไม่เกิน 8 วิ — เกินแล้วล้ม (หน้าแท็บ Scrap บอกว่าอ่านไม่ได้) ไม่ค้างทั้งระบบ
 */
export const SCRAP_READ_LOCK_TIMEOUT = '2s';
export const SCRAP_READ_STATEMENT_TIMEOUT = '8s';
async function scrapRead<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
  return dbTransaction(async (client) => {
    await client.query('set transaction read only');
    await client.query(`set local lock_timeout = '${SCRAP_READ_LOCK_TIMEOUT}'`);
    await client.query(`set local statement_timeout = '${SCRAP_READ_STATEMENT_TIMEOUT}'`);
    const r = await client.query<T>(text, params);
    return { rows: r.rows };
  });
}

type RawRow = {
  candidate_id: string;
  request_no: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  age: string | null;
  gender: string | null;
  province: string | null;
  platform: string | null;
  status: string | null;
  score: number | string | null;
  reasons: unknown;
  found_at: Date | string | null;
  /** เจ้าของเรซูเม่ซ่อนชื่อบน JobThai (So Scraping เพิ่ม 23 พ.ย. 2569) */
  name_hidden: boolean | null;
};

async function loadRaw(requestNos: string[], candidateIds: string[] | null = null): Promise<RawRow[]> {
  if (requestNos.length === 0) return [];
  const { rows } = await scrapRead<RawRow>(
    `select distinct on (t.source_request_no, tc.candidate_id)
            tc.candidate_id::text as candidate_id, upper(t.source_request_no) as request_no,
            c.full_name, c.first_name, c.last_name, c.phone, c.age::text as age, c.gender, c.province,
            cs.platform, tc.qualification_status as status, tc.qualification_score as score,
            tc.qualification_reasons as reasons, coalesce(tc.first_matched_at, cs.first_seen_at) as found_at,
            coalesce((to_jsonb(c)->>'name_hidden')::boolean, false) as name_hidden
       from ${CAND}.scrape_tasks t
       join ${CAND}.scrape_task_candidates tc on tc.task_id = t.id
       join ${CAND}.candidates c on c.id = tc.candidate_id
       left join ${CAND}.candidate_sources cs on cs.id = tc.candidate_source_id
      where upper(t.source_request_no) = any($1::text[])
        and ($2::uuid[] is null or tc.candidate_id = any($2::uuid[]))
      order by t.source_request_no, tc.candidate_id, tc.last_matched_at desc nulls last`,
    [requestNos.map((r) => r.toUpperCase()), candidateIds],
  );
  // เรียง: ผ่าน → ต้องดู → ยังไม่ประเมิน → ไม่ผ่าน · คะแนนมากก่อน · เจอล่าสุดก่อน
  const rank = (s: string | null) => (s === 'qualified' ? 0 : s === 'needs_review' ? 1 : s === 'rejected' ? 3 : 2);
  return rows.sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      Number(b.score ?? -1) - Number(a.score ?? -1) ||
      new Date(b.found_at ?? 0).getTime() - new Date(a.found_at ?? 0).getTime(),
  );
}

/** ใบสมัครในใบขอนี้ที่เบอร์ตรงกับคนจาก Scrap — บอกว่าเก็บไปแล้วหรือยัง */
async function inJarvisByPhone(jobIds: string[], phones: string[]): Promise<Map<string, ScrapInJarvis>> {
  const out = new Map<string, ScrapInJarvis>();
  if (jobIds.length === 0 || phones.length === 0) return out;
  const { rows } = await dbQuery<{ job_id: string; phone_e164: string; id: string; is_lead: boolean | null; lead_by_name: string | null; claimed: boolean }>(
    `select distinct on (job_id, phone_e164) job_id, phone_e164, id::text as id, is_lead, lead_by_name, (claimed_by is not null) as claimed
       from ${APPS}
      where job_id = any($1::text[]) and phone_e164 = any($2::text[])
      order by job_id, phone_e164, coalesce(is_lead, false) desc, created_at desc`,
    [jobIds, phones.map((p) => `+66${p.slice(1)}`)],
  );
  for (const r of rows)
    out.set(`${r.job_id}|${r.phone_e164}`, { application_id: r.id, is_lead: Boolean(r.is_lead), lead_by_name: r.lead_by_name, claimed: Boolean(r.claimed) });
  return out;
}

/** ใบขอจริงใน ERP — รายชื่อ Scrap ผูกด้วยเลขใบขอ ⇒ job id ฝั่งใบสมัครคือ `siamraj-sql:<เลข>` */
export const scrapJobIdOf = (requestNo: string) => `siamraj-sql:${requestNo.toUpperCase()}`;

export function requestNoOfJobId(jobId: string): string | null {
  const m = /^siamraj-sql:([A-Za-z]{2,4}\d{7})$/.exec(jobId.trim());
  return m ? m[1].toUpperCase() : null;
}

function toRow(r: RawRow, inJarvis: Map<string, ScrapInJarvis>): ScrapCandidateRow {
  const phone = scrapPhone10(r.phone);
  const name = scrapDisplayName(r.full_name, r.first_name, r.last_name, r.name_hidden);
  const reasons = Array.isArray(r.reasons) ? r.reasons.map(String).filter(Boolean) : [];
  const platform: ScrapPlatform = r.platform === 'jobbkk' || r.platform === 'jobthai' ? r.platform : null;
  return {
    candidate_id: r.candidate_id,
    request_no: r.request_no,
    full_name: name,
    phone,
    age: scrapAge(r.age),
    gender: scrapGender(r.gender),
    province: r.province?.trim() || null,
    platform,
    result: scrapResultOf(r.status),
    score: r.score === null || r.score === undefined ? null : Number(r.score),
    reasons,
    found_at: r.found_at ? new Date(r.found_at).toISOString() : null,
    in_jarvis: phone ? (inJarvis.get(`${scrapJobIdOf(r.request_no)}|+66${phone.slice(1)}`) ?? null) : null,
  };
}

/** รายชื่อของหลายใบขอ (เลขใบขอ) — ใบที่ไม่เคยสั่ง Scrap ได้ 0 แถว */
export async function listScrapCandidates(
  requestNos: string[],
): Promise<{ rows: ScrapCandidateRow[]; orders: Record<string, ScrapOrderView[]> }> {
  const raw = await loadRaw(requestNos);
  const phones = [...new Set(raw.map((r) => scrapPhone10(r.phone)).filter((p): p is string => Boolean(p)))];
  const jobIds = [...new Set(raw.map((r) => scrapJobIdOf(r.request_no)))];
  const reqs = [...new Set(raw.map((r) => r.request_no))];
  const [inJarvis, ordersByReq, staffName] = await Promise.all([inJarvisByPhone(jobIds, phones), loadScrapOrdersMap(reqs), loadStaffDisplay()]);
  const nameOf = (who: string | null) => (who ? (staffName(who.trim().toLowerCase()) ?? who.trim()) : null);
  const rows = raw.map((r) => {
    const row = toRow(r, inJarvis);
    // คนนำเข้า = คนสั่ง Scrap (เจ้าของ 26 พ.ย. 2569) — ตัวเลือกเดียวกับตอนสร้างใบ (`scrapBringerOf`)
    row.ordered_by = nameOf(scrapBringerOf(ordersByReq.get(r.request_no) ?? [], row.found_at));
    return row;
  });
  const orders: Record<string, ScrapOrderView[]> = {};
  for (const [req, list] of ordersByReq) {
    orders[req] = list.map((o) => ({ by: nameOf(o.requested_by_name), status: o.status, created_at: o.created_at }));
  }
  return { rows, orders };
}

/** เลขใบขอที่ So Scraping มีรายชื่อ + ยอดรวม — ให้แท็บรวมรู้ว่าต้องอ่านใบไหน */
export async function listScrapRequestNos(): Promise<Array<{ request_no: string; total: number }>> {
  const { rows } = await scrapRead<{ request_no: string; total: string }>(
    `select upper(t.source_request_no) as request_no, count(distinct tc.candidate_id)::text as total
       from ${CAND}.scrape_tasks t
       join ${CAND}.scrape_task_candidates tc on tc.task_id = t.id
      where t.source_request_no is not null
      group by 1
      order by max(tc.last_matched_at) desc nulls last`,
  );
  return rows.map((r) => ({ request_no: r.request_no, total: Number(r.total) }));
}

/**
 * โทรแล้วต่อเลขใบขอ (เจ้าของ 19 พ.ย. 2569 "ทำเป็นแบบ โทรเท่าไหร่/จำนวน Scrap") — นับคนจาก Scrap (ต่อเบอร์) ที่มีใบสมัคร
 * ในใบขอนั้นเบอร์ตรงกัน และมีหลักฐานโทรชุดเดียวกับ `CALLED_SQL` (คิว AI · ผลที่เจ้าหน้าที่ลง · บันทึกติดต่อ)
 * ยังไม่เก็บเข้าการติดต่อ = ยังไม่มีใบ = ยังไม่โทร · ใบที่ไม่อยู่ในผล = 0
 */
export async function listScrapCalledCounts(requestNos: readonly string[]): Promise<Record<string, number>> {
  if (requestNos.length === 0) return {};
  const { rows } = await scrapRead<{ request_no: string; phone: string | null }>(
    `select distinct upper(t.source_request_no) as request_no, c.phone
       from ${CAND}.scrape_tasks t
       join ${CAND}.scrape_task_candidates tc on tc.task_id = t.id
       join ${CAND}.candidates c on c.id = tc.candidate_id
      where upper(t.source_request_no) = any($1::text[]) and c.phone is not null`,
    [requestNos.map((r) => r.toUpperCase())],
  );
  const pairs = new Map<string, { req: string; jobId: string; e164: string }>();
  for (const r of rows) {
    const p = scrapPhone10(r.phone);
    if (!p) continue;
    const jobId = scrapJobIdOf(r.request_no);
    const e164 = `+66${p.slice(1)}`;
    pairs.set(`${jobId}|${e164}`, { req: r.request_no, jobId, e164 });
  }
  if (pairs.size === 0) return {};
  const all = [...pairs.values()];
  const { rows: called } = await dbQuery<{ job_id: string; phone_e164: string }>(
    `select distinct a.job_id, a.phone_e164 from ${APPS} a
      where a.job_id = any($1::text[]) and a.phone_e164 = any($2::text[]) and ${CALLED_SQL}`,
    [[...new Set(all.map((x) => x.jobId))], [...new Set(all.map((x) => x.e164))]],
  );
  const out: Record<string, number> = {};
  for (const r of called) {
    const hit = pairs.get(`${r.job_id}|${r.phone_e164}`);
    if (hit) out[hit.req] = (out[hit.req] ?? 0) + 1;
  }
  return out;
}

const POSTINGS = tableInAppSchema('job_posting_requests');

/** คำสั่ง Scrap ทุกครั้งของใบขอ (ใครสั่ง · สถานะ · เวลา) ต่อเลขใบขอ — ป๊อปรายละเอียด + คนนำเข้า */
async function loadScrapOrdersMap(requestNos: string[]): Promise<Map<string, ScrapOrderLite[]>> {
  const out = new Map<string, ScrapOrderLite[]>();
  if (requestNos.length === 0) return out;
  const { rows } = await dbQuery<{ request_no: string; requested_by_name: string | null; status: string; created_at: Date | string }>(
    `select upper(request_no) as request_no, requested_by_name, status, created_at from ${POSTINGS}
      where request_type = 'scraping' and upper(request_no) = any($1::text[]) order by created_at`,
    [requestNos.map((r) => r.toUpperCase())],
  );
  for (const r of rows) {
    const list = out.get(r.request_no) ?? [];
    list.push({ requested_by_name: r.requested_by_name, status: r.status, created_at: new Date(r.created_at).toISOString() });
    out.set(r.request_no, list);
  }
  return out;
}

export async function loadScrapOrders(requestNo: string): Promise<ScrapOrderLite[]> {
  return (await loadScrapOrdersMap([requestNo])).get(requestNo.toUpperCase()) ?? [];
}

export type ScrapJobInfo = { id: string; title: string | null; unitName: string | null; recruiterName: string | null };

/**
 * เก็บเข้าการติดต่อ (`mode: 'lead'`): มีใบสมัครเบอร์นี้ภายใน 14 วันแล้ว = ใช้ใบเดิม (Journey เดียวกับคอมเมนต์ So Scraping) · ไม่มี = สร้างใบ
 * แล้วเก็บเป็น Lead ของคนกด ในธุรกรรมเดียวกัน (ล็อกเบอร์ — กดซ้อนกันสองคนไม่ได้ใบซ้ำ)
 *
 * สร้างใบอย่างเดียว (`mode: 'apply'` · เจ้าของ 25 พ.ย. 2569 "เลือกเพื่อส่ง AI โทรได้แบบผู้สมัคร") — ขั้นแรกของปุ่ม
 * "ส่ง AI โทร" / "เก็บไปโทรเอง" บนแท็บ Scrap (ขั้นที่สองคือ `/api/application-call-choice` ตัวเดียวกับแท็บผู้สมัคร)
 * ใบเดิมภายใน 14 วันของ **ใบขออื่น** = ข้าม (ส่ง AI ต่อจะได้บทของงานอื่น) · ใบสร้างใน call_choice ว่าง = ตัวส่งอัตโนมัติข้าม
 * ไม่มีเบอร์มือถือ = ข้าม (โทรไม่ได้)
 */
export async function addScrapToContact(
  job: ScrapJobInfo,
  requestNo: string,
  candidateIds: string[],
  by: { userId: string; name: string | null; departmentCode: string | null },
  mode: 'lead' | 'apply' = 'lead',
): Promise<ScrapToContactResult[]> {
  const raw = await loadRaw([requestNo], candidateIds);
  const byId = new Map(raw.map((r) => [r.candidate_id, r]));
  // คนนำเข้า = คนสั่ง Scrap ใบขอนี้ (เจ้าของ 26 พ.ย. 2569) · ไม่ใช่เจ้าหน้าที่สรรหาของใบ
  const [orders, staffName] = await Promise.all([loadScrapOrders(requestNo), loadStaffDisplay()]);
  const bringerOf = (foundAt: string | null): string | null => {
    const who = scrapBringerOf(orders, foundAt);
    return who ? (staffName(who.toLowerCase()) ?? who) : null;
  };
  const out: ScrapToContactResult[] = [];
  for (const id of candidateIds) {
    const r = byId.get(id);
    if (!r) {
      out.push({ candidate_id: id, name: '', outcome: 'skipped', application_id: null, note: 'ไม่พบคนนี้ในรายชื่อ Scrap ของใบขอนี้' });
      continue;
    }
    const row = toRow(r, new Map());
    if (!row.phone) {
      out.push({ candidate_id: id, name: row.full_name, outcome: 'skipped', application_id: null, note: 'ไม่มีเบอร์มือถือ' });
      continue;
    }
    const name = scrapSplitName(r.full_name, r.first_name, r.last_name);
    const app = parseStaffApplication(
      {
        first_name: name.first || row.full_name,
        last_name: name.last,
        phone: row.phone,
        age: row.age === null ? '' : String(row.age),
        gender: row.gender,
        province: row.province,
        job_id: job.id,
        job_title: job.title,
        unit_name: job.unitName,
        responsible_name: bringerOf(r.found_at ? new Date(r.found_at).toISOString() : null),
        channel_label: scrapChannelLabel(row.platform),
      },
      { minimal: true },
    );
    if (!app.ok) {
      out.push({ candidate_id: id, name: row.full_name, outcome: 'skipped', application_id: null, note: app.message });
      continue;
    }
    const res = await dbTransaction(async (client) => {
      const hit = await lockAndFindRepeat(client, { phone: app.value.phone });
      let appId: string | null = null;
      let existing = false;
      let otherJob: string | null = null;
      if (hit) {
        const { rows } = await client.query<{ id: string; job_id: string | null; job_title: string | null }>(
          `select id::text as id, job_id, job_title from ${APPS} where phone_e164 = $1 order by (job_id = $2) desc, created_at desc limit 1`,
          [`+66${row.phone!.slice(1)}`, job.id],
        );
        appId = rows[0]?.id ?? null;
        existing = Boolean(appId);
        if (mode === 'apply' && rows[0] && rows[0].job_id !== job.id) otherJob = rows[0].job_title || 'งานอื่น';
      }
      if (otherJob) return { appId: null, existing: false, otherLead: null, otherJob };
      if (!appId) {
        const { rows } = await client.query<{ id: string }>(
          `insert into ${APPS} as a (${STAFF_INSERT_COLUMNS}) values (${STAFF_INSERT_VALUES}) returning a.id::text as id`,
          staffInsertParams(app.value, SO_SCRAPING_CREATED_BY, by.departmentCode),
        );
        appId = rows[0]?.id ?? null;
      }
      // Lead ของคนอื่นอยู่แล้ว = ไม่แย่ง (การติดต่อของใครของมัน)
      let otherLead: string | null = null;
      if (appId && mode === 'lead') {
        await client.query(
          `update ${APPS} set is_lead = true, lead_by = $2, lead_by_name = $3, lead_at = now(), updated_at = now()
            where id = $1 and coalesce(is_lead, false) = false`,
          [appId, by.userId, by.name],
        );
        const { rows } = await client.query<{ lead_by: string | null; lead_by_name: string | null }>(
          `select lead_by, lead_by_name from ${APPS} where id = $1`,
          [appId],
        );
        if (rows[0]?.lead_by && rows[0].lead_by !== by.userId) otherLead = rows[0].lead_by_name ?? 'คนอื่น';
      }
      return { appId, existing, otherLead, otherJob: null as string | null };
    });
    out.push({
      candidate_id: id,
      name: row.full_name,
      outcome: res.otherLead || res.otherJob ? 'skipped' : res.existing ? 'existing' : 'added',
      application_id: res.appId,
      note: res.otherJob
        ? `สมัครงาน ${res.otherJob} มาแล้วภายใน 14 วัน — ดูที่แท็บผู้สมัคร`
        : res.otherLead
          ? `อยู่ในการติดต่อของ ${res.otherLead} แล้ว`
          : res.existing
            ? 'มีใบสมัครเบอร์นี้แล้ว ใช้ใบเดิม'
            : null,
    });
  }
  return out;
}
