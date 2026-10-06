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
  /** รายละเอียดงาน (6 ต.ค. 2569) — จุดรับนาย · จุดส่งนาย · รถที่ใช้ */
  details: string[];
};

const THAI_DIGITS = /[๐-๙]/g;
const toArabic = (s: string) => s.replace(THAI_DIGITS, (d) => String(d.charCodeAt(0) - 0x0e50));
const num = (s: string) => Number(s.replace(/,/g, ''));
/** แยกรายการด้วยจุลภาค — ไม่แยกจุลภาคในตัวเลข ("11,160" ต้องเป็นก้อนเดียว) */
const splitItems = (s: string) => s.split(/[,，](?!\d{3}(?:\D|$))/u);

/** ส่วน "ชื่อ ยอด" หนึ่งรายการ เช่น "เบี้ยขยัน 500" · "เงินเดือน 11,160 บาท" */
const INCOME_SEGMENT = /^([^\d]{2,}?)\s*([\d,]+(?:\.\d+)?)\s*(?:บาท)?\s*(?:\/\s*(?:เดือน|วัน))?\s*$/u;
const NOT_INCOME_LABEL = /อายุ|เวลา|ปี|ชม|ทำงาน|เพศ|รายได้รวม|รายรับ|จำนวน|อัตรา|สถานที่|รับนาย|ส่งนาย|กม\.?$/u;
const AGE_RANGE = /อายุ\s*(\d{2})\s*(?:-|–|ถึง)\s*(\d{2})/u;
const AGE_MIN = /อายุ\s*(\d{2})\s*ปี?\s*ขึ้นไป/u;
const AGE_MAX = /อายุ\s*(?:ไม่เกิน)\s*(\d{2})/u;
const TIME_RANGE = /\d{1,2}[.:]\d{2}\s*(?:-|–|ถึง)\s*\d{1,2}[.:]\d{2}/u;
const SCHEDULE_HINT = /ทำงาน|เวลา|กะ|วันหยุด|จ\.\s*-\s*ศ\.|จันทร์/u;
/**
 * รายละเอียดงาน (เจ้าของ 6 ต.ค. 2569 ให้เลือกเองตาม Journey — โพสต์คนขับรถมีจุดรับนาย · จุดส่งนาย · รถที่ใช้)
 * ไม่ใช่คุณสมบัติ ไม่ใช่สถานที่ทำงานของฟอร์ม ⇒ ช่องแยก `job_details` · ผู้สมัครเห็นบนการ์ด · AI ไม่พูด
 */
const DETAIL_LINE = /^(?:สถานที่\s*)?(?:รับนาย|ส่งนาย|รับ\s*-\s*ส่ง|จุดรับ|จุดส่ง)|^(?:รถที่ใช้|รถที่ขับ|ใช้รถ|รถประจำตำแหน่ง)/u;
/** วันทำงาน/วันหยุด/เวลา — โพสต์จริงแยกบรรทัดกัน ("ทำงาน จันทร์-ศุกร์" · "เวลาปฎิบัติงาน 09.00-18.00" · "หยุดเสาร์-อาทิตย์") */
const DAY_WORD = /จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|อาทิตย์|จ\.\s*-\s*(?:ศ|ส)\./u;
const SCHEDULE_LINE_HEAD = /^(?:ทำงาน|เวลา|หยุด|วันหยุด|วันทำงาน)/u;
/**
 * รายได้รวม — "รายได้รวม 17000++" · "รายรับคนเก่าเฉลี่ย 22,000++" · "รายรับรวมมากกว่า 22,000+++"
 * (เจ้าของ 6 ต.ค. 2569 Choice: รายรับคนเก่า = รายได้รวมที่ผู้สมัครเห็น)
 */
const TOTAL_RE = /(?:รายได้รวม|รายรับ)[^\d\n]{0,20}?(\d[\d,]{3,})/u;
/** หัวโพสต์/โน้ตตกแต่ง ("****รายรับคนเก่า…*****") — ไม่ใช่คุณสมบัติ */
const DECOR_LINE = /^\*|รายรับ|รายได้รวม/u;

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
  if (t === 'เงินเดือน' || t === 'ฐาน' || t === 'ฐานเงินเดือน') return 'ฐานเงินเดือน';
  return fitIncomeLabel(t);
}

