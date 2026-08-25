import { describe, expect, it } from 'vitest';

import {
  SLA_CELL_ORDER,
  buildSlaByLeadKind,
  filterRecordsForLeadKind,
  filterRecordsForSlaCell,
} from '@/lib/dashboard/slaByLeadKind';
import type { RequestControlRecord } from '@/lib/requestControl';
import type { SlaStatus } from '@/lib/jobSla';
import type { JobRequest } from '@/types';

/**
 * ตาราง SLA แยกชนิดใบขอ (เจ้าของสั่ง "บอกด้วยว่าปิดทัน/ไม่ทัน อย่างละกี่ใบ")
 *
 * ที่ต้องล็อกไว้:
 * 1. **แถวบวกได้เท่ายอดแถว** — sum-check แบบเดียวกับ leadKindBreakdown/overview
 * 2. **ชนิดใบขอต้องมาจากเส้นแบ่งเดียวของระบบ** (7 วัน) ไม่ใช่คิดใหม่ในไฟล์นี้
 * 3. ใบที่คิด SLA ไม่ได้ต้องไปอยู่ถัง unknown ไม่ใช่หายไปจากตาราง
 * 4. "ปิดทัน %" ต้องหารด้วย **ใบที่ปิดแล้ว** ไม่ใช่ทั้งแถว (ไม่มีใบปิด = null ไม่ใช่ 0%)
 */

const TODAY = new Date('2026-08-22T10:00:00+07:00');

/** ใบขอปลอมที่กำหนด lead ได้: requiredDate − requestDate */
function rec(
  id: string,
  requestDate: string,
  requiredDate: string | null,
  slaStatus?: SlaStatus,
  controlStatus: RequestControlRecord['controlStatus'] = 'open',
): RequestControlRecord {
  const job = {
    id,
    request_no: id,
    request_date: requestDate,
    submittedAt: requestDate,
    required_date: requiredDate,
  } as unknown as JobRequest;
  return {
    id,
    requestNo: id,
    requestDate,
    requiredDate,
    slaStatus,
    controlStatus,
    job,
  } as RequestControlRecord;
}

// lead 20 วัน = ล่วงหน้า · lead 3 วัน = ฉุกเฉิน · required ก่อน request = ย้อนหลัง
const advance = (id: string, s?: SlaStatus, cs?: RequestControlRecord['controlStatus']) =>
  rec(id, '2026-07-01', '2026-07-21', s, cs);
const urgent = (id: string, s?: SlaStatus, cs?: RequestControlRecord['controlStatus']) =>
  rec(id, '2026-07-01', '2026-07-04', s, cs);
const retro = (id: string, s?: SlaStatus, cs?: RequestControlRecord['controlStatus']) =>
  rec(id, '2026-07-10', '2026-07-01', s, cs);

describe('slaByLeadKind — โครงตาราง', () => {
  it('มีแถวครบ 3 ชนิด เรียงเร่งด่วนก่อน', () => {
    const t = buildSlaByLeadKind([], TODAY);
    expect(t.rows.map((r) => r.kind)).toEqual(['retroactive', 'urgent', 'advance']);
    expect(t.rows.map((r) => r.label)).toEqual(['ฉุกเฉิน/ย้อนหลัง', 'ฉุกเฉิน', 'ล่วงหน้า']);
  });

  it('ไม่มีข้อมูล → ทุกช่อง 0 · ไม่มีคอลัมน์ไหนโชว์ (กันตารางโล่ง)', () => {
    const t = buildSlaByLeadKind([], TODAY);
    expect(t.visibleCells).toEqual([]);
    expect(t.totalRow.total).toBe(0);
    expect(t.totalRow.onTimeRatePercent).toBeNull();
  });

  it('แถวบวกได้เท่ายอดของแถว และแถวรวม = ผลบวกทุกแถว', () => {
    const t = buildSlaByLeadKind(
      [
        retro('R1', 'closed_late'),
        retro('R2', 'breached'),
        urgent('U1', 'closed_on_time'),
        urgent('U2', 'at_risk'),
        urgent('U3', 'on_track'),
        advance('A1', 'closed_on_time'),
        advance('A2'), // ไม่มี slaStatus → unknown
      ],
      TODAY,
    );
    for (const row of [...t.rows, t.totalRow]) {
      const sum = SLA_CELL_ORDER.reduce((n, k) => n + row.cells[k], 0);
      expect(sum, `${row.label} บวกไม่เท่ายอดแถว`).toBe(row.total);
    }
    expect(t.totalRow.total).toBe(7);
    expect(t.rows.map((r) => r.total)).toEqual([2, 3, 2]);
  });

  it('ใบที่คิด SLA ไม่ได้ ไปอยู่ถัง unknown ไม่หายจากตาราง', () => {
    const t = buildSlaByLeadKind([advance('A1'), advance('A2')], TODAY);
    const row = t.rows.find((r) => r.kind === 'advance')!;
    expect(row.cells.unknown).toBe(2);
    expect(row.total).toBe(2);
    expect(t.visibleCells).toContain('unknown');
  });
});

