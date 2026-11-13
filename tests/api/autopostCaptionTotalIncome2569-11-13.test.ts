/**
 * แคปชั่น Bitkub ขึ้น 43,250 + แก้แล้วเด้งกลับ (เจ้าของ 13 พ.ย. 2569)
 * 1) รายได้ "ใส่เอง" = ยอดรวมทั้งก้อน ห้ามบวกฐาน ERP + เงินในสวัสดิการซ้ำ
 * 2) แคปชั่นต้องบันทึกด้วยคีย์ที่ API อ่านกลับ (ใบขอล่วงหน้า = siamraj-pre:<เลข>)
 * 3) ใบที่ไม่ได้อยู่ขั้นหาคน (เช่น จ่ายรายวัน) ขาดอะไรก็ต้องเตือนบนการ์ด
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import { autopostIncome, buildAutopostCaption } from '@/lib/autopostCaption';
import { unitRequestNoteKey } from '@/lib/siamrajUnitRequestsApi';

const read = (p: string) => readFileSync(p, 'utf8');
const JOB = {
  id: 'siamraj-pre:LBM6909002',
  request_no: 'LBM6909002',
  unit_name: 'บริษัท บิทคับ',
  staff_title_name: 'พนักงานขับรถ',
  request_positions: 1,
  monthly_income_base: 13000,
  income_display: { period: 'monthly', total: 23000, lines: [{ label: 'รายได้', amount: 23000 }] },
  benefits: ['ค่าตำแหน่ง 3,000 บาท', 'ค่าโทรศัพท์ 1,000 บาท/เดือน', 'ค่าเดินทาง 3,250 บาท', 'ประกันสังคม'],
} as unknown as JobRequest;

describe('รายได้ใส่เอง = ยอดรวม', () => {
  it('ยอดรวม 23,000 ไม่ใช่ 43,250 · ฐาน + รายการ + อื่น ๆ บวกลงตัว', () => {
    const inc = autopostIncome(JOB)!;
    expect(inc.total).toBe(23000);
    const sum = (inc.base ?? 0) + inc.items.reduce((a, l) => a + l.amount, 0);
    expect(sum).toBe(23000);
    const cap = buildAutopostCaption(JOB, { contact: null, link: 'https://x/apply/p/abc' });
    expect(cap).toContain('23,000');
    expect(cap).not.toContain('43,250');
  });
  it('รายการย่อยรวมเกินยอดที่ใส่ = ใช้ผลบวก (เลขไม่โกหกลง)', () => {
    const low = { ...JOB, income_display: { period: 'monthly', total: 15000, lines: [{ label: 'รายได้', amount: 15000 }] } } as unknown as JobRequest;
    const inc = autopostIncome(low)!;
    expect(inc.total).toBe((inc.base ?? 0) + inc.items.reduce((a, l) => a + l.amount, 0));
  });
});

describe('แคปชั่นบันทึกด้วยคีย์ที่อ่านกลับ', () => {
  it('ใบขอล่วงหน้าใช้ siamraj-pre:<เลข>', () => {
    expect(unitRequestNoteKey(JOB)).toBe('siamraj-pre:LBM6909002');
  });
  for (const f of ['src/components/jobs/AutopostDialog.tsx', 'src/components/jobs/ManualPostPanel.tsx']) {
    it(`${f} บันทึก post_caption ด้วย unitRequestNoteKey`, () => {
      const src = read(f);
      expect(src).toMatch(/saveUnitFieldOverridesPatch\(noteKey, \{ post_caption/);
      expect(src).toContain('const noteKey = unitRequestNoteKey(job);');
    });
  }
});

describe('การ์ดเตือนขาดทุกใบที่เปิด', () => {
  it('ใบที่ไม่ได้อยู่ขั้นหาคนก็ขึ้นป้ายขาดจาก publishGapsOf', () => {
    const src = read('src/components/jobs/BoardJobCard.tsx');
    expect(src).toMatch(/readiness\.kind !== 'gaps' && readiness\.kind !== 'skipped' \? publishGapsOf\(job\)/);
    expect(src).toContain("readiness={{ kind: 'gaps', gaps: extraGaps }}");
  });
});
