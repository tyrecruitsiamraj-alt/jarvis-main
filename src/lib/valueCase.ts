/**
 * ═══ หน้าความคุ้มค่าระบบ — ตัวคิด (เจ้าของสั่ง 15 ต.ค. 2569) ═══
 * > *"ขอสักหน้าเอาไว้ดูคนเดียว เพื่อเอาไว้ Defend ผู้บริหาร ... เดิมใช้คนเท่าไหร่ โอทีเท่าไหร่ ใช้กี่คน
 * >  ระบบนี้ค่าใช้จ่ายเท่าไหร่ แล้วจะลด หรือ เพิ่มอะไรได้"*
 * Choice: อยู่ใน jarvis เห็นคนเดียว · ตัวเลขดึงจากระบบ + กรอกเอง
 *
 * เจ้าของกรอก: คน/เงินเดือน/โอที ก่อนกับตอนนี้ · ค่าระบบรายเดือน · นาทีต่อสายถ้าคนโทรเอง · ชั่วโมงทำงานต่อคนต่อเดือน
 * ระบบเติม: ผู้สมัครเข้า · สายที่ AI โทรจบ (สรรหา · ติดตาม) รายเดือน
 * ฐานเทียบ = เดือนที่เลือก (`basisYm`) · ว่าง = เดือนเต็มล่าสุด · เลือกเดือนนี้ = คาดทั้งเดือนจากวันที่ผ่านมา
 *   (ระบบเพิ่งเริ่มใช้ เดือนแรก ๆ เป็น 0 — เฉลี่ยหลายเดือนจะได้เลขต่ำกว่าที่ระบบทำได้จริงตอนนี้)
 * 🔴 ทุกเลขบวกลบให้เห็นบนจอ (บทเรียน "เจ้าของไม่เชื่อเลข" 7 ต.ค. 2569)
 */
export type ValueCaseCost = { label: string; monthly: number };

export type ValueCaseInputs = {
  beforeStaff: number;
  beforeSalary: number;
  beforeOt: number;
  nowStaff: number;
  nowSalary: number;
  nowOt: number;
  systemCosts: ValueCaseCost[];
  minutesPerCall: number;
  hoursPerStaffMonth: number;
  notesReduce: string;
  notesAdd: string;
  /** เดือนที่ใช้เป็นฐาน YYYY-MM · '' = เดือนเต็มล่าสุด */
  basisYm: string;
};

export type ValueCaseMonth = {
  /** YYYY-MM (เวลาไทย) */
  ym: string;
  applicants: number;
  aiRecruitCalls: number;
  aiFollowCalls: number;
};

export const EMPTY_VALUE_CASE: ValueCaseInputs = {
  beforeStaff: 0,
  beforeSalary: 0,
  beforeOt: 0,
  nowStaff: 0,
  nowSalary: 0,
  nowOt: 0,
  systemCosts: [{ label: "AI โทร (Lumos)", monthly: 0 }],
  minutesPerCall: 3,
  hoursPerStaffMonth: 176,
  notesReduce: "",
  notesAdd: "",
  basisYm: "",
};

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const text = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";

/** ค่าจากฐาน/ฟอร์ม → รูปที่ใช้ได้เสมอ (ช่องหาย/ผิดชนิด = ค่าตั้งต้น) — ใช้ทั้งฝั่งเว็บและ API */
export function normalizeValueCase(raw: unknown): ValueCaseInputs {
  const o =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const costs = Array.isArray(o.systemCosts)
    ? o.systemCosts.slice(0, 20).map((c) => {
        const x =
          c && typeof c === "object" ? (c as Record<string, unknown>) : {};
        return { label: text(x.label, 80), monthly: num(x.monthly) };
      })
    : EMPTY_VALUE_CASE.systemCosts;
  return {
    beforeStaff: num(o.beforeStaff),
    beforeSalary: num(o.beforeSalary),
    beforeOt: num(o.beforeOt),
    nowStaff: num(o.nowStaff),
    // ว่าง = 0 → ตัวคิดใช้เงินเดือนก่อนมีระบบแทน (`effectiveNowSalary`)
    nowSalary: num(o.nowSalary),
    nowOt: num(o.nowOt),
    systemCosts: costs,
    minutesPerCall:
      num(o.minutesPerCall, EMPTY_VALUE_CASE.minutesPerCall) ||
      EMPTY_VALUE_CASE.minutesPerCall,
    hoursPerStaffMonth:
      num(o.hoursPerStaffMonth, EMPTY_VALUE_CASE.hoursPerStaffMonth) ||
      EMPTY_VALUE_CASE.hoursPerStaffMonth,
    notesReduce: text(o.notesReduce, 4000),
    notesAdd: text(o.notesAdd, 4000),
    basisYm:
      typeof o.basisYm === "string" && /^\d{4}-\d{2}$/.test(o.basisYm)
        ? o.basisYm
        : "",
  };
}

