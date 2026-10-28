import { describe, expect, it } from 'vitest';
import { penaltyWaivedByReplacement } from '../../src/lib/penaltyWaiver';
import { buildPenaltyLedger, type PenaltyRequestRow } from '../../src/lib/requestPenaltyLedger';
import { computeJobPenaltyFields } from '../../src/lib/jobPenalty';
import type { JobRequest } from '../../src/types';

const row = (over: Partial<PenaltyRequestRow> = {}): PenaltyRequestRow => ({
  requestNo: 'LBM6903001',
  site: '69LBML0042',
  bu: 'LBM',
  unit: 'บริษัท สมิติเวช จำกัด (มหาชน)',
  position: 'ขับรถ',
  qty: 3,
  keyYmd: '2026-10-01',
  needYmd: '2026-10-01',
  endYmd: null,
  workDays: 'วันจันทร์ - วันศุกร์',
  finePerDay: 550,
  deductPerDay: 366.67,
  ...over,
});

describe('ติ๊ก "ต้องส่งคนแทน" = ไม่คิดค่าปรับ (เจ้าของ 28 ต.ค. 2569 · LBM6903001 EX ประจำ 3 คน)', () => {
  it('ตัวตัดสิน: true เท่านั้น · ไม่ต้องส่ง/ยังไม่เลือก = คิดตามเดิม', () => {
    expect(penaltyWaivedByReplacement(true)).toBe(true);
    expect(penaltyWaivedByReplacement(false)).toBe(false);
    expect(penaltyWaivedByReplacement(null)).toBe(false);
    expect(penaltyWaivedByReplacement(undefined)).toBe(false);
  });

  it('สมุดค่าปรับ: ใบที่ติ๊กไว้ = 0 ทั้งสองจุดเริ่มนับ แต่ยังอยู่ในรายการ · ใบไม่ติ๊กยังคิดเต็ม', () => {
    const { requests, daily } = buildPenaltyLedger(
      [row({ sendReplacement: true }), row({ requestNo: 'LBM6903002', sendReplacement: false })],
      [],
      '2026-10-07',
      { from: '2026-10-01', to: '2026-10-07' },
    );
    const waived = requests.find((r) => r.requestNo === 'LBM6903001')!;
    const charged = requests.find((r) => r.requestNo === 'LBM6903002')!;
    expect(waived.amount.need).toMatchObject({ fine: 0, deduct: 0, personDays: 0, days: 0 });
    expect(waived.amount.key).toMatchObject({ fine: 0, deduct: 0 });
    // 1,2,5,6,7 ต.ค. = 5 วันทำงาน × ขาด 3 คน
    expect(charged.amount.need.personDays).toBe(15);
    expect(charged.amount.need.fine).toBe(8250);
    expect(daily.need['2026-10-07'].personDays).toBe(3);
  });

  it('เมนูใบขอ: ค่าปรับสะสมเป็น 0 เมื่อติ๊กต้องส่งคนแทน', () => {
    const job = { status: 'open', required_date: '2026-10-01', unit_name: 'สมิติเวช', penalty_per_day: 550, send_replacement: true } as unknown as JobRequest;
    expect(computeJobPenaltyFields(job, new Map(), new Date('2026-10-07T05:00:00Z'))).toEqual({ days_without_worker: 0, total_penalty: 0 });
    const charged = computeJobPenaltyFields({ ...job, send_replacement: false }, new Map(), new Date('2026-10-07T05:00:00Z'));
    expect(charged.total_penalty).toBeGreaterThan(0);
  });
});
