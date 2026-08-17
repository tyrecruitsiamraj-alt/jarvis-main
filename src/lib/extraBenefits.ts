/**
 * ═══════════════════════════════════════════════════════════════════
 *  สวัสดิการเพิ่มเติมที่ติ๊กได้บนใบขอ — แก้รายการในไฟล์นี้ได้เลย
 * ═══════════════════════════════════════════════════════════════════
 *
 * เจ้าของสั่ง 17 ส.ค. 2569: *"สวัสดิการเพิ่มเติมแบบติ๊กเพิ่ม เดี๋ยวจะทำเพิ่มไว้ว่า
 * สวัสดิการมีอะไร"* — ชุดข้างล่างเป็นตัวตั้งต้น เพิ่ม/ลบ/แก้คำได้ตามสบาย
 *
 * วิธีแก้
 * ───────
 * • แก้คำ = พิมพ์ทับข้อความหลัง `label:`
 * • เพิ่ม  = เพิ่มบรรทัดใหม่รูป  { key: 'ชื่อสั้นภาษาอังกฤษ', label: 'คำที่คนอ่าน' },
 * • ลบ    = ลบทั้งบรรทัด
 *
 * 🔴 **`key` ห้ามแก้หลังใช้งานจริงแล้ว** — ใบขอที่ติ๊กไว้เก็บเป็น key ถ้าเปลี่ยน
 * ที่ติ๊กไว้เดิมจะกลายเป็นค่าที่ระบบไม่รู้จักแล้วหายจากประกาศเงียบ ๆ
 * (อยากเปลี่ยนคำที่คนเห็น แก้แค่ `label` พอ — key คงเดิมได้)
 *
 * ⚠️ **คนละชุดกับสวัสดิการที่ดึงจาก ERP** (โอที · เบี้ยขยัน · ค่าครองชีพ ฯลฯ)
 * ชุดนั้นมาจากอัตราจริงในระบบและ AI พูดตามนั้น · ชุดนี้คือของที่ไม่ได้อยู่ในอัตรา
 * แต่หน่วยงานมีให้ ซึ่งเจ้าหน้าที่รู้เองแล้วติ๊กเพิ่มบนประกาศ
 */

export type ExtraBenefit = { key: string; label: string };

export const EXTRA_BENEFITS: readonly ExtraBenefit[] = [
  { key: 'uniform', label: 'ชุดฟอร์ม' },
  { key: 'dorm', label: 'ที่พัก/หอพัก' },
  { key: 'shuttle', label: 'รถรับส่ง' },
  { key: 'meal', label: 'อาหารกลางวัน' },
  { key: 'social_security', label: 'ประกันสังคม' },
  { key: 'group_insurance', label: 'ประกันกลุ่ม' },
  { key: 'annual_leave', label: 'วันลาพักร้อน' },
  { key: 'bonus', label: 'โบนัสประจำปี' },
  { key: 'salary_raise', label: 'ปรับเงินเดือนประจำปี' },
  { key: 'training', label: 'มีอบรม/สอนงาน' },
  { key: 'no_experience', label: 'ไม่ต้องมีประสบการณ์' },
  { key: 'daily_pay', label: 'จ่ายรายวัน' },
];

const BY_KEY = new Map(EXTRA_BENEFITS.map((b) => [b.key, b]));

export function isExtraBenefitKey(v: unknown): v is string {
  return typeof v === 'string' && BY_KEY.has(v);
}

/**
 * แปลงคีย์ที่ติ๊กไว้เป็นคำที่คนอ่าน — **คีย์ที่ไม่รู้จักถูกตัดทิ้ง**
 * (เกิดได้เมื่อมีคนลบรายการออกจากไฟล์นี้ทีหลัง ซึ่งไม่ควรทำให้ประกาศพัง)
 */
export function extraBenefitLabels(keys: readonly string[] | null | undefined): string[] {
  if (!keys || keys.length === 0) return [];
  const out: string[] = [];
  for (const k of keys) {
    const hit = BY_KEY.get(k);
    if (hit) out.push(hit.label);
  }
  return out;
}
