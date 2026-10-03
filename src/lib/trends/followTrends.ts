/**
 * ═══ ตัวคิด Dashboard ติดตามเริ่มงาน ═══
 *
 * 🔴 นิยามยืมจากตัวกลางเท่านั้น (หนึ่งเมตริกหนึ่งนิยาม):
 * - ผลโทร → ถัง (โทรติด/ไม่ติด/ยกเลิก/รอ) = `bucketOfCall` (`callOutcomeBuckets.ts`)
 * - "ไปตามนัดจริง" = `FOLLOW_OUTCOME_SUCCESS` (went · arrived · done) ตัวเดียวกับ /api/home-kpis
 * - ป้ายไทย = `FOLLOW_OUTCOME_LABEL` · `CALL_OUTCOME_LABEL`
 *
 * แต่ละตัวเลขนับตาม **วันที่ของเหตุการณ์นั้นเอง** (ลงรายชื่อ = วันลง · โทรแล้ว = วันที่ได้ผลโทร ·
 * ปิดงาน = วันที่ปิด) — ห้ามเอาวันลงรายชื่อไปนับผลที่เกิดทีหลัง (สัปดาห์นี้จะดูแย่ สัปดาห์ก่อนจะดูดีเกินจริง)
 */
import { bucketOfCall } from '@/lib/callOutcomeBuckets';
import { CALL_OUTCOME_LABEL } from '@/lib/callOutcomeTone';
import { FOLLOW_OUTCOME_LABEL, FOLLOW_OUTCOME_SUCCESS, type FollowOutcomeAny } from '@/lib/followOutcome';
import { bangkokYmd } from './timeBuckets';
import { trendBuLabel } from './bu';
import type { FollowTrendRow } from './types';

export type FollowMetric = 'registered' | 'called' | 'connected' | 'completed' | 'success' | 'dropped' | 'cancelledEntry';

export const FOLLOW_METRIC_LABEL: Record<FollowMetric, string> = {
  registered: 'ลงติดตาม',
  called: 'โทรแล้ว',
  connected: 'ติดต่อได้',
  completed: 'ปิดงาน',
  success: 'ไปถึงแล้ว',
  dropped: 'ยกเลิก / ลา / ไม่ไป',
  cancelledEntry: 'ยกเลิกการติดตาม',
};

/** ผลปิดงานที่แปลว่า "ไม่สำเร็จ" (ชุดใหม่ + ชุดเก่า) — เลื่อน/อื่น ๆ ไม่นับทั้งสำเร็จและไม่สำเร็จ */
const FOLLOW_DROPPED: readonly string[] = ['cancelled', 'leave', 'job_cancelled', 'no_show_start'];

const isSuccess = (code: string | null) => Boolean(code && (FOLLOW_OUTCOME_SUCCESS as readonly string[]).includes(code));

/** วันที่ (ปฏิทินกรุงเทพ) ที่แถวนี้นับเข้าตัวเลขนั้น · `null` = แถวนี้ไม่นับ */
export function followEventYmd(row: FollowTrendRow, metric: FollowMetric): string | null {
  switch (metric) {
    case 'registered':
      return bangkokYmd(row.createdAt);
    case 'called':
    case 'connected': {
      if (!row.resultAt) return null;
      const b = bucketOfCall(row.callStatus, row.callOutcome);
      if (metric === 'connected') return b === 'connected' ? bangkokYmd(row.resultAt) : null;
      return b === 'connected' || b === 'unreached' ? bangkokYmd(row.resultAt) : null;
    }
    case 'completed':
      return bangkokYmd(row.completedAt);
    case 'success':
      return isSuccess(row.outcomeCode) ? bangkokYmd(row.completedAt) : null;
    case 'dropped':
      return row.outcomeCode && FOLLOW_DROPPED.includes(row.outcomeCode) ? bangkokYmd(row.completedAt) : null;
    case 'cancelledEntry':
      return bangkokYmd(row.cancelledAt);
  }
}

export type FollowDim = 'bu' | 'unit' | 'staff' | 'topic' | 'round' | 'mode' | 'outcome' | 'callOutcome';

