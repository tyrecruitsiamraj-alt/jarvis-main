import { describe, it, expect } from 'vitest';
import {
  jobToRequestControlRecord,
  positionBreakdownFromJob,
  resolveRequestControlStatus,
} from '../../src/lib/requestControl';
import type { JobRequest } from '@/types';

function job(partial: Partial<JobRequest> & { unit_name: string }): JobRequest {
  return {
    id: partial.id ?? 'j1',
    job_type: 'thai_executive',
    job_category: 'private',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    location_address: 'Bangkok',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_date: '2026-07-01',
    required_date: '2026-07-20',
    created_at: '2026-07-01',
    ...partial,
  };
}

describe('requestControl', () => {
  it('treats partial fill as not fully closed but counts filled positions', () => {
    const partial = job({
      unit_name: 'U',
      request_positions: 5,
      filled_positions: 2,
      cancelled_positions: 0,
      position_units: 3,
    });
    const breakdown = positionBreakdownFromJob(partial);
    expect(breakdown).toEqual({
      requestPositions: 5,
      filledPositions: 2,
      cancelledPositions: 0,
      remainingPositions: 3,
    });
    expect(resolveRequestControlStatus(breakdown)).toBe('partial');
    const rec = jobToRequestControlRecord(partial);
    expect(rec.isFullyClosed).toBe(false);
    expect(rec.isPartial).toBe(true);
    expect(rec.filledPositions).toBe(2);
    expect(rec.remainingPositions).toBe(3);
  });

  it('counts fully closed only when filled meets request', () => {
    const full = job({
      unit_name: 'U',
      status: 'closed',
      closed_date: '2026-07-10',
      request_positions: 5,
      filled_positions: 5,
      position_units: 5,
    });
    expect(resolveRequestControlStatus(positionBreakdownFromJob(full))).toBe('fully_closed');
    expect(jobToRequestControlRecord(full).isFullyClosed).toBe(true);
  });

  it('counts cancelled remaining separately from full request', () => {
    const mixed = job({
      unit_name: 'U',
      status: 'cancelled',
      request_positions: 5,
      filled_positions: 2,
      cancelled_positions: 3,
      position_units: 0,
    });
    const breakdown = positionBreakdownFromJob(mixed);
    expect(breakdown.cancelledPositions).toBe(3);
    expect(breakdown.remainingPositions).toBe(0);
    expect(resolveRequestControlStatus(breakdown)).toBe('partially_filled_cancelled_remaining');
  });

  it('full cancel without fill counts all positions as cancelled', () => {
    const cancelled = job({
      unit_name: 'U',
      status: 'cancelled',
      request_positions: 5,
      filled_positions: 0,
      cancelled_positions: 5,
    });
    expect(resolveRequestControlStatus(positionBreakdownFromJob(cancelled))).toBe('cancelled_full');
  });
});

/**
 * ทางหนีทีไล่ตอนไม่มีตัวเลข staffing จาก ERP — ต้องติดธง `isDerived` เสมอ
 *
 * วัดกับข้อมูลจริงแล้วว่าใบขอจาก ERP ไม่ตกมาทางนี้เลย (325 + 2,734 ใบ ใช้เลขจริง 100%)
 * แต่จะทำงานทันทีเมื่อ feed Siamraj ถูกปิด แล้วระบบถอยไปใช้ใบขอฝั่ง PostgreSQL
 * ซึ่งไม่มีฟิลด์ staffing — ตอนนั้น "ปิดใบขอ" จะกลายเป็น "หาได้ครบ" เงียบ ๆ ถ้าไม่มีธง
 */
describe('requestControl — ทางที่เดาจาก status ต้องติดธงว่าเป็นเลขเดา', () => {
  it('เลขจาก ERP ต้องไม่ติดธง (ไม่งั้นเลขจริงจะถูกนับเป็นเลขเดา)', () => {
    const fromErp = job({
      unit_name: 'U',
      status: 'closed',
      request_positions: 5,
      filled_positions: 5,
      cancelled_positions: 0,
    });
    expect(positionBreakdownFromJob(fromErp).isDerived).toBeUndefined();
  });

  it('ไม่มีเลข staffing + ปิดใบขอ = เดาว่าหาได้ครบ จึงต้องติดธง', () => {
    const closedNoErp = job({ unit_name: 'U', status: 'closed', position_units: 4 });
    const b = positionBreakdownFromJob(closedNoErp);
    // ตัวเลขต้องเท่าเดิม (คอมมิตนี้ตั้งใจไม่เปลี่ยนพฤติกรรม) แต่ต้องบอกได้ว่าเป็นเลขเดา
    expect(b).toEqual({
      requestPositions: 4,
      filledPositions: 4,
      cancelledPositions: 0,
      remainingPositions: 0,
      isDerived: true,
    });
    // นี่คือจุดที่ขัดกติกา "ห้ามเอาปิดครบใบขอมาเป็นหาได้แล้ว" ถ้าธงหาย
    expect(b.isDerived).toBe(true);
  });

  it('ไม่มีเลข staffing + ยกเลิก = เดาว่ายกเลิกทั้งใบ จึงต้องติดธง', () => {
    const b = positionBreakdownFromJob(job({ unit_name: 'U', status: 'cancelled', position_units: 3 }));
    expect(b).toEqual({
      requestPositions: 3,
      filledPositions: 0,
      cancelledPositions: 3,
      remainingPositions: 0,
      isDerived: true,
    });
  });

  it('ไม่มีเลข staffing + ยังเปิดอยู่ = ต้องไม่เดาว่าหาได้ และติดธง', () => {
    const b = positionBreakdownFromJob(job({ unit_name: 'U', status: 'open', position_units: 2 }));
    expect(b.filledPositions).toBe(0);
    expect(b.remainingPositions).toBe(2);
    expect(b.isDerived).toBe(true);
  });

  it('มี request_positions แต่ไม่มีทั้ง filled และ cancelled = ยังถือว่าเลขไม่ครบ ต้องติดธง', () => {
    const b = positionBreakdownFromJob(
      job({ unit_name: 'U', status: 'open', request_positions: 9, position_units: 9 }),
    );
    expect(b.isDerived).toBe(true);
  });
});
