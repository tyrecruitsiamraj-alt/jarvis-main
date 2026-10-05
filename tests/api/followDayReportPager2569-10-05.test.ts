/**
 * สรุปแผนทั้งวัน: ตารางบนจอแบ่งหน้า (เจ้าของสั่ง 5 ต.ค. 2569: *"ทำเป็น Pagination ตอนนี้มันยาวไป เอาหน้าละ 10-20"*)
 * หน้าบนจอใช้ตัวแบ่งเดียวกับรูป ⇒ หน้า N = รูปที่ N · คัดลอก/บันทึกรูป ยังได้ทุกแถว
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs
  .readFileSync(path.resolve(__dirname, '../../src/components/follow/FollowDayReportDialog.tsx'), 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

describe('สรุปแผนทั้งวัน แบ่งหน้า', () => {
  it('ตารางวาดเฉพาะแถวของหน้าที่ดู · หน้าแบ่งด้วย paginateDayReportRows ตัวเดียวกับรูป', () => {
    expect(SRC).toContain('paginateDayReportRows(report.rows, pageSize)');
    expect(SRC).toContain('pageRows.map((r) =>');
    expect(SRC).not.toContain('report.rows.map(');
  });
  it('มีตัวเปลี่ยนหน้าเสมอ · เปลี่ยนตัวกรองแล้วกลับหน้าแรก · คัดลอก/รูป ยังใช้ทุกแถว', () => {
    expect(SRC).toContain('data-testid="day-report-pager"');
    expect(SRC).toContain('setPage(0), [open, selYmd, caller, call, pageSize]');
    expect(SRC).toContain('followDayReportTsv(report)');
    expect(SRC).toContain('downloadFollowDayReportPng(report, pageSize)');
  });
});

describe('สรุปแผน: เลือกหน้าละ 10 20 30 40 50 (เจ้าของสั่ง 5 ต.ค. 2569)', () => {
  it('ตัวเลือกครบ 5 ค่า · จอกับรูปใช้ค่าเดียวกัน · ปุ่มบนหน้าชื่อ "สรุปแผน"', async () => {
    const { DAY_REPORT_PAGE_SIZES, paginateDayReportRows } = await import('../../src/lib/followDayReportImage');
    expect([...DAY_REPORT_PAGE_SIZES]).toEqual([10, 20, 30, 40, 50]);
    const rows = Array.from({ length: 45 }, (_, i) => ({ name: `คน ${i}` })) as never[];
    expect(paginateDayReportRows(rows, 10)).toHaveLength(5);
    expect(paginateDayReportRows(rows, 50)).toHaveLength(1);
    expect(SRC).toContain('ariaLabel="หน้าละกี่แถว"');
    const page = fs.readFileSync(path.resolve(__dirname, '../../src/pages/follow/FollowPage.tsx'), 'utf8');
    expect(page).toContain('title="สรุปแผน"');
    expect(page).not.toContain('>สรุปแผนทั้งวัน<');
  });
});
