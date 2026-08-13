import { describe, expect, it } from 'vitest';
import {
  applyEnqueue,
  parseIntEnv,
  selectPrecomputeQueue,
  type QueueEntry,
} from '../../api/_lib/matchPrecomputeWorker';
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

// หน้าเว็บไม่รัน AI สดแล้ว — handler ส่งใบเข้าคิว worker ผ่าน applyEnqueue
describe('applyEnqueue', () => {
  const entry = (id: string, refresh = false) => ({ job: job(id), refresh });

  it('appends new items in FIFO order and dedupes by id', () => {
    const q = new Map<string, QueueEntry>();
    expect(applyEnqueue(q, [entry('a'), entry('b'), entry('a')])).toBe(2);
    expect(applyEnqueue(q, [entry('b')])).toBe(0);
    expect([...q.keys()]).toEqual(['a', 'b']);
  });

  it('front inserts new items at the head without reordering the rest', () => {
    const q = new Map<string, QueueEntry>();
    applyEnqueue(q, [entry('a'), entry('b')]);

    // ใบที่ผู้ใช้เปิดอยู่ต้องแซงคิว scan ปกติ
    const added = applyEnqueue(q, [entry('urgent')], { front: true });

    expect(added).toBe(1);
    expect([...q.keys()]).toEqual(['urgent', 'a', 'b']);
  });

  it('front on an already-queued id keeps its position (dedupe wins)', () => {
    const q = new Map<string, QueueEntry>();
    applyEnqueue(q, [entry('a'), entry('b')]);

    expect(applyEnqueue(q, [entry('b')], { front: true })).toBe(0);
    expect([...q.keys()]).toEqual(['a', 'b']);
  });

  it('upgrades an existing entry to refresh but never downgrades', () => {
    const q = new Map<string, QueueEntry>();
    applyEnqueue(q, [entry('a', false)]);

    applyEnqueue(q, [entry('a', true)]); // สั่งค้นหาใหม่ระหว่างรออยู่ในคิว
    expect(q.get('a')?.refresh).toBe(true);

    applyEnqueue(q, [entry('a', false)]); // scan รอบถัดไปห้ามลดระดับกลับ
    expect(q.get('a')?.refresh).toBe(true);
  });

  it('skips blank ids', () => {
    const q = new Map<string, QueueEntry>();
    expect(applyEnqueue(q, [{ job: { id: '  ' }, refresh: false }])).toBe(0);
    expect(q.size).toBe(0);
  });
});

describe('parseIntEnv — env ที่ไม่ได้ตั้งต้องได้ default ไม่ใช่ min', () => {
  it('ไม่ได้ตั้ง/ว่าง → default (บั๊กเดิม: Number("") = 0 เป็น finite เลยตกไปที่ min)', () => {
    // เคสจริงที่เจอ 12 ส.ค. 2569: SCAN_LIMIT ไม่ได้ตั้ง ควรได้ 2000 แต่ได้ 1
    expect(parseIntEnv(undefined, 2000, 1)).toBe(2000);
    expect(parseIntEnv('', 300_000, 10_000)).toBe(300_000);
    expect(parseIntEnv('   ', 15_000, 0)).toBe(15_000);
  });

  it('ตั้งค่าจริงยังทำงานตามเดิม — ค่าต่ำกว่าเพดานโดน clamp ที่ min', () => {
    expect(parseIntEnv('60000', 300_000, 10_000)).toBe(60_000);
    expect(parseIntEnv('5', 2000, 1)).toBe(5);
    expect(parseIntEnv('500', 300_000, 10_000)).toBe(10_000); // clamp ขึ้น min
    expect(parseIntEnv('7.9', 2000, 1)).toBe(7); // ปัดลงเป็นจำนวนเต็ม
  });

  it('ค่าที่อ่านไม่ออก → default', () => {
    expect(parseIntEnv('abc', 2000, 1)).toBe(2000);
    expect(parseIntEnv('1e999', 2000, 1)).toBe(2000); // Infinity ไม่ finite
  });

  it('ตั้ง "0" โดยตั้งใจ = ใช้ 0 ได้เมื่อ min เป็น 0 (เช่น THROTTLE_MS=0)', () => {
    expect(parseIntEnv('0', 30_000, 0)).toBe(0);
  });
});
