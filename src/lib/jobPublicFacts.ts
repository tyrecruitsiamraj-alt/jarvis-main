/**
 * ═══ ข้อมูลงานบนการ์ด — ชุดเดียวทั้งการ์ดโพสต์ประกาศ (เจ้าหน้าที่) และหน้า /apply ═══
 *
 * เจ้าของ 5 ต.ค. 2569: *"หน้า Apply ติ๊กอะไรแล้วเห็นอะไร หน้า โพสต์ประกาศ ก็เห็นเหมือนกันสิ่ ไม่งั้นจะเช็คยังไงหล่ะว่าถูกต้องหรือเปล่า"*
 * การ์ดต้องเห็น: หน่วยงาน · ผ่านมากี่วัน (เจ้าหน้าที่) · ตำแหน่ง · ฐานเงินเดือน · สวัสดิการว่าได้เท่าไหร่ ·
 * รายได้เฉลี่ย (ยอดของคนเก่า *"ไม่ต้องใช้คำว่าคนเก่า"*) · เพศ · อายุ · วันเวลาทำงาน · จังหวัด + อำเภอ
 *
 * 🔴 ทุกช่องผ่าน `publicFieldVisible` ทั้งสองฝั่ง — ติ๊กซ่อนในขั้น 3 แล้วการ์ดเจ้าหน้าที่ก็หายด้วย
 * 🔴 รายได้เฉลี่ย = `resignedMonthlyNetAverage` ตัวเดียวกับปุ่ม "ใช้รายได้คนเก่า" (ห้ามสูตรที่สอง)
 */
import type { JobRequest } from '@/types';
import { resignedMonthlyNetAverage } from '@/lib/resignedIncome';
import { publicIncomeOf } from '@/lib/publishReadiness';

const NUM = new Intl.NumberFormat('th-TH');

/** รายได้เฉลี่ยต่อเดือน — server ส่งมาแล้ว (หน้าสาธารณะ) ใช้ตัวนั้น · ไม่มีค่อยคิดจาก eSlip (เจ้าหน้าที่) */
export function jobAverageIncome(
  job: Pick<JobRequest, 'average_income' | 'resigned_income_3m' | 'lastWorkingDay'>,
): number | null {
  if (typeof job.average_income === 'number' && Number.isFinite(job.average_income) && job.average_income > 0) {
    return job.average_income;
  }
  return resignedMonthlyNetAverage(job.resigned_income_3m, job.lastWorkingDay)?.amount ?? null;
}

const norm = (s: string) => s.replace(/\s+/g, '').trim();

/**
 * ชิปสวัสดิการ + ยอดต่อเดือนถ้ารู้ ("ค่าเดินทาง 6,000 บาท/เดือน") — ยอดมาจาก `monthly_income_items` ของ ERP
 * ชิปที่มีตัวเลขอยู่แล้ว (เช่น "โอที ~75 บาท/ชม.") หรือไม่รู้ยอด = คงเดิม
 */
export function benefitWithAmount(
  label: string,
  items: JobRequest['monthly_income_items'] | null | undefined,
): string {
  if (/\d/.test(label)) return label;
  const hit = (items ?? []).find((i) => norm(i.label) === norm(label));
  return hit && hit.monthly > 0 ? `${label} ${NUM.format(hit.monthly)} บาท/เดือน` : label;
}

/**
 * "ฐานเงินเดือน" บนการ์ด — 🔴 ต้องเป็นฐานจริง ไม่ใช่ยอดรวม (สวัสดิการโชว์ยอดของมันเองแล้ว รวมอีกรอบ = นับซ้ำ)
 *   · ทีม Online ตั้งรายได้เอง (ขั้น 3) = ยอดที่ตั้ง · ไม่ได้ตั้ง = ฐานจาก ERP (`monthly_income_base`)
 *   · ไม่มีทั้งคู่ = ถอยไป `publicIncomeOf` (บอกหน่วยเท่าที่รู้) · ไม่รู้เลย = null
 */
