/**
 * คำสั่งเจ้าของ 4 ต.ค. 2569 (ค่ำ):
 * 1. แท็บ "งานสรรหา" ในหน้างานสรรหา → "โพสต์ประกาศ"
 * 2. ช่องติ๊ก "โอที" ในป๊อปโพสต์ประกาศหน้า 3 — เดิมไม่ได้ต่อกับอะไร (ติ๊กออกแล้วชิปโอทียังขึ้นบนประกาศ)
 * 3. แผนติดตามที่บันทึกเป็นรูป — เยอะแล้วยาวมาก ⇒ หน้าละรูป
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isOtBenefit, publicBenefitList } from '../../src/lib/publicFieldVisibility';
import { paginateDayReportRows } from '../../src/lib/followDayReportImage';
import type { JobRequest } from '../../src/types';

describe('1 — แท็บโพสต์ประกาศ', () => {
  it('แท็บแรกของหน้างานสรรหาชื่อ "โพสต์ประกาศ" · เมนูยังเป็นงานสรรหา', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/jobs/JobBoardView.tsx'), 'utf8');
    expect(src).toContain("{ id: 'board', label: 'โพสต์ประกาศ' }");
  });
});

describe('2 — ติ๊กโอทีออก = ตัดชิปโอทีบนประกาศ', () => {
  const job = (vis?: Record<string, boolean>) =>
    ({ benefits: ['โอที ~75 บาท/ชม.', 'เบี้ยขยัน'], field_overrides: vis ? { public_visibility: vis } : null }) as unknown as JobRequest;
  it('ค่าเริ่ม (ไม่ตั้ง) = เห็นครบ', () => {
    expect(publicBenefitList(job(), ['ชุดฟอร์ม'])).toEqual(['โอที ~75 บาท/ชม.', 'เบี้ยขยัน', 'ชุดฟอร์ม']);
  });
  it('ติ๊กโอทีออก = ตัดเฉพาะโอที', () => {
    expect(publicBenefitList(job({ ot: false }), ['ชุดฟอร์ม'])).toEqual(['เบี้ยขยัน', 'ชุดฟอร์ม']);
  });
  it('ติ๊กสวัสดิการออก = ไม่มีชิปเลย', () => {
    expect(publicBenefitList(job({ benefits: false }), ['ชุดฟอร์ม'])).toEqual([]);
  });
  it('จับคำโอทีแบบที่ ERP ส่งมา', () => {
    expect(isOtBenefit('โอที ~75 บาท/ชม.')).toBe(true);
    expect(isOtBenefit('OT 1.5 เท่า')).toBe(true);
    expect(isOtBenefit('เบี้ยขยัน')).toBe(false);
  });
  it('การ์ดประกาศ + ตัวอย่างหน้า 4 ใช้ตัวเดียวกัน (ไม่มีจุดที่ลืม)', () => {
    for (const f of ['src/components/jobs/JobBoardView.tsx', 'src/components/jobs/PublicJobCardPreview.tsx']) {
      expect(readFileSync(join(process.cwd(), f), 'utf8')).toContain('publicBenefitList(job, benefitDisplayLabels(job.extra_benefits))');
    }
  });
});

describe('3 — รูปแผนหน้าละรูป', () => {
  const r = (name: string) => ({ id: name, time: '05:00', name, phone: '', unit: '', call: '', caller: '', result: '', cancelled: false });
  it('หน้าละไม่เกินกำหนด · คนเดียวกันไม่ขาดข้ามรูป', () => {
    const rows = ['ก', 'ก', 'ข', 'ข', 'ค', 'ค', 'ง'].map(r);
    const pages = paginateDayReportRows(rows, 3);
    expect(pages.map((p) => p.map((x) => x.name).join(''))).toEqual(['กก', 'ขข', 'คคง']);
  });
  it('คนเดียวสายเกินหน้า = อยู่หน้าเดียวยาวกว่า ไม่ตัดกลาง · ว่าง = 1 หน้า', () => {
    expect(paginateDayReportRows(['ก', 'ก', 'ก', 'ก'].map(r), 3)).toHaveLength(1);
    expect(paginateDayReportRows([], 20)).toEqual([[]]);
  });
});
