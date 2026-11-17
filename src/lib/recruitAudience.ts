/**
 * ═══ ผู้สมัครกลุ่มไหน ได้ผลแค่ไหน — ภาพรวมงานสรรหา v2 (เจ้าของ 17 พ.ย. 2569 · แบบ ZIP v2 AUDIENCE-AND-OUTCOMES) ═══
 *
 * ฐาน = รายการสมัคร (ไม่ใช่คนไม่ซ้ำ) ในช่วงวันที่ + BU ที่เลือก
 * มิติ: ช่วงอายุ · จังหวัดที่อยู่ (ที่ผู้สมัครกรอก — ไม่ใช่จังหวัดงาน) · ช่องทางหลัก/รอง/กลุ่ม — เลือกหลายมิติ = AND
 * 5 ยอด: รายการสมัคร · สนใจหลัง AI โทร · นัดได้ · มาตามนัด · แจ้งเข้า ERP — นิยามเดิมทั้งหมด (ไม่เขียนใหม่):
 *   สนใจหลัง AI โทร = ขั้น `follow` ของ `buildPersonJourney` · นัดได้ = นัดทุกทาง (`allBooked` ของ `peopleSteps`)
 *   มาตามนัด = มีวันนัด + ผลมา (`allAttend:showed`) · ERP = `informed` (จับคู่เบอร์+ใบขอ · อ่านไม่ได้ = ไม่ทราบ)
 * % = ยอดผลของกลุ่ม / รายการสมัครของกลุ่มนั้น · รวมหลายกลุ่ม = ผลรวมตัวตั้ง / ผลรวมตัวหาร (ไม่บวก % ไม่เฉลี่ย %)
 * ไม่ทราบ = null ("—") ห้ามเป็น 0 · ตัวหาร 0 = null
 * ไฟล์นี้ pure — เทสต์ `tests/api/recruitAudience2569-11-17.test.ts`
 */
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { buildPersonJourney } from '@/lib/recruitPersonJourney';
import { FUNNEL_GROUP_LABEL, funnelPlaceOf, funnelSubOf } from '@/lib/channelFunnel';

export const AUDIENCE_MEASURES = ['apps', 'follow', 'allBooked', 'showed', 'erp'] as const;
export type AudienceMeasure = (typeof AUDIENCE_MEASURES)[number];
export const AUDIENCE_MEASURE_LABEL: Record<AudienceMeasure, string> = {
  apps: 'รายการสมัคร',
  follow: 'สนใจหลัง AI โทร',
  allBooked: 'นัดได้',
  showed: 'มาตามนัด',
  erp: 'แจ้งเข้า ERP',
};
export type AudienceDisplay = 'count' | 'rate';

/** ช่วงอายุตามแบบ (ต่ำกว่า18 / 18–25 / 26–35 / 36–45 / 46–57 / 58ขึ้นไป / ไม่ระบุ) */
export const AGE_BUCKETS = ['ต่ำกว่า 18 ปี', '18–25 ปี', '26–35 ปี', '36–45 ปี', '46–57 ปี', '58 ปีขึ้นไป', 'ไม่ระบุอายุ'] as const;
export const AGE_UNKNOWN = 'ไม่ระบุอายุ';
export const HOME_UNKNOWN = 'ไม่ระบุจังหวัด';

export function ageBucketOf(age: number | null | undefined): string {
  if (age == null || !Number.isFinite(age)) return AGE_UNKNOWN;
  if (age < 18) return AGE_BUCKETS[0];
  if (age <= 25) return AGE_BUCKETS[1];
  if (age <= 35) return AGE_BUCKETS[2];
  if (age <= 45) return AGE_BUCKETS[3];
  if (age <= 57) return AGE_BUCKETS[4];
  return AGE_BUCKETS[5];
}

export type AudienceDim = 'age' | 'home' | 'ch' | 'sub' | 'group';
export const AUDIENCE_DIM_LABEL: Record<AudienceDim, string> = {
  age: 'ช่วงอายุ',
  home: 'จังหวัดที่อยู่',
  ch: 'ช่องทาง',
  sub: 'ช่องทางรอง',
  group: 'กลุ่ม / เพจ / ที่มา',
};

/** ค่าของใบในแต่ละมิติ — ช่องทางใช้ตัวตัดสินเดิม (`funnelPlaceOf` / `funnelSubOf`) */
export function dimValueOf(f: RecruitAppFact, dim: AudienceDim): string {
  if (dim === 'age') return ageBucketOf(f.age ?? null);
  if (dim === 'home') return f.homeProvince?.trim() || HOME_UNKNOWN;
  if (dim === 'ch') return FUNNEL_GROUP_LABEL[funnelPlaceOf(f).group];
  if (dim === 'sub') return funnelPlaceOf(f).channel;
  return funnelSubOf(f);
}

