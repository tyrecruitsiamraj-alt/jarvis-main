/**
 * GET /api/home-overview?bu= — ก้อน 1 + ก้อน 3 ของหน้าหลักโฉม 3 ก้อน (29 ก.ย. 2569 · อ่านอย่างเดียว)
 *
 * เจ้าของ: *"ในหน้าหลักตอนนี้มันปน มันงงไปหมด"* → Choice "จัดใหม่ 3 ก้อน" · แผน `docs/plan-home-v3-2569-09-29.md`
 *
 * - **ก้อน 1 ผลงานเดือนนี้ (อัตรา)** — `activityLedger` + สำเนา ERP **ก้อนเดียวกับแท็บ Dashboard**
 *   (`loadRequestTrendPayload` · วันเริ่มเดียวกัน ⇒ ไม่ยิง ERP เพิ่ม) + ยอดหัวกล่องงานจาก feed เดียวกับกล่องงาน
 * - **ก้อน 3 วันนี้ท่อเดินแค่ไหน** — นับเป็นคน (เบอร์ไม่ซ้ำ) · นิยามอยู่ `src/lib/homeOverview.ts` ที่เดียว
 * - ก้อน 2 (ของค้าง) + ก้อน 4 (บอร์ดทีม) ไม่อยู่ในเส้นนี้ — ใช้เส้นเดิม + พารามิเตอร์ `bu` (นิยามเดิมทุกตัว)
 *
 * 🔴 กติกา:
 * 1. BU กลาง = ชุดรหัสแผนก (`parseBuParam`) · ผู้ใช้ถูกล็อกแผนก = BU ของตัวเองเสมอ (ไม่สนพารามิเตอร์)
 * 2. ขอบเขต = `loadMatchingBuScope` (ชุดเดียวกับ office-team / flow-summary ที่หน้าหลักใช้อยู่)
 * 3. ตัวนับล้วน ไม่คืนข้อมูลบุคคล ⇒ `withAuth` (เหมือน office-floor / home-kpis)
 * 4. ก้อนล้มแยกกัน — ERP ล่ม = ก้อน 1 เป็น null + บอกเหตุ ก้อน 3 ยังขึ้น (ห้าม 0 ปลอม)
 */
import { withAuth, sendError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { respondServiceError } from '../_lib/domainErrors.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { loadMatchingBuScope, type DepartmentScope } from '../_lib/departmentScope.js';
import { listSiamrajUnitRequests } from '../_lib/siamrajUnitRequests.js';
import { PREQUEST_ID_PREFIX } from '../_lib/siamrajSqlServerPrequests.js';
import { loadRequestTrendPayload, requestTrendDataFrom } from '../_lib/requestTrendRows.js';
import { toBangkokYmd } from '../_lib/businessDate.js';
import { queueLastResultAt, queueOutcome, queueReplySql } from '../_lib/lumosQueueDefs.js';
import { appBuJoin, appBuSql, followBuJoin, followBuSql, parseBuParam, queueBuJoins, queueBuSql } from '../_lib/homeBuSql.js';
import { logWarn } from '../_lib/logger.js';
import { activityLedger } from '../../src/lib/trends/requestTrends.js';
import { normalizeTrendBu, trendBuFromSiteCode, trendBuLabel } from '../../src/lib/trends/bu.js';
import { sumJobPositionUnits } from '../../src/lib/jobPositionUnits.js';
import { FOLLOW_OUTCOME_SUCCESS } from '../../src/lib/followOutcome.js';
import {
  aiCallSteps,
  buildMonthResult,
  countTodaySteps,
  staffContactSteps,
  type HomeBuOption,
  type HomeMonthResult,
  type HomeOverview,
  type HomeTodayEvent,
  type HomeTodayFunnel,
} from '../../src/lib/homeOverview.js';
import type { JobRequest } from '@/types';

const APPS = tableInAppSchema('public_job_applications');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const CONTACTS = tableInAppSchema('application_contact_logs');
const FOLLOW = tableInAppSchema('follow_entries');

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; body: HomeOverview }>();

const addDaysYmd = (ymd: string, days: number): string =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const jobBu = (j: { site_code?: unknown }) => trendBuFromSiteCode(String(j.site_code ?? ''));