describe('slaByLeadKind — ปิดทัน / ไม่ทัน (คำถามของเจ้าของ)', () => {
  it('นับ "อย่างละกี่ใบ" แยกตามชนิดใบขอ', () => {
    const t = buildSlaByLeadKind(
      [
        retro('R1', 'closed_on_time'),
        retro('R2', 'closed_late'),
        retro('R3', 'closed_late'),
        urgent('U1', 'closed_on_time'),
        advance('A1', 'closed_on_time'),
        advance('A2', 'closed_on_time'),
        advance('A3', 'closed_late'),
      ],
      TODAY,
    );
    const byKind = Object.fromEntries(t.rows.map((r) => [r.kind, r]));
    expect(byKind.retroactive.cells.closed_on_time).toBe(1);
    expect(byKind.retroactive.cells.closed_late).toBe(2);
    expect(byKind.urgent.cells.closed_on_time).toBe(1);
    expect(byKind.advance.cells.closed_on_time).toBe(2);
    expect(byKind.advance.cells.closed_late).toBe(1);
    expect(t.totalRow.cells.closed_on_time).toBe(4);
    expect(t.totalRow.cells.closed_late).toBe(3);
  });

  it('% ปิดทัน หารด้วยใบที่ปิดแล้วเท่านั้น — ยังไม่มีใบปิด = null ไม่ใช่ 0', () => {
    const closedMix = buildSlaByLeadKind(
      [retro('R1', 'closed_on_time'), retro('R2', 'closed_late'), retro('R3', 'breached')],
      TODAY,
    );
    const row = closedMix.rows.find((r) => r.kind === 'retroactive')!;
    // ปิดแล้ว 2 ใบ (ทัน 1 ไม่ทัน 1) → 50% · ใบ breached ไม่เข้าตัวหาร
    expect(row.closed).toBe(2);
    expect(row.onTimeRatePercent).toBe(50);

    const openOnly = buildSlaByLeadKind([urgent('U1', 'at_risk')], TODAY);
    expect(openOnly.rows.find((r) => r.kind === 'urgent')!.onTimeRatePercent).toBeNull();
  });
});

describe('slaByLeadKind — ใบที่ยกเลิก (บั๊กที่เจอตอนตรวจงาน 22 ส.ค. 2569)', () => {
  it('ใบยกเลิกเข้าถัง "ยกเลิก" ไม่ใช่ "ยังไม่ปิด · เกินแล้ว"', () => {
    // computeJobSla ตอบ closed_* เฉพาะ fully_closed → ใบยกเลิกที่เลยกำหนดจะได้ slaStatus
    // เป็น breached ถ้าไม่ดักด้วย controlStatus (นี่คือบั๊กที่ทำให้ช่องเกินแล้วกระโดด 200 → 1,582)
    const t = buildSlaByLeadKind(
      [
        retro('C1', 'breached', 'cancelled_full'),
        retro('C2', 'breached', 'cancelled_full'),
        retro('B1', 'breached', 'open'),
      ],
      TODAY,
    );
    const row = t.rows.find((r) => r.kind === 'retroactive')!;
    expect(row.cells.cancelled).toBe(2);
    expect(row.cells.breached).toBe(1);
    expect(row.total).toBe(3);
  });

  it('ใบยกเลิกไม่นับเป็น "ปิดแล้ว" → ไม่ไปกวน % ปิดทัน', () => {
    const t = buildSlaByLeadKind(
      [urgent('K1', 'breached', 'cancelled_full'), urgent('K2', 'closed_on_time', 'fully_closed')],
      TODAY,
    );
    const row = t.rows.find((r) => r.kind === 'urgent')!;
    expect(row.closed).toBe(1);
    expect(row.onTimeRatePercent).toBe(100);
  });

  it('drill-down ของช่องยกเลิกได้เฉพาะใบที่ยกเลิกจริง', () => {
    const records = [
      retro('C1', 'breached', 'cancelled_full'),
      retro('B1', 'breached', 'open'),
    ];
    expect(filterRecordsForSlaCell(records, 'retroactive', 'cancelled', TODAY).map((r) => r.id)).toEqual(
      ['C1'],
    );
    expect(filterRecordsForSlaCell(records, 'retroactive', 'breached', TODAY).map((r) => r.id)).toEqual(
      ['B1'],
    );
  });
});

describe('slaByLeadKind — drill-down', () => {
  const records = [
    retro('R1', 'closed_late'),
    urgent('U1', 'closed_late'),
    urgent('U2', 'at_risk'),
    advance('A1', 'closed_late'),
  ];

  it('กดช่องเดียวได้เฉพาะใบของช่องนั้น (ชนิด × ถัง)', () => {
    expect(filterRecordsForSlaCell(records, 'urgent', 'closed_late', TODAY).map((r) => r.id)).toEqual(
      ['U1'],
    );
    expect(filterRecordsForSlaCell(records, 'urgent', 'at_risk', TODAY).map((r) => r.id)).toEqual([
      'U2',
    ]);
    expect(filterRecordsForSlaCell(records, 'advance', 'at_risk', TODAY)).toHaveLength(0);
  });

  it('กดชื่อแถวได้ทั้งชนิดนั้น และจำนวนตรงกับยอดแถวในตาราง', () => {
    const t = buildSlaByLeadKind(records, TODAY);
    for (const row of t.rows) {
      expect(filterRecordsForLeadKind(records, row.kind, TODAY)).toHaveLength(row.total);
    }
  });
});
