// @vitest-environment node
/**
 * กล่องสรุปหน้า Matching — สมการต้องลงตัวเสมอ
 *
 * เจ้าของสั่ง 10 ส.ค. 2569: "ตัวเลขต้องตรงกัน แบ่งไปเป็นอะไรก็ได้ แต่รวมกันต้องได้ยอดรวม"
 *
 * บั๊กเดิม: "ยังไม่มีคน" นับเฉพาะใบที่ AI ประเมินแล้วไม่พบ (ต้องมีใน tierMap)
 * ใบที่ AI ยังไม่ได้ประเมินจึงตกนอกทั้ง 3 ถัง → เขียว+เหลือง+ยังไม่มีคน < ยอดรวม
 * ตอนเจอบังเอิญเท่ากันพอดีเพราะทุกใบถูกประเมินหมด (317 = 152+25+140)
 * พังทันทีที่มีใบใหม่เข้ามาแล้ว AI ยังไม่ทัน — เทสต์ชุดนี้จับกรณีนั้นโดยเฉพาะ
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const src = readFileSync(
  path.resolve(process.cwd(), 'api/_handlers/matching-list.ts'),
  'utf8',
);

/**
 * จำลองการแบ่งถังแบบเดียวกับ handler — ทดสอบ "นิยาม" ไม่ใช่ตัวโค้ด
 * (handler จริงผูกกับ SQL Server + PG ที่ mock ทั้งท่อไม่คุ้ม)
 */
type Job = { id: string; units: number; tiers?: Array<'green' | 'yellow' | 'red'> };

function bucket(jobs: Job[]) {
  const tiersOf = (j: Job) => j.tiers;
  const hasGreen = (j: Job) => (tiersOf(j) ?? []).includes('green');
  const hasYellowOnly = (j: Job) => !hasGreen(j) && (tiersOf(j) ?? []).includes('yellow');
  const green = jobs.filter(hasGreen);
  const yellow = jobs.filter(hasYellowOnly);
  const none = jobs.filter((j) => !hasGreen(j) && !hasYellowOnly(j));
  const pos = (l: Job[]) => l.reduce((s, j) => s + j.units, 0);
  return {
    total: jobs.length,
    green: green.length,
    yellow: yellow.length,
    none: none.length,
    noneAnalyzed: none.filter((j) => j.tiers !== undefined).length,
    noneUnanalyzed: none.filter((j) => j.tiers === undefined).length,
    positionsTotal: pos(jobs),
    positionsGreen: pos(green),
    positionsYellow: pos(yellow),
    positionsNone: pos(none),
  };
}

describe('สมการกล่องสรุป — เขียว + เหลือง + ยังไม่มีคน = ทั้งหมด', () => {
  it('ทุกใบถูกประเมินหมด (เคสที่เคยบังเอิญผ่าน)', () => {
    const s = bucket([
      { id: 'a', units: 2, tiers: ['green'] },
      { id: 'b', units: 1, tiers: ['yellow'] },
      { id: 'c', units: 3, tiers: ['red'] },
    ]);
    expect(s.green + s.yellow + s.none).toBe(s.total);
    expect(s.positionsGreen + s.positionsYellow + s.positionsNone).toBe(s.positionsTotal);
  });

  it('**มีใบที่ AI ยังไม่ได้ประเมิน** — เคสที่บั๊กเดิมทำให้รวมไม่ครบ', () => {
    const s = bucket([
      { id: 'a', units: 2, tiers: ['green'] },
      { id: 'b', units: 1, tiers: ['yellow'] },
      { id: 'c', units: 3, tiers: [] }, // ประเมินแล้วไม่พบใคร
      { id: 'd', units: 5 }, // ยังไม่ได้ประเมินเลย
    ]);
    expect(s.green + s.yellow + s.none).toBe(s.total);
    expect(s.positionsGreen + s.positionsYellow + s.positionsNone).toBe(s.positionsTotal);
    // ถังที่ 3 ต้องกินทั้งสองแบบ แล้วแยกให้เห็นในบรรทัดย่อย
    expect(s.none).toBe(2);
    expect(s.noneAnalyzed).toBe(1);
    expect(s.noneUnanalyzed).toBe(1);
  });

  it('ไม่มีใบเลย = ศูนย์ทั้งชุด ไม่ NaN', () => {
    const s = bucket([]);
    expect(s.total).toBe(0);
    expect(s.green + s.yellow + s.none).toBe(0);
    expect(s.positionsTotal).toBe(0);
  });

  it('เขียวกับเหลืองต้องไม่ซ้อนกัน — ใบที่มีทั้งสองสีนับเป็นเขียวอย่างเดียว', () => {
    const s = bucket([{ id: 'a', units: 1, tiers: ['green', 'yellow'] }]);
    expect(s.green).toBe(1);
    expect(s.yellow).toBe(0);
    expect(s.none).toBe(0);
  });

  it('1 ใบขอหลายอัตรา — ยอดอัตราต้องไม่เท่ายอดใบขอ (คนละหน่วย ห้ามปนกัน)', () => {
    const s = bucket([
      { id: 'a', units: 5, tiers: ['green'] },
      { id: 'b', units: 3, tiers: ['yellow'] },
    ]);
    expect(s.total).toBe(2);
    expect(s.positionsTotal).toBe(8);
  });
});

describe('handler ต้องคำนวณตามนิยามนี้จริง (กันแก้แล้วลืม)', () => {
  it('ถัง "ยังไม่มีคน" = ที่เหลือทั้งหมด ไม่ผูกกับ tierMap.has()', () => {
    // บั๊กเดิมเขียนว่า tierMap.has(j.id) && recommendedCandidateCount(...) === 0
    expect(src).not.toMatch(/noRecommend:\s*scopedJobs\.filter\(\s*\(j\)\s*=>\s*tierMap\.has/);
    expect(src).toMatch(/const noneJobs = scopedJobs\.filter\(\(j\) => !isGreen\(j\) && !isYellow\(j\)\)/);
    expect(src).toMatch(/noRecommend: noneJobs\.length/);
  });

  it('ส่งยอดหน่วย "อัตรา" มาให้การ์ดใช้ครบทุกถัง', () => {
    for (const key of [
      'positionsTotal',
      'positionsUrgent',
      'positionsGreen',
      'positionsYellow',
      'positionsNone',
    ]) {
      expect(src, key).toMatch(new RegExp(`${key}:`));
    }
  });

  it('แยก "AI ดูแล้วไม่เจอ" กับ "ยังไม่ได้ดู" ให้บรรทัดย่อยใช้', () => {
    expect(src).toMatch(/noneAnalyzed:/);
    expect(src).toMatch(/noneUnanalyzed:/);
  });
});
