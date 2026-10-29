/**
 * ตัวเลือก BU: ชื่อย่ออย่างเดียว · ภาพรวมงานสรรหามี "ทุก BU" เป็นค่าเริ่ม (เจ้าของ 29 ต.ค. 2569
 * "เอาแค่ชื่อย่อ · default คือ ผลรวมของทุก bu แล้วฉันไปแยกดูเอง")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('BuChoiceSelect', () => {
  const src = readFileSync('src/components/shared/BuChoiceSelect.tsx', 'utf8');
  it('ตัวเลือกโชว์รหัสย่อ ไม่ใช่ชื่อเต็ม', () => {
    expect(src).toContain('{normalizeTrendBu(b) ?? b}');
    expect(src).not.toContain('trendBuLabel');
  });
  it('"ทุก BU" มีเฉพาะหน้าที่เปิด allOption · เลือกแล้วส่ง null', () => {
    expect(src).toContain('ทุก BU');
    expect(src).toContain("onChange(v === ALL ? null : v)");
    const overview = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
    expect(overview).toMatch(/<BuChoiceSelect[^>]*allOption/);
  });
});
