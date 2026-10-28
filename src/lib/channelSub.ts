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
