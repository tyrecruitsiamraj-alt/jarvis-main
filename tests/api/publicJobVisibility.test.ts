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
  isPrequestJob,
  isPublicPrequestEnabled,
  isPublicVisibleByPrequest,
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

/**
 * ใบขอล่วงหน้าออกหน้าสาธารณะได้ (เจ้าของเคาะเย็น 17 ส.ค. 2569)
 *
 * ทำไมยังต้องมีเทสต์ทั้งที่เปิดแล้ว: ตัวสวิตช์ยังอยู่ (ปิดฉุกเฉินได้) และ**การแยกใบ
 * ล่วงหน้าออกจากใบขอปกติยังสำคัญเท่าเดิม** เพราะเลขที่ใบซ้ำกันจริง 23 ใบ —
 * `isPrequestJob` ผิดเมื่อไหร่ = ปิด/เปิดผิดใบ และอัตราค่าจ้างไปดึงผิดบริษัท
 */
describe('ใบขอล่วงหน้าออกหน้าสาธารณะ (เจ้าของสั่งเปิด 17 ส.ค. เย็น)', () => {
  it('รู้จักใบล่วงหน้าจาก id `siamraj-pre:`', () => {
    expect(isPrequestJob({ id: 'siamraj-pre:OPL6907002' })).toBe(true);
    expect(isPrequestJob({ id: 'siamraj-sql:OPL6907002' })).toBe(false);
  });

  it('🔴 เลขที่ใบเปล่า ๆ ไม่พอ — ใบล่วงหน้ากับใบขอปกติเลขที่ซ้ำกันได้ (จริง 23 ใบ)', () => {
    // เลขเดียวกันเป๊ะ แต่ id คนละตัว → ตอนสั่งปิด ต้องปิดเฉพาะฝั่งล่วงหน้า
    expect(isPublicVisibleByPrequest({ id: 'siamraj-sql:OPL6907002' }, false)).toBe(true);
    expect(isPublicVisibleByPrequest({ id: 'siamraj-pre:OPL6907002' }, false)).toBe(false);
  });

  it('🔴 ค่าเริ่มต้น = เปิด (เจ้าของสั่ง "เอาขึ้นไปเลย") — ไม่ตั้ง env ก็ต้องขึ้น', () => {
    for (const v of [undefined, '', '  ']) {
      expect(isPublicPrequestEnabled(v)).toBe(true);
      expect(isPublicVisibleByPrequest({ id: 'siamraj-pre:X' }, isPublicPrequestEnabled(v))).toBe(true);
    }
  });

  it('ธง is_prequest ก็จับได้ (บางเส้นส่ง id มาไม่ครบ)', () => {
    expect(isPrequestJob({ is_prequest: true })).toBe(true);
    expect(isPublicVisibleByPrequest({ is_prequest: true }, false)).toBe(false);
  });

  it('ใบขอปกติต้องไม่โดนกรองทิ้งไปด้วย', () => {
    expect(isPrequestJob({ id: 'siamraj-sql:LAO6907002' })).toBe(false);
    expect(isPrequestJob({})).toBe(false);
    expect(isPublicVisibleByPrequest({}, false)).toBe(true);
  });

  it('🔴 ปิดฉุกเฉินต้องเขียนคำว่าปิดชัด ๆ — false/0/no/off เท่านั้น', () => {
    for (const v of ['false', 'FALSE', ' false ', '0', 'no', 'off']) {
      expect(isPublicPrequestEnabled(v)).toBe(false);
      expect(isPublicVisibleByPrequest({ id: 'siamraj-pre:X' }, isPublicPrequestEnabled(v))).toBe(
        false,
      );
    }
  });

  it('คำที่สะกดเพี้ยนไม่ทำให้ประกาศหายทั้งกอง (ตีความว่าเปิดตามค่าเริ่มต้น)', () => {
    for (const v of ['ture', 'flase', 'disabled', 'ปิด', 'y']) {
      expect(isPublicPrequestEnabled(v)).toBe(true);
    }
  });
});
