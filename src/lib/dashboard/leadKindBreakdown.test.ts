import { describe, expect, it } from 'vitest';
import {
  buildLeadKindBreakdown,
  leadKindMismatchNote,
  LEAD_KIND_ORDER,
} from '@/lib/dashboard/leadKindBreakdown';
import { sumCohortStockByRequestDate, type ThroughputRecord } from '@/lib/dashboard/throughput';

function rec(p: Partial<ThroughputRecord> & { requestDate: string; positionUnits: number }): ThroughputRecord {
  return {
    requestNo: 'OPL6907001',
    departmentCode: 'LBD',
    closureDate: null,
    isOpen: false,
    kind: 'filled',
    leadKind: 'advance',
    ...p,
  };
}

describe('buildLeadKindBreakdown', () => {
  it('แยกสามถังตาม leadKind · นับทั้งอัตราและจำนวนใบ', () => {
    const r = buildLeadKindBreakdown(
      [
        rec({ requestNo: 'A', requestDate: '2026-08-01', positionUnits: 5, leadKind: 'advance' }),
        rec({ requestNo: 'U', requestDate: '2026-08-02', positionUnits: 3, leadKind: 'urgent' }),
        rec({ requestNo: 'R', requestDate: '2026-08-03', positionUnits: 2, leadKind: 'retroactive' }),
      ],
      '2026-08-01',
      '2026-08-31',
    );
    expect(r.totalPositions).toBe(10);
    expect(r.totalRequests).toBe(3);
    expect(r.slices.map((s) => [s.kind, s.positions, s.requests])).toEqual([
      ['retroactive', 2, 1],
      ['urgent', 3, 1],
      ['advance', 5, 1],
    ]);
  });

  it('🔴 ผลรวมสามถังต้องเท่า "ทั้งหมด" เสมอ — ห้ามมีแถวตกหล่น', () => {
    const records = [
      rec({ requestNo: 'A', requestDate: '2026-08-01', positionUnits: 4, leadKind: 'advance' }),
      rec({ requestNo: 'B', requestDate: '2026-08-02', positionUnits: 7, leadKind: 'urgent' }),
      rec({ requestNo: 'C', requestDate: '2026-08-03', positionUnits: 1, leadKind: 'retroactive' }),
      rec({ requestNo: 'D', requestDate: '2026-08-04', positionUnits: 9, leadKind: undefined }),
    ];
    const r = buildLeadKindBreakdown(records, '2026-08-01', '2026-08-31');
    expect(r.slices.reduce((s, x) => s + x.positions, 0)).toBe(r.totalPositions);
    expect(r.totalPositions).toBe(21);
    // 🔴 แถวที่ไม่มี leadKind ต้องตกไปอยู่ "ล่วงหน้า" ไม่ใช่ฉุกเฉิน (4 + 9 = 13)
    expect(r.slices.find((s) => s.kind === 'advance')?.positions).toBe(13);
    expect(r.slices.find((s) => s.kind === 'urgent')?.positions).toBe(7);
  });

  it('🔴 ใบเดียวหลายแถว (ปิด/ยกเลิก/เหลือ) นับใบครั้งเดียว แต่รวมอัตราทุกแถว', () => {
    const r = buildLeadKindBreakdown(
      [
        rec({ requestNo: 'X1', requestDate: '2026-08-01', positionUnits: 4, kind: 'filled', leadKind: 'urgent' }),
        rec({ requestNo: 'X1', requestDate: '2026-08-01', positionUnits: 3, kind: 'cancelled', leadKind: 'urgent' }),
        rec({ requestNo: 'X1', requestDate: '2026-08-01', positionUnits: 3, kind: 'remaining', isOpen: true, leadKind: 'urgent' }),
      ],
      '2026-08-01',
      '2026-08-31',
    );
    expect(r.totalPositions).toBe(10);
    expect(r.totalRequests).toBe(1);
    expect(r.slices.find((s) => s.kind === 'urgent')?.requests).toBe(1);
  });

  it('🔴 ยอดรวมต้องเท่าการ์ด「เข้ามา」เป๊ะ ๆ (แหล่งเดียวกัน)', () => {
    const records = [
      rec({ requestNo: 'A', requestDate: '2026-08-01', positionUnits: 4, leadKind: 'advance' }),
      rec({ requestNo: 'A', requestDate: '2026-08-01', positionUnits: 2, kind: 'cancelled', leadKind: 'advance' }),
      rec({ requestNo: 'B', requestDate: '2026-08-09', positionUnits: 6, leadKind: 'urgent' }),
      // นอกช่วง — ทั้งสองฝั่งต้องไม่นับ
      rec({ requestNo: 'Z', requestDate: '2026-07-31', positionUnits: 99, leadKind: 'urgent' }),
    ];
    const card = sumCohortStockByRequestDate(records, '2026-08-01', '2026-08-31');
    const graph = buildLeadKindBreakdown(records, '2026-08-01', '2026-08-31');
    expect(graph.totalPositions).toBe(card.requestPositions);
    expect(graph.totalRequests).toBe(card.requestCount);
    expect(leadKindMismatchNote(graph, card.requestPositions, card.requestCount)).toBeNull();
  });

  it('เปลี่ยนช่วง (filter) แล้วเลขต้องเปลี่ยนตาม', () => {
    const records = [
      rec({ requestNo: 'JAN', requestDate: '2026-01-10', positionUnits: 5, leadKind: 'urgent' }),
      rec({ requestNo: 'AUG', requestDate: '2026-08-10', positionUnits: 8, leadKind: 'advance' }),
    ];
    const year = buildLeadKindBreakdown(records, '2026-01-01', '2026-12-31');
    expect(year.totalPositions).toBe(13);
    const aug = buildLeadKindBreakdown(records, '2026-08-01', '2026-08-31');
    expect(aug.totalPositions).toBe(8);
    expect(aug.slices.find((s) => s.kind === 'urgent')?.positions).toBe(0);
  });

  it('สัดส่วน % คิดจากอัตรา · ไม่มีข้อมูล = 0 ไม่ใช่ NaN', () => {
    const r = buildLeadKindBreakdown(
      [
        rec({ requestNo: 'A', requestDate: '2026-08-01', positionUnits: 1, leadKind: 'urgent' }),
        rec({ requestNo: 'B', requestDate: '2026-08-01', positionUnits: 3, leadKind: 'advance' }),
      ],
      '2026-08-01',
      '2026-08-31',
    );
    expect(r.slices.find((s) => s.kind === 'urgent')?.percent).toBe(25);
    expect(r.slices.find((s) => s.kind === 'advance')?.percent).toBe(75);
    const empty = buildLeadKindBreakdown([], '2026-08-01', '2026-08-31');
    expect(empty.slices.every((s) => s.percent === 0)).toBe(true);
    expect(empty.totalPositions).toBe(0);
  });

  it('อัตราที่ไม่มีเลขที่ใบยังนับใน total แต่ต้องรายงานแยก', () => {
    const r = buildLeadKindBreakdown(
      [
        rec({ requestNo: undefined, requestDate: '2026-08-01', positionUnits: 6, leadKind: 'urgent' }),
        rec({ requestNo: 'B1', requestDate: '2026-08-01', positionUnits: 2, leadKind: 'urgent' }),
      ],
      '2026-08-01',
      '2026-08-31',
    );
    expect(r.totalPositions).toBe(8);
    expect(r.totalRequests).toBe(1);
    expect(r.positionsWithoutRequestNo).toBe(6);
  });

  it('ทุกถังต้องมีอยู่เสมอแม้เป็น 0 (กราฟไม่ควรหายไปทั้งแท่ง)', () => {
    const r = buildLeadKindBreakdown([], '2026-08-01', '2026-08-31');
    expect(r.slices.map((s) => s.kind)).toEqual([...LEAD_KIND_ORDER]);
  });
});

describe('leadKindMismatchNote — ด่านเช็คว่าข้อมูลตรงไหม', () => {
  const graph = buildLeadKindBreakdown(
    [rec({ requestNo: 'A', requestDate: '2026-08-01', positionUnits: 10, leadKind: 'advance' })],
    '2026-08-01',
    '2026-08-31',
  );

  it('ตรงกัน = null', () => {
    expect(leadKindMismatchNote(graph, 10, 1)).toBeNull();
  });

  it('🔴 ไม่ตรงกับการ์ดต้องขึ้นข้อความ ห้ามเงียบ', () => {
    expect(leadKindMismatchNote(graph, 12, 1)).toContain('การ์ด');
    expect(leadKindMismatchNote(graph, 10, 5)).toContain('การ์ด');
  });
});
