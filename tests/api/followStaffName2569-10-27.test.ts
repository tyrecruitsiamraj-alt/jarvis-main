/**
 * ชื่อเจ้าหน้าที่จากเบอร์ (บทแนะนำตัวของ AI) — หน้าผู้ใช้งานก่อน ความจำเดิมเป็นทางถอย (27 ต.ค. 2569)
 * เจอจริง: ความจำเดิมมีแถว "ครีม" = เบอร์ของอ้อแอ้ ⇒ AI แนะนำตัวผิดคน
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));

import { staffNameOfPhone } from '../../api/_lib/followStaffName';

beforeEach(() => dbQuery.mockReset());

describe('staffNameOfPhone', () => {
  it('หน้าผู้ใช้งานมีชื่อเดียว = ใช้ชื่อนั้น ไม่อ่านความจำเดิม', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ name: 'อ้อแอ้' }] });
    expect(await staffNameOfPhone('+66614142141')).toBe('อ้อแอ้');
    expect(dbQuery).toHaveBeenCalledTimes(1);
    expect(String(dbQuery.mock.calls[0][0])).toMatch(/from .*users/);
    expect(dbQuery.mock.calls[0][1]).toEqual(['614142141']);
  });

  it('ไม่มีในหน้าผู้ใช้งาน / มีหลายชื่อ = ใช้ความจำเดิม', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ name: 'ครีม' }] });
    expect(await staffNameOfPhone('0614073657')).toBe('ครีม');
    dbQuery.mockResolvedValueOnce({ rows: [{ name: 'ก' }, { name: 'ข' }] }).mockResolvedValueOnce({ rows: [] });
    expect(await staffNameOfPhone('0901978774')).toBeNull();
  });

  it('เบอร์สั้นเกิน = null ไม่ค้น', async () => {
    expect(await staffNameOfPhone('123')).toBeNull();
    expect(dbQuery).not.toHaveBeenCalled();
  });
});
