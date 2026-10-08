/**
 * หน้าหลักโฉมใหม่ 8 ต.ค. 2569 — ทุกแท่งแบ่ง AI/คน · ชิ้นรวม = แท่ง · ทุกแท่งรวม = ทั้งหมด
 * (เจ้าของ "ไม่เอาแค่ไปเท่าไหร่ แต่ต้องบอกได้ว่าไปเนี่ย Ai โทร คนโทรเท่าไหร่ Bu ไหนใช้เยอะ")
 */
import { describe, expect, it } from 'vitest';
import { followBuSplit, followResultSplit, followTeamTotals, reportBuSplit, reportResultSplit, splitRowsTotal, splitTotalRow } from '@/lib/homeSplit';
import { FOLLOW_BUCKET_KEYS, type FollowBuCell } from '@/lib/homeLumosSummary';
import { buildApplicantsReport, type ReportSourceRow } from '@/lib/homeTopicReport';

const cells: FollowBuCell[] = [
  { bu: 'LBD', team: 'main', caller: 'ai', bucket: 'went', n: 10 },
  { bu: 'LBD', team: 'main', caller: 'manual', bucket: 'went', n: 3 },
  { bu: 'LBD', team: 'replacement', caller: 'manual', bucket: 'waiting', n: 5 },
  { bu: 'LBA', team: 'main', caller: 'ai', bucket: 'notWent', n: 2 },
  { bu: null, team: 'main', caller: 'manual', bucket: 'cancelled', n: 1 },
];
const cols = FOLLOW_BUCKET_KEYS.map((k) => ({ key: k, label: k }));

describe('ติดตาม', () => {
  it('ไป = AI 10 + คน 3 · ทุกผลรวม = ทั้งหมด', () => {
    const rows = followResultSplit(cells, cols);
    expect(rows.find((r) => r.key === 'went')).toMatchObject({ total: 13, parts: { ai: 10, staff: 3 } });
    expect(splitRowsTotal(rows)).toBe(21);
    // แถวบนสุด "โทรทั้งหมด" = ทุกแถวรวม แยก AI/คน
    expect(splitTotalRow(rows, 'โทรทั้งหมด')).toMatchObject({ key: 'all', total: 21, parts: { ai: 12, staff: 9 } });
  });
  it('BU มากไปน้อย ไม่ระบุไว้ท้าย · รวม = ทั้งหมด · ทีม', () => {
    const bu = followBuSplit(cells);
    expect(bu.map((r) => [r.label, r.total, r.parts.ai, r.parts.staff])).toEqual([
      ['LBD', 18, 10, 8],
      ['LBA', 2, 2, 0],
      ['ไม่ระบุ BU', 1, 0, 1],
    ]);
    expect(splitRowsTotal(bu)).toBe(21);
    expect(followTeamTotals(cells)).toEqual({ main: 16, replacement: 5 });
  });
});

describe('หัวข้ออื่น', () => {
  const row = (p: Partial<ReportSourceRow>): ReportSourceRow => ({
    ai: false,
    staff: false,
    bu: 'LBD',
    ai_outcome: null,
    ai_summary: null,
    ai_reply: null,
    ai_at: null,
    staff_outcome: null,
    staff_at: null,
    ...p,
  });
  it('ผลแต่ละช่องแบ่งก้อนกล่อง · ชิ้นรวม = แท่ง · ทุกแท่ง = รายชื่อทั้งหมด · BU เหมือนกัน', () => {
    const r = buildApplicantsReport(
      [
        row({ ai: true, ai_outcome: 'confirmed', ai_at: '2026-10-01T00:00:00Z' }),
        row({ staff: true, staff_outcome: 'confirmed', staff_at: '2026-10-01T00:00:00Z' }),
        row({ bu: 'LBA' }),
      ],
      0,
    );
    const res = reportResultSplit(r);
    expect(res.find((x) => x.key === 'interested')).toMatchObject({ total: 2, parts: { ai: 1, staff: 1, both: 0, notCalled: 0 } });
    for (const x of res) expect(Object.values(x.parts).reduce((n, v) => n + (v ?? 0), 0)).toBe(x.total);
    expect(splitRowsTotal(res)).toBe(3);
    const bu = reportBuSplit(r);
    expect(bu.map((x) => [x.label, x.total])).toEqual([
      ['LBD', 2],
      ['LBA', 1],
    ]);
    expect(splitRowsTotal(bu)).toBe(3);
  });
});
