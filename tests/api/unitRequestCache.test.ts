import { beforeEach, describe, expect, it } from 'vitest';

import {
  ageSeconds,
  clearUnitRequestCache,
  readThroughCache,
  settleUnitRequestRefreshes,
  unitRequestCacheSize,
  unitRequestRefreshCount,
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

  /**
   * 🔴 เดิมเทสต์นี้ยิง `now: 200_000` แล้วคาดว่าได้ `live` — **แก้ค่าเป็นเกินเพดาน 10 นาที**
   * เพราะ 200 วินาทีตอนนี้ตกอยู่ในช่วง "ตอบของเก่าก่อนแล้วเติมของใหม่" (ข้อ 4)
   * ไม่ใช่ช่วงที่ต้องรอโหลดจริงอีกต่อไป · พฤติกรรมช่วงนั้นมีเทสต์ของตัวเองข้างล่าง
   */
  it('เกินเพดานอายุแล้วต้องกลับไปรอโหลดจริง', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return calls;
    };
    await readThroughCache('k', load, { now: 0 });
    const second = await readThroughCache('k', load, { now: 700_000 });
    expect(second.source).toBe('live');
    expect(second.value).toBe(2);
    expect(calls).toBe(2);
    expect(unitRequestRefreshCount()).toBe(0);
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
    // เกินเพดาน 10 นาที ⇒ เดินเส้นรอโหลดจริง แล้วโหลดล้ม = ตกมาที่กติกาข้อ 2
    const out = await readThroughCache<string[]>(
      'k',
      async () => {
        throw new Error('Timeout: Request failed to complete in 60000ms');
      },
      { now: 700_000 },
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

/**
 * ═══ ข้อ 4 — ตอบของเก่าก่อน แล้วเติมของใหม่เบื้องหลัง (Wave 3.1 · 5 ก.ย. 2569) ═══
 *
 * ปัญหาที่แก้: คนแรกหลังสำเนาหมดอายุต้องรอเอง 4.4 วินาทีแทนคนทั้งออฟฟิศ
 * 🔴 กติกาที่ต้องคุมไว้: ตอบทันที · อายุที่บอกต้องเป็นอายุจริง (ห้ามโกหกว่าสด) ·
 * โหลดเบื้องหลังตัวเดียวต่อคีย์ · เกินเพดานอายุแล้วกลับไปรอโหลดจริง
 */
describe('🔴 ของเก่าตอบไปก่อน แล้วเติมของใหม่เบื้องหลัง', () => {
  beforeEach(() => clearUnitRequestCache());

  it('เกินอายุแต่ยังไม่เกินเพดาน = ตอบสำเนาเดิมทันที ไม่รอโหลด', async () => {
    let calls = 0;
    let released: (() => void) | null = null;
    const load = async () => {
      calls += 1;
      if (calls > 1) await new Promise<void>((r) => (released = r));
      return `รอบที่ ${calls}`;
    };

    await readThroughCache('k', load, { now: 0 });
    // 200 วินาที = เกิน TTL 90 วินาที แต่ยังไม่ถึงเพดาน 10 นาที
    const out = await readThroughCache<string>('k', load, { now: 200_000 });

    expect(out.source).toBe('stale-revalidating');
    expect(out.value).toBe('รอบที่ 1');
    // 🔴 อายุที่ส่งกลับต้องเป็นของสำเนาเดิม — ไม่งั้น header บอกว่าข้อมูลสดทั้งที่ไม่สด
    expect(out.fetchedAt).toBe(0);
    // โหลดใหม่ถูกยิงแล้วและ **ยังไม่จบ** ตอนที่เราตอบไป
    expect(calls).toBe(2);
    expect(unitRequestRefreshCount()).toBe(1);

    released!();
    await settleUnitRequestRefreshes();
  });

  it('คนถัดไปได้ของใหม่ที่โหลดเบื้องหลังมาให้', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return `รอบที่ ${calls}`;
    };
    await readThroughCache('k', load, { now: 0 });
    await readThroughCache('k', load, { now: 200_000 });
    await settleUnitRequestRefreshes();

    const next = await readThroughCache<string>('k', load, { now: 200_100 });
    expect(next.value).toBe('รอบที่ 2');
    expect(next.source).toBe('cache');
    expect(calls).toBe(2);
  });

  it('หลายคนเปิดพร้อมกัน = โหลดเบื้องหลังตัวเดียว ไม่ยิงซ้อน', async () => {
    let calls = 0;
    let released: (() => void) | null = null;
    const load = async () => {
      calls += 1;
      if (calls > 1) await new Promise<void>((r) => (released = r));
      return calls;
    };
    await readThroughCache('k', load, { now: 0 });

    const many = await Promise.all([
      readThroughCache<number>('k', load, { now: 200_000 }),
      readThroughCache<number>('k', load, { now: 200_001 }),
      readThroughCache<number>('k', load, { now: 200_002 }),
    ]);

    expect(many.map((m) => m.source)).toEqual([
      'stale-revalidating',
      'stale-revalidating',
      'stale-revalidating',
    ]);
    expect(calls).toBe(2); // ครั้งแรก + โหลดเบื้องหลัง 1 ตัว
    expect(unitRequestRefreshCount()).toBe(1);

    released!();
    await settleUnitRequestRefreshes();
  });

  it('🔴 โหลดเบื้องหลังล้ม = สำเนาเดิมยังอยู่ครบ ไม่มีใครเห็นจอพัง', async () => {
    await readThroughCache('k', async () => ['ของจริง'], { now: 0 });
    const out = await readThroughCache<string[]>(
      'k',
      async () => {
        throw new Error('ต่อไม่ติด');
      },
      { now: 200_000 },
    );
    expect(out.value).toEqual(['ของจริง']);
    await settleUnitRequestRefreshes();

    const again = await readThroughCache<string[]>('k', async () => ['ของใหม่'], { now: 200_100 });
    expect(again.value).toEqual(['ของจริง']);
    expect(again.fetchedAt).toBe(0);
    await settleUnitRequestRefreshes();
  });

  it('fresh = ข้ามทางลัดนี้ ไปรอโหลดจริงเสมอ (ปุ่มรีเฟรชต้องได้ของสด)', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return calls;
    };
    await readThroughCache('k', load, { now: 0 });
    const forced = await readThroughCache<number>('k', load, { now: 200_000, fresh: true });
    expect(forced.source).toBe('live');
    expect(forced.value).toBe(2);
    expect(unitRequestRefreshCount()).toBe(0);
  });
});

