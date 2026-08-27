/**
 * GET /api/office-team — เมตริกบอร์ด 4 ทีมบนหน้าแรก (read-only)
 *
 * 🔴 **สเปกเมตริกมาจากเจ้าของโดยตรง** (พิมพ์เองทีมต่อทีม 26 ส.ค. 2569 และยืนยันว่า
 * "โอเคกะแบบนั้น") — ดูตารางเมตริก→แหล่งข้อมูลใน
 * `~/.claude/plans/home-team-board-redesign.md` H2 · ตัววาด `TeamBoardPanel.tsx`
 *
 * หลักที่เจ้าของสั่ง: **Error ไม่เงียบ** — ทีมไหนวัดไม่ได้ต้องไปโผล่ใน `teams.errors`
 * ให้จอวาด "วัดไม่ได้ — เหตุผล" ห้ามโชว์ 0 ปลอม ห้ามซ่อนทั้งคอลัมน์
 *
 * แหล่งข้อมูล (pg ทั้งหมด ยกเว้นลิสต์ใบเปิด):
 * - ใบเปิด: `listSiamrajUnitRequests` **ท่อเดียวกับ flow-summary/หน้า Matching**
 *   (นิยาม "เปิดอยู่" ห้ามมีที่สอง) · จำกัดตาม departmentScope เหมือนเส้นอื่น
 * - ประกาศสาธารณะ: `job_public_releases` · คำขอโพส: `job_posting_requests`
 *   (ขั้น pending/in_progress/posted — นิยามเดียวกับ flow-summary)
 * - ผู้สมัคร: `public_job_applications` + `application_contact_logs` +
 *   `application_appointment_results` (089)
 * - คิวโทร: `lumos_dispatch_queue` แยก 3 เลนตาม person_ref (นิยาม = `queueLane` ใน lib
 *   🔴 แก้ SQL ต้องแก้ lib ให้ตรงกัน — มีเทสต์คุมฝั่ง lib)
 *
 * cache 30 วิ ต่อ scope (แพตเทิร์นเดียวกับ office-floor)
 * ⚠️ id ที่ใช้ join ฝั่ง pg คือ `item.id` (รูป `siamraj-sql:XXX`) ไม่ใช่ request_no —
 * วัดจริง: `public_job_applications.job_id` = 'siamraj-sql:LMM6704005'
 */
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { withAuth, type ApiRes, type AuthedReq, sendError } from '../_lib/http.js';
import { respondServiceError } from '../_lib/domainErrors.js';
import { listSiamrajUnitRequests } from '../_lib/siamrajUnitRequests.js';
import { loadMatchingBuScope } from '../_lib/departmentScope.js';
import { OVERVIEW_BUCKETS } from '../_lib/applicantOverviewSql.js';
import {
  queueActive,
  queueCancelled,
  queueHasResult,
  queuePending,
  queueWaiting,
} from '../_lib/lumosQueueDefs.js';
import type {
  BoardTeams,
  LaneCounts,
  LumosTeamStats,
  OnlineTeamStats,
  RecruitTeamStats,
  StageCounts,
} from '@/lib/officeTeam';

const releasesTable = tableInAppSchema('job_public_releases');
const postingsTable = tableInAppSchema('job_posting_requests');
const appsTable = tableInAppSchema('public_job_applications');
const contactLogsTable = tableInAppSchema('application_contact_logs');
const attendanceTable = tableInAppSchema('application_appointment_results');
const queueTable = tableInAppSchema('lumos_dispatch_queue');

/**
 * ถังของคิวโทร — 🔴 **มาจาก `_lib/lumosQueueDefs.ts` ห้ามเขียนเงื่อนไขเอง**
 * เดิมบรรทัดนี้เขียน `count(result)` เป็น "ได้ผลแล้ว" และ `count(*)` เป็น "ส่งเข้าทั้งหมด"
 * ⇒ นับพลาดสองทางพร้อมกัน: (1) ผลที่คนบันทึกอยู่ที่ last_outcome จึงหายไปจาก "ได้ผลแล้ว"
 * (2) สายที่ **ยกเลิกแล้ว** ถูกบวกรวมใน "ส่งเข้าทั้งหมด" — เลนหน้าสาธารณะจึงเคยขึ้นจอว่า
 * "ส่งเข้าทั้งหมด 1 · รอโทร 0 · รอผลกลับ 0 · ได้ผลแล้ว 0" (แถวเดียวนั้นคือแถวที่ยกเลิก)
 * ซึ่งขัดกติกาแม่ของโปรเจกต์: **ห้ามนับที่ถูกยกเลิกเป็นที่หาได้**
 */
