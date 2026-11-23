/**
 * ═══ รายชื่อจาก Scrap (JobBKK / JobThai ผ่าน So Scraping) — เจ้าของ 17 พ.ย. 2569 ═══
 * > *"ถ้าสั่ง Scrap ไปเอารายชื่อมาให้ด้วยได้ไหม … ยังไม่ต้องส่ง Ai โทรก็ได้แต่บอกว่ามาจาก Scrap"*
 * > *"เอาหมดแต่บอกด้วยว่าคนไหนผ่านเกณฑ์ คนไหนไม่ผ่าน … เปิดใบขอไหนที่มีการสั่ง Scrap ต้องเห็นรายชื่อ"*
 * > *"ถ้าจะกดโทรก็ให้เลือกแล้วเก็บเข้าไปหน้าการติดต่อ จากนั้นก็มีปุ่มให้กดมาหน้าการติดต่อ"*
 *
 * - อ่านสด ๆ จากฐานของ So Scraping ตอนเปิดหน้า (ฐานเดียวกัน · Choice เจ้าของ "เข้าทุก 5 นาทีระบบจะช้าไหม" → ไม่ต้องดึงรอบ)
 *   ไม่คัดลอกมาเก็บ ⇒ ตัวเลขตรงกับหน้า So Scraping เสมอ
 * - รายชื่อ Scrap ยังไม่ใช่ใบสมัคร · กด "เก็บเข้าการติดต่อ" ถึงสร้างใบสมัคร (ป้าย `Scrap · JobBKK`) แล้วเก็บเป็น Lead ของคนกด
 *   AI ไม่โทรเอง (สร้างในชื่อ So Scraping + เป็น Lead — ตัวส่งอัตโนมัติข้ามทั้งสองแบบ)
 * - ผลประเมิน/เหตุผลใช้ของ So Scraping ตรง ๆ (คำเดียวกับหน้า `candidates/jobs/[taskId]` ของ So Scraping) ห้ามคิดเกณฑ์เอง
 * ตรรกะล้วน ใช้ทั้งหน้าจอและ server
 */

export type ScrapResult = 'qualified' | 'needs_review' | 'rejected' | 'unscored';
export type ScrapPlatform = 'jobbkk' | 'jobthai' | null;

export const SCRAP_RESULT_ORDER: ScrapResult[] = ['qualified', 'needs_review', 'rejected', 'unscored'];

/** ป้ายผลประเมิน — บอกด้วยคำ ไม่ใช้สีอย่างเดียว */
export const SCRAP_RESULT_LABEL: Record<ScrapResult, string> = {
  qualified: 'ผ่านเกณฑ์',
  needs_review: 'ต้องดูเพิ่ม',
  rejected: 'ไม่ผ่าน',
  unscored: 'ยังไม่ประเมิน',
};

export const SCRAP_RESULT_TONE: Record<ScrapResult, 'success' | 'warn' | 'danger' | 'neutral'> = {
  qualified: 'success',
  needs_review: 'warn',
  rejected: 'danger',
  unscored: 'neutral',
};

const PLATFORM_LABEL: Record<string, string> = { jobbkk: 'JobBKK', jobthai: 'JobThai' };

export function scrapPlatformLabel(p: string | null | undefined): string {
  return (p && PLATFORM_LABEL[p]) || 'เว็บหางาน';
}

/** ช่องทางบนใบสมัครที่สร้างจาก Scrap — บอกว่ามาจาก Scrap + เว็บไหน */
export function scrapChannelLabel(p: string | null | undefined): string {
  return `Scrap · ${scrapPlatformLabel(p)}`;
}

export function scrapResultOf(raw: unknown): ScrapResult {
  return raw === 'qualified' || raw === 'needs_review' || raw === 'rejected' ? raw : 'unscored';
}

const REASON: Record<string, string> = {
  wrong_job_family: 'ประสบการณ์ยังไม่ตรงสายงานนี้',
  off_role: 'ตำแหน่งในเรซูเม่ไม่ตรงสายงานนี้',
  location_mismatch: 'พื้นที่ทำงานไม่ตรงเงื่อนไข',
  education_below_minimum: 'วุฒิต่ำกว่าเกณฑ์',
  gender_mismatch: 'เพศไม่ตรงที่ใบขอระบุ',
  age_out_of_range: 'อายุอยู่นอกช่วงที่ใบขอระบุ',
  compensation_mismatch: 'เงินเดือนที่ขอเกินเงื่อนไข',
  duplicate: 'ซ้ำกับคนที่มีแล้ว',
  missing_contact: 'ไม่มีช่องทางติดต่อ',
  incomplete_profile: 'ข้อมูลในเรซูเม่ไม่ครบ',
};

const FIELD: Record<string, string> = {
  job_family: 'สายงาน',
  province: 'พื้นที่',
  education: 'วุฒิ',
  gender: 'เพศ',
  age_min: 'อายุ',
  age_max: 'อายุ',
  salary: 'เงินเดือน',
  salary_max: 'เงินเดือน',
  required_license: 'ใบอนุญาต',
  required_skill: 'ทักษะที่ต้องมี',
  certificate: 'ใบรับรอง',
  identity: 'ตัวตนผู้สมัคร',
  work_experience: 'ประสบการณ์',
  attachments_missing: 'ไฟล์แนบ',
  name: 'ชื่อ',
  address: 'ที่อยู่',
};

