/**
 * ═══ ข้อความโพสต์ประกาศ — วางแล้วเติมช่อง + สร้างข้อความให้คัดลอก (เจ้าของ 6 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"โพสต์ประกาศ … ทำให้วางแบบ โพสต์มาวางแล้วเอาไปประกาศได้ปะ … เนี่ยข้อมูลพวกนี้อะที่ใช้โพสต์"* → Choice "ทำทั้งสองอย่าง"
 * ตัวอย่างข้อความที่ทีมใช้จริง:
 * ```
 * พขร.ส่วนกลาง ประจำสำโรง เงินเดือน 11,160 (รายได้รวม 17000++) (ไม่ใส่ชื่อหน่วยงาน  TMT)
 * เงินเดือน 11,160, เบี้ยขยัน 500, ครองชีพ 300, เบี้ยเลี้ยงนอกเขตกทม.และปริมณฑล 110, แท๊กซี่ 110
 * ทำงาน จ.-ศ. และส.ตามปฏิทิน เวลา 7.30-16.30 น.
 * เพศชาย อายุ 30-50 ปี, มีประสบการณ์ขับรถนาย 1 ปีขึ้นไป, ชำนาญเส้นทางกรุงเทพและปริมณฑล, …
 * ```
 * - `parsePostText` = ข้อความ → ช่องของประกาศ (รายได้แยกรายการ · รายได้รวม · วันเวลาทำงาน · เพศ · อายุ · คุณสมบัติ)
 *   บรรทัดแรก (ตำแหน่ง/พื้นที่) และวงเล็บโน้ตภายใน ("ไม่ใส่ชื่อหน่วยงาน") ไม่เอา
 * - `buildPostText` = ใบงาน (หลังทับค่าที่แก้เองแล้ว) → ข้อความรูปเดียวกับตัวอย่าง พร้อมลิงก์สมัคร
 * 🔴 ไม่ใส่ชื่อหน่วยงานในข้อความโพสต์ (ตามโน้ตในตัวอย่างของเจ้าของ)
 *
 * ไฟล์นี้ pure — เทสต์ที่ `tests/api/postText.test.ts`
 */
import type { JobRequest } from '@/types';
import { INCOME_LABEL_MAX, INCOME_LINE_MAX, type IncomeLine } from '@/lib/incomeBreakdown';
import type { GenderChoice } from '@/lib/genderRequirement';
import { boardCardAge, boardCardGender, boardCardPlace } from '@/lib/boardCardFacts';
import { isOtBenefit, publicBenefitList, publicFieldVisible } from '@/lib/publicFieldVisibility';
import { benefitDisplayLabels, isRetiredBenefit } from '@/lib/extraBenefits';
import { jobBaseIncome } from '@/lib/jobPublicFacts';
import { publicJobTitle } from '@/lib/publicJobTitle';

/** เพดาน — ฝั่ง API (`cleanFieldOverrides`) ใช้ค่าเดียวกัน */
export const POST_SCHEDULE_MAX = 200;
export const POST_REQUIREMENT_MAX = 10;
export const POST_REQUIREMENT_LABEL_MAX = 80;

/** ล้างรายการคุณสมบัติ — ตัดว่าง/ซ้ำ · ตัดความยาว · เพดานจำนวน */
export function cleanRequirementLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    if (typeof r !== 'string') continue;
    const t = r.replace(/\s+/g, ' ').trim().slice(0, POST_REQUIREMENT_LABEL_MAX);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= POST_REQUIREMENT_MAX) break;
  }
  return out;
}

export type ParsedPost = {
  /** รายการรายได้ "ชื่อ ยอด" คั่นด้วยจุลภาค — ว่าง = ไม่เจอ */
  incomeLines: IncomeLine[];
  /** "รายได้รวม 17000++" */
  total: number | null;
  schedule: string | null;
  gender: GenderChoice | null;
  ageMin: number | null;
  ageMax: number | null;
  requirements: string[];
};