const QUEUE_CANCELLED = queueCancelled('');
const QUEUE_ACTIVE = queueActive('');
const QUEUE_PENDING = queuePending('');
const QUEUE_WAITING = queueWaiting('');
const QUEUE_HAS_RESULT = queueHasResult('');

type Body = {
  generated_at: string;
  open_total: number;
  teams: BoardTeams;
};

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; body: Body }>();

/** ทีม Online — ประกาศหน้าสาธารณะ + คำขอโพส Content/Scraping (scope ที่ใบเปิดเสมอ) */
async function loadOnlineTeam(openIds: string[], openTotal: number): Promise<OnlineTeamStats> {
  const emptyStage = (): StageCounts => ({ pending: 0, in_progress: 0, posted: 0 });
  if (openIds.length === 0) {
    return { open_total: 0, released: 0, unreleased: 0, content: emptyStage(), scraping: emptyStage() };
  }
  const [rel, post] = await Promise.all([
    dbQuery<{ n: number }>(
      `select count(distinct job_id)::int as n from ${releasesTable}
        where released_at is not null and job_id = any($1)`,
      [openIds],
    ),
    dbQuery<{ t: string; status: string; n: number }>(
      `select case when request_type = 'scraping' then 'scraping' else 'content' end as t,
              status, count(*)::int as n
         from ${postingsTable}
        where status in ('pending', 'in_progress', 'posted') and job_id = any($1)
        group by 1, 2`,
      [openIds],
    ),
  ]);
  const stages = { content: emptyStage(), scraping: emptyStage() };
  for (const r of post.rows) {
    const side = r.t === 'scraping' ? stages.scraping : stages.content;
    if (r.status === 'pending') side.pending = r.n;
    else if (r.status === 'in_progress') side.in_progress = r.n;
    else if (r.status === 'posted') side.posted = r.n;
  }
  const released = rel.rows[0]?.n ?? 0;
  return {
    open_total: openTotal,
    released,
    unreleased: Math.max(0, openTotal - released),
    content: stages.content,
    scraping: stages.scraping,
  };
}

/**
 * ทีมสรรหา — ใบสมัครเทียบใบเปิด + ติดต่อ/นัด/มา-ไม่มา
 * "ติดต่อแล้ว" = โดน AI โทร (คิว 'app-%') **หรือ** มี log โทรมือ — union นับคน
 */
async function loadRecruitTeam(openIds: string[]): Promise<RecruitTeamStats> {
  const [apps, contacted, appts, att] = await Promise.all([
    dbQuery<{ total: number; jobs: number }>(
      `select count(*)::int as total,
              count(distinct job_id) filter (where job_id = any($1))::int as jobs
         from ${appsTable}`,
      [openIds],
    ),
    /**
     * 🔴 **"โทรแล้ว" ต้องใช้นิยามเดิมของ `OVERVIEW_BUCKETS.called` เท่านั้น**
     * เดิมเส้นนี้เขียน union เอง (อยู่ในคิว `app-%` หรือมี log โทรมือ) ⇒ นับกว้างกว่า
     * ถัง "โทรแล้ว" ของศูนย์คุมงานสรรหาที่หน้าปลายทางใช้ · หน้าแรกกับหน้าบอร์ดจึงตอบ
     * ไม่เท่ากันแบบเงียบ ๆ ซึ่งคือสิ่งที่กติกาข้อ 2 ของ office-floor ห้ามไว้ตรง ๆ อยู่แล้ว
     * (audit มุมพนักงานใหม่ 26 ส.ค. 2569 จับได้)
     */
    dbQuery<{ n: number }>(
      `select count(*)::int as n from ${appsTable} a where ${OVERVIEW_BUCKETS.called}`,
    ),
    dbQuery<{ n: number }>(
      `select count(distinct application_id)::int as n
         from ${contactLogsTable} where appointment_at is not null`,
    ),
    dbQuery<{ result: string; n: number }>(
      `select result, count(distinct application_id)::int as n
         from ${attendanceTable} group by result`,
    ),
  ]);
  const attendance = { showed: 0, no_show: 0, rescheduled: 0 };
  for (const r of att.rows) {
    if (r.result === 'showed') attendance.showed = r.n;
    else if (r.result === 'no_show') attendance.no_show = r.n;
    else if (r.result === 'rescheduled') attendance.rescheduled = r.n;
  }
  const total = apps.rows[0]?.total ?? 0;
  const withApps = apps.rows[0]?.jobs ?? 0;
  const contactedN = contacted.rows[0]?.n ?? 0;
  return {
    jobs_with_apps: withApps,
    jobs_without_apps: Math.max(0, openIds.length - withApps),
    apps_total: total,
    apps_contacted: contactedN,
    apps_uncontacted: Math.max(0, total - contactedN),
    appts_made: appts.rows[0]?.n ?? 0,
    attendance,
  };
}

