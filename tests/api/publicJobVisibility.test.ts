// @vitest-environment node
/**
 * ใบขอไหนโชว์บนหน้าสาธารณะได้บ้าง (เจ้าของเคาะ 17 ส.ค. 2569)
 *
 * ทำไมต้องมีเทสต์: พลาดทางไหนก็เสียหายทั้งคู่ และ**ไม่มีสัญญาณเตือน** —
 * กรองแรงไป = ประกาศหายจากหน้าสาธารณะเงียบ ๆ ไม่มีใครสมัครเข้ามาเลย ·
 * กรองอ่อนไป = คนนอกสมัครใบที่ได้คนแล้ว เสียเวลาทั้งสองฝ่าย
 */
import { describe, expect, it } from 'vitest';
import {
  HIDDEN_FROM_PUBLIC_WORK_STATUSES,
  isHiddenFromPublicByWorkStatus,
  isPublicVisibleByWorkStatus,
} from '../../src/lib/publicJobVisibility.js';
import { UNIT_REQUEST_WORK_STATUS_OPTIONS } from '../../src/lib/unitRequestWorkStatus.js';

describe('สถานะที่ต้องซ่อนจากหน้าสาธารณะ', () => {
  it('🔴 ซ่อนเฉพาะ "รอเริ่มงาน" กับ "รอแจ้งเข้า" ตามที่เจ้าของเคาะ', () => {
    expect([...HIDDEN_FROM_PUBLIC_WORK_STATUSES].sort()).toEqual(['waiting_inform', 'waiting_start']);
  });

  it('สถานะที่เหลือทั้งหมดยังโชว์ได้ (ยังหาคนอยู่)', () => {
    const shown = UNIT_REQUEST_WORK_STATUS_OPTIONS.filter((s) => !isHiddenFromPublicByWorkStatus(s));
    expect(shown).toEqual([
      'in_progress',
      'on_hold',
      'evaluating',
      'waiting_interview',
      'waiting_result',
      'daily_work',
      'daily_pay',
    ]);
  });

  it('🔴 ยังไม่เคยตั้งสถานะ = ยังหาคนอยู่ → ต้องโชว์', () => {
    expect(isPublicVisibleByWorkStatus({})).toBe(true);
    expect(isPublicVisibleByWorkStatus({ work_status: null })).toBe(true);
    expect(isPublicVisibleByWorkStatus({ work_status: undefined })).toBe(true);
  });

  it('ค่าที่ไม่รู้จักไม่ทำให้ประกาศหาย (ห้ามเดาว่าซ่อน)', () => {
    expect(isPublicVisibleByWorkStatus({ work_status: 'อะไรไม่รู้' })).toBe(true);
    expect(isPublicVisibleByWorkStatus({ work_status: 42 })).toBe(true);
  });

  it('ใบที่ได้คนแล้วต้องไม่โชว์', () => {
    expect(isPublicVisibleByWorkStatus({ work_status: 'waiting_start' })).toBe(false);
    expect(isPublicVisibleByWorkStatus({ work_status: 'waiting_inform' })).toBe(false);
  });
});
