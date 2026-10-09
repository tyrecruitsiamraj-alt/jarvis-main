// @vitest-environment node
/**
 * ═══ ERP ไม่ทัน → ใช้ค่าจากกล่องงาน (เจ้าของ 9 ต.ค. 2569) ═══
 * > *"erp ไม่ตอบสนอง ทำไมมันไม่แนบตามกล่องอะ ในเมื่อฉันใช้กล่องงานเป็น script"*
 * เดิม: ERP ช้าเกิน 4 วิ ⇒ "อ่านรายได้ของใบขอไม่ทัน" ไม่ส่ง AI ทั้งที่ตั้งรายได้ในกล่องแล้ว
 *
 * 🔴 ด่าน:
 * 1. ERP ไม่ทัน + กล่องมีรายได้ต่อเดือน ⇒ ส่งได้ด้วยค่าจากกล่อง (loaded)
 * 2. ERP ไม่ทัน + กล่องไม่มีรายได้ ⇒ ไม่ loaded (ตัวส่งบอก "อ่านไม่ทัน" ตามเดิม · ห้ามโทรโดยไม่รู้รายได้)
 * 3. ERP ทัน ⇒ ใช้ทางเดิม (สวัสดิการจากอัตราเงินยังอยู่)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let erpHangs = true;
let boxOverrides: Record<string, unknown> | null = null;

vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({
  listSiamrajUnitRequests: () =>
    erpHangs
      ? new Promise(() => undefined)
      : Promise.resolve([{ id: 'siamraj-sql:R1', request_no: 'R1', unit_name: 'หน่วยงาน ERP', work_site_name: null }]),
}));
vi.mock('../../api/_handlers/siamraj-unit-requests.js', () => ({
  attachNotes: async (items: Array<Record<string, unknown>>) => {
    if (!boxOverrides) return;
    for (const it of items) Object.assign(it, boxOverrides);
  },
}));
vi.mock('../../api/_lib/siamrajJobBenefits.js', () => ({
  requestNoFromJobRef: () => 'R1',
  fetchJobBenefitRates: async () => new Map([['R1', [{ name: 'ค่าแรง', amount: 12000 }]]]),
  monthlyGuaranteedIncome: () => ({ total: 12000 }),
  speakableBenefitLine: () => 'มีเบี้ยขยัน',
}));

const { loadApplyScriptFacts } = await import('../../api/_lib/applyScriptFacts.js');

beforeEach(() => {
  erpHangs = true;
  boxOverrides = null;
});

describe('loadApplyScriptFacts — ERP ไม่ทัน', () => {
  it('🔴 กล่องมีรายได้ต่อเดือน ⇒ ส่งได้ด้วยค่าจากกล่อง', async () => {
    boxOverrides = {
      income_display: { period: 'monthly', total: 15000 },
      override_province: 'ชลบุรี',
      work_schedule: 'จันทร์–ศุกร์ 08:00–17:00',
    };
    const f = await loadApplyScriptFacts('siamraj-sql:R1', 30);
    expect(f.loaded).toBe(true);
    expect(f.monthlyIncome).toBe(15000);
    expect(f.workArea).toMatch(/ชลบุรี/);
    expect(f.benefitLine ?? null).toBeNull();
  });

  it('🔴 กล่องไม่มีรายได้ ⇒ ไม่ loaded (ไม่โทรโดยไม่รู้รายได้)', async () => {
    boxOverrides = { override_province: 'ชลบุรี' };
    const f = await loadApplyScriptFacts('siamraj-sql:R1', 30);
    expect(f.loaded).toBeFalsy();
  });

  it('รายได้แบบรายวันในกล่อง ⇒ ไม่ใช้ (คนละหน่วยกับ "เดือนละ")', async () => {
    boxOverrides = { income_display: { period: 'daily', total: 500 } };
    const f = await loadApplyScriptFacts('siamraj-sql:R1', 30);
    expect(f.loaded).toBeFalsy();
  });

  it('ERP ทัน ⇒ ทางเดิม (กล่องทับรายได้ · สวัสดิการจาก ERP ยังอยู่)', async () => {
    erpHangs = false;
    boxOverrides = { income_display: { period: 'monthly', total: 15000 } };
    const f = await loadApplyScriptFacts('siamraj-sql:R1', 500);
    expect(f.loaded).toBe(true);
    expect(f.monthlyIncome).toBe(15000);
    expect(f.benefitLine).toBe('มีเบี้ยขยัน');
  });
});
