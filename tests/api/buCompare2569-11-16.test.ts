/**
 * เทียบ BU (เจ้าของ 16 พ.ย. 2569 "BU ไหนเข้ามาเยอะ เข้ามาแล้วติดตรงไหน เทียบทุก Bu ได้ … ระบบควรบอกทั้งหมด")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BU_COMPARE_COLUMNS, buComparePct, buildBuCompare } from '../../src/lib/buCompare';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';

const f = (id: string, bu: string | null, p: Partial<RecruitAppFact> = {}): RecruitAppFact =>
  ({ id, createdAt: '2026-11-14T03:00:00.000Z', jobId: 'siamraj-sql:LBD6911001', bu, phoneOk: true, calledByAi: false, ...p }) as RecruitAppFact;

const cohort: RecruitAppFact[] = [
  f('a1', 'LBD', { calledByAi: true, aiAnswer: 'said_yes', logOk: true, appointmentAt: '2026-11-15T03:00:00.000Z', attendance: 'showed' }),
  f('a2', 'LBD', { calledByAi: true, aiAnswer: 'said_yes', logOk: false }),
  f('a3', 'LBD', { calledByAi: true, aiAnswer: 'said_no' }),
  f('a4', 'LBA', { calledByAi: true, aiAnswer: 'said_yes' }),
  f('a5', 'LBA'),
  f('a6', null),
];

describe('ตารางเทียบ BU', () => {
  it('แถว SN · DS · LM · LBA · LBD เสมอ (ว่าง = 0) + ไม่รู้ BU · ทุกแถวรวม = แถวรวมทุกขั้น', () => {
    const { rows, total } = buildBuCompare(cohort);
    expect(rows.map((r) => r.label)).toEqual(['SN', 'DS', 'LM', 'LBA', 'LBD', 'ไม่รู้ BU']);
    for (const c of BU_COMPARE_COLUMNS) {
      expect(rows.reduce((n, r) => n + r.cells[c.key].value, 0)).toBe(total.cells[c.key].value);
    }
    const lbd = rows.find((r) => r.key === 'LBD')!;
    expect(Object.fromEntries(BU_COMPARE_COLUMNS.map((c) => [c.key, lbd.cells[c.key].value]))).toEqual({
      names: 3, aiCalled: 3, aiYes: 2, staffCalled: 2, staffOk: 1, booked: 1, showed: 1,
    });
    expect(lbd.cells.aiYes.ids).toEqual(['a1', 'a2']);
  });
  it('% = เทียบขั้นก่อนหน้า (ดูว่าติดขั้นไหน) · ฐาน 0 = ไม่มี %', () => {
    const lbd = buildBuCompare(cohort).rows.find((r) => r.key === 'LBD')!;
    expect(buComparePct(lbd, 'names')).toBeNull();
    expect(buComparePct(lbd, 'aiYes')).toBe(67);
    expect(buComparePct(lbd, 'staffOk')).toBe(50);
    const sn = buildBuCompare(cohort).rows.find((r) => r.key === 'SN')!;
    expect(buComparePct(sn, 'aiCalled')).toBeNull();
  });
  it('เลือก BU อยู่ = แถวของ BU นั้น (ใบ BU อื่นที่หลุดมายังมีแถว ไม่หาย)', () => {
    expect(buildBuCompare(cohort.filter((x) => x.bu === 'LBD'), ['LBD']).rows.map((r) => r.key)).toEqual(['LBD']);
  });
  it('server ส่ง BU ของใบด้วยตัวเดียวกับที่ภาพรวมกรอง BU · ภาพรวมมีปุ่มเทียบ BU', () => {
    const ov = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
    expect(ov).toContain("${appBuSql('a')} as bu,");
    expect(ov).toContain('bu: text(r.bu),');
    expect(readFileSync('src/lib/recruitScale.ts', 'utf8')).toContain("export const SCALE_MORE: readonly ScaleSectionKey[] = ['bu', 'area', 'mon', 'why'];");
  });
});
