/**
 * GET /api/home-ai-share?from=YYYY-MM-DD&to=YYYY-MM-DD&bu= — หน้าหลัก "ระบบไปกี่ %" (30 ก.ย. 2569 · อ่านอย่างเดียว)
 *
 * ตอบสี่ก้อน: หน้าติดตาม (สาย) · ดูแลหลังเริ่มงาน (สาย) · ผู้สมัครในกล่องงาน (ใบ) · จับคู่งาน (คน ต่อใบขอ)
 * แต่ละก้อนเป็น 4 ก้อนที่ไม่ทับกัน AI โทร · คนโทร · ทั้งสองทาง · ยังไม่โทร
 * นิยามอยู่ `src/lib/homeAiShare.ts` · SQL อยู่ `api/_lib/homeAiShareSql.ts`
 * ไม่ส่งวันที่ทั้งคู่ = ทั้งหมด (หน้าเว็บส่ง 30 วันล่าสุดเป็นค่าตั้งต้น)
 *
 * 🔴 กติกา (ชุดเดียวกับ `team-online`): ตัวนับล้วน ไม่คืนข้อมูลบุคคล (`withAuth`) ·
 * BU กลาง = `parseBuParam` · บัญชีถูกล็อกแผนก = BU ของตัวเองเสมอ · ก้อนล้มแยกกัน (null + เหตุ — ห้าม 0 ปลอม)
 * ⚠️ ฐานยังไม่รัน migration 130 = สองก้อนแรกยังตอบได้ แต่นับคนโทรไม่ได้ ⇒ `follow_staff_ready: false`
 *
 * `?list=<ก้อน>&segment=<total|ai|staff|both|notCalled>&page=<n>` (รอบ 17 · Popup รายชื่อตอนกดกล่อง) —
 * **เส้นเดียวที่คืนชื่อคน** ⇒ สิทธิ์เท่าหน้าต้นทางของก้อนนั้น (`LIST_RESOURCE` + `checkApiAccess`) · ชื่อ + BU + วัน
 * + ก้อน เท่านั้น ไม่มีเบอร์ · CTE/เงื่อนไขก้อนตัวเดียวกับตัวนับ ⇒ จำนวนชื่อ = เลขในกล่อง
 *
 * `?results=<ก้อน>` (รอบ 18 · แผง "ผลโทร") — ผลล่าสุดของงานที่โทรแล้ว แยก AI/คน จัดถังด้วย `classifyCallMicro`
 * ตัวนับล้วน (ไม่มีชื่อ/เบอร์) ⇒ เปิดเท่ากับกล่องตัวเลข · นิยามอยู่ `src/lib/homeCallResults.ts`
 */
import { withAuth, sendError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { checkApiAccess, type ApiResource } from '../_lib/rbac.js';
import type { UserRole } from '../_lib/auth.js';
import { respondServiceError } from '../_lib/domainErrors.js';
import { dbQuery } from '../_lib/postgres.js';
import { loadMatchingBuScope, type DepartmentScope } from '../_lib/departmentScope.js';
import { followBuJoin, followBuSql, parseBuParam } from '../_lib/homeBuSql.js';
import {
  buildApplicantAiShareSql,
  buildFollowAiShareSql,
  buildMatchingAiShareSql,
  type AiShareListOpts,
  type AiShareSqlMode,
  type FollowLane,
  FOLLOW_QUEUE_MATCH,
} from '../_lib/homeAiShareSql.js';
import { logWarn } from '../_lib/logger.js';
import { normalizeTrendBu } from '../../src/lib/trends/bu.js';
import { AFTERCARE_TOPIC } from '../../src/lib/aftercareRounds.js';
import {
  emptyCallResultCounts,
  emptyFollowResultsSplit,
  tallyCallResults,
  vocabOfBlock,
  type AiShareResultsResponse,
  type CallResultCounts,
  type CallResultSourceRow,
  type FollowResultsSplit,
} from '../../src/lib/homeCallResults.js';
import { categorizeFollowRows, FOLLOW_ENTRY_CATEGORY_COLS, FOLLOW_QUEUE_CALL_COLS } from '../_lib/followCategory.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { followMatrixColOfCategory } from '../../src/lib/followCallMatrix.js';
import { FOLLOW_TEAM_REPLACEMENT } from '../../src/lib/followReplacement.js';
import {
  AI_SHARE_LIST_PAGE,
  aiShareBounds,
  followPlanBounds,
  followPlanPreviousBounds,
  isAiShareBlock,
  isAiShareListKey,
  isAiShareSegment,
  parseListPage,
  previousBounds,
  parseAiShareWindow,
  type AiShareApplicants,
  type AiShareBlockKey,
  type AiShareDetailResponse,
  type AiShareDetailRow,
  type AiShareFollow,
  type AiShareListKey,
  type AiShareListResponse,
  type AiShareListRow,
  type AiShareMatching,
  type AiSharePrevious,
  type AiShareResponse,
  type AiShareWindow,
} from '../../src/lib/homeAiShare.js';

const FOLLOW_TABLE = tableInAppSchema('follow_entries');
const QUEUE_TABLE = tableInAppSchema('lumos_dispatch_queue');

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; body: AiShareResponse }>();

