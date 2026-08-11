/**
 * แผงสรุปงานสรรหา (RM) — 9 ตัวเลขที่เจ้าของขอ 11 ส.ค. 2569
 *
 *   "กรอกมาเท่าไหร่ โทรไปแล้วเท่าไหร่ รับสายเท่าไหร่ ไม่รับสายเท่าไหร่
 *    นัดสำเร็จเท่าไหร่ นัดไม่สำเร็จเท่าไหร่ ติดต่อไม่ได้เท่าไหร่
 *    นัดแล้วมาเท่าไหร่ นัดแล้วไม่มาเท่าไหร่"
 *
 * ⚠️ **ตัวเลขมาจาก iRecruit อ่านอย่างเดียว** ไม่ใช่จาก `public_job_applications` ของเรา
 * เพราะงาน RM จริงยังทำอยู่บนระบบเดิม (ใบสมัครฝั่งเรามี 7 ใบ · ฝั่งโน้น 35,472)
 * โชว์ของฝั่งเราจะได้แผงศูนย์ทั้งแผง ซึ่งไม่ตอบคำถามที่ถาม
 *
 * ไฟล์นี้ pure ล้วน — ตัวแมป "เหตุผล → ถัง" กับสมการยอด อยู่ที่นี่ที่เดียว
 * แก้การจัดกลุ่มให้แก้ที่นี่ ไม่ใช่ไปแก้ SQL
 */

export type RecruitFunnelCounts = {
  /**
   * ใบสมัครที่กรอกเข้ามาทั้งหมด — **รวมที่ถูกตีเป็น Lead ด้วย**
   * (Lead ถูกตีตราทีหลัง คนที่โดนโทรไปแล้วค่อยกลายเป็น Lead ก็มี
   * ตัดออกจากตัวตั้งต้นแล้วยอดขั้นถัดไปจะเกิน 100%) · ดูจำนวน Lead ที่ฟิลด์ `leads`
   */
  registered: number;
  /** คนที่ถูกกดโทรออกแล้วอย่างน้อยหนึ่งครั้ง (นับหัวคน) */
  called: number;
  /** ผลติดต่อ**ล่าสุด**ของคนนั้น = สำเร็จ */
  contactSuccess: number;
  /** ผลติดต่อล่าสุด = ไม่สำเร็จ เพราะโทรแล้วไม่มีคนรับ */
  noAnswer: number;
  /** ผลติดต่อล่าสุด = ไม่สำเร็จ เพราะติดต่อไม่ถึงตัว (เบอร์ใช้ไม่ได้/ติดต่อไม่ได้) */
  unreachable: number;
  /** ผลติดต่อล่าสุด = ไม่สำเร็จ ด้วยเหตุอื่น (คุณสมบัติ · ข้อมูลซ้ำ · ไม่มีงาน ฯลฯ) */
  contactFailedOther: number;
  /** ผลนัดหมายล่าสุด = สำเร็จ */
  appointmentSuccess: number;
  /** ผลนัดหมายล่าสุด = ไม่สำเร็จ */
  appointmentFailed: number;
  /** ผลติดตามนัดล่าสุด = มาตามนัด */
  showedUp: number;
  /** ผลติดตามนัดล่าสุด = ไม่มาตามนัด */
  noShow: number;
  /** ผลติดตามนัดล่าสุด = ยังไม่สรุป (รวมสถานะแปลกปลอม เพื่อไม่ให้แถวไหนหล่นหาย) */
  followPending: number;
};

export const EMPTY_RECRUIT_FUNNEL: RecruitFunnelCounts = {
  registered: 0,
  called: 0,
  contactSuccess: 0,
  noAnswer: 0,
  unreachable: 0,
  contactFailedOther: 0,
  appointmentSuccess: 0,
  appointmentFailed: 0,
  showedUp: 0,
  noShow: 0,
  followPending: 0,
};

/**
 * เหตุผล "ไม่สำเร็จ" ของขั้นตอนการติดต่อ แยกเป็น 3 ถังที่ **ไม่ทับกัน**
 * (เจ้าของถาม "ไม่รับสาย" กับ "ติดต่อไม่ได้" แยกกัน — ในระบบเดิมทั้งคู่เป็นเหตุผลคนละตัว
 * ใต้ผลเดียวกัน จึงต้องแบ่งด้วยชื่อเหตุผล ไม่ใช่ด้วยสถานะ)
 *
 * ⚠️ ชื่อต้องตรงกับ `recruit_master_reason` เป๊ะ รวมทั้งตัวที่สะกดแปลก
 * ⚠️ เหตุผลที่ไม่อยู่ในสองชุดนี้ตกถัง `contactFailedOther` เสมอ — ไม่หายไปไหน
 *    (มีเทสต์คุมว่า สามถังรวมกันต้องเท่ายอด "ไม่สำเร็จ" ทั้งหมด)
 */
export const CONTACT_NO_ANSWER_REASONS = [
  'ไม่รับสาย',
  'ปิดเครื่อง',
  'โทรไปไม่มีคนรับสาย',
  'ไม่รับสายโทรศัพท์',
  'ปิดเครื่องโทรศัพท์',
] as const;

export const CONTACT_UNREACHABLE_REASONS = [
  'ติดต่อไม่ได้',
  'หมายเลขโทรศัพท์ผิด',
  'ติดต่อนัดหมายไม่ได้',
  'ติดต่อผู้สมัครไม่ได้',
] as const;

const NO_ANSWER_SET = new Set<string>(CONTACT_NO_ANSWER_REASONS);
const UNREACHABLE_SET = new Set<string>(CONTACT_UNREACHABLE_REASONS);

export type ContactFailBucket = 'noAnswer' | 'unreachable' | 'other';

