import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  EMPTY_VALUE_CASE,
  computeValueCase,
  normalizeValueCase,
  pickBasisMonth,
  projectMonth,
  type ValueCaseMonth,
} from "@/lib/valueCase";
import {
  canSeeValueCase,
  valueCaseAllowedEmails,
} from "../../api/_lib/valueCaseStore";

/** หน้าความคุ้มค่าระบบ (เจ้าของสั่ง 15 ต.ค. 2569 · เห็นคนเดียว · ดึงจากระบบ + กรอกเอง) */
const months: ValueCaseMonth[] = [
  { ym: "2026-08", applicants: 7, aiRecruitCalls: 40, aiFollowCalls: 0 },
  { ym: "2026-09", applicants: 117, aiRecruitCalls: 102, aiFollowCalls: 547 },
  { ym: "2026-10", applicants: 423, aiRecruitCalls: 360, aiFollowCalls: 1359 },
];
const TODAY = new Date("2026-10-15T10:00:00+07:00");

describe("ตัวคิดความคุ้มค่า", () => {
  const inputs = {
    ...EMPTY_VALUE_CASE,
    beforeStaff: 10,
    beforeSalary: 15000,
    beforeOt: 30000,
    nowStaff: 6,
    nowOt: 5000,
    systemCosts: [{ label: "AI", monthly: 20000 }],
  };

  it("เดิม − ตอนนี้ (เงินเดือนตอนนี้ว่าง = เท่าเดิม) · ต่อปี ×12", () => {
    const r = computeValueCase(inputs, months, "2026-10", TODAY);
    expect(r.beforeCost).toBe(180000);
    expect(r.nowCost).toBe(6 * 15000 + 5000 + 20000);
    expect(r.savingMonthly).toBe(65000);
    expect(r.savingYearly).toBe(780000);
  });

  it("ฐานเทียบตั้งต้น = เดือนเต็มล่าสุด · AI แทนคน = สาย × นาที ÷ 60 ÷ ชม.ต่อคน", () => {
    const r = computeValueCase(inputs, months, "2026-10", TODAY);
    expect(r.basisYm).toBe("2026-09");
    expect(r.basisCalls).toBe(649);
    expect(r.aiHours).toBeCloseTo((649 * 3) / 60);
    expect(r.aiFte).toBeCloseTo((649 * 3) / 60 / 176);
    expect(r.costPerCall).toBeCloseTo(20000 / 649);
  });

  it("เลือกเดือนนี้ = คาดทั้งเดือน (ถึงวันที่ 15 · ต.ค. มี 31 วัน)", () => {
    expect(projectMonth(1719, "2026-10", TODAY)).toBe(
      Math.round((1719 * 31) / 15),
    );
    const r = computeValueCase(
      { ...inputs, basisYm: "2026-10" },
      months,
      "2026-10",
      TODAY,
    );
    expect(r.basisProjected).toBe(true);
    expect(r.basisCalls).toBe(3553);
    expect(pickBasisMonth(months, "2026-10", "2025-01")?.ym).toBe("2026-09");
    expect(pickBasisMonth([], "2026-10", "")).toBeNull();
  });

  it("ไม่มีสาย = ค่าระบบต่อสายเป็นขีด ไม่หารศูนย์", () => {
    expect(
      computeValueCase(inputs, [], "2026-10", TODAY).costPerCall,
    ).toBeNull();
  });

  it("ค่าที่เก็บพัง/ไม่ครบ ไม่ทำหน้าพัง", () => {
    const n = normalizeValueCase({
      beforeStaff: "5",
      beforeOt: -3,
      systemCosts: "x",
      basisYm: "bad",
      notesAdd: 9,
    });
    expect(n.beforeStaff).toBe(5);
    expect(n.beforeOt).toBe(0);
    expect(n.systemCosts).toEqual(EMPTY_VALUE_CASE.systemCosts);
    expect(n.basisYm).toBe("");
    expect(n.notesAdd).toBe("");
    expect(n.minutesPerCall).toBe(3);
  });
});

describe("🔴 เห็นคนเดียว", () => {
  const env = process.env.VALUE_CASE_EMAILS;
  afterEach(() => {
    if (env === undefined) delete process.env.VALUE_CASE_EMAILS;
    else process.env.VALUE_CASE_EMAILS = env;
  });

  it("production: เฉพาะอีเมลที่อนุญาต · admin คนอื่นเข้าไม่ได้", () => {
    delete process.env.VALUE_CASE_EMAILS;
    const [owner] = valueCaseAllowedEmails();
    expect(
      canSeeValueCase({ email: owner.toUpperCase(), role: "staff" }, true),
    ).toBe(true);
    expect(
      canSeeValueCase({ email: "someone@siamraj.com", role: "admin" }, true),
    ).toBe(false);
  });

  it("ตั้ง VALUE_CASE_EMAILS แทนค่าตั้งต้นได้ · เครื่องนักพัฒนาให้ admin ตรวจงาน", () => {
    process.env.VALUE_CASE_EMAILS = "a@x.com, b@x.com";
    expect(valueCaseAllowedEmails()).toEqual(["a@x.com", "b@x.com"]);
    expect(canSeeValueCase({ email: "b@x.com", role: "staff" }, true)).toBe(
      true,
    );
    expect(canSeeValueCase({ email: "c@x.com", role: "admin" }, false)).toBe(
      true,
    );
    expect(canSeeValueCase({ email: "c@x.com", role: "staff" }, false)).toBe(
      false,
    );
  });

  it("ต่อสายครบ: เส้น API · หน้า /value · ไม่มีในเมนู · คนไม่มีสิทธิ์ได้ 404", () => {
    expect(readFileSync("api/_handlers/registry.ts", "utf8")).toContain(
      "'/api/value-case'",
    );
    expect(readFileSync("src/App.tsx", "utf8")).toContain(
      '<Route path="/value" element={<ValueCasePage />} />',
    );
    expect(
      readFileSync(
        "src/components/layout/bottom-nav/dockNavConfig.tsx",
        "utf8",
      ),
    ).not.toContain("'/value'");
    expect(readFileSync("api/_handlers/value-case.ts", "utf8")).toContain(
      "if (!canSeeValueCase(req.user)) return sendError(res, 404",
    );
  });
});

describe('ทางเข้าจากเมนู ☰ (15 ต.ค. 2569 "เข้าจากหน้า ui ยังไงหล่ะ")', () => {
  const drawer = readFileSync('src/components/layout/AppNavDrawer.tsx', 'utf8');
  it('ความคุ้มค่าระบบ โผล่เมื่อ API ตอบว่าเปิดได้เท่านั้น · API มี probe ที่ไม่อ่านฐาน', () => {
    expect(drawer).toContain('{valueCaseOk ? (');
    expect(drawer).toContain("go('/value')");
    expect(readFileSync('api/_handlers/value-case.ts', 'utf8')).toMatch(/probe === "1"\) return res\.status\(200\)\.json\(\{ ok: true \}\)/);
  });
  it('จับคู่งานไม่อยู่ในเมนู (อยู่แท็บในหน้าใบขอ) · อยู่หน้าจับคู่ = เมนูใบขอติดไฮไลต์', () => {
    expect(drawer).toContain("s.key !== 'matching' &&");
    expect(drawer).toContain("(step.key === 'requests' && matchingPaths.some((p) => location.pathname.startsWith(p)))");
  });
});
