import type { ToneKey } from '@/lib/designTokens';
import type { LumosJobCallSummaryRow } from '@/lib/lumosDispatchApi';

/**
 * ชิป "ทำต่อเลย" บนการ์ดใบขอ — มองปุ๊บรู้ว่าก้าวถัดไปคืออะไร โดยไม่ต้องเปิดใบ
 * เรียงตามความสำคัญ: มีคนสนใจ (ปิดงานได้) > ไม่รับสาย (โทรซ้ำ) > มีคนพร้อมส่งโทร >
 * รอผลโทร > ไม่มีคนแนะนำ (ส่งต่อทีมอื่น) · ใบที่ AI ยังไม่ประเมิน = ไม่เดา ไม่ขึ้นชิป
 *
 * แยกออกจาก MatchingPage.tsx ตอนแตกไฟล์ — เป็นฟังก์ชันล้วน จึงอยู่ lib/ ไม่ใช่ไฟล์ component
 * (ไฟล์ component ต้อง export แต่ component ไม่งั้น eslint เพิ่ม warning react-refresh)
 */
export function cardNextAction(
  matchCount: number | undefined,
  s: LumosJobCallSummaryRow | undefined,
): { text: string; tone: ToneKey } | null {
  const confirmed = s?.confirmed ?? 0;
  const noAnswer = s?.no_answer ?? 0;
  const sent = s?.sent ?? 0;
  const pendingApproval = s?.pendingApproval ?? 0;
  const needsHuman = s?.needsHuman ?? 0;
  const waiting = s ? Math.max(0, s.sent - s.called) : 0;
  if (confirmed > 0)
    return { text: `มีคนสนใจ ${confirmed} — กดจองตัวเลย`, tone: 'success' };
  // ติดขั้นอนุมัติ = งานหยุดอยู่ตรงนั้นจริง ๆ ต้องขึ้นก่อน "ไม่รับสาย" ที่ยังเดินต่อได้เอง
  if (pendingApproval > 0)
    return { text: `รออนุมัติ ${pendingApproval} คน — ยังไม่เริ่มโทร`, tone: 'orange' };
  if (needsHuman > 0)
    return { text: `ต้องคนตาม ${needsHuman} — AI สุดมือแล้ว`, tone: 'orange' };
  if (noAnswer > 0) return { text: `ไม่รับสาย ${noAnswer} — ควรโทรซ้ำ`, tone: 'warn' };
  if ((matchCount ?? 0) > 0 && sent === 0)
    return { text: `AI แนะนำ ${matchCount} — เลือกคนส่ง AI โทร`, tone: 'info' };
  if (waiting > 0) return { text: `รอผลโทร ${waiting} สาย`, tone: 'neutral' };
  if (matchCount === 0)
    return { text: 'ไม่มีคนแนะนำ — ส่งคิด Content / Scraping', tone: 'danger' };
  return null;
}
