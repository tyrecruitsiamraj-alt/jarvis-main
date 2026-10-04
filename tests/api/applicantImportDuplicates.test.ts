/** รายชื่อซ้ำตอนนำเข้า Excel — ไฟล์ที่ให้ดาวน์โหลด (เจ้าของ 4 ต.ค. 2569) */
import { describe, expect, it } from 'vitest';
import { DUPLICATE_SHEET_HEADERS, duplicateSheetRows, importDateTh, importStatusLabel } from '@/lib/applicantImportDuplicates';

describe('applicantImportDuplicates', () => {
  it('วันที่ไทยเวลาไทย ไม่เติมศูนย์', () => {
    expect(importDateTh('2026-09-30T20:00:00Z')).toBe('1/10/2569');
    expect(importDateTh(null)).toBe('—');
  });
  it('สถานะเป็นคำไทย', () => {
    expect(importStatusLabel('contacted')).toBe('ติดต่อแล้ว');
    expect(importStatusLabel(null)).toBe('—');
  });
  it('แถวของไฟล์: หัว + ต่อคน บอกสมัครล่าสุด สถานะล่าสุด และผลนำเข้า', () => {
    const rows = duplicateSheetRows([
      { row: 3, name: 'ก ข', phone: '0800000000', lastAppliedAt: '2026-09-10T03:00:00Z', lastStatus: 'new', lastJob: 'คนสวน', applications: 2, skipped: false, note: 'เคยสมัครแล้ว เกิน 14 วัน นำเข้าได้' },
      { row: 5, name: 'ค ง', phone: '0800000001', lastAppliedAt: null, lastStatus: null, lastJob: null, applications: 0, skipped: true, note: 'เบอร์ซ้ำกับแถว 4 ในไฟล์' },
    ]);
    expect(rows[0]).toEqual([...DUPLICATE_SHEET_HEADERS]);
    expect(rows[1]).toEqual([3, 'ก ข', '0800000000', '10/9/2569', 'ใหม่', 'คนสวน', 2, 'นำเข้า · เคยสมัครแล้ว เกิน 14 วัน นำเข้าได้']);
    expect(rows[2][7]).toBe('ข้าม · เบอร์ซ้ำกับแถว 4 ในไฟล์');
  });
});
