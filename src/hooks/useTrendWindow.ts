import { useMemo, useState } from 'react';
import {
  bangkokYmd,
  defaultRange,
  previousRange,
  sameRangeLastYear,
  type TrendGrain,
} from '@/lib/trends/timeBuckets';

export type TrendCompareMode = 'previous' | 'lastYear';

export const TREND_COMPARE_OPTIONS: readonly { value: TrendCompareMode; label: string }[] = [
  { value: 'previous', label: 'เทียบช่วงก่อน' },
  { value: 'lastYear', label: 'เทียบปีก่อน' },
];

export type TrendWindow = {
  grain: TrendGrain;
  setGrain: (g: TrendGrain) => void;
  /** ช่วงที่ดูอยู่ (รวมหัวท้าย) */
  range: { from: string; to: string };
  /** ช่วงที่เอามาเทียบ (ยาวเท่ากัน) */
  previous: { from: string; to: string };
  compare: TrendCompareMode;
  setCompare: (m: TrendCompareMode) => void;
  /** ช่วงที่คนเลือกเอง · null = ช่วงตั้งต้นของงวดนั้น */
  custom: { from: string; to: string } | null;
  setCustom: (r: { from: string; to: string } | null) => void;
  today: string;
  /** วันแรกที่ต้องดึงข้อมูล (ครอบทั้งช่วงที่ดูและช่วงที่เทียบ) */
  fetchFrom: string;
};

/**
 * ช่วงเวลาของแท็บ Dashboard — เปลี่ยนงวด = กลับไปใช้ช่วงตั้งต้นของงวดนั้น (30 วัน · 12 สัปดาห์ · 12 เดือน …)
 * ⚠️ เก็บในหน้า (ไม่ผูก URL) — เป็นมุมมองของคนที่นั่งดู ไม่ใช่ของลิงก์ (แบบเดียวกับช่วงวันที่สมัคร)
 */
export function useTrendWindow(
  initialGrain: TrendGrain = 'day',
  /**
   * ความยาวช่วงตั้งต้นต่องวด (ไม่ส่ง = ของแท็บ Dashboard: 30 วัน · 12 สัปดาห์ …)
   * หน้าทีม Online ส่ง `{ day: 7 }` — เจ้าของสั่ง 29 ก.ย. 2569 *"ค่า Default ย้อนหลัง 7 วัน"*
   */
  spans?: Partial<Record<TrendGrain, number>>,
): TrendWindow {
  const today = bangkokYmd(new Date()) as string;
  const [grain, setGrainState] = useState<TrendGrain>(initialGrain);
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [compare, setCompare] = useState<TrendCompareMode>('previous');
  const span = spans?.[grain];
  return useMemo(() => {
    const range = custom ?? defaultRange(grain, today, span);
    const previous = compare === 'lastYear' ? sameRangeLastYear(range.from, range.to) : previousRange(range.from, range.to);
    return {
      grain,
      setGrain: (g: TrendGrain) => {
        setGrainState(g);
        setCustom(null);
      },
      range,
      previous,
      compare,
      setCompare,
      custom,
      setCustom,
      today,
      fetchFrom: previous.from < range.from ? previous.from : range.from,
    };
  }, [grain, custom, compare, today, span]);
}
