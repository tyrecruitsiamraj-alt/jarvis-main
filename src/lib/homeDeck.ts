/**
 * ═══ Command Deck — ตรรกะของหน้าแรกแบบจอบัญชาการ (เจ้าของสั่งรอบสอง 26 ส.ค. 2569) ═══
 *
 * 🔴 **ที่มา — ความพยายามรอบแรกถูกตีตกทั้งดวง** (*"รก ไม่สวย"*): รอบแรกทำเป็น
 * "การ์ดมืดใบเล็กแปะบนหน้าขาว" หลายใบซ้อนกัน ⇒ อ่านเป็นความรก ไม่ใช่ความล้ำ
 * ตัวอย่างที่เจ้าของให้ (https://cayla-flax.vercel.app/) สวยเพราะ**ทั้งจอเป็นผืนเดียว**:
 * พื้น ink ทั้งหน้า · โฟกัสเดียวคือหน้าปัดวงแหวนใหญ่ · ตัวหนังสือ mono เล็ก
 * ตัวพิมพ์ห่าง ๆ · ที่ว่างเยอะ · คั่น section ด้วยเส้นบาง 1px ไม่ใช่กล่องซ้อนกล่อง
 *
 * ไฟล์นี้ = ตรรกะล้วนของ deck — ตัววาดอยู่ที่ `src/components/home/CommandDeck.tsx`
 */
import {
  CONVEYOR_BADGE_SHORT,
  CONVEYOR_STEPS,
  type ConveyorBadgeKey,
  type ConveyorCounts,
} from '@/lib/soRecruitNav';

export type StageTile = {
  key: ConveyorBadgeKey;
  label: string;
  path: string;
  /** จำนวนของในถัง — `null` = ยังไม่รู้ (จอเขียน "—" ห้ามเขียน 0) */
  count: number | null;
  /** ความหมายของตัวเลข — เลขลอย ๆ ไม่มีป้ายอ่านไม่ออก */
  countLabel: string;
  /** ต้องลงมือ = จุดแดง (เฉพาะเมื่อรู้ค่าและมีของ — ยังไม่รู้ห้ามกะพริบหลอก) */
  urgent: boolean;
};

/**
 * ความหมายของตัวเลขบนแต่ละขั้น — 🔴 **อ่านจาก `soRecruitNav` ที่เดียว**
 * (เดิมพิมพ์ซ้ำที่นี่ ⇒ เมนูซ้ายกับ deck อธิบายเลขตัวเดียวกันคนละคำได้)
 */
const COUNT_LABEL = CONVEYOR_BADGE_SHORT;

/**
 * ถังที่ "มีของ = ต้องลงมือ" ⇒ ติดจุดแดง
 * 🔴 ถอด `applicants` ออก 28 ส.ค. 2569 — หน้าผู้สมัครไม่อยู่ในลำดับงานแล้ว
 * (งานนั้นอยู่ในแท็บของกล่องงาน) · เหลือ `follow` ที่มีคนรอสายอยู่ปลายทางจริง
 */
const URGENT_KEYS: ReadonlySet<string> = new Set(['follow']);

/** แถบลำดับงานท้าย deck — ชุดเดียวกับเมนู (cache เดียวกัน · ไม่มีเลขขั้นแล้ว) */
export function buildStageTiles(counts: ConveyorCounts): StageTile[] {
  return CONVEYOR_STEPS.map((s) => {
    const v = counts[s.key];
    const count = typeof v === 'number' ? v : null;
    return {
      key: s.key,
      label: s.label,
      path: s.path,
      count,
      countLabel: COUNT_LABEL[s.key] ?? '',
      urgent: URGENT_KEYS.has(s.key) && typeof count === 'number' && count > 0,
    };
  });
}

/**
 * บรรทัดสถานะใต้หน้าปัด — ประโยคเดียวที่จอพูดกับคน
 * เลือกเรื่องหนักสุดก่อน (ภาษาเดียวกับ nextTask: ของที่มีคนรอปลายทางชนะยอดสะสม)
 */
export function deckStatusLine(input: {
  followPastDue?: number | null;
  applicantsUntouched?: number | null;
  slaBreached?: number | null;
}): { text: string; tone: 'danger' | 'warn' | 'ok' } {
  const f = input.followPastDue;
  if (typeof f === 'number' && f > 0) {
    return { text: `เลยนัดโทร ${f} ราย — มีคนรอสายอยู่`, tone: 'danger' };
  }
  const a = input.applicantsUntouched;
  if (typeof a === 'number' && a > 0) {
    return { text: `ผู้สมัคร ${a} คนยังไม่มีใครแตะ`, tone: 'warn' };
  }
  const s = input.slaBreached;
  if (typeof s === 'number' && s > 0) {
    return { text: `ใบขอหลุดกำหนดสะสม ${s} ใบ`, tone: 'warn' };
  }
  // รู้ครบและว่างจริง ต่างจากยังโหลดไม่เสร็จ — คนเรียกกันเคสโหลดเองก่อน
  return { text: 'ทุกถังว่าง — ไม่มีของค้างที่ต้องลงมือ', tone: 'ok' };
}
