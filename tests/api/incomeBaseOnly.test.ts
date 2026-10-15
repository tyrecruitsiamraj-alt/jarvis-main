import { describe, expect, it } from 'vitest';
import { buildApplyQuestions, buildExtraInfoSentence } from '../../api/_lib/lumosCallScript';

/** เจ้าของ Choice 15 ต.ค. 2569 "ใบที่ทีมไม่ได้ตั้ง: การ์ด+AI บอกแค่ฐาน" */
describe('AI บอกแค่ฐานเงินเดือนเมื่อรายได้มาจาก ERP ล้วน', () => {
  const base = { candidateName: 'ทดสอบ', position: 'พนักงานขับรถ', unit: 'หน่วยงาน', placeForTravel: 'หน่วยงาน' };
  it('baseOnly = พูดบรรทัด "ฐานเงินเดือน" ไม่พูด "รายได้ประมาณ"', () => {
    const q = buildApplyQuestions({ ...base, monthlyIncome: 12000, baseSalary: 12000, baseOnly: true }).join('\n');
    expect(q).toContain('ฐานเงินเดือน 12,000');
    expect(q).not.toContain('รายได้ประมาณ');
  });
  it('ทีมตั้งเอง (ไม่มีธง) = พูดรายได้ + ฐานตามเดิม', () => {
    const q = buildApplyQuestions({ ...base, monthlyIncome: 16000, baseSalary: 12000 }).join('\n');
    expect(q).toContain('16,000');
    expect(q).toContain('ฐานเงินเดือน 12,000');
  });
  it('ประโยคของแถม baseOnly = ฐานอย่างเดียว', () => {
    const s = buildExtraInfoSentence({ monthlyIncome: 12000, baseSalary: 12000, baseOnly: true, benefitLine: 'มีค่าเดินทางให้ด้วย' });
    expect(s).toContain('ฐานเงินเดือน 12,000 บาท');
    expect(s).not.toContain('รายได้ประมาณ');
  });
});
