/**
 * ═══ ช่องทางรองของผู้สมัคร — ตัวกรอง "ช่องทาง" ในแท็บผู้สมัคร (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"Tiktok 138 · TikTok 49 ต่างกันยังไง"* → Choice ตัวกรอง *"ขึ้นแค่ช่องทางรอง"*
 * ช่องทางหลักเหลือ 4 (Facebook · Tiktok · Webjob · Offline · จัดที่ /recruit/channels)
 *
 * ป้ายช่องทางมาได้หลายรูป:
 *   - ตัวเลือกใหม่ "หลัก · รอง" เช่น "Tiktok · Tiktok Live" → รอง
 *   - ป้ายเก่าก่อนจัด 4 หลัก "Facebook Group · กลุ่มหางาน…" (รองเดิมคือกลุ่ม) → "Facebook Group"
 *   - iRecruit "iRecruit · Line" → "Line" · "iRecruit" เดี่ยว ๆ คงไว้
 *   - ผู้สมัครเลือกเองในฟอร์มเก่า (5 ค่า) → ชื่อเดียวกับหน้าช่องทาง (TikTok → Tiktok · ใบปลิว → ป้าย/ใบปลิว)
 * สะกดต่างแค่ตัวเล็กใหญ่ = ตัวเดียวกัน (ใช้ตัวสะกดของหน้าช่องทาง)
 */
import type { ApplicationReferralSource } from '@/lib/publicApplicationsApi';

/** ช่องทางหลัก 4 ตัวที่เจ้าของเคาะ — ป้ายที่ขึ้นต้นด้วยชื่อพวกนี้ ช่องทางรองคือคำถัดไป */
export const MAIN_CHANNEL_NAMES = ['Facebook', 'Tiktok', 'Webjob', 'Offline'] as const;

const REFERRAL_AS_CHANNEL: Record<ApplicationReferralSource, string> = {
  facebook: 'Facebook',
  tiktok: 'Tiktok',
  instagram: 'Instagram',
  flyer: 'ป้าย/ใบปลิว',
  other: 'อื่นๆ',
  line_oa: 'LINE OA',
};

/** ตัวสะกดมาตรฐานของชื่อที่เจอบ่อย — สะกดต่างแค่ตัวเล็กใหญ่ */
const CANONICAL = new Map<string, string>([
  ['tiktok', 'Tiktok'],
  ['facebook', 'Facebook'],
  ['ใบปลิว', 'ป้าย/ใบปลิว'],
]);

const isMain = (s: string) => MAIN_CHANNEL_NAMES.some((m) => m.toLowerCase() === s.toLowerCase());

/** ช่องทางรองของใบ · ไม่มีอะไรเลย = '' (ตัวกรองนับเป็น "ไม่ระบุ") */
export function subChannelOf(label: string | null | undefined, referral: string | null | undefined): string {
  let parts = String(label ?? '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    const r = referral as ApplicationReferralSource | null | undefined;
    return r && r in REFERRAL_AS_CHANNEL ? REFERRAL_AS_CHANNEL[r] : '';
  }
  if (parts.length > 1 && parts[0].toLowerCase() === 'irecruit') parts = parts.slice(1);
  const pick = parts.length > 1 && isMain(parts[0]) ? parts[1] : parts[0];
  return CANONICAL.get(pick.toLowerCase()) ?? pick;
}

/**
 * ═══ เส้นทางช่องทาง หลัก › รอง › กลุ่ม — ตัวกรอง "ช่องทาง" แบบเป็นชั้น (เจ้าของ 25 พ.ย. 2569) ═══
 * > *"เอาเป็นช่องทางหลัก เลือกอันไหนค่อยโชว์ช่องทางรอง แล้วถ้าเลือกช่องทางรองแล้วในนั้นมีไรเพิ่มก็ค่อยลงมาอีก"*
 * (แทนข้อ 28 ต.ค. "ขึ้นแค่ช่องทางรอง")
 * - "หลัก · รอง · กลุ่ม" ตามตัวเลือกช่องทาง · ป้ายเก่าไม่มีหลักแต่ขึ้นต้นด้วยชื่อหลัก ("Facebook Group · กลุ่ม…") → หลักตามชื่อนั้น
 * - iRecruit · Scrap และป้ายอื่นที่ไม่ใช่ 4 หลัก = เป็นหลักของตัวเอง · ไม่มีป้าย = ที่ผู้สมัครเลือกเอง (เป็นหลัก)
 * - คืน [] = ไม่รู้ช่องทาง (ตัวกรองนับเป็น "ไม่ระบุ")
 */
export function channelPathOf(label: string | null | undefined, referral: string | null | undefined): string[] {
  const canon = (s: string) => CANONICAL.get(s.toLowerCase()) ?? s;
  const parts = String(label ?? '')
    .split(' · ')
    .map((p) => canon(p.trim()))
    .filter(Boolean);
  if (parts.length === 0) {
    const r = referral as ApplicationReferralSource | null | undefined;
    return r && r in REFERRAL_AS_CHANNEL ? [REFERRAL_AS_CHANNEL[r]] : [];
  }
  const head = parts[0];
  const main = MAIN_CHANNEL_NAMES.find((m) => m.toLowerCase() === head.toLowerCase());
  if (main) return [main, ...collapse(parts.slice(1))];
  const prefixed = MAIN_CHANNEL_NAMES.find((m) => head.toLowerCase().startsWith(`${m.toLowerCase()} `));
  if (prefixed) return [prefixed, ...collapse(parts)];
  return [head, ...collapse(parts.slice(1))];
}

/** เหลือไม่เกิน 2 ชั้นใต้หลัก (รอง · กลุ่ม) — ชั้นที่ลึกกว่านั้นต่อท้ายชั้นกลุ่ม */
function collapse(rest: string[]): string[] {
  if (rest.length <= 2) return rest;
  return [rest[0], rest.slice(1).join(' · ')];
}