/** เหตุผลหนึ่งตัวตกถังเดียวเท่านั้น — ลำดับการเช็คสำคัญ ห้ามให้ตัวเดียวเข้าสองถัง */
export function contactFailBucket(reasonName: string | null | undefined): ContactFailBucket {
  const name = (reasonName ?? '').trim();
  if (NO_ANSWER_SET.has(name)) return 'noAnswer';
  if (UNREACHABLE_SET.has(name)) return 'unreachable';
  return 'other';
}

/** รวมยอด "ไม่สำเร็จ" จากรายการเหตุผล + จำนวน — ใช้ทั้งฝั่ง API และเทสต์ */
export function splitContactFailures(
  rows: Array<{ reasonName: string | null; count: number }>,
): { noAnswer: number; unreachable: number; other: number; total: number } {
  const out = { noAnswer: 0, unreachable: 0, other: 0, total: 0 };
  for (const r of rows) {
    const n = Number(r.count) || 0;
    out.total += n;
    out[contactFailBucket(r.reasonName)] += n;
  }
  return out;
}

export type RecruitFunnelTile = {
  key: keyof RecruitFunnelCounts;
  label: string;
  /** ตัวหารสำหรับแถบสัดส่วน — null = ไม่แสดง % (ตัวตั้งต้นของสาย) */
  ofKey: keyof RecruitFunnelCounts | null;
  /** จัดกลุ่มเป็นสามแถวตามขั้นตอนของระบบเดิม */
  step: 'intake' | 'contact' | 'appointment' | 'follow';
};

/**
 * ลำดับและป้ายของช่องบนแผง — เรียงตามที่เจ้าของไล่มา
 *
 * ⚠️ **ทุกช่องคิด % จาก "กรอกมา" ช่องเดียว** — ตอนแรกทำเป็นทอด ๆ (ผลติดต่อหารด้วย
 * "โทรไปแล้ว" · นัดหมายหารด้วย "รับสาย") แล้ววัดกับข้อมูลจริงได้ 304.7% กับ 111.6%
 * เพราะขั้นก่อนหน้า**ไม่ได้ครอบขั้นถัดไปจริง**: มีคนที่มีผลติดต่อโดยไม่มี log การกดโทร
 * (115,714 คน มีผลติดต่อ แต่ log โทรมี 108,084 คน) และมีคนถูกนัดโดยไม่มีผลติดต่อสำเร็จ
 *
 * "กรอกมา" เป็นประชากรเดียวที่ครอบทุกคนจริง ๆ — หารด้วยตัวนี้ทุกช่องแล้ว % ไม่มีวันเกิน 100
 * และเทียบข้ามช่องได้ตรง ๆ
 */
export const RECRUIT_FUNNEL_TILES: RecruitFunnelTile[] = [
  { key: 'registered', label: 'กรอกมา', ofKey: null, step: 'intake' },
  { key: 'called', label: 'โทรไปแล้ว', ofKey: 'registered', step: 'intake' },

  { key: 'contactSuccess', label: 'รับสาย', ofKey: 'registered', step: 'contact' },
  { key: 'noAnswer', label: 'ไม่รับสาย', ofKey: 'registered', step: 'contact' },
  { key: 'unreachable', label: 'ติดต่อไม่ได้', ofKey: 'registered', step: 'contact' },
  { key: 'contactFailedOther', label: 'ไม่สำเร็จ เหตุอื่น', ofKey: 'registered', step: 'contact' },

  { key: 'appointmentSuccess', label: 'นัดสำเร็จ', ofKey: 'registered', step: 'appointment' },
  { key: 'appointmentFailed', label: 'นัดไม่สำเร็จ', ofKey: 'registered', step: 'appointment' },

  { key: 'showedUp', label: 'นัดแล้วมา', ofKey: 'registered', step: 'follow' },
  { key: 'noShow', label: 'นัดแล้วไม่มา', ofKey: 'registered', step: 'follow' },
  { key: 'followPending', label: 'ยังรอผลนัด', ofKey: 'registered', step: 'follow' },
];

export const RECRUIT_FUNNEL_STEP_LABEL: Record<RecruitFunnelTile['step'], string> = {
  intake: 'เข้ามา',
  contact: 'การติดต่อ',
  appointment: 'นัดหมาย',
  follow: 'ติดตามนัดหมาย',
};

/**
 * ตัวเลขหน้าปกของแต่ละขั้นตอน — โชว์บนปุ่มขั้นตอนตอนที่ยังไม่ได้กดเข้าไปดูรายละเอียด
 * (เจ้าของติงว่าแผง 11 ช่องพร้อมกัน "ดูรก" — เลยเหลือ 4 ปุ่ม กดปุ่มไหนค่อยกางช่องของขั้นนั้น)
 * ⚠️ ต้องเป็นคีย์ที่อยู่ในขั้นตอนนั้นจริง — มีเทสต์คุม
 */
export const RECRUIT_FUNNEL_STEP_PRIMARY: Record<
  RecruitFunnelTile['step'],
  keyof RecruitFunnelCounts
> = {
  intake: 'registered',
  contact: 'contactSuccess',
  appointment: 'appointmentSuccess',
  follow: 'showedUp',
};

/**
 * สัดส่วนเป็น % — คืน null เมื่อไม่มีตัวหาร หรือตัวหารเป็นศูนย์
 * ⚠️ ห้ามคืน 0 แทน null: "0%" อ่านว่า "โทรแล้วไม่มีใครรับเลย" ซึ่งคนละเรื่องกับ
 * "ยังไม่ได้โทรเลยจึงคิดอัตราไม่ได้"
 */
export function funnelPercent(value: number, base: number | null | undefined): number | null {
  if (base == null || base <= 0) return null;
  return Math.round((value / base) * 1000) / 10;
}
