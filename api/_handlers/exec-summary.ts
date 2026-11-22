/**
 * GET /api/exec-summary — สรุปงานสรรหาทั้งเส้นของช่วงที่เลือก เลขชุดเดียวกับแท็บ "Scale ลง" ของหน้าภาพรวม (ผู้ช่วย AI ใช้ตอบคำถามผู้บริหาร · เจ้าของ 20 พ.ย. 2569)
 * ใช้ตอบ: งานค้าง/เหลือหาเท่าไหร่ · เริ่มหายัง · ใบที่ประกาศ/โพสต์แล้วมีคนสมัครไหม · หาแล้วได้คนเท่าไหร่ (รายชื่อ → AI โทรแล้ว → AI สนใจ → คนโทรต่อ ติดต่อได้ → นัดได้ → มา → แจ้งเข้า)
 *   · คนที่ได้ตรงเกณฑ์ใบขอไหม (พื้นที่ · อายุ · เพศ) · ใครทำอะไร ได้อะไร ช่องทางไหน · รายชื่ออยู่ที่ใคร · BU ไหนทำเยอะ/ค้างเยอะ/รายชื่อเยอะ
 *   · เพิ่มหรือลดจากช่วงก่อน · เทียบเดือน · ยกเลิกเพราะอะไร · หาครบใช้กี่วัน · ทันวันที่ลูกค้าต้องการกี่ % · ค่าปรับ · ลูกค้า/ตำแหน่งไหนเหลือหาเยอะ · ใบขอใบเดียวทำอะไรไปแล้ว
 * query (ไม่ส่งเลย = เดือนนี้ถึงวันนี้ ทุก BU ที่ผู้ถามเห็น):
 *   from, to = YYYY-MM-DD ปี ค.ศ. (ส่งคู่กัน · เทียบกับช่วงก่อนที่ยาวเท่ากัน) · month = YYYY-MM (ทั้งเดือน · เทียบเดือนก่อนถึงวันเดียวกัน)
 *   bu = รหัส BU จากช่อง `bus` → ชั้น BU: people (ตารางแยกตามคน ครบสาย + ทำ 100 งานได้กี่รายชื่อ + เทียบกับทีม) + hold (รายชื่ออยู่ที่ใคร)
 *   who = ชื่อคน (ไม่ต้องส่ง bu — ระบบหา BU ที่คนนั้นสังกัดให้) → ชั้นคน: งานทั้งหมดของคนนั้น + รายชื่อที่หาให้ BU นั้น + channels (แยกช่องทาง)
 *     คนที่หารายชื่อให้หลาย BU มี allBus = ยอดรวมทุก BU (รายชื่อรวมทุก BU · byBu · channels) — ถามว่าคนนี้ได้รายชื่อกี่คน ให้ตอบยอดรวมทุก BU แล้วบอกแยก BU
 *   day = YYYY-MM-DD → วันนั้นใครทำอะไร (dayPeople · เทียบกับวันก่อน) · ส่งคู่กับ who = งานของคนนั้นวันนั้น
 *   box = ค่า key ของกล่องใน sections → กล่องนั้นแยกตามชั้นถัดไป (breakdown: ทั้งหมด → BU → คน/เจ้าหน้าที่สรรหา) · กล่องใบขอที่ชั้น BU ได้ requests (รายใบ)
 *   request = เลขที่ใบขอ (เช่น OPL6909095 · อักษรนำหน้าเลขที่ใบขอไม่ใช่ BU) → ใบนั้นใบเดียว: ยอดอัตรา · ยกเลิกเพราะอะไร · งานที่ทำตั้งแต่ขอ · รายชื่อตั้งแต่ขอ · timeline ไล่ตามวัน (ใครทำอะไร)
 * คืน: window (ช่วง + compareWith = เทียบกับอะไร) · level · bus · sections[].boxes[] { key, label, value, sub, prev, prevNote }
 *   (prev = ค่าช่วงก่อน · null = เทียบไม่ได้ เหตุอยู่ที่ prevNote · ไม่มีช่อง prev = กล่องนี้ไม่เทียบ) · sections[0].equation = ยกมา + ขอใหม่ − หาได้แล้ว − ยกเลิก = เหลือหา
 *   ทุกตารางเป็นแถวละก้อน หัวคอลัมน์เป็นคำเดียวกับจอ: byBu (แยกตาม BU) · people (ชั้นทั้งหมด = ทุกคนทุก BU แบบย่อ: BU ที่สังกัด · ทำล่าสุด · ไม่มีงานมากี่วัน · งานที่ทำ · รายชื่อที่หามารวมทุก BU)
 *   · hold (รายชื่ออยู่ที่ใคร รายคน) · posting (ใบที่เหลือหา ออกไปหาคนถึงไหน: summary = เริ่มหาแล้ว/มีรายชื่อแล้ว/ยังไม่มีรายชื่อ/ยังไม่เริ่มหา · rows = หลักฐาน 9 แบบ ใบละแบบเดียว)
 *   · fit (ตรงเกณฑ์ใบขอ ไล่ตามขั้น · areaUnknownWhy = เทียบพื้นที่ไม่ได้เพราะอะไร ใช้กับเรื่องพื้นที่เท่านั้น) · next (คนในแต่ละขั้นไปไหนต่อ · reasons มีเฉพาะช่องที่เจ้าหน้าที่ลงเหตุผล — ช่องที่ไม่มี reasons = ระบบไม่ได้เก็บเหตุผล)
 *   · cancelReasons · topCustomers · topPositions · informed (แจ้งเข้าใช้กี่วัน) · days (งานรายวัน) · months (ช่วงหลายเดือน)
 * 🔴 เลขทุกตัวคิดด้วยตัวคิดของแท็บ (`src/lib/overviewScale.ts`) จาก 4 เส้นเดียวกับที่จอโหลด ด้วยสิทธิ์/BU ของผู้ถาม — ใช้เลขในนี้ตรง ๆ ห้ามบวกเองจากรายการของเส้นอื่น
 * หน่วย: ใบขอ = อัตรา / ใบ · ผู้สมัคร = คน · งานที่ทำ = รายการ · อ่านอย่างเดียว · ไม่มีชื่อ/เบอร์ผู้สมัคร
 */
