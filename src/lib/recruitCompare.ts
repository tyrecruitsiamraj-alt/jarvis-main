/**
 * ═══ กราฟเทียบช่วงก่อนของหน้าภาพรวม (เจ้าของ 21 ต.ค. 2569) ═══
 * > *"ดูยากอะ อยากได้เป็นกราฟเชิงเปรียบเทียบว่า เพิ่มขึ้นลดลง"* · Choice "เทียบเดือนก่อน แท่งคู่ + ▲▼"
 * แถวละขั้น: ช่วงนี้ vs ช่วงก่อน (ช่วงวันเท่ากัน — เดือนปัจจุบันตัดวันท้ายของเดือนก่อนตามเวลาเดียวกับตอนนี้)
 * ตัวเลขชุดเดียวกับการ์ดรายละเอียด (`totalsOf` · `toRequestSummary`) — ห้ามคิดใหม่ที่นี่
 */
import { appliedYmd, isAiCalledReached, isAiSaidYes, isFollowedReached, isStaffFollowed, type RecruitTotals } from './recruitOverview';
import type { RecruitAppFact, RecruitRequestDay, RecruitRequestSummary } from './recruitOverviewTypes';
import type { OverviewTabId } from './recruitOverviewTabs';

export type CompareRow = { key: string; label: string; unit: string; cur: number | null; prev: number | null };

export type CompareDelta =
  | { kind: 'up' | 'down'; pct: number }
  | { kind: 'same' }
  /** ช่วงก่อนเป็น 0 แต่ช่วงนี้มี */
  | { kind: 'new' }
  /** เทียบไม่ได้ (ไม่มีข้อมูลช่วงก่อน/อ่านไม่ได้) */
  | { kind: 'none' };

export function deltaOf(cur: number | null, prev: number | null): CompareDelta {
  if (cur === null || prev === null) return { kind: 'none' };
  if (cur === prev) return { kind: 'same' };
  if (prev === 0) return { kind: 'new' };
  const pct = Math.round(((cur - prev) / prev) * 1000) / 10;
  return { kind: cur > prev ? 'up' : 'down', pct: Math.abs(pct) };
}

/** แถวของแต่ละแท็บ — ลำดับตามเส้นทางของแท็บนั้น */
export function compareRowsOf(
  tab: OverviewTabId,
  cur: RecruitTotals,
  prev: RecruitTotals | null,
  req: RecruitRequestSummary | null | undefined,
  reqPrev: RecruitRequestSummary | null | undefined,
): CompareRow[] {
  const t = (k: keyof RecruitTotals, label: string): CompareRow => ({
    key: k,
    label,
    unit: 'คน',
    cur: cur[k] as number | null,
    prev: prev ? (prev[k] as number | null) : null,
  });
  const r = (k: keyof RecruitRequestSummary, label: string): CompareRow => ({
    key: k,
    label,
    unit: 'ใบ',
    cur: req ? req[k] : null,
    prev: reqPrev ? reqPrev[k] : null,
  });
  switch (tab) {
    case 'requests':
      return [r('total', 'ใบขอเข้ามา'), r('released', 'ประกาศแล้ว'), r('releasedWithApps', 'มีคนสมัคร')];
    case 'apps':
      return [t('names', 'กรอกเข้ามา'), t('calledByAi', 'AI โทรแล้ว'), t('aiCalledReached', 'ติดต่อได้')];
    case 'staff':
      return [t('aiSaidYes', 'ตอบ AI ว่าสนใจ'), t('staffFollowed', 'คนโทรต่อ'), t('followedReached', 'คนโทรติดต่อได้')];
    case 'appt':
      return [t('appointed', 'นัดหมาย'), t('showed', 'มาตามนัด')];
  }
}

// ─── กราฟรายวันของช่วงที่กด (เจ้าของ 21 ต.ค. 2569 "พอกดเดือนไหนก็เป็นวันของเดือนนั้นๆ แบบ interactive") ───


/** ตัวชี้วัดของผู้สมัครรายคน — เงื่อนไขเดียวกับ `totalsOf` ทุกตัว */
const FACT_METRIC: Record<string, (f: RecruitAppFact) => boolean> = {
  names: () => true,
  calledByAi: (f) => f.calledByAi,
  reached: (f) => f.contact === 'success',
  aiSaidYes: isAiSaidYes,
  staffFollowed: isStaffFollowed,
  reachedByStaff: (f) => f.contact === 'success' && f.contactBy === 'staff',
  aiCalledReached: isAiCalledReached,
  followedReached: isFollowedReached,
  appointed: (f) => !!f.appointmentAt,
  showed: (f) => f.attendance === 'showed',
};

const REQUEST_METRIC: Record<string, keyof Omit<RecruitRequestDay, 'day'>> = {
  total: 'total',
  released: 'released',
  releasedWithApps: 'releasedWithApps',
};

const DAY_MS = 86_400_000;
/** ทุกวันจาก from ถึง to (YYYY-MM-DD) */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return out;
  for (let t = a; t <= b && out.length < 400; t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** ยอดรายวันของตัวชี้วัดหนึ่งในช่วง from–to · วันที่ไม่มี = 0 (กราฟไม่หาย) · ตัวชี้วัดไม่รู้จัก = [] */
export function dailySeriesOf(
  key: string,
  from: string,
  to: string,
  facts: readonly RecruitAppFact[],
  requestDays: readonly RecruitRequestDay[] | null | undefined,
): Array<{ day: string; n: number }> {
  const days = daysBetween(from, to);
  const reqKey = REQUEST_METRIC[key];
  if (reqKey) {
    const by = new Map((requestDays ?? []).map((d) => [d.day, d[reqKey]]));
    return days.map((day) => ({ day, n: by.get(day) ?? 0 }));
  }
  const pred = FACT_METRIC[key];
  if (!pred) return [];
  const by = new Map<string, number>();
  for (const f of facts) {
    const d = appliedYmd(f);
    if (!d || d < from || d > to || !pred(f)) continue;
    by.set(d, (by.get(d) ?? 0) + 1);
  }
  return days.map((day) => ({ day, n: by.get(day) ?? 0 }));
}
