/**
 * ═══ การ์ด "ช่องทางไหนได้ผล" หน้าหลัก = กราฟเทียบ 4 ช่องทางหลัก (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"เอาเป็นช่องทางหลักเลย แบบเป็นกราฟเชิงเปรียบเทียบ · กรอกเยอะ เทียบเลย 4 ช่องทาง พอกดแล้วค่อยไปดู Detail ข้างใน
 * > กด facebook ก็โชว์ว่า ช่องทางรองของ facebook อย่างละเท่าไหร่ · 4 ก้อนนี้เอาเป็น Dropdown"*
 * 4 หลักชุดเดียวกับหน้าช่องทาง (/recruit/channels · `MAIN_CHANNEL_NAMES`):
 *   Facebook (Ads · Group · Page) · Tiktok (Tiktok · Live · Line AI LBD/LBA) · Webjob (Google Ads · Jobthai · JobDb · JobBkk · Jobfinfin · Linkin)
 *   · Offline (เจ้าหน้าที่แนะนำ · บอกต่อ · ป้าย/ใบปลิว · พนักงานเก่า · พนักงานแนะนำ · Academe)
 * 🔴 ไม่เข้า 4 หลัก = "อื่น ๆ" (ขึ้นเมื่อมีคน) ⇒ ผลรวมแท่ง = ผลรวมทุกช่องทางเสมอ (มีเทสต์)
 */
import { MAIN_CHANNEL_NAMES } from './channelSub';

export type FourMain = (typeof MAIN_CHANNEL_NAMES)[number] | 'อื่น ๆ';
export const FOUR_MAIN_OTHER = 'อื่น ๆ' as const;

const WEB = /webjob|jobthai|jobbkk|jobsdb|job\s*db|jobfinfin|jonfinfin|linkedin|linkin|google|internet/i;
const OFFLINE =
  /offline|ป้าย|ใบปลิว|แนะนำ|บอกต่อ|เพื่อน|ญาติ|ผู้ประสานงาน|จนท\.|เจ้าหน้าที่|พนักงานเก่า|โอนมา|สำนักงานใหญ่|academe|walk\s*in|call\s*in/i;

/** ช่องทางหลักของชื่อช่องทาง (ชื่อจาก `mainChannelOf` ของตารางช่องทาง) */
export function fourMainOf(channel: string): FourMain {
  const ch = channel.trim();
  if (/^facebook/i.test(ch)) return 'Facebook';
  if (/^tiktok/i.test(ch) || /line\s*ai/i.test(ch)) return 'Tiktok';
  if (WEB.test(ch)) return 'Webjob';
  if (OFFLINE.test(ch)) return 'Offline';
  return FOUR_MAIN_OTHER;
}

export type FourMainRow = { main: FourMain; value: number; subs: Array<{ name: string; value: number }> };

/**
 * แท่งของ 4 หลัก (ลำดับตามหน้าช่องทาง แม้เป็น 0) + "อื่น ๆ" ต่อท้ายเมื่อมีคน · ช่องทางรองเรียงมากไปน้อย ตัด 0
 */
export function fourMainRows(items: ReadonlyArray<{ name: string; value: number }>): FourMainRow[] {
  const map = new Map<FourMain, FourMainRow>(
    [...MAIN_CHANNEL_NAMES, FOUR_MAIN_OTHER].map((m) => [m, { main: m, value: 0, subs: [] }]),
  );
  for (const it of items) {
    if (!(it.value > 0)) continue;
    const row = map.get(fourMainOf(it.name))!;
    row.value += it.value;
    row.subs.push({ name: it.name, value: it.value });
  }
  return [...map.values()]
    .filter((r) => r.main !== FOUR_MAIN_OTHER || r.value > 0)
    .map((r) => ({ ...r, subs: [...r.subs].sort((a, b) => b.value - a.value) }));
}