export function jobBaseIncome(
  job: Pick<JobRequest, 'income_display' | 'field_overrides' | 'total_income' | 'monthly_income' | 'monthly_income_base'>,
): { text: string; hint: string | null } | null {
  // ทีมตั้งแบบแยกส่วน (ต่อวัน/ต่อเดือน) — เขียนรูปเดียวกับบรรทัดอื่นบนการ์ด ("15,500 บาท/เดือน" ไม่ใช่ "฿15,500 ต่อเดือน")
  if (job.income_display && job.income_display.total > 0) {
    const unit = job.income_display.period === 'daily' ? 'วัน' : 'เดือน';
    /**
     * 🔴 มีบรรทัด "ฐานเงินเดือน" = ฐานคือบรรทัดนั้น ไม่ใช่ยอดรวม (6 ต.ค. 2569 — วางข้อความโพสต์
     * "เงินเดือน 11,160 … รายได้รวม 17,000" แล้วการ์ดขึ้น "ฐานเงินเดือน 17,000" ผิด) · ยอดรวมต่อท้ายในวงเล็บ
     */
    const baseLine = job.income_display.lines.find((l) => l.label === 'ฐานเงินเดือน');
    if (baseLine && baseLine.amount > 0 && baseLine.amount < job.income_display.total) {
      return {
        text: `${NUM.format(baseLine.amount)} บาท/${unit} (รายได้รวม ${NUM.format(job.income_display.total)})`,
        hint: null,
      };
    }
    return { text: `${NUM.format(job.income_display.total)} บาท/${unit}`, hint: null };
  }
  const pub = publicIncomeOf(job);
  if (pub?.manual) return { text: pub.text, hint: null };
  const base = job.monthly_income_base;
  if (typeof base === 'number' && Number.isFinite(base) && base > 0) {
    return { text: `${NUM.format(base)} บาท/เดือน`, hint: null };
  }
  return pub ? { text: pub.text, hint: pub.hint } : null;
}

/**
 * ═══ บรรทัดเงินบนการ์ด: ฐาน · รายได้รวม แยกกัน (เจ้าของ 7 ต.ค. 2569: *"รายได้รวมยังไม่มีบนกล่องเลย มีแค่ฐานเอง"*) ═══
 * - ทีมแยกรายการเอง (`income_display`): มีบรรทัด "ฐานเงินเดือน" = ฐาน · ยอดรวมของรายการ = รายได้รวม
 *   ไม่มีบรรทัดฐาน = รายได้รวมอย่างเดียว (เดิมเอายอดรวมไปเขียนว่า "ฐานเงินเดือน" — ผิด)
 * - ทีมตั้งยอดเดี่ยว (`total_income`) = รายได้รวม
 * - ERP: `monthly_income_base` = ฐาน · `monthly_income` (ฐาน + เงินประจำ) = รายได้รวม
 * รายได้รวมเท่ากับฐาน = ไม่ขึ้นซ้ำ (`total` = null) · ไม่รู้อะไรเลย = null
 * ใช้ทั้งการ์ดผู้สมัคร (`JobPublicFacts`) และกล่องรายได้/รายได้รวมในป๊อปประกาศ — คำเดียวกันทุกที่
 */
export function jobIncomeLine(
  job: Pick<JobRequest, 'income_display' | 'field_overrides' | 'total_income' | 'monthly_income' | 'monthly_income_base'>,
): { base: string | null; total: string | null; hint: string | null } | null {
  if (job.income_display && job.income_display.total > 0) {
    const unit = job.income_display.period === 'daily' ? 'วัน' : 'เดือน';
    const baseLine = job.income_display.lines.find((l) => l.label === 'ฐานเงินเดือน' && l.amount > 0);
    const base = baseLine ? `${NUM.format(baseLine.amount)} บาท/${unit}` : null;
    const total =
      !baseLine || job.income_display.total > baseLine.amount ? `${NUM.format(job.income_display.total)} บาท/${unit}` : null;
    return { base, total, hint: null };
  }
  const pub = publicIncomeOf(job);
  if (pub?.manual) return { base: null, total: pub.text, hint: null };
  const b = job.monthly_income_base;
  const t = job.monthly_income;
  const hasBase = typeof b === 'number' && Number.isFinite(b) && b > 0;
  const hasTotal = typeof t === 'number' && Number.isFinite(t) && t > 0 && (!hasBase || t > (b as number));
  if (hasBase || hasTotal) {
    return {
      base: hasBase ? `${NUM.format(b as number)} บาท/เดือน` : null,
      total: hasTotal ? `${NUM.format(t as number)} บาท/เดือน` : null,
      hint: null,
    };
  }
  return pub ? { base: pub.text, total: null, hint: pub.hint } : null;
}
