/**
 * ═══ ตัวคิด Dashboard ติดตามเริ่มงาน ═══
 *
 * 🔴 นิยามยืมจากตัวกลางเท่านั้น (หนึ่งเมตริกหนึ่งนิยาม):
 * - ผลโทร → ถัง (โทรติด/ไม่ติด/ยกเลิก/รอ) = `bucketOfCall` (`callOutcomeBuckets.ts`)
 * - "ไปตามนัดจริง" = `FOLLOW_OUTCOME_SUCCESS` (went · arrived · done) ตัวเดียวกับ /api/home-kpis
 * - ป้ายไทย = `FOLLOW_OUTCOME_LABEL` · `followCallOutcomeText` (คำของงานติดตาม ไม่ใช่ สนใจ/ไม่สนใจ)
 *
 * แต่ละตัวเลขนับตาม **วันที่ของเหตุการณ์นั้นเอง** (ลงรายชื่อ = วันลง · โทรแล้ว = วันที่ได้ผลโทร ·
 * ปิดงาน = วันที่ปิด) — ห้ามเอาวันลงรายชื่อไปนับผลที่เกิดทีหลัง (สัปดาห์นี้จะดูแย่ สัปดาห์ก่อนจะดูดีเกินจริง)
 */
import { FOLLOW_CALL_CATEGORY_LABEL, type FollowCallCategory } from '@/lib/followPlanning';
import { FOLLOW_MATRIX_ROW_LABEL, followMatrixColOfCategory, type FollowMatrixCol } from '@/lib/followCallMatrix';
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
  // 🔴 คำของ "ปิดงาน" (ต่อคน) แยกจากคำของผลโทร (ต่อสาย: ตอบว่าไป…) — 6 ต.ค. 2569 ไม่ให้ต้องเดาว่าตัวไหนคือตัวไหน
  success: 'ปิดงานว่าไปแล้ว',
  dropped: 'ปิดงานว่าไม่ไป · ยกเลิก · ลา',
  cancelledEntry: 'ยกเลิกการติดตาม',
};

/** ผลปิดงานที่แปลว่า "ไม่สำเร็จ" (ชุดใหม่ + ชุดเก่า) — เลื่อน/อื่น ๆ ไม่นับทั้งสำเร็จและไม่สำเร็จ */
const FOLLOW_DROPPED: readonly string[] = ['cancelled', 'leave', 'job_cancelled', 'no_show_start'];

const isSuccess = (code: string | null) => Boolean(code && (FOLLOW_OUTCOME_SUCCESS as readonly string[]).includes(code));

/** สายที่โทรแล้วมีผล (ช่องของแผง: ไป · ไม่ไป · ไม่รับสาย · สรุปไม่ได้) */
const CALLED_CATEGORIES: ReadonlySet<FollowCallCategory> = new Set(['agreed', 'lost', 'unreachable', 'other']);
/** มีคนรับ = โทรแล้ว ยกเว้นไม่รับสาย */
const ANSWERED_CATEGORIES: ReadonlySet<FollowCallCategory> = new Set(['agreed', 'lost', 'other']);

/**
 * ═══ ช่องของแผงขั้นตอนของสาย ในช่วงที่เลือก (ตามวันนัดโทร) — เลขชุดเดียวกับหน้าติดตาม (6 ต.ค. 2569) ═══
 * ทั้งหมด = ไป + ไม่ไป + ไม่รับสาย + สรุปไม่ได้ + รอโทร + ยกเลิก
 */
export function followMatrixInRange(
  rows: readonly FollowTrendRow[],
  range: { from: string; to: string },
): Record<Exclude<FollowMatrixCol, 'total'>, number> & { total: number } {
  const out = { total: 0, went: 0, notWent: 0, noAnswer: 0, unclear: 0, waiting: 0, cancelled: 0 };
  for (const r of rows) {
    const y = bangkokYmd(r.scheduledAt);
    if (!y || y < range.from || y > range.to) continue;
    out.total += 1;
    out[followMatrixColOfCategory(r.category)] += 1;
  }
  return out;
}

