/**
 * ═══ ช่องทาง 3 ชั้น: แพลตฟอร์ม → ประเภท → ชื่อเพจ/กลุ่ม/Ads (หน้าหลัก แท็บใบขอ · เจ้าของ 22 ต.ค. 2569) ═══
 * > *"facebook 500 tiktok 500 ออฟไลน์ 500 · กดเข้าไปที่ facebook แยกเป็น facebook group facebook ads facebook page ·
 * > กดที่ facebook page ก็มีบอกว่า page ไหนเยอะ … Tiktok ก็เหมือนกัน ออฟไลน์เช่นกัน"*
 * ชั้นล่าง 2 ชั้นคือ `ChannelPlacement` เดิม (ช่องทาง → กลุ่มย่อย) · ไฟล์นี้เติมชั้นบนสุด
 * 🔴 ทุกแถวต้องลงแพลตฟอร์มใดแพลตฟอร์มหนึ่ง (ไม่รู้จัก = "อื่น ๆ") ⇒ ผลรวมทุกชั้นเท่ากันเสมอ (มีเทสต์)
 */
import { UNKNOWN_CHANNEL, mainChannelOf, type ChannelPlacement } from './channelPlacement';
import { appliedYmd, channelOf } from './recruitOverview';
import type { RecruitAppFact } from './recruitOverviewTypes';

export type PlatformKey = 'facebook' | 'tiktok' | 'line' | 'web' | 'offline' | 'other' | 'unknown';

export const PLATFORM_LABEL: Record<PlatformKey, string> = {
  facebook: 'Facebook',
  tiktok: 'TikTok',
  line: 'LINE',
  web: 'เว็บหางาน',
  offline: 'ออฟไลน์',
  other: 'อื่น ๆ',
  unknown: 'ไม่รู้ช่องทาง',
};

/** ช่องทางที่ไม่ได้มาจากออนไลน์ — คนแนะนำ · ป้าย · เจ้าหน้าที่ · คนเก่า */
const OFFLINE = /ป้าย|ใบปลิว|แนะนำ|เพื่อน|ญาติ|ผู้ประสานงาน|จนท\.|เจ้าหน้าที่|พนักงานเก่า|โอนมา|สำนักงานใหญ่|walk\s*in|call\s*in/i;
const WEB = /jobthai|jobbkk|jobsdb|job\s*db|internet|google/i;

export function platformOf(channel: string): PlatformKey {
  const ch = channel.trim();
  if (!ch || ch === UNKNOWN_CHANNEL || /^ไม่ระบุ$/.test(ch)) return 'unknown';
  if (/^facebook/i.test(ch)) return 'facebook';
  if (/^tiktok/i.test(ch)) return 'tiktok';
  if (/^line\b/i.test(ch)) return 'line';
  if (WEB.test(ch)) return 'web';
  if (OFFLINE.test(ch)) return 'offline';
  return 'other';
}

export type PlatformRow = {
  key: PlatformKey;
  label: string;
  registered: number;
  placed: number;
  types: ChannelPlacement['rows'];
};

const ORDER: PlatformKey[] = ['facebook', 'tiktok', 'line', 'web', 'offline', 'other', 'unknown'];

/** แพลตฟอร์มเรียงตามลงงานมากไปน้อย (ไม่รู้ช่องทางท้ายสุด) · แพลตฟอร์มไม่มีเลยไม่ขึ้น */
export function buildPlatforms(cp: ChannelPlacement): PlatformRow[] {
  const map = new Map<PlatformKey, PlatformRow>();
  for (const row of cp.rows) {
    const key = platformOf(row.channel);
    const p = map.get(key) ?? { key, label: PLATFORM_LABEL[key], registered: 0, placed: 0, types: [] };
    p.registered += row.registered;
    p.placed += row.placed;
    p.types.push(row);
    map.set(key, p);
  }
  return [...map.values()]
    .map((p) => ({ ...p, types: [...p.types].sort((a, b) => b.placed - a.placed || b.registered - a.registered) }))
    .sort((a, b) =>
      a.key === 'unknown' ? 1 : b.key === 'unknown' ? -1 : b.placed - a.placed || b.registered - a.registered || ORDER.indexOf(a.key) - ORDER.indexOf(b.key),
    );
}

/**
 * ═══ สนใจ / นัดได้ ต่อช่องทาง (หน้าหลักผู้บริหารข้อ 9 · เจ้าของ 24 ต.ค. 2569) ═══
 * > *"ช่องทางไหนคนกรอกมาเยอะ ช่องทางไหนคนสนใจเยอะ ช่องทางไหนนัดได้เยอะ ช่องทางไหนลงงานได้เยอะ"*
 * นับจากใบสมัครในระบบเราที่กรอกในช่วง (ใบที่ดึงจาก iRecruit ไม่มีผลโทร/นัดในระบบเรา) · ชื่อช่องทางผ่าน `mainChannelOf` ชุดเดียวกับตาราง
 * สนใจ = AI ได้ผลสนใจ หรือเจ้าหน้าที่ลงว่าสนใจ หรือมีนัด · นัดได้ = มีนัด
 */
export type ChannelInterest = { interested: number; appointed: number };
export function channelInterestOf(
  facts: ReadonlyArray<Pick<RecruitAppFact, 'createdAt' | 'channelLabel' | 'referralSource' | 'aiAnswer' | 'staffAnswer' | 'appointmentAt'>>,
  from: string,
  to: string,
): { byType: Map<string, ChannelInterest>; byPlatform: Map<PlatformKey, ChannelInterest> } {
  const byType = new Map<string, ChannelInterest>();
  const byPlatform = new Map<PlatformKey, ChannelInterest>();
  for (const f of facts) {
    const d = appliedYmd(f);
    if (!d || d < from || d > to) continue;
    const interested = f.aiAnswer === 'said_yes' || f.staffAnswer === 'said_yes' || Boolean(f.appointmentAt);
    const appointed = Boolean(f.appointmentAt);
    if (!interested && !appointed) continue;
    const type = mainChannelOf(channelOf(f), null);
    for (const [map, key] of [
      [byType, type],
      [byPlatform, platformOf(type)],
    ] as const) {
      const cur = (map as Map<string, ChannelInterest>).get(key) ?? { interested: 0, appointed: 0 };
      if (interested) cur.interested += 1;
      if (appointed) cur.appointed += 1;
      (map as Map<string, ChannelInterest>).set(key, cur);
    }
  }
  return { byType, byPlatform };
}
