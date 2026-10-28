/**
 * ═══ แคปชั่น Autopost แบบประกาศจริงของทีมสรรหา (เจ้าของ 20 ต.ค. 2569) ═══
 * ข้อความนี้ถูกโพสต์ลง Facebook ตรง ๆ (So Scraping) — โครงตามตัวอย่างที่เจ้าของส่ง:
 *
 *   รับสมัคร{ตำแหน่ง} (หน่วยงาน {ชื่อหน่วยงาน})
 *   📍 {จุดเริ่มงาน / รายละเอียดงาน}        ← ช่อง "รายละเอียดงาน" ในป๊อปประกาศ
 *   📍 {อำเภอ จังหวัด}                       ← ตัดทิ้งถ้าซ้ำกับบรรทัดบน
 *   💰 รายได้ {ฐาน + ทุกรายการ}++ บาท/เดือน
 *   - ฐานเงินเดือน … · - {รายการรายได้ที่ทีมตั้ง} …
 *   ⏰ ทำงาน {วันเวลา}                       ← ตัดคำสั่งงานภายใน (`publicWorkSchedule`)
 *   คุณสมบัติ · - เพศ… อายุ… · - {คุณสมบัติที่ทีมกรอก}
 *   สวัสดิการเพิ่มเติม · - {สวัสดิการที่ติ๊ก (ไม่ซ้ำกับรายการรายได้)}
 *   โทรติดต่อ : {เบอร์} (คุณ{ชื่อเล่น}) · หรือสมัครงานได้ที่ : {ลิงก์}
 *
 * 🔴 อิโมจิ 📍 💰 ⏰ เป็นเนื้อหาโพสต์ตามแบบที่เจ้าของส่ง (ไม่ใช่ป้าย/ปุ่มบนจอ) — ไฟล์นี้ได้รับยกเว้นในเทสต์ห้ามอิโมจิบนจอ · ห้ามเติมอิโมจินอกแบบ
 * กติกา: บรรทัดไหนไม่มีข้อมูล = ไม่ขึ้น (ห้ามเดา) · ห้ามมีเลขใบขอ/ข้อความภายใน · ช่องที่ติ๊กซ่อนจากหน้าสาธารณะไม่ใส่ ·
 * ยาวไม่เกิน `AUTOPOST_CAPTION_MAX`
 * ข้อมูลทุกช่องมาจากที่ทีมกรอกในป๊อปประกาศอยู่แล้ว (ไม่กรอกซ้ำ) — ตัวเดียวกับการ์ด "ผู้สมัครจะเห็นแบบนี้"
 */
import type { JobRequest } from '@/types';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { boardCardAge, boardCardGender, boardCardPlace } from '@/lib/boardCardFacts';
import { publicWorkSchedule } from '@/lib/publicJobPrivacy';
import { isOtBenefit, publicBenefitList, publicFieldVisible } from '@/lib/publicFieldVisibility';
import { benefitDisplayLabels, isRetiredBenefit } from '@/lib/extraBenefits';

export const AUTOPOST_CAPTION_MAX = 2000;
const GENERIC_TITLE = /^(|อื่น\s?ๆ|พนักงาน|ไม่ระบุ|—)$/;

const NUM = new Intl.NumberFormat('th-TH');
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

export type AutopostContact = { name: string; phone: string } | null;

/** ชื่อหน่วยงานบนประกาศ — ตัวเดียวกับหัวการ์ด · ถ้าหัวการ์ดถอยไปเป็นเลขใบขอ = ไม่ใส่ (ห้ามมีเลขใบขอ) */
function unitText(job: JobRequest): string | null {
  const t = jobBoardCardTitle(job).trim();
  if (!t || t === '—' || t === (job.request_no ?? '').trim()) return null;
  return t;
}

/** "บางพลี สมุทรปราการ" จากการ์ด ("สมุทรปราการ · บางพลี") · ไม่รู้ = null */
function workplaceText(job: JobRequest): string | null {
  const p = boardCardPlace(job);
  if (!p || p === 'ยังไม่ระบุสถานที่') return null;
  return p.split(' · ').reverse().join(' ');
}

/** รายละเอียดงานที่เป็นสถานที่ (จุดรับ/ส่งนาย · จุดเริ่มงาน) → 📍 · ที่เหลือ (รถที่ใช้ ฯลฯ) → บรรทัดธรรมดา (ไม่เติมอิโมจินอกแบบ) */
const PLACE_DETAIL = /(รับ|ส่ง|จุด|สถานที่|ประจำ|ไซต์|สาขา)/;

export type AutopostIncome = {
  unit: 'เดือน' | 'วัน';
  base: number | null;
  items: Array<{ label: string; amount: number }>;
  total: number | null;
};

/**
 * รายได้ในแคปชั่น — ฐาน + ทุกรายการที่ทีมตั้ง (ไม่รวมบรรทัด "อื่น ๆ" ที่ระบบเติมเอง) · ยอดรวม = ผลบวก
 * ฐาน: บรรทัด "ฐานเงินเดือน" ที่ทีมตั้ง → ฐาน ERP (`monthly_income_base` · รายเดือนเท่านั้น)
 * ซ่อนรายได้จากหน้าสาธารณะ = null (ไม่บอกในโพสต์)
 */
