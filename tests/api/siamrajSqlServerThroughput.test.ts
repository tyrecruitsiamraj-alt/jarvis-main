import { describe, it, expect, vi } from 'vitest';

/** จับ SQL ที่ส่งไป ERP — ไม่ต่อ MSSQL จริง / ไม่แตะ pg จริง */
const sqlSeen: string[] = [];
vi.mock('../../api/_lib/siamrajSqlServer.js', () => ({
  siamrajSqlQuery: vi.fn(async (sql: string) => {
    sqlSeen.push(sql);
    return [];
  }),
}));
vi.mock('../../api/_lib/siamrajUnitNotes.js', () => ({
  getLeadRulesOverrideMap: vi.fn(async () => new Map()),
}));

import {
  isOpenStaffingRow,
  listSiamrajSqlServerThroughput,
} from '../../api/_lib/siamrajSqlServerThroughput.js';

describe('isOpenStaffingRow (feed)', () => {
  it('treats active requests without inform as open', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'N', stop_no: null, request_qty: 2, effective_inform_qty: 0 }),
    ).toBe(true);
  });

  it('keeps partial informs open on the board', () => {
    expect(
      isOpenStaffingRow({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        is_inform_all: 'N',
        request_qty: 4,
        inform_qty: 3,
        effective_inform_qty: 3,
        has_inform: 1,
      }),
    ).toBe(true);
  });

  it('keeps partial when effective count comes from inform_head', () => {
    expect(
      isOpenStaffingRow({
        status: 'A',
        is_stop: 'N',
        stop_no: null,
        is_inform_all: 'N',
        request_qty: 4,
        inform_qty: 0,
        effective_inform_qty: 3,
        has_inform: 1,
      }),
    ).toBe(true);
  });

  it('treats stopped requests as closed', () => {
    expect(
      isOpenStaffingRow({ status: 'A', is_stop: 'Y', stop_no: 'CLS001', request_qty: 1, effective_inform_qty: 0 }),
    ).toBe(false);
  });
});

/**
 * 🔴 24–27 ก.ย. 2569 เส้นนี้ตอบ 500 "activeInformWhereSql is not defined" ทุกครั้ง
 * (ไฟล์ส่งต่อชื่อด้วย `export { … } from` แต่ไม่ได้ import มาใช้เอง) ⇒ Dashboard ขอ/ปิด + พยากรณ์พัง
 * เทสต์เดิมทดสอบแต่ฟังก์ชัน pure จึงไม่มีใครเห็น — ด่านนี้เรียกตัวดึงจริงให้ประกอบ SQL ทั้งก้อน
 */
describe('listSiamrajSqlServerThroughput — ประกอบ SQL ได้จริง', () => {
  it('ไม่ระเบิด และกรองใบแจ้งเข้าที่ยกเลิกออก (status = A)', async () => {
    sqlSeen.length = 0;
    await expect(
      listSiamrajSqlServerThroughput({ from: '2026-09-01', to: '2026-09-27' }),
    ).resolves.toEqual([]);
    expect(sqlSeen).toHaveLength(1);
    expect(sqlSeen[0]).toContain("IH.status = 'A'");
  });
});
