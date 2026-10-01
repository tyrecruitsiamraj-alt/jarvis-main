/**
 * ═══ แก้ข้อมูลผู้สมัครจากป๊อปรายละเอียด (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * เจ้าของ (ตอบ Choice): *"ให้มันโชว์ข้อมูล แก้ไขได้แต่ถ้าบันทึกก็เก็บ Log ด้วยว่าใครแก้ไข แต่ไม่ต้องโชว์ Log"*
 * ⇒ หน้าเว็บส่ง **เฉพาะช่องที่เปลี่ยน** · server ตรวจซ้ำด้วยตัวเดียวกันนี้ แล้วจด audit
 *   (`job_application.profile_edit` ค่าก่อน/หลัง + คนแก้) — ไม่มีจอไหนเปิดอ่าน log นี้
 *
 * ตรรกะล้วน — ใช้ร่วมทั้งหน้าเว็บและ API (กติกาเดียว ห้ามเขียนตรวจซ้ำสองชุด)
 * ⚠️ **เบอร์โทรไม่อยู่ในนี้** — เป็นคีย์ของล็อกโทร/คิว AI แก้ได้ที่เส้นแก้เบอร์เดิมเท่านั้น
 * ⚠️ ช่วงอายุ/น้ำหนัก/ส่วนสูง ชุดเดียวกับฟอร์มสมัครสาธารณะ (`api/_lib/publicApplications.ts`)
 */
import { RM_EDUCATION_LEVELS, RM_LICENSE_TYPES } from './recruitRmMasters';

export type ProfileGender = 'male' | 'female' | 'other';

/** ค่าบนฟอร์ม — ทุกช่องเป็นข้อความตามช่อง (พิมพ์ค้างได้ระหว่างแก้) */
export type ProfileDraft = {
  title_prefix: string;
  first_name: string;
  last_name: string;
  gender: '' | ProfileGender;
  age: string;
  line_id: string;
  province: string;
  district: string;
  education: string;
  license_types: string[];
  weight_kg: string;
  height_cm: string;
  note: string;
};

/** ค่าที่ส่งเข้า API (เฉพาะช่องที่เปลี่ยน) — `null` = ล้างค่า */
export type ProfilePatch = Partial<{
  title_prefix: string | null;
  first_name: string;
  last_name: string;
  gender: ProfileGender | null;
  age: number | null;
  line_id: string | null;
  province: string | null;
  district: string | null;
  education: string | null;
  license_types: string[];
  weight_kg: number | null;
  height_cm: number | null;
  note: string | null;
}>;

export type ProfileKey = keyof ProfileDraft;

/** ช่องที่แก้ได้ = คอลัมน์ในตาราง (ชื่อตรงกัน) — API ใช้รายการนี้เป็น whitelist ตอนประกอบ SQL */
export const PROFILE_KEYS: readonly ProfileKey[] = [
  'title_prefix',
  'first_name',
  'last_name',
  'gender',
  'age',
  'line_id',
  'province',
  'district',
  'education',
  'license_types',
  'weight_kg',
  'height_cm',
  'note',
];

export const PROFILE_LIMITS = {
  age: [15, 80],
  weight_kg: [20, 400],
  height_cm: [80, 260],
} as const;

export const PROFILE_TITLE_PREFIXES = ['นาย', 'นาง', 'นางสาว'] as const;

export const PROFILE_GENDER_LABEL: Record<ProfileGender, string> = {
  male: 'ชาย',
  female: 'หญิง',
  other: 'อื่น ๆ',
};

export const PROFILE_EDUCATION_OPTIONS: readonly string[] = RM_EDUCATION_LEVELS;
export const PROFILE_LICENSE_OPTIONS: readonly string[] = RM_LICENSE_TYPES;