import { withRbac, sendError, handleApiError, type ApiReq, type ApiRes, type AuthedReq } from '../_lib/http.js';
import recruitOverviewHandler from './recruit-overview.js';
import recruitStuckHandler from './recruit-stuck.js';
import staffActivityHandler from './staff-activity.js';
import homeMoneyHandler from './home-money.js';
import requestTimelineRoute from './request-timeline.js';
import { buildExecRequest, buildExecSummary, type ExecRequestSummary, type ExecWindow } from '../../src/lib/execSummary.js';
import {
  SCALE_ROOT,
  scaleBoxOf,
  scaleBus,
  scaleBusOfPerson,
  scaleDayCount,
  scalePeopleTable,
  scaleSections,
  scaleStaffNamer,
  scaleStopReasonOf,
  scaleStopReasons,
  type ScaleBoxKey,
  type ScaleInput,
  type ScaleLevel,
} from '../../src/lib/overviewScale.js';
import { staffWorkTotal } from '../../src/lib/staffActivity.js';
import type { RequestTimelineJob, RequestTimelineResponse } from '../../src/lib/requestTimeline.js';
import { bkkDay } from '../../src/lib/recruitAudience.js';
import { prevCohortOf } from '../../src/lib/recruitScale.js';
import { parseBuParam } from '../_lib/homeBuSql.js';
import type { RecruitAppFact, RecruitOverviewResponse } from '../../src/lib/recruitOverviewTypes.js';
import type { StuckRequest } from '../../src/lib/recruitStuck.js';
import type { StaffActivityRow, StaffRosterRow } from '../../src/lib/staffActivity.js';
import type { MoneyRequest } from '../../src/lib/homeMoney.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
type Handler = (req: ApiReq, res: ApiRes) => Promise<void>;

/** เรียกเส้นอ่านเดิมในตัวด้วย header ชุดเดียวกับผู้ถาม (วิธีเดียวกับตัวอ่านของผู้ช่วย) ⇒ สิทธิ์ · BU · นิยาม เหมือนที่จอได้ทุกอย่าง · อ่านไม่ได้ = null */
async function read<T>(handler: Handler, headers: ApiReq['headers'], query: Record<string, string>): Promise<T | null> {
  let status = 200;
  let payload: unknown = null;
  const res: ApiRes = {
    setHeader: () => undefined,
    status: (code: number) => {
      status = code;
      return {
        json: (body: unknown) => {
          payload = body;
        },
        end: () => undefined,
      };
    },
  };
  try {
    await handler({ method: 'GET', query, headers: { ...headers }, body: undefined }, res);
  } catch {
    return null;
  }
  return status === 200 ? (payload as T) : null;
}

