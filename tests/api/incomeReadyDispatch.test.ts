// @vitest-environment node
/**
 * 🔴 ตั้งรายได้แล้ว → ใบสมัครผ่านลิงก์ที่ค้างเข้า AI เอง (เจ้าของ 6 ต.ค. 2569 · Journey งานสรรหาข้อ 3 ·
 * Choice "ส่งเองเมื่อตั้งรายได้") · คนที่ AI โทรครบ 3 รอบไม่ติด = คงเดิม (Choice "คงเดิม")
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const enqueue = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({
  enqueueLumosInterviewForApplications: (...a: unknown[]) => enqueue(...a),
}));
vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({ listSiamrajUnitRequests: vi.fn(async () => []) }));

const mod = await import('../../api/_lib/incomeReadyDispatch');

const code = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

beforeEach(() => {
  dbQuery.mockReset();
  enqueue.mockReset();
});
afterEach(() => {
  delete process.env.APPLICATION_AUTO_DISPATCH_ENABLED;
});

describe('ตัวจุดชนวน', () => {
  it('มีรายได้ที่ทีมตั้ง = รายการรายได้ หรือ ยอดเดี่ยว > 0', () => {
    expect(mod.hasManualIncome({ income: { lines: [{ label: 'ฐานเงินเดือน', amount: 13000 }] } })).toBe(true);
    expect(mod.hasManualIncome({ total_income: 15000 })).toBe(true);
    expect(mod.hasManualIncome({ total_income: 0 })).toBe(false);
    expect(mod.hasManualIncome({ income: { lines: [] } })).toBe(false);
    expect(mod.hasManualIncome({ gender: 'ชาย' })).toBe(false);
    expect(mod.hasManualIncome(null)).toBe(false);
  });
  it('คีย์ใบขอ → job_id ของใบสมัคร (ใบขอล่วงหน้าใช้คีย์เดิม)', () => {
    expect(mod.jobIdOfNoteKey('OPL6909018')).toBe('siamraj-sql:OPL6909018');
    expect(mod.jobIdOfNoteKey('siamraj-pre:123')).toBe('siamraj-pre:123');
  });
});

describe('หยิบเฉพาะใบที่ค้างเพราะรายได้', () => {
  it('คิวรี: ผ่านลิงก์ · ไม่ใช่ใบคีย์ · หลังด่านรายได้ · ยังไม่มีสาย · ไม่ถูกยกเลิก · อายุไม่เกิน', () => {
    const sql = mod.waitingApplicationsSql();
    expect(sql).toContain('a.link_id is not null');
    expect(sql).toContain('a.created_by_name is null');
    expect(sql).toContain('a.created_at >= $2::timestamptz');
    expect(sql).toContain("q.person_ref = 'app-' || a.id::text");
    expect(sql).toContain('application_cancellations');
    expect(sql).toMatch(/a\.age < \d+/);
    expect(mod.INCOME_GATE_SINCE).toBe('2026-10-06T18:23:00+07:00');
  });

  it('เจอใบค้าง = ส่งผ่านตัวส่งกลาง (autoPush) ด้วยบทผู้สมัครผ่านลิงก์', async () => {
    dbQuery.mockResolvedValue({
      rows: [{ id: 'a1', full_name: 'ทดสอบ', phone: '0812345678', job_id: 'siamraj-sql:OPL1', job_title: null, unit_name: null, position_interest: null, age: 30 }],
    });
    enqueue.mockResolvedValue({ queued: 1, duplicated: [], skipped: [] });
    const r = await mod.dispatchWaitingApplications('OPL1');
    expect(dbQuery.mock.calls[0][1]).toEqual(['siamraj-sql:OPL1', mod.INCOME_GATE_SINCE]);
    expect(enqueue).toHaveBeenCalledWith('siamraj-sql:OPL1', [expect.objectContaining({ id: 'a1', created_by_name: null })], { autoPush: true });
    expect(r).toEqual({ found: 1, queued: 1, skipped: 0 });
  });

  it('ไม่มีใบค้าง = ไม่เรียกตัวส่ง', async () => {
    dbQuery.mockResolvedValue({ rows: [] });
    expect(await mod.dispatchWaitingApplications('OPL1')).toEqual({ found: 0, queued: 0, skipped: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('🔴 สวิตช์ปิด หรือ บันทึกที่ไม่มีรายได้ = ไม่แตะฐานเลย', async () => {
    mod.dispatchWaitingApplicationsInBackground('OPL1', { total_income: 15000 });
    process.env.APPLICATION_AUTO_DISPATCH_ENABLED = 'true';
    mod.dispatchWaitingApplicationsInBackground('OPL1', { gender: 'ชาย' });
    await new Promise((r) => setTimeout(r, 10));
    expect(dbQuery).not.toHaveBeenCalled();
  });
});

describe('ผูกกับเส้นบันทึกใบขอ', () => {
  it('บันทึก field_overrides แล้วเรียกแบบไม่รอ หลังล้างสำเนา', () => {
    const src = code('api/_handlers/siamraj-unit-notes.ts');
    expect(src).toContain('if (touchesFieldOverrides) dispatchWaitingApplicationsInBackground(requestNo, item.field_overrides);');
    expect(src.indexOf('clearUnitRequestCache();')).toBeLessThan(src.indexOf('dispatchWaitingApplicationsInBackground(requestNo'));
  });
});
