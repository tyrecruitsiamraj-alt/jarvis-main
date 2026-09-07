/**
 * ═══ สรุป "ผลจากการโทร" ที่ต้องเห็นบนกล่องทีมเลย — ไม่ต้องกดเข้าไปดู ═══
 *
 * เจ้าของสั่ง 7 ก.ย. 2569 (คำต่อคำ):
 * *"หน้าหลัก ตามกล่องทีม บอกด้วยว่าโทรไปแล้วเท่าไหร่ สนใจลงงานอะไรยังไง
 *   ไม่เอาแค่คำว่า ผลการโทร แบบนั้นก็ต้องกดเข้าไปเพื่อดูอีก"*
 *
 * 🔴 **หนึ่งเมตริกหนึ่งนิยาม** — ทุกเลขในไฟล์นี้อ่านผ่าน `callBoxCount()` /
 * `callResultsThisMonth()` ของ `flowSummaryApi` เท่านั้น **ห้ามนับเอง**
 * ป๊อป "ผลจากการโทร" บนหน้าแรกใช้ตัวสร้าง (`buildCallDigest`) และป้าย
 * (`CALL_BOX_META`) ชุดเดียวกันนี้ ⇒ บอร์ดทีมกับป๊อปโกหกกันเองไม่ได้
 *
 * ⚠️ ลิสต์รายชื่อจาก API **ถูกตัดที่ 50 แถวใน SQL** — ยอดจึงห้ามใช้ `.length`
 * (บั๊กเดียวกับที่หน้า `/work` เจอ 7 ก.ย. 2569) · ตัวสร้างนี้แยก "ยอด" ออกจาก
 * "รายชื่อที่โชว์ได้" ให้แล้ว จอจึงบอกได้ตรง ๆ ว่าเหลืออีกกี่รายที่ไม่ได้โชว์
 */
import type { ToneKey } from '@/lib/designTokens';
import {
  callBoxCount,
  callBoxTruncated,
  callResultsThisMonth,
  type FlowCallBoxes,
  type FlowFollowUpItem,
  type FlowSummary,
} from '@/lib/flowSummaryApi';

/** คีย์ของ 4 กล่องผลโทร (ชุดเดียวกับที่ API ส่งมา) */
export type CallBoxKey = keyof FlowCallBoxes;

/**
 * โทนของ 4 กล่องผลโทร (เจ้าของกำหนด 12 ส.ค. 2569) — ทิศทางสีชุดเดียวกับ callOutcomeTone:
 * เขียว=จบดี · เหลือง=ยังไม่จบ รอโทรซ้ำ · ส้ม=ต้องคนตาม · แดง=จบไม่ดี
 *
 * ย้ายมาจาก `HomePage.tsx` (7 ก.ย. 2569) เพื่อให้บอร์ดทีมกับป๊อปอ่านชุดเดียวกัน
 */
export const FOLLOW_UP_TONE = {
  good: { tone: 'success', dot: '🟢', hint: 'สนใจงาน — พร้อมให้จอง' },
  warn: { tone: 'warn', dot: '🟡', hint: 'ไม่สะดวก — รอ AI โทรซ้ำตามนัด' },
  act: { tone: 'orange', dot: '🟠', hint: 'ไม่สะดวก — ต้องคนเร่งจัดการ' },
  bad: { tone: 'danger', dot: '🔴', hint: 'ไม่สนใจงาน' },
} as const satisfies Record<string, { tone: ToneKey; dot: string; hint: string }>;

export type FollowUpTone = keyof typeof FOLLOW_UP_TONE;

/**
 * ป้าย/โทน/ลำดับของ 4 กล่อง — **ที่เดียวในระบบ**
 * ป๊อปบนหน้าแรกกับสรุปบนบอร์ดทีมต้อง map จากอาเรย์นี้ ห้ามพิมพ์ป้ายซ้ำ
 */