/** ชุด id ของแต่ละยอด — คิดครั้งเดียวต่อประชากรทั้งก้อน แล้วตัดกลุ่มด้วย id (ไม่คิดนิยามซ้ำต่อกลุ่ม) */
export type OutcomeSets = {
  follow: ReadonlySet<string>;
  allBooked: ReadonlySet<string>;
  showed: ReadonlySet<string>;
  /** id ที่มีหลักฐานแจ้งเข้า ERP */
  erp: ReadonlySet<string>;
  /** id ที่ ERP อ่านไม่ได้/ไม่มีประวัติ — กลุ่มที่มีใบพวกนี้ = ยอด ERP ไม่ทราบ */
  erpUnknown: ReadonlySet<string>;
};

const idOf = (f: RecruitAppFact) => f.id ?? '';

export function outcomeSetsOf(list: readonly RecruitAppFact[], now: Date = new Date()): OutcomeSets {
  const follow = new Set(buildPersonJourney(list, now).find((s) => s.key === 'follow')?.ids ?? []);
  const allBooked = new Set<string>();
  const showed = new Set<string>();
  const erp = new Set<string>();
  const erpUnknown = new Set<string>();
  for (const f of list) {
    const id = idOf(f);
    if (!id) continue;
    if (f.appointmentAt) allBooked.add(id);
    if (f.appointmentAt && f.attendance === 'showed') showed.add(id);
    if (f.informed === true) erp.add(id);
    else if (f.informed == null) erpUnknown.add(id);
  }
  return { follow, allBooked, showed, erp, erpUnknown };
}

/** ใบนี้ได้ผลนั้นไหม — ERP ไม่ทราบ = null */
export function hasOutcome(f: RecruitAppFact, m: AudienceMeasure, sets: OutcomeSets): boolean | null {
  const id = idOf(f);
  if (m === 'apps') return true;
  if (m === 'erp') return sets.erpUnknown.has(id) ? null : sets.erp.has(id);
  return sets[m].has(id);
}

/**
 * ยอดของกลุ่ม — ERP: ทุกใบในกลุ่มอ่าน ERP ไม่ได้ = null ("—") · กติกาเดียวกับ `informedOf` (ห้ามโชว์ 0 เมื่ออ่านไม่ได้)
 */
export function countOf(list: readonly RecruitAppFact[], m: AudienceMeasure, sets: OutcomeSets): number | null {
  if (m === 'erp' && list.length > 0 && list.every((f) => sets.erpUnknown.has(idOf(f)))) return null;
  let n = 0;
  for (const f of list) if (hasOutcome(f, m, sets) === true) n += 1;
  return n;
}

export const rateOf = (num: number | null, den: number): number | null => (num === null || den <= 0 ? null : (num / den) * 100);

export function valueOf(list: readonly RecruitAppFact[], m: AudienceMeasure, d: AudienceDisplay, sets: OutcomeSets): number | null {
  const n = countOf(list, m, sets);
  return d === 'rate' ? rateOf(n, list.length) : n;
}

/** ตัวกรองประชากร — มิติ (AND) + ผลที่กดแล้ว (AND) · measure/display ไม่ได้อยู่ในนี้ (ไม่กรองประชากร) */
export type AudienceFilter = {
  dims: Partial<Record<AudienceDim, string>>;
  results: AudienceMeasure[];
  /** BU เดียวที่เจาะ (กดแท่ง BU) · ไม่มี = ทุก BU ในขอบเขต */
  bu?: string;
};
export const EMPTY_AUDIENCE: AudienceFilter = { dims: {}, results: [] };

export const BU_UNKNOWN = 'ไม่ระบุ BU';
export const buOfFact = (f: RecruitAppFact): string => f.bu?.trim() || BU_UNKNOWN;

export function applyAudience(list: readonly RecruitAppFact[], filter: AudienceFilter, sets: OutcomeSets): RecruitAppFact[] {
  const dims = Object.entries(filter.dims) as Array<[AudienceDim, string]>;
  return list.filter(
    (f) =>
      (!filter.bu || buOfFact(f) === filter.bu) &&
      dims.every(([dim, v]) => dimValueOf(f, dim) === v) &&
      filter.results.every((m) => hasOutcome(f, m, sets) === true),
  );
}

export type AudienceRow = {
  key: string;
  apps: number;
  counts: Record<AudienceMeasure, number | null>;
  rates: Record<AudienceMeasure, number | null>;
  ids: string[];
};

/** ค่าไม่ทราบอยู่ท้ายเสมอ (ห้ามยกเป็นผู้ชนะด้วย 0 ปลอม) · เท่ากัน = เรียงชื่อ (ลำดับแน่นอนก่อนแบ่งหน้า) */
const UNKNOWN_KEYS = new Set<string>([AGE_UNKNOWN, HOME_UNKNOWN, FUNNEL_GROUP_LABEL.unknown]);

