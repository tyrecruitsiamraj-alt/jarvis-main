// @vitest-environment node
/**
 * เจ้าของ 14 ต.ค. 2569: "เติมฐานเงินเดือนในบทโทร AI ด้วย" (ต่อจาก "ยังไงก็ต้องบอกฐานเงินเดือนนะ")
 * - บทสมัครผ่านลิงก์ + บทใบที่คีย์เอง: บรรทัดฐานเงินเดือนก่อนบรรทัดรายได้
 * - ประโยคของแถม (เลน Match / บทเสนองาน): "ฐานเงินเดือน … บาท และรายได้ประมาณ …"
 * - ไม่รู้ฐาน หรือฐานเท่ารายได้ที่พูด (ไม่มีเงินอื่น) = ไม่พูดฐาน (ไม่พูดเลขเดิมสองรอบ)
 */
import { describe, expect, it } from 'vitest';
import {
  buildAppliedQuestions,
  buildApplyQuestions,
  buildExtraInfoSentence,
  KNOWN_PLACEHOLDERS,
  speakableBaseSalary,
} from '../../api/_lib/lumosCallScript.js';

const facts = { candidateName: 'ทดสอบ ระบบ', position: 'พนักงานขับรถ', unit: 'หน่วยงานทดสอบ', workArea: 'จังหวัดระยอง' };

describe('ฐานเงินเดือนในบท AI', () => {
  it('ตัวแปร {ฐานเงินเดือน} อยู่ในรายการที่ระบบรู้จัก (หน้าตั้งค่าบทใช้ได้)', () => {
    expect(KNOWN_PLACEHOLDERS).toContain('ฐานเงินเดือน');
  });

  it('บทสมัครผ่านลิงก์ + บทคีย์เอง: พูดฐานต่อจากรายได้', () => {
    for (const build of [buildApplyQuestions, buildAppliedQuestions]) {
      const q = build({ ...facts, monthlyIncome: 20000, baseSalary: 12000 });
      const baseAt = q.findIndex((x) => x.includes('ฐานเงินเดือน 12,000 บาท'));
      const incomeAt = q.findIndex((x) => x.includes('เดือนละ 20,000 บาท'));
      expect(baseAt).toBeGreaterThan(-1);
      expect(baseAt).toBe(incomeAt + 1);
      expect(q[incomeAt]).toBe('งานนี้รายได้ประมาณเดือนละ 20,000 บาทครับ');
    }
  });

  it('ไม่รู้ฐาน / ฐานเท่ารายได้ ⇒ ไม่มีบรรทัดฐาน · บรรทัดรายได้ยังอยู่', () => {
    const noBase = buildApplyQuestions({ ...facts, monthlyIncome: 20000 });
    const same = buildApplyQuestions({ ...facts, monthlyIncome: 12000, baseSalary: 12000 });
    for (const q of [noBase, same]) {
      expect(q.some((x) => x.includes('ฐานเงินเดือน'))).toBe(false);
      expect(q.some((x) => x.includes('งานนี้รายได้ประมาณเดือนละ'))).toBe(true);
    }
    expect(speakableBaseSalary(12000, 12000)).toBeUndefined();
    expect(speakableBaseSalary(null, 12000)).toBeUndefined();
    expect(speakableBaseSalary(10620, 11820)).toBe('10,620');
  });

  it('ประโยคของแถม: ฐานต่อจากรายได้ · ไม่มีรายได้ = ไม่พูดฐานลอย ๆ', () => {
    const s = buildExtraInfoSentence({ monthlyIncome: 20000, baseSalary: 12000, benefitLine: null });
    expect(s).toBe('แจ้งเพิ่มเติมครับ งานนี้รายได้ประมาณ 20,000 บาทต่อเดือน และฐานเงินเดือน 12,000 บาท');
    expect(buildExtraInfoSentence({ monthlyIncome: null, baseSalary: 12000 })).toBe('');
  });
});
