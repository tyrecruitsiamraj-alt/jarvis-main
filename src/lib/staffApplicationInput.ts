/**
 * ═══ ตรวจข้อมูลใบสมัครที่เจ้าหน้าที่คีย์เอง — ชุดเดียวของ "เพิ่มผู้สมัคร" และ "นำเข้า Excel" (1 ต.ค. 2569) ═══
 *
 * เดิมกติกาอยู่ในตัวเส้น `createByStaff` (`api/_handlers/job-applications.ts`) · พอมีนำเข้า Excel
 * ต้องใช้กติกาเดียวกันทุกตัวอักษร ⇒ ยกมาไว้ที่นี่ที่เดียว (ข้อความ error เดิมทุกคำ)
 * ตรรกะล้วน — ไม่แตะ DB/สิทธิ์ (เช็คสิทธิ์ BU/ใบขอยังอยู่ที่ API)
 */
import {
  cleanRmLicenseTypes,
  isRmSpecificType,
  normalizeRmPhone,
  type RmLicenseType,
} from './recruitRmMasters';

export type StaffApplicationValue = {
  full_name: string;
  first_name: string;
  last_name: string;
  /** 10 หลัก รูป 0XXXXXXXXX */
  phone: string;
  age: number;
  gender: 'male' | 'female';
  province: string | null;
  district: string | null;
  education: string | null;
  position_interest: string | null;
  line_id: string | null;
  specific_type: string | null;
  responsible_name: string | null;
  channel_id: string | null;
  channel_label: string | null;
  license_types: RmLicenseType[];
  job_id: string | null;
  job_title: string | null;
  unit_name: string | null;
};

export type StaffApplicationParse = { ok: true; value: StaffApplicationValue } | { ok: false; message: string };

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const text = (v: unknown, max = 200): string | null => {
  const t = str(v).trim();
  return t ? t.slice(0, max) : null;
};

export function parseStaffApplication(b: Record<string, unknown>): StaffApplicationParse {
  const firstName = str(b.first_name).trim().slice(0, 120);
  const lastName = str(b.last_name).trim().slice(0, 120);
  if (!firstName) return { ok: false, message: 'กรุณากรอกชื่อ' };
  if (!lastName) return { ok: false, message: 'กรุณากรอกนามสกุล' };

  const phone = normalizeRmPhone(b.phone);
  if (!phone) return { ok: false, message: 'กรุณากรอกเบอร์โทรให้ครบ 10 หลัก' };

  const gender = b.gender === 'male' || b.gender === 'female' ? b.gender : null;
  if (!gender) return { ok: false, message: 'กรุณาเลือกเพศ' };

  const ageNum = Number(b.age);
  // อายุนอกช่วงนี้แปลว่าคีย์ผิด (พิมพ์ปีเกิดลงช่องอายุเป็นอาการที่เจอบ่อย)
  const age = Number.isFinite(ageNum) && ageNum >= 15 && ageNum <= 80 ? Math.trunc(ageNum) : null;
  if (age === null) return { ok: false, message: 'อายุต้องอยู่ระหว่าง 15–80 ปี' };

  const specific = str(b.specific_type);
  return {
    ok: true,
    value: {
      full_name: `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      phone,
      age,
      gender,
      province: text(b.province, 128),
      district: text(b.district, 128),
      education: text(b.education, 128),
      position_interest: text(b.position_interest),
      line_id: text(b.line_id, 128),
      specific_type: isRmSpecificType(specific) ? specific : null,
      responsible_name: text(b.responsible_name),
      channel_id: text(b.channel_id, 64),
      channel_label: text(b.channel_label),
      license_types: cleanRmLicenseTypes(b.license_types),
      job_id: text(b.job_id, 120),
      job_title: text(b.job_title),
      unit_name: text(b.unit_name),
    },
  };
}

/**
 * คอลัมน์ + ค่าของ insert ใบที่เจ้าหน้าที่คีย์ — ชุดเดียวของทั้งสองทาง (เพิ่มผู้สมัคร · นำเข้า Excel)
 * สถานะเริ่มเป็น 'new' เสมอ (เขียนตรงใน SQL ไม่รับจากข้างนอก)
 */
export const STAFF_INSERT_COLUMNS = `full_name, first_name, last_name, phone, age, gender,
        province, district, education, position_interest,
        line_id, specific_type, responsible_name, channel_id, channel_label,
        license_types, created_by_name, status,
        job_id, job_title, unit_name`;

export const STAFF_INSERT_VALUES = `$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'new',$18,$19,$20`;

export function staffInsertParams(v: StaffApplicationValue, staffName: string | null): unknown[] {
  return [
    v.full_name,
    v.first_name,
    v.last_name,
    v.phone,
    v.age,
    v.gender,
    v.province,
    v.district,
    v.education,
    v.position_interest,
    v.line_id,
    v.specific_type,
    v.responsible_name,
    v.channel_id,
    v.channel_label,
    v.license_types.length > 0 ? v.license_types : null,
    staffName,
    v.job_id,
    v.job_title,
    v.unit_name,
  ];
}
