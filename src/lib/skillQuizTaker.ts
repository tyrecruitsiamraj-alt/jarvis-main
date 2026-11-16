/**
 * ═══ แบบทดสอบ: ลิงก์เดียวต่อชุด + คนทำกรอกข้อมูลเอง + ใครในทีมเห็นชุด (เจ้าของ 16 พ.ย. 2569 · migration 180) ═══
 * > *"แบบของ Knowa … สิทธิคนนอกที่จะเข้าคือ เข้าได้ผ่าน Link นั้นเท่านั้น … ดูได้ทั้ง Bu นั้นๆ หรือ รายคน
 * > Login ด้วยบัตรประชาชน และวันเดือนปีเกิด … เข้ามาเห็นเฉพาะหน้านั้น"*
 * คนทำกรอก ชื่อ นามสกุล เบอร์โทร อายุ เลขบัตร วันเกิด + ยินยอม PDPA · ทำได้ครั้งเดียวต่อชุด
 * ตรรกะล้วน ใช้ทั้งหน้าเว็บและ server (ตรวจซ้ำที่ server เสมอ)
 */

export type QuizTakerInput = {
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  citizenId: string;
  /** YYYY-MM-DD (ค.ศ.) */
  birthDate: string;
};

export type QuizResumeInput = { citizenId: string; birthDate: string };

const digits = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\D/g, '') : '');
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** เลขบัตรประชาชน 13 หลัก + หลักตรวจสอบ */
export function isValidThaiCitizenId(raw: string): boolean {
  const d = digits(raw);
  if (d.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

/** 1-2345-67890-12-3 → x-xxxx-xxxxx-12-3 (ให้เจ้าหน้าที่เห็นแค่ท้ายบัตร) */
export function maskCitizenId(raw: string | null | undefined): string {
  const d = digits(raw);
  if (d.length !== 13) return '';
  return `x-xxxx-xxxxx-${d.slice(10, 12)}-${d[12]}`;
}

/** วันที่จริงในปฏิทินไหม (กัน 31 ก.พ.) */
function isRealDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** อายุเต็มปี ณ วันที่ `today` (YYYY-MM-DD) */
export function ageOn(birthDate: string, today: string): number | null {
  if (!isRealDate(birthDate) || !isRealDate(today)) return null;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export const QUIZ_TAKER_AGE_MIN = 15;
export const QUIZ_TAKER_AGE_MAX = 80;

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

function parseBirth(raw: unknown, today: string): Parsed<string> {
  const birthDate = text(raw, 10);
  const age = ageOn(birthDate, today);
  if (age === null) return { ok: false, message: 'เลือกวันเดือนปีเกิด' };
  if (age < QUIZ_TAKER_AGE_MIN || age > QUIZ_TAKER_AGE_MAX) return { ok: false, message: 'ตรวจวันเดือนปีเกิดอีกครั้ง' };
  return { ok: true, value: birthDate };
}

/** ฟอร์มก่อนเริ่มทำ — ข้อความผิดบอกช่องที่ต้องแก้ทีละช่องตามลำดับบนจอ */
export function parseQuizTakerInput(raw: unknown, today: string): Parsed<QuizTakerInput> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const firstName = text(o.firstName, 100);
  const lastName = text(o.lastName, 100);
  if (!firstName) return { ok: false, message: 'ใส่ชื่อ' };
  if (!lastName) return { ok: false, message: 'ใส่นามสกุล' };
  const phone = digits(o.phone);
  if (!/^0\d{8,9}$/.test(phone)) return { ok: false, message: 'ใส่เบอร์โทร 10 หลัก' };
  const age = Number(o.age);
  if (!Number.isInteger(age) || age < QUIZ_TAKER_AGE_MIN || age > QUIZ_TAKER_AGE_MAX) return { ok: false, message: 'ใส่อายุ' };
  const citizenId = digits(o.citizenId);
  if (!isValidThaiCitizenId(citizenId)) return { ok: false, message: 'เลขบัตรประชาชนไม่ถูกต้อง' };
  const birth = parseBirth(o.birthDate, today);
  if ('message' in birth) return { ok: false, message: birth.message };
  return { ok: true, value: { firstName, lastName, phone, age, citizenId, birthDate: birth.value } };
}

/** เข้าซ้ำ — เลขบัตร + วันเกิด */
export function parseQuizResumeInput(raw: unknown, today: string): Parsed<QuizResumeInput> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const citizenId = digits(o.citizenId);
  if (!isValidThaiCitizenId(citizenId)) return { ok: false, message: 'เลขบัตรประชาชนไม่ถูกต้อง' };
  const birth = parseBirth(o.birthDate, today);
  if ('message' in birth) return { ok: false, message: birth.message };
  return { ok: true, value: { citizenId, birthDate: birth.value } };
}

// ─── ใครในทีมเห็นชุด ─────────────────────────────────────────────────────────

export type QuizViewers = { bus: string[]; userIds: string[] };
/** ไม่เลือกอะไรเลย = ทุกคนที่เข้าหน้านี้ได้ (ชุดเก่าก่อน 16 พ.ย. เป็นแบบนี้) */
export type QuizViewerMode = 'all' | 'bu' | 'people';

export function quizViewerMode(v: QuizViewers): QuizViewerMode {
  if (v.userIds.length > 0) return 'people';
  if (v.bus.length > 0) return 'bu';
  return 'all';
}

const UUID = /^[0-9a-f-]{36}$/i;

export function parseQuizViewers(raw: unknown, allowedBus: readonly string[]): Parsed<QuizViewers> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()) : []);
  const mode = o.mode === 'bu' || o.mode === 'people' ? o.mode : 'all';
  if (mode === 'all') return { ok: true, value: { bus: [], userIds: [] } };
  if (mode === 'bu') {
    const bus = [...new Set(list(o.bus).map((x) => x.toUpperCase()))].filter((x) => allowedBus.includes(x));
    if (bus.length === 0) return { ok: false, message: 'เลือก BU ที่เห็นชุดนี้' };
    return { ok: true, value: { bus, userIds: [] } };
  }
  const userIds = [...new Set(list(o.userIds))].filter((x) => UUID.test(x)).slice(0, 200);
  if (userIds.length === 0) return { ok: false, message: 'เลือกคนที่เห็นชุดนี้' };
  return { ok: true, value: { bus: [], userIds } };
}

/** `codes: null` = เห็นทุก BU (admin) */
export type QuizViewer = { userId: string; isAdmin: boolean; codes: readonly string[] | null };

/** คนสร้าง + admin เห็นเสมอ · ผลของคนทำเห็นตามชุด */
export function canSeeQuizSet(set: { viewer_bus: readonly string[]; viewer_user_ids: readonly string[]; created_by_user_id: string | null }, me: QuizViewer): boolean {
  if (me.isAdmin) return true;
  if (set.created_by_user_id && set.created_by_user_id === me.userId) return true;
  if (set.viewer_user_ids.length > 0) return set.viewer_user_ids.includes(me.userId);
  if (set.viewer_bus.length > 0) return me.codes === null || set.viewer_bus.some((b) => me.codes!.includes(b));
  return true;
}
