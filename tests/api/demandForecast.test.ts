import { describe, it, expect } from 'vitest';
import {
  buildDemandForecast,
  lifecycleToGroup,
  type DemandForecastResponse,
  type ForecastMonthCell,
} from '@/lib/dashboard/request-control/demandForecast';
import { aggregateThroughputYear } from '../../api/_handlers/request-control-forecast';

function cell(net: number, netRequests = net): ForecastMonthCell {
  return {
    intakePositions: net,
    cancelledPositions: 0,
    netPositions: net,
    intakeRequests: netRequests,
    netRequests,
  };
}

describe('aggregateThroughputYear (API-side cohort aggregation)', () => {
  it('sums intake across kinds and subtracts cancelled per request', () => {
    const data = aggregateThroughputYear(2025, true, [
      // ใบเดียว 5 อัตรา: filled 2, cancelled 3 → intake 5, cancelled 3, net 2
      { requestNo: 'R1', requestDate: '2025-07-03', positionUnits: 2, kind: 'filled', lifecycleKind: 'resignation' },
      { requestNo: 'R1', requestDate: '2025-07-03', positionUnits: 3, kind: 'cancelled', lifecycleKind: 'resignation' },
      // ใบยกเลิกทั้งใบ → net 0, ไม่ติด netRequests
      { requestNo: 'R2', requestDate: '2025-07-10', positionUnits: 2, kind: 'cancelled', lifecycleKind: 'replacement' },
      // ใบเปิดค้าง
      { requestNo: 'R3', requestDate: '2025-07-20', positionUnits: 1, kind: 'remaining', lifecycleKind: 'resignation' },
    ]);
    const july = data.months[7];
    expect(july.resignation).toEqual({
      intakePositions: 6,
      cancelledPositions: 3,
      netPositions: 3,
      intakeRequests: 2,
      netRequests: 2,
    });
    expect(july.replacement).toEqual({
      intakePositions: 2,
      cancelledPositions: 2,
      netPositions: 0,
      intakeRequests: 1,
      netRequests: 0,
    });
  });

  it('buckets by request month', () => {
    const data = aggregateThroughputYear(2025, true, [
      { requestNo: 'A', requestDate: '2025-01-05', positionUnits: 1, kind: 'filled', lifecycleKind: 'other' },
      { requestNo: 'B', requestDate: '2025-12-31', positionUnits: 2, kind: 'remaining', lifecycleKind: 'other' },
    ]);
    expect(data.months[1]?.other?.netPositions).toBe(1);
    expect(data.months[12]?.other?.netPositions).toBe(2);
    expect(data.months[7]).toBeUndefined();
  });
});

describe('lifecycleToGroup', () => {
  it('maps new_site into other, keeps named groups', () => {
    expect(lifecycleToGroup('new_site')).toBe('other');
    expect(lifecycleToGroup('other')).toBe('other');
    expect(lifecycleToGroup('resignation')).toBe('resignation');
    expect(lifecycleToGroup('replacement')).toBe('replacement');
    expect(lifecycleToGroup('increase_headcount')).toBe('increase_headcount');
  });
});

describe('buildDemandForecast', () => {
  const base: DemandForecastResponse = {
    currentYear: 2026,
    currentMonth: 7,
    asOf: '2026-07-22',
    years: [
      {
        year: 2023,
        complete: true,
        months: { 7: { resignation: cell(101), replacement: cell(40), new_site: cell(5) } },
      },
      {
        year: 2024,
        complete: true,
        months: { 7: { resignation: cell(89), replacement: cell(50) } },
      },
      {
        year: 2025,
        complete: true,
        months: { 7: { resignation: cell(109), replacement: cell(60), increase_headcount: cell(9) } },
      },
      {
        year: 2026,
        complete: false,
        months: { 7: { resignation: cell(94), replacement: cell(20) } },
      },
    ],
  };

  it('computes avg/min/max per group from complete years (July example)', () => {
    const f = buildDemandForecast(base);
    const july = f.months[6];
    expect(july.month).toBe(7);
    expect(july.status).toBe('current');
    // resignation: (101+89+109)/3 = 99.67 → 100, min 89, max 109
    expect(july.groups.resignation.avgNet).toBe(100);
    expect(july.groups.resignation.minNet).toBe(89);
    expect(july.groups.resignation.maxNet).toBe(109);
    // replacement: (40+50+60)/3 = 50
    expect(july.groups.replacement.avgNet).toBe(50);
    // increase_headcount มีปีเดียว (9) อีกสองปี 0 → avg 3, min 0, max 9
    expect(july.groups.increase_headcount.avgNet).toBe(3);
    expect(july.groups.increase_headcount.minNet).toBe(0);
    expect(july.groups.increase_headcount.maxNet).toBe(9);
    // new_site รวมใน other
    expect(july.groups.other.avgNet).toBe(2);
    expect(july.groups.other.maxNet).toBe(5);
  });

  it('current month: actual + expectedMore = max(avg − actual, 0)', () => {
    const f = buildDemandForecast(base);
    const july = f.months[6];
    expect(july.groups.resignation.actualNet).toBe(94);
    expect(july.groups.resignation.expectedMoreNet).toBe(6); // 100 − 94
    expect(july.groups.replacement.actualNet).toBe(20);
    expect(july.groups.replacement.expectedMoreNet).toBe(30); // 50 − 20
    // actual เกิน avg แล้ว → ไม่ติดลบ
    const over: DemandForecastResponse = {
      ...base,
      years: base.years.map((y) =>
        y.year === 2026
          ? { ...y, months: { 7: { resignation: cell(150) } } }
          : y,
      ),
    };
    expect(buildDemandForecast(over).months[6].groups.resignation.expectedMoreNet).toBe(0);
  });

  it('total min/max comes from per-year totals, not sum of group extremes', () => {
    const f = buildDemandForecast(base);
    const july = f.months[6];
    // yearly totals: 2023=101+40+5=146, 2024=89+50=139, 2025=109+60+9=178
    expect(july.total.avgNet).toBe(Math.round((146 + 139 + 178) / 3)); // 154
    expect(july.total.minNet).toBe(139);
    expect(july.total.maxNet).toBe(178);
    expect(july.total.actualNet).toBe(114); // 94+20
  });

  it('future months carry forecast only; past months carry actuals', () => {
    const f = buildDemandForecast(base);
    const aug = f.months[7];
    expect(aug.status).toBe('future');
    expect(aug.groups.resignation.actualNet).toBeUndefined();
    expect(aug.groups.resignation.expectedMoreNet).toBeUndefined();
    const june = f.months[5];
    expect(june.status).toBe('past');
    expect(june.groups.resignation.actualNet).toBe(0); // ปีปัจจุบันไม่มีข้อมูลเดือนนั้น = 0
    expect(june.groups.resignation.expectedMoreNet).toBeUndefined();
  });

  it('handles no complete years without crashing', () => {
    const f = buildDemandForecast({ ...base, years: base.years.filter((y) => !y.complete) });
    expect(f.historyYears).toEqual([]);
    expect(f.months[6].groups.resignation.avgNet).toBe(0);
    expect(f.months[6].total.minNet).toBe(0);
  });
});