/** วันที่ (ปฏิทินกรุงเทพ) ที่แถวนี้นับเข้าตัวเลขนั้น · `null` = แถวนี้ไม่นับ */
export function followEventYmd(row: FollowTrendRow, metric: FollowMetric): string | null {
  switch (metric) {
    case 'registered':
      return bangkokYmd(row.createdAt);
    /**
     * 🔴 6 ต.ค. 2569: นับจากหมวดกลางตามวันนัดโทร (ตัวเดียวกับแผงขั้นตอนของสายบนหน้าติดตาม)
     * โทรแล้ว = ไป + ไม่ไป + ไม่รับสาย + สรุปไม่ได้ · ติดต่อได้ = ไป + ไม่ไป + สรุปไม่ได้ (มีคนรับ)
     */
    case 'called':
      return CALLED_CATEGORIES.has(row.category) ? bangkokYmd(row.scheduledAt) : null;
    case 'connected':
      return ANSWERED_CATEGORIES.has(row.category) ? bangkokYmd(row.scheduledAt) : null;
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

/**
 * ตัวเลขที่ตอบเป็น **คน** (ลงติดตาม · ปิดงาน · ไปถึงแล้ว · ยกเลิก/ลา/ไม่ไป · ยกเลิกการติดตาม)
 * ส่วน "โทรแล้ว / ติดต่อได้" ตอบเป็น **สาย** — นับทีละแถวเหมือนเดิม
 */
export const FOLLOW_PERSON_METRICS: ReadonlySet<FollowMetric> = new Set<FollowMetric>([
  'registered',
  'completed',
  'success',
  'dropped',
  'cancelledEntry',
]);

/** หนึ่งคน = เบอร์ 9 ตัวท้าย + หัวข้อ (ชุดเดียวกับการ์ดต่อคนของหน้าติดตาม) · ไม่มีเบอร์ = แถวนั้นนับเป็นหนึ่งคน */
export function followTrendPersonKey(row: FollowTrendRow): string {
  return row.phoneKey ? `${row.phoneKey}|${(row.topic ?? '').trim()}` : `id:${row.id}`;
}

/**
 * ═══ วันที่ที่ "นับ" ของแต่ละแถว — แบบนับคนไม่ซ้ำ ═══
 *
 * 🔴 QA 5 ต.ค. 2569: การ์ดเขียน "ไปถึงแล้ว 791 คน · ยกเลิก 34 คน · ลงติดตาม 2,248 ราย" แต่นับทีละแถว
 * (1 คนมีหลายสาย ⇒ ปิดงานทีเดียวได้หลายแถว) ของจริงราว 162 / 16 / 312 คน
 * ⇒ ตัวเลขแบบคน นับเฉพาะแถวแรกของคนนั้น (วันที่ของเหตุการณ์เร็วสุด) · ตัวเลขแบบสายคืนวันที่ตามเดิม
 * การ์ด · กราฟ · ตารางแยกมิติ · ตารางเจ้าหน้าที่ ต้องใช้ตัวนี้ตัวเดียว เลขถึงจะตรงกันทั้งจอ
 */
export function followCountedYmd(rows: readonly FollowTrendRow[]): (row: FollowTrendRow, metric: FollowMetric) => string | null {
  const counted = new Map<FollowMetric, Set<string>>();
  for (const m of FOLLOW_PERSON_METRICS) {
    const first = new Map<string, { id: string; ymd: string }>();
    for (const r of rows) {
      const y = followEventYmd(r, m);
      if (!y) continue;
      const k = followTrendPersonKey(r);
      const cur = first.get(k);
      if (!cur || y < cur.ymd) first.set(k, { id: r.id, ymd: y });
    }
    counted.set(m, new Set([...first.values()].map((v) => v.id)));
  }
  return (row, metric) => {
    const y = followEventYmd(row, metric);
    if (!y) return null;
    const ids = counted.get(metric);
    return !ids || ids.has(row.id) ? y : null;
  };
}

export type FollowDim = 'bu' | 'team' | 'unit' | 'staff' | 'topic' | 'round' | 'mode' | 'outcome' | 'callOutcome';

export const FOLLOW_DIM_LABEL: Record<FollowDim, string> = {
  bu: 'BU',
  team: 'แท็บ',
  unit: 'หน่วยงาน',
  staff: 'เจ้าหน้าที่',
  topic: 'หัวข้อ',
  round: 'สายที่',
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
      return (r) => FOLLOW_MATRIX_ROW_LABEL[r.slot];
    case 'team':
      return (r) => (r.team === 'replacement' ? 'ติดตามส่งคนแทน' : 'ติดตามคนเริ่มงาน');
    case 'mode':
      return (r) => (r.callMode === 'manual' ? 'เจ้าหน้าที่โทรเอง' : 'AI โทร');
    case 'outcome':
      return (r) => (r.outcomeCode ? FOLLOW_OUTCOME_LABEL[r.outcomeCode as FollowOutcomeAny] ?? r.outcomeCode : 'ยังไม่ปิดงาน');
    case 'callOutcome':
      // คำของหมวดเดียวกับป้ายบนหน้าติดตาม (6 ต.ค. 2569)
      return (r) => FOLLOW_CALL_CATEGORY_LABEL[r.category];
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
    // ยกเลิก = ช่องยกเลิกของแผง · สายที่ = followRoundSlot (ตัวเดียวกับหน้าติดตาม · 6 ต.ค. 2569)
    if (r.category === 'cancelled') continue;
    const y = bangkokYmd(r.scheduledAt);
    if (!y || y < range.from || y > range.to) continue;
    const key = followTrendPersonKey(r);
    if (r.slot === 1) first.add(key);
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
    // หมวดกลาง + วันนัดโทร (6 ต.ค. 2569) ⇒ AI + คน = "โทรแล้ว" ของแถวบนพอดี
    const y = bangkokYmd(r.scheduledAt);
    if (!y || y < range.from || y > range.to) continue;
    if (!CALLED_CATEGORIES.has(r.category)) continue;
    const side = out[r.callMode === 'manual' ? 'manual' : 'ai'];
    side.calls += 1;
    if (ANSWERED_CATEGORIES.has(r.category)) side.connected += 1;
  }
  return out;
}
