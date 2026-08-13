import { GENDER_LABEL, type PublicApplication } from '@/lib/publicApplicationsApi';

/**
 * บรรทัดข้อมูลย่อของผู้สมัคร (อายุ · เพศ · น้ำหนัก · ส่วนสูง · วุฒิ · ตำแหน่งที่สนใจ)
 *
 * ⚠️ **ประกอบเป็นสตริงเดียวแล้วค่อย join** — ของเดิมเป็น 6 span ที่แต่ละอันเขียน `· `
 * ติดหัวตัวเอง ผลคือคนที่ไม่มีอายุแต่มีเพศจะได้ "· ชาย" มีจุดลอยนำหน้า
 * และบรรทัดนี้หายทั้งบรรทัดเมื่อไม่มีข้อมูลเลย ทำให้การ์ดของแต่ละคนสูงไม่เท่ากัน
 * (เจ้าของทัก 13 ส.ค. 2569: "บรรทัดไม่ตรงกันเงี้ยมันไม่สวย")
 *
 * คืนสตริงว่างเมื่อไม่มีข้อมูลเลย — ผู้เรียกเป็นคนตัดสินใจว่าจะใส่ขีดหรือไม่
 */
export function applicantFactLine(a: Partial<PublicApplication>): string {
  return [
    // ⚠️ ค่า 0 ของ อายุ/น้ำหนัก/ส่วนสูง ถือว่าไม่มีข้อมูลโดยตั้งใจ — อายุ 0 ปี
    // หรือหนัก 0 กก. คือข้อมูลเสีย ไม่ใช่คำตอบจริง (ต่างจาก dashIfEmpty ที่ 0 คือคำตอบ)
    a.age ? `อายุ ${a.age} ปี` : '',
    a.gender ? (GENDER_LABEL[a.gender] ?? a.gender) : '',
    a.weight_kg ? `${a.weight_kg} กก.` : '',
    a.height_cm ? `${a.height_cm} ซม.` : '',
    a.education ? String(a.education).trim() : '',
    a.position_interest ? `สนใจ ${String(a.position_interest).trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** ที่อยู่บรรทัดเดียว — ย้ายมาจาก local helper ใน JobApplicantsDialog เพื่อให้เทสต์ได้ */
export function applicantAddressLine(a: Partial<PublicApplication>): string {
  return [a.subdistrict, a.district, a.province, a.postal_code]
    .map((v) => (typeof v === 'string' ? v.trim() : v))
    .filter(Boolean)
    .join(' ');
}