/** 42703 undefined_column — ฐานยังไม่รัน 130 (ช่องผลของคนโทร) */
function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

/** `$1` จุดเริ่ม (null = ทั้งหมด) · `$2` จุดจบ (ไม่รวม) · `$3` BU */
/** `$2` เป็น null ได้เฉพาะหัวข้อติดตามแบบแผนช่วง "ทั้งหมด" (ไม่มีปลายช่วง) — หัวข้ออื่นมีปลายเสมอ */
type Params = [string | null, string | null, string | null];

/** พารามิเตอร์ของหัวข้อติดตามแบบแผน — ปลายช่วงเต็ม ไม่ตัดที่ตอนนี้ (`followPlanBounds`) */
function followPlanParams(win: AiShareWindow, bu: string | null): Params {
  const { start, end } = followPlanBounds(win);
  return [start ? start.toISOString() : null, end ? end.toISOString() : null, bu];
}

type CountRow = Record<string, number | string | null>;
const num = (v: unknown) => Number(v ?? 0) || 0;

const base = (r: CountRow | undefined) => ({
  total: num(r?.total),
  ai: num(r?.ai),
  staff: num(r?.staff),
  both: num(r?.both),
  notCalled: num(r?.not_called),
});

export async function loadFollowAiShare(
  params: Params,
  lane: FollowLane,
): Promise<{ counts: AiShareFollow; staffReady: boolean }> {
  const read = async (staffReady: boolean): Promise<AiShareFollow> => {
    const { rows } = await dbQuery<CountRow>(buildFollowAiShareSql(staffReady, lane), [...params, AFTERCARE_TOPIC]);
    const r = rows[0];
    return {
      ...base(r),
      waitingAi: num(r?.waiting_ai),
      waitingStaff: num(r?.waiting_staff),
      // แยกทีมเฉพาะหัวข้อติดตาม (ดูแลหลังเริ่มงานไม่มีทีม)
      ...(lane === 'follow'
        ? { teamReplacement: num(r?.team_replacement), teamReplacementAi: num(r?.team_replacement_ai) }
        : {}),
    };
  };
  try {
    return { counts: await read(true), staffReady: true };
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    return { counts: await read(false), staffReady: false };
  }
}

export async function loadApplicantAiShare(params: Params): Promise<AiShareApplicants> {
  const { rows } = await dbQuery<CountRow>(buildApplicantAiShareSql(), params);
  const r = rows[0];
  return { ...base(r), waitingAi: num(r?.waiting_ai), held: num(r?.held), untouched: num(r?.untouched) };
}

export async function loadMatchingAiShare(params: Params): Promise<AiShareMatching> {
  const { rows } = await dbQuery<CountRow>(buildMatchingAiShareSql(), params);
  const r = rows[0];
  return { ...base(r), waitingAi: num(r?.waiting_ai), holding: num(r?.holding) };
}

