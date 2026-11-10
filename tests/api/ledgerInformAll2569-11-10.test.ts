// @vitest-environment node
/**
 * ใบที่ ERP ปิดเพราะ "แจ้งเข้าครบ" ต้องเป็นปิดครบ ไม่ใช่ยกเลิก (ตรวจทั้งระบบ 10 พ.ย. 2569 · เจ้าของเลือกแก้ข้อ 3)
 * เดิม: วันปิดใบ = update_date แต่หาได้นับจากวันเริ่มงาน ⇒ คนที่เริ่มงานหลังวันปิดใบกลายเป็นยกเลิก (63/185 ใบตั้งแต่ 1 ก.ย.)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPenaltyLedger, requestFlow, requestFlowRole, type PenaltyInform, type PenaltyRequestRow } from '@/lib/requestPenaltyLedger';

const TODAY = '2026-11-10';
const row = (p: Partial<PenaltyRequestRow>): PenaltyRequestRow => ({
  requestNo: 'OPL6911005',
  site: 'LBD001',
  bu: 'LBD',
  unit: 'หน่วยงาน',
  position: 'พนักงานขับรถ',
  qty: 2,
  keyYmd: '2026-11-01',
  needYmd: '2026-11-05',
  endYmd: '2026-11-03',
  workDays: null,
  finePerDay: 0,
  deductPerDay: 0,
  ...p,
});
// แจ้งเข้า 2 คน: คนแรกเริ่ม 2 พ.ย. คนที่สองเริ่ม 10 พ.ย. (หลังวันที่ ERP ปิดใบ 3 พ.ย.)
const informs: PenaltyInform[] = [
  { requestNo: 'OPL6911005', startYmd: '2026-11-02', recordYmd: '2026-11-01', qty: 1 },
  { requestNo: 'OPL6911005', startYmd: '2026-11-10', recordYmd: '2026-11-03', qty: 1 },
];
const range = { from: '2026-11-01', to: TODAY };

describe('แจ้งเข้าครบ = ปิดครบ', () => {
  it('ERP ติ๊กแจ้งเข้าครบ: ปิดครบ 1 ใบ · หาได้ 2 · ยกเลิก 0 แม้คนสุดท้ายเริ่มงานหลังวันปิดใบ', () => {
    const [r] = buildPenaltyLedger([row({ endedFull: true })], informs, TODAY, range, {}).requests;
    const role = requestFlowRole(r, range.from, range.to);
    expect([role.closed, role.cancelledReq, role.filled, role.cancelled, role.remaining]).toEqual([true, false, 2, 0, 0]);
    const f = requestFlow([r], range.from, range.to);
    expect(f.carryInRequests + f.newRequests - f.closedRequests - f.cancelledRequests).toBe(f.remainingRequests);
    expect(f.carryIn + f.newPositions - f.filled - f.cancelled).toBe(f.remaining);
  });
  it('ใบที่ Stop/ยกเลิกจริง (ไม่ได้แจ้งเข้าครบ) ยังเป็นยกเลิกเหมือนเดิม', () => {
    const [r] = buildPenaltyLedger([row({ endedFull: false })], informs.slice(0, 1), TODAY, range, {}).requests;
    const role = requestFlowRole(r, range.from, range.to);
    expect([role.closed, role.cancelledReq, role.filled, role.cancelled]).toEqual([false, true, 1, 1]);
  });
  it('แจ้งเข้าครบแต่ปิดหลังปลายช่วง = ยังเหลือหาในช่วงนั้น (ไม่นับปิดล่วงหน้า)', () => {
    const [r] = buildPenaltyLedger([row({ endedFull: true, endYmd: '2026-11-20' })], informs, TODAY, range, {}).requests;
    const role = requestFlowRole(r, '2026-11-01', '2026-11-05');
    expect([role.closed, role.cancelledReq, role.remaining]).toEqual([false, false, 1]);
  });
  it('ที่มา: SQL ส่ง ended_full จาก is_inform_all เฉพาะใบที่ไม่ได้ Stop/ยกเลิก', () => {
    const sql = readFileSync('api/_lib/siamrajPenaltyLedgerSql.ts', 'utf8');
    expect(sql).toContain("WHEN ISNULL(A.is_inform_all, 'N') = 'Y' THEN 1");
    expect(sql).toContain('endedFull: Number(r.ended_full) === 1,');
  });
});