export const FOLLOW_DIM_LABEL: Record<FollowDim, string> = {
  bu: 'BU',
  unit: 'หน่วยงาน',
  staff: 'เจ้าหน้าที่',
  topic: 'หัวข้อ',
  round: 'รอบโทร',
  mode: 'ใครโทร',
  outcome: 'ผลปิดงาน',
  callOutcome: 'ผลโทร',
};

/** ชื่อหน่วยงานที่พิมพ์ต่างกันนิดหน่อย ("FORD" · "Ford " · "ford") = ที่เดียวกัน */
function normalizeUnitName(s: string | null): string {
  return (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * 🔴 **หน่วยงานจัดกลุ่มด้วยรหัสไซต์ก่อน ชื่อทีหลัง** — วัดจริง 28 ก.ย. 2569: ชื่อเดียวกันถูกพิมพ์หลายแบบ
 * ("FORD" ไม่มีไซต์ 72 · "Ford" ไซต์ 69LBDL0239 40 · "พญาไท_ศรีราชา" · "รพ พญาไท ศรีราชา") ⇒ นับตามชื่อ = ที่เดียวแตกหลายแถว
 *
 * กติกา (ไม่เดาจากชื่อที่ "คล้าย" กัน — ต้องตรงกันหลังตัดช่องว่าง/ตัวพิมพ์เท่านั้น):
 * 1. มีรหัสไซต์ = กลุ่มของไซต์นั้น
 * 2. ไม่มีรหัสไซต์ แต่ชื่อ **ตรงกับชื่อที่เคยใช้คู่กับไซต์เดียวพอดี** = รวมเข้าไซต์นั้น (FORD 72 + Ford 40 = 112)
 *    ชื่อนั้นเคยใช้กับหลายไซต์ = แยกเป็นกลุ่มชื่อ (ไม่รู้ว่าไซต์ไหน ห้ามเลือกให้)
 * 3. ป้าย = ชื่อที่พิมพ์บ่อยสุดในกลุ่ม · ป้ายซ้ำกันข้ามไซต์ (สมิติเวชหลายสาขา) = ต่อท้ายรหัสไซต์
 */
export function followUnitResolver(rows: readonly FollowTrendRow[]): (row: FollowTrendRow) => string {
  const site = (r: FollowTrendRow) => (r.siteCode ?? '').trim().toUpperCase();
  const cleanName = (r: FollowTrendRow) => (r.unitName ?? '').replace(/\s+/g, ' ').trim();
  // ชื่อ (ปรับรูปแล้ว) → ไซต์ที่เคยใช้คู่กัน
  const sitesByName = new Map<string, Set<string>>();
  for (const r of rows) {
    const s = site(r);
    const n = normalizeUnitName(r.unitName);
    if (!s || !n) continue;
    const set = sitesByName.get(n) ?? new Set<string>();
    set.add(s);
    sitesByName.set(n, set);
  }
  const keyOf = (r: FollowTrendRow): string => {
    const s = site(r);
    if (s) return `site:${s}`;
    const n = normalizeUnitName(r.unitName);
    if (!n) return '';
    const sites = sitesByName.get(n);
    return sites && sites.size === 1 ? `site:${[...sites][0]}` : `name:${n}`;
  };
  const votes = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const k = keyOf(r);
    const name = cleanName(r);
    if (!k || !name) continue;
    const m = votes.get(k) ?? new Map<string, number>();
    m.set(name, (m.get(name) ?? 0) + 1);
    votes.set(k, m);
  }
  const base = new Map<string, string>();
  for (const [k, m] of votes) base.set(k, [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'))[0][0]);
  // ป้ายซ้ำข้ามกลุ่ม → ต่อท้ายรหัสไซต์
  const usedBy = new Map<string, number>();
  for (const label of base.values()) usedBy.set(label.toLowerCase(), (usedBy.get(label.toLowerCase()) ?? 0) + 1);
  const label = new Map<string, string>();
  for (const [k, l] of base) {
    label.set(k, (usedBy.get(l.toLowerCase()) ?? 0) > 1 && k.startsWith('site:') ? `${l} · ${k.slice(5)}` : l);
  }
  return (r) => {
    const k = keyOf(r);
    if (!k) return 'ไม่ระบุ';
    return label.get(k) ?? (k.startsWith('site:') ? k.slice(5) : 'ไม่ระบุ');
  };
}

export function followDimGetter(dim: FollowDim, rows: readonly FollowTrendRow[]): (row: FollowTrendRow) => string {
  switch (dim) {
    case 'bu':
      return (r) => trendBuLabel(r.bu);
    case 'unit':
      return followUnitResolver(rows);
    case 'staff':
      return (r) => r.staffName ?? 'ไม่ระบุ';
    case 'topic':
      return (r) => r.topic ?? 'ไม่ระบุ';
    case 'round':
      return (r) => ((r.callRound ?? 1) >= 2 ? 'สายที่ 2 ขึ้นไป' : 'สายแรก');
    case 'mode':
      return (r) => (r.callMode === 'manual' ? 'เจ้าหน้าที่โทรเอง' : 'AI โทร');
    case 'outcome':
      return (r) => (r.outcomeCode ? FOLLOW_OUTCOME_LABEL[r.outcomeCode as FollowOutcomeAny] ?? r.outcomeCode : 'ยังไม่ปิดงาน');
    case 'callOutcome':
      return (r) =>
        r.callOutcome ? CALL_OUTCOME_LABEL[r.callOutcome as keyof typeof CALL_OUTCOME_LABEL] ?? r.callOutcome : 'ยังไม่มีผลโทร';
  }
}

/** อัตรา (0–1) · ฐานเป็น 0 = null */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/**
 * ═══ รอบแรก/รอบถัดไป + แยก AI/คนโทร (Journey ข้อ 15 · เจ้าของสั่ง 3 ต.ค. 2569) ═══
 * *"กำลังติดตามกี่คน กี่สาย รอบแรกที่คน รอบสองกี่คน"* + *"คนโทรเท่าไหร่ Ai เท่าไหร่
 * แล้วบอกด้วยว่าทั้ง 2 อย่างโทรสำเร็จอย่างละเท่าไหร่"*
 */

export type FollowTrendRange = { from: string; to: string };

/**
 * กี่ **คน** อยู่สายแรก / สายที่ 2 ขึ้นไป ในช่วง — นับคนด้วยเบอร์ (`phoneKey`)
 * ตามวันนัดโทร (`scheduledAt`) · สายที่ยกเลิกไม่นับ · คนเดียวมีทั้งสองแบบ = นับทั้งสองช่อง
 * (คำถามคือ "มีงานรอบไหนเท่าไหร่" ไม่ใช่การแบ่งคนเป็นก้อนเดียว)
 */
export function followRoundPeople(
  rows: readonly FollowTrendRow[],
  range: FollowTrendRange,
): { first: number; later: number } {
  const first = new Set<string>();
  const later = new Set<string>();
  for (const r of rows) {
    if (r.cancelledAt) continue;
    const y = bangkokYmd(r.scheduledAt);
    if (!y || y < range.from || y > range.to) continue;
    const key = r.phoneKey || r.id;
    if ((r.callRound ?? 1) <= 1) first.add(key);
    else later.add(key);
  }
  return { first: first.size, later: later.size };
}

/**
 * สาย + ติดต่อได้ แยกข้าง AI/คนโทร ในช่วง — "ติดต่อได้" นิยามเดียวกับหน้าติดตาม
 * (ถัง `connected` ของ `bucketOfCall` · ผลที่คนลงเองทับผลคิว เหมือน `effectiveCallOutcome`)
 * วันที่นับ = วันที่ได้ผล (คนลง = `staffCalledAt` · AI = `resultAt`) ไม่ใช่วันนัด
 */
export function followCallerStats(
  rows: readonly FollowTrendRow[],
  range: FollowTrendRange,
): Record<'ai' | 'manual', { calls: number; connected: number }> {
  const out = { ai: { calls: 0, connected: 0 }, manual: { calls: 0, connected: 0 } };
  for (const r of rows) {
    const staff = Boolean(r.staffCallOutcome);
    const y = bangkokYmd(staff ? r.staffCalledAt : r.resultAt);
    if (!y || y < range.from || y > range.to) continue;
    const b = bucketOfCall(staff ? null : r.callStatus, r.staffCallOutcome ?? r.callOutcome);
    if (b !== 'connected' && b !== 'unreached') continue;
    const side = out[r.callMode === 'manual' ? 'manual' : 'ai'];
    side.calls += 1;
    if (b === 'connected') side.connected += 1;
  }
  return out;
}