/** แยกวัน × BU ของก้อนเดียว (กราฟตอนกดการ์ด) — CTE ตัวเดียวกับยอดของการ์ด */
export async function loadAiShareDetail(
  params: Params,
  block: AiShareBlockKey,
): Promise<{ rows: AiShareDetailRow[]; staffReady: boolean }> {
  const mode: AiShareSqlMode = 'byDayBu';
  const run = async (sql: string, extra: unknown[] = []) => {
    const { rows } = await dbQuery<CountRow>(sql, [...params, ...extra]);
    return rows.map((r) => ({
      ...base(r),
      day: String(r.day ?? ''),
      bu: r.bu ? String(r.bu) : null,
      ...(block === 'follow'
        ? { teamReplacement: num(r.team_replacement), teamReplacementAi: num(r.team_replacement_ai) }
        : {}),
    }));
  };
  if (block === 'follow' || block === 'aftercare') {
    try {
      return { rows: await run(buildFollowAiShareSql(true, block, mode), [AFTERCARE_TOPIC]), staffReady: true };
    } catch (e) {
      if (!isUndefinedColumn(e)) throw e;
      return { rows: await run(buildFollowAiShareSql(false, block, mode), [AFTERCARE_TOPIC]), staffReady: false };
    }
  }
  if (block === 'applicants') return { rows: await run(buildApplicantAiShareSql(mode)), staffReady: true };
  return { rows: await run(buildMatchingAiShareSql(mode)), staffReady: true };
}

/** รายชื่อของก้อนเดียว ทีละหน้า (Popup ตอนกดกล่อง · รอบ 17) — CTE ตัวเดียวกับยอดของการ์ด */
export async function loadAiShareList(
  params: Params,
  block: AiShareBlockKey,
  list: AiShareListOpts,
): Promise<{ rows: AiShareListRow[]; total: number; staffReady: boolean }> {
  const run = async (sql: string, extra: unknown[] = []) => {
    const { rows } = await dbQuery<CountRow>(sql, [...params, ...extra]);
    return {
      rows: rows.map((r) => ({
        id: String(r.id ?? ''),
        name: r.name ? String(r.name) : null,
        bu: r.bu ? String(r.bu) : null,
        day: String(r.day ?? ''),
        segment: isAiShareSegment(r.segment) ? r.segment : 'notCalled',
      })),
      total: num(rows[0]?.total_rows),
    };
  };
  if (block === 'follow' || block === 'aftercare') {
    try {
      return { ...(await run(buildFollowAiShareSql(true, block, 'list', list), [AFTERCARE_TOPIC])), staffReady: true };
    } catch (e) {
      if (!isUndefinedColumn(e)) throw e;
      return { ...(await run(buildFollowAiShareSql(false, block, 'list', list), [AFTERCARE_TOPIC])), staffReady: false };
    }
  }
  if (block === 'applicants') return { ...(await run(buildApplicantAiShareSql('list', list))), staffReady: true };
  return { ...(await run(buildMatchingAiShareSql('list', list))), staffReady: true };
}

/**
 * ผลโทรของก้อนเดียว (แผง "ผลโทร" · รอบ 18) — แถวรายชื่อที่มีผลจาก CTE ตัวเดียวกับยอดของการ์ด แล้วนับฝั่ง Node
 * (ต้องอ่านคำพูดของแต่ละสาย · ปริมาณหลักร้อย) · หนึ่งรายชื่อ = ผลล่าสุดผลเดียว (`tallyCallResults`)
 */
export async function loadAiShareResults(
  params: Params,
  block: AiShareBlockKey,
): Promise<{ ai: CallResultCounts; staff: CallResultCounts; staffReady: boolean }> {
  const vocab = vocabOfBlock(block);
  const tally = (rows: CallResultSourceRow[]) => tallyCallResults(rows, vocab);
  const run = async (sql: string, extra: unknown[] = []) => (await dbQuery<CallResultSourceRow>(sql, [...params, ...extra])).rows;
  if (block === 'follow' || block === 'aftercare') {
    try {
      return { ...tally(await run(buildFollowAiShareSql(true, block, 'results'), [AFTERCARE_TOPIC])), staffReady: true };
    } catch (e) {
      if (!isUndefinedColumn(e)) throw e;
      return { ...tally(await run(buildFollowAiShareSql(false, block, 'results'), [AFTERCARE_TOPIC])), staffReady: false };
    }
  }
  if (block === 'applicants') return { ...tally(await run(buildApplicantAiShareSql('results'))), staffReady: true };
  return { ...tally(await run(buildMatchingAiShareSql('results'))), staffReady: true };
}

/**
 * หน้าต้นทางของรายชื่อแต่ละก้อน — ตัวนับเปิดให้ทุกคนที่เข้าระบบ แต่ **ชื่อเปิดเท่าที่หน้าต้นทางเปิด**
 * (ดูแลหลังเริ่มงานใช้สิทธิ์ `follow` ตัวเดียวกับ `api/_handlers/aftercare.ts`)
 */
