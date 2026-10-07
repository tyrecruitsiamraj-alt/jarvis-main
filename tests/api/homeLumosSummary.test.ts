/**
 * งานติดตามบนหน้าหลัก (7 ต.ค. 2569) — มีผลแตก ไป/ไม่ไป/ขอเลื่อน/สรุปไม่ได้ ด้วยหมวดหน้าติดตาม · ทุกช่องรวม = ทั้งหมด
 */
import { describe, expect, it } from 'vitest';
import { doneBucketOf, emptyFollowBucket, followBucketAddsUp, sumFollowBuckets, FOLLOW_BUCKET_KEYS } from '@/lib/homeLumosSummary';
import { journeyResultOf } from '@/lib/followJourney';

describe('homeLumosSummary', () => {
  it('มีผล → ช่องตามหมวดหน้าติดตาม', () => {
    expect(doneBucketOf(journeyResultOf('agreed', 'confirmed'))).toBe('went');
    expect(doneBucketOf(journeyResultOf('lost', 'declined'))).toBe('notWent');
    expect(doneBucketOf(journeyResultOf('other', 'reschedule_requested'))).toBe('reschedule');
    // ลาป่วยที่หน้าติดตามนับสรุปไม่ได้ = คงเดิม (เจ้าของ Choice 7 ต.ค.)
    expect(doneBucketOf(journeyResultOf('other', 'declined'))).toBe('unclear');
    expect(doneBucketOf(journeyResultOf('unreachable', 'no_answer'))).toBe('failed');
    expect(doneBucketOf(journeyResultOf('cancelled', 'confirmed'))).toBe('cancelled');
    expect(doneBucketOf(journeyResultOf('waiting', null))).toBe('unclear');
  });

  it('รวม AI + คน ทุกช่อง · ลงตัว', () => {
    const a = { ...emptyFollowBucket(), total: 673, went: 469, unclear: 15, failed: 99, cancelled: 90 };
    const b = { ...emptyFollowBucket(), total: 805, went: 77, notWent: 1, reschedule: 1, waiting: 699, failed: 3, cancelled: 24 };
    expect(followBucketAddsUp(a)).toBe(true);
    expect(followBucketAddsUp(b)).toBe(true);
    const s = sumFollowBuckets(a, b);
    expect(s.total).toBe(1478);
    expect(followBucketAddsUp(s)).toBe(true);
    for (const k of FOLLOW_BUCKET_KEYS) expect(s[k]).toBe(a[k] + b[k]);
    expect(followBucketAddsUp({ ...a, went: 470 })).toBe(false);
  });
});
