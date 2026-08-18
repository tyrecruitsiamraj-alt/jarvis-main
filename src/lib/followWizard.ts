/**
 * ฟอร์มเพิ่มรายการติดตามเป็น **3 ขั้น** (เจ้าของสั่ง 18 ส.ค. 2569)
 *
 * > *"เมื่อเลือกชื่อจากบอร์ดแล้ว กด next แล้ว ไปเลือกหน่วยงาน จากนั้นกด next แล้วตั้งเวลา"*
 *
 * เดิมเป็นฟอร์มยาวหน้าเดียว — เลื่อนยาว ๆ แล้วพลาดช่องบังคับบ่อย
 * แยกเป็นขั้นแล้ว **ด่านตรวจต้องอยู่ที่นี่ที่เดียว** ทั้งปุ่ม next และตอนกดบันทึก
 * ไม่งั้นกด next ผ่านแต่ตอนบันทึกเด้ง error ของขั้นที่เลยมาแล้ว (คนหาไม่เจอว่าผิดตรงไหน)
 *
 * 🔴 **หน่วยงานไม่บังคับ** — งาน Follow บางเรื่องไม่ผูกหน่วยงาน (เช่นตามเรื่องเอกสาร)
 * ขั้นที่ 2 จึงข้ามได้เสมอ ห้ามใส่ด่านบังคับเพิ่ม
 */

export type FollowWizardStep = 1 | 2 | 3;

export const FOLLOW_WIZARD_STEPS: ReadonlyArray<{
  step: FollowWizardStep;
  title: string;
  hint: string;
}> = [
  { step: 1, title: 'คนที่จะติดตาม', hint: 'เลือกชื่อจากบอร์ด หรือคีย์เอง + เรื่องที่จะให้โทร' },
  { step: 2, title: 'หน่วยงาน', hint: 'ตามเรื่องให้หน่วยงานไหน (ข้ามได้)' },
  { step: 3, title: 'ตั้งเวลา', hint: 'ให้ AI โทรเมื่อไหร่' },
];

export type FollowWizardValues = {
  firstName: string;
  phone: string;
  topic: string;
  /** โหมดตารางหลายวัน (true) หรือระบุเวลาเอง (false) */
  scheduleMode: boolean;
  /** โหมดระบุเวลาเอง — รายการ datetime-local */
  scheduledAts: string[];
  /** โหมดตาราง — วันที่จะส่งจริง (กางช่วงแล้วหักวันที่ติ๊กออกแล้ว) */
  scheduleDays: string[];
  /** โหมดตาราง — รอบเวลาต่อวัน */
  roundTimes: string[];
};

/** เบอร์มือถือไทย 10 หลักขึ้นต้น 0 — ตัวเว้นวรรค/ขีดตัดออกก่อนตรวจ */
function isThaiMobile(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, '');
  return /^0\d{9}$/.test(digits);
}

/**
 * ข้อความผิดพลาดของขั้นนั้น — `null` = ผ่าน ไปขั้นถัดไป/บันทึกได้
 * ตรวจเฉพาะของขั้นนั้น ไม่ลามไปขั้นอื่น (ขั้น 3 ไม่ต้องบ่นเรื่องชื่อซ้ำอีกรอบ)
 */
export function followStepError(step: FollowWizardStep, v: FollowWizardValues): string | null {
  if (step === 1) {
    if (!v.firstName.trim()) return 'กรอกชื่อ หรือกดเลือกชื่อจากบอร์ด';
    if (!v.phone.trim()) return 'กรอกเบอร์โทรของคนที่จะติดตาม';
    if (!isThaiMobile(v.phone)) return 'เบอร์โทรต้องเป็นมือถือ 10 หลัก ขึ้นต้นด้วย 0';
    if (!v.topic.trim()) return 'กรอกเรื่องที่จะให้โทรติดตาม';
    return null;
  }

  // ขั้น 2 = หน่วยงาน — ไม่บังคับ ข้ามได้เสมอ
  if (step === 2) return null;

  if (v.scheduleMode) {
    if (v.scheduleDays.length === 0) return 'เลือกช่วงวัน แล้วติ๊กวันที่จะให้ AI โทรอย่างน้อย 1 วัน';
    const rounds = new Set(v.roundTimes.filter((t) => /^\d{1,2}:\d{2}$/.test(t)));
    if (rounds.size === 0) return 'ระบุรอบเวลาอย่างน้อย 1 รอบ (เช่น 07:00)';
    return null;
  }

  if (v.scheduledAts.filter((t) => t.trim()).length === 0) {
    return 'ระบุเวลาที่ให้โทรอย่างน้อย 1 รอบ';
  }
  return null;
}

/** ผ่านทุกขั้นถึงขั้นที่กำหนดหรือยัง — ใช้ตอนกดบันทึก (กันข้ามขั้นด้วย URL/คีย์บอร์ด) */
export function firstIncompleteStep(v: FollowWizardValues): FollowWizardStep | null {
  for (const { step } of FOLLOW_WIZARD_STEPS) {
    if (followStepError(step, v)) return step;
  }
  return null;
}

/** ขั้นถัดไป/ก่อนหน้า — ตัดที่ 1 กับ 3 ไม่ให้หลุดกรอบ */
export function nextFollowStep(step: FollowWizardStep): FollowWizardStep {
  return (step < 3 ? step + 1 : 3) as FollowWizardStep;
}

export function prevFollowStep(step: FollowWizardStep): FollowWizardStep {
  return (step > 1 ? step - 1 : 1) as FollowWizardStep;
}

/** สรุปสั้น ๆ ของขั้นที่ทำผ่านมาแล้ว — โชว์บนหัวขั้นถัดไปให้รู้ว่าเลือกอะไรไว้ */
export function followStepSummary(
  step: FollowWizardStep,
  v: FollowWizardValues & { recipientName: string; unitName: string; siteCode: string },
): string | null {
  if (step === 1) {
    const name = v.recipientName.trim();
    if (!name) return null;
    return [name, v.phone.trim(), v.topic.trim()].filter(Boolean).join(' · ');
  }
  if (step === 2) {
    const unit = v.unitName.trim();
    if (!unit) return 'ไม่ระบุหน่วยงาน';
    return v.siteCode.trim() ? `${unit} (${v.siteCode.trim()})` : unit;
  }
  return null;
}
