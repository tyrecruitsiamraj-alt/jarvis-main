/**
 * ═══ ตัวเลขรายวันงานสรรหา (เจ้าของสั่ง 15 ต.ค. 2569) ═══
 * > *"วันนี้คนกรอกมาเท่าไหร่ โทรไปแล้วเท่าไหร่ สนใจเท่าไหร่ ไม่สนใจเท่าไหร่ อยากรู้ค่าเฉลี่ยต่อวันด้วย"*
 * Choice: วันนี้ + เฉลี่ย + กราฟแท่งรายวัน · พับได้บนแท็บผู้สมัคร · ค่าเฉลี่ยเลือกช่วงได้
 *
 * 🔴 นับตามวันที่กรอก (cohort) — ทุกช่องเป็นส่วนหนึ่งของ "กรอกมา" ของวันนั้น เลขจึงไม่เกินกัน
 *    ใบที่ข้อเท็จจริงมาจาก `/api/recruit-overview` ชุดเดียวกับภาพรวมงานสรรหา (ไม่นับ Lead · นิยามเดียวกัน)
 *    AI โทรแล้ว = `calledByAi` · สนใจ/ไม่สนใจ/ไม่รับสาย = คำตอบล่าสุดที่ให้ AI (`aiAnswer`)
 * ค่าเฉลี่ย = ช่วงที่เลือก ไม่นับวันนี้ (วันนี้ยังไม่จบ) · ไม่นับวันก่อนมีใบสมัครใบแรก (`firstDay`) — ระบบเริ่มใช้กลางช่วง
 *   วันว่างก่อนเริ่มจะดึงค่าเฉลี่ยลงทั้งที่ไม่ใช่วันที่ไม่มีคนสมัคร
 */
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { appliedYmd } from '@/lib/recruitOverview';

export type RecruitDailyKey = 'names' | 'aiCalled' | 'saidYes' | 'saidNo' | 'noPickup';

export const RECRUIT_DAILY_KEYS: readonly RecruitDailyKey[] = ['names', 'aiCalled', 'saidYes', 'saidNo', 'noPickup'];

export const RECRUIT_DAILY_LABEL: Record<RecruitDailyKey, string> = {
  names: 'กรอกมา',
  aiCalled: 'AI โทรแล้ว',
  saidYes: 'สนใจ',
  saidNo: 'ไม่สนใจ',
  noPickup: 'ไม่รับสาย',
};

export type RecruitDailyRow = { ymd: string } & Record<RecruitDailyKey, number>;

export type RecruitDailyWindow = '7d' | '30d' | 'month';

export const RECRUIT_DAILY_WINDOW_LABEL: Record<RecruitDailyWindow, string> = {
  '7d': '7 วัน',
  '30d': '30 วัน',
  month: 'เดือนนี้',
};

const DAY_MS = 86_400_000;
export const addDaysYmd = (ymd: string, n: number) =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** ทุกวันใน [from, to] — วันที่ไม่มีใคร = แถว 0 (กราฟไม่ขาดช่วง) */
export function recruitDailyRows(apps: readonly RecruitAppFact[], from: string, to: string): RecruitDailyRow[] {
  const rows = new Map<string, RecruitDailyRow>();
  for (let d = from; d <= to && rows.size < 62; d = addDaysYmd(d, 1)) {
    rows.set(d, { ymd: d, names: 0, aiCalled: 0, saidYes: 0, saidNo: 0, noPickup: 0 });
  }
  for (const f of apps) {
    const r = rows.get(appliedYmd(f) ?? '');
    if (!r) continue;
    r.names += 1;
    if (f.calledByAi) r.aiCalled += 1;
    if (f.aiAnswer === 'said_yes') r.saidYes += 1;
    else if (f.aiAnswer === 'said_no') r.saidNo += 1;
    else if (f.aiAnswer === 'no_pickup') r.noPickup += 1;
  }
  return [...rows.values()];
}

/** วันแรกของช่วงเฉลี่ย (ไม่นับวันนี้) — เดือนนี้ที่วันนี้เป็นวันที่ 1 = ไม่มีวันให้เฉลี่ย */
export function recruitDailyWindowFrom(win: RecruitDailyWindow, today: string): string {
  if (win === '7d') return addDaysYmd(today, -7);
  if (win === '30d') return addDaysYmd(today, -30);
  return `${today.slice(0, 7)}-01`;
}

export type RecruitDailySummary = {
  today: RecruitDailyRow;
  /** เฉลี่ยต่อวันของช่วง (ปัดเป็นจำนวนเต็ม) — ช่วงว่าง = null */
  avg: Record<RecruitDailyKey, number> | null;
  /** จำนวนวันที่ใช้เฉลี่ย */
  days: number;
  /** แถวที่โชว์บนกราฟ = ช่วงที่เลือก + วันนี้ */
  chart: RecruitDailyRow[];
};

export function recruitDailySummary(
  rows: readonly RecruitDailyRow[],
  today: string,
  win: RecruitDailyWindow,
  firstDay: string | null = null,
): RecruitDailySummary {
  const windowFrom = recruitDailyWindowFrom(win, today);
  const from = firstDay && firstDay > windowFrom ? firstDay : windowFrom;
  const past = rows.filter((r) => r.ymd >= from && r.ymd < today);
  const todayRow =
    rows.find((r) => r.ymd === today) ?? { ymd: today, names: 0, aiCalled: 0, saidYes: 0, saidNo: 0, noPickup: 0 };
  const avg =
    past.length === 0
      ? null
      : (Object.fromEntries(
          RECRUIT_DAILY_KEYS.map((k) => [k, Math.round(past.reduce((n, r) => n + r[k], 0) / past.length)]),
        ) as Record<RecruitDailyKey, number>);
  return { today: todayRow, avg, days: past.length, chart: [...past, todayRow] };
}
