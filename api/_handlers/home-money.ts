/**
 * ═══ GET /api/home-money — เงินและนาฬิกาของใบขอ สำหรับหน้าหลักผู้บริหาร (เจ้าของ 24 ต.ค. 2569 · อ่านอย่างเดียว) ═══
 *
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD&bu=LBD — ช่วงที่รวมยอด (ไม่ส่ง = 30 วันล่าสุด) · บัญชีที่ล็อก BU เซิร์ฟเวอร์บังคับเอง
 * คืน:
 *   - totals: ยอดตามเงื่อนไขในใบขอ (เพดาน) ทั้งสองจุดเริ่มนับ `need` / `key` — ค่าปรับ · ลดมูลค่า · คน-วัน · จำนวนใบ
 *   - daily: ยอดรายวันในช่วง (หน้าเว็บรวมเป็นสัปดาห์/เดือนเอง `groupDaily`)
 *   - requests: รายใบที่มียอดในช่วง หรือยังเปิดอยู่ — ใบละกี่วัน วันละกี่คน อัตรา ยอด สองนาฬิกา
 *   - customerFines: ลูกค้าหักเงินจริงรายเดือน (ใบรับเงิน · ทุกเรื่อง ไม่ใช่เฉพาะใบขอ)
 *   - clocks: ความเร็วทีม (วันคีย์ → หาครบ) / ช้ากว่าที่ลูกค้าต้องการ — เฉพาะใบที่หาครบในช่วง
 * ตัวคิด `src/lib/requestPenaltyLedger.ts` · ข้อมูลดิบ `api/_lib/siamrajPenaltyLedgerSql.ts`
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { loadMatchingBuScope, loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { loadPenaltyLedgerRaw, LEDGER_SINCE } from '../_lib/siamrajPenaltyLedgerSql.js';
import { buildPenaltyLedger } from '../../src/lib/requestPenaltyLedger.js';
import { buildHomeMoney } from '../../src/lib/homeMoney.js';
import { toBangkokYmd } from '../_lib/businessDate.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { logError } from '../_lib/logger.js';
import { groupReplacements } from './request-pipeline.js';
import { FOLLOW_TEAM_REPLACEMENT } from '../../src/lib/followReplacement.js';
import { getUnitAssignmentsMap } from '../_lib/siamrajUnitAssignments.js';
import { getUnitNotesMap } from '../_lib/siamrajUnitNotes.js';
import { AFTERCARE_TOPIC } from '../../src/lib/aftercareRounds.js';
import { followBuJoin, followBuSql, inBuSet, pickDashboardBuSet, type BuSet } from '../_lib/homeBuSql.js';
import { normalizeTrendBu } from '../../src/lib/trends/bu.js';

const FOLLOW = tableInAppSchema('follow_entries');

/**
 * งานของคน vs AI ในช่วง (ตัวคิด Scale · เจ้าของ 24 ต.ค. 2569 "อยาก Scale ได้ว่าอย่างละเท่าไหร่")
 * คน = ผลที่เจ้าหน้าที่ลงเอง (ผลโทรติดตาม + ผลติดต่อผู้สมัคร) · คน-วัน = คนที่ลงผล × วันที่ลงผลจริง
 * AI = สายที่ Lumos ส่งผลกลับครั้งแรกในช่วง (ทุกงาน) · อ่านไม่ได้ = null (บอกใน errors)
 */
/**
 * สายดูแลหลังเริ่มงานที่นัดไว้แต่ยังไม่ถึงคิว (เจ้าของ 25 ต.ค. 2569 — การ์ดเป็น 0 ดูเหมือนระบบพัง ให้บอกสายที่รออยู่)
 * ไม่นับที่ยกเลิก · BU ใช้ตัวกรองเดียวกับการ์ดดูแลหลังเริ่มงาน (`followBuSql`)
 */
export type AftercareUpcoming = { calls: number; people: number; firstAt: string | null };
async function loadAftercareUpcoming(bu: BuSet): Promise<AftercareUpcoming | null> {
  try {
    const { rows } = await dbQuery<{ calls: number; people: number; first_at: Date | string | null }>(
      `select count(*)::int calls, count(distinct f.recipient_phone)::int people, min(f.scheduled_at) first_at
         from ${FOLLOW} f ${followBuJoin('f')}
        where f.topic = $1 and f.cancelled_at is null and f.completed_at is null and f.scheduled_at > now()
          and ($2::text[] is null or ${followBuSql('f')} = any($2::text[]))`,
      [AFTERCARE_TOPIC, bu],
    );
    const r = rows[0];
    const first = r?.first_at ? new Date(r.first_at).toISOString() : null;
    return { calls: Number(r?.calls ?? 0), people: Number(r?.people ?? 0), firstAt: first };
  } catch (e) {
    logError('home-money: aftercare upcoming', e);
    return null;
  }
}

/** ผู้รับผิดชอบ (เจ้าหน้าที่สรรหา) ของใบขอ — ตารางเดียวกับกล่องงาน · คีย์ได้ทั้งเลขเปล่าและ siamraj-sql:เลข */
async function loadOwners(nos: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const map = await getUnitAssignmentsMap([...nos, ...nos.map((n) => `siamraj-sql:${n}`)]);
    for (const [k, a] of map) {
      const name = a.recruiter_name?.trim();
      if (name) out.set(k.replace(/^siamraj-sql:/, '').trim().toUpperCase(), name);
    }
  } catch (e) {
    logError('home-money: ผู้รับผิดชอบ', e);
  }
  return out;
}

