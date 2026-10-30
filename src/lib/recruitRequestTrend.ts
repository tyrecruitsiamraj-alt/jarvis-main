/**
 * ═══ การ์ด "แนวโน้มใบขอ" นับชุดเดียวกับการ์ด "ใบขอเข้ามา" ด้านบน (QA 30 ต.ค. 2569 · เจ้าของ "ให้กราฟนับเหมือนการ์ดบน") ═══
 * เดิมการ์ดนี้ใช้ยอดจากเซิร์ฟเวอร์ (ประกาศแล้ว 104 · ปิดไปแล้ว 210) ส่วนการ์ดบนนับจากใบรายใบ (ประกาศ 89 · ปิด 225)
 * ⇒ คิดจากใบรายใบ (`RecruitRequestRow`) ตัวแบ่งเดียวกับ `buildRequestFunnel` · ตามตัวกรองบนสุดด้วย (ใบที่ส่งเข้ามาคือชุดที่กรองแล้ว)
 * ยกเลิก + ปิดแล้ว + ยังไม่ประกาศ + ประกาศแล้ว ไม่มีคนกรอก + ประกาศแล้ว มีคนกรอก = ใบขอเข้ามา · ไฟล์นี้ pure
 */
import { onlineRequestStateOf } from '@/lib/homeOnline';
import { REQUEST_FUNNEL_LABEL, type RecruitRequestRow } from '@/lib/recruitRequestTab';
import type { CompareRow } from '@/lib/recruitCompare';

export type RequestTrendBucket = 'cancelled' | 'closed' | 'notReleased' | 'releasedNoApps' | 'releasedWithApps';
export const REQUEST_TREND_BUCKETS: readonly RequestTrendBucket[] = ['cancelled', 'closed', 'notReleased', 'releasedNoApps', 'releasedWithApps'];

/** ถังของใบ — ตัวแบ่งเดียวกับการ์ดบน (`buildRequestFunnel`) */
export function requestTrendBucketOf(r: RecruitRequestRow): RequestTrendBucket {
  const s = onlineRequestStateOf(r);
  if (s === 'open') return !r.released ? 'notReleased' : r.applications > 0 ? 'releasedWithApps' : 'releasedNoApps';
  return s === 'cancelledAll' ? 'cancelled' : 'closed';
}

const countOf = (rows: readonly RecruitRequestRow[]) => {
  const out: Record<RequestTrendBucket | 'total', number> = { total: rows.length, cancelled: 0, closed: 0, notReleased: 0, releasedNoApps: 0, releasedWithApps: 0 };
  for (const r of rows) out[requestTrendBucketOf(r)] += 1;
  return out;
};

/** กล่องบนการ์ด — ชื่อเดียวกับการ์ดบน · ช่วงก่อนไม่มี = เทียบไม่ได้ */
export function requestTrendRows(cur: readonly RecruitRequestRow[] | null, prev: readonly RecruitRequestRow[] | null): CompareRow[] {
  const c = cur ? countOf(cur) : null;
  const p = prev ? countOf(prev) : null;
  const apps = cur ? cur.reduce((n, r) => n + (requestTrendBucketOf(r) === 'releasedWithApps' ? r.applications : 0), 0) : null;
  const row = (key: RequestTrendBucket | 'total', label: string): CompareRow => ({ key, label, unit: 'ใบ', cur: c ? c[key] : null, prev: p ? p[key] : null });
  return [
    row('total', REQUEST_FUNNEL_LABEL.all),
    row('cancelled', REQUEST_FUNNEL_LABEL.cancelled),
    row('closed', REQUEST_FUNNEL_LABEL.closed),
    row('notReleased', REQUEST_FUNNEL_LABEL.notReleased),
    row('releasedNoApps', REQUEST_FUNNEL_LABEL.releasedNoApps),
    { ...row('releasedWithApps', REQUEST_FUNNEL_LABEL.releasedWithApps), extra: apps === null ? null : `${apps.toLocaleString('th-TH')} คน` },
  ];
}

/** รายวันของกล่องนั้น (วันที่ใบส่งเข้ามา) — วันที่ไม่มีใบ = 0 */
export function requestTrendSeries(key: string, from: string, to: string, rows: readonly RecruitRequestRow[] | null): Array<{ day: string; n: number }> {
  const by = new Map<string, number>();
  for (const r of rows ?? []) {
    if (!r.day || r.day < from || r.day > to) continue;
    if (key !== 'total' && requestTrendBucketOf(r) !== key) continue;
    by.set(r.day, (by.get(r.day) ?? 0) + 1);
  }
  const out: Array<{ day: string; n: number }> = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    out.push({ day, n: by.get(day) ?? 0 });
  }
  return out;
}
