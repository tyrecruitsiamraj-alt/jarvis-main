// @vitest-environment node
/** ใบขอปิด/Stop/ยกเลิกใน ERP ต้องหายจากจอทันที ไม่รอสำเนาหมดอายุ (เจ้าของ 19 ต.ค. 2569 "ถ้าปิดก็คือปิด" · OPL6909079) */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isClosedBySignals } from '../../api/_lib/recentlyClosedRequests';

describe('ธงปิดในหัวใบขอ', () => {
  it('Stop / มีเลข stop / สถานะไม่ใช่ A / แจ้งเข้าครบ = ปิด · ที่เหลือยังเปิด', () => {
    const open = { status: 'A', is_stop: 'N', stop_no: null, is_inform_all: 'P' };
    expect(isClosedBySignals(open)).toBe(false);
    expect(isClosedBySignals({ ...open, is_stop: 'Y' })).toBe(true);
    expect(isClosedBySignals({ ...open, stop_no: 'ST001' })).toBe(true);
    expect(isClosedBySignals({ ...open, status: 'C' })).toBe(true);
    expect(isClosedBySignals({ ...open, is_inform_all: 'Y' })).toBe(true);
    expect(isClosedBySignals({ ...open, is_stop: null })).toBe(false);
  });
  it('ตัดทั้งสองชั้นสำเนา (ในตัวรายการ + ชั้นนอกของหน้าใบขอ) · ใบล่วงหน้าไม่แตะ', () => {
    const lib = readFileSync('api/_lib/siamrajUnitRequests.ts', 'utf8');
    expect(lib).toContain('return dropClosedFromCache(outcome);');
    expect(lib).toContain('(j) => j.is_prequest || !closed.has(');
    expect(readFileSync('api/_handlers/siamraj-unit-requests.ts', 'utf8')).toContain(
      '.then(async (outcome) => ({ ...outcome, value: await dropClosedFromCache(outcome) }));',
    );
  });
});
