import { beforeEach, describe, expect, it } from 'vitest';

import {
  ageSeconds,
  clearUnitRequestCache,
  readThroughCache,
  unitRequestCacheSize,
} from '../../api/_lib/unitRequestCache';

/**
 * สำเนาใบขออายุสั้น — กันจอค้างเพราะระบบงานหลักตอบช้า
 *
 * 🔴 กติกาที่ต้องคุมไว้: ของเก่าที่บอกอายุ ดีกว่าจอพัง · แต่ **ไม่มีสำเนาเลยต้องพังให้เห็น**
 * ห้ามกลืนเป็นลิสต์ว่าง (ลิสต์ว่าง = "ไม่มีใบขอ" ซึ่งคนละเรื่องกับ "ยังไม่รู้")
 */
describe('อ่านผ่านสำเนา', () => {
  beforeEach(() => clearUnitRequestCache());

  it('ครั้งแรกไปถามจริง ครั้งต่อไปในช่วงอายุใช้สำเนา', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return [{ id: calls }];
    };
    const a = await readThroughCache('k', load, { now: 1_000 });
    const b = await readThroughCache('k', load, { now: 5_000 });
    expect(a.source).toBe('live');
    expect(b.source).toBe('cache');
    expect(b.value).toEqual(a.value);
    expect(calls).toBe(1);
  });

  it('เกินอายุแล้วไปถามใหม่', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return calls;
    };
    await readThroughCache('k', load, { now: 0 });
    const second = await readThroughCache('k', load, { now: 200_000 });
    expect(second.source).toBe('live');
    expect(calls).toBe(2);
  });

  it('fresh = ข้ามสำเนาไปถามสดเสมอ (ปุ่มรีเฟรชบนจอ)', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return calls;
    };
    await readThroughCache('k', load, { now: 1_000 });
    const forced = await readThroughCache('k', load, { now: 1_100, fresh: true });
    expect(forced.source).toBe('live');
    expect(calls).toBe(2);
  });

  it('🔴 ถามใหม่ไม่ได้ แต่มีสำเนาเก่า = ส่งของเก่าไป พร้อมบอกว่าเป็นของเก่า', async () => {
    await readThroughCache('k', async () => ['ของจริง'], { now: 0 });
    const out = await readThroughCache<string[]>(
      'k',
      async () => {
        throw new Error('Timeout: Request failed to complete in 60000ms');
      },
      { now: 200_000 },
    );
    expect(out.source).toBe('stale-after-error');
    expect(out.value).toEqual(['ของจริง']);
    // อายุต้องเป็นของเดิม ไม่ใช่เวลาที่เพิ่งถามพลาด — ไม่งั้นจอบอกว่าข้อมูลสด
    expect(out.fetchedAt).toBe(0);
  });

  it('🔴 ไม่มีสำเนาเลยและถามไม่ได้ = ต้องพังให้เห็น ห้ามคืนลิสต์ว่าง', async () => {
    await expect(
      readThroughCache('ยังไม่เคยมี', async () => {
        throw new Error('ต่อไม่ติด');
      }),
    ).rejects.toThrow('ต่อไม่ติด');
  });

  it('คนละคีย์ = คนละสำเนา ไม่ปนกัน', async () => {
    await readThroughCache('a', async () => 'A', { now: 0 });
    const b = await readThroughCache('b', async () => 'B', { now: 0 });
    expect(b.value).toBe('B');
    expect(unitRequestCacheSize()).toBe(2);
  });

  it('เก็บไม่เกินเพดาน — คีย์แปลก ๆ เยอะแค่ไหนหน่วยความจำก็ไม่บวม', async () => {
    for (let i = 0; i < 40; i += 1) {
      await readThroughCache(`k${i}`, async () => i, { now: 0 });
    }
    expect(unitRequestCacheSize()).toBeLessThanOrEqual(24);
  });
});

describe('อายุข้อมูลที่เขียนบนจอ', () => {
  it('นับเป็นวินาที ปัดใกล้สุด', () => {
    expect(ageSeconds(0, 90_000)).toBe(90);
    expect(ageSeconds(0, 1_400)).toBe(1);
  });

  it('เวลาเพี้ยนย้อนหลัง ต้องไม่ติดลบ', () => {
    expect(ageSeconds(10_000, 0)).toBe(0);
  });
});
