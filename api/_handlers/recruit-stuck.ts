/**
 * ═══ GET /api/recruit-stuck — ใบขอที่ยังต้องหา ติดตรงไหน + เทียบเดือน (หน้าภาพรวมงานสรรหาโฉมใหม่ · เจ้าของ 4 พ.ย. 2569) ═══
 *
 * > *"ใบขอมา มาแล้วไปประกาศแล้ว แต่ปิดไม่ได้เพราะไม่มีคนนะ หรือ มีคนแต่คนไม่โทรนะ หรือ ปิดไม่ได้เพราะไม่ได้โพสต์ด้วยซ้ำ
 * > แล้วต้องบอกเลยว่า อ้อใบนี้ของใครรับผิดชอบบ้าง ช้าที่ใครเท่าไหร่"*
 *
 * อ่านอย่างเดียว · ส่งข้อเท็จจริงต่อใบ (`StuckRequest`) ตัวตัดสินเหตุอยู่ที่เดียว `src/lib/recruitStuck.ts`
 * - ใบขอ = ใบที่ยังเปิดชุดเดียวกับเมนูใบขอ (`readUnitRequestListThroughCache` · ขอบเขตแผนก + BU เดียวกับภาพรวม)
 * - คน = `loadFactsForJobs` ทุกช่วงเวลาของใบ (นิยามเดียวกับภาพรวม/เส้น 12 ขั้น) · ประกาศ = `job_public_releases` · ลิงก์ = `recruit_posting_links`
 * - โพสต์ = คำสั่ง Autopost ล่าสุดของใบ (`listLatestJobPostingsForBoard`)
 * - เทียบเดือน = ต่อ (เดือน, ใบขอ) ย้อน 6 เดือน ให้หน้าเว็บรวมเฉพาะใบที่ผ่านตัวกรอง (รวมทุกใบ = ยอดเดิม)
 * ก้อนไหนอ่านไม่ได้ = null + เหตุ (ห้ามส่ง 0 แทน)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { loadMatchingBuScope, loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { pickDashboardBuSet, appBuJoin, buMatchSql, appBuSql } from '../_lib/homeBuSql.js';
import { logError } from '../_lib/logger.js';
import { readUnitRequestListThroughCache } from './siamraj-unit-requests.js';
import { loadFactsForJobs } from './recruit-overview.js';
import { listLatestJobPostingsForBoard } from '../_lib/jobPostingRequests.js';
import { loadOnlineRequestRows } from '../_lib/homeOnlineSql.js';
import { loadInformDaysByPhone } from '../_lib/applicantSourceSql.js';
import { informedSince, phone9Of } from '../../src/lib/applicantSourceMatch.js';
import { countsOf } from '../../src/lib/requestPipeline.js';
import { getJobRequestAgeDays } from '../../src/lib/jobUrgency.js';
import { boardProvinceOf, drivingSubtypeOf, UNSPECIFIED } from '../../src/lib/boardFilters.js';
import { districtMatcherFor } from '../../src/lib/districtMatch.js';
import { getDistrictOptionsForProvince } from '../../src/lib/thaiDistricts.js';
import { publicJobTitle } from '../../src/lib/publicJobTitle.js';
import { jobUnitSectorOf } from '../../src/lib/unitRequestDisplay.js';
import { requestSectorOf } from '../../src/lib/recruitRequestTab.js';
import { toBangkokYmd } from '../_lib/businessDate.js';
import { APPOINTMENT_AT_SQL } from '../_lib/applicantOverviewSql.js';
import { stuckReasonOf, type StuckMonthlyRow, type StuckPostStatus, type StuckRequest } from '../../src/lib/recruitStuck.js';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes.js';
import type { JobRequest } from '../../src/types/index.js';

const RELEASES = tableInAppSchema('job_public_releases');
const POSTINGS = tableInAppSchema('recruit_postings');
const LINKS = tableInAppSchema('recruit_posting_links');
const APPS = tableInAppSchema('public_job_applications');
const CANCELLATIONS = tableInAppSchema('application_cancellations');
const MONTHS_BACK = 6;

export type RecruitStuckResponse = {
  generatedAt: string;
  today: string;
  bu: string | null;
  requests: StuckRequest[] | null;
  monthly: StuckMonthlyRow[] | null;
  errors: Partial<Record<'requests' | 'monthly', string>>;
};

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const POST_STATUSES: StuckPostStatus[] = ['pending', 'in_progress', 'posted', 'completed', 'filled', 'cancelled', 'rejected'];

/** จังหวัด/อำเภอ/ตำบลของใบ — กติกาเดียวกับตัวกรองกล่องงาน (ที่ทีมพิมพ์ › อ่านจากที่อยู่) */
function placeOf(job: JobRequest): { province: string | null; district: string | null; subdistrict: string | null } {
  const prov = boardProvinceOf(job);
  const province = prov && prov !== UNSPECIFIED ? prov : null;
  const typed = (job.override_district ?? '').trim();
  let district: string | null = typed || null;
  if (!district && province) {
    const matches = districtMatcherFor(job.location_address || '');
    district = getDistrictOptionsForProvince(province).find(matches) ?? null;
  }
  return { province, district, subdistrict: text(job.override_subdistrict) };
}

