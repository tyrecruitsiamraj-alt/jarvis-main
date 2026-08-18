import { describe, expect, it } from 'vitest';
import {
  buildRequestKeySet,
  needsRequestScopeFilter,
  scopeDropNote,
  scopeThroughputByRequestKeys,
  type ScopeFilterState,
} from '@/lib/dashboard/throughputScope';
import { assigneeRequestKeys, UNASSIGNED_FILTER_VALUE } from '@/lib/dashboard/throughputScope';
import type { ThroughputRecord } from '@/lib/dashboard/throughput';

const allAll: ScopeFilterState = {
  unitFilter: 'all',
  jobSubtypeFilter: 'all',
  recruiterFilter: 'all',
  screenerFilter: 'all',
  oplFilter: 'all',
  urgencyFilter: 'all',
  noteFilter: 'all',
  ageDaysFilter: 'all',
  statusFilter: 'all',
};

const rec = (p: Partial<ThroughputRecord> & { requestDate: string; positionUnits: number }): ThroughputRecord => ({
  requestNo: 'OPL6907001',
  closureDate: null,
  isOpen: false,
  kind: 'filled',
  ...p,
});

describe('needsRequestScopeFilter', () => {
  it('ไม่เลือกอะไรเลย = ไม่ต้องกรองด้วยรายการใบ', () => {
    expect(needsRequestScopeFilter(allAll)).toBe(false);
  });

  it('🔴 เลือกเจ้าหน้าที่สรรหา/คัดสรร/OPL = ต้องกรอง', () => {
    expect(needsRequestScopeFilter({ ...allAll, recruiterFilter: 'คิว' })).toBe(true);
    expect(needsRequestScopeFilter({ ...allAll, screenerFilter: 'ตี้' })).toBe(true);
    expect(needsRequestScopeFilter({ ...allAll, oplFilter: 'เอ' })).toBe(true);
  });

  it('ตัวกรองอื่นก็ต้องกรองเหมือนกัน', () => {
    expect(needsRequestScopeFilter({ ...allAll, unitFilter: 'ฮอนด้า' })).toBe(true);
    expect(needsRequestScopeFilter({ ...allAll, jobSubtypeFilter: 'driver' })).toBe(true);
    expect(needsRequestScopeFilter({ ...allAll, urgencyFilter: 'urgent' })).toBe(true);
    expect(needsRequestScopeFilter({ ...allAll, noteFilter: 'has' })).toBe(true);
    expect(needsRequestScopeFilter({ ...allAll, ageDaysFilter: '1-7' })).toBe(true);
    expect(needsRequestScopeFilter({ ...allAll, statusFilter: 'closed' })).toBe(true);
  });
});

describe('buildRequestKeySet', () => {
  it('เก็บทั้งเลขดิบ (externalId) และเลขที่โชว์ (request_no)', () => {
    const set = buildRequestKeySet([{ externalId: '6907001', request_no: 'OPL6907001' }]);
    expect(set.has('6907001')).toBe(true);
    expect(set.has('OPL6907001')).toBe(true);
  });

  it('ถอด prefix จาก id เต็มมาเก็บด้วย (บางเส้นไม่ตั้ง externalId)', () => {
    const set = buildRequestKeySet([{ id: 'siamraj-sql:LAO6907002' }]);
    expect(set.has('LAO6907002')).toBe(true);
  });

  it('ค่าว่าง/ช่องว่างล้วนไม่ถูกเก็บ (ไม่งั้น key ว่างจับคู่มั่ว)', () => {
    const set = buildRequestKeySet([{ externalId: '  ', request_no: '', id: '' }]);
    expect(set.size).toBe(0);
  });
});