const THAI_DIGITS = /[๐-๙]/g;
const toArabic = (s: string) => s.replace(THAI_DIGITS, (d) => String(d.charCodeAt(0) - 0x0e50));
const num = (s: string) => Number(s.replace(/,/g, ''));
/** แยกรายการด้วยจุลภาค — ไม่แยกจุลภาคในตัวเลข ("11,160" ต้องเป็นก้อนเดียว) */
const splitItems = (s: string) => s.split(/[,，](?!\d{3}(?:\D|$))/u);

/** ส่วน "ชื่อ ยอด" หนึ่งรายการ เช่น "เบี้ยขยัน 500" · "เงินเดือน 11,160 บาท" */
const INCOME_SEGMENT = /^([^\d]{2,}?)\s*([\d,]+(?:\.\d+)?)\s*(?:บาท)?\s*(?:\/\s*(?:เดือน|วัน))?\s*$/u;
const NOT_INCOME_LABEL = /อายุ|เวลา|ปี|ชม|ทำงาน|เพศ|รายได้รวม|จำนวน|อัตรา/u;
const AGE_RANGE = /อายุ\s*(\d{2})\s*(?:-|–|ถึง)\s*(\d{2})/u;
const AGE_MIN = /อายุ\s*(\d{2})\s*ปี?\s*ขึ้นไป/u;
const AGE_MAX = /อายุ\s*(?:ไม่เกิน)\s*(\d{2})/u;
const TIME_RANGE = /\d{1,2}[.:]\d{2}\s*(?:-|–|ถึง)\s*\d{1,2}[.:]\d{2}/u;
const SCHEDULE_HINT = /ทำงาน|เวลา|กะ|วันหยุด|จ\.\s*-\s*ศ\.|จันทร์/u;

/** ป้ายรายได้ยาวเกินช่อง — ตัดที่จุด/ช่องว่างก่อนเพดาน (ไม่ตัดกลางคำ) */
function fitIncomeLabel(label: string): string {
  const t = label.replace(/\s+/g, ' ').trim();
  if (t.length <= INCOME_LABEL_MAX) return t;
  const head = t.slice(0, INCOME_LABEL_MAX);
  const cut = Math.max(head.lastIndexOf('.'), head.lastIndexOf(' '));
  return (cut > 4 ? head.slice(0, cut + (head[cut] === '.' ? 1 : 0)) : head).trim();
}

/** ชื่อรายได้ที่ทีมพิมพ์สั้น → ชื่อเดียวกับที่ระบบใช้ (เงินเดือน = ฐานเงินเดือน) */
function incomeLabelOf(raw: string): string {
  const t = raw.replace(/[:：]\s*$/, '').trim();
  if (t === 'เงินเดือน') return 'ฐานเงินเดือน';
  return fitIncomeLabel(t);
}

function incomeLinesOf(line: string): IncomeLine[] {
  const out: IncomeLine[] = [];
  for (const seg of splitItems(line)) {
    const m = INCOME_SEGMENT.exec(seg.trim());
    if (!m) continue;
    const label = m[1].trim();
    const amount = Math.trunc(num(m[2]));
    if (NOT_INCOME_LABEL.test(label) || !Number.isFinite(amount) || amount <= 0) continue;
    out.push({ label: incomeLabelOf(label), amount });
  }
  return out;
}

function genderOf(text: string): GenderChoice | null {
  if (/ไม่จำกัดเพศ|ชาย\s*(?:\/|หรือ|และ)\s*หญิง|หญิง\s*(?:\/|หรือ|และ)\s*ชาย/u.test(text)) return 'ไม่จำกัด';
  const m = /เพศ\s*(ชาย|หญิง)/u.exec(text);
  return m ? (m[1] as GenderChoice) : null;
}

const isGenderOrAgeSegment = (s: string) =>
  /^(?:เพศ\s*(?:ชาย|หญิง)|ไม่จำกัดเพศ|ชาย\s*(?:\/|หรือ)\s*หญิง)/u.test(s) || /^อายุ/u.test(s);

/**
 * ข้อความโพสต์ → ช่องของประกาศ · อ่านไม่ออก = ช่องนั้นว่าง (ห้ามเดา)
 * บรรทัดแรก = หัวโพสต์ (ตำแหน่ง · พื้นที่ · เงินเดือน) อ่านแค่ "รายได้รวม" · บรรทัดรายได้ = บรรทัดที่มี "ชื่อ ยอด" มากสุด
 */
