import { describe, expect, it } from 'vitest';
import { POSTING_STATES, isPostingStarted, postingStateOf } from '@/lib/recruitPostingState';
import type { StuckRequest } from '@/lib/recruitStuck';

type Sig = StuckRequest['signals'];
const sig = (p: Partial<Sig>): Sig => ({ released: false, links: 0, post: null, counts: {} as Sig['counts'], uncalled: 0, queued: 0, ...p });
const req = (signals: Partial<Sig>, applications = 0, filled = 0) => ({ signals: sig(signals), applications, filled });

describe('สถานะการออกหาคนรายใบ 9 แบบ (ภาพรวม v2 · 17 พ.ย. 2569)', () => {
  it('แต่ละใบได้สถานะเดียวตามลำดับหลักฐาน', () => {
    expect(postingStateOf(req({ post: 'posted' }, 3))).toBe('postedApps');
    expect(postingStateOf(req({ post: 'completed' }))).toBe('postedEmpty');
    expect(postingStateOf(req({ post: 'pending', links: 2 }))).toBe('queued');
    expect(postingStateOf(req({ released: true, links: 1 }))).toBe('publicOnly');
    expect(postingStateOf(req({ links: 1 }))).toBe('linked');
    expect(postingStateOf(req({}, 2))).toBe('namesOnly');
    expect(postingStateOf(req({}, 0, 1))).toBe('fulfilledPartial');
    expect(postingStateOf(req({ post: 'rejected' }))).toBe('prepared');
    expect(postingStateOf(req({}))).toBe('untouched');
    expect(POSTING_STATES).toHaveLength(9);
  });
  it('🔴 Gen link / สั่งแล้วไม่สำเร็จ ≠ โพสต์สำเร็จ · เตรียมไว้ = ยังไม่เริ่มหา', () => {
    expect(isPostingStarted(req({ post: 'rejected' }))).toBe(false);
    expect(isPostingStarted(req({ links: 1 }))).toBe(true);
    expect(postingStateOf(req({ links: 3 }))).not.toBe('postedEmpty');
  });
});
