/**
 * ═══ ตัวคิด Dashboard ใบขอ + ปล่อยประกาศ ═══
 *
 * 🔴 **สองมุมที่ต้องแยกป้ายให้ชัด — ห้ามปนกัน** (กติกาโปรเจกต์ + ตัวเลขจริง 28 ก.ย. 2569)
 *
 * 1. **ตามงวดของใบ (cohort)** — นิยามเดียวกับ Dashboard ศูนย์ควบคุมใบขอเป๊ะ (`listSiamrajSqlServerThroughput`)
 *    งวดของใบ = วันที่ต้องการคน → วันที่กรอก (เจ้าของเคาะ 20 ส.ค. 2569) · แต่ละงวดแตกเป็น
 *    หาได้แล้ว + ยกเลิก + เหลือหา = ขอมา · ⚠️ งวดล่าสุดยังไม่ปิด "หาได้แล้ว" จึงต่ำเสมอ (ไม่ใช่ทีมแย่ลง)
 *
 * 2. **ตามวันที่เกิดจริง (activity)** — ผู้บริหารถาม "สัปดาห์นี้ทีมหาคนได้กี่คน"
 *    - ขอเข้ามา = วันที่กรอกใบ (submitted) · หาได้แล้ว = **วันที่แจ้งเข้าจริง** (st_inform_head.inform_date)
 *    - ยกเลิก = วันปิด/ยกเลิกของส่วนที่ยกเลิก
 *    - งานค้างรายงวด = สมการหลัก: ยอดยกมา + ขอใหม่ − หาได้แล้ว − ยกเลิก = เหลือหา
 *
 * ⚠️ **ยอด "หาได้แล้ว" สองมุมไม่เท่ากันเสมอไป** — cohort ใช้ inform_qty ของใบ (ถ้ามี) ส่วน activity นับใบแจ้งเข้า
 *    ที่มีวันที่ · ส่วนต่าง = อัตราที่ไม่มีวันที่แจ้งเข้า ⇒ ต้องติดธง `snapshot_fallback` (กติกาโปรเจกต์ข้อ 4)
 *    แล้วโชว์ส่วนต่างให้เห็น ห้ามกลบ
 */
import { LIFECYCLE_KIND_LABELS, type LifecycleKind } from '@/lib/dashboard/lifecycle';
import { REQUEST_LEAD_KIND_LABEL, type RequestLeadKind } from '@/lib/requestLeadKind';
import { bangkokYmd, bucketKey, bucketLabel, bucketRange, daysBetween, inRange, type TrendGrain } from './timeBuckets';
import { trendBuLabel } from './bu';
import type { InformTrendRow, ReleaseTrendRow, RequestTrendRow } from './types';

export type RequestDim = 'bu' | 'lifecycle' | 'lead' | 'unit';

export const REQUEST_DIM_LABEL: Record<RequestDim, string> = {
  bu: 'BU',
  lifecycle: 'ประเภทใบขอ',
  lead: 'ความเร่ง',
  unit: 'หน่วยงาน',
};

export function requestDimGetter(dim: RequestDim): (row: RequestTrendRow) => string {
  switch (dim) {
    case 'bu':
      return (r) => trendBuLabel(r.departmentCode);
    case 'lifecycle':
      return (r) => LIFECYCLE_KIND_LABELS[(r.lifecycleKind as LifecycleKind) ?? 'other'] ?? 'อื่นๆ';
    case 'lead':
      return (r) => (r.leadKind ? REQUEST_LEAD_KIND_LABEL[r.leadKind as RequestLeadKind] ?? r.leadKind : 'ไม่ระบุ');
    case 'unit':
      return (r) => r.unitName ?? r.siteCode ?? 'ไม่ระบุ';
  }
}

export type CohortPoint = {
  key: string;
  label: string;
  requested: number;
  filled: number;
  cancelled: number;
  remaining: number;
};

/** มุม cohort — ยอดต่องวดของใบ (หาได้แล้ว + ยกเลิก + เหลือหา = ขอมา ทุกงวด) */
export function cohortSeries(
  rows: readonly RequestTrendRow[],
  range: { from: string; to: string },
  grain: TrendGrain,
): CohortPoint[] {
  const keys = bucketRange(range.from, range.to, grain);
  const acc = new Map<string, CohortPoint>(
    keys.map((k) => [k, { key: k, label: bucketLabel(k, grain), requested: 0, filled: 0, cancelled: 0, remaining: 0 }]),
  );
  for (const r of rows) {
    if (!inRange(r.cohortDate, range.from, range.to)) continue;
    const p = acc.get(bucketKey(r.cohortDate, grain));
    if (!p) continue;
    p.requested += r.positions;
    p[r.kind] += r.positions;
  }
  return keys.map((k) => acc.get(k) as CohortPoint);
}

