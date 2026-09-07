// @vitest-environment node
/**
 * กล่องทีม Lumos บนหน้าแรก — เลนคิวโทรต้องนับด้วย "นิยามกลาง" และบอกของค้างด้วย
 *
 * 🔴 **บั๊กที่เทสต์นี้เกิดมาเพื่อกัน (วัดฐานจริง 7 ก.ย. 2569):**
 * `queueCancelled` ไม่ปิด NULL ⇒ `queueActive` เป็น NULL สำหรับแถวที่ยังไม่มีผล ⇒
 * `count(*) filter` ข้ามทิ้งเงียบ ๆ · เลน Follow จึงขึ้นจอว่า
 * *"ส่งเข้าทั้งหมด 11 · รอโทร 0"* ทั้งที่ของจริงคือ *"ทั้งหมด 22 · รอโทร 11"*
 * (ตรรกะของเงื่อนไขมีเทสต์รันจริงคุมที่ `tests/api/lumosQueueDefs.test.ts` —
 *  ไฟล์นี้คุม **สายไฟ**: handler ต่อ field ครบและใช้เกณฑ์ค้างตัวเดียวกับหน้าอื่น)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn() }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/http.js', async (orig) => {
  const actual = await orig<typeof import('../../api/_lib/http.js')>();
  return { ...actual, withAuth: (h: unknown) => h };
});
vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({
  listSiamrajUnitRequests: vi.fn(async () => []),
}));
vi.mock('../../api/_lib/departmentScope.js', () => ({
  loadMatchingBuScope: vi.fn(async () => null),
}));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { default: handler } = await import('../../api/_handlers/office-team.js');

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, json };
}

/** คิวรีเลนคิวโทร — จำได้จาก `as lane` (ตารางคิวถูกอ้างในคิวรีของทีมสรรหาด้วย) */
const isLaneSql = (sql: string): boolean => sql.includes('as lane');
const laneSql = () =>
  vi
    .mocked(dbQuery)
    .mock.calls.map((c) => String(c[0]))
    .find(isLaneSql) ?? '';

const LANE_ROWS = [
  // เลน Follow ของจริงตอนวัดฐาน: 24 แถว = ยกเลิก 2 + รอโทร 11 (ค้างครบทั้ง 11) + มีผล 11
  { lane: 'follow', n: 22, cancelled: 2, pending: 11, stale_pending: 11, waiting: 0, done: 11 },
  { lane: 'match', n: 40, cancelled: 19, pending: 0, stale_pending: 0, waiting: 0, done: 40 },
];

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  vi.mocked(dbQuery).mockImplementation((async (sql: string) =>
    isLaneSql(String(sql)) ? { rows: LANE_ROWS } : { rows: [] }) as never);
});

describe('เลนคิวโทรบนกล่องทีม', () => {
  it('ส่งจำนวน "รอโทรค้างเกิน 2 วัน" ออกมาให้จอ และเกณฑ์ต้องเป็น 2 วันตัวเดียวกับหน้าอื่น', async () => {
    const { res, json } = mockRes();
    await handler({ method: 'GET', user: { sub: 'u1' }, query: {} } as never, res as never);
    const sql = laneSql();
    expect(sql).toContain('as stale_pending');
    expect(sql).toContain(`interval '2 days'`);
    // ค้างของ "รอโทร" ต้องวัดจากเวลานัดส่ง/เวลาสร้าง ไม่ใช่เวลาที่ Lumos รับไป
    expect(sql).toContain('coalesce(next_attempt_at, created_at)');
    // ทุกถังต้องกรองด้วยเงื่อนไขที่ปิด NULL แล้ว (ต้นเหตุที่ "รอโทร" เคยเป็น 0 ตลอดกาล)
    expect(sql).toContain('coalesce(status = ');
    expect(sql).toContain(', false)');

    const lanes = json.mock.calls[0][0].teams.lumos;
    expect(lanes.follow).toEqual({
      total: 22,
      pending: 11,
      stalePending: 11,
      waiting: 0,
      done: 11,
      cancelled: 2,
    });
    // เลนที่ไม่มีของค้างต้องเป็น 0 ไม่ใช่ undefined (จอเช็ค > 0 ก่อนวาดแถว)
    expect(lanes.match.stalePending).toBe(0);
    // เลนที่ไม่มีแถวเลยยังต้องมี field ครบ
    expect(lanes.public.stalePending).toBe(0);
  });

  it('"ส่งเข้าทั้งหมด" = รอโทร + รอผลกลับ + ได้ผลแล้ว เสมอ (คนใหม่บวกเองได้)', async () => {
    const { res, json } = mockRes();
    await handler({ method: 'GET', user: { sub: 'u2' }, query: {} } as never, res as never);
    const lanes = json.mock.calls[0][0].teams.lumos;
    for (const key of ['follow', 'match', 'public'] as const) {
      const l = lanes[key];
      expect(l.pending + l.waiting + l.done, key).toBe(l.total);
    }
  });
});
