// @vitest-environment node
/**
 * แจ้งเตือนในแอป (migration 072) — contract ของกล่องขาเข้ารายคน
 *
 * ทำไมต้องมีเทสต์ชุดนี้เป็นพิเศษ: **ฝั่งสร้างกลืน error เงียบทั้งหมดโดยตั้งใจ**
 * (แจ้งเตือนเป็นของแถม ห้ามทำให้ ingest ผลโทร/สร้างชุดส่งล้ม) ผลข้างเคียงคือ
 * ถ้าใครแก้จนพัง **จะไม่มีสัญญาณอะไรเลย** — ไม่มี error ไม่มี log
 * เจ้าหน้าที่แค่ "ไม่ได้รับแจ้งเตือน" แล้วงานค้างอยู่เฉย ๆ โดยไม่มีใครรู้ว่าทำไม
 * เทสต์จึงเป็นด่านเดียวที่จับได้
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

import { dbQuery } from '../../api/_lib/postgres.js';
import {
  listMyNotifications,
  markNotificationsRead,
  notifyRoles,
  notifyUsers,
} from '../../api/_lib/appNotifications.js';

const undefinedTable = Object.assign(new Error('relation does not exist'), { code: '42P01' });
const otherDbError = Object.assign(new Error('connection terminated'), { code: '57P01' });

function sqlOf(i: number) {
  return String(vi.mocked(dbQuery).mock.calls[i]?.[0] ?? '');
}
function paramsOf(i: number) {
  return (vi.mocked(dbQuery).mock.calls[i]?.[1] ?? []) as unknown[];
}

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  vi.mocked(dbQuery).mockResolvedValue({ rows: [] } as never);
});

describe('notifyUsers — ตัวสร้างต้องไม่ทำให้งานหลักล้มไม่ว่าอะไรจะเกิด', () => {
  it('ตารางยังไม่ migrate ก็ไม่โยน error', async () => {
    vi.mocked(dbQuery).mockRejectedValueOnce(undefinedTable);
    await expect(notifyUsers(['u1'], { type: 'x', title: 'ชื่อ' })).resolves.toBeUndefined();
  });

  it('DB ล้มด้วยเหตุอื่นก็ยังไม่โยน — งานหลักต้องไปต่อได้', async () => {
    vi.mocked(dbQuery).mockRejectedValueOnce(otherDbError);
    await expect(notifyUsers(['u1'], { type: 'x', title: 'ชื่อ' })).resolves.toBeUndefined();
  });

  it('ไม่มีผู้รับ = ไม่แตะ DB เลย (กันยิงคิวรีเปล่า)', async () => {
    await notifyUsers([], { type: 'x', title: 'ชื่อ' });
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('ผู้รับซ้ำ/ค่าว่างถูกตัดทิ้งก่อนเขียน — คนเดียวต้องไม่ได้ 2 ใบ', async () => {
    await notifyUsers(['u1', 'u1', '', 'u2'], { type: 'x', title: 'ชื่อ' });
    expect(paramsOf(0)[0]).toEqual(['u1', 'u2']);
  });

  it('กันซ้ำต่อคนต่อเหตุการณ์ด้วย dedupe_key — Lumos ยิงผลเดิมซ้ำต้องไม่เด้งซ้ำ', async () => {
    await notifyUsers(['u1'], { type: 'call', title: 'สนใจงาน', dedupeKey: 'queue-42' });
    const sql = sqlOf(0);
    expect(sql).toMatch(/on conflict \(recipient_user_id, dedupe_key\)/);
    expect(sql).toMatch(/do nothing/);
    expect(paramsOf(0)[5]).toBe('queue-42');
  });

  it('ไม่ส่ง dedupeKey = เก็บเป็น null (ไม่ใช่ string ว่าง ซึ่งจะกันซ้ำผิดคน)', async () => {
    await notifyUsers(['u1'], { type: 'x', title: 'ชื่อ' });
    expect(paramsOf(0)[5]).toBeNull();
    expect(paramsOf(0)[3]).toBeNull();
    expect(paramsOf(0)[4]).toBeNull();
  });
});

describe('notifyRoles — fan-out ตอนสร้าง', () => {
  it('แจ้งเฉพาะคนที่ยัง active ใน role ที่ระบุ', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({ rows: [{ id: 'a' }, { id: 'b' }] } as never);
    await notifyRoles(['admin', 'supervisor'], { type: 'batch', title: 'ชุดรออนุมัติ' });
    expect(sqlOf(0)).toMatch(/is_active = true/);
    expect(paramsOf(0)[0]).toEqual(['admin', 'supervisor']);
    expect(paramsOf(1)[0]).toEqual(['a', 'b']);
  });

  it('ไม่มี role = ไม่แตะ DB', async () => {
    await notifyRoles([], { type: 'x', title: 'ชื่อ' });
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('ไม่มีใครใน role นั้น = ไม่เขียนแถวแจ้งเตือน', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({ rows: [] } as never);
    await notifyRoles(['admin'], { type: 'x', title: 'ชื่อ' });
    expect(dbQuery).toHaveBeenCalledTimes(1);
  });

  it('อ่าน users ล้มก็ไม่โยน', async () => {
    vi.mocked(dbQuery).mockRejectedValueOnce(otherDbError);
    await expect(notifyRoles(['admin'], { type: 'x', title: 'ชื่อ' })).resolves.toBeUndefined();
  });
});

describe('listMyNotifications — ฝั่งอ่านกลืนเฉพาะ 42P01 (ต่างจากฝั่งสร้าง)', () => {
  it('เห็นเฉพาะของตัวเอง และนับที่ยังไม่อ่าน', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({
      rows: [
        { id: 2, type: 'a', title: 'ใหม่', body: null, link: null, created_at: 'T2', read_at: null },
        { id: 1, type: 'b', title: 'เก่า', body: 'x', link: '/f', created_at: 'T1', read_at: 'T9' },
      ],
    } as never);
    const out = await listMyNotifications('me');
    expect(sqlOf(0)).toMatch(/where recipient_user_id = \$1/);
    expect(paramsOf(0)[0]).toBe('me');
    expect(out.unread).toBe(1);
    expect(out.items.map((i) => i.id)).toEqual([2, 1]);
    expect(out.items[1].readAt).toBe('T9');
  });

  it('ตารางยังไม่ migrate = กล่องว่าง ไม่พัง', async () => {
    vi.mocked(dbQuery).mockRejectedValueOnce(undefinedTable);
    await expect(listMyNotifications('me')).resolves.toEqual({ items: [], unread: 0 });
  });

  it('DB ล้มด้วยเหตุอื่น **ต้องโยนต่อ** — ไม่งั้นเข้าใจผิดว่าไม่มีแจ้งเตือน', async () => {
    vi.mocked(dbQuery).mockRejectedValueOnce(otherDbError);
    await expect(listMyNotifications('me')).rejects.toThrow();
  });

  it('limit ถูกบีบให้อยู่ในช่วง 1–100 เสมอ', async () => {
    await listMyNotifications('me', 9999);
    expect(paramsOf(0)[1]).toBe(100);
    vi.mocked(dbQuery).mockClear();
    await listMyNotifications('me', 0);
    expect(paramsOf(0)[1]).toBe(1);
  });
});

describe('markNotificationsRead', () => {
  it('ระบุ id = อ่านเฉพาะแถวนั้นของตัวเอง', async () => {
    await markNotificationsRead('me', [4, 5]);
    expect(sqlOf(0)).toMatch(/id = any/);
    expect(paramsOf(0)).toEqual(['me', [4, 5]]);
  });

  it('ไม่ระบุ id = อ่านหมดทุกแถวของตัวเอง (ต้องมี where เจ้าของเสมอ)', async () => {
    await markNotificationsRead('me');
    expect(sqlOf(0)).toMatch(/where recipient_user_id = \$1/);
    expect(sqlOf(0)).not.toMatch(/id = any/);
    expect(paramsOf(0)).toEqual(['me']);
  });

  it('ids ว่างเปล่าถือเป็น "อ่านหมด" ไม่ใช่ยิงคิวรีที่ไม่ตรงแถวไหนเลย', async () => {
    await markNotificationsRead('me', []);
    expect(sqlOf(0)).not.toMatch(/id = any/);
  });

  it('ตารางยังไม่ migrate = เงียบ · DB ล้มเหตุอื่น = โยนต่อ', async () => {
    vi.mocked(dbQuery).mockRejectedValueOnce(undefinedTable);
    await expect(markNotificationsRead('me')).resolves.toBeUndefined();
    vi.mocked(dbQuery).mockRejectedValueOnce(otherDbError);
    await expect(markNotificationsRead('me')).rejects.toThrow();
  });
});