/**
 * ═══ สำเนาเย็น + คนเปิดพร้อมกัน = ไปถามระบบงานหลักรอบเดียว ═══
 *
 * ตอนบูตใหม่ ตัวอุ่นสำเนา (`warmSiamrajUnitRequestsCache`) กับคนแรกที่เปิดจอ
 * ยิงคีย์เดียวกันพร้อมกัน — ถ้าไม่รวมคิว ระบบงานหลักโดนสองรอบและคนแรกไม่ได้ประโยชน์เลย
 */
describe('🔴 ไม่มีสำเนาแล้วคนแตะพร้อมกัน = ถามระบบงานหลักรอบเดียว', () => {
  beforeEach(() => clearUnitRequestCache());

  it('สามคนขอพร้อมกัน = โหลดครั้งเดียว ทุกคนได้ของชุดเดียวกัน', async () => {
    let calls = 0;
    let released: (() => void) | null = null;
    const load = async () => {
      calls += 1;
      await new Promise<void>((r) => (released = r));
      return { รอบ: calls };
    };

    const all = Promise.all([
      readThroughCache('k', load, { now: 1_000 }),
      readThroughCache('k', load, { now: 1_010 }),
      readThroughCache('k', load, { now: 1_020 }),
    ]);
    await Promise.resolve();
    await Promise.resolve();
    released!();

    const out = await all;
    expect(calls).toBe(1);
    expect(out.map((o) => o.source)).toEqual(['live', 'live', 'live']);
    expect(out.map((o) => o.value)).toEqual([{ รอบ: 1 }, { รอบ: 1 }, { รอบ: 1 }]);
    expect(unitRequestRefreshCount()).toBe(0);
  });

  it('🔴 โหลดรอบเดียวนั้นล้ม = ทุกคนที่รอต้องเห็นว่าพัง ห้ามได้ลิสต์ว่าง', async () => {
    const load = async () => {
      throw new Error('ต่อไม่ติด');
    };
    const results = await Promise.allSettled([
      readThroughCache('ยังไม่เคยมี', load, { now: 1_000 }),
      readThroughCache('ยังไม่เคยมี', load, { now: 1_010 }),
    ]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(unitRequestRefreshCount()).toBe(0);
  });

  it('load ที่โยน error แบบ synchronous ต้องไม่ทำให้ธงค้าง', async () => {
    await expect(
      readThroughCache('k', () => {
        throw new Error('พังตั้งแต่ยังไม่ทันเรียก');
      }),
    ).rejects.toThrow('พังตั้งแต่ยังไม่ทันเรียก');
    expect(unitRequestRefreshCount()).toBe(0);
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