export const LIST_RESOURCE: Record<AiShareBlockKey, ApiResource> = {
  follow: 'follow',
  aftercare: 'follow',
  applicants: 'job-applications',
  matching: 'matching-proposals',
};

export function canListAiShare(role: UserRole, block: AiShareBlockKey): boolean {
  return checkApiAccess(role, LIST_RESOURCE[block], 'GET').ok;
}

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : 'unknown');
const BLOCK_FAILED = 'โหลดตัวเลขส่วนนี้ไม่ขึ้น ลองรีเฟรชอีกครั้ง';

export async function buildHomeAiShare(
  win: AiShareWindow,
  scope: DepartmentScope,
  bu: string | null,
  now: Date,
): Promise<AiShareResponse> {
  const { start, end } = aiShareBounds(win, now);
  const body: AiShareResponse = {
    generated_at: now.toISOString(),
    from: win.from,
    to: win.to,
    bu,
    forced_bu: scope.mode === 'code',
    follow: null,
    aftercare: null,
    applicants: null,
    matching: null,
    follow_staff_ready: false,
    errors: {},
    previous: null,
  };
  if (scope.mode === 'none') {
    const msg = 'บัญชีนี้ยังไม่ได้ผูกแผนก เลยยังดูตัวเลขไม่ได้';
    body.errors = { follow: msg, aftercare: msg, applicants: msg, matching: msg };
    return body;
  }

  const params: Params = [start ? start.toISOString() : null, end.toISOString(), bu];
  // หัวข้อติดตามนับแบบแผน — ปลายช่วงเต็ม ไม่ตัดที่ตอนนี้ (เจ้าของสั่ง 4 ต.ค. 2569 · ตัวเดียวกับหน้าติดตาม)
  const followParams = followPlanParams(win, bu);
  // ช่วงก่อนหน้า (เทียบกับช่วงก่อน) — ยิงพร้อมกัน · ล้มก้อนไหนก้อนนั้นแค่ไม่มีการเทียบ
  const prev = previousBounds(win, now);
  const prevParams: Params | null = prev ? [prev.start.toISOString(), prev.end.toISOString(), bu] : null;
  const followPrev = followPlanPreviousBounds(win, now);
  const followPrevParams: Params | null = followPrev
    ? [followPrev.start.toISOString(), followPrev.end.toISOString(), bu]
    : prevParams;
  const [followR, aftercareR, appsR, matchR, prevR] = await Promise.allSettled([
    loadFollowAiShare(followParams, 'follow'),
    loadFollowAiShare(params, 'aftercare'),
    loadApplicantAiShare(params),
    loadMatchingAiShare(params),
    prevParams
      ? Promise.allSettled([
          loadFollowAiShare(followPrevParams ?? prevParams, 'follow'),
          loadFollowAiShare(prevParams, 'aftercare'),
          loadApplicantAiShare(prevParams),
          loadMatchingAiShare(prevParams),
        ])
      : Promise.resolve(null),
  ]);
  if (prev && prevR.status === 'fulfilled' && prevR.value) {
    const [pf, pa, pp, pm] = prevR.value;
    const val = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);
    const previous: AiSharePrevious = {
      from: prev.from,
      to: prev.to,
      label: prev.label,
      follow: val(pf)?.counts ?? null,
      aftercare: val(pa)?.counts ?? null,
      applicants: val(pp),
      matching: val(pm),
    };
    body.previous = previous;
  }
  const fail = (key: AiShareBlockKey, reason: unknown) => {
    logWarn('home-ai-share block failed', { block: key, error: errText(reason) });
    body.errors[key] = BLOCK_FAILED;
  };
  if (followR.status === 'fulfilled') {
    body.follow = followR.value.counts;
    body.follow_staff_ready = followR.value.staffReady;
  } else fail('follow', followR.reason);
  if (aftercareR.status === 'fulfilled') body.aftercare = aftercareR.value.counts;
  else fail('aftercare', aftercareR.reason);
  if (appsR.status === 'fulfilled') body.applicants = appsR.value;
  else fail('applicants', appsR.reason);
  if (matchR.status === 'fulfilled') body.matching = matchR.value;
  else fail('matching', matchR.reason);
  return body;
}