/**
 * ทีม Lumos — คิวแยก 3 เลนตามเส้นทางเข้า
 * ⚠️ CASE นี้ต้องแปลผลเหมือน `queueLane` ใน lib เป๊ะ — แก้ฝั่งไหนแก้อีกฝั่งด้วย
 */
async function loadLumosTeam(): Promise<LumosTeamStats> {
  const { rows } = await dbQuery<{
    lane: string;
    cancelled: number;
    pending: number;
    waiting: number;
    done: number;
    n: number;
  }>(
    `select case
              when job_ref = 'follow' or person_ref like 'follow-%' then 'follow'
              when person_ref like 'app-%' then 'public'
              when person_ref like 'card-%' or person_ref like 'ir-%' then 'match'
              else 'other'
            end as lane,
            count(*) filter (where ${QUEUE_CANCELLED})::int as cancelled,
            count(*) filter (where ${QUEUE_ACTIVE} and ${QUEUE_PENDING})::int as pending,
            count(*) filter (where ${QUEUE_ACTIVE} and ${QUEUE_WAITING})::int as waiting,
            count(*) filter (where ${QUEUE_ACTIVE} and ${QUEUE_HAS_RESULT})::int as done,
            count(*) filter (where ${QUEUE_ACTIVE})::int as n
       from ${queueTable}
      group by 1`,
  );
  const mk = (): LaneCounts => ({ total: 0, pending: 0, waiting: 0, done: 0, cancelled: 0 });
  const lanes: LumosTeamStats = { public: mk(), match: mk(), follow: mk() };
  for (const r of rows) {
    const lane = lanes[r.lane as keyof LumosTeamStats];
    if (!lane) continue;
    lane.total = r.n;
    lane.pending = r.pending;
    lane.waiting = r.waiting;
    lane.done = r.done;
    lane.cancelled = r.cancelled;
  }
  return lanes;
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'Read-only');
  }
  try {
    const departmentScope = await loadMatchingBuScope(req.user);
    // cache แยกตาม scope — staff ต่างแผนกต้องไม่เห็นเลขของ BU อื่น
    const cacheKey = JSON.stringify(departmentScope ?? null);
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.body);

    const open = (await listSiamrajUnitRequests({ limit: 500, departmentScope })) as Array<
      Record<string, unknown>
    >;
    const openIds = open.map((it) => String(it.id || '').trim()).filter(Boolean);

    /** ทุกทีมยิงขนานและล้มแยกทีม — ทีมล้มต้องโผล่ใน errors ไม่ใช่หายเงียบ */
    const [onlineR, recruitR, lumosR] = await Promise.all([
      loadOnlineTeam(openIds, open.length).then(
        (v) => ({ ok: true as const, v }),
        (e: Error) => ({ ok: false as const, e }),
      ),
      loadRecruitTeam(openIds).then(
        (v) => ({ ok: true as const, v }),
        (e: Error) => ({ ok: false as const, e }),
      ),
      loadLumosTeam().then(
        (v) => ({ ok: true as const, v }),
        (e: Error) => ({ ok: false as const, e }),
      ),
    ]);

    const teams: BoardTeams = {
      online: onlineR.ok ? onlineR.v : null,
      recruit: recruitR.ok ? recruitR.v : null,
      lumos: lumosR.ok ? lumosR.v : null,
      errors: {},
    };
    if (!onlineR.ok) teams.errors.online = 'อ่านตารางประกาศ/คำขอโพสไม่ได้';
    if (!recruitR.ok) teams.errors.recruit = 'อ่านตารางใบสมัคร/นัดไม่ได้';
    if (!lumosR.ok) teams.errors.lumos = 'อ่านคิวโทรไม่ได้';

    const body: Body = {
      generated_at: new Date().toISOString(),
      open_total: open.length,
      teams,
    };
    cache.set(cacheKey, { at: Date.now(), body });
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    respondServiceError(res, e, 'office-team GET', { userId: req.user.sub });
  }
}

export default withAuth(handler);