type Part = { staff: StaffActivityRow[] | null; requests: StuckRequest[] | null; money: MoneyRequest[] | null };
type Loaded = { overview: RecruitOverviewResponse; cur: Part; prev: Part | null; roster: StaffRosterRow[] | null; errors: string[] };

/**
 * ข้อมูลของช่วง: 4 เส้นเดียวกับแท็บ Scale ลง (+ ช่วงก่อน + คนที่มีงานใน 60 วัน) — ยิงพร้อมกัน
 * ผู้ใช้ BU เดียว เส้นเดิมล็อก BU ให้เอง · คนอื่นได้ทุก BU ในสิทธิ์ แล้วค่อยเลือกชั้น BU ตอนสรุป (ทางเดียวกับกดแถว BU บนจอ)
 */
async function load(headers: ApiReq['headers'], base: Record<string, string>): Promise<Loaded | null> {
  const overview = await read<RecruitOverviewResponse>(recruitOverviewHandler, headers, { ...base, asof: '1' });
  if (!overview?.apps) return null;
  const win = overview.window;
  const end = win.to > overview.today ? overview.today : win.to;
  const part = async (from: string, to: string): Promise<Part> => {
    const q = { from, to };
    const [stuck, staff, money] = await Promise.all([
      read<{ requests: StuckRequest[] | null }>(recruitStuckHandler, headers, q),
      read<{ rows: StaffActivityRow[] }>(staffActivityHandler, headers, q),
      read<{ requests: MoneyRequest[] }>(homeMoneyHandler, headers, q),
    ]);
    return { staff: staff?.rows ?? null, requests: stuck?.requests ?? null, money: money?.requests ?? null };
  };
  const [cur, prev, roster] = await Promise.all([
    part(win.from, win.to),
    win.all ? null : part(win.prevFrom, win.prevTo),
    read<{ roster: StaffRosterRow[] }>(staffActivityHandler, headers, { from: end, to: end, roster: '1' }),
  ]);
  const errors: string[] = [];
  if (!cur.requests) errors.push('อ่านใบขอของช่วงนี้ไม่ได้ — กล่องใบขอไม่มีเลข');
  if (!cur.staff) errors.push('อ่านงานรายคนของช่วงนี้ไม่ได้ — กล่องงานที่ทำไม่มีเลข');
  if (!cur.money) errors.push('อ่านค่าปรับของช่วงนี้ไม่ได้ — กล่องค่าปรับ/ความเร็วไม่มีเลข');
  if (overview.appJobs == null) errors.push('อ่านเกณฑ์ของใบขอไม่ได้ — แถวตรงเกณฑ์ใบขอไม่มีเลข');
  return { overview, cur, prev, roster: roster?.roster ?? null, errors };
}

/** จำข้อมูลของช่วงไว้สั้น ๆ ต่อผู้ถาม — ผู้ช่วยมักถามต่อหลายชั้นในคำถามเดียว (ทั้งหมด → BU → คน) ภายในเวลาจำกัด */
const CACHE_MS = 90_000;
const CACHE_MAX = 4;
const cache = new Map<string, { at: number; p: Promise<Loaded | null> }>();
function loadCached(key: string, run: () => Promise<Loaded | null>): Promise<Loaded | null> {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.at > CACHE_MS) cache.delete(k);
  const hit = cache.get(key);
  if (hit) return hit.p;
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  const p = run();
  cache.set(key, { at: now, p });
  // อ่านไม่ได้ = ไม่จำ (ถามใหม่ได้ทันที)
  p.then((v) => v ?? cache.delete(key)).catch(() => cache.delete(key));
  // ครบเวลาแล้วทิ้งเอง ไม่รอคำถามถัดไป (ข้อมูลของช่วงหนึ่งหนักหลาย MB) · ไม่ถ่วงการปิด process
  const timer = setTimeout(() => {
    if (cache.get(key)?.p === p) cache.delete(key);
  }, CACHE_MS);
  (timer as { unref?: () => void }).unref?.();
  return p;
}
/** ล้างที่จำไว้ (เทสต์) */
export const clearExecSummaryCache = () => cache.clear();