export async function buildAiShareDetail(
  block: AiShareBlockKey,
  win: AiShareWindow,
  scope: DepartmentScope,
  bu: string | null,
  now: Date,
): Promise<AiShareDetailResponse> {
  const { start, end } = aiShareBounds(win, now);
  const body: AiShareDetailResponse = {
    generated_at: now.toISOString(),
    block,
    from: win.from,
    to: win.to,
    bu,
    rows: null,
    follow_staff_ready: false,
    error: null,
  };
  if (scope.mode === 'none') {
    body.error = 'บัญชีนี้ยังไม่ได้ผูกแผนก เลยยังดูตัวเลขไม่ได้';
    return body;
  }
  try {
    const r = await loadAiShareDetail(
      block === 'follow' ? followPlanParams(win, bu) : [start ? start.toISOString() : null, end.toISOString(), bu],
      block,
    );
    body.rows = r.rows;
    body.follow_staff_ready = r.staffReady;
  } catch (e) {
    logWarn('home-ai-share detail failed', { block, error: errText(e) });
    body.error = BLOCK_FAILED;
  }
  return body;
}

/**
 * ผลโทรของหัวข้อติดตาม — **ช่องเดียวกับแผงขั้นตอนของสายบนหน้าติดตาม** (6 ต.ค. 2569 · เจ้าของ "อย่าเพี้ยน อย่าเอ๋อ")
 * ชุดแถว = ชุดเดียวกับกล่อง "ทั้งหมด" ของหัวข้อติดตาม (ช่วงแผน `followPlanParams` · สองแท็บ · รวมยกเลิก)
 * หมวด = `categorizeFollowRows` (ตัวเดียวกับ Dashboard) · แยกแท็บ × ใครโทร (`followCallerOf`)
 */
export async function loadFollowResultsSplit(params: Params): Promise<FollowResultsSplit> {
  const { rows } = await dbQuery<Record<string, unknown>>(
    `select ${FOLLOW_ENTRY_CATEGORY_COLS}, f.call_mode, f.follow_team,
            ${FOLLOW_QUEUE_CALL_COLS}
       from ${FOLLOW_TABLE} f
       ${followBuJoin('f')}
       left join ${QUEUE_TABLE} q on ${FOLLOW_QUEUE_MATCH}
      where f.topic is distinct from $4::text
        and ($1::timestamptz is null or f.scheduled_at >= $1::timestamptz)
        and ($2::timestamptz is null or f.scheduled_at < $2::timestamptz)
        and ($3::text is null or ${followBuSql('f')} = $3::text)`,
    [...params, AFTERCARE_TOPIC],
  );
  const derived = categorizeFollowRows(rows);
  const out = emptyFollowResultsSplit();
  for (const r of rows) {
    const d = derived.get(String(r.id));
    if (!d) continue;
    const team = r.follow_team === FOLLOW_TEAM_REPLACEMENT ? 'replacement' : 'main';
    out[team][d.caller === 'manual' ? 'staff' : 'ai'][followMatrixColOfCategory(d.category)] += 1;
  }
  return out;
}

export async function buildAiShareResults(
  block: AiShareBlockKey,
  win: AiShareWindow,
  scope: DepartmentScope,
  bu: string | null,
  now: Date,
): Promise<AiShareResultsResponse> {
  const { start, end } = aiShareBounds(win, now);
  const body: AiShareResultsResponse = {
    generated_at: now.toISOString(),
    block,
    from: win.from,
    to: win.to,
    bu,
    vocab: vocabOfBlock(block),
    ai: emptyCallResultCounts(),
    staff: emptyCallResultCounts(),
    follow_staff_ready: false,
    follow: null,
    error: null,
  };
  if (scope.mode === 'none') {
    body.error = 'บัญชีนี้ยังไม่ได้ผูกแผนก เลยยังดูผลโทรไม่ได้';
    return body;
  }
  try {
    if (block === 'follow') {
      body.follow = await loadFollowResultsSplit(followPlanParams(win, bu));
      body.follow_staff_ready = true;
      return body;
    }
    const r = await loadAiShareResults([start ? start.toISOString() : null, end.toISOString(), bu], block);
    body.ai = r.ai;
    body.staff = r.staff;
    body.follow_staff_ready = r.staffReady;
  } catch (e) {
    logWarn('home-ai-share results failed', { block, error: errText(e) });
    body.error = 'โหลดผลโทรไม่ขึ้น ลองอีกครั้ง';
  }
  return body;
}