export type ValueCaseResult = {
  beforeCost: number;
  systemCost: number;
  nowCost: number;
  savingMonthly: number;
  savingYearly: number;
  /** เดือนที่ใช้เป็นฐาน */
  basisYm: string | null;
  /** ฐานเป็นเดือนนี้ = เลขคาดทั้งเดือน (ยังไม่จบเดือน) */
  basisProjected: boolean;
  basisCalls: number;
  basisApplicants: number;
  aiHours: number;
  aiFte: number;
  aiFteValue: number;
  /** ค่าระบบต่อ 1 สายที่ AI โทรจบ — ไม่มีสาย = null */
  costPerCall: number | null;
};

export function effectiveNowSalary(
  inputs: Pick<ValueCaseInputs, "nowSalary" | "beforeSalary">,
): number {
  return inputs.nowSalary > 0 ? inputs.nowSalary : inputs.beforeSalary;
}

/** เดือนฐาน: ที่เลือก (ถ้ามีในตาราง) → ไม่งั้นเดือนเต็มล่าสุด → ไม่มีเลย = null */
export function pickBasisMonth(
  months: readonly ValueCaseMonth[],
  currentYm: string,
  chosen: string,
): ValueCaseMonth | null {
  const sorted = [...months].sort((a, b) => a.ym.localeCompare(b.ym));
  if (chosen) {
    const hit = sorted.find((m) => m.ym === chosen);
    if (hit) return hit;
  }
  return sorted.filter((m) => m.ym < currentYm).at(-1) ?? null;
}

/** เดือนนี้ยังไม่จบ — คาดทั้งเดือน = เลขถึงวันนี้ × วันในเดือน ÷ วันที่ผ่านมา */
export function projectMonth(value: number, ym: string, today: Date): number {
  const [y, m] = ym.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Number(
    new Date(today.getTime() + 7 * 3_600_000).toISOString().slice(8, 10),
  );
  return day > 0 ? Math.round((value * daysInMonth) / day) : value;
}

export function computeValueCase(
  inputs: ValueCaseInputs,
  months: readonly ValueCaseMonth[],
  currentYm: string,
  today: Date = new Date(),
): ValueCaseResult {
  const systemCost = inputs.systemCosts.reduce((n, c) => n + c.monthly, 0);
  const beforeCost = inputs.beforeStaff * inputs.beforeSalary + inputs.beforeOt;
  // เงินเดือนตอนนี้ว่าง (0) = เท่าก่อนมีระบบ — ส่วนใหญ่ค่าจ้างต่อคนไม่ได้เปลี่ยน
  const nowSalary = effectiveNowSalary(inputs);
  const nowCost = inputs.nowStaff * nowSalary + inputs.nowOt + systemCost;
  const basis = pickBasisMonth(months, currentYm, inputs.basisYm);
  const projected = basis?.ym === currentYm;
  const val = (n: number) =>
    basis && projected ? projectMonth(n, basis.ym, today) : n;
  const basisCalls = basis
    ? val(basis.aiRecruitCalls + basis.aiFollowCalls)
    : 0;
  const aiHours = (basisCalls * inputs.minutesPerCall) / 60;
  const aiFte =
    inputs.hoursPerStaffMonth > 0 ? aiHours / inputs.hoursPerStaffMonth : 0;
  return {
    beforeCost,
    systemCost,
    nowCost,
    savingMonthly: beforeCost - nowCost,
    savingYearly: (beforeCost - nowCost) * 12,
    basisYm: basis?.ym ?? null,
    basisProjected: projected,
    basisCalls,
    basisApplicants: basis ? val(basis.applicants) : 0,
    aiHours,
    aiFte,
    aiFteValue: aiFte * inputs.beforeSalary,
    costPerCall: basisCalls > 0 ? systemCost / basisCalls : null,
  };
}
