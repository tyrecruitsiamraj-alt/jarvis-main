/**
 * ═══ แบบฟอร์มใบสมัครหลายแบบ (เจ้าของ 27 พ.ย. 2569) ═══
 * > *"จะมีไปออกบูธรับสมัคร เลยอยากเพิ่มอีกฟอร์ม … ใช้แค่บาง Bu เลยคิดว่าทำให้เลือกฟอร์มได้ดีไหม"*
 * Choice "ติ๊กจากช่องที่มีให้" · แบบร่าง 3 จอ (ตั้งค่า › แบบฟอร์มใบสมัคร · Gen link เลือกฟอร์ม · หน้าสมัครมีช่องเสริม) "ทำตามแบบร่าง"
 *
 * - "ฟอร์มมาตรฐาน" = ไม่มีแถวในฐาน (apply_form_id = null) ลบไม่ได้ · ฟอร์มอื่น = ฟอร์มมาตรฐาน + ช่องเสริมที่ติ๊ก
 * - ช่องเสริมไม่บังคับกรอกทุกช่อง (เจ้าของ Choice 25 พ.ย. 2569 "ไม่บังคับทุกช่อง") · เงินเดือน = พิมพ์ตัวเลขต่ำสุด–สูงสุด
 * - ฟอร์มผูก BU — Gen link เห็นเฉพาะฟอร์มที่ BU นั้นใช้ได้ · ไม่ติ๊ก BU เลย = ทุก BU
 * ไฟล์ล้วน ใช้ทั้งหน้าเว็บและหลังบ้าน (`api/_lib/applyForms.ts`) · เทสต์ `tests/api/applyForms2569-11-27.test.ts`
 */

export type ApplyFormField = 'university' | 'faculty' | 'major' | 'salary' | 'position';

export const APPLY_FORM_FIELDS: ReadonlyArray<{ key: ApplyFormField; label: string; placeholder: string }> = [
  { key: 'university', label: 'มหาวิทยาลัย', placeholder: 'เช่น มหาวิทยาลัยเกษตรศาสตร์' },
  { key: 'faculty', label: 'คณะ', placeholder: 'เช่น วิศวกรรมศาสตร์' },
  { key: 'major', label: 'สาขา', placeholder: 'เช่น คอมพิวเตอร์' },
  { key: 'salary', label: 'เงินเดือนที่ต้องการ', placeholder: '' },
  { key: 'position', label: 'ตำแหน่งที่สนใจ', placeholder: 'เช่น เจ้าหน้าที่ไอที' },
];

export const STANDARD_APPLY_FORM_NAME = 'ฟอร์มมาตรฐาน';

export type ApplyForm = {
  id: number;
  name: string;
  /** BU ที่ใช้ฟอร์มนี้ได้ · ว่าง = ทุก BU */
  departmentCodes: string[];
  fields: ApplyFormField[];
  active: boolean;
  /** จำนวนประกาศ (ลิงก์ที่ Gen) ที่ใช้ฟอร์มนี้ — มี = ลบไม่ได้ เลิกใช้แทน */
  linkCount: number;
};

/** คำตอบช่องเสริมที่เก็บกับใบสมัคร (`public_job_applications.extra_answers`) */
export type ApplyExtraAnswers = {
  university?: string;
  faculty?: string;
  major?: string;
  salaryMin?: number;
  salaryMax?: number;
  position?: string;
};

const FIELD_KEYS = new Set<string>(APPLY_FORM_FIELDS.map((f) => f.key));
const MAX_TEXT = 120;
const MAX_SALARY = 10_000_000;

/** ช่องที่รู้จัก ไม่ซ้ำ เรียงตามลำดับกลาง — ค่าแปลกทิ้ง */
export function cleanApplyFormFields(raw: unknown): ApplyFormField[] {
  if (!Array.isArray(raw)) return [];
  const want = new Set(raw.filter((v): v is string => typeof v === 'string' && FIELD_KEYS.has(v)));
  return APPLY_FORM_FIELDS.map((f) => f.key).filter((k) => want.has(k));
}

/** รหัส BU ตัวใหญ่ ไม่ซ้ำ · ค่าว่างทิ้ง */
export function cleanDepartmentCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const v of raw) {
    const c = typeof v === 'string' ? v.trim().toUpperCase() : '';
    if (/^[A-Z0-9]{1,16}$/.test(c)) out.add(c);
  }
  return [...out].sort();
}

/** ฟอร์มที่ใช้ได้กับ BU นี้ (เปิดใช้อยู่ · ผูก BU นี้หรือทุก BU) */
export function applyFormsForBu(forms: readonly ApplyForm[], bu: string | null | undefined): ApplyForm[] {
  const code = (bu ?? '').trim().toUpperCase();
  return forms.filter((f) => f.active && (f.departmentCodes.length === 0 || (code !== '' && f.departmentCodes.includes(code))));
}

function cleanText(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  return s || undefined;
}

function cleanMoney(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[,\s฿บาท]/g, '')) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.round(n), MAX_SALARY);
}

/**
 * คำตอบจากหน้าสมัคร → เก็บเฉพาะช่องที่ฟอร์มของลิงก์มีจริง (หน้าสาธารณะ ใครยิงตรงก็ได้ — ไม่เชื่อช่องที่ส่งมา)
 * เงินเดือนต่ำสุด > สูงสุด = สลับให้ · ไม่มีอะไรเลย = null
 */
export function sanitizeApplyExtra(raw: unknown, fields: readonly ApplyFormField[]): ApplyExtraAnswers | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const on = new Set(fields);
  const out: ApplyExtraAnswers = {};
  if (on.has('university')) out.university = cleanText(r.university);
  if (on.has('faculty')) out.faculty = cleanText(r.faculty);
  if (on.has('major')) out.major = cleanText(r.major);
  if (on.has('position')) out.position = cleanText(r.position);
  if (on.has('salary')) {
    let lo = cleanMoney(r.salaryMin);
    let hi = cleanMoney(r.salaryMax);
    if (lo !== undefined && hi !== undefined && lo > hi) [lo, hi] = [hi, lo];
    out.salaryMin = lo;
    out.salaryMax = hi;
  }
  const clean = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as ApplyExtraAnswers;
  return Object.keys(clean).length > 0 ? clean : null;
}

const money = (n: number) => n.toLocaleString('th-TH');

/** บรรทัดที่ขึ้นในป๊อปผู้สมัคร (ป้าย = คำเดียวกับหน้าสมัคร) — ช่องที่ไม่ได้กรอกไม่ขึ้น */
export function applyExtraLines(ans: ApplyExtraAnswers | null | undefined): Array<{ label: string; value: string }> {
  if (!ans) return [];
  const lines: Array<{ label: string; value: string }> = [];
  if (ans.university) lines.push({ label: 'มหาวิทยาลัย', value: ans.university });
  if (ans.faculty) lines.push({ label: 'คณะ', value: ans.faculty });
  if (ans.major) lines.push({ label: 'สาขา', value: ans.major });
  if (ans.salaryMin !== undefined || ans.salaryMax !== undefined) {
    const lo = ans.salaryMin;
    const hi = ans.salaryMax;
    const value = lo !== undefined && hi !== undefined ? `${money(lo)}–${money(hi)} บาท` : lo !== undefined ? `ตั้งแต่ ${money(lo)} บาท` : `ไม่เกิน ${money(hi!)} บาท`;
    lines.push({ label: 'เงินเดือนที่ต้องการ', value });
  }
  if (ans.position) lines.push({ label: 'ตำแหน่งที่สนใจ', value: ans.position });
  return lines;
}
