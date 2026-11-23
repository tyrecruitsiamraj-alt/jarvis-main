/**
 * GET /api/home-drill?bu= — กดกล่องหน้าหลักแล้วไล่ 12 เดือน → รายวัน → BU → เหตุผล (เจ้าของ 22 พ.ย. 2569)
 *
 * ใบสมัคร 12 เดือนล่าสุด (วันที่ 1 ของเดือนที่ย้อน 11 เดือน ถึงวันนี้ · วันที่กรอกตามเวลาไทย) จัดเข้าช่องของทุกกล่องที่ไล่เดือนได้
 * ด้วยตัวตัดสินเดียวกับเลขบนกล่อง — ขั้นผู้สมัคร 6 ขั้น · โทร Prescreen · โทรหลัง Prescreen · นัดได้ · ผู้สมัครเข้าระบบ
 * คืนเป็นรหัสต่อใบ (`DrillPayload` ใน src/lib/homeDrill.ts) ไม่มีชื่อ/เบอร์ · หน้าเว็บนับเดือน/วัน/BU/เหตุผลเอง
 * อ่านอย่างเดียว · BU ตามสิทธิ์ของคนที่เปิด (ชุดเดียวกับหน้าหลัก `pickDashboardBuSet`) · จำผลไว้ 2 นาทีต่อ BU
 * `?set=requests` = กล่องใบขอ ขอใหม่ · ปิดครบ · ยกเลิก (23 พ.ย. 2569 ข้อ 2) — สมุดใบขอชุดเดียวกับ `/api/home-money` (`buildRequestDrillPayload`)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { loadMatchingBuScope } from '../_lib/departmentScope.js';
import { pickDashboardBuSet } from '../_lib/homeBuSql.js';
import { dbQuery } from '../_lib/postgres.js';
import { toBangkokYmd } from '../_lib/businessDate.js';
import { logWarn } from '../_lib/logger.js';
import { proportionAppReasonsSql } from '../_lib/homeProportionSql.js';
import { loadFacts, toFact } from './recruit-overview.js';
import { readUnitRequestListThroughCache } from './siamraj-unit-requests.js';
import { addDays } from '../../src/lib/trends/timeBuckets.js';
import { buildDrillPayload, drillFrom, type DrillPayload, type DrillSource } from '../../src/lib/homeDrill.js';
import { buildRequestDrillPayload } from '../../src/lib/homeRequestDrill.js';
import { loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { loadPenaltyLedgerRaw } from '../_lib/siamrajPenaltyLedgerSql.js';
import { buildPenaltyLedger } from '../../src/lib/requestPenaltyLedger.js';
import { inBuSet } from '../_lib/homeBuSql.js';
import { normalizeTrendBu } from '../../src/lib/trends/bu.js';
import type { AppNoCallReason, ProportionAppFlag } from '../../src/lib/homeProportion.js';

const startOfBkk = (ymd: string) => `${ymd}T00:00:00+07:00`;
const CACHE_MS = 2 * 60_000;
const cache = new Map<string, { at: number; body: DrillPayload }>();

const text = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

async function build(buSet: readonly string[] | null, now: Date): Promise<DrillPayload> {
  const to = toBangkokYmd(now);
  const from = drillFrom(to);
  const range = [startOfBkk(from), startOfBkk(addDays(to, 1)), buSet];
  const [rows, flags, openJobIds] = await Promise.all([
    loadFacts(range),
    dbQuery<{ id: string; job_id: string | null; claimed: boolean; reason: AppNoCallReason | null; block_reason: string | null }>(proportionAppReasonsSql(), range)
      .then((r) => r.rows)
      .catch((e: unknown) => {
        logWarn('home-drill reasons failed', { error: e instanceof Error ? e.message : String(e) });
        return null;
      }),
    // ใบขอที่เปิดอยู่ (เหตุ "ใบขอปิดแล้ว") — ชุดเดียวกับที่หน้าหลักอ่าน · อ่านไม่ได้ = null (ไม่เดาว่าปิด)
    readUnitRequestListThroughCache({ limit: 500, departmentScope: { mode: 'all' } })
      .then((out) => new Set((out.value as Array<{ id: unknown }>).map((j) => String(j.id))))
      .catch(() => null),
  ]);
  const flagOf = new Map<string, ProportionAppFlag>(
    (flags ?? []).map((f) => [f.id, { id: f.id, jobId: f.job_id, claimed: f.claimed === true, reason: f.reason, blockReason: f.block_reason }]),
  );
  const sources: DrillSource[] = rows.map((r) => {
    const fact = toFact(r, null);
    return {
      fact,
      flag: fact.id ? flagOf.get(fact.id) : undefined,
      entry: { source: text(r.entry_source), createdBy: text(r.keyed_by), channelLabel: text(r.channel_label) },
    };
  });
  return buildDrillPayload(sources, from, to, openJobIds, now.getTime());
}

/** กล่องใบขอ — สมุดชุดเดียวกับหน้าหลัก (BU รหัสยาวจากไซต์ → รหัสสั้น · ตัวกรองเดียวกับ `/api/home-money`) */
async function buildRequests(req: AuthedReq, buSet: readonly string[] | null, now: Date): Promise<DrillPayload> {
  const to = toBangkokYmd(now);
  const from = drillFrom(to);
  const raw = await loadPenaltyLedgerRaw(await loadUserDepartmentScope(req.user));
  const rows = raw.rows.filter((r) => inBuSet(normalizeTrendBu(r.bu), buSet));
  const ledger = buildPenaltyLedger(rows, raw.informs, to, { from, to });
  return buildRequestDrillPayload(ledger.requests, from, to, (r) => normalizeTrendBu(r.bu) ?? '');
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const scope = await loadMatchingBuScope(req.user);
    res.setHeader?.('Cache-Control', 'no-store');
    if (scope.mode === 'none') return res.status(200).json({ version: 1, from: '', to: '', bus: [], boxes: [], items: [], ids: [] } satisfies DrillPayload);
    const buSet = pickDashboardBuSet(scope, req.query?.bu).buSet;
    const set = req.query?.set === 'requests' ? 'requests' : 'applicants';
    const key = `${set}|${JSON.stringify(buSet)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.body);
    const body = set === 'requests' ? await buildRequests(req, buSet, new Date()) : await build(buSet, new Date());
    cache.set(key, { at: Date.now(), body });
    return res.status(200).json(body);
  } catch (e) {
    return handleApiError(res, e, 'home-drill', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
