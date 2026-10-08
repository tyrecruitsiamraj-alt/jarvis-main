// @vitest-environment node
/**
 * 🔴 หน้าช้าเพราะรอระบบงานหลัก (เจ้าของ 8 ต.ค. 2569 "หน้าอื่นที่ช้าไล่แก้ให้เร็วด้วย")
 * วัดจริง: หน้าติดตาม 5.9 วิ · จับคู่งาน 6.0 วิ = สำเนาใบขอว่าง → ถามระบบงานหลักสด
 * 1. แผนกเดียว = กรองจากสำเนาทุกแผนก (ไม่ถามระบบงานหลักแยกแผนก) · ไม่ครบเพดาน/ปุ่มรีเฟรช = ทางเดิม
 * 2. ตัวอุ่นสำเนา: คีย์ที่มีคนอ่านใน 30 นาที + อายุเกิน 60 วิ = โหลดใหม่เบื้องหลัง · ไม่มีคนใช้ = ไม่ถาม
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const realList = vi.fn();
vi.mock('../../api/_lib/siamrajSqlServer.js', () => ({ getSiamrajSqlServerConfig: () => ({ server: 'x' }) }));
vi.mock('../../api/_lib/siamrajSqlServerRequests.js', async (orig) => ({
  ...(await orig<object>()),
  listSiamrajSqlServerUnitRequests: (...a: unknown[]) => realList(...a),
}));
vi.mock('../../api/_lib/siamrajSqlServerPrequests.js', async (orig) => ({
  ...(await orig<object>()),
  listSiamrajSqlServerPrequests: async () => [],
}));
vi.mock('../../api/_lib/jobSiteMap.js', () => ({ rememberJobSites: async () => {} }));
vi.mock('../../api/_lib/siamrajUnitNotes.js', () => ({ attachLeadRules: async () => {} }));

const { listSiamrajUnitRequests } = await import('../../api/_lib/siamrajUnitRequests');
const cache = await import('../../api/_lib/unitRequestCache');

const job = (id: string, dept: string) => ({ id, department_code: dept, is_prequest: false });

beforeEach(() => {
  cache.clearUnitRequestCache();
  realList.mockReset();
});

describe('แผนกเดียว = กรองจากสำเนาทุกแผนก', () => {
  it('ถามระบบงานหลักครั้งเดียว (ทุกแผนก) แล้วทุกแผนกกรองเอง · ไม่มีแผนก = ไม่เห็นอะไร', async () => {
    realList.mockResolvedValue([job('a', 'LBD'), job('b', 'LBA'), job('c', 'LBD ')]);
    const lbd = await listSiamrajUnitRequests({ limit: 500, departmentScope: { mode: 'code', code: 'LBD' } as never });
    const lba = await listSiamrajUnitRequests({ limit: 500, departmentScope: { mode: 'code', code: 'LBA' } as never });
    const none = await listSiamrajUnitRequests({ limit: 500, departmentScope: { mode: 'none' } as never });
    expect((lbd as Array<{ id: string }>).map((j) => j.id)).toEqual(['a', 'c']);
    expect((lba as Array<{ id: string }>).map((j) => j.id)).toEqual(['b']);
    expect(none).toEqual([]);
    expect(realList).toHaveBeenCalledTimes(1);
    expect((realList.mock.calls[0][0] as { departmentScope: unknown }).departmentScope).toEqual({ mode: 'all' });
  });

  it('🔴 ชุดรวมชนเพดาน (อาจไม่ครบ) = ถามแยกแผนกแบบเดิม', async () => {
    realList.mockImplementation(async (o: { departmentScope: { mode: string } }) =>
      o.departmentScope.mode === 'all' ? [job('a', 'LBD'), job('b', 'LBA')] : [job('z', 'LBD')],
    );
    const lbd = await listSiamrajUnitRequests({ limit: 2, departmentScope: { mode: 'code', code: 'LBD' } as never });
    expect((lbd as Array<{ id: string }>).map((j) => j.id)).toEqual(['z']);
    expect(realList).toHaveBeenCalledTimes(2);
  });

  it('ปุ่มรีเฟรช (fresh) = ถามแผนกนั้นสด ๆ แบบเดิม', async () => {
    realList.mockResolvedValue([job('a', 'LBD')]);
    await listSiamrajUnitRequests({ limit: 500, fresh: true, departmentScope: { mode: 'code', code: 'LBD' } as never });
    expect((realList.mock.calls[0][0] as { departmentScope: unknown }).departmentScope).toEqual({ mode: 'code', code: 'LBD' });
  });
});

describe('ตัวอุ่นสำเนา', () => {
  it('คีย์ที่มีคนอ่านอยู่ + สำเนาเกิน 60 วิ = โหลดใหม่ · ยังสด = ไม่ถาม · ไม่มีคนอ่านเกิน 30 นาที = เลิกถาม', async () => {
    let n = 0;
    const load = async () => [++n];
    await cache.readThroughCache('k', load, { now: 1_000 });
    expect(cache.warmActiveKeysOnce({ activeWithinMs: 1_800_000, refreshAfterMs: 60_000, now: 30_000 })).toBe(0);
    expect(cache.warmActiveKeysOnce({ activeWithinMs: 1_800_000, refreshAfterMs: 60_000, now: 70_000 })).toBe(1);
    await cache.settleUnitRequestRefreshes();
    expect(n).toBe(2);
    expect(cache.warmActiveKeysOnce({ activeWithinMs: 1_800_000, refreshAfterMs: 60_000, now: 1_000 + 1_800_001 })).toBe(0);
  });

  it('เปิดตอนบูต (ปิดได้ด้วย env)', async () => {
    const { readFileSync } = await import('node:fs');
    const boot = readFileSync('server/local-api.ts', 'utf8');
    expect(boot).toContain('startUnitRequestKeepWarm()');
    expect(boot).toContain('UNIT_REQUEST_KEEP_WARM_ENABLED');
  });
});