/** ตัวเลือก BU = ใบเปิดตามสิทธิ์ แยก BU กลาง (เหลือหาเป็นอัตรา · ตัวเดียวกับหัวกล่องงาน) */
export function buildBuOptions(feed: readonly JobRequest[]): { options: HomeBuOption[]; unknown: number } {
  const by = new Map<string, JobRequest[]>();
  let unknown = 0;
  for (const j of feed) {
    const bu = jobBu(j);
    if (!bu) {
      unknown += 1;
      continue;
    }
    const list = by.get(bu) ?? [];
    list.push(j);
    by.set(bu, list);
  }
  const options = [...by.entries()]
    .map(([bu, jobs]) => ({ bu, label: trendBuLabel(bu), remaining: sumJobPositionUnits(jobs), openJobs: jobs.length }))
    .sort((a, b) => b.remaining - a.remaining || a.bu.localeCompare(b.bu));
  return { options, unknown };
}

/** ก้อน 1 — ผลงานเดือนนี้ (อัตรา) */
export async function loadResult(bu: string | null, feed: readonly JobRequest[]): Promise<HomeMonthResult> {
  const today = toBangkokYmd(new Date());
  const monthFrom = `${today.slice(0, 8)}01`;
  // 🔴 ปลายช่วง = วันนี้ + 183 วัน (ใบล่วงหน้า) — ตัวเดียวกับแท็บ Dashboard · ตัดที่วันนี้ = หาย 54 ใบ 72 อัตรา (วัด 29 ก.ย.)
  const payload = await loadRequestTrendPayload(requestTrendDataFrom(today), addDaysYmd(today, 183), (b) => !bu || b === bu);
  const ledger = activityLedger(payload.requests, payload.informs, { from: monthFrom, to: today }, 'month');
  const pre = feed.filter((j) => String(j.id).startsWith(PREQUEST_ID_PREFIX));
  return buildMonthResult(
    ledger,
    { open: sumJobPositionUnits([...feed]), pre: sumJobPositionUnits(pre) },
    { monthFrom, today, source: payload.source, ageSeconds: payload.ageSeconds },
  );
}

/** คำตอบของผู้สมัครในสาย + เวลาของผลล่าสุด — ตัวกลาง `lumosQueueDefs` */
const REPLY_SQL = queueReplySql('q');
const LAST_RESULT_AT = queueLastResultAt('q');
const bkkDay = (col: string) => `to_char(timezone('Asia/Bangkok', ${col}), 'YYYY-MM-DD')`;

/** export ไว้ให้เทสต์อ่านโครงคิวรี — `bu` true = ต่อ join/where ของ BU กลาง (พารามิเตอร์ตัวสุดท้าย) */
export function todaySql(bu: boolean): { applied: string; aiCalls: string; staff: string; arrived: string } {
  return {
    applied: `select coalesce(nullif(btrim(a.phone_e164), ''), 'app:' || a.id::text) as who, ${bkkDay('a.created_at')} as day
        from ${APPS} a ${appBuJoin('a')}
       where a.created_at >= $1::timestamptz${bu ? ` and ${appBuSql('a')} = $2` : ''}`,
    aiCalls: `select coalesce(q.payload->>'recipient_phone', q.payload->>'phone', 'q:' || q.id::text) as who,
             ${bkkDay(LAST_RESULT_AT)} as day, q.person_ref, ${queueOutcome('q')} as outcome,
             q.result->>'summary' as summary, ${REPLY_SQL} as reply
        from ${QUEUE} q ${bu ? queueBuJoins('q') : ''}
       where not (q.job_ref = 'follow' or q.person_ref like 'follow-%')
         and ${queueOutcome('q')} is not null
         and ${LAST_RESULT_AT} >= $1::timestamptz${bu ? ` and ${queueBuSql('q')} = $2` : ''}`,
    staff: `select coalesce(nullif(btrim(a.phone_e164), ''), 'app:' || a.id::text) as who, ${bkkDay('c.created_at')} as day,
             coalesce(c.ok, false) as ok, (c.appointment_at is not null) as has_appt
        from ${CONTACTS} c
        join ${APPS} a on a.id = c.application_id
        ${appBuJoin('a')}
       where c.created_at >= $1::timestamptz${bu ? ` and ${appBuSql('a')} = $2` : ''}`,
    arrived: `select coalesce(nullif(btrim(f.recipient_phone), ''), 'follow:' || f.id::text) as who, ${bkkDay('f.completed_at')} as day
        from ${FOLLOW} f ${followBuJoin('f')}
       where f.cancelled_at is null
         and f.outcome_code = any($2::text[])
         and f.completed_at >= $1::timestamptz${bu ? ` and ${followBuSql('f')} = $3` : ''}`,
  };
}

