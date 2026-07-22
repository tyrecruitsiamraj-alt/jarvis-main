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

  it('computes median/min/max per group from complete years (July example)', () => {
    const f = buildDemandForecast(base);
    const july = f.months[6];
    expect(july.month).toBe(7);
    expect(july.status).toBe('current');
    // resignation: median(101, 89, 109) = 101, min 89, max 109
    expect(july.groups.resignation.medNet).toBe(101);
    expect(july.groups.resignation.minNet).toBe(89);
    expect(july.groups.resignation.maxNet).toBe(109);
    // replacement: median(40, 50, 60) = 50
    expect(july.groups.replacement.medNet).toBe(50);
    // increase_headcount มีปีเดียว (9) อีกสองปี 0 → median 0 (outlier ไม่ลากตัวเลข) แต่ max ฟ้อง 9
    expect(july.groups.increase_headcount.medNet).toBe(0);
    expect(july.groups.increase_headcount.minNet).toBe(0);
    expect(july.groups.increase_headcount.maxNet).toBe(9);
    // new_site รวมใน other: median(5, 0, 0) = 0, max 5
    expect(july.groups.other.medNet).toBe(0);
    expect(july.groups.other.maxNet).toBe(5);
  });

  it('current month: actual + expectedMore = max(median − actual, 0)', () => {
    const f = buildDemandForecast(base);
    const july = f.months[6];
    expect(july.groups.resignation.actualNet).toBe(94);
    expect(july.groups.resignation.expectedMoreNet).toBe(7); // 101 − 94
    expect(july.groups.replacement.actualNet).toBe(20);
    expect(july.groups.replacement.expectedMoreNet).toBe(30); // 50 − 20
    // actual เกิน median แล้ว → ไม่ติดลบ
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

  it('median resists a one-year spike where average would not', () => {
    const spike: DemandForecastResponse = {
      ...base,
      years: [
        { year: 2023, complete: true, months: { 8: { other: cell(13) } } },
        { year: 2024, complete: true, months: { 8: { other: cell(20) } } },
        { year: 2025, complete: true, months: { 8: { other: cell(791) } } },
        { year: 2026, complete: false, months: {} },
      ],
    };
    const aug = buildDemandForecast(spike).months[7];
    expect(aug.groups.other.medNet).toBe(20); // ค่าเฉลี่ยจะได้ 275 — ค่ากลางไม่โดนลาก
    expect(aug.groups.other.maxNet).toBe(791); // ช่วงยังฟ้อง outlier
  });

  it('annotates a spike max with the year and dominant request type', () => {
    const spike: DemandForecastResponse = {
      ...base,
      years: [
        { year: 2023, complete: true, months: { 8: { resignation: cell(62), new_site: cell(13) } } },
        {
          year: 2024,
          complete: true,
          months: { 8: { resignation: cell(49), new_site: cell(781), increase_headcount: cell(25) } },
        },
        { year: 2025, complete: true, months: { 8: { resignation: cell(75), new_site: cell(6) } } },
        { year: 2026, complete: false, months: {} },
      ],
    };
    const aug = buildDemandForecast(spike).months[7];
    // total: 75, 855, 81 → median 81, max 855 (≥2×med) → note ชี้ปี 67 เปิดไซต์ 781
    expect(aug.total.spikeNote).toContain('ปี 67');
    expect(aug.total.spikeNote).toContain('เปิดไซต์');
    expect(aug.total.spikeNote).toContain('781');
    // resignation ปกติ (49/62/75) → ไม่มีหมายเหตุ
    expect(aug.groups.resignation.spikeNote).toBeUndefined();
  });

  it('current month exposes the max-based ceiling (อาจถึง)', () => {
    // resignation กค: med 101, max 109, actual 94 → more ~7, ceiling 15
    const f = buildDemandForecast(base);
    const july = f.months[6];
    expect(july.groups.resignation.expectedMoreNet).toBe(7);
    expect(july.groups.resignation.expectedMoreMaxNet).toBe(15); // 109 − 94
    // total: med 146, max 178, actual 114 → more 32, ceiling 64
    expect(july.total.expectedMoreMaxNet).toBe(64);
    // เดือนอนาคตไม่มี ceiling
    expect(f.months[7].total.expectedMoreMaxNet).toBeUndefined();
  });

  it('passes topResignationUnits through (defaults to empty)', () => {
    expect(buildDemandForecast(base).topResignationUnits).toEqual([]);
    const withUnits = buildDemandForecast({
      ...base,
      topResignationUnits: [{ unitName: 'ไซต์ A', requests: 12, positions: 15, monthsActive: 8 }],
    });
    expect(withUnits.topResignationUnits[0].unitName).toBe('ไซต์ A');
  });

  it('total median/min/max comes from per-year totals, not sum of group extremes', () => {
    const f = buildDemandForecast(base);
    const july = f.months[6];
    // yearly totals: 2023=101+40+5=146, 2024=89+50=139, 2025=109+60+9=178 → median 146
    expect(july.total.medNet).toBe(146);
    expect(july.total.minNet).toBe(139);
    expect(july.total.maxNet).toBe(178);
    expect(july.total.actualNet).toBe(114); // 94+20
    expect(july.total.expectedMoreNet).toBe(32); // 146 − 114
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
    expect(f.months[6].groups.resignation.medNet).toBe(0);
    expect(f.months[6].total.minNet).toBe(0);
  });
});