export async function buildRecruitStuck(user: AuthedReq['user'], requestedBu: unknown, now = new Date()): Promise<RecruitStuckResponse> {
  const [departmentScope, buScope] = await Promise.all([loadUserDepartmentScope(user), loadMatchingBuScope(user)]);
  const picked = pickDashboardBuSet(buScope, requestedBu);
  const buSet = picked.buSet;
  const body: RecruitStuckResponse = { generatedAt: now.toISOString(), today: toBangkokYmd(now), bu: picked.bu, requests: null, monthly: null, errors: {} };
  if (buScope.mode === 'none') return body;

  const [reqR, monR] = await Promise.allSettled([loadStuckRequests(departmentScope, buSet, now), loadMonthly(departmentScope, buSet, body.today)]);
  if (reqR.status === 'fulfilled') body.requests = reqR.value;
  else {
    logError('recruit-stuck: requests', reqR.reason);
    body.errors.requests = 'อ่านใบขอที่ยังต้องหาไม่ได้';
  }
  if (monR.status === 'fulfilled') body.monthly = monR.value;
  else {
    logError('recruit-stuck: monthly', monR.reason);
    body.errors.monthly = 'อ่านยอดรายเดือนไม่ได้';
  }
  return body;
}

async function loadStuckRequests(departmentScope: Awaited<ReturnType<typeof loadUserDepartmentScope>>, buSet: readonly string[] | null, now: Date): Promise<StuckRequest[]> {
  const all = (await readUnitRequestListThroughCache({ limit: 500, departmentScope })).value as unknown as JobRequest[];
  const jobs = all.filter((j) => j.status === 'open' && (buSet === null || (j.department_code != null && buSet.includes(j.department_code))));
  const jobIds = jobs.map((j) => String(j.id));
  if (jobIds.length === 0) return [];
  const [facts, releases, links, postings] = await Promise.all([
    loadFactsForJobs(jobIds, null),
    dbQuery<{ job_id: string; at: string | Date; who: string | null }>(
      `select job_id, min(released_at) as at, max(released_by_name) as who from ${RELEASES} where job_id = any($1::text[]) group by job_id`,
      [jobIds],
    ),
    dbQuery<{ job_id: string; n: number }>(
      `select p.job_id, count(l.id)::int as n from ${POSTINGS} p join ${LINKS} l on l.posting_id = p.id where p.job_id = any($1::text[]) and p.status = 'open' group by p.job_id`,
      [jobIds],
    ),
    listLatestJobPostingsForBoard(),
  ]);
  const factsBy = new Map<string, RecruitAppFact[]>();
  for (const f of facts) {
    if (!f.jobId) continue;
    const list = factsBy.get(f.jobId);
    if (list) list.push(f);
    else factsBy.set(f.jobId, [f]);
  }
  const relBy = new Map(releases.rows.map((r) => [r.job_id, r]));
  const linkBy = new Map(links.rows.map((r) => [r.job_id, Number(r.n)]));
  const postBy = new Map<string, StuckPostStatus>();
  for (const p of postings) if (p.request_type === 'content' && POST_STATUSES.includes(p.status as StuckPostStatus) && !postBy.has(p.job_id)) postBy.set(p.job_id, p.status as StuckPostStatus);

  return jobs.map((j) => {
    const id = String(j.id);
    const fs = factsBy.get(id) ?? [];
    const counts = countsOf(fs, 0, 0);
    const requested = Number(j.request_positions ?? j.position_units ?? 0) || 0;
    const filled = Number(j.filled_positions ?? 0) || 0;
    const cancelled = Number(j.cancelled_positions ?? 0) || 0;
    const rel = relBy.get(id);
    const signals = {
      released: Boolean(rel),
      links: linkBy.get(id) ?? 0,
      post: postBy.get(id) ?? null,
      counts,
      uncalled: fs.filter((f) => !f.calledByAi && !f.calledByStaff).length,
      queued: fs.filter((f) => f.aiQueued).length,
    };
    const place = placeOf(j);
    const subtype = drivingSubtypeOf(j);
    return {
      requestNo: String(j.request_no ?? id),
      jobId: id,
      day: String(j.request_date ?? '').slice(0, 10),
      unitName: text(j.work_site_name) ?? text(j.unit_name),
      position: text(publicJobTitle(j)),
      siteCode: text(j.site_code),
      siteName: text(j.work_site_name),
      sector: requestSectorOf(null, null, jobUnitSectorOf(j)),
      province: place.province,
      district: place.district,
      subdistrict: place.subdistrict,
      leadKind: null,
      subtype: subtype === UNSPECIFIED ? null : subtype,
      requested,
      filled,
      cancelled,
      remaining: Math.max(0, requested - filled - cancelled),
      released: signals.released,
      applications: counts.apps,
      recruiter: text(j.recruiter_name),
      ageDays: getJobRequestAgeDays(j),
      bu: text(j.department_code),
      screener: text(j.screener_name),
      signals,
      reason: stuckReasonOf(signals),
      releasedAt: rel ? (rel.at instanceof Date ? rel.at.toISOString() : String(rel.at)) : null,
      releasedBy: rel ? text(rel.who) : null,
      // ไม่ใช่ใบที่ยังเปิด = ไม่อยู่ในรายการนี้อยู่แล้ว (ตัดจาก status ข้างบน) — ค่าในแถวใช้กับ `onlineRequestStateOf` ได้
    } satisfies StuckRequest & { ageDays: number | null };
  }).filter((r) => r.remaining > 0 || r.signals.counts.apps > 0 || !r.released);
}