type Source = {
  title_prefix?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  gender?: string | null;
  age?: number | string | null;
  line_id?: string | null;
  province?: string | null;
  district?: string | null;
  education?: string | null;
  license_types?: readonly string[] | null;
  weight_kg?: number | string | null;
  height_cm?: number | string | null;
  note?: string | null;
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** ข้อมูลใบ → ค่าตั้งต้นของฟอร์ม · ใบเก่าที่ไม่มีชื่อ/นามสกุลแยก ⇒ แตกจากชื่อเต็ม */
export function profileDraftOf(a: Source): ProfileDraft {
  let first = str(a.first_name).trim();
  let last = str(a.last_name).trim();
  if (!first && !last && a.full_name) {
    const parts = a.full_name.trim().split(/\s+/);
    first = parts[0] ?? '';
    last = parts.slice(1).join(' ');
  }
  const g = str(a.gender);
  return {
    title_prefix: str(a.title_prefix).trim(),
    first_name: first,
    last_name: last,
    gender: g === 'male' || g === 'female' || g === 'other' ? g : '',
    age: str(a.age),
    line_id: str(a.line_id).trim(),
    province: str(a.province).trim(),
    district: str(a.district).trim(),
    education: str(a.education).trim(),
    license_types: [...(a.license_types ?? [])],
    weight_kg: str(a.weight_kg),
    height_cm: str(a.height_cm),
    note: str(a.note),
  };
}

/** ชื่อเต็มแบบฟอร์มสมัครสาธารณะ — คำนำหน้าติดชื่อ ("นายสมชาย ใจดี") */
export function profileFullName(prefix: string | null | undefined, first: string, last: string): string {
  return [(prefix ?? '').trim(), `${first.trim()} ${last.trim()}`.trim()].filter(Boolean).join('');
}

const TEXT_MAX: Partial<Record<ProfileKey, number>> = {
  title_prefix: 20,
  first_name: 120,
  last_name: 120,
  line_id: 128,
  province: 128,
  district: 128,
  education: 128,
  note: 2000,
};

const LABEL: Record<ProfileKey, string> = {
  title_prefix: 'คำนำหน้า',
  first_name: 'ชื่อ',
  last_name: 'นามสกุล',
  gender: 'เพศ',
  age: 'อายุ',
  line_id: 'LINE ID',
  province: 'จังหวัด',
  district: 'อำเภอ/เขต',
  education: 'วุฒิการศึกษา',
  license_types: 'ประเภทใบขับขี่',
  weight_kg: 'น้ำหนัก',
  height_cm: 'ส่วนสูง',
  note: 'ความคิดเห็น',
};

function numberIn(raw: unknown, [min, max]: readonly [number, number], integer: boolean): number | null | 'bad' {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < min || n > max) return 'bad';
  if (integer && !Number.isInteger(n)) return 'bad';
  return integer ? n : Math.round(n * 10) / 10;
}

export type ProfileParse = { ok: true; patch: ProfilePatch } | { ok: false; message: string };

/**
 * ตรวจ + ปรับค่าที่ส่งเข้ามา (ใช้ทั้งฝั่ง API และก่อนส่งจากหน้าเว็บ)
 *
 * @param existingLicenses ใบขับขี่ที่ใบนี้มีอยู่แล้ว — ใบจากฟอร์มเก่าอาจมีคำนอกรายการ
 *   ยอมให้คงค่าเดิมได้ (ไม่ทำข้อมูลหาย) แต่ห้ามเติมคำนอกรายการใหม่
 */