export async function buildAiShareList(
  block: AiShareBlockKey,
  key: AiShareListKey,
  page: number,
  win: AiShareWindow,
  scope: DepartmentScope,
  bu: string | null,
  now: Date,
): Promise<AiShareListResponse> {
  const { start, end } = aiShareBounds(win, now);
  const body: AiShareListResponse = {
    generated_at: now.toISOString(),
    block,
    segment: key,
    from: win.from,
    to: win.to,
    bu,
    page,
    page_size: AI_SHARE_LIST_PAGE,
    total: 0,
    rows: null,
    follow_staff_ready: false,
    error: null,
  };
  if (scope.mode === 'none') {
    body.error = 'บัญชีนี้ยังไม่ได้ผูกแผนก เลยยังดูรายชื่อไม่ได้';
    return body;
  }
  try {
    const r = await loadAiShareList(
      block === 'follow' ? followPlanParams(win, bu) : [start ? start.toISOString() : null, end.toISOString(), bu],
      block,
      {
        key,
        limit: AI_SHARE_LIST_PAGE,
        offset: page * AI_SHARE_LIST_PAGE,
      },
    );
    body.rows = r.rows;
    body.total = r.total;
    body.follow_staff_ready = r.staffReady;
  } catch (e) {
    logWarn('home-ai-share list failed', { block, segment: key, error: errText(e) });
    body.error = 'โหลดรายชื่อไม่ขึ้น ลองอีกครั้ง';
  }
  return body;
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'Read-only');
  }
  try {
    const q = req.query ?? {};
    const scope: DepartmentScope = await loadMatchingBuScope(req.user);
    const bu = scope.mode === 'code' ? normalizeTrendBu(scope.code) : parseBuParam(q.bu);
    const win = parseAiShareWindow({ from: q.from, to: q.to });
    // `?results=<ก้อน>` = ผลโทรของก้อนนั้น แยก AI/คน (รอบ 18) — ตัวนับล้วน
    if (q.results !== undefined) {
      if (!isAiShareBlock(q.results)) return sendError(res, 400, 'Bad request', 'ไม่รู้จักก้อนนี้');
      const results = await buildAiShareResults(q.results, win, scope, bu, new Date());
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json(results);
    }
    // `?list=<ก้อน>&segment=<กล่อง>&page=<n>` = รายชื่อหลังเลขในกล่อง (รอบ 17) — สิทธิ์เท่าหน้าต้นทาง
    if (q.list !== undefined) {
      if (!isAiShareBlock(q.list)) return sendError(res, 400, 'Bad request', 'ไม่รู้จักก้อนนี้');
      const key = q.segment === undefined ? 'total' : q.segment;
      if (!isAiShareListKey(key)) return sendError(res, 400, 'Bad request', 'ไม่รู้จักกล่องนี้');
      if (!canListAiShare(req.user.role, q.list)) {
        return sendError(res, 403, 'Forbidden', 'บัญชีนี้ยังไม่มีสิทธิ์ดูรายชื่อส่วนนี้');
      }
      const list = await buildAiShareList(q.list, key, parseListPage(q.page), win, scope, bu, new Date());
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json(list);
    }
    // `?detail=<ก้อน>` = แยกวัน × BU ของก้อนนั้น (โหลดตอนกดการ์ดเท่านั้น)
    if (q.detail !== undefined) {
      if (!isAiShareBlock(q.detail)) return sendError(res, 400, 'Bad request', 'ไม่รู้จักก้อนนี้');
      const detail = await buildAiShareDetail(q.detail, win, scope, bu, new Date());
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json(detail);
    }
    const cacheKey = JSON.stringify([scope, win, bu]);
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.body);

    const body = await buildHomeAiShare(win, scope, bu, new Date());
    // ก้อนที่ล้มห้ามค้างใน cache — ครั้งหน้าต้องลองใหม่
    if (Object.keys(body.errors).length === 0) cache.set(cacheKey, { at: Date.now(), body });
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    respondServiceError(res, e, 'home-ai-share GET', { userId: req.user.sub });
  }
}

export default withAuth(handler);