/** เหตุผลจาก So Scraping (รหัส) → คำที่คนอ่านเข้าใจ · รหัสที่ไม่รู้จักโชว์ตามที่ได้มา ไม่ทิ้ง */
export function scrapReasonLabel(code: string): string {
  if (REASON[code]) return REASON[code];
  const [kind, field = ''] = code.split(':');
  const f = FIELD[field] ?? field.replace(/_/g, ' ');
  if (kind === 'insufficient_evidence') return `เรซูเม่ยังไม่บอก${f ? `เรื่อง${f}` : 'พอ'}`;
  if (kind === 'incomplete' || kind === 'incomplete_attachments') return `ข้อมูล${f || ''}ไม่ครบ`;
  return code.replace(/_/g, ' ');
}

/** เพศจาก So Scraping ('ชาย'/'หญิง'/'male'/'female'/ว่าง) → ค่าของใบสมัคร */
export function scrapGender(raw: unknown): 'male' | 'female' | null {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'ชาย' || s === 'male' || s === 'm') return 'male';
  if (s === 'หญิง' || s === 'female' || s === 'f') return 'female';
  return null;
}

/** อายุเป็นข้อความ ("32", "32 ปี") → ตัวเลข 15–80 · อ่านไม่ได้ = null */
export function scrapAge(raw: unknown): number | null {
  const m = /\d{1,3}/.exec(String(raw ?? ''));
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) && n >= 15 && n <= 80 ? n : null;
}

/** เบอร์มือถือไทย 10 หลัก (ตัด +66/66 นำหน้า) · ไม่ใช่เบอร์มือถือ = null */
export function scrapPhone10(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('66') && d.length === 11) d = `0${d.slice(2)}`;
  return /^0[689]\d{8}$/.test(d) ? d : null;
}

/** แยกชื่อ-นามสกุล (ชื่อเต็มที่ So Scraping ไม่แยกมา) — คำแรกเป็นชื่อ ที่เหลือเป็นนามสกุล */
export function scrapSplitName(full: string | null | undefined, first?: string | null, last?: string | null): { first: string; last: string } {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f) return { first: f, last: l };
  const parts = String(full ?? '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

/**
 * ชื่อที่ขึ้นบนจอ (เจ้าของ 23 พ.ย. 2569) — ไม่มีชื่อ + เจ้าของเรซูเม่ซ่อนชื่อบน JobThai (`candidates.name_hidden`) = "ผู้สมัครซ่อนชื่อ"
 * (คนกลุ่มนี้มีเบอร์เสมอ) · ไม่มีชื่อแบบอื่น = "ไม่มีชื่อ" เหมือนเดิม · ใช้เป็นชื่อตอนเก็บเข้าการติดต่อด้วย (ห้ามว่าง)
 */
export const SCRAP_NAME_HIDDEN = 'ผู้สมัครซ่อนชื่อ';
export const SCRAP_NAME_MISSING = 'ไม่มีชื่อ';
export function scrapDisplayName(full: string | null | undefined, first: string | null | undefined, last: string | null | undefined, nameHidden: boolean | null | undefined): string {
  const name = (full ?? '').trim() || [first, last].filter(Boolean).join(' ').trim();
  if (name) return name;
  return nameHidden === true ? SCRAP_NAME_HIDDEN : SCRAP_NAME_MISSING;
}

/** สถานะคนนี้ในฝั่ง Jarvis (จับคู่ด้วยเบอร์ในใบขอเดียวกัน) */
export type ScrapInJarvis = { application_id: string; is_lead: boolean; lead_by_name: string | null } | null;

export type ScrapCandidateRow = {
  candidate_id: string;
  request_no: string;
  full_name: string;
  phone: string | null;
  age: number | null;
  gender: 'male' | 'female' | null;
  province: string | null;
  platform: ScrapPlatform;
  result: ScrapResult;
  score: number | null;
  reasons: string[];
  found_at: string | null;
  in_jarvis: ScrapInJarvis;
};

export type ScrapCounts = Record<ScrapResult, number> & { total: number };

export function emptyScrapCounts(): ScrapCounts {
  return { total: 0, qualified: 0, needs_review: 0, rejected: 0, unscored: 0 };
}

/** นับตามผลประเมิน — ทุกกองรวมกัน = ทั้งหมด */
export function countScrapResults(rows: Array<Pick<ScrapCandidateRow, 'result'>>): ScrapCounts {
  const c = emptyScrapCounts();
  for (const r of rows) {
    c[r.result] += 1;
    c.total += 1;
  }
  return c;
}

/** สถานะในฝั่ง Jarvis เป็นคำ · null = ยังไม่ได้เก็บ */
export function scrapInJarvisLabel(x: ScrapInJarvis): string | null {
  if (!x) return null;
  if (x.is_lead) return x.lead_by_name ? `อยู่ในการติดต่อของ ${x.lead_by_name}` : 'อยู่ในการติดต่อแล้ว';
  return 'มีใบสมัครแล้ว';
}

export const SCRAP_TO_CONTACT_MAX = 50;

export type ScrapToContactResult = {
  candidate_id: string;
  name: string;
  outcome: 'added' | 'existing' | 'skipped';
  application_id: string | null;
  /** เหตุเป็นคำ (ข้าม/ใช้ใบเดิม) */
  note: string | null;
};
