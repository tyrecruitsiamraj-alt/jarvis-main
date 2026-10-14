// @vitest-environment node
/**
 * ถาม Lumos ว่ารับสายใบสมัคร/Match เข้าจริงไหม (เจ้าของ Choice 14 ต.ค. 2569 "บอกครบ + แก้คนที่ตกหล่น")
 * 🔴 ไม่ส่งใหม่เอง ไม่ย้ายให้คน (เจ้าของ 9 ต.ค. 2569) — จด + แจ้งเตือนเท่านั้น
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const getEventStatus = vi.fn();
const getLumosPushConfig = vi.fn(() => ({ baseUrl: 'x' }) as unknown);
const notifyRoles = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({
  getEventStatus: (...a: unknown[]) => getEventStatus(...a),
  getLumosPushConfig: () => getLumosPushConfig(),
}));
vi.mock('../../api/_lib/appNotifications.js', () => ({ notifyRoles: (...a: unknown[]) => notifyRoles(...a) }));

const { checkQueueImports, pendingQueueImportSql } = await import('../../api/_lib/lumosQueueImportWatch.js');

const ROW = { qid: '501', event_id: 'ev-1', person_ref: 'app-1', name: 'ผู้สมัครทดสอบ', stuck: false };

beforeEach(() => {
  dbQuery.mockReset().mockImplementation((sql: string) => Promise.resolve({ rows: /^\s*select/i.test(sql) ? [ROW] : [] }));
  getEventStatus.mockReset();
  notifyRoles.mockReset();
  getLumosPushConfig.mockReturnValue({ baseUrl: 'x' });
});

describe('ถามผลนำเข้า Lumos ของสายใบสมัคร/Match', () => {
  it('ไม่แตะงานติดตาม (มีตัวถามของตัวเอง) · เฉพาะที่ส่งถึงแล้ว รอผล มีเลข event', () => {
    const sql = pendingQueueImportSql();
    expect(sql).toMatch(/job_ref <> 'follow'/);
    expect(sql).toMatch(/push_state = 'pushed'/);
    expect(sql).toMatch(/push_event_id is not null/);
    expect(sql).toMatch(/result is null/);
  });

  it('imported ⇒ จดไว้ ไม่แจ้งเตือน', async () => {
    getEventStatus.mockResolvedValue({ status: 'imported', error: null });
    const r = await checkQueueImports();
    expect(r).toMatchObject({ checked: 1, imported: 1, notImported: 0 });
    const upd = dbQuery.mock.calls.find((c) => /lumos_import_status = \$2/.test(String(c[0])));
    expect(upd?.[1]).toEqual(['501', 'imported', null]);
    expect(notifyRoles).not.toHaveBeenCalled();
  });

  it('failed ⇒ จด + แจ้ง admin/supervisor ครั้งเดียวต่อสาย · ไม่ส่งใหม่ ไม่ย้ายให้คน', async () => {
    getEventStatus.mockResolvedValue({ status: 'failed', error: 'bad phone' });
    const r = await checkQueueImports();
    expect(r.notImported).toBe(1);
    const upd = dbQuery.mock.calls.find((c) => /lumos_import_status = \$2/.test(String(c[0])));
    expect(upd?.[1]).toEqual(['501', 'failed', 'failed · bad phone']);
    expect(notifyRoles).toHaveBeenCalledWith(
      ['admin', 'supervisor'],
      expect.objectContaining({ type: 'queue_not_imported', dedupeKey: 'queue_not_imported:501:ev-1' }),
    );
    const writes = dbQuery.mock.calls.map((c) => String(c[0])).filter((s) => /update/i.test(s));
    expect(writes.every((s) => !/status = 'cancelled'|followup_state|push_state/.test(s))).toBe(true);
  });

  it('🔴 ถามไม่ได้ ⇒ ไม่ตีความว่าล้ม · จดแค่เวลาที่ถาม รอบหน้าถามใหม่', async () => {
    getEventStatus.mockRejectedValue(new Error('fetch failed'));
    const r = await checkQueueImports();
    expect(r).toMatchObject({ checked: 0, notImported: 0 });
    expect(dbQuery.mock.calls.some((c) => /lumos_import_status = \$2/.test(String(c[0])))).toBe(false);
    expect(notifyRoles).not.toHaveBeenCalled();
  });

  it('ไม่มีคีย์ push (เครื่อง dev) ⇒ ไม่ทำอะไร', async () => {
    getLumosPushConfig.mockReturnValue(null);
    await checkQueueImports();
    expect(dbQuery).not.toHaveBeenCalled();
  });
});