export type ActivityPoint = {
  key: string;
  label: string;
  /** ขอเข้ามา (วันที่กรอกใบ) */
  added: number;
  /** หาได้แล้ว (วันที่แจ้งเข้าจริง) */
  informed: number;
  /** ยกเลิก (วันที่ปิด/ยกเลิก) */
  cancelled: number;
  /** งานค้างปลายงวด = ยอดยกมา + ขอใหม่ − หาได้แล้ว − ยกเลิก */
  backlog: number;
};

export type ActivityLedger = {
  points: ActivityPoint[];
  /** เหลือหาจริงตอนนี้ (ผลรวม "เหลือหา" ของทุกใบที่ยังเปิด) */
  openNow: number;
  /** งานค้างตามสมการ ณ ปลายช่วง — ควรใกล้ `openNow` */
  ledgerEnd: number;
  /**
   * อัตราที่ "หาได้แล้ว" ตามสถานะใบขอ แต่ไม่มีวันที่แจ้งเข้า (ส่วนต่างสองมุม)
   * > 0 ⇒ ต้องติดธง snapshot_fallback — ยอดรายงวดของ "หาได้แล้ว" ขาดไปเท่านี้
   */
  undatedFilled: number;
};

/** วันที่ของเหตุการณ์ "ขอเข้ามา" — วันที่กรอก (ไม่มี = ใช้งวดของใบ) */
const addedYmd = (r: RequestTrendRow) => r.submittedDate ?? r.cohortDate;

/**
 * มุม activity + งานค้างตามสมการ
 *
 * ยอดยกมาต้นช่วง = ของที่เกิดก่อน `range.from` ทั้งหมด (ขอ − หาได้ − ยกเลิก) จากข้อมูลที่โหลดมา
 * ⚠️ ข้อมูลเริ่มที่งวด `dataFrom` — ใบที่เก่ากว่านั้นไม่อยู่ในยอด (ตั้ง dataFrom ย้อนไกลพอเสมอ)
 */
export function activityLedger(
  rows: readonly RequestTrendRow[],
  informs: readonly InformTrendRow[],
  range: { from: string; to: string },
  grain: TrendGrain,
): ActivityLedger {
  const keys = bucketRange(range.from, range.to, grain);
  const acc = new Map<string, ActivityPoint>(
    keys.map((k) => [k, { key: k, label: bucketLabel(k, grain), added: 0, informed: 0, cancelled: 0, backlog: 0 }]),
  );
  // ขอบเขตของใบที่นับ — แจ้งเข้าของใบนอกชุด (เช่น ถูกกรอง BU ออก) ต้องไม่ถูกนับ
  const known = new Set(rows.map((r) => r.requestNo));
  let carried = 0;
  const add = (ymd: string | null, field: 'added' | 'informed' | 'cancelled', n: number) => {
    if (!ymd || ymd > range.to) return;
    if (ymd < range.from) {
      carried += field === 'added' ? n : -n;
      return;
    }
    const p = acc.get(bucketKey(ymd, grain));
    if (p) p[field] += n;
  };

  const requestedByReq = new Map<string, number>();
  const filledByReq = new Map<string, number>();
  let openNow = 0;
  for (const r of rows) {
    requestedByReq.set(r.requestNo, (requestedByReq.get(r.requestNo) ?? 0) + r.positions);
    add(addedYmd(r), 'added', r.positions);
    if (r.kind === 'cancelled') add(r.closureDate ?? r.cohortDate, 'cancelled', r.positions);
    if (r.kind === 'filled') filledByReq.set(r.requestNo, (filledByReq.get(r.requestNo) ?? 0) + r.positions);
    if (r.kind === 'remaining') openNow += r.positions;
  }

  // หาได้แล้วตามวันที่แจ้งเข้า — ต่อใบไม่เกินที่ใบนั้น "หาได้แล้ว" ตามสถานะ (กันนับใบแจ้งเข้าซ้ำ/เกินที่ขอ)
  const informsByReq = new Map<string, InformTrendRow[]>();
  for (const i of informs) {
    if (!known.has(i.requestNo)) continue;
    const list = informsByReq.get(i.requestNo) ?? [];
    list.push(i);
    informsByReq.set(i.requestNo, list);
  }
  let undatedFilled = 0;
  for (const [req, filled] of filledByReq) {
    let left = filled;
    const list = (informsByReq.get(req) ?? []).slice().sort((a, b) => a.day.localeCompare(b.day));
    for (const i of list) {
      if (left <= 0) break;
      const n = Math.min(i.count, left);
      add(i.day, 'informed', n);
      left -= n;
    }
    undatedFilled += left;
  }

  let running = carried;
  const points = keys.map((k) => {
    const p = acc.get(k) as ActivityPoint;
    running += p.added - p.informed - p.cancelled;
    p.backlog = running;
    return p;
  });
  return { points, openNow, ledgerEnd: running, undatedFilled };
}

