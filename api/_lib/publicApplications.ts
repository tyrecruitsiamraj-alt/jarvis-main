/**
 * Validation สำหรับใบสมัครงานหน้า /apply (public — ไม่มี auth)
 * แยกจาก handler เพื่อให้ unit test ได้ตรงๆ
 */

export type PublicApplicationGender = 'male' | 'female' | 'other';

const TITLE_PREFIXES = ['นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง'];
const GENDERS: PublicApplicationGender[] = ['male', 'female', 'other'];

const MIN_AGE = 15;
const MAX_AGE = 80;

export type PublicApplicationInput = {
  titlePrefix: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  age: number;
  gender: PublicApplicationGender;
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string | null;
  jobId: string | null;
  jobTitle: string | null;
  unitName: string | null;
  positionInterest: string | null;
  note: string | null;
};

export type PublicApplicationValidation =
  | { ok: true; value: PublicApplicationInput }
  | { ok: false; message: string };

/** รับ 0XXXXXXXXX (9–10 หลัก) หรือรูปแบบ +66 / 66 แล้ว normalize เป็นเลขล้วนขึ้นต้น 0 */
export function normalizeThaiPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('66')) return `0${digits.slice(2)}`;
  if ((digits.length === 9 || digits.length === 10) && digits.startsWith('0')) return digits;
  return null;
}

/** อายุ: รับ number หรือ string ตัวเลข แล้วตรวจช่วง 15–80 */
export function normalizeAge(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n)) return null;
  const age = Math.trunc(n);
  if (age < MIN_AGE || age > MAX_AGE) return null;
  return age;
}

function requiredText(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, maxLen);
}

function optionalText(v: unknown, maxLen: number): string | null {
  return requiredText(v, maxLen);
}

function normalizeTitlePrefix(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return TITLE_PREFIXES.includes(t) ? t : null;
}

function normalizeGender(v: unknown): PublicApplicationGender | null {
  return typeof v === 'string' && (GENDERS as string[]).includes(v)
    ? (v as PublicApplicationGender)
    : null;
}

export function validatePublicApplication(raw: unknown): PublicApplicationValidation {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'Invalid JSON body' };
  }
  const b = raw as Record<string, unknown>;

  const firstName = requiredText(b.first_name, 100);
  if (!firstName) return { ok: false, message: 'กรุณากรอกชื่อ' };

  const lastName = requiredText(b.last_name, 100);
  if (!lastName) return { ok: false, message: 'กรุณากรอกนามสกุล' };

  const phone = normalizeThaiPhone(b.phone);
  if (!phone) {
    return { ok: false, message: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (เช่น 0812345678)' };
  }

  const age = normalizeAge(b.age);
  if (age === null) {
    return { ok: false, message: `กรุณากรอกอายุให้ถูกต้อง (${MIN_AGE}–${MAX_AGE} ปี)` };
  }

  const gender = normalizeGender(b.gender);
  if (!gender) return { ok: false, message: 'กรุณาเลือกเพศ' };

  const province = requiredText(b.province, 100);
  if (!province) return { ok: false, message: 'กรุณาเลือกจังหวัด' };

  const district = requiredText(b.district, 100);
  if (!district) return { ok: false, message: 'กรุณาเลือกอำเภอ/เขต' };

  const subdistrict = requiredText(b.subdistrict, 100);
  if (!subdistrict) return { ok: false, message: 'กรุณาเลือกตำบล/แขวง' };

  const titlePrefix = normalizeTitlePrefix(b.title_prefix);
  const fullName = [titlePrefix, `${firstName} ${lastName}`].filter(Boolean).join('');

  return {
    ok: true,
    value: {
      titlePrefix,
      firstName,
      lastName,
      fullName,
      phone,
      age,
      gender,
      province,
      district,
      subdistrict,
      postalCode: optionalText(b.postal_code, 10),
      jobId: optionalText(b.job_id, 100),
      jobTitle: optionalText(b.job_title, 300),
      unitName: optionalText(b.unit_name, 300),
      positionInterest: optionalText(b.position_interest, 200),
      note: optionalText(b.note, 2000),
    },
  };
}