/**
 * สวัสดิการที่มียอดเงินต่อเดือน ("ค่าตำแหน่ง 3,000 บาท" · "ค่าโทรศัพท์ 1,000 บาท/เดือน") = รายการรายได้ ไม่ใช่สวัสดิการ
 * (เจ้าของ 20 ต.ค. 2569: รายการรายได้ขึ้นแค่ในส่วนรายได้ ห้ามซ้ำในสวัสดิการ) · ยอดต่อวัน/ชม. ไม่ย้าย (คนละหน่วย)
 */
const MONEY_BENEFIT = /^(.+?)\s*([\d,]{3,})\s*บาท\s*(?:\/\s*เดือน|ต่อเดือน)?\s*$/;
function benefitIncomeItems(job: JobRequest): Array<{ label: string; amount: number; raw: string }> {
  if (!publicFieldVisible(job, 'benefits')) return [];
  const out: Array<{ label: string; amount: number; raw: string }> = [];
  for (const b of publicBenefitList(job, benefitDisplayLabels(job.extra_benefits))) {
    const m = MONEY_BENEFIT.exec(b.trim());
    if (!m) continue;
    const amount = Number(m[2].replace(/,/g, ''));
    if (Number.isFinite(amount) && amount > 0) out.push({ label: m[1].trim(), amount, raw: b });
  }
  return out;
}

export function autopostIncome(job: JobRequest): AutopostIncome | null {
  if (!publicFieldVisible(job, 'income')) return null;
  const d = job.income_display;
  const erpBase =
    typeof job.monthly_income_base === 'number' && Number.isFinite(job.monthly_income_base) && job.monthly_income_base > 0
      ? job.monthly_income_base
      : null;
  if (d && d.lines.length > 0) {
    const unit = d.period === 'daily' ? 'วัน' : 'เดือน';
    const baseLine = d.lines.find((l) => l.label === 'ฐานเงินเดือน' && l.amount > 0);
    const base = baseLine ? baseLine.amount : unit === 'เดือน' ? erpBase : null;
    const items = d.lines.filter((l) => l !== baseLine && l.amount > 0).map((l) => ({ label: l.label, amount: l.amount }));
    if (unit === 'เดือน') {
      const have = new Set(items.map((i) => squash(i.label)));
      for (const b of benefitIncomeItems(job)) if (!have.has(squash(b.label))) items.push({ label: b.label, amount: b.amount });
    }
    const total = (base ?? 0) + items.reduce((s, l) => s + l.amount, 0);
    return { unit, base, items, total: total > 0 ? total : null };
  }
  if (!erpBase) return null;
  const items = benefitIncomeItems(job).map((b) => ({ label: b.label, amount: b.amount }));
  return { unit: 'เดือน', base: erpBase, items, total: erpBase + items.reduce((s, l) => s + l.amount, 0) };
}

/**
 * คุณสมบัติที่ทีมวางมาจากโพสต์เก่า — ตัดหัว "คุณสมบัติ" · ตัดสัญลักษณ์หน้าบรรทัด (- • *) · ตัดบรรทัดเพศ+อายุ ถ้ามีบรรทัดเพศ/อายุของระบบแล้ว ·
 * ตัดซ้ำ (ของจริง OPL6910006: "- - เพศชายอายุ 25-50 ปี" ซ้ำกับบรรทัดระบบ)
 */
