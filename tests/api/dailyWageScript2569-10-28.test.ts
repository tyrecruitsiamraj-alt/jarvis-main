import { describe, expect, it } from 'vitest';
import { buildAppliedQuestions, buildApplyQuestions } from '../../api/_lib/lumosCallScript';
import { manualDailyWage } from '../../api/_lib/applyScriptFacts';

// เจ้าของ 28 ต.ค. 2569 "มันก็มีรายวันไง ถ้ามีรายวันแบบวันละเท่าไหร่ก็พูดอันนั้นไปได้ไหม" (LBM6910007 ฟอร์เอฟเวอร์ · ขับรถ)
describe('งานรายวัน: AI พูดค่าแรงวันละ', () => {
  it('อ่านค่าแรงต่อวันจากกล่องรายได้แบบรายวัน · ไม่ใช่รายวัน = null', () => {
    expect(manualDailyWage({ income_display: { period: 'daily', total: 500, lines: [{ label: 'ค่าแรง', amount: 500 }] } })).toBe(500);
    expect(manualDailyWage({ income_display: { period: 'daily', lines: [{ label: 'ค่าแรง', amount: 400 }, { label: 'ค่ารถ', amount: 50 }] } })).toBe(450);
    expect(manualDailyWage({ income_display: { period: 'monthly', total: 15000 } })).toBeNull();
    expect(manualDailyWage({})).toBeNull();
  });

  it('บทใบคีย์เอง + บทสมัครผ่านลิงก์: มีเกริ่นรายได้ + "ค่าแรงวันละ 500 บาท" · ไม่มีบรรทัดรายเดือน', () => {
    for (const build of [buildAppliedQuestions, buildApplyQuestions]) {
      const q = build({ candidateName: 'หนึ่ง', position: 'ขับรถ', unit: 'ฟอร์เอฟเวอร์', dailyWage: 500 } as never);
      expect(q).toContain('งานนี้ค่าแรงวันละ 500 บาทค่ะ');
      expect(q.some((l) => l.includes('ขอแจ้งรายละเอียดรายได้'))).toBe(true);
      expect(q.some((l) => l.includes('เดือนละ'))).toBe(false);
    }
  });

  it('รายเดือนเหมือนเดิม ไม่มีบรรทัดรายวัน', () => {
    const q = buildAppliedQuestions({ candidateName: 'ก', position: 'ขับรถ', unit: 'x', monthlyIncome: 15000 } as never);
    expect(q).toContain('งานนี้รายได้ประมาณเดือนละ 15,000 บาทค่ะ');
    expect(q.some((l) => l.includes('วันละ'))).toBe(false);
  });
});
