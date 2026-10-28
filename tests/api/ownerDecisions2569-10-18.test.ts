// @vitest-environment node
/** เจ้าของเคาะ 18 ต.ค. 2569 (Choice หลัง QA 17 ต.ค.) */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('คำผลโทรชุดเดียว: ไป / ไม่ไป / ขอคิดก่อน / ไม่รับสาย (งานสรรหาคง สนใจ/ไม่สนใจ)', () => {
  it('ไม่มี ตอบว่าไป/ตอบว่าไม่ไป/โอเค/ล้มเหลว เป็นป้ายบนจอแล้ว', () => {
    expect(read('src/components/home-ai-share/AiShareLumosStats.tsx')).not.toMatch(/label: '(ตอบว่าไป|ตอบว่าไม่ไป|ล้มเหลว)'/);
    expect(read('src/lib/lumosStatCells.ts')).not.toContain("label: 'โอเค'");
    expect(read('src/lib/followCallMatrix.ts')).toContain("went: 'ไป',");
    expect(read('src/lib/callOutcomeTone.ts')).toContain("confirmed: 'ไป',");
  });
});

describe('ชนิดใบขอ = ฉุกเฉิน/ล่วงหน้า · อายุใบขอไม่ซ้ำคำ', () => {
  it('การ์ด/ตัวกรอง/Pre-Check ใช้ ฉุกเฉิน · 16–30 วัน = ด่วน', () => {
    expect(read('src/components/jobs/BoardJobCard.tsx')).toContain('>ฉุกเฉิน</span>');
    expect(read('src/lib/boardFilters.ts')).toContain("v === 'urgent' ? 'ฉุกเฉิน' : 'ล่วงหน้า'");
    expect(read('src/components/dashboard/analytics/DashboardAgeOverview.tsx')).toContain("'16-30': { urgency: 'ด่วน'");
  });
});

describe('ปุ่มปฏิทิน · ตัวกรองปิดแล้ว', () => {
  it('ปุ่มปฏิทินมีช่วงวันที่', () => {
    expect(read('src/components/shared/PeriodPicker.tsx')).toContain('rangeText(value.from, value.to)');
  });
  // 🔴 19 ต.ค. 2569 เจ้าของ "ใบขอที่ถูกปิดไปแล้วทำไมมันเด้งกลับมา" — "ทั้งหมด" (ค่าเริ่ม) ห้ามดึงใบปิด
  it('ใบขอ: ดึงใบปิด 30 วันล่าสุดเฉพาะตอนเลือก "ปิดแล้ว" · ค่าเริ่ม "ทั้งหมด" ไม่ดึง', () => {
    const s = read('src/pages/jobs/JobListPage.tsx');
    expect(s).toContain("const wantClosed = siamrajPrimary && filter === 'closed';");
    expect(s).not.toContain("filter !== 'active';");
    expect(s).toContain('fetchSiamrajClosedRequests(from, to)');
  });
});
