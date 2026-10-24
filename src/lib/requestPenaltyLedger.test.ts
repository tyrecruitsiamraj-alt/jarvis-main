import { describe, expect, it } from 'vitest';
import { buildPenaltyLedger, groupDaily, requestFlow, type PenaltyRequestRow } from './requestPenaltyLedger';

const row = (over: Partial<PenaltyRequestRow> = {}): PenaltyRequestRow => ({
  requestNo: 'R1',
  site: '69LBDL0001',
  bu: 'LBD',
  unit: 'หน่วยงาน',
  position: 'พนักงานขับรถ',
  qty: 3,
  keyYmd: '2026-10-01',
  needYmd: '2026-10-01',
  endYmd: null,
  workDays: 'วันจันทร์ - วันศุกร์',
  finePerDay: 100,
  deductPerDay: 50,
  ...over,
});
const WIN = { from: '2026-01-01', to: '2026-12-31' };

describe('สมุดค่าปรับใบขอ (เจ้าของ 24 ต.ค. 2569)', () => {
  it('ต่อคนต่อวันทำงาน · ไม่นับเสาร์–อาทิตย์ · คนเริ่มงานแล้วหยุดนับคนนั้น', () => {
    // 1 ต.ค. 2569 = พฤหัส · วันนี้ 7 ต.ค. (อังคาร) · คนแรกเริ่ม 6 ต.ค.
    const { requests, daily } = buildPenaltyLedger(
      [row()],
      [{ requestNo: 'R1', startYmd: '2026-10-06', recordYmd: '2026-10-07', qty: 1 }],
      '2026-10-07',
      WIN,
    );
    const a = requests[0].amount.need;
    // วันทำงาน: 1,2 (ขาด 3) · 5 (ขาด 3) · 6,7 (ขาด 2) = 5 วัน 13 คน-วัน
    expect(a.days).toBe(5);
    expect(a.personDays).toBe(13);
    expect(a.fine).toBe(1300);
    expect(a.deduct).toBe(650);
    expect(daily.need['2026-10-03']).toBeUndefined(); // เสาร์
    expect(daily.need['2026-10-06'].personDays).toBe(2);
  });

  it('สองจุดเริ่มนับ: ใบย้อนหลัง need นับก่อนวันคีย์ · key เริ่มวันคีย์', () => {
    const { requests } = buildPenaltyLedger(
      [row({ qty: 1, keyYmd: '2026-10-15', needYmd: '2026-10-01', workDays: 'ทุกวัน' })],
      [{ requestNo: 'R1', startYmd: '2026-10-17', recordYmd: '2026-10-17', qty: 1 }],
      '2026-10-20',
      WIN,
    );
    const r = requests[0];
    expect(r.amount.need.days).toBe(16); // 1–16 ต.ค.
    expect(r.amount.key.days).toBe(2); // 15–16 ต.ค.
    // สองนาฬิกา: หาได้ใน 2 วันนับจากวันคีย์ · ช้ากว่าที่ลูกค้าต้องการ 16 วัน
    expect(r.speedDays).toBe(2);
    expect(r.lateDays).toBe(16);
  });

  it('ใบล่วงหน้า: มีคนตั้งแต่วันคีย์ รอส่งวันที่ต้องการ = ความเร็ว 0 วัน ไม่ช้า ไม่มีค่าปรับ', () => {
    const { requests } = buildPenaltyLedger(
      [row({ qty: 1, keyYmd: '2026-10-01', needYmd: '2026-10-15', workDays: 'ทุกวัน' })],
      [{ requestNo: 'R1', startYmd: '2026-10-15', recordYmd: '2026-10-01', qty: 1 }],
      '2026-10-20',
      WIN,
    );
    const r = requests[0];
    expect(r.advance).toBe(true);
    expect(r.speedDays).toBe(0);
    expect(r.lateDays).toBe(0);
    expect(r.amount.need.fine).toBe(0);
    expect(r.amount.key.fine).toBe(0);
  });

  it('ใบ Stop/ยกเลิก หยุดนับวันจบ · ไม่มีอัตรา = ไม่มีเงิน · ช่วงที่เลือกตัดยอด', () => {
    const { requests } = buildPenaltyLedger(
      [
        row({ requestNo: 'S', qty: 1, workDays: 'ทุกวัน', endYmd: '2026-10-05' }),
        row({ requestNo: 'Z', finePerDay: 0, deductPerDay: 0 }),
      ],
      [],
      '2026-10-20',
      { from: '2026-10-03', to: '2026-10-31' },
    );
    expect(requests[0].amount.need.days).toBe(2); // 3–4 ต.ค.
    expect(requests[0].open).toBe(false);
    expect(requests[1].amount.need.fine).toBe(0);
    expect(requests[1].open).toBe(true);
  });

  it('รวมรายสัปดาห์เริ่มวันจันทร์ · รายเดือน', () => {
    const d = { '2026-10-05': { fine: 1, deduct: 0, personDays: 1 }, '2026-10-11': { fine: 2, deduct: 0, personDays: 1 }, '2026-11-02': { fine: 3, deduct: 1, personDays: 2 } };
    expect(groupDaily(d, 'week').map((x) => [x.key, x.fine])).toEqual([['2026-10-05', 3], ['2026-11-02', 3]]);
    expect(groupDaily(d, 'month').map((x) => [x.key, x.fine, x.deduct])).toEqual([['2026-10', 3, 0], ['2026-11', 3, 1]]);
  });
  it('ส่งคนแทนหักคนที่ขาด · ใบที่ต้องการก่อนได้คนแทนก่อน', () => {
    const { requests } = buildPenaltyLedger(
      [
        row({ requestNo: 'A', qty: 1, needYmd: '2026-10-05', keyYmd: '2026-10-05', workDays: 'ทุกวัน' }),
        row({ requestNo: 'B', qty: 1, needYmd: '2026-10-01', keyYmd: '2026-10-01', workDays: 'ทุกวัน' }),
      ],
      [],
      '2026-10-06',
      WIN,
      { '69LBDL0001': [['2026-10-05', 1], ['2026-10-06', 2]] },
    );
    const a = requests.find((r) => r.requestNo === 'A')!;
    const b = requests.find((r) => r.requestNo === 'B')!;
    // 5 ต.ค.: คนแทน 1 คน → B (ต้องการก่อน) · 6 ต.ค.: 2 คน → ครอบทั้งคู่
    expect(b.amount.need.coveredPersonDays).toBe(2);
    expect(b.amount.need.personDays).toBe(4); // 1–4 ต.ค.
    expect(a.amount.need.coveredPersonDays).toBe(1);
    expect(a.amount.need.personDays).toBe(1); // 5 ต.ค.
  });

  it('🔴 ยกมา + ขอใหม่ − หาได้ − ยกเลิก = เหลือ ลงตัวทุกกรณี (เจ้าของ "บวกลบกันแล้วต้องเท่ากัน")', () => {
    const rows = [
      row({ requestNo: 'old-open', qty: 3, keyYmd: '2026-09-01', needYmd: '2026-09-01' }),
      row({ requestNo: 'old-end', qty: 2, keyYmd: '2026-09-10', needYmd: '2026-09-10', endYmd: '2026-10-05' }),
      row({ requestNo: 'new-open', qty: 2, keyYmd: '2026-10-03', needYmd: '2026-10-03' }),
      row({ requestNo: 'new-end', qty: 4, keyYmd: '2026-10-02', needYmd: '2026-10-02', endYmd: '2026-10-08' }),
      row({ requestNo: 'bad', qty: 1, keyYmd: '2026-10-04', needYmd: '2026-10-04', endYmd: '2026-09-30' }),
      row({ requestNo: 'done-before', qty: 1, keyYmd: '2026-08-01', needYmd: '2026-08-01' }),
    ];
    const informs = [
      { requestNo: 'old-open', startYmd: '2026-09-20', recordYmd: '2026-09-20', qty: 1 },
      { requestNo: 'old-open', startYmd: '2026-10-06', recordYmd: '2026-10-06', qty: 1 },
      { requestNo: 'old-end', startYmd: '2026-10-02', recordYmd: '2026-10-02', qty: 1 },
      { requestNo: 'new-end', startYmd: '2026-10-04', recordYmd: '2026-10-04', qty: 2 },
      { requestNo: 'done-before', startYmd: '2026-08-05', recordYmd: '2026-08-05', qty: 1 },
    ];
    const { requests } = buildPenaltyLedger(rows, informs, '2026-10-10', WIN);
    const f = requestFlow(requests, '2026-10-01', '2026-10-10');
    expect(f.carryIn + f.newPositions - f.filled - f.cancelled).toBe(f.remaining);
    expect(f.carryIn).toBe(2 + 2); // old-open ขาด 2 · old-end ขาด 2
    expect(f.newPositions).toBe(2 + 4 + 1);
    expect(f.filled).toBe(1 + 1 + 2); // old-open 6 ต.ค. · old-end 2 ต.ค. · new-end 2 คน
    expect(f.remaining).toBe(1 + 2); // old-open 1 · new-open 2
    expect(f.cancelled).toBe(1 + 2 + 1); // old-end 1 · new-end 2 · bad 1
    // หน่วยใบ: ยกมา 2 (old-open, old-end) + ใหม่ 3 − ปิดครบ 0 − ยกเลิก 3 (old-end, new-end, bad) = เหลือ 2 (old-open, new-open)
    expect(f.carryInRequests + f.newRequests - f.closedRequests - f.cancelledRequests).toBe(f.remainingRequests);
    expect([f.carryInRequests, f.newRequests, f.closedRequests, f.cancelledRequests, f.remainingRequests]).toEqual([2, 3, 0, 3, 2]);
  });
});