export function audienceRows(
  list: readonly RecruitAppFact[],
  dim: AudienceDim,
  sets: OutcomeSets,
  sortBy: AudienceMeasure,
  display: AudienceDisplay,
): AudienceRow[] {
  const groups = new Map<string, RecruitAppFact[]>();
  for (const f of list) {
    const k = dimValueOf(f, dim);
    const g = groups.get(k);
    if (g) g.push(f);
    else groups.set(k, [f]);
  }
  const rows: AudienceRow[] = [...groups.entries()].map(([key, g]) => {
    const counts = Object.fromEntries(AUDIENCE_MEASURES.map((m) => [m, countOf(g, m, sets)])) as AudienceRow['counts'];
    const rates = Object.fromEntries(AUDIENCE_MEASURES.map((m) => [m, rateOf(counts[m], g.length)])) as AudienceRow['rates'];
    return { key, apps: g.length, counts, rates, ids: g.map(idOf).filter(Boolean) };
  });
  const val = (r: AudienceRow) => (display === 'rate' ? r.rates[sortBy] : r.counts[sortBy]);
  return rows.sort((a, b) => {
    const ua = UNKNOWN_KEYS.has(a.key) ? 1 : 0;
    const ub = UNKNOWN_KEYS.has(b.key) ? 1 : 0;
    if (ua !== ub) return ua - ub;
    const va = val(a);
    const vb = val(b);
    if (va === null || vb === null) return va === vb ? a.key.localeCompare(b.key, 'th') : va === null ? 1 : -1;
    return vb - va || a.key.localeCompare(b.key, 'th');
  });
}

export type BuBarValue = {
  bu: string;
  /** ค่าที่โชว์ (จำนวน หรือ %) · null = ไม่ทราบ / ตัวหาร 0 */
  value: number | null;
  /** ยอดผล (ตัวตั้ง) */
  result: number | null;
  /** รายการสมัครของ BU (ตัวหาร) */
  sample: number;
};

/** เทียบ BU ของประชากรที่เลือก — รวม % = ผลรวมตัวตั้ง / ผลรวมตัวหาร (ห้ามบวก %) */
export function buCompare(
  list: readonly RecruitAppFact[],
  bus: readonly string[],
  m: AudienceMeasure,
  d: AudienceDisplay,
  sets: OutcomeSets,
): { bars: BuBarValue[]; total: number | null; totalResult: number | null; totalSample: number } {
  const bars = bus.map((bu) => {
    const g = list.filter((f) => buOfFact(f) === bu);
    const result = countOf(g, m, sets);
    return { bu, sample: g.length, result, value: d === 'rate' ? rateOf(result, g.length) : result };
  });
  const totalResult = countOf(list, m, sets);
  return { bars, totalResult, totalSample: list.length, total: d === 'rate' ? rateOf(totalResult, list.length) : totalResult };
}

/** อายุเฉลี่ย = ผลรวมอายุที่มี / จำนวนใบที่มีอายุ (ไม่นับไม่ระบุเป็น 0 · ไม่เฉลี่ยค่าเฉลี่ย) */
export function ageStats(list: readonly RecruitAppFact[]): { average: number | null; known: number; missing: number; sum: number } {
  let sum = 0;
  let known = 0;
  for (const f of list) {
    if (f.age != null && Number.isFinite(f.age)) {
      sum += f.age;
      known += 1;
    }
  }
  return { average: known ? sum / known : null, known, missing: list.length - known, sum };
}

/** ค่าที่พบมากของมิติ (ไม่นับไม่ระบุ) — สรุปบนหัว drawer */
export function topOf(list: readonly RecruitAppFact[], dim: AudienceDim): { key: string; n: number } | null {
  const m = new Map<string, number>();
  for (const f of list) {
    const k = dimValueOf(f, dim);
    if (UNKNOWN_KEYS.has(k)) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  let best: { key: string; n: number } | null = null;
  for (const [key, n] of m) if (!best || n > best.n || (n === best.n && key.localeCompare(best.key, 'th') < 0)) best = { key, n };
  return best;
}

/** วันสมัคร (ไทย) ของใบ — แกนกราฟเวลา = cohort วันที่สมัคร (ไม่ใช่วันที่โทร) */
export const bkkDay = (iso: string): string => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

/** จำนวนผลตาม cohort วันที่สมัคร — รายวัน (YYYY-MM-DD) หรือรายเดือน (YYYY-MM) · รวมทุกช่อง = countOf ทั้งก้อน */
export function trendOf(
  list: readonly RecruitAppFact[],
  m: AudienceMeasure,
  sets: OutcomeSets,
  unit: 'day' | 'month',
): Map<string, { n: number | null; ids: string[] }> {
  const out = new Map<string, RecruitAppFact[]>();
  for (const f of list) {
    const d = bkkDay(f.createdAt);
    const k = unit === 'month' ? d.slice(0, 7) : d;
    const g = out.get(k);
    if (g) g.push(f);
    else out.set(k, [f]);
  }
  return new Map(
    [...out.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, g]) => {
        const n = countOf(g, m, sets);
        return [k, { n, ids: g.filter((f) => hasOutcome(f, m, sets) === true).map(idOf) }];
      }),
  );
}

/** แบ่งหน้า 10 แถว — คืนช่วง + จำนวนหน้า (หน้าเกิน = หน้าสุดท้าย) */
export const PAGE_SIZE = 10;
export function pageOf<T>(items: readonly T[], page: number, size = PAGE_SIZE): { slice: T[]; page: number; pages: number; from: number; to: number; total: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * size;
  const slice = items.slice(start, start + size);
  return { slice, page: p, pages, from: items.length ? start + 1 : 0, to: start + slice.length, total: items.length };
}
