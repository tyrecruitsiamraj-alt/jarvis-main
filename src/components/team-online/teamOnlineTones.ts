/**
 * สีประจำ BU / เลน Lumos ของหน้าทีม Online — อ่านจาก `TONE` เท่านั้น (ไม่มี hex ใหม่)
 * 🔴 เลี่ยงโทนที่มีความหมายของตัวเลข (success = หาได้แล้ว · warn = เหลือหา · danger = เกิน SLA) — BU เป็นแค่ "ใคร" ไม่ใช่ "ดี/เสีย"
 */
import type { ToneKey } from '@/lib/designTokens';
import type { TeamLane } from '@/lib/teamOnline';

const BU_TONE: Record<string, ToneKey> = {
  LBD: 'primary',
  LBA: 'info',
  LM: 'teal',
  DS: 'violet',
  SN: 'orange',
  CR: 'neutral',
};

export const toneOfBu = (bu: string): ToneKey => BU_TONE[bu] ?? 'neutral';

export const LANE_TONE: Record<TeamLane, ToneKey> = {
  public: 'info',
  match: 'violet',
  follow: 'teal',
  other: 'neutral',
};
