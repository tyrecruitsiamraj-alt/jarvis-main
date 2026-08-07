import { TONE } from '@/lib/designTokens';
import type { MatchTier } from '@/lib/boardCandidateTypes';

/**
 * เกณฑ์สีที่ AI ใช้จัด tier ผู้สมัคร — ข้อความที่โชว์ให้คนอ่านใน tooltip
 * และชื่อ tier ที่ใช้เป็น aria-label บนการ์ด
 *
 * แยกออกจาก MatchingPage.tsx ตอนแตกไฟล์ — เป็นข้อมูลล้วนและหน้าเว็บยังต้องอ่านตรง ๆ
 * จึงอยู่ lib/ ไม่ใช่ไฟล์ component (ไฟล์ component ต้อง export แต่ component
 * ไม่งั้น eslint เพิ่ม warning react-refresh)
 *
 * ความหมายสีมาจาก token กลางที่ designTokens.ts เท่านั้น — ห้ามเขียน class สีสดที่นี่
 */
export const TIER_CRITERIA: Record<MatchTier, { label: string; detail: string; dot: string }> = {
  green: {
    label: 'เขียว — เข้าข่ายมาก',
    detail: 'ตำแหน่งตรงหรือใกล้มาก อยู่สายงานเดียวกัน หรืองานใกล้เคียงระดับเขียว',
    dot: TONE.success.dot,
  },
  yellow: {
    label: 'เหลือง — พอได้ ต้องเช็ค',
    detail: 'งานใกล้เคียงและมีโอกาสทำได้ แต่ต้องเช็คประสบการณ์จริง คุณสมบัติสำคัญ หรือการเทรนเพิ่ม',
    dot: TONE.warn.dot,
  },
  red: {
    label: 'แดง — ห่างไกล',
    detail: 'คนละสายงาน ห่างจากตำแหน่งที่ขอมาก หรือคุณสมบัติสำคัญไม่สอดคล้อง',
    dot: TONE.danger.dot,
  },
};