function cleanRequirementLines(lines: readonly string[], hasWho: boolean): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const t = raw.replace(/^[\s\-–•*·]+/, '').trim();
    if (!t || /^คุณสมบัติ\s*:?$/.test(t)) continue;
    if (hasWho && /เพศ/.test(t) && /อายุ/.test(t)) continue;
    const k = squash(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** เบอร์ในแคปชั่น = ตัวเลขล้วน (ตามตัวอย่างของทีม "0901978522") */
const phoneDigits = (p: string) => p.replace(/\D/g, '');

export function buildAutopostCaption(job: JobRequest, opts: { contact: AutopostContact; link: string | null }): string {
  const out: string[] = [];
  const title = publicJobTitle(job).trim();
  const unit = unitText(job);
  out.push(`รับสมัคร${title}${unit ? ` (หน่วยงาน ${unit})` : ''}`);

  const details = (job.job_details ?? []).map((d) => d.trim()).filter(Boolean);
  const placeDetails = details.filter((d) => PLACE_DETAIL.test(d));
  const otherDetails = details.filter((d) => !PLACE_DETAIL.test(d));
  for (const d of placeDetails) out.push(`📍 ${d}`);
  const workplace = workplaceText(job);
  // สถานที่ทำงานซ้ำกับจุดเริ่มงาน = บรรทัดเดียว
  if (workplace && !placeDetails.some((d) => squash(d).includes(squash(workplace)))) out.push(`📍 ${workplace}`);
  for (const d of otherDetails) out.push(d);

  const income = autopostIncome(job);
  if (income && income.total) {
    out.push(`💰 รายได้ ${NUM.format(income.total)}++ บาท/${income.unit}`);
    if (income.base) out.push(`- ฐานเงินเดือน ${NUM.format(income.base)} บาท/${income.unit}`);
    for (const it of income.items) out.push(`- ${it.label} ${NUM.format(it.amount)} บาท/${income.unit}`);
  }

  const schedule = publicWorkSchedule(job.work_schedule).replace(/\s*•\s*/g, ' เวลา ');
  if (schedule) out.push(`⏰ ${/^(ทำงาน|ปฏิบัติงาน)/.test(schedule) ? '' : 'ทำงาน '}${schedule}`);

  const gender = boardCardGender(job);
  const age = boardCardAge(job);
  const who = [
    gender.known ? (gender.text === 'ไม่จำกัดเพศ' ? gender.text : `เพศ${gender.text}`) : null,
    age === 'ไม่ระบุอายุ' ? null : age,
  ]
    .filter(Boolean)
    .join(' ');
  const reqs = cleanRequirementLines(job.requirements ?? [], Boolean(who));
  if (who || reqs.length > 0) {
    out.push('คุณสมบัติ');
    if (who) out.push(`- ${who}`);
    for (const r of reqs) out.push(`- ${r}`);
  }

  // สวัสดิการ — ไม่ซ้ำกับรายการรายได้ (ค่าโทรศัพท์ ฯลฯ ขึ้นในส่วนรายได้แล้ว) · ไม่มีโอที/รายการที่ถอดแล้ว
  const incomeLabels = new Set((income?.items ?? []).map((i) => squash(i.label)));
  const seen = new Set<string>();
  const benefits = publicBenefitList(job, benefitDisplayLabels(job.extra_benefits))
    .filter((b) => !isOtBenefit(b) && !isRetiredBenefit(b))
    .filter((b) => !MONEY_BENEFIT.test(b.trim()))
    .filter((b) => ![...incomeLabels].some((l) => squash(b).includes(l) || l.includes(squash(b))))
    .filter((b) => {
      const k = squash(b);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  if (benefits.length > 0) {
    out.push('สวัสดิการเพิ่มเติม');
    for (const b of benefits) out.push(`- ${b}`);
  }

  const phone = opts.contact ? phoneDigits(opts.contact.phone) : '';
  if (phone) out.push(`โทรติดต่อ : ${phone} (คุณ${opts.contact?.name})`);
  if (opts.link) out.push(`${phone ? 'หรือสมัครงานได้ที่' : 'สมัครงานได้ที่'} : ${opts.link}`);

  return out.join('\n').slice(0, AUTOPOST_CAPTION_MAX);
}

/**
 * ขาดอะไรถึงกด Autopost ไม่ได้ (เจ้าของ 20 ต.ค. 2569: ขาดแล้วกดส่งไม่ได้ · ไม่มีก็ส่งได้ = บรรทัดนั้นไม่ขึ้น)
 * บังคับ: ตำแหน่ง · สถานที่ · รายได้ (ฐานเงินเดือนหรือรายได้อื่น · 28 ต.ค. 2569) · วันเวลาทำงาน · ลิงก์สมัคร (ทุกโพสต์ต้องมีลิงก์)
 */
export function autopostMissing(job: JobRequest, opts: { hasLink: boolean }): string[] {
  const missing: string[] = [];
  // ชื่อกลาง ๆ ("อื่นๆ" · "พนักงาน" · "ไม่ระบุ") = คนอ่านไม่รู้ว่างานอะไร ⇒ นับว่าขาดตำแหน่ง
  if (GENERIC_TITLE.test(publicJobTitle(job).trim())) missing.push('ตำแหน่ง');
  const hasPlace = Boolean(workplaceText(job)) || (job.job_details ?? []).some((d) => PLACE_DETAIL.test(d));
  if (!hasPlace) missing.push('สถานที่');
  // ต้องมีรายได้ ไม่บังคับบรรทัด "ฐานเงินเดือน" (เจ้าของ 28 ต.ค. 2569 "ขาดฐานเงินเดือน มันไม่มีฐานเงินเดือน" — งานรายวัน/ค่าแรงไม่มีฐาน)
  const income = autopostIncome(job);
  if (!income?.base && !income?.total) missing.push('รายได้');
  if (!publicWorkSchedule(job.work_schedule)) missing.push('วันเวลาทำงาน');
  if (!opts.hasLink) missing.push('ลิงก์สมัคร (ประกาศก่อน)');
  return missing;
}

/** ข้อความภายในที่ห้ามหลุดไปในโพสต์ — เลขใบขอ (OPL0000000 ฯลฯ) · ชื่อทีมภายใน */
export function captionLeaks(caption: string): string[] {
  const out: string[] = [];
  if (/\b[A-Z]{2,4}\d{5,}\b/.test(caption)) out.push('เลขใบขอ');
  if (/\bOPL\b/.test(caption)) out.push('คำว่า OPL');
  return out;
}
