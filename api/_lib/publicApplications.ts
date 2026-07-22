/**
 * Validation สำหรับใบสมัครงานหน้า /apply (public — ไม่มี auth)
 * แยกจาก handler เพื่อให้ unit test ได้ตรงๆ
 */

export type PublicApplicationGender = 'male' | 'female' | 'other';
export type PublicApplicationSource = 'facebook' | 'tiktok' | 'instagram' | 'flyer' | 'other';

const TITLE_PREFIXES = ['นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง'];
const GENDERS: PublicApplicationGender[] = ['male', 'female', 'other'];
export const APPLICATION_SOURCES: PublicApplicationSource[] = [
  'facebook',
  'tiktok',
  'instagram',
  'flyer',
  'other',
];
export const EDUCATION_LEVELS = [
  'ประถม',
  'ม.ต้น',
  'ม.ปลาย/ปวช.',
  'ปวส./อนุปริญญา',
  'ปริญญาตรี',
  'สูงกว่าปริญญาตรี',
  'อื่นๆ',
];

const MIN_AGE = 15;
const MAX_AGE = 80;
const MIN_WEIGHT = 20;
const MAX_WEIGHT = 400;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 260;

export const ALLOWED_DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_DOC_BYTES = 3 * 1024 * 1024; // 3MB — keeps base64 JSON under Vercel's ~4.5MB body cap

export type PublicApplicationDocument = {
  filename: string;
  mime: string;
  size: number;
  base64: string;
};

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
  weightKg: number | null;
  heightCm: number | null;
  education: string | null;
  referralSource: PublicApplicationSource | null;
  document: PublicApplicationDocument | null;
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

function normalizeMeasure(raw: unknown, min: number, max: number): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const v = Math.round(n * 10) / 10;
  if (v < min || v > max) return null;
  return v;
}

function normalizeSource(v: unknown): PublicApplicationSource | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  const alias = s === 'ig' ? 'instagram' : s === 'ใบปลิว' ? 'flyer' : s;
  return (APPLICATION_SOURCES as string[]).includes(alias)
    ? (alias as PublicApplicationSource)
    : null;
}

function normalizeEducation(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return EDUCATION_LEVELS.includes(t) ? t : null;
}

export type DocumentValidation =
  | { ok: true; value: PublicApplicationDocument | null }
  | { ok: false; message: string };

/** ตรวจไฟล์แนบ (base64) — ชนิดไฟล์ pdf/jpg/png และขนาด ≤ MAX_DOC_BYTES */
export function normalizeDocument(raw: unknown): DocumentValidation {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== 'object') return { ok: false, message: 'ไฟล์แนบไม่ถูกต้อง' };
  const d = raw as Record<string, unknown>;
  const base64 = typeof d.base64 === 'string' ? d.base64 : '';
  const filename = typeof d.filename === 'string' ? d.filename.trim().slice(0, 200) : '';
  const mime = typeof d.mime === 'string' ? d.mime.trim().toLowerCase() : '';
  if (!base64) return { ok: true, value: null };
  if (!ALLOWED_DOC_MIME.includes(mime)) {
    return { ok: false, message: 'รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG' };
  }
  // base64 length → decoded byte size (without allocating a Buffer)
  const clean = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const size = Math.floor((clean.length * 3) / 4) - padding;
  if (size <= 0) return { ok: true, value: null };
  if (size > MAX_DOC_BYTES) {
    return { ok: false, message: `ไฟล์ใหญ่เกินไป (สูงสุด ${Math.round(MAX_DOC_BYTES / (1024 * 1024))}MB)` };
  }
  return {
    ok: true,
    value: { filename: filename || 'document', mime, size, base64: clean },
  };
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

  const doc = normalizeDocument(b.document);
  if (!doc.ok) return { ok: false, message: doc.message };

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
      weightKg: normalizeMeasure(b.weight_kg ?? b.weight, MIN_WEIGHT, MAX_WEIGHT),
      heightCm: normalizeMeasure(b.height_cm ?? b.height, MIN_HEIGHT, MAX_HEIGHT),
      education: normalizeEducation(b.education),
      referralSource: normalizeSource(b.referral_source ?? b.source),
      document: doc.value,
      jobId: optionalText(b.job_id, 100),
      jobTitle: optionalText(b.job_title, 300),
      unitName: optionalText(b.unit_name, 300),
      positionInterest: optionalText(b.position_interest, 200),
      note: optionalText(b.note, 2000),
    },
  };
}
