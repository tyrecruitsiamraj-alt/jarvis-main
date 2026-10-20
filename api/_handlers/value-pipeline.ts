/**
 * `GET /api/value-pipeline?view=outcome|bottleneck|request|gaps&month=YYYY-MM[&job=<id>]`
 * หน้าความคุ้มค่า: ใบขอครบเส้น 4 แท็บ (เจ้าของ 19 ต.ค. 2569 · เห็นคนเดียว — สิทธิ์เดียวกับ /api/value-case)
 * ตัวคิดอยู่ `src/lib/valuePipeline.ts` · ที่นี่อ่านอย่างเดียว (Postgres · ERP · คิว Lumos) ไม่ส่งชื่อ/เบอร์ออกหน้าเว็บ
 * 🔴 ขั้นที่ยังไม่มีข้อมูลส่ง null — หน้าเว็บขึ้น "ยังไม่มีข้อมูล" ห้ามขึ้น 0
 */
import { withAuth, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { siamrajSqlQuery } from '../_lib/siamrajSqlServer.js';
import { activeInformWhereSql } from '../_lib/siamrajStaffingOpen.js';
import { canSeeValueCase, loadValueCaseInputs } from '../_lib/valueCaseStore.js';
import { loadOnlineRequestRows } from '../_lib/homeOnlineSql.js';
import { buildRecruitOverview, factsSql, toFact } from './recruit-overview.js';
import { readUnitRequestListThroughCache } from './siamraj-unit-requests.js';
import { getSiamrajUnitRequestById } from '../_lib/siamrajUnitRequests.js';
import { loadInformDaysByPhone, loadIrecruitApplicantDays } from '../_lib/applicantSourceSql.js';
import { effectiveNowSalary } from '../../src/lib/valueCase.js';
import { monthWindow } from '../../src/lib/recruitOverviewWindow.js';
import { buildRecruitJourney } from '../../src/lib/recruitJourney.js';
import {
  AI_ATTRIBUTION_DAYS,
  buildStageSla,
  computeOutcome,
  informedAfterAi,
  stuckByOwner,
} from '../../src/lib/valuePipeline.js';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes.js';

const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const APPS = tableInAppSchema('public_job_applications');
const POSTINGS = tableInAppSchema('recruit_postings');
const LINKS = tableInAppSchema('recruit_posting_links');
const FOLLOW = tableInAppSchema('follow_entries');
const K9 = (col: string) => `RIGHT(REPLACE(REPLACE(RTRIM(${col}), '-', ''), ' ', ''), 9)`;
const ALL = { mode: 'all' } as const;

const toBkkYmd = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
const shiftYmd = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** เวลาที่ AI โทรได้ผลต่อเบอร์ (ทุกงาน: สรรหา · จับคู่ · ติดตาม) ในช่วง */
async function loadAiCallTimes(fromYmd: string, toYmd: string, channel?: 'interview'): Promise<Map<string, number[]>> {
  const { rows } = await dbQuery<{ k: string | null; at: Date | string }>(
    `select right(regexp_replace(coalesce(payload->>'phone', payload->>'recipient_phone', ''), '\\D', '', 'g'), 9) as k,
            first_result_at as at
       from ${QUEUE}
      where first_result_at >= $1::date and first_result_at < $2::date
        ${channel ? `and channel = '${channel}'` : ''}`,
    [fromYmd, shiftYmd(toYmd, 1)],
  );
  const out = new Map<string, number[]>();
  for (const r of rows) {
    const k = String(r.k ?? '');
    if (!/^\d{9}$/.test(k)) continue;
    const list = out.get(k) ?? [];
    list.push(new Date(r.at).getTime());
    out.set(k, list);
  }
  return out;
}

async function loadInforms(fromYmd: string, toYmd: string): Promise<Array<{ phone9: string; day: string }>> {
  const rows = await siamrajSqlQuery<{ k: string | null; d: Date | string }>(
    `SELECT ${K9('r.mobile')} AS k, IH.inform_date AS d
       FROM hr_recruitment r INNER JOIN st_inform_head IH ON IH.inform_no = r.inform_no
      WHERE r.mobile IS NOT NULL AND ${activeInformWhereSql('IH')} AND IH.inform_date >= @from AND IH.inform_date < @to`,
    { from: fromYmd, to: shiftYmd(toYmd, 1) },
  );
  return rows.map((r) => ({ phone9: String(r.k ?? '').trim(), day: (r.d instanceof Date ? r.d.toISOString() : String(r.d)).slice(0, 10) }));
}

function monthOf(param: unknown, now: Date) {
  const w = monthWindow(param, toBkkYmd(now));
  return { month: w.month, from: w.from, to: w.to };
}

async function outcomeView(userSub: string, monthParam: unknown, now: Date) {
  const { month, from, to } = monthOf(monthParam, now);
  const [saved, aiCalls, aiRecruitCalls, informs, requests, overview] = await Promise.all([
    loadValueCaseInputs(userSub),
    loadAiCallTimes(shiftYmd(from, -AI_ATTRIBUTION_DAYS), to),
    // สายสรรหา/จับคู่เท่านั้น (ช่วยหาคน) — แยกจากสายติดตาม (ช่วยให้มาเริ่มงาน)
    loadAiCallTimes(shiftYmd(from, -AI_ATTRIBUTION_DAYS), to, 'interview'),
    loadInforms(from, to),
    loadOnlineRequestRows({ from, to, bu: null, departmentScope: ALL }),
    buildRecruitOverview(month, ALL, now),
  ]);
  const inputs = saved.inputs;
  const systemCost = inputs.systemCosts.reduce((n, c) => n + c.monthly, 0);
  const staffCost = inputs.nowStaff * effectiveNowSalary(inputs) + inputs.nowOt;
  const monthStart = Date.parse(`${from}T00:00:00+07:00`);
  const monthEnd = Date.parse(`${shiftYmd(to, 1)}T00:00:00+07:00`);
  let callsInMonth = 0;
  for (const list of aiCalls.values()) for (const t of list) if (t >= monthStart && t < monthEnd) callsInMonth += 1;
  const att = informedAfterAi(informs, aiCalls);
  const outcome = computeOutcome({
    month,
    aiCalls: callsInMonth,
    informed: att.informed,
    informedFromAi: att.fromAi,
    requestsIn: requests.length,
    requestsClosed: requests.filter((r) => r.remaining === 0 && r.filled > 0).length,
    systemCost,
    staffCost,
  });
  const cohort = (overview.apps ?? []).filter((f) => {
    const t = Date.parse(f.createdAt);
    return t >= monthStart && t < monthEnd;
  });
  const journey = buildRecruitJourney(cohort);
  const part = (step: string, key: string) => journey.find((s) => s.key === step)?.parts.find((p) => p.key === key)?.value ?? 0;
  const funnel = {
    names: cohort.length,
    aiCalled: part('names', 'aiCalled'),
    aiYes: part('ai', 'yes'),
    staffOk: part('staff', 'ok'),
    booked: part('appointment', 'booked'),
    showed: overview.attendanceEverRecorded ? part('attendance', 'showed') : null,
    informed: cohort.some((f) => f.informed == null) ? null : cohort.filter((f) => f.informed).length,
  };
  const fromRecruit = informedAfterAi(informs, aiRecruitCalls).fromAi;
  return {
    outcome,
    informedFromAiRecruit: fromRecruit,
    funnel,
    channels: overview.channelPlacement ?? null,
    inputsSaved: saved.updatedAt !== null,
  };
}

async function bottleneckView(monthParam: unknown, now: Date) {
  const { month, from, to } = monthOf(monthParam, now);
  const [overview, requests, list] = await Promise.all([
    buildRecruitOverview(month, ALL, now),
    loadOnlineRequestRows({ from, to, bu: null, departmentScope: ALL }),
    readUnitRequestListThroughCache({ limit: 500, departmentScope: ALL }).then((o) => o.value as Array<Record<string, unknown>>),
  ]);
  const monthStart = Date.parse(`${from}T00:00:00+07:00`);
  const monthEnd = Date.parse(`${shiftYmd(to, 1)}T00:00:00+07:00`);
  // ใบขอที่ปิดแล้วไม่ใช่งานค้าง (เจ้าของ "ถ้าปิดก็คือปิด") — ผู้สมัครที่ผูกใบปิดไม่นับ · ไม่ผูกใบขอยังนับ
  const openIds = new Set(list.map((j) => String(j.id ?? '')));
  const facts = (overview.apps ?? []).filter((f) => {
    const t = Date.parse(f.createdAt);
    return t >= monthStart && t < monthEnd && (!f.jobId || openIds.has(f.jobId));
  });
  const stages = buildStageSla(facts, requests, now.getTime());
  const ownerOfJob = new Map<string, string>();
  const labelOfJob = new Map<string, string>();
  for (const j of list) {
    const id = String(j.id ?? '');
    if (!id) continue;
    const owner = String(j.recruiter_name ?? '').trim();
    if (owner) ownerOfJob.set(id, owner);
    labelOfJob.set(id, `${String(j.request_no ?? '')} · ${String(j.work_site_name ?? j.unit_name ?? '')}`.trim());
  }
  // ใบที่ค้างเยอะสุด — นับใบสมัครที่ค้างเกิน 24 ชม. ต่อใบขอ แยกขั้น
  const jobOf = new Map(facts.map((f) => [f.id ?? '', f.jobId]));
  const perJob = new Map<string, { stuck: number; byStage: Map<string, number> }>();
  for (const s of stages) {
    for (const id of s.stuckIds) {
      const job = jobOf.get(id);
      if (!job) continue;
      const cur = perJob.get(job) ?? { stuck: 0, byStage: new Map<string, number>() };
      cur.stuck += 1;
      cur.byStage.set(s.label, (cur.byStage.get(s.label) ?? 0) + 1);
      perJob.set(job, cur);
    }
  }
  // ป้ายขั้น = ขั้นที่ใบนั้นค้างมากสุด
  const topStage = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const worstJobs = [...perJob.entries()]
    .map(([jobId, v]) => ({ jobId, label: labelOfJob.get(jobId) ?? jobId, stuck: v.stuck, stage: topStage(v.byStage), owner: ownerOfJob.get(jobId) ?? null }))
    .sort((a, b) => b.stuck - a.stuck)
    .slice(0, 10);
  return {
    month,
    openRequests: list.filter((j) => !j.is_prequest).length,
    stages: stages.map(({ stuckIds, ...s }) => ({ ...s, stuckIds: stuckIds.slice(0, 500) })),
    owners: stuckByOwner(stages, facts, ownerOfJob),
    worstJobs,
  };
}

async function requestView(jobId: string, now: Date) {
  const job = (await getSiamrajUnitRequestById(jobId, undefined, { includeClosed: true })) as Record<string, unknown> | null;
  if (!job) return null;
  const requestNo = String(job.request_no ?? '').trim();
  const tomorrow = shiftYmd(toBkkYmd(now), 1);
  const [factsR, informs, links] = await Promise.all([
    dbQuery<Record<string, unknown>>(`select * from (${factsSql()}) x where x.job_id = $4`, ['2025-01-01T00:00:00+07:00', `${tomorrow}T00:00:00+07:00`, null, jobId]),
    requestNo
      ? siamrajSqlQuery<{ d: Date | string }>(
          `SELECT IH.inform_date AS d FROM st_inform_head IH WHERE IH.request_no = @no AND ${activeInformWhereSql('IH')}`,
          { no: requestNo },
        )
      : Promise.resolve([]),
    dbQuery<{ label: string | null; created_at: Date | string; apps: number }>(
      `select coalesce(nullif(btrim(l.channel_label), ''), '') as label, l.created_at,
              (select count(*)::int from ${APPS} a where a.link_id = l.id) as apps
         from ${LINKS} l join ${POSTINGS} p on p.id = l.posting_id
        where p.job_id = $1 order by l.created_at`,
      [jobId],
    ).catch(() => ({ rows: [] as Array<{ label: string | null; created_at: Date | string; apps: number }> })),
  ]);
  // ผูก iRecruit/ERP ด้วยเบอร์ (20 ต.ค. 2569) — อ่านไม่ได้ = ไม่รู้ (ไม่ล้มทั้งหน้า)
  const [informDays, irApplicants] = await Promise.all([
    loadInformDaysByPhone('2025-01-01').catch(() => null),
    loadIrecruitApplicantDays('2025-01-01').catch(() => null),
  ]);
  const facts: RecruitAppFact[] = factsR.rows.map((r) =>
    toFact(r, null, { informDays, irecruitRegs: null, irecruitApplicants: irApplicants }),
  );
  const firstLink = links.rows[0] ? new Date(links.rows[0].created_at).toISOString() : null;
  const requestDay = String(job.request_date ?? '').slice(0, 10);
  const stages = buildStageSla(
    facts,
    /^\d{4}-\d{2}-\d{2}$/.test(requestDay) ? [{ jobId, day: requestDay, releasedAt: firstLink, remaining: 1, filled: 0 }] : [],
    now.getTime(),
  );
  // เจ้าของงานอยู่ที่ตารางมอบหมาย (มากับรายการใบขอ) — ใบเดี่ยวไม่มี
  const listed = ((await readUnitRequestListThroughCache({ limit: 500, departmentScope: ALL })).value as Array<Record<string, unknown>>).find(
    (j) => String(j.id ?? '') === jobId,
  );
  return {
    job: {
      id: jobId,
      requestNo,
      unit: String(job.work_site_name ?? job.unit_name ?? ''),
      position: String(job.job_description_code_1 ?? job.staff_title_name ?? ''),
      requested: Number(job.position_units ?? job.request_qty ?? 0) || null,
      status: String(job.status ?? ''),
      requestDate: String(job.request_date ?? ''),
      owner: String(listed?.recruiter_name ?? job.recruiter_name ?? '') || null,
    },
    informed: informs.length,
    applications: facts.length,
    stages: stages.map(({ stuckIds, ...s }) => ({ ...s, stuckIds })),
    links: links.rows.map((l) => ({ label: l.label || null, createdAt: new Date(l.created_at).toISOString(), apps: Number(l.apps) || 0 })),
  };
}

async function gapsView(monthParam: unknown, now: Date) {
  const { month, from, to } = monthOf(monthParam, now);
  const [links, overview, follow] = await Promise.all([
    dbQuery<{ total: number; with_channel: number }>(
      `select count(*)::int as total, count(*) filter (where channel_id is not null or coalesce(btrim(channel_label), '') <> '')::int as with_channel from ${LINKS}`,
    ).catch(() => ({ rows: [{ total: 0, with_channel: 0 }] })),
    buildRecruitOverview(month, ALL, now),
    dbQuery<{ n: number }>(`select count(*)::int as n from ${FOLLOW} where created_at >= $1::date and created_at < $2::date`, [from, shiftYmd(to, 1)]),
  ]);
  const monthStart = Date.parse(`${from}T00:00:00+07:00`);
  const monthEnd = Date.parse(`${shiftYmd(to, 1)}T00:00:00+07:00`);
  const facts = (overview.apps ?? []).filter((f) => {
    const t = Date.parse(f.createdAt);
    return t >= monthStart && t < monthEnd;
  });
  const due = facts.filter((f) => f.appointmentAt && Date.parse(f.appointmentAt) < now.getTime());
  const unknownChannel = overview.channelPlacement?.rows.find((r) => r.channel === 'ไม่รู้ช่องทาง')?.placed ?? null;
  return {
    month,
    linksTotal: links.rows[0]?.total ?? 0,
    linksWithChannel: links.rows[0]?.with_channel ?? 0,
    appointmentsDue: due.length,
    appointmentsNoResult: due.filter((f) => f.attendance !== 'showed' && f.attendance !== 'no_show').length,
    // นัดเลยวันแล้วยังไม่ลงผล แต่เบอร์ไปโผล่เป็นผู้สมัครใน iRecruit = น่าจะมาแล้ว แค่ไม่มีคนลงผล
    appointmentsLikelyCame: due.filter((f) => f.attendance !== 'showed' && f.attendance !== 'no_show' && f.irecruitAt).length,
    showed: facts.filter((f) => f.attendance === 'showed').length,
    screened: facts.filter((f) => f.screening === 'passed' || f.screening === 'not_passed').length,
    applicants: facts.length,
    applicantsInformed: facts.some((f) => f.informed == null) ? null : facts.filter((f) => f.informed).length,
    followAdded: follow.rows[0]?.n ?? 0,
    informedTotal: overview.channelPlacement?.informed ?? null,
    informedUnknownChannel: unknownChannel,
  };
}

async function handler(req: AuthedReq, res: ApiRes) {
  if (!canSeeValueCase(req.user)) return sendError(res, 404, 'Not found');
  if ((req.method || 'GET').toUpperCase() !== 'GET') return sendError(res, 405, 'Method not allowed');
  const view = typeof req.query?.view === 'string' ? req.query.view : 'outcome';
  const month = typeof req.query?.month === 'string' ? req.query.month : undefined;
  const now = new Date();
  try {
    res.setHeader?.('Cache-Control', 'no-store');
    if (view === 'outcome') return res.status(200).json(await outcomeView(req.user.sub, month, now));
    if (view === 'bottleneck') return res.status(200).json(await bottleneckView(month, now));
    if (view === 'gaps') return res.status(200).json(await gapsView(month, now));
    if (view === 'request') {
      const job = typeof req.query?.job === 'string' ? req.query.job.trim() : '';
      if (!job) return sendError(res, 400, 'Bad request', 'ต้องระบุใบขอ');
      const body = await requestView(job, now);
      if (!body) return sendError(res, 404, 'Not found', 'ไม่พบใบขอ');
      return res.status(200).json(body);
    }
    return sendError(res, 400, 'Bad request', 'view ไม่ถูกต้อง');
  } catch (e) {
    return handleApiError(res, e, 'value-pipeline', { userId: req.user?.sub });
  }
}

export default withAuth(handler);
