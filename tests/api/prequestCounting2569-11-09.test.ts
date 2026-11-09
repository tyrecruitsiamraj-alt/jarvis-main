// @vitest-environment node
/**
 * ใบขอชั่วคราว (ใบขอล่วงหน้า ERP) นับทุกหน้า (เจ้าของ 9 พ.ย. 2569 "ทุกหน้านับใบขอชั่วคราวหมด" · "ปิดแล้วก็นับไปที่ปิดแล้วไง")
 * อยู่ในสมุดใบขอตัวเดียวกับหน้าหลัก ⇒ หน้าหลัก · ใบขอเข้ามา · ภาพรวมงานสรรหา ได้เลขเดียวกัน
 * ถูกทำเป็นใบจริง = ใบชั่วคราวปิดแล้ว + ใบจริงขอใหม่ ⇒ เหลือหาไม่เพี้ยน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPenaltyLedger, ledgerJobIdOf, PREQUEST_LEDGER_PREFIX, requestFlow, type PenaltyRequestRow } from '@/lib/requestPenaltyLedger';
import { onlineRequestStateOf } from '@/lib/homeOnline';

const base = (p: Partial<PenaltyRequestRow>): PenaltyRequestRow => ({
  requestNo: 'OPL6911003',
  site: 'LBD001',
  bu: 'LBD',
  unit: 'หน่วยงาน',
  position: 'พนักงานขับรถ',
  qty: 1,
  keyYmd: '2026-11-03',
  needYmd: '2026-11-10',
  endYmd: null,
  workDays: null,
  finePerDay: 0,
  deductPerDay: 0,
  ...p,
});
const pre = (no: string, p: Partial<PenaltyRequestRow> = {}) => base({ requestNo: `${PREQUEST_LEDGER_PREFIX}${no}`, site: '', prequest: true, informedCap: 0, ...p });

describe('ใบขอชั่วคราวในสมการ', () => {
  it('เปิด = ขอใหม่ + เหลือหา · ERP ปิด = ปิดแล้ว (ไม่ใช่ยกเลิก) · คนไม่นับเป็นหาได้', () => {
    const rows = [pre('OPL6911003'), pre('OPL6911004', { endYmd: '2026-11-05' })];
    const f = requestFlow(buildPenaltyLedger(rows, [], '2026-11-09', { from: '2026-11-03', to: '2026-11-09' }, {}).requests, '2026-11-03', '2026-11-09');
    expect([f.newRequests, f.closedRequests, f.cancelledRequests, f.remainingRequests]).toEqual([2, 1, 0, 1]);
    expect(f.filled).toBe(0);
  });
  it('ทำเป็นใบจริง: ชั่วคราวปิดแล้ว + ใบจริงขอใหม่ ⇒ เหลือหาเท่าเดิม · เลขซ้ำกันไม่ปนกัน (id คนละตัว)', () => {
    const rows = [pre('OPL6911003', { endYmd: '2026-11-06' }), base({ keyYmd: '2026-11-06' })];
    const led = buildPenaltyLedger(rows, [], '2026-11-09', { from: '2026-11-03', to: '2026-11-09' }, {}).requests;
    const f = requestFlow(led, '2026-11-03', '2026-11-09');
    expect([f.newRequests, f.closedRequests, f.remainingRequests]).toEqual([2, 1, 1]);
    expect(led.map(ledgerJobIdOf).sort()).toEqual(['siamraj-pre:OPL6911003', 'siamraj-sql:OPL6911003']);
  });
  it('หน้าใบขอเข้ามา: ใบชั่วคราวจบแล้ว = ปิดแล้ว', () => {
    expect(onlineRequestStateOf({ filled: 0, cancelled: 0, remaining: 0, prequest: true })).toBe('fullyClosed');
    expect(onlineRequestStateOf({ filled: 0, cancelled: 1, remaining: 0 })).toBe('cancelledAll');
  });
  it('ตัวโหลด: สมุดใบขอดึงใบขอชั่วคราว · ใบขอเข้ามาเติมจากสมุดชุดเดียวกัน ไม่อ่านข้อมูลใบจริงของเลขซ้ำ', () => {
    expect(readFileSync('api/_lib/siamrajPenaltyLedgerSql.ts', 'utf8')).toContain('FROM st_prequest_head h');
    const online = readFileSync('api/_lib/homeOnlineSql.ts', 'utf8');
    expect(online).toContain('.filter((r) => r.prequest && r.keyYmd >= opts.from && r.keyYmd <= opts.to)');
    expect(online).toContain('const x = g.prequest ? undefined : extras.get(g.requestNo);');
  });
});