describe('scopeThroughputByRequestKeys', () => {
  const records = [
    rec({ requestNo: 'A1', requestDate: '2026-08-01', positionUnits: 5 }),
    rec({ requestNo: 'B2', requestDate: '2026-08-02', positionUnits: 3 }),
    rec({ requestNo: undefined, requestDate: '2026-08-03', positionUnits: 7 }),
  ];

  it('allowed = null → ไม่กรอง คืนครบ (โหมดไม่เลือกตัวกรอง)', () => {
    const r = scopeThroughputByRequestKeys(records, null);
    expect(r.records).toHaveLength(3);
    expect(r.droppedPositions).toBe(0);
  });

  it('🔴 เก็บเฉพาะใบในชุด · ใบนอกชุดถูกตัดและนับยอดที่ตัดไว้', () => {
    const r = scopeThroughputByRequestKeys(records, new Set(['A1']));
    expect(r.records.map((x) => x.requestNo)).toEqual(['A1']);
    expect(r.droppedPositions).toBe(10); // B2 (3) + ไม่มีเลขที่ใบ (7)
  });

  it('🔴 แถวที่ไม่มีเลขที่ใบต้องถูกตัดเสมอเมื่อมีตัวกรอง (ไม่ใช่ใบของคนที่เลือก)', () => {
    const r = scopeThroughputByRequestKeys(
      [rec({ requestNo: undefined, requestDate: '2026-08-01', positionUnits: 4 })],
      new Set(['A1']),
    );
    expect(r.records).toEqual([]);
    expect(r.droppedPositions).toBe(4);
  });

  it('ใบเดียวหลายแถว (ปิด/ยกเลิก/เหลือ) ถูกเก็บครบทุกแถว', () => {
    const multi = [
      rec({ requestNo: 'X', requestDate: '2026-08-01', positionUnits: 2, kind: 'filled' }),
      rec({ requestNo: 'X', requestDate: '2026-08-01', positionUnits: 1, kind: 'cancelled' }),
      rec({ requestNo: 'X', requestDate: '2026-08-01', positionUnits: 3, kind: 'remaining', isOpen: true }),
    ];
    const r = scopeThroughputByRequestKeys(multi, new Set(['X']));
    expect(r.records).toHaveLength(3);
    expect(r.droppedPositions).toBe(0);
  });

  it('ชุดว่าง = ตัดหมด แต่ต้องรายงานยอดครบ ไม่ใช่หายเงียบ', () => {
    const r = scopeThroughputByRequestKeys(records, new Set());
    expect(r.records).toEqual([]);
    expect(r.droppedPositions).toBe(15);
  });
});

describe('scopeDropNote', () => {
  it('ไม่มีอะไรถูกตัด = null', () => {
    expect(scopeDropNote(0)).toBeNull();
    expect(scopeDropNote(-3)).toBeNull();
  });

  it('มีของถูกตัด = บอกจำนวน', () => {
    expect(scopeDropNote(25)).toContain('25');
  });
});

describe('assigneeRequestKeys — กรองตามเจ้าหน้าที่จากตารางมอบหมายทั้งตาราง', () => {
  const rows = [
    { request_no: 'A1', recruiter_name: 'คิว', screener_name: null, opl_name: null, online_name: null },
    { request_no: 'A2', recruiter_name: 'คิว', screener_name: 'ครีม', opl_name: null, online_name: null },
    { request_no: 'B1', recruiter_name: 'กร', screener_name: null, opl_name: null, online_name: null },
    { request_no: '  ', recruiter_name: 'คิว', screener_name: null, opl_name: null, online_name: null },
  ];
  const base = { recruiterFilter: 'all', screenerFilter: 'all', oplFilter: 'all' };

  it('ไม่เลือกใคร = null (ไม่ต้องกรอง)', () => {
    expect(assigneeRequestKeys(rows, base)).toBeNull();
  });

  it('🔴 เลือก "คิว" ได้ใบของคิวทั้งหมด รวมใบที่ปิดไปแล้ว', () => {
    const keys = assigneeRequestKeys(rows, { ...base, recruiterFilter: 'คิว' });
    expect([...(keys ?? [])].sort()).toEqual(['A1', 'A2']);
  });

  it('เลือกสองบทบาทพร้อมกัน = ต้องตรงทั้งคู่', () => {
    const keys = assigneeRequestKeys(rows, { ...base, recruiterFilter: 'คิว', screenerFilter: 'ครีม' });
    expect([...(keys ?? [])]).toEqual(['A2']);
  });

  it('เลขที่ใบว่างไม่ถูกเก็บ', () => {
    const keys = assigneeRequestKeys(rows, { ...base, recruiterFilter: 'คิว' });
    expect(keys?.has('')).toBe(false);
    expect(keys?.has('  ')).toBe(false);
  });

  it('🔴 "ยังไม่ถูก Assign" ตอบจากตารางนี้ไม่ได้ → null ให้ถอยไปใช้ชุดจาก jobs', () => {
    expect(
      assigneeRequestKeys(rows, { ...base, recruiterFilter: UNASSIGNED_FILTER_VALUE }),
    ).toBeNull();
  });

  it('ไม่มีใครตรง = set ว่าง (ไม่ใช่ null — null แปลว่าไม่กรอง)', () => {
    const keys = assigneeRequestKeys(rows, { ...base, recruiterFilter: 'ไม่มีคนนี้' });
    expect(keys).not.toBeNull();
    expect(keys?.size).toBe(0);
  });
});
