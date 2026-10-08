/**
 * แท็บทีม Online (เจ้าของ 8 ต.ค. 2569) — ทุกก้อนรวมได้เท่าใบขอเข้า · ยกเลิกไม่ใช่หาได้แล้ว · ไม่มีข้อมูล = ไม่ระบุ (ห้ามหาย)
 */
import { describe, expect, it } from 'vitest';
import {
  buildOnlineReport,
  groupThroughputByRequest,
  onlineReportAddsUp,
  onlineRequestStateOf,
  type OnlineRequestRow,
} from '../../src/lib/homeOnline';

const row = (o: Partial<OnlineRequestRow>): OnlineRequestRow => ({
  requestNo: 'R1', jobId: 'siamraj-sql:R1', day: '2026-10-02', bu: 'LBD', requested: 1, filled: 0, cancelled: 0, remaining: 1,
  unitName: 'หน่วย', industry: null, sector: null, position: null, releasedAt: null, applications: 0, ...o,
});

describe('สถานะใบขอ 4 กอง (กติกา "ยกเลิกไม่ใช่หาได้แล้ว")', () => {
  it('ยังเหลือ = เปิดอยู่ · หาได้ครบ = ปิดครบ · ไม่ได้ใครแล้วยกเลิก = ยกเลิกทั้งใบ · หาได้บางส่วนแล้วยกเลิก = ไม่นับเป็นปิดครบ', () => {
    expect(onlineRequestStateOf({ filled: 3, cancelled: 0, remaining: 2 })).toBe('open');
    expect(onlineRequestStateOf({ filled: 5, cancelled: 0, remaining: 0 })).toBe('fullyClosed');
    expect(onlineRequestStateOf({ filled: 0, cancelled: 5, remaining: 0 })).toBe('cancelledAll');
    expect(onlineRequestStateOf({ filled: 2, cancelled: 3, remaining: 0 })).toBe('partialCancelled');
  });

  it('แถว throughput ของใบเดียวรวมเป็นใบเดียว (ใบหาได้บางส่วนไม่ถูกนับสองกอง)', () => {
    const g = groupThroughputByRequest([
      { requestNo: 'A', requestDate: '2026-10-02', positionUnits: 2, kind: 'filled', isOpen: false },
      { requestNo: 'A', requestDate: '2026-10-02', positionUnits: 3, kind: 'remaining', isOpen: true },
      { requestNo: 'B', requestDate: '2026-10-03', positionUnits: 1, kind: 'cancelled', isOpen: false },
    ]);
    expect(g).toHaveLength(2);
    expect(g.find((x) => x.requestNo === 'A')).toMatchObject({ requested: 5, filled: 2, remaining: 3 });
  });
});

describe('buildOnlineReport', () => {
  const rows = [
    row({ requestNo: 'R1', industry: 'ธนาคาร', sector: 'private', position: 'ขับรถ', releasedAt: '2026-10-02T03:00:00Z', applications: 4 }),
    row({ requestNo: 'R2', day: '2026-10-03', bu: 'LBA', filled: 1, remaining: 0, industry: 'ธนาคาร', position: 'คนสวน' }),
    row({ requestNo: 'R3', day: '2026-10-03', releasedAt: '2026-10-03T03:00:00Z', applications: 0 }),
    row({ requestNo: 'R4', day: '2026-10-05', cancelled: 1, remaining: 0 }),
  ];
  const r = buildOnlineReport(rows, { from: '2026-10-02', to: '2026-10-05' });

  it('ใบขอเข้า = เปิดอยู่ + ปิดครบ + ยกเลิกทั้งใบ + หาได้บางส่วน·ยกเลิก · รายวันครบทุกวัน (วันว่าง = 0)', () => {
    expect(r.requests.total).toBe(4);
    expect(r.requests.byState).toEqual({ open: 2, fullyClosed: 1, cancelledAll: 1, partialCancelled: 0 });
    expect(r.requests.daily.map((d) => [d.day, d.total])).toEqual([
      ['2026-10-02', 1], ['2026-10-03', 2], ['2026-10-04', 0], ['2026-10-05', 1],
    ]);
  });

  it('ส่งไปประกาศ + ผลประกาศ ใบละกี่คน (มากไปน้อย)', () => {
    expect(r.posting).toEqual({ total: 4, released: 2, notReleasedOpen: 0, notReleasedEnded: 2 });
    expect(r.results).toMatchObject({ released: 2, withApplications: 1, withoutApplications: 1, applications: 4 });
    expect(r.results.top.map((t) => [t.requestNo, t.applications])).toEqual([['R1', 4], ['R3', 0]]);
  });

  it('ประเภทงาน 3 มุม — ไม่มีข้อมูล = ไม่ระบุ อยู่ท้าย · แต่ละมุมรวมได้เท่าใบขอ', () => {
    expect(r.types.industry).toEqual([
      { key: 'ธนาคาร', label: 'ธนาคาร', n: 2 },
      { key: 'ไม่ระบุ', label: 'ไม่ระบุ', n: 2 },
    ]);
    expect(r.types.sector.map((x) => [x.label, x.n])).toEqual([['เอกชน', 1], ['ไม่ระบุ', 3]]);
    expect(onlineReportAddsUp(r)).toBe(true);
  });

  it('BU เรียงมากไปน้อย รวมได้เท่าใบขอ', () => {
    expect(r.bu.map((b) => [b.bu, b.total])).toEqual([['LBD', 3], ['LBA', 1]]);
  });
});