export const CALL_BOX_META = [
  { key: 'confirmed', label: 'สนใจงาน', tone: 'good' },
  { key: 'retry', label: 'ไม่สะดวก — รอ AI โทรซ้ำ', tone: 'warn' },
  { key: 'needs_human', label: 'ไม่สะดวก — ต้องเร่งจัดการ', tone: 'act' },
  { key: 'declined', label: 'ไม่สนใจงาน', tone: 'bad' },
] as const satisfies ReadonlyArray<{ key: CallBoxKey; label: string; tone: FollowUpTone }>;

/** 1 กล่องผลโทรพร้อมยอดจริง + รายชื่อเท่าที่ API ส่งมา */
export type CallDigestBox = {
  key: CallBoxKey;
  label: string;
  tone: FollowUpTone;
  /** ยอดจริง (จาก `call_box_counts`) — ไม่ใช่ความยาวลิสต์ */
  count: number;
  /** ลิสต์สั้นกว่ายอดจริง = จอต้องบอกว่าโชว์ไม่ครบ */
  truncated: boolean;
  items: FlowFollowUpItem[];
};

export type CallDigest = {
  /** ผลกลับทุกแบบของเดือนนี้ = "โทรไปแล้วได้ผลกลับมาเท่าไหร่" */
  resultsMonth: number;
  boxes: CallDigestBox[];
  /** คนที่สนใจ — เอาไว้โชว์ชื่อ + งานที่สนใจบนกล่องทีมเลย */
  interested: FlowFollowUpItem[];
  /** ยอดจริงของคนที่สนใจ (อาจมากกว่าความยาว `interested`) */
  interestedTotal: number;
  /** เหลืออีกกี่รายที่ไม่ได้โชว์ชื่อ (0 = โชว์ครบแล้ว) */
  interestedMore: number;
};

/**
 * ประกอบสรุปผลโทรจากคำตอบ `flow-summary` ที่หน้าแรกโหลดอยู่แล้ว — **ไม่ยิงเส้นใหม่**
 * @param maxNames จำนวนชื่อ "คนที่สนใจ" ที่ยอมให้โชว์บนกล่องทีม (ที่เหลือยุบเป็น "อีก N ราย")
 */
export function buildCallDigest(flow: FlowSummary | null, maxNames = 4): CallDigest | null {
  if (!flow) return null;
  const boxes: CallDigestBox[] = CALL_BOX_META.map((m) => ({
    key: m.key,
    label: m.label,
    tone: m.tone,
    count: callBoxCount(flow, m.key),
    truncated: callBoxTruncated(flow, m.key),
    items: flow.call_boxes[m.key],
  }));
  const confirmed = flow.call_boxes.confirmed;
  const interested = confirmed.slice(0, Math.max(0, maxNames));
  const interestedTotal = callBoxCount(flow, 'confirmed');
  return {
    resultsMonth: callResultsThisMonth(flow),
    boxes,
    interested,
    interestedTotal,
    /** ⚠️ อิงยอดจริง ไม่ใช่ความยาวลิสต์ — ลิสต์ตันที่ 50 แต่ของจริงอาจ 137 */
    interestedMore: Math.max(0, interestedTotal - interested.length),
  };
}

/**
 * บรรทัด "สนใจลงงานอะไร" — ตำแหน่ง · หน่วยงาน ของใบขอที่คนนี้ถูกแมทไป
 *
 * ⚠️ `job_position`/`job_unit` เติมมาจากใบขอที่ flow-summary โหลดอยู่แล้ว ใบที่หลุด
 * ขอบเขตนั้นจะว่าง ⇒ ถอยไปบอกเลขที่ใบขอ **ห้ามเดา/ห้ามแต่งชื่องานเอง**
 */
export function interestedJobLine(it: FlowFollowUpItem): string {
  const parts = [it.job_position, it.job_unit].filter((v): v is string => !!v && v.trim() !== '');
  if (parts.length > 0) return parts.join(' · ');
  return it.request_no ? `ใบขอ ${it.request_no}` : 'ยังไม่รู้ว่าแมทกับใบขอไหน';
}
