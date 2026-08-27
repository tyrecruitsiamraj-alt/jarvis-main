/**
 * ═══ ป้ายหน่วยของตัวเลขรายได้ — "400 บาท" กับ "45,000 บาท" ต้องอ่านออกว่าคนละหน่วย ═══
 *
 * 🔴 **ที่มา** (audit มุมพนักงานใหม่ 26 ส.ค. 2569): บนหน้าจับคู่ การ์ดใบขอขึ้นว่า
 * "45,000 บาท" อยู่ข้าง ๆ "400 บาท" และ "353 บาท" โดยไม่มีหน่วยกำกับเลย
 * คนใหม่อ่านว่า **เงินเดือน 400 บาท** ⇒ นึกว่าข้อมูลพัง หรือแย่กว่านั้นคือเอาไปบอกผู้สมัคร
 *
 * ความจริง: `total_income` เป็นอัตราดิบจาก ERP ซึ่ง **บางใบเป็นค่าแรงต่อวัน**
 * (วัดเจอ 20 จาก 200 ใบ) ส่วน `monthly_income` แปลงเป็นต่อเดือนให้แล้ว
 *
 * 🔴 กติกาของไฟล์นี้: **ไม่รู้หน่วย ห้ามเดา** — คืน `period: 'unknown'` แล้วให้จอ
 * เขียนว่า "อัตราจาก ERP" พร้อมคำเตือน ดีกว่าติดป้าย "/เดือน" ให้เลขที่เป็นรายวัน
 * (บทเรียนเดิม: จอที่บอกผิด แย่กว่าจอที่ยอมรับว่าไม่รู้)
 */

export type IncomePeriod = 'daily' | 'monthly' | 'unknown';

export type IncomeDisplay = {
  amount: number;
  period: IncomePeriod;
  /** ข้อความที่เอาไปวางบนจอได้เลย เช่น "45,000 บาท/เดือน" */
  text: string;
  /** คำอธิบายเพิ่มสำหรับ tooltip — `null` = ไม่ต้องมี */
  hint: string | null;
};

/** ของที่ต้องรู้เพื่อเลือกหน่วย — รับเป็นก้อนย่อยเพื่อให้เรียกจากหลายรูปข้อมูลได้ */
export type IncomeInput = {
  /** อัตราดิบจาก ERP — อาจเป็นต่อวันหรือต่อเดือน ไม่มีอะไรบอก */
  totalIncome?: number | null;
  /** แปลงเป็นต่อเดือนแล้ว (feed คำนวณให้) */
  monthlyIncome?: number | null;
  /** เจ้าหน้าที่ตั้งเอง — เชื่อถือได้ที่สุดเพราะคนกรอกรู้ว่าเป็นหน่วยอะไร */
  displayPeriod?: 'daily' | 'monthly' | null;
};

const baht = (n: number) => n.toLocaleString('th-TH');

/**
 * เลือกตัวเลขและหน่วยที่ควรโชว์ — `null` = ไม่มีข้อมูลรายได้เลย (จอเขียน "—")
 *
 * ลำดับความน่าเชื่อถือ:
 * 1. `displayPeriod` ที่เจ้าหน้าที่ตั้งเอง (คนกรอกรู้หน่วยแน่นอน)
 * 2. `monthlyIncome` ที่ feed แปลงมาแล้ว
 * 3. `totalIncome` ดิบ — **หน่วยไม่รู้** ต้องติดคำเตือน
 */
export function incomeDisplay(input: IncomeInput): IncomeDisplay | null {
  const { totalIncome, monthlyIncome, displayPeriod } = input;

  if (displayPeriod && typeof monthlyIncome === 'number' && monthlyIncome > 0) {
    return displayPeriod === 'daily'
      ? {
          amount: monthlyIncome,
          period: 'monthly',
          text: `${baht(monthlyIncome)} บาท/เดือน`,
          hint: 'ใบนี้ตั้งค่าแรงเป็นรายวัน — ตัวเลขนี้แปลงเป็นต่อเดือนให้แล้ว',
        }
      : { amount: monthlyIncome, period: 'monthly', text: `${baht(monthlyIncome)} บาท/เดือน`, hint: null };
  }

  if (typeof monthlyIncome === 'number' && monthlyIncome > 0) {
    return {
      amount: monthlyIncome,
      period: 'monthly',
      text: `${baht(monthlyIncome)} บาท/เดือน`,
      hint: 'รวมค่าแรงหลักกับรายได้ประจำอื่นแล้ว',
    };
  }

  if (typeof totalIncome === 'number' && totalIncome > 0) {
    // 🔴 ไม่รู้หน่วยจริง ๆ — ห้ามเดาว่าเป็นต่อเดือน
    return {
      amount: totalIncome,
      period: 'unknown',
      text: `${baht(totalIncome)} บาท`,
      hint: 'อัตราดิบจากระบบ ERP — บางใบเป็นค่าแรง "ต่อวัน" ไม่ใช่ต่อเดือน ตรวจในใบขอก่อนบอกผู้สมัคร',
    };
  }

  return null;
}
