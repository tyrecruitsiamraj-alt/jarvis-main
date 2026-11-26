import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MATCH_GROUPS, boardColumnShort, isSalaryOver, matchGroupOf } from '@/lib/matchingGroups';
import { filterAndSortMatchingJobs, matchGroupOfJob } from '@/lib/matchingListFilter';
import type { JobRequest } from '@/types';

/**
 * หน้าจับคู่โฉมใหม่ 4 กล่อง (เจ้าของ 26 พ.ย. 2569) — 1 ใบอยู่กล่องเดียว · 4 กล่องรวมกัน = ใบทั้งหมด
 * fixture หน้าตาเหมือนข้อมูลจริง (id มี prefix · เลขใบจริงของ LBD/LM)
 */
const job = (no: string, requestDate: string): JobRequest =>
  ({
    id: `siamraj-sql:${no}`,
    request_no: no,
    request_date: requestDate,
    created_at: `${requestDate}T00:00:00.000Z`,
    required_date: '2026-12-01',
    urgency: 'urgent',
    department_code: no.startsWith('LM') ? 'LM' : 'LBD',
    unit_name: 'ธนาคาร ซีไอเอ็มบี ไทย จำกัด (มหาชน)',
    request_positions: 1,
    filled_positions: 0,
    cancelled_positions: 0,
  }) as unknown as JobRequest;

const green = { tier: 'green' as const };
const yellow = { tier: 'yellow' as const };
const red = { tier: 'red' as const };

const JOBS = [
  job('OPL6911097', '2026-11-25'), // แนะนำ 2 ยังไม่ส่ง
  job('LBM6910005', '2026-10-15'), // แนะนำ 1 ส่งแล้ว ไม่มีคนรอตาม
  job('OPL6905114', '2026-05-25'), // ส่งแล้ว มีคนรอตาม 144
  job('LAO6911037', '2026-11-26'), // ไม่มีคนแนะนำ แต่มีคนรอตาม 3
  job('LMO6801013', '2025-01-01'), // ไม่มีคนแนะนำ ไม่เคยส่ง
  job('OPL6911107', '2026-11-26'), // ยังไม่เคยจับคู่
];
const MATCHES: Record<string, Array<{ tier: 'green' | 'yellow' | 'red' }>> = {
  'siamraj-sql:OPL6911097': [green, yellow, red],
  'siamraj-sql:LBM6910005': [green],
  'siamraj-sql:OPL6905114': [green],
  'siamraj-sql:LAO6911037': [red],
  'siamraj-sql:LMO6801013': [],
};
const CALLS: Record<string, { sent: number; pendingApproval: number; needsHuman: number }> = {
  'siamraj-sql:LBM6910005': { sent: 6, pendingApproval: 0, needsHuman: 0 },
  'siamraj-sql:OPL6905114': { sent: 187, pendingApproval: 0, needsHuman: 144 },
  'siamraj-sql:LAO6911037': { sent: 5, pendingApproval: 0, needsHuman: 3 },
};
const ctx = {
  hasReserved: () => false,
  matchesFor: (id: string) => MATCHES[id],
  callsFor: (id: string) => CALLS[id],
  today: new Date('2026-11-26T12:00:00+07:00'),
};
const query = (workflowFilter: string) =>
  ({ search: '', urgentOnly: false, unitFilter: '', workflowFilter, sort: 'group' }) as Parameters<
    typeof filterAndSortMatchingJobs
  >[1];

describe('หน้าจับคู่ 4 กล่อง (26 พ.ย. 2569)', () => {
  it('ตัดสินกล่อง: มีคนรอตามมาก่อนเสมอ แม้ไม่มีคนแนะนำ', () => {
    expect(matchGroupOf(2)).toBe('call_ready');
    expect(matchGroupOf(2, { sent: 0, pendingApproval: 3, needsHuman: 0 })).toBe('ai_sent');
    expect(matchGroupOf(1, { sent: 6, pendingApproval: 0, needsHuman: 0 })).toBe('ai_sent');
    expect(matchGroupOf(0, { sent: 5, pendingApproval: 0, needsHuman: 3 })).toBe('needs_human');
    expect(matchGroupOf(0, { sent: 5, pendingApproval: 0, needsHuman: 0 })).toBe('no_match');
    expect(matchGroupOf(0)).toBe('no_match');
  });

  it('ทุกใบอยู่กล่องเดียว · 4 กล่องรวมกัน = ใบทั้งหมด (ตัวกรองชุดเดียวกับยอดบนกล่อง)', () => {
    const counts = MATCH_GROUPS.map((g) => filterAndSortMatchingJobs(JOBS, query(g.key), ctx).length);
    expect(counts).toEqual([1, 2, 1, 2]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(JOBS.length);
    for (const j of JOBS) {
      const inGroups = MATCH_GROUPS.filter((g) =>
        filterAndSortMatchingJobs(JOBS, query(g.key), ctx).some((x) => x.id === j.id),
      );
      expect(inGroups.map((g) => g.key)).toEqual([matchGroupOfJob(j.id, ctx)]);
    }
  });

  it('เรียงตามกล่อง: ต้องคนตาม = คนรอตามมากก่อน · ไม่มีคนตรง = ใบใหม่ก่อน', () => {
    expect(filterAndSortMatchingJobs(JOBS, query('needs_human'), ctx).map((j) => j.request_no)).toEqual([
      'OPL6905114',
      'LAO6911037',
    ]);
    expect(filterAndSortMatchingJobs(JOBS, query('no_match'), ctx).map((j) => j.request_no)).toEqual([
      'OPL6911107',
      'LMO6801013',
    ]);
  });

  it('ขอเกิน = ขอเงินเดือนเกินใบขอเกิน 30% · ใบไม่บอกเงิน = ไม่ตัดสิน', () => {
    expect(isSalaryOver(20000, 15000)).toBe(true);
    expect(isSalaryOver(19500, 15000)).toBe(false);
    expect(isSalaryOver(30000, 0)).toBe(false);
    expect(isSalaryOver(null, 15000)).toBe(false);
  });

  it('ปุ่มส่ง AI โทรท้ายป๊อปไม่ส่งข้อมูลการคลิกเข้าไปแทนรายชื่อ (เดิมพังเงียบ: event.filter ไม่มี)', () => {
    const panels = readFileSync('src/components/matching/LumosPanels.tsx', 'utf8');
    expect(panels).not.toContain('onClick={onSend}');
    const table = readFileSync('src/components/matching/MatchPeopleTable.tsx', 'utf8');
    // ปุ่มคู่แบบหน้าผู้สมัคร: เหนือตาราง + ทุกแถว
    expect(table).toContain('data-testid="match-hold-selected"');
    expect(table).toContain('data-testid="match-send-selected"');
    expect(table).toContain('onSendOne(r.id)');
    expect(table).toContain('onHoldOne(r.id)');
  });

  it('ถังบนบอร์ดเป็นคำสั้น', () => {
    expect(boardColumnShort('ไม่มีงาน')).toBe('รองาน');
    expect(boardColumnShort('Re Use')).toBe('คนเก่า');
    expect(boardColumnShort('To do')).toBeNull();
    expect(boardColumnShort('Drop')).toBe('Drop');
  });
});
