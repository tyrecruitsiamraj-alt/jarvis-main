/**
 * สีประจำ BU / เลน Lumos ของหน้าทีม Online — อ่านจาก `TONE` เท่านั้น (ไม่มี hex ใหม่)
 * 🔴 เลี่ยงโทนที่มีความหมายของตัวเลข (success = หาได้แล้ว · warn = เหลือหา · danger = เกิน SLA) — BU เป็นแค่ "ใคร" ไม่ใช่ "ดี/เสีย"
 */
import type { ToneKey } from '@/lib/designTokens';
import type { TeamLane } from '@/lib/teamOnline';

/** เลือกให้ต่างกันชัดทั้งสองโหมด — โหมดมืด primary (blue-300) กับ info (sky-300) แทบเป็นสีเดียวกัน ⇒ ไม่ใช้คู่กันกับ BU หลัก */
const BU_TONE: Record<string, ToneKey> = {
  LBD: 'primary',
  LBA: 'teal',
  LM: 'orange',
  DS: 'violet',
  SN: 'info',
  CR: 'neutral',
};

export const toneOfBu = (bu: string): ToneKey => BU_TONE[bu] ?? 'neutral';

export const LANE_TONE: Record<TeamLane, ToneKey> = {
  public: 'info',
  match: 'violet',
  follow: 'teal',
  other: 'neutral',
};