export function parsePostText(input: string): ParsedPost {
  const text = toArabic(input ?? '');
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: ParsedPost = {
    incomeLines: [],
    total: null,
    schedule: null,
    gender: genderOf(text),
    ageMin: null,
    ageMax: null,
    requirements: [],
  };
  if (lines.length === 0) return out;

  const totalM = /รายได้รวม\s*([\d,]+)/u.exec(text);
  if (totalM) out.total = Math.trunc(num(totalM[1])) || null;

  const range = AGE_RANGE.exec(text);
  if (range) {
    out.ageMin = Number(range[1]);
    out.ageMax = Number(range[2]);
  } else {
    const min = AGE_MIN.exec(text);
    const max = AGE_MAX.exec(text);
    if (min) out.ageMin = Number(min[1]);
    if (max) out.ageMax = Number(max[1]);
  }

  // บรรทัดรายได้ — บรรทัดที่อ่าน "ชื่อ ยอด" ได้มากสุด (ไม่นับบรรทัดแรก ซึ่งเป็นหัวโพสต์)
  const body = lines.slice(1);
  let incomeIdx = -1;
  for (let i = 0; i < body.length; i += 1) {
    const found = incomeLinesOf(body[i]);
    if (found.length > out.incomeLines.length) {
      out.incomeLines = found;
      incomeIdx = i;
    }
  }
  // ไม่มีบรรทัดแยกรายการ — ใช้ "เงินเดือน N" ของหัวโพสต์เป็นบรรทัดเดียว
  if (out.incomeLines.length === 0) {
    const base = /เงินเดือน\s*([\d,]+)/u.exec(lines[0]);
    if (base && num(base[1]) > 0) out.incomeLines = [{ label: 'ฐานเงินเดือน', amount: Math.trunc(num(base[1])) }];
  }
  out.incomeLines = out.incomeLines.slice(0, INCOME_LINE_MAX);

  const requirements: string[] = [];
  body.forEach((line, i) => {
    if (i === incomeIdx || /^\(.*\)$/u.test(line)) return;
    const hasGenderAge = genderOf(line) !== null || /อายุ\s*\d/u.test(line);
    if (!out.schedule && !hasGenderAge && (TIME_RANGE.test(line) || SCHEDULE_HINT.test(line))) {
      out.schedule = line.slice(0, POST_SCHEDULE_MAX);
      return;
    }
    // บรรทัดเพศ/อายุ/คุณสมบัติ — แยกจุลภาค ตัดส่วนเพศ/อายุออก ที่เหลือเป็นคุณสมบัติ
    for (const seg of splitItems(line)) {
      let s = seg.trim();
      if (!s) continue;
      // "เพศชาย อายุ 30-50 ปี" อยู่ส่วนเดียวกัน — ตัดหัวเพศ/อายุออกก่อน
      s = s
        .replace(/^(?:เพศ\s*(?:ชาย|หญิง)|ไม่จำกัดเพศ|ชาย\s*(?:\/|หรือ)\s*หญิง)\s*/u, '')
        .replace(/^อายุ\s*\d{2}\s*(?:(?:-|–|ถึง)\s*\d{2})?\s*ปี?\s*(?:ขึ้นไป)?\s*/u, '')
        .replace(/^อายุไม่เกิน\s*\d{2}\s*ปี?\s*/u, '')
        .trim();
      if (!s || isGenderOrAgeSegment(s)) continue;
      requirements.push(s);
    }
  });
  out.requirements = cleanRequirementLines(requirements);
  return out;
}

/** มีอะไรให้เติมไหม — ปุ่ม "ใช้ข้อมูลนี้" กดได้เมื่ออ่านได้อย่างน้อยหนึ่งช่อง */
export function parsedPostHasData(p: ParsedPost): boolean {
  return (
    p.incomeLines.length > 0 ||
    p.total !== null ||
    p.schedule !== null ||
    p.gender !== null ||
    p.ageMin !== null ||
    p.ageMax !== null ||
    p.requirements.length > 0
  );
}