const JOB_PREFIX = /^(siamraj-sql|siamraj-pre):/i;
const isPre = (jobId: string | null | undefined) => /^siamraj-pre:/i.test(jobId ?? '');
/**
 * ใบขอใบเดียว (จอ "<เลขที่ใบขอ> ทำอะไรไปแล้ว") — รับเลขที่ใบขออย่างเดียวได้ ผู้บริหารไม่รู้ id ใบ
 * หาในใบขอของช่วงที่เลือกก่อน (มียอดอัตรา · เหตุผลยกเลิก) · ใบที่จบก่อนช่วง = อ่านงานที่ทำตรงจากเลขที่ใบ (ไม่มียอดอัตรา)
 * 🔴 ใบที่ไม่อยู่ในช่วงและไม่มีงาน/รายชื่อเลย = ถือว่าไม่เจอ — ผู้ที่เห็นทุก BU ถามเลขที่ไม่มีจริงก็ได้ก้อนว่างกลับมา ห้ามตอบว่า "ใบนี้ไม่มีใครทำอะไร"
 */
async function requestSummary(
  headers: ApiReq['headers'],
  raw: string,
  input: ScaleInput,
  nameOf: (v: string | null | undefined) => string | null,
  window: ExecWindow,
  generatedAt: string,
  baseErrors: readonly string[],
): Promise<ExecRequestSummary> {
  const errors = [...baseErrors];
  const prefix = raw.match(JOB_PREFIX)?.[1].toLowerCase() ?? null;
  const bare = raw.replace(JOB_PREFIX, '').replace(/\s+/g, '').toUpperCase();
  const asked = prefix ? `${prefix}:${bare}` : null;
  const idOf = (r: { jobId?: string | null; requestNo: string }) => r.jobId?.trim() || `siamraj-sql:${r.requestNo.trim()}`;
  const hits = (input.requests ?? [])
    .filter((r) => (asked ? idOf(r).toUpperCase() === asked.toUpperCase() : r.requestNo.trim().toUpperCase() === bare))
    .sort((a, b) => Number(isPre(a.jobId)) - Number(isPre(b.jobId)));
  const hit = hits[0] ?? null;
  if (hits.length > 1) errors.push(`เลขที่ ${bare} มี ${hits.length} ใบ (ใบขอจริงกับใบขอชั่วคราวเลขซ้ำกัน) — ที่แสดงคือ${isPre(hit?.jobId) ? 'ใบขอชั่วคราว' : 'ใบขอจริง'} · อีกใบดูด้วย request=${idOf(hits[1])}`);
  const ids = hit ? [idOf(hit)] : asked ? [asked] : [`siamraj-sql:${bare}`, `siamraj-pre:${bare}`];
  const tl = await read<RequestTimelineResponse>(requestTimelineRoute, headers, { jobs: ids.join(','), events: '1' });
  const hasWork = (j: RequestTimelineJob | null | undefined): j is RequestTimelineJob => Boolean(j && (staffWorkTotal(j.done.work) > 0 || (j.done.chain[0] ?? 0) > 0 || (j.events?.length ?? 0) > 0));
  const job = hit ? (tl?.jobs[ids[0]] ?? null) : (ids.map((id) => tl?.jobs[id]).find(hasWork) ?? null);
  if (!hit && !job) {
    errors.push(`ไม่เจอใบขอ ${bare} — ตรวจเลขที่ใบขออีกครั้ง (อักษรนำหน้าเลขที่ใบขอไม่ใช่ BU)`);
    return { generatedAt, window, request: null, errors };
  }
  // อ่านใบขอของช่วงไม่ได้ = เหตุอยู่ใน errors แล้ว (ไม่ใช่ใบจบก่อนช่วง)
  if (!hit && input.requests) errors.push(`ใบ ${bare} ไม่อยู่ในใบขอของช่วง ${window.from} ถึง ${window.to} (จบก่อนช่วงนี้) — ไม่มียอดอัตราและเหตุผลยกเลิก มีเฉพาะงานที่ทำและรายชื่อ`);
  const cancelReason = hit && input.money ? scaleStopReasonOf(scaleStopReasons(input), hit) : null;
  return buildExecRequest({ requestNo: bare, request: hit, job, cancelReason, nameOf, window, generatedAt, errors });
}

