/**
 * ค่าคงที่ของงานสรรหา (RM) ที่ **คัดลอกตรงจากระบบเดิม** — ห้ามแก้ถ้อยคำเอง
 *
 * เจ้าของส่ง HTML ของระบบเดิมมาเมื่อ 11 ส.ค. 2569 (ฟอร์ม "สร้างลิงก์" กับ
 * "เพิ่มข้อมูลผู้สมัคร") ค่าในไฟล์นี้พิมพ์ตามนั้นทุกตัวอักษร รวมทั้งตัวที่ดูเหมือนพิมพ์ผิด
 * (`monix` ตัวเล็ก · `ธุรการเจาะจงLBD` ติดกัน) เพราะเป็นค่าที่เจ้าหน้าที่ใช้อ้างอิงกันจริง
 * และต้องตรงกับของเดิมตอนย้ายข้อมูล — แก้ให้ "สวย" คือทำให้เทียบข้ามระบบไม่ได้
 *
 * ⚠️ ไฟล์นี้ import จากทั้ง `src/` และ `api/` — เป็นแหล่งความจริงเดียวว่าค่าอะไรรับได้
 * (แพตเทิร์นเดียวกับ `recruitPostings.ts` / `matchingListFilter.ts`)
 *
 * ⚠️ ไม่ผูก CHECK constraint ที่ฐาน — ตรวจที่ API จากไฟล์นี้ เพื่อไม่ต้องเขียน
 * migration ใหม่ทุกครั้งที่เจ้าของเพิ่มค่า (บทเรียนเดิมจาก 039/053/054/056)
 */

/** ข้อมูลเจาะจง — 19 ค่าตาม `specific_information_id` ในระบบเดิม (คัดลอกตรง) */
export const RM_SPECIFIC_TYPES = [
  'เจาะจง (ฟรี)',
  'เจาะจง (มีค่าใช้จ่าย)',
  'ไม่เจาะจง (ฟรี)',
  'ไม่เจาะจง (มีค่าใช้จ่าย)',
  'พนักงานทดแทน',
  'พนักงานทดแทน WL (ฟรี)',
  'พนักงานทดแทน WL (เสียเงิน)',
  'พนักงานทดแทน EX (ฟรี)',
  'พนักงานทดแทน EX (เสียเงิน)',
  'monix',
  'พนักงานทดแทน LBA (ประชาสัมพันธ์,ธุรการ)',
  'พนักงานทดแทน LBA (แม่บ้าน,ช่าง)',
  'CALL IN',
  'Lost Lead',
  'Web Job',
  'Campaign',
  'เจาะจงราชการ (ฟรี)',
  'เจาะจงราชการ (มีค่าใช้จ่าย)',
  'ธุรการเจาะจงLBD',
] as const;

export type RmSpecificType = (typeof RM_SPECIFIC_TYPES)[number];

const SPECIFIC_SET = new Set<string>(RM_SPECIFIC_TYPES);

export function isRmSpecificType(v: unknown): v is RmSpecificType {
  return typeof v === 'string' && SPECIFIC_SET.has(v);
}

/** ประเภทใบขับขี่ — 6 ค่าตาม checkbox `licenseTypesId` ในระบบเดิม (เรียงตาม value 1–6) */
export const RM_LICENSE_TYPES = [
  'ใบขับขี่บุคคล ชั่วคราว',
  'ใบขับขี่บุคคล 5 ปี',
  'ใบขับขี่สาธารณะ',
  'ใบขับขี่ ท.2',
  'ใบขับขี่ ท.3',
  'ใบขับขี่ ท.4',
] as const;

export type RmLicenseType = (typeof RM_LICENSE_TYPES)[number];

const LICENSE_SET = new Set<string>(RM_LICENSE_TYPES);

export function isRmLicenseType(v: unknown): v is RmLicenseType {
  return typeof v === 'string' && LICENSE_SET.has(v);
}

/** เอาเฉพาะใบขับขี่ที่รู้จัก ไม่ซ้ำ เรียงตาม master — กันค่าขยะจาก client */
export function cleanRmLicenseTypes(raw: unknown): RmLicenseType[] {
  if (!Array.isArray(raw)) return [];
  const picked = new Set<RmLicenseType>();
  for (const v of raw) if (isRmLicenseType(v)) picked.add(v);
  return RM_LICENSE_TYPES.filter((t) => picked.has(t));
}

/**
 * วุฒิการศึกษา — 8 ค่าตาม `degree-select` ของระบบเดิม (คัดลอกตรง)
 * ⚠️ ต่างจาก `EDUCATION_LEVELS` ในฟอร์มสมัครสาธารณะ (ที่นั่นมี 7 ค่า ไม่มี
 * "ไม่มีวุฒิการศึกษา" และเรียกย่อว่า ม.ต้น/ม.ปลาย) — ตั้งใจไม่รวมสองชุดเข้าด้วยกัน
 * เพราะฟอร์มสาธารณะเป็นหน้าที่ผู้สมัครเห็น เปลี่ยนคำแล้วกระทบใบสมัครที่มีอยู่
 */
export const RM_EDUCATION_LEVELS = [
  'ไม่มีวุฒิการศึกษา',
  'ประถมศึกษา',
  'มัธยมศึกษาตอนต้น',
  'มัธยมศึกษาตอนปลายและอาชีวศึกษา',
  'ปวส',
  'ปริญญาตรี',
  'ปริญญาโท',
  'ปริญญาเอก',
] as const;

/**
 * ประเภทฟอร์มการสมัครที่ลิงก์จะเปิด — ตาม `formType` ของระบบเดิม
 * ค่าที่เก็บลงฐานคือ 'rm' / 'global' ตรงกับระบบเดิม เพื่อเทียบข้ามระบบได้
 */
export const RM_FORM_TYPES = [
  { code: 'rm', label: 'ทั่วไป' },
  { code: 'global', label: 'แนบเอกสารได้' },
] as const;

export type RmFormType = (typeof RM_FORM_TYPES)[number]['code'];

export function isRmFormType(v: unknown): v is RmFormType {
  return v === 'rm' || v === 'global';
}

export function rmFormTypeLabel(code: string | null | undefined): string {
  return RM_FORM_TYPES.find((f) => f.code === code)?.label ?? 'ทั่วไป';
}

/** เพศตามระบบเดิม (M/F) — ฝั่งเราเก็บ male/female ต้องแปลงตอนบันทึก */
export const RM_SEX_OPTIONS = [
  { code: 'male', label: 'ชาย' },
  { code: 'female', label: 'หญิง' },
] as const;

/**
 * เบอร์โทรของฟอร์ม "เพิ่มข้อมูลผู้สมัคร" — ระบบเดิมบังคับครบ 10 หลัก
 * (ข้อความ error เดิม: "กรุณากรอกเบอร์โทรให้ครบ 10 หลัก")
 * คืน digits ล้วนเมื่อผ่าน · null เมื่อไม่ผ่าน — ให้ฝั่ง API กับ UI ตัดสินเหมือนกัน
 */
export function normalizeRmPhone(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length === 10 ? digits : null;
}