/**
 * ช่องที่ได้จากข้อความ → patch ของ field_overrides (spread ของเดิมก่อนเสมอ — API เขียนทับทั้งก้อน)
 * ช่องที่อ่านไม่ได้ = คงค่าเดิม (ไม่ล้าง)
 */
export function postTextOverridesPatch(
  existing: Record<string, unknown> | null | undefined,
  p: ParsedPost,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(existing ?? {}) };
  if (p.incomeLines.length > 0) {
    const sum = p.incomeLines.reduce((s, l) => s + l.amount, 0);
    out.income = { period: 'monthly', lines: p.incomeLines, total: p.total !== null && p.total > sum ? p.total : null };
    out.total_income = null;
  } else if (p.total !== null) {
    out.total_income = p.total;
  }
  if (p.schedule) out.work_schedule = p.schedule;
  if (p.gender) out.gender = p.gender;
  if (p.ageMin !== null) out.age_min = p.ageMin;
  if (p.ageMax !== null) out.age_max = p.ageMax;
  if (p.requirements.length > 0) out.requirements = p.requirements;
  return out;
}

const NUM = new Intl.NumberFormat('th-TH');

/**
 * ใบงาน → ข้อความโพสต์รูปเดียวกับที่ทีมใช้ · ไม่มีชื่อหน่วยงาน · มีลิงก์ = บรรทัดท้าย
 * ช่องที่ติ๊กซ่อนจากหน้าสาธารณะ (รายได้/สวัสดิการ) ก็ไม่ใส่ในโพสต์
 */
export function buildPostText(job: JobRequest, link?: string | null): string {
  const lines: string[] = [];
  const place = boardCardPlace(job);
  const area = place === 'ยังไม่ระบุสถานที่' ? '' : ` ประจำ${place.split(' · ').pop()}`;
  const incomeShown = publicFieldVisible(job, 'income');
  const breakdown = incomeShown ? job.field_overrides?.income ?? null : null;
  const baseLine = breakdown?.lines.find((l) => l.label === 'ฐานเงินเดือน') ?? null;
  const total = job.income_display?.total ?? null;
  let head = `${publicJobTitle(job)}${area}`;
  if (incomeShown) {
    if (baseLine) {
      head += ` เงินเดือน ${NUM.format(baseLine.amount)}`;
      if (total && total > baseLine.amount) head += ` (รายได้รวม ${NUM.format(total)}++)`;
    } else {
      const base = jobBaseIncome(job);
      // รูปเดียวกับตัวอย่างของทีม — "เงินเดือน 12,000" · รายวัน = "ค่าแรง 400 บาท/วัน"
      if (base) head += /\/วัน/u.test(base.text) ? ` ค่าแรง ${base.text}` : ` เงินเดือน ${base.text.replace(/\s*บาท(?:\/เดือน)?$/u, '')}`;
    }
  }
  lines.push(head);
  if (breakdown && breakdown.lines.length > 1) {
    lines.push(breakdown.lines.map((l) => `${l.label === 'ฐานเงินเดือน' ? 'เงินเดือน' : l.label} ${NUM.format(l.amount)}`).join(', '));
  }
  const schedule = (job.work_schedule ?? '').trim();
  if (schedule) lines.push(schedule);
  const gender = boardCardGender(job);
  const age = boardCardAge(job);
  const who = [
    gender.known ? (gender.text === 'ไม่จำกัดเพศ' ? gender.text : `เพศ${gender.text}`) : null,
    age === 'ไม่ระบุอายุ' ? null : age,
    ...(job.requirements ?? []),
  ].filter(Boolean);
  if (who.length > 0) lines.push(who.join(', '));
  const benefits = publicBenefitList(job, benefitDisplayLabels(job.extra_benefits)).filter(
    (b) => !isOtBenefit(b) && !isRetiredBenefit(b),
  );
  if (benefits.length > 0) lines.push(`สวัสดิการ ${benefits.join(', ')}`);
  if (link) lines.push(`สมัครงาน ${link}`);
  return lines.join('\n');
}