export async function execSummaryHandler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') return sendError(res, 405, 'Method not allowed');
  const one = (v: unknown) => {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === 'string' ? x.trim() : '';
  };
  const from = one(req.query?.from);
  const to = one(req.query?.to);
  const month = one(req.query?.month);
  const day = one(req.query?.day);
  if ((from || to) && (!DAY.test(from) || !DAY.test(to) || from > to)) return sendError(res, 400, 'bad_request', 'ช่วงวันที่ไม่ถูกต้อง (from, to = YYYY-MM-DD)');
  if (month && !MONTH.test(month)) return sendError(res, 400, 'bad_request', 'เดือนไม่ถูกต้อง (month = YYYY-MM)');
  if (day && !DAY.test(day)) return sendError(res, 400, 'bad_request', 'วันไม่ถูกต้อง (day = YYYY-MM-DD)');
  try {
    const base: Record<string, string> = from && to ? { from, to } : month ? { month } : {};
    const loaded = await loadCached(`${req.user.sub}|${from}|${to}|${month}`, () => load(req.headers, base));
    res.setHeader?.('Cache-Control', 'no-store');
    if (!loaded) return sendError(res, 502, 'unavailable', 'อ่านข้อมูลภาพรวมของช่วงนี้ไม่ได้ ลองใหม่อีกครั้ง');
    const { overview, cur, prev } = loaded;
    const win = overview.window;
    const apps = overview.apps ?? [];
    const cohort = apps.filter((f) => {
      const d = bkkDay(f.createdAt);
      return d >= win.from && d <= win.to;
    });
    const now = Date.now();
    const input: ScaleInput = { cohort, staff: cur.staff, requests: cur.requests, money: cur.money, jobs: overview.appJobs ?? null, from: win.from, to: win.to, today: overview.today, now };
    const prevCohort: RecruitAppFact[] | null = prev ? prevCohortOf(apps, win, overview.firstDay, overview.generatedAt) : null;
    const prevInput: ScaleInput | null = prev ? { cohort: prevCohort ?? [], staff: prev.staff, requests: prev.requests, money: prev.money, jobs: overview.appJobs ?? null, from: win.prevFrom, to: win.prevTo, today: overview.today, now } : null;

    const requestNo = one(req.query?.request);
    if (requestNo) {
      const namer = scaleStaffNamer([...(cur.staff ?? []), ...(prev?.staff ?? [])]);
      const window: ExecWindow = { from: input.from, to: input.to, days: scaleDayCount(input), compareWith: null };
      return res.status(200).json(await requestSummary(req.headers, requestNo, input, namer, window, overview.generatedAt, loaded.errors));
    }

    // ── ชั้นที่ขอ: BU → คน → วัน — ค่าที่ไม่มีในข้อมูล บอกตรง ๆ พร้อมค่าที่ใช้ได้ (ไม่เดาให้) ──
    const errors = [...loaded.errors];
    const level: ScaleLevel = { ...SCALE_ROOT };
    const bus = scaleBus(input);
    const askedBu = overview.bu ?? parseBuParam(one(req.query?.bu));
    if (askedBu) {
      if (bus.includes(askedBu)) level.bu = askedBu;
      else errors.push(`ไม่มี BU ${askedBu} ในช่วงนี้ — BU ที่มี: ${bus.join(', ')}`);
    }
    const who = one(req.query?.who);
    if (who) {
      // ชื่อชุดเดียวกับตาราง "แยกตามคน" บนจอ · ไม่ส่ง bu = หา BU ที่คนนั้นสังกัดให้ (ผู้บริหารถามถึงคนด้วยชื่อ ไม่รู้ BU — ทดสอบบนเว็บจริง 22 พ.ย. 2569)
      const home = scaleBusOfPerson(input, who, loaded.roster).find((x) => !level.bu || x.bu === level.bu);
      if (home) {
        level.bu = home.bu;
        level.who = home.name;
      } else {
        const names = [...new Set((level.bu ? [level.bu] : bus).flatMap((b) => scalePeopleTable(input, b, loaded.roster).rows.map((r) => r.name)))];
        errors.push(`ไม่เจอ ${who}${level.bu ? ` ใน ${level.bu}` : ''} — ชื่อที่มี: ${names.slice(0, 40).join(', ')}`);
      }
    }
    if (day) {
      if (day >= win.from && day <= (win.to > overview.today ? overview.today : win.to)) level.day = day;
      else errors.push(`วันที่ ${day} อยู่นอกช่วง ${win.from} ถึง ${win.to}`);
    }
    const boxRaw = one(req.query?.box);
    const box = boxRaw && scaleBoxOf(scaleSections(input, level), boxRaw as ScaleBoxKey) ? (boxRaw as ScaleBoxKey) : null;
    if (boxRaw && !box) errors.push(`ชั้นนี้ไม่มีกล่อง ${boxRaw} — ใช้ค่า key จาก sections`);

    return res.status(200).json(
      buildExecSummary({ input, prev: prevInput, prevCohortOk: Boolean(prevCohort), level, box, roster: loaded.roster, generatedAt: overview.generatedAt, errors }),
    );
  } catch (e) {
    return handleApiError(res, e, 'exec-summary', { userId: req.user?.sub });
  }
}

export default withRbac(execSummaryHandler, 'job-applications');
