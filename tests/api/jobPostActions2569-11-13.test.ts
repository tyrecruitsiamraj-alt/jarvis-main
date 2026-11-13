// @vitest-environment node
/** "ทำอะไรไปแล้ว" ของใบขอบนการ์ดโพสต์ประกาศ (เจ้าของ 13 พ.ย. 2569) — ตัวตัดสินที่ `src/lib/jobPostActions.ts` */
import { describe, expect, it } from 'vitest';
import { jobPostLinkOrigin, postGroupBuckets, summarizeJobPostActions } from '../../src/lib/jobPostActions';

const J = 'siamraj-sql:SQ6909009';
const order = (type: 'content' | 'scraping', at: string, status = 'posted') => ({ job_id: J, request_type: type, status, created_at: at, updated_at: at });
const link = (at: string, note: string | null, hits = 0, apps = 0) => ({ job_id: J, note, created_at: at, hit_count: hits, applicants: apps });

describe('ลิงก์มาจากไหน', () => {
  const autopostAt = [new Date('2026-11-04T01:24:28Z').getTime()];
  it('ป้ายชนะ · ไม่มีป้ายแต่เกิดก่อนคำสั่ง Autopost ไม่กี่วินาที = Autopost · ห่างกัน = โพสต์เอง', () => {
    expect(jobPostLinkOrigin({ note: 'Autopost', created_at: '2026-10-01T00:00:00Z' }, [])).toBe('autopost');
    expect(jobPostLinkOrigin({ note: 'โพสต์เอง', created_at: '2026-11-04T01:24:25Z' }, autopostAt)).toBe('manual');
    expect(jobPostLinkOrigin({ note: null, created_at: '2026-11-04T01:24:25Z' }, autopostAt)).toBe('autopost');
    expect(jobPostLinkOrigin({ note: null, created_at: '2026-11-02T01:17:59Z' }, autopostAt)).toBe('manual');
  });
});

describe('ยอดต่อใบ', () => {
  it('Autopost นับคำสั่ง + ลิงก์ของคำสั่ง · โพสต์เองนับลิงก์ · Scrap นับคำสั่ง + สถานะล่าสุด', () => {
    const s = summarizeJobPostActions(
      [link('2026-11-04T01:24:25Z', null, 3, 1), link('2026-11-02T01:17:59Z', null, 2), link('2026-11-11T07:09:00Z', 'โพสต์เอง', 5, 2)],
      [order('scraping', '2026-11-03T01:11:05Z', 'pending'), order('content', '2026-11-04T01:24:28Z'), order('scraping', '2026-11-05T00:00:00Z', 'in_progress')],
    )[J];
    expect(s.autopost).toEqual({ orders: 1, links: 1, clicks: 3, applicants: 1 });
    expect(s.manual).toEqual({ links: 2, posted: 0, clicks: 7, applicants: 2 });
    expect(s.scrap).toEqual({ orders: 2, status: 'in_progress', updated_at: '2026-11-05T00:00:00Z' });
  });
  it('กองสถานะบนการ์ด 3 ช่อง บวกกัน = สั่งทั้งหมดเสมอ (SQ6909009 จริง 22 กลุ่ม)', () => {
    const counts = { posted: 2, pending_approval: 4, failed: 6, not_tried_machine: 4, not_tried_account: 6 };
    const b = postGroupBuckets(22, counts);
    expect(b).toEqual({ posted: 2, waiting: 4, failed: 16 });
    expect(b.posted + b.waiting + b.failed).toBe(22);
    expect(postGroupBuckets(3, { waiting: 1, posted: 1 })).toEqual({ posted: 1, waiting: 1, failed: 1 });
  });
});