export function parseProfilePatch(raw: unknown, existingLicenses: readonly string[] = []): ProfileParse {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' };
  }
  const b = raw as Record<string, unknown>;
  const unknownKey = Object.keys(b).find((k) => !(PROFILE_KEYS as readonly string[]).includes(k));
  if (unknownKey) return { ok: false, message: `แก้ช่อง ${unknownKey} จากที่นี่ไม่ได้` };
  const patch: ProfilePatch = {};

  for (const key of ['title_prefix', 'line_id', 'province', 'district', 'education', 'note'] as const) {
    if (!(key in b)) continue;
    const v = b[key];
    if (v !== null && typeof v !== 'string') return { ok: false, message: `${LABEL[key]}ไม่ถูกต้อง` };
    const t = typeof v === 'string' ? v.trim().slice(0, TEXT_MAX[key]) : '';
    patch[key] = t ? t : null;
  }
  for (const key of ['first_name', 'last_name'] as const) {
    if (!(key in b)) continue;
    const v = b[key];
    const t = typeof v === 'string' ? v.trim().slice(0, TEXT_MAX[key]) : '';
    if (!t) return { ok: false, message: `กรุณากรอก${LABEL[key]}` };
    patch[key] = t;
  }
  if ('gender' in b) {
    const g = b.gender;
    if (g === null || g === '') patch.gender = null;
    else if (g === 'male' || g === 'female' || g === 'other') patch.gender = g;
    else return { ok: false, message: 'เพศไม่ถูกต้อง' };
  }
  if ('age' in b) {
    const n = numberIn(b.age, PROFILE_LIMITS.age, true);
    if (n === 'bad') return { ok: false, message: `อายุต้องอยู่ระหว่าง ${PROFILE_LIMITS.age[0]}–${PROFILE_LIMITS.age[1]} ปี` };
    patch.age = n;
  }
  for (const key of ['weight_kg', 'height_cm'] as const) {
    if (!(key in b)) continue;
    const n = numberIn(b[key], PROFILE_LIMITS[key], false);
    if (n === 'bad') {
      const [min, max] = PROFILE_LIMITS[key];
      return { ok: false, message: `${LABEL[key]}ต้องอยู่ระหว่าง ${min}–${max}` };
    }
    patch[key] = n;
  }
  if ('license_types' in b) {
    const v = b.license_types;
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
      return { ok: false, message: 'ประเภทใบขับขี่ไม่ถูกต้อง' };
    }
    const allowed = new Set<string>([...PROFILE_LICENSE_OPTIONS, ...existingLicenses]);
    const bad = (v as string[]).find((x) => !allowed.has(x));
    if (bad) return { ok: false, message: `ไม่รู้จักใบขับขี่ "${bad}"` };
    // เรียงตามรายการกลาง แล้วตามด้วยคำเดิมนอกรายการ — กดสลับไปมาแล้วลำดับไม่เพี้ยน
    const picked = new Set(v as string[]);
    patch.license_types = [
      ...PROFILE_LICENSE_OPTIONS.filter((x) => picked.has(x)),
      ...[...picked].filter((x) => !PROFILE_LICENSE_OPTIONS.includes(x)),
    ];
  }
  return { ok: true, patch };
}

/** ค่าของช่องเดียวในรูปที่เทียบกันได้ (ใช้หาว่าช่องไหนเปลี่ยนจริง) */
function comparable(key: ProfileKey, v: unknown): string {
  if (key === 'license_types') return JSON.stringify([...((v as string[] | null) ?? [])].sort());
  if (key === 'age' || key === 'weight_kg' || key === 'height_cm') {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : String(v);
  }
  return v === null || v === undefined ? '' : String(v).trim();
}

/** เหลือเฉพาะช่องที่ต่างจากค่าเดิมจริง (API ใช้ก่อนเขียน — ไม่มีอะไรเปลี่ยน = ไม่เขียน ไม่จด log) */
export function changedProfilePatch(before: Source, patch: ProfilePatch): ProfilePatch {
  const out: ProfilePatch = {};
  for (const key of PROFILE_KEYS) {
    if (!(key in patch)) continue;
    const next = (patch as Record<string, unknown>)[key];
    const prev = (before as Record<string, unknown>)[key];
    if (comparable(key, next) !== comparable(key, prev)) {
      (out as Record<string, unknown>)[key] = next;
    }
  }
  return out;
}

/**
 * ฟอร์ม → ค่าที่จะส่ง (เฉพาะช่องที่เปลี่ยน) + ข้อความผิดตัวแรก
 * ใช้ตัวตรวจตัวเดียวกับ API (`parseProfilePatch`) ⇒ หน้าเว็บกับ server ตัดสินตรงกันเสมอ
 */
export function profilePatchFromDraft(
  before: ProfileDraft,
  draft: ProfileDraft,
): { patch: ProfilePatch; error: string | null } {
  const raw: Record<string, unknown> = {};
  for (const key of PROFILE_KEYS) {
    const a = before[key];
    const b = draft[key];
    const same = Array.isArray(a) ? comparable(key, a) === comparable(key, b) : String(a).trim() === String(b).trim();
    if (!same) raw[key] = b;
  }
  const parsed = parseProfilePatch(raw, before.license_types);
  if ('message' in parsed) return { patch: {}, error: parsed.message };
  return { patch: parsed.patch, error: null };
}