/** ก้อน 3 — วันนี้ท่อเดินแค่ไหน (เทียบเมื่อวาน · นับเป็นคน) */
export async function loadToday(bu: string | null): Promise<HomeTodayFunnel> {
  const day = toBangkokYmd(new Date());
  const yesterday = addDaysYmd(day, -1);
  const since = `${yesterday}T00:00:00+07:00`;
  const sql = todaySql(!!bu);
  const p = bu ? [since, bu] : [since];
  type Who = { who: string; day: string };
  const [applied, ai, staff, arrived] = await Promise.all([
    dbQuery<Who>(sql.applied, p),
    dbQuery<Who & { person_ref: string; outcome: string | null; summary: string | null; reply: string | null }>(sql.aiCalls, p),
    dbQuery<Who & { ok: boolean; has_appt: boolean }>(sql.staff, p),
    dbQuery<Who>(sql.arrived, bu ? [since, [...FOLLOW_OUTCOME_SUCCESS], bu] : [since, [...FOLLOW_OUTCOME_SUCCESS]]),
  ]);
  const events: HomeTodayEvent[] = [];
  for (const r of applied.rows) events.push({ step: 'applied', day: r.day, who: r.who });
  for (const r of ai.rows) {
    for (const step of aiCallSteps({ outcome: r.outcome, summary: r.summary, reply: r.reply, personRef: r.person_ref })) {
      events.push({ step, day: r.day, who: r.who });
    }
  }
  for (const r of staff.rows) {
    for (const step of staffContactSteps({ ok: !!r.ok, hasAppointment: !!r.has_appt })) {
      events.push({ step, day: r.day, who: r.who });
    }
  }
  for (const r of arrived.rows) events.push({ step: 'arrived', day: r.day, who: r.who });
  return { day, yesterday, steps: countTodaySteps(events, day, yesterday) };
}

const settle = <T,>(p: Promise<T>) =>
  p.then(
    (v) => ({ ok: true as const, v }),
    (e: unknown) => ({ ok: false as const, e }),
  );

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'Read-only');
  }
  try {
    const scope: DepartmentScope = await loadMatchingBuScope(req.user);
    const forcedBu = scope.mode === 'code' ? normalizeTrendBu(scope.code) : null;
    const bu = scope.mode === 'code' ? forcedBu : parseBuParam(req.query?.bu);
    const cacheKey = JSON.stringify([scope, bu]);
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.body);

    const base: HomeOverview = {
      generated_at: new Date().toISOString(),
      scope: scope.mode,
      forced_bu: forcedBu,
      bu,
      bu_options: [],
      unknown_bu_jobs: 0,
      result: null,
      today: null,
      errors: {},
    };
    if (scope.mode === 'none') {
      base.errors = { result: 'บัญชีนี้ยังไม่ได้ผูกแผนก — ยังดูตัวเลขไม่ได้', today: 'บัญชีนี้ยังไม่ได้ผูกแผนก — ยังดูตัวเลขไม่ได้' };
      return res.status(200).json(base);
    }

    const feedAll = (await listSiamrajUnitRequests({ limit: 500, departmentScope: scope })) as JobRequest[];
    const { options, unknown } = buildBuOptions(feedAll);
    const feed = bu ? feedAll.filter((j) => jobBu(j) === bu) : feedAll;

    const [resultR, todayR] = await Promise.all([settle(loadResult(bu, feed)), settle(loadToday(bu))]);
    const body: HomeOverview = {
      ...base,
      bu_options: options,
      unknown_bu_jobs: unknown,
      result: resultR.ok ? resultR.v : null,
      today: todayR.ok ? todayR.v : null,
      errors: {},
    };
    if (!resultR.ok) {
      body.errors.result = 'อ่านใบขอจาก ERP ไม่ได้ตอนนี้';
      logWarn('home-overview: ก้อนผลงานเดือนนี้อ่านไม่ได้', { reason: resultR.e instanceof Error ? resultR.e.message : String(resultR.e) });
    }
    if (!todayR.ok) {
      body.errors.today = 'อ่านตัวเลขวันนี้ไม่ได้';
      logWarn('home-overview: ก้อนวันนี้อ่านไม่ได้', { reason: todayR.e instanceof Error ? todayR.e.message : String(todayR.e) });
    }
    cache.set(cacheKey, { at: Date.now(), body });
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    respondServiceError(res, e, 'home-overview GET', { userId: req.user.sub });
  }
}

export default withAuth(handler);