const monthOf = (ymd: string) => ymd.slice(0, 7);
function monthsBack(today: string, n: number): string {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1 - n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
}

/** ยอดต่อ (เดือน, ใบขอ) ย้อน 6 เดือน — ใบขอเข้ามา · รายชื่อที่กรอก · นัดได้ · ได้ลงงาน (แจ้งเข้า ERP หลังวันกรอก) */
async function loadMonthly(departmentScope: Awaited<ReturnType<typeof loadUserDepartmentScope>>, buSet: readonly string[] | null, today: string): Promise<StuckMonthlyRow[]> {
  const from = monthsBack(today, MONTHS_BACK - 1);
  const acc = new Map<string, StuckMonthlyRow>();
  const row = (month: string, jobId: string) => {
    const k = `${month}|${jobId}`;
    let r = acc.get(k);
    if (!r) {
      r = { month, jobId, requests: 0, apps: 0, booked: 0, informed: 0 };
      acc.set(k, r);
    }
    return r;
  };
  const [reqs, apps, informs] = await Promise.all([
    loadOnlineRequestRows({ from, to: today, bu: buSet, departmentScope }),
    dbQuery<{ id: string; job_id: string | null; day: string; phone: string | null; booked: boolean }>(
      `select a.id::text as id, a.job_id, to_char(timezone('Asia/Bangkok', a.created_at), 'YYYY-MM-DD') as day, a.phone_e164 as phone,
              ((${APPOINTMENT_AT_SQL}) is not null) as booked
         from ${APPS} a ${appBuJoin('a')}
        where not coalesce(a.is_lead, false)
          and not exists (select 1 from ${CANCELLATIONS} cx where cx.application_id = a.id)
          and a.created_at >= ($1::date::timestamp at time zone 'Asia/Bangkok')
          and ${buMatchSql(appBuSql('a'), '$2')}`,
      [from, buSet],
    ).then((r) => r.rows),
    loadInformDaysByPhone(from).catch((e) => {
      logError('recruit-stuck: informs', e);
      return null;
    }),
  ]);
  for (const r of reqs) row(monthOf(r.day), r.jobId ?? '').requests += 1;
  for (const a of apps) {
    const r = row(monthOf(a.day), a.job_id ?? '');
    r.apps += 1;
    if (a.booked) r.booked += 1;
    if (informs && informedSince(informs, phone9Of(a.phone), `${a.day}T00:00:00+07:00`) === true) r.informed += 1;
  }
  return [...acc.values()].sort((a, b) => a.month.localeCompare(b.month) || a.jobId.localeCompare(b.jobId));
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const body = await buildRecruitStuck(req.user, req.query?.bu);
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    return handleApiError(res, e, 'recruit-stuck', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
