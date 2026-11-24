import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cancelReasonBreakdown,
  cancelReasonEquation,
  canTagCancelReason,
  effectiveCancelReason,
  pickableCancelReasons,
  type CancelReasonMaster,
} from '../../src/lib/requestCancelReason';
import { buildCohortDrillDown } from '../../src/lib/dashboard/cohortDrillDown';
import { buildCohortLeadPanel } from '../../src/lib/dashboard/statusLeadPanel';
import { minimumRoleFor } from '../../api/_lib/rbac';

/** เหตุผลยกเลิกใบขอ (เจ้าของ 24 พ.ย. 2569) — สมการคงเดิม · กดเลขยกเลิกแล้วแยก ได้คนแล้ว / ยกเลิกจริง / ไม่ได้กรอกเหตุผล */
const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

// รายการกลางหน้าตาเหมือนของจริง (รหัส ERP st_ms_stop_by + ข้อที่ทีมเพิ่ม)
const masters: CancelReasonMaster[] = [
  { id: 4, label: 'เวียนกำลังคนในไซต์', gotPerson: true, erpCode: '04', active: true, sortOrder: 40 },
  { id: 6, label: 'ลูกค้ายกเลิก(ไม่เอาคนแล้ว)', gotPerson: false, erpCode: '11', active: true, sortOrder: 60 },
  { id: 7, label: 'เลือกจาก WL', gotPerson: true, erpCode: '12', active: true, sortOrder: 70 },
  { id: 10, label: 'เลือกจาก พนง.Site', gotPerson: true, erpCode: '15', active: true, sortOrder: 100 },
  { id: 11, label: 'ยกเลิกโดย-สยามราช', gotPerson: false, erpCode: '16', active: true, sortOrder: 110 },
  { id: 12, label: 'ย้ายคนจากไซต์อื่น', gotPerson: true, erpCode: null, active: true, sortOrder: 120 },
  { id: 13, label: 'หน่วยงานปิดไซต์', gotPerson: false, erpCode: null, active: false, sortOrder: 130 },
];
const tag = (requestNo: string, reasonId: number) => ({ requestNo, reasonId, byName: 'มาย', at: '2026-11-24T03:00:00.000Z' });

describe('ใบไหนทีมใส่เหตุผลได้', () => {
  it('ERP ไม่มีเหตุผล หรือเป็น "ยกเลิกโดย-สยามราช" เท่านั้น', () => {
    expect(canTagCancelReason(null)).toBe(true);
    expect(canTagCancelReason('  ')).toBe(true);
    expect(canTagCancelReason('16')).toBe(true);
    expect(canTagCancelReason('12')).toBe(false);
    expect(canTagCancelReason('15')).toBe(false);
  });
});

describe('เหตุผลที่ใช้จริงของใบ', () => {
  it('ใบที่ ERP ไม่มีเหตุผล + ทีมใส่ = ของทีม พร้อมชื่อคนใส่', () => {
    const r = effectiveCancelReason({ code: null, name: null }, tag('OPL6911083', 12), masters);
    expect(r).toMatchObject({ label: 'ย้ายคนจากไซต์อื่น', group: 'got_person', source: 'team', taggable: true, reasonId: 12, byName: 'มาย' });
  });
  it('"ยกเลิกโดย-สยามราช" ทีมใส่ทับได้ · ไม่ใส่ = ยกเลิกจริงตาม ERP', () => {
    expect(effectiveCancelReason({ code: '16', name: 'ยกเลิกโดย-สยามราช' }, tag('LBM6910001', 7), masters)).toMatchObject({ label: 'เลือกจาก WL', group: 'got_person', source: 'team' });
    expect(effectiveCancelReason({ code: '16', name: 'ยกเลิกโดย-สยามราช' }, null, masters)).toMatchObject({ label: 'ยกเลิกโดย-สยามราช', group: 'cancelled', source: 'erp', taggable: true });
  });
  it('ERP บอกเหตุผลชัดแล้ว = ใช้ของ ERP แม้มีของทีมค้างอยู่ (เลขสองชุดไม่ขัดกัน)', () => {
    expect(effectiveCancelReason({ code: '15', name: 'เลือกจาก พนง.Site' }, tag('DSO6910002', 6), masters)).toMatchObject({ label: 'เลือกจาก พนง.Site', group: 'got_person', source: 'erp', taggable: false });
  });
  it('รหัส ERP ที่ไม่อยู่ในรายการ = ยกเลิกจริง · ไม่มีอะไรเลย = ไม่ได้กรอกเหตุผล', () => {
    expect(effectiveCancelReason({ code: '99', name: null }, null, masters)).toMatchObject({ label: 'รหัส 99', group: 'cancelled' });
    expect(effectiveCancelReason({}, null, masters)).toMatchObject({ label: 'ไม่ได้กรอกเหตุผล', group: 'none', source: 'none' });
  });
  it('ติ๊ก "นับว่าได้คนแล้ว" ในรายการกลาง เปลี่ยนกลุ่มของใบที่ ERP ใส่รหัสนั้น', () => {
    const off = masters.map((m) => (m.erpCode === '12' ? { ...m, gotPerson: false } : m));
    expect(effectiveCancelReason({ code: '12', name: 'เลือกจาก WL' }, null, off).group).toBe('cancelled');
  });
});

