// @vitest-environment node
/**
 * 🔴 ย้อนยกเลิก (เจ้าของ 16 ต.ค. 2569: "กดผิดอะแก้ไขจากหน้า Ui ได้ไหม" → Choice ปุ่ม "ย้อนยกเลิก" ในป๊อปจัดการ)
 * เคสจริง: กดยกเลิกทั้งชุด 14 สาย (19–27 ต.ค.) ผิดคน · เดิมย้อนได้แค่ "ปิดงาน" ยกเลิกแล้วย้อนไม่ได้
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const resync = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({ getLumosPushConfig: () => ({ url: 'x' }) }));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({ resyncFollowPlanWithLumos: (...a: unknown[]) => resync(...a) }));
vi.mock('../../api/_lib/followStaffName.js', () => ({ staffNameOfPhone: vi.fn() }));

const mod = await import('../../api/_lib/followReopenRestore');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const CANCEL_AT = '2026-10-16T06:06:00Z';
const LATER = new Date('2026-10-16T09:00:00Z');

beforeEach(() => {
  dbQuery.mockReset();
  resync.mockReset();
});

describe('restoreCancelledFollow', () => {
  it('🔴 คืนทุกสายที่ยกเลิกในการกดครั้งเดียวกัน (cancelledIds ของ audit) · AI อนาคต = คืนคิว + ส่งแผนใหม่', async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("action = 'follow.cancel'")) return { rows: [{ entity_id: A, new_value: { scope: 'person', cancelledIds: [A, B, C] }, created_at: CANCEL_AT }] };
      if (sql.includes('set cancelled_at = null')) return { rows: [{ id: A, ai: true, future: true }, { id: B, ai: true, future: true }, { id: C, ai: false, future: true }] };
      if (sql.includes('distinct on')) return { rows: [{ id: A }] };
      return { rows: [] };
    });
    resync.mockResolvedValue({ rounds: 2, cancelled: false, pushed: true });
    const r = await mod.restoreCancelledFollow(B, LATER);
    expect(r).toEqual({ restored: 3, resent: 2 });
    const uncancel = dbQuery.mock.calls.find((c) => String(c[0]).includes('set cancelled_at = null'));
    expect(uncancel?.[1]).toEqual([[A, B, C], new Date(CANCEL_AT).toISOString()]);
    // แถวที่ยกเลิกทีหลังด้วยเหตุอื่นไม่แตะ (เวลาห่างจาก audit เกิน 2 นาที) · ปิดงานแล้วไม่แตะ
    expect(String(uncancel?.[0])).toContain('< 120');
    expect(String(uncancel?.[0])).toContain('completed_at is null');
    const requeue = dbQuery.mock.calls.find((c) => String(c[0]).includes("set status = 'pending'"));
    expect(requeue?.[1]).toEqual([[`follow-${A}`, `follow-${B}`]]);
    expect(resync).toHaveBeenCalledWith(A, expect.anything());
  });

  it('🔴 เพิ่งยกเลิกไม่ถึง 2 นาที = ยังไม่คืน (กติกา Lumos: ส่งแผนเบอร์เดิมหลัง DELETE ไม่กี่วินาที = รับแต่ไม่โทร)', async () => {
    dbQuery.mockImplementation(async (sql: string) =>
      sql.includes("action = 'follow.cancel'") ? { rows: [{ entity_id: A, new_value: { cancelledIds: [A] }, created_at: CANCEL_AT }] } : { rows: [] },
    );
    const r = await mod.restoreCancelledFollow(A, new Date(Date.parse(CANCEL_AT) + 60_000));
    expect(r.tooSoon).toBe(true);
    expect(dbQuery.mock.calls.some((c) => String(c[0]).includes('set cancelled_at = null'))).toBe(false);
    expect(resync).not.toHaveBeenCalled();
  });

  it('ยกเลิกสายเดียว (audit ไม่มี cancelledIds) = คืนสายนั้น · ไม่มี audit = คืนสายนั้นอย่างเดียว', async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("action = 'follow.cancel'")) return { rows: [{ entity_id: C, new_value: JSON.stringify({ id: C }), created_at: CANCEL_AT }] };
      if (sql.includes('set cancelled_at = null')) return { rows: [{ id: C, ai: true, future: false }] };
      return { rows: [] };
    });
    expect(await mod.restoreCancelledFollow(C, LATER)).toEqual({ restored: 1, resent: 0 });
    const uncancel = dbQuery.mock.calls.find((c) => String(c[0]).includes('set cancelled_at = null'));
    expect(uncancel?.[1]?.[0]).toEqual([C]);
    // AI เลยเวลาแล้ว = เปิดแถวอย่างเดียว ไม่ส่ง Lumos (เวลาที่ผ่านแล้ว = โทรทันที)
    expect(resync).not.toHaveBeenCalled();
  });
});

describe('ต่อสายครบ', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  it('PATCH action=uncancel · ยังไม่ยกเลิก/ปิดงานแล้ว = 400 · เพิ่งยกเลิก = 409 · จด audit', () => {
    const h = read('api/_handlers/follow.ts');
    expect(h).toContain("if (action === 'uncancel') return await uncancelFollow(req, res);");
    expect(h).toContain("sendError(res, 409, 'Conflict', 'เพิ่งยกเลิกไป รอสัก 2 นาทีแล้วกดใหม่')");
    expect(h).toContain("action: 'follow.uncancel'");
  });
  it('ป๊อปจัดการมีปุ่ม "ย้อนยกเลิก" บนสายที่ยกเลิก (ยังไม่ปิดงาน) · หน้าติดตามต่อสายถึง server', () => {
    const d = read('src/components/follow/FollowRoundsDialog.tsx');
    expect(d).toContain('{it.cancelled && !it.completed_at ? (');
    expect(d).toContain("{busy ? 'กำลังย้อน…' : 'ย้อนยกเลิก'}");
    expect(read('src/pages/follow/FollowPage.tsx')).toContain('onUncancel={(id) => void doUncancel(id)}');
  });
});
