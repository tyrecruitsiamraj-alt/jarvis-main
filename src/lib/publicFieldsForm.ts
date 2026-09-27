/**
 * ═══ ฟอร์ม "ข้อมูลที่จะขึ้นประกาศ" (ป๊อปไล่งานขั้น 2/3) — ตรรกะล้วน ═══
 *
 * แยกออกมาจาก `EditPublicJobFieldsDialog` 27 ก.ย. 2569 เพื่อให้เทสต์คุมได้ — หลังเจอบั๊ก
 * auto-save เขียนทับข้อมูลจริงตอน "เปิดดูเฉย ๆ" (รายละเอียดที่ `formDiffersFromJob`)
 */
import type { JobRequest } from '@/types';
import { benefitDisplayLabels } from '@/lib/extraBenefits';
import { cleanBenefitLines, type IncomePeriod } from '@/lib/incomeBreakdown';
import {
  PUBLIC_TOGGLE_FIELDS,
  readPublicVisibility,
  type PublicToggleField,
} from '@/lib/publicFieldVisibility';

/** state ที่ประกอบเป็น patch — แชร์ระหว่างปุ่มบันทึกกับ auto-save (22 ก.ย. 2569) */
export type OverridesFormState = {
  job: JobRequest;
  province: string;
  district: string;
  subdistrict: string;
  incomePeriod: IncomePeriod;
  incomeRows: { label: string; amount: string }[];
  incomeTotal: string;
  benefitText: string;
  visibility: Record<PublicToggleField, boolean>;
};

/**
 * ประกอบ patch ของ field_overrides จาก state ปัจจุบัน — **จุดเดียวที่สร้าง patch**
 * 🔴 spread ของเดิมก่อนเสมอ (API เขียนทับทั้งก้อน ไม่ merge)
 */
export function buildOverridesPatch(st: OverridesFormState): NonNullable<JobRequest['field_overrides']> {
  const parsedLines = st.incomeRows
    .map((r) => ({ label: r.label.trim(), amount: Math.trunc(Number(r.amount)) }))
    .filter((r) => r.label !== '' && Number.isFinite(r.amount) && r.amount > 0);
  const hasBreakdown = parsedLines.length > 0;
  const totalNum = st.incomeTotal.trim() === '' ? null : Math.trunc(Number(st.incomeTotal) || 0);
  const benefitLines = cleanBenefitLines(st.benefitText.split('\n'));
  const existing = (st.job.field_overrides ?? {}) as Record<string, unknown>;
  const visPatch: Partial<Record<PublicToggleField, boolean>> = {};
  for (const f of PUBLIC_TOGGLE_FIELDS) if (!st.visibility[f]) visPatch[f] = false;
  return {
    ...existing,
    province: st.province.trim() || null,
    district: st.district.trim() || null,
    subdistrict: st.subdistrict.trim() || null,
    total_income: hasBreakdown
      ? null
      : st.incomeTotal.trim() === ''
        ? null
        : Math.max(0, Math.trunc(Number(st.incomeTotal) || 0)),
    benefits: benefitLines.length > 0 ? benefitLines : null,
    income: hasBreakdown ? { period: st.incomePeriod, lines: parsedLines, total: totalNum } : null,
    public_visibility: Object.keys(visPatch).length > 0 ? visPatch : null,
  } as NonNullable<JobRequest['field_overrides']>;
}

/**
 * ค่าในฟอร์มที่ได้จากใบขอ **ตามที่บันทึกไว้ตอนนี้** — ที่เดียว (ใช้ทั้งค่าตั้งต้นและตัวเทียบ)
 *
 * 🔴 **ยอดรวมเอาเฉพาะที่ทีม Online ตั้งไว้** (`field_overrides.total_income`) — ไม่เติมเลข ERP
 * (เจ้าของเคาะ 26 ก.ย. 2569: ใบที่ยังไม่ตั้งรายได้ = "Online ยังไม่ได้ทำใบนั้น" · ห้ามเอาเลข ERP ไปอุด)
 * เดิมเติม `job.total_income` (= เลข ERP ถ้ายังไม่ตั้ง) ลงช่องให้เอง ⇒ พอบันทึกอะไรในขั้นนี้
 * เลข ERP (บางใบเป็นค่าแรงต่อวัน 400) กลายเป็น "รายได้ที่ Online ตั้ง" ทันทีโดยไม่มีใครตั้งใจ
 * ว่าง = ช่องขึ้น "ใช้ค่าจาก ERP" และหน้าสาธารณะใช้เลขเดิมเหมือนเดิม
 */
export function formStateFromJob(job: JobRequest): Omit<OverridesFormState, 'job'> {
  const saved = job.field_overrides?.income;
  const lines = saved && saved.lines.length > 0 ? saved : null;
  const savedTotal = job.field_overrides?.total_income;
  return {
    province: job.override_province ?? '',
    district: job.override_district ?? '',
    subdistrict: job.override_subdistrict ?? '',
    incomePeriod: lines ? lines.period : 'monthly',
    incomeRows: lines ? lines.lines.map((l) => ({ label: l.label, amount: String(l.amount) })) : [],
    incomeTotal: lines
      ? lines.total != null
        ? String(lines.total)
        : ''
      : typeof savedTotal === 'number'
        ? String(savedTotal)
        : '',
    // ค่าเก่าที่ติ๊กเป็นคีย์ → แปลงเป็นคำอ่านให้แก้ต่อได้ (ห้ามหายเงียบ)
    benefitText: benefitDisplayLabels(job.extra_benefits).join('\n'),
    visibility: readPublicVisibility(job.field_overrides?.public_visibility),
  };
}

/**
 * ฟอร์มตอนนี้ **ต่างจากที่บันทึกไว้ในใบขอ** ไหม — 🔴 ด่านเดียวที่ตัดสินว่าจะยิงบันทึก
 *
 * บั๊กที่ทำให้ต้องมี (เจอตอนตรวจงาน 27 ก.ย. 2569 — ข้อมูลจริงโดนเขียนทับ):
 * ของเดิมกันด้วยธง "กำลังเติมค่า" ซึ่งแข่งเวลากับ React ⇒ แค่ **เปิดขั้น 2/3 ดูเฉย ๆ** ก็ยิงบันทึก
 * และหลังบันทึก ใบขอฝั่งแม่เปลี่ยน → ฟอร์มเติมค่าใหม่ → ยิงอีก **วนทุก 1.5 วินาที** (ใบเดียว 44 ครั้ง)
 * แถมเขียนค่าที่เติมไม่ทัน (การตั้ง "ซ่อนรายได้จากหน้าสาธารณะ" ถูกล้าง) ⇒ เปลี่ยนเป็นเทียบค่าจริง:
 * ฟอร์มเท่ากับใบขอ = ไม่ยิง ไม่ว่าจะ render กี่รอบ
 */
export function formDiffersFromJob(st: OverridesFormState): boolean {
  return (
    JSON.stringify(buildOverridesPatch(st)) !==
    JSON.stringify(buildOverridesPatch({ job: st.job, ...formStateFromJob(st.job) }))
  );
}