function incomeLinesOf(line: string): IncomeLine[] {
  const out: IncomeLine[] = [];
  for (const seg of splitItems(line)) {
    // โน้ตในวงเล็บท้ายรายการ ("แท๊กซี่ 110 (ก่อน6.01น. หลัง22.00น.)") ไม่ใช่ส่วนของยอด
    const m = INCOME_SEGMENT.exec(seg.replace(/\([^)]*\)/gu, '').trim());
    if (!m) continue;
    const label = m[1].trim();
    const amount = Math.trunc(num(m[2]));
    // ยอดเล็กกว่า 50 = เลขอื่น (กม.21 · ซอย 48) ไม่ใช่เงิน
    if (NOT_INCOME_LABEL.test(label) || !Number.isFinite(amount) || amount < 50) continue;
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
    details: [],
  };
  if (lines.length === 0) return out;

  const totalM = TOTAL_RE.exec(text);
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

  /**
   * บรรทัดแรก = หัวโพสต์ (ตำแหน่ง · พื้นที่ · เงินเดือน) ไม่เอา
   * แต่ละบรรทัดที่เหลือเป็นได้อย่างเดียว: รายละเอียดงาน → รายได้ → วันเวลาทำงาน → คุณสมบัติ
   * 🔴 รายได้ได้ทั้งแบบ "บรรทัดเดียวคั่นจุลภาค" (ตัวอย่าง TMT) และ "บรรทัดละรายการ" (โพสต์คนขับรถ 6 ต.ค. 2569)
   */
  const body = lines.slice(1);
  const incomes: IncomeLine[] = [];
  const seenIncome = new Set<string>();
  const details: string[] = [];
  const dayLines: string[] = [];
  const timeLines: string[] = [];
  const offLines: string[] = [];
  const rest: string[] = [];
  for (const line of body) {
    if (/^\(.*\)$/u.test(line)) continue;
    if (DETAIL_LINE.test(line)) {
      details.push(line.replace(/^สถานที่\s*/u, ''));
      continue;
    }
    const hasGenderAge = genderOf(line) !== null || /อายุ\s*\d/u.test(line);
    if (!hasGenderAge) {
      const segs = splitItems(line).filter((x) => x.trim());
      const found = incomeLinesOf(line);
      // ทุกส่วนของบรรทัดอ่านเป็นเงินได้ = บรรทัดรายได้ (กันบรรทัดคุณสมบัติที่บังเอิญมีตัวเลข)
      if (found.length > 0 && found.length === segs.length) {
        for (const l of found) {
          if (seenIncome.has(l.label)) continue;
          seenIncome.add(l.label);
          incomes.push(l);
        }
        continue;
      }
      if (/^หยุด|^วันหยุด/u.test(line)) {
        offLines.push(line);
        continue;
      }
      if (DAY_WORD.test(line) && (SCHEDULE_LINE_HEAD.test(line) || TIME_RANGE.test(line) || line.length <= 40)) {
        dayLines.push(line);
        continue;
      }
      if (TIME_RANGE.test(line) || (SCHEDULE_LINE_HEAD.test(line) && SCHEDULE_HINT.test(line) && line.length <= 60)) {
        timeLines.push(line);
        continue;
      }
    }
    if (DECOR_LINE.test(line)) continue;
    rest.push(line);
  }
  out.incomeLines = incomes;
  // ไม่มีบรรทัดรายได้ — ใช้ "เงินเดือน N" ของหัวโพสต์เป็นบรรทัดเดียว
  if (out.incomeLines.length === 0) {
    const base = /เงินเดือน\s*([\d,]+)/u.exec(lines[0]);
    if (base && num(base[1]) > 0) out.incomeLines = [{ label: 'ฐานเงินเดือน', amount: Math.trunc(num(base[1])) }];
  }
  out.incomeLines = out.incomeLines.slice(0, INCOME_LINE_MAX);
  const schedule = [...dayLines, ...timeLines, ...offLines].join(' ').replace(/\s+/gu, ' ').trim();
  out.schedule = schedule ? schedule.slice(0, POST_SCHEDULE_MAX) : null;
  out.details = cleanRequirementLines(details);

  const requirements: string[] = [];
  for (const line of rest) {
    // บรรทัดเพศ/อายุ/คุณสมบัติ — แยกจุลภาค ตัดส่วนเพศ/อายุออก ที่เหลือเป็นคุณสมบัติ
    // สวัสดิการ (เลือกจากชิปใบขอ ไม่ใช่คุณสมบัติ) · บรรทัดลิงก์สมัคร — ข้อความที่ buildPostText พิมพ์เองก็มีสองบรรทัดนี้
    if (/^สวัสดิการ/u.test(line) || /^สมัครงาน/u.test(line) || /https?:\/\//u.test(line)) continue;
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
  }
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
    p.requirements.length > 0 ||
    p.details.length > 0
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
  if (p.details.length > 0) out.job_details = p.details;
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
  // รายละเอียดงาน (จุดรับ/ส่งนาย · รถ) — บรรทัดละข้อแบบที่ทีมโพสต์
  for (const d of job.job_details ?? []) lines.push(d);
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
