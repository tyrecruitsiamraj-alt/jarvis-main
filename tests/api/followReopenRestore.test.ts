// @vitest-environment node
/**
 * 🔴 ย้อนสถานะปิดงาน = คืนสายที่ถูกหยุดตอนปิดด้วย (เจ้าของ 7 ต.ค. 2569 · ปัญหา Lumos ข้อ 4
 * "เผลอกดสาย 1 จบงาน สาย 2 ถูกยกเลิก กดล้างสถานะแล้วสาย 2 ไม่ย้อน · ต้องการให้ย้อนสถานะทั้ง 2 สายเลย")
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
const SELF = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  dbQuery.mockReset();
  resync.mockReset();
});

describe('อ่าน id ที่ปิดงานหยุดไว้จาก audit', () => {
  it('รับทั้ง object และ string · ทิ้งค่าที่ไม่ใช่ uuid', () => {
    expect(mod.stoppedIdsOf({ stoppedIds: [A, 'x', 3] })).toEqual([A]);
    expect(mod.stoppedIdsOf(JSON.stringify({ stoppedIds: [B] }))).toEqual([B]);
    expect(mod.stoppedIdsOf(null)).toEqual([]);
    expect(mod.stoppedIdsOf('{bad')).toEqual([]);
  });
});

describe('คืนสาย', () => {
  it('🔴 คืนเฉพาะแถวที่ยกเลิกจังหวะเดียวกับการปิด · AI อนาคต = คืนคิว + ส่งแผนใหม่ · AI เลยเวลา/คนโทร = เปิดแถวอย่างเดียว ไม่สลับโหมด', async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("action = 'follow.complete'")) return { rows: [{ new_value: { stoppedIds: [A, B] }, created_at: '2026-10-07T07:00:00Z' }] };
      if (sql.includes('set cancelled_at = null'))
        return { rows: [{ id: A, ai: true, future: true }, { id: B, ai: true, future: false }] };
      if (sql.includes('select id::text as id')) return { rows: [{ id: SELF, ai: false, future: true }] };
      if (sql.includes('distinct on')) return { rows: [{ id: A }] };
      return { rows: [] };
    });
    resync.mockResolvedValue({ rounds: 1, cancelled: true, pushed: true });
    const r = await mod.restoreRoundsStoppedByClose(SELF);
    expect(r).toEqual({ restored: 2, resent: 1 });
    const uncancel = dbQuery.mock.calls.find((c) => String(c[0]).includes('set cancelled_at = null'));
    expect(String(uncancel?.[0])).toContain('< 120');
    const requeue = dbQuery.mock.calls.find((c) => String(c[0]).includes("set status = 'pending'"));
    expect(requeue?.[1]).toEqual([[`follow-${A}`]]);
    expect(String(requeue?.[0])).toContain('first_result_at is null');
    expect(resync).toHaveBeenCalledWith(A, expect.anything());
    expect(dbQuery.mock.calls.some((c) => String(c[0]).includes('call_mode ='))).toBe(false);
  });
  it('ไม่มี audit การปิด = ไม่คืนอะไร ไม่ยิง Lumos', async () => {
    dbQuery.mockImplementation(async (sql: string) =>
      sql.includes('select id::text as id') ? { rows: [{ id: SELF, ai: true, future: false }] } : { rows: [] },
    );
    expect(await mod.restoreRoundsStoppedByClose(SELF)).toEqual({ restored: 0, resent: 0 });
    expect(resync).not.toHaveBeenCalled();
  });
  it('ผูกกับปุ่มย้อนสถานะ', () => {
    const h = readFileSync(new URL('../../api/_handlers/follow.ts', import.meta.url), 'utf8');
    expect(h).toContain('await restoreRoundsStoppedByClose(id)');
  });
});
