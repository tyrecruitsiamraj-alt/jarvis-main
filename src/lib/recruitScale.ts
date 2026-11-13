/**
 * ═══ ภาพรวมงานสรรหาแบบ Scale ลง (เจ้าของ 13 พ.ย. 2569) ═══
 * > *"เปิดมาปุ้บเป็นภาพใหญ่ พอกดอะไรก็ Scale ลงไปเรื่อยๆ"* · *"มันต้องดูแนวโน้มได้ด้วย เพิ่มหรือลด"* · แบบร่างแล้ว "ทำมาก่อนเลย"
 * แถบบนสุด 6 ช่อง = ข้อ 1–6 · กดช่อง = ข้อนั้นขึ้นโซนเดียวใต้แถบ · ทุกเลขเทียบช่วงก่อน (ช่วงวันเท่ากัน · `win.prevFrom/prevTo`)
 * ตัวตัดสินทิศ = `deltaOf` ที่เดียว (กราฟเทียบช่วงก่อน 21 ต.ค. 2569) · คำ เพิ่มขึ้น / ลดลง / ทรงตัว ตาม `uiWords.ts`
 */
import { deltaOf } from './recruitCompare';
import { cohortOf, trimLastDayToNow } from './recruitOverview';
import type { RecruitAppFact, RecruitOverviewResponse } from './recruitOverviewTypes';

export type ScaleSectionKey = 'todo' | 'done' | 'src' | 'ch' | 'fb' | 'self' | 'area' | 'mon' | 'why';

/** หัวข้อเป็นคำของเจ้าของเอง — ห้ามแก้คำ */
export const SCALE_TITLES: Record<ScaleSectionKey, string> = {
  todo: '1. ใครต้องทำอะไร',
  done: '2. ทำแล้วเป็นไง',
  src: '3. ที่มามาจากใคร',
  ch: '4. ช่องทางไหนทำได้ดี',
  fb: '5. โพสต์ลงกลุ่ม Facebook',
  self: '6. โพสต์เอง',
  area: 'พื้นที่ที่เหลือหา',
  mon: 'เทียบเดือน',
  why: 'เหตุผลที่ไม่สำเร็จ',
};
/** ช่องบนแถบ (ภาพใหญ่) · ที่เหลือเป็นปุ่มใต้แถบ */
export type ScaleStripKey = 'todo' | 'done' | 'src' | 'ch' | 'fb' | 'self';
export const SCALE_STRIP: readonly ScaleStripKey[] = ['todo', 'done', 'src', 'ch', 'fb', 'self'];
export const SCALE_MORE: readonly ScaleSectionKey[] = ['area', 'mon', 'why'];
export const isScaleSection = (v: string | null | undefined): v is ScaleSectionKey => Boolean(v && Object.prototype.hasOwnProperty.call(SCALE_TITLES, v));

/** ทิศของตัวเลข: เพิ่มแล้วดี (เขียว) · เพิ่มแล้วแย่ (แดง) · ไม่ตัดสิน (สีปกติ) */
export type TrendSense = 'good' | 'bad' | 'plain';

export type Trend =
  | { kind: 'none' }
  | { kind: 'same' }
  /** ช่วงก่อน 0 ช่วงนี้มี */
  | { kind: 'new' }
  | { kind: 'up' | 'down'; diff: number; pct: number; prev: number };

/** เทียบช่วงนี้กับช่วงก่อน — null ฝั่งใดฝั่งหนึ่ง = เทียบไม่ได้ (ห้ามยุบเป็น 0) */
export function trendOf(cur: number | null | undefined, prev: number | null | undefined): Trend {
  const c = cur ?? null;
  const p = prev ?? null;
  const d = deltaOf(c, p);
  if (d.kind === 'up' || d.kind === 'down') return { kind: d.kind, diff: Math.abs((c as number) - (p as number)), pct: d.pct, prev: p as number };
  return { kind: d.kind };
}

/** สีของทิศ: เพิ่ม/ลด กับความหมายของตัวเลข · ทรงตัว/เทียบไม่ได้ = ไม่มีสี */
export function trendTone(t: Trend, sense: TrendSense): 'good' | 'bad' | null {
  if (sense === 'plain' || t.kind === 'none' || t.kind === 'same') return null;
  const up = t.kind === 'up' || t.kind === 'new';
  return up === (sense === 'good') ? 'good' : 'bad';
}

/**
 * ตัวเลขที่เพิ่งเริ่มนับ — ช่วงก่อนเริ่มก่อนวันนี้ = เทียบไม่ได้ (เลข 0 ของช่วงก่อนเป็นเลขโกหก)
 * โพสต์แล้ว (มีลิงก์โพสต์วางกลับ) เริ่มแยก 13 พ.ย. 2569 · คลิก / กดสมัคร เริ่มนับ 10 พ.ย. 2569
 */
export const MANUAL_POSTED_SINCE = '2026-11-13';
export const LINK_CLICKS_SINCE = '2026-11-10';
/** ปุ่มสั่ง Autopost ไป So Scraping ขึ้นเว็บ 20 ต.ค. 2569 — ช่วงก่อนหน้านั้นไม่มีทางมีคำสั่ง */
export const SO_POST_SINCE = '2026-10-20';
export const comparableSince = (prevFrom: string, since: string) => prevFrom >= since;

/**
 * รายชื่อช่วงก่อน — กติกาเดียวกับกราฟเทียบช่วงเดิม (`overviewViewOf`):
 * เทียบเฉพาะตอนข้อมูลมีครบทั้งช่วงก่อน (ข้อมูลเริ่มกลางช่วง = null "เทียบไม่ได้" ห้ามขึ้นเพิ่มขึ้นพันเปอร์เซ็นต์)
 * · ช่วงที่ยังไม่จบ ตัดวันท้ายของช่วงก่อนที่เวลาเดียวกับตอนนี้ · เลือก "ทั้งหมด" = ไม่มีช่วงก่อน
 */
export function prevCohortOf(
  apps: readonly RecruitAppFact[],
  win: RecruitOverviewResponse['window'],
  firstDay: string | null | undefined,
  generatedAt: string,
): RecruitAppFact[] | null {
  if (win.all || !firstDay || firstDay > win.prevFrom) return null;
  const list = win.isCurrent ? trimLastDayToNow(apps, win.prevTo, generatedAt) : apps;
  return cohortOf(list, win.prevFrom, win.prevTo);
}
