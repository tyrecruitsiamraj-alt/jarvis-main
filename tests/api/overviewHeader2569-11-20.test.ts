/**
 * หัวหน้าภาพรวมงานสรรหา (เจ้าของ 20 พ.ย. 2569):
 * "เปลี่ยนไปใช้คำว่าวันที่ แล้วถ้าเลือกวันไหน หรือ ช่วงวันไหนให้มันขึ้นเป็นตามที่เลือก" · "เทียบกับ … · ข้อมูล ณ … น. เอาออก" ·
 * "ทุก BU กับ วันที่ต้องอยู่แถวเดียวกัน"
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');

describe('หัวหน้าภาพรวม', () => {
  it('ปุ่มช่วงเวลาบอกวันที่ที่เลือกจริง ไม่ใช่ชื่อเดือน', () => {
    expect(src).toContain("? 'วันที่ ทั้งหมด'\n      : `วันที่ ${rangeText({ from: win.from, to: win.to })}`;");
    expect(src).not.toContain("isRange ? rangeText({ from: win.from, to: win.to }) : monthLabel(win.month);\n  /** ปุ่มลัด");
  });
  it('ไม่มีบรรทัดเทียบกับ/ข้อมูล ณ', () => {
    expect(src).not.toContain('compareNote');
    expect(src).not.toContain('`ข้อมูล ณ ${shortTime(data.generatedAt)} น.`');
  });
  it('เลือก BU อยู่กลุ่มเดียวกับปุ่มวันที่', () => {
    const row = src.slice(src.indexOf('<div className="ml-auto flex flex-wrap items-center gap-2">'), src.indexOf('data-testid="recruit-period"'));
    expect(row).toContain('<BuChoiceSelect');
  });
  it('เทียบเดือน: ปุ่มวันที่เลือกแบบที่ดูได้ · เดือนเริ่ม-เดือนจบ · ก้อนใบขอเป็นกราฟรายเดือน · URL cmp=1', () => {
    expect(src).toContain('data-testid="recruit-mode-compare"');
    expect(src).toContain('const pickCompareMonth = (m: string) =>');
    expect(src).toContain('<RecruitOverviewV2 data={data} compareMonths={cmpOn} />');
    expect(src).toContain("if (compareMonths && r) p.set('cmp', '1');");
    // เลือกช่วงวันที่/เดือนแบบเดิม = ออกจากโหมดเทียบเดือน
    expect(src.match(/setCompareMonths\(false\)/g)?.length).toBe(4);
  });
});
