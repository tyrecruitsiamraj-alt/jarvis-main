import type { ToneKey } from '@/lib/designTokens';
import type { LumosJobCallSummaryRow } from '@/lib/lumosDispatchApi';

/**
 * ช่องตัวเลข "ผลโทรในใบนี้" ของการ์ดใบขอ — แยกออกจาก LumosPanels.tsx เพราะไฟล์
 * component ห้าม export อะไรนอกจาก component (eslint react-refresh · baseline 16 warning)
 *
 * ⚠️ **หัวใจของไฟล์นี้คือ "6 ช่องเสมอ ไม่ว่าข้อมูลจะเป็นอะไร"**
 * เดิมแถบนี้ประกอบช่องตามข้อมูลที่มี (5–8 ช่อง) แต่ละช่องเป็น flex-1 หารตามจำนวนช่องจริง
 * → เลขของการ์ดสองใบไม่ตรงคอลัมน์กัน กวาดตาลงมาแล้วเทียบข้ามใบไม่ได้
 * เจ้าของสั่ง 13 ส.ค. 2569: "ทุกใบก็ต้องเหมือนกันสิกันงง · ข้อมูลไม่เท่ากันก็คงมันไว้ให้ตรงกัน"
 * ช่องที่โผล่เฉพาะตอนมีค่า (รออนุมัติ/ขอเลื่อน/ต้องคนตาม) ย้ายไปเป็นชิปในแถวที่จองไว้แทน
 */

/** ลำดับช่องตามที่งานเดินจริง — ห้ามสลับ ตำแหน่งเลขต้องตรงกันทุกการ์ด (มีเทสต์คุม) */
export const LUMOS_FIXED_STAT_ORDER = [
  'sent',
  'called',
  'waiting',
  'confirmed',
  'declined',
  'no_answer',
] as const;

export type LumosStatCellKey = (typeof LUMOS_FIXED_STAT_ORDER)[number];

export type LumosStatCell = {
  key: LumosStatCellKey;
  label: string;
  value: number;
  /** คืน token ไม่ใช่ชื่อคลาส — ผู้เรียกทำ TONE[tone].value เอง (ห้ามประกอบชื่อคลาสจากตัวแปร) */
  tone: ToneKey;
  title: string;
};

export type LumosStatChip = {
  key: 'pendingApproval' | 'reschedule' | 'needsHuman';
  label: string;
  value: number;
  tone: ToneKey;
  title: string;
};

/**
 * 6 ช่องคงที่ — ใบที่ยังไม่เคยส่งโทร (หรือไม่มีแถวสรุปเลย) ได้ 0 ทั้งแถว ไม่ใช่แถบว่าง
 * ⚠️ ห้ามใส่เงื่อนไข "ไม่มีข้อมูลแล้วคืนสั้นลง" กลับเข้ามา — นั่นคือบั๊กเดิมที่ทำให้
 * การ์ดขึ้นหัวข้อ "ผลโทรในใบนี้" แล้วใต้หัวข้อว่างเปล่า (เกิดจริงกับใบที่มีแถวในคิว
 * แต่ถูกยกเลิกหมด → sent = 0 ทั้งที่ object มีอยู่)
 */
export function lumosFixedStatCells(s?: LumosJobCallSummaryRow): LumosStatCell[] {
  const sent = s?.sent ?? 0;
  const called = s?.called ?? 0;
  // ข้อมูลเพี้ยนจาก race (called > sent) ต้องไม่ทำให้โชว์เลขติดลบ
  const waiting = Math.max(0, sent - called);
  return [
    { key: 'sent', label: 'ส่ง', value: sent, tone: 'neutral', title: 'ส่งเข้าคิว AI โทรแล้ว (ไม่นับที่ยกเลิก)' },
    { key: 'called', label: 'โทรแล้ว', value: called, tone: 'primary', title: 'มีผลโทรกลับมาจริง' },
    { key: 'waiting', label: 'เหลือ', value: waiting, tone: 'warn', title: 'รอ AI โทร (ส่งแล้วยังไม่มีผลกลับ)' },
    { key: 'confirmed', label: 'โอเค', value: s?.confirmed ?? 0, tone: 'success', title: 'สนใจงาน' },
    { key: 'declined', label: 'ไม่ไป', value: s?.declined ?? 0, tone: 'danger', title: 'ไม่สนใจ/ปฏิเสธ' },
    { key: 'no_answer', label: 'ไม่รับ', value: s?.no_answer ?? 0, tone: 'warn', title: 'ไม่รับสาย — ควรโทรซ้ำ' },
  ];
}

/**
 * ช่องพิเศษที่เดิมเบียดเข้าไปในแถบ — คืนเฉพาะตัวที่มีค่าจริง ไปขึ้นเป็นชิปในแถวที่จองไว้
 * (ถ้าโชว์ตลอดจะได้ 0 อยู่ 3 ช่องแทบทุกใบ กวาดตาแล้วหาของจริงไม่เจอ — เหตุผลเดิมยังใช้ได้
 * เปลี่ยนแค่ที่อยู่ของมัน ไม่ให้ไปทำให้ความกว้างของ 6 ช่องหลักขยับ)
 */
export function lumosExtraStatChips(s?: LumosJobCallSummaryRow): LumosStatChip[] {
  if (!s) return [];
  const chips: LumosStatChip[] = [];
  if (s.pendingApproval > 0)
    chips.push({
      key: 'pendingApproval',
      label: 'รออนุมัติ',
      value: s.pendingApproval,
      tone: 'orange',
      title: 'ตั้งชุดไว้แล้วแต่ยังไม่ได้โทร — รอคนกดอนุมัติ (หรืออยู่ในช่วงถอนคำ 10 นาที)',
    });
  if (s.reschedule > 0)
    chips.push({
      key: 'reschedule',
      label: 'ขอเลื่อน',
      value: s.reschedule,
      tone: 'warn',
      title: 'ผู้สมัครขอให้โทรกลับ — นัดเวลาใหม่ไว้แล้ว',
    });
  if (s.needsHuman > 0)
    chips.push({
      key: 'needsHuman',
      label: 'ต้องคนตาม',
      value: s.needsHuman,
      tone: 'orange',
      title: 'AI โทรจนสุดมือแล้ว (ครบเพดาน / เบอร์ผิด) — ต้องให้คนตามต่อ',
    });
  return chips;
}

/**
 * ยอดคนในใบ (ติดต่อ/จอง/ลงงาน) — ที่ไปของแถบ fallback เดิมบนการ์ด
 * เดิมแถบนี้ขึ้น **เฉพาะใบที่ไม่มีผลโทร** ซึ่งกลับด้านกับความจริง: วัดกับฐาน 13 ส.ค. 2569
 * ใบที่ได้แถบนี้ 127 ใบเป็น 0/0/0 ทุกใบ ส่วนใบเดียวที่มีคนจริง (DS5812006 · 2 คน)
 * กลับถูกกลบเพราะมันมีผลโทรด้วย — ตอนนี้กลับเป็น "มีค่าเมื่อไหร่ขึ้นเมื่อนั้น" ไม่ผูกกับผลโทร
 */
export function lumosProgressChip(p: {
  contacted: number;
  reserved: number;
  placed: number;
}): { text: string; tone: ToneKey } | null {
  if (p.contacted <= 0 && p.reserved <= 0 && p.placed <= 0) return null;
  return {
    text: `ติดต่อ ${p.contacted} · จอง ${p.reserved} · ลงงาน ${p.placed}`,
    tone: 'primary',
  };
}
