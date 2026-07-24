import { describe, expect, it } from 'vitest';
import { selectPrecomputeQueue } from '../../api/_lib/matchPrecomputeWorker';
import type { BoardMatchTierEntry } from '../../api/_lib/boardMatchStore';

const NOW = Date.UTC(2026, 6, 24, 3, 0, 0); // fixed clock (Date.now ไม่เกี่ยว — pure)

function job(id: string) {
  return { id, unit_name: 'หน่วยงาน ' + id };
}

function tier(hoursAgo: number): BoardMatchTierEntry {
  return {
    tiers: [{ tier: 'green' }],
    computedAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
  };
}

describe('selectPrecomputeQueue', () => {
  it('picks only open requests with no stored match when staleness is off', () => {
    const jobs = [job('a'), job('b'), job('c')];
    const stored = new Map<string, BoardMatchTierEntry>([['b', tier(100)]]);

    const plan = selectPrecomputeQueue(jobs, stored, { staleMs: 0, batch: 10, nowMs: NOW });

    expect(plan.missing).toBe(2);
    expect(plan.stale).toBe(0);
    expect(plan.queue.map((j) => j.id)).toEqual(['a', 'c']);
  });

  it('computes missing first, then stale oldest-first, capped at batch', () => {
    const jobs = [job('m1'), job('fresh'), job('old'), job('older'), job('m2')];
    const stored = new Map<string, BoardMatchTierEntry>([
      ['fresh', tier(1)], // ยังใหม่ → ไม่คิดใหม่
      ['old', tier(30)],
      ['older', tier(90)],
    ]);
    const staleMs = 24 * 3_600_000; // เกิน 24 ชม. = เก่า

    const plan = selectPrecomputeQueue(jobs, stored, { staleMs, batch: 3, nowMs: NOW });

    expect(plan.missing).toBe(2);
    expect(plan.stale).toBe(2);
    // missing (ตามลำดับที่เจอ) มาก่อน แล้ว stale เก่าสุดก่อน — ตัดที่ batch=3
    expect(plan.queue.map((j) => j.id)).toEqual(['m1', 'm2', 'older']);
  });

  it('treats zero staleMs as staleness disabled even for very old entries', () => {
    const jobs = [job('ancient')];
    const stored = new Map<string, BoardMatchTierEntry>([['ancient', tier(10_000)]]);

    const plan = selectPrecomputeQueue(jobs, stored, { staleMs: 0, batch: 5, nowMs: NOW });

    expect(plan.queue).toHaveLength(0);
    expect(plan.stale).toBe(0);
  });

  it('skips jobs with a blank id', () => {
    const jobs = [job('a'), { id: '   ', unit_name: 'x' }, job('b')];
    const stored = new Map<string, BoardMatchTierEntry>();

    const plan = selectPrecomputeQueue(jobs, stored, { staleMs: 0, batch: 10, nowMs: NOW });

    expect(plan.queue.map((j) => j.id)).toEqual(['a', 'b']);
  });

  it('honours a batch smaller than the missing set', () => {
    const jobs = [job('a'), job('b'), job('c'), job('d')];
    const stored = new Map<string, BoardMatchTierEntry>();

    const plan = selectPrecomputeQueue(jobs, stored, { staleMs: 0, batch: 2, nowMs: NOW });

    expect(plan.missing).toBe(4);
    expect(plan.queue.map((j) => j.id)).toEqual(['a', 'b']);
  });
});