/** ส่งคนแทน ไซต์ → [วัน, คน] — คิวรีเดียวกับแท็บใบขอ (`request-pipeline.ts`) · อ่านไม่ได้ = ไม่หัก (บอกใน `errors`) */
async function loadReplacements(sites: string[]): Promise<Record<string, Array<[string, number]>> | null> {
  if (sites.length === 0) return {};
  try {
    const { rows } = await dbQuery<{ site: string | null; source_ref: string | null; scheduled_at: unknown; note: string | null }>(
      `select coalesce(nullif(btrim(site_code), ''), nullif(btrim(irecruit_site_code), '')) as site, source_ref, scheduled_at, note
         from ${FOLLOW}
        where follow_team = $1 and cancelled_at is null
          and coalesce(nullif(btrim(site_code), ''), nullif(btrim(irecruit_site_code), '')) = any($2::text[])`,
      [FOLLOW_TEAM_REPLACEMENT, sites],
    );
    return groupReplacements(rows).bySite;
  } catch (e) {
    logError('home-money: ส่งคนแทน', e);
    return null;
  }
}

/** ใบที่ติ๊ก "ต้องส่งคนแทน" ที่หน้าใบขอ (ไม่คิดค่าปรับ · `penaltyWaiver.ts` 28 ต.ค. 2569) · อ่านไม่ได้ = null (คิดเต็มแบบเดิม + บอกใน `errors`) */
async function loadSendReplacement(nos: string[]): Promise<Set<string> | null> {
  try {
    const map = await getUnitNotesMap(nos);
    return new Set([...map].filter(([, n]) => n.send_replacement === true).map(([no]) => no.trim().toUpperCase()));
  } catch (e) {
    logError('home-money: ต้องส่งคนแทน', e);
    return null;
  }
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const shiftYmd = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const q = req.query ?? {};
    const today = toBangkokYmd(new Date());
    const to = typeof q.to === 'string' && YMD.test(q.to) ? q.to : today;
    const from = typeof q.from === 'string' && YMD.test(q.from) ? q.from : shiftYmd(to, -29);
    const [departmentScope, buScope] = await Promise.all([loadUserDepartmentScope(req.user), loadMatchingBuScope(req.user)]);
    // ไม่ขอ BU = รวมทุก BU ในสิทธิ์ · เลือกได้ทีละ BU (30 ต.ค. 2569 · หน้าหลักนับ BU ชุดเดียวกันทุกการ์ด)
    const picked = pickDashboardBuSet(buScope, q.bu);
    const forcedBu = picked.forcedBu;
    const bu = picked.bu;
    const buSet = picked.buSet;

    const raw = await loadPenaltyLedgerRaw(departmentScope);
    // 🔴 BU ของสมุดเป็นรหัสยาวจากไซต์ (LML · DSL · SNJ) แต่ตัวเลือกเป็นรหัสสั้น (LM · DS · SN) — แปลงก่อนเทียบ
    //    (31 ต.ค. 2569 เดิมเทียบตรง ⇒ ใบ LM/DS/SN หลุดจากหน้าหลักทั้งหมด · ขอใหม่ 163 ไม่เท่ากล่องประกาศ 183)
    const scoped = raw.rows.filter((r) => inBuSet(normalizeTrendBu(r.bu), buSet));
    const [replacements, owners, aftercareUpcoming, sendReplacement] = await Promise.all([
      loadReplacements([...new Set(scoped.map((r) => r.site))]),
      loadOwners([...new Set(scoped.map((r) => r.requestNo))]),
      loadAftercareUpcoming(buSet),
      loadSendReplacement([...new Set(scoped.map((r) => r.requestNo))]),
    ]);
    const rows = sendReplacement ? scoped.map((r) => ({ ...r, sendReplacement: sendReplacement.has(r.requestNo.trim().toUpperCase()) })) : scoped;
    const ledger = buildPenaltyLedger(rows, raw.informs, today, { from, to: to > today ? today : to }, replacements ?? {});
    // เสียวันละ = สมุดของวันนี้วันเดียว (หักคนแทนแล้ว) — นิยามเดียวกับ "ตามสัญญา" (27 ต.ค. 2569)
    const todayCost = new Map(
      buildPenaltyLedger(rows, raw.informs, today, { from: today, to: today }, replacements ?? {}).requests.map((r) => [
        r.requestNo,
        r.amount.need.fine + r.amount.need.deduct,
      ]),
    );
    const fines = raw.customerFines.filter((f) => inBuSet(normalizeTrendBu(f.bu), buSet));
    const body = {
      ...buildHomeMoney(ledger, fines, {
        from,
        to,
        today,
        since: LEDGER_SINCE,
        bu,
        forcedBu: forcedBu != null,
        ownerOf: (no) => owners.get(no.trim().toUpperCase()) ?? null,
        todayCostOf: (no) => todayCost.get(no) ?? 0,
      }),
      aftercareUpcoming,
      buChoices: picked.choices,
      errors: {
        ...(replacements ? {} : { replacement: 'อ่านส่งคนแทนไม่ได้ — ยอดนี้ยังไม่หักวันที่มีคนแทน' }),
        ...(sendReplacement ? {} : { sendReplacement: 'อ่านช่องต้องส่งคนแทนไม่ได้ — ยอดนี้ยังคิดค่าปรับใบที่ติ๊กไว้' }),
      },
    };
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    return handleApiError(res, e, 'home-money', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