describe('แยกยอดยกเลิก — ผลรวมเท่ากล่องที่กด', () => {
  const rows = [
    { reason: effectiveCancelReason({ code: '12', name: 'เลือกจาก WL' }, null, masters), positions: 2 },
    { reason: effectiveCancelReason({ code: '15', name: 'เลือกจาก พนง.Site' }, null, masters), positions: 3 },
    { reason: effectiveCancelReason({ code: '11', name: 'ลูกค้ายกเลิก(ไม่เอาคนแล้ว)' }, null, masters), positions: 1 },
    { reason: effectiveCancelReason({ code: null }, tag('OPL1', 12), masters), positions: 1 },
    { reason: effectiveCancelReason({ code: null }, null, masters), positions: 2 },
  ];
  const b = cancelReasonBreakdown(rows);
  it('ได้คนแล้ว + ยกเลิกจริง + ไม่ได้กรอกเหตุผล = ทั้งหมด (อัตราและใบ)', () => {
    expect(b.total).toEqual({ requests: 5, positions: 9 });
    expect(b.groups.got_person.positions + b.groups.cancelled.positions + b.groups.none.positions).toBe(b.total.positions);
    expect(b.groups.got_person.requests + b.groups.cancelled.requests + b.groups.none.requests).toBe(b.total.requests);
    expect(b.reasons.reduce((n, r) => n + r.positions, 0)).toBe(b.total.positions);
    expect(cancelReasonEquation(b)).toBe('ยกเลิก 9 = ได้คนแล้ว 6 + ยกเลิกจริง 1 + ไม่ได้กรอกเหตุผล 2');
  });
  it('รายเหตุผลเรียง ได้คนแล้ว → ยกเลิกจริง → ไม่ได้กรอก · ในกลุ่มมากไปน้อย', () => {
    expect(b.reasons.map((r) => r.label)).toEqual(['เลือกจาก พนง.Site', 'เลือกจาก WL', 'ย้ายคนจากไซต์อื่น', 'ลูกค้ายกเลิก(ไม่เอาคนแล้ว)', 'ไม่ได้กรอกเหตุผล']);
  });
  it('ว่าง = 0 ทุกกลุ่ม (กล่องไม่หาย)', () => {
    expect(cancelReasonEquation(cancelReasonBreakdown([]))).toBe('ยกเลิก 0 = ได้คนแล้ว 0 + ยกเลิกจริง 0 + ไม่ได้กรอกเหตุผล 0');
  });
});

describe('ตัวเลือกตอนใส่เหตุผล', () => {
  it('ไม่มีข้อที่เลิกใช้ และไม่มี "ยกเลิกโดย-สยามราช" · ได้คนแล้วขึ้นก่อน', () => {
    const p = pickableCancelReasons(masters).map((m) => m.label);
    expect(p).not.toContain('ยกเลิกโดย-สยามราช');
    expect(p).not.toContain('หน่วยงานปิดไซต์');
    expect(p.slice(0, 4)).toEqual(['เวียนกำลังคนในไซต์', 'เลือกจาก WL', 'เลือกจาก พนง.Site', 'ย้ายคนจากไซต์อื่น']);
  });
});

describe('รหัสเหตุผลจาก ERP ไปถึงรายการใบบน Dashboard', () => {
  it('ใบเดียวหลายแถว (ยกเลิก + หาได้) — เอาเหตุผลจากแถวไหนก็ได้ที่มี · แผงเก็บเลขดิบไว้ใส่เหตุผล', () => {
    const base = { requestNo: 'OPL6911083', jobId: 'siamraj-sql:OPL6911083', requestDate: '2026-11-23', closureDate: '2026-11-24', isOpen: false };
    const drill = buildCohortDrillDown(
      [
        { ...base, positionUnits: 1, kind: 'filled' as const },
        { ...base, positionUnits: 2, kind: 'cancelled' as const, stopCode: '12', stopReason: 'เลือกจาก WL' },
      ],
      '2026-11-01',
      '2026-11-30',
      'cancelled',
    );
    expect(drill.rows[0]).toMatchObject({ positions: 2, stopCode: '12', stopReason: 'เลือกจาก WL' });
    const panel = buildCohortLeadPanel(drill.rows, () => ({ job: null, inFeed: false }));
    expect(panel.rows[0]).toMatchObject({ rawRequestNo: 'OPL6911083', stopCode: '12', amount: 2 });
  });
});

describe('สิทธิ์ · เส้น · ตาราง', () => {
  it('ทุกคนอ่านและใส่บนใบได้ · แก้รายการกลางเฉพาะ admin', () => {
    expect(minimumRoleFor('request-cancel-reasons', 'GET')).toBe('staff');
    expect(minimumRoleFor('request-cancel-reasons', 'PUT')).toBe('staff');
    expect(minimumRoleFor('request-cancel-reasons', 'POST')).toBe('admin');
    expect(minimumRoleFor('request-cancel-reasons', 'PATCH')).toBe('admin');
    expect(read('api/_handlers/registry.ts')).toContain("'/api/request-cancel-reasons': requestCancelReasonsHandler");
  });
  it('migration เพิ่มอย่างเดียว · ตั้งต้น 11 ข้อของ ERP ติ๊กได้คนแล้ว 4 ข้อ', () => {
    const sql = read('migrations/197_request_cancel_reasons.sql');
    expect(sql).not.toMatch(/^\s*(drop|delete|update|alter|truncate)\b/im);
    const seeds = [...sql.matchAll(/\('([^']+)', (true|false), '(\d{2})', \d+\)/g)];
    expect(seeds).toHaveLength(11);
    expect(seeds.filter((m) => m[2] === 'true').map((m) => m[3])).toEqual(['04', '12', '13', '15']);
  });
  it('หน้าหลัก/ภาพรวม/ผู้ช่วย AI อ่านเหตุผลที่ทีมใส่ผ่าน home-money', () => {
    expect(read('api/_handlers/home-money.ts')).toContain('await withCancelReasonTags(');
  });
});