/** ปล่อยรวดเดียวหลายใบ (คนเดียว นาทีเดียว ≥ 10 ใบ) — เช่นปุ่ม "ปล่อยทั้งหน้า" เดิม 25 ส.ค. 2569 (176 ใบ) */
export type ReleaseBatch = { day: string; staffName: string; count: number };

/** นับเป็น "รวดเดียว" เมื่อคนเดียวกดปล่อยในนาทีเดียวกันตั้งแต่เท่านี้ใบ */
export const RELEASE_BATCH_MIN = 10;

export type ReleaseStats = {
  /** จำนวนใบที่ปล่อยในช่วง */
  released: number;
  /**
   * 🔴 ปล่อยรวดเดียวในช่วงนี้ — ต้องบอกให้เห็น ไม่งั้นเทียบช่วงก่อนแล้วดูเหมือนทีมหยุดทำงาน
   * (วัดจริง 28 ก.ย. 2569: 25 ส.ค. ปล่อย 176 ใบในนาทีเดียว · ก.ย. ทั้งเดือนปล่อย 1 ใบ)
   */
  batches: ReleaseBatch[];
  /** ขอ → ปล่อยใช้กี่วัน (มัธยฐาน) — null = ไม่มีใบที่รู้วันกรอก */
  medianDaysToRelease: number | null;
  /** ใบที่ปล่อยภายใน 3 วันหลังกรอกใบ (สัดส่วน) */
  within3Days: number | null;
};

/** ปล่อยประกาศในช่วง + ใช้กี่วันจากวันกรอกใบถึงวันปล่อย */
export function releaseStats(
  releases: readonly ReleaseTrendRow[],
  requests: readonly RequestTrendRow[],
  range: { from: string; to: string },
): ReleaseStats {
  const submitted = new Map<string, string>();
  for (const r of requests) if (r.submittedDate && !submitted.has(r.requestNo)) submitted.set(r.requestNo, r.submittedDate);
  const inR = releases.filter((x) => inRange(bangkokYmd(x.releasedAt), range.from, range.to));
  const days: number[] = [];
  for (const x of inR) {
    const s = x.requestNo ? submitted.get(x.requestNo) : undefined;
    const rel = bangkokYmd(x.releasedAt);
    if (!s || !rel) continue;
    days.push(Math.max(0, daysBetween(s, rel)));
  }
  days.sort((a, b) => a - b);
  const median = days.length
    ? days.length % 2
      ? days[(days.length - 1) / 2]
      : Math.round(((days[days.length / 2 - 1] + days[days.length / 2]) / 2) * 10) / 10
    : null;
  const perMinute = new Map<string, { day: string; staffName: string; count: number }>();
  for (const x of inR) {
    const k = `${x.staffId ?? x.staffName ?? '?'}|${x.releasedAt.slice(0, 16)}`;
    const cur = perMinute.get(k) ?? { day: bangkokYmd(x.releasedAt) ?? '', staffName: x.staffName ?? 'ไม่ระบุ', count: 0 };
    cur.count += 1;
    perMinute.set(k, cur);
  }
  const batches = [...perMinute.values()].filter((b) => b.count >= RELEASE_BATCH_MIN).sort((a, b) => b.count - a.count);
  return {
    released: inR.length,
    batches,
    medianDaysToRelease: median,
    within3Days: days.length ? days.filter((d) => d <= 3).length / days.length : null,
  };
}
