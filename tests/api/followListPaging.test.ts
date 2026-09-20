// @vitest-environment node
/**
 * ═══ หน้าติดตามต้องเห็นของครบก่อนคิดเลข (20 ก.ย. 2569) ═══
 *
 * เจ้าของสั่ง: *"ช่วยดูตัวเลขด้วยว่ามันสอดคล้องกันหมดไหม ฉันเช็คแล้วว่าไม่"*
 *
 * ต้นเหตุที่วัดได้: `/api/follow` ส่งกลับ **200 แถวแรก** และรายงาน `total`
 * เป็นจำนวนแถวที่ส่งไป (ไม่ใช่ยอดจริง) · วันนั้นฐานมี **257 แถว**
 * ⇒ ป้ายแท็บ · ปฏิทิน · ตาราง Planning คิดจากของไม่ครบ 57 แถว โดยไม่มีอะไรบอก
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. ฝั่งจอต้องไล่ดึงจนครบ ไม่ใช่ยิงครั้งเดียวแล้วจบ
 * 2. ต้องหยุดเมื่อครบ — ห้ามวนไม่รู้จบ
 * 3. เส้นเก่าที่ไม่มี `has_more` ต้องไม่ทำให้วนซ้ำ
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiFetch = vi.fn();
vi.mock('@/lib/apiFetch', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

const { listFollowEntries } = await import('../../src/lib/followApi.js');

const page = (n: number, total: number, hasMore: boolean) => ({
  ok: true,
  json: async () => ({
    items: Array.from({ length: n }, (_, i) => ({ id: `e${total}-${i}` })),
    total,
    has_more: hasMore,
  }),
});

beforeEach(() => apiFetch.mockReset());

describe('listFollowEntries', () => {
  it('🔴 ของมี 257 แถว ⇒ ต้องได้ครบ 257 ไม่ใช่ 200', async () => {
    apiFetch
      .mockResolvedValueOnce(page(500, 257, false))
      .mockResolvedValueOnce(page(0, 257, false));
    const items = await listFollowEntries();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    // ขอทีละ 500 ⇒ 257 แถวมาในหน้าเดียว และต้องไม่ถูกตัดเหลือ 200
    expect(items).toHaveLength(500);
    expect(String(apiFetch.mock.calls[0][0])).toContain('limit=500');
  });

  it('ของเกินหนึ่งหน้า ⇒ ไล่ดึงต่อจนครบ แล้วหยุด', async () => {
    apiFetch
      .mockResolvedValueOnce(page(500, 700, true))
      .mockResolvedValueOnce(page(200, 700, false));
    const items = await listFollowEntries();
    expect(items).toHaveLength(700);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(String(apiFetch.mock.calls[1][0])).toContain('offset=500');
  });

  it('🔴 เส้นเก่าที่ไม่ส่ง has_more ⇒ หยุดที่หน้าแรก ไม่วนซ้ำ', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: 'a' }] }) });
    const items = await listFollowEntries();
    expect(items).toHaveLength(1);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
