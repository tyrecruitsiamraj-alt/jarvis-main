/**
 * ═══ กราฟทุกตัวของระบบเป็น Interactive chart (เจ้าของ 21 ต.ค. 2569) ═══
 * > *"ทุกกราฟของระบบ เป็น Interactive chart ทั้งหมด"* · Choice "ครบชุดเหมือนกราฟเส้นนี้" + "เฉพาะกราฟจริง"
 * ชี้แล้วขึ้นกล่องตัวเลข + เส้นแนวตั้ง/แถบไฮไลต์ + จุดเด่นบนเส้น + เส้น/แท่งค่อย ๆ ขึ้น
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chartDayLabel } from '@/lib/designTokens';

const chartFiles = execSync("grep -rlE '<(LineChart|BarChart|PieChart|ComposedChart|AreaChart)\\b' src", { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

/** ก้อน JSX ของ tag ตั้งแต่ `<Tag` ถึง `/>` หรือ `>` ตัวแรกที่ปิด tag */
function blocksOf(src: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b`, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 0;
    let i = m.index;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}

describe('กราฟทุกตัว interactive', () => {
  it('เจอกราฟครบ (กันเทสต์ว่างแล้วผ่านเงียบ)', () => {
    expect(chartFiles.length).toBeGreaterThanOrEqual(13);
  });

  it.each(chartFiles)('%s — ไม่ปิดการเคลื่อนไหว · กล่องตัวเลขมีเส้น/แถบตามเมาส์', (f) => {
    const src = readFileSync(f, 'utf8');
    expect(src).not.toMatch(/isAnimationActive=\{false\}/);
    for (const t of blocksOf(src, 'Tooltip')) {
      // โดนัทไม่มีแกน — ไม่มีเส้นตามเมาส์
      if (/<PieChart\b/.test(src)) continue;
      expect(t, `${f}: Tooltip ไม่มี cursor`).toMatch(/cursor=\{/);
    }
  });

  it.each(chartFiles)('%s — ทุกเส้นมีจุดเด่นตรงที่ชี้', (f) => {
    const src = readFileSync(f, 'utf8');
    for (const l of blocksOf(src, 'Line')) {
      // เส้นจิ๋วในการ์ดตัวเลข (ไม่มีกล่องตัวเลข) · เส้นแนวโน้มที่ไม่ขึ้นในกล่อง
      if (/dataKey="v"/.test(l) || /tooltipType="none"/.test(l)) continue;
      expect(l, `${f}: Line ไม่มี activeDot`).toMatch(/activeDot=\{CHART\.activeDot\}/);
    }
  });

  it('วันที่ในกล่องตัวเลขเป็นแบบไทย', () => {
    expect(chartDayLabel('2026-10-16')).toBe('16 ต.ค. 2569');
    expect(chartDayLabel('2027-01-05')).toBe('5 ม.ค. 2570');
    expect(chartDayLabel('15')).toBe('15');
    expect(chartDayLabel(undefined)).toBe('');
  });
});
