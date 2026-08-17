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
 * 🔴 ใบขอล่วงหน้าห้ามออกหน้าสาธารณะ (17 ส.ค. 2569)
 *
 * ทำไมต้องมีเทสต์: ของจริงหลุดไปแล้ว **18 ใบ** — ในนั้นเป็นใบที่คนซ้อมใช้ระบบใน ERP
 * วันที่ 24 ก.ค. ชื่อหน่วยงานเป็น `ช่วยหนูด้วย` / `อะ 10 20 30 40` / `so test`
 * และมีใบที่เอาชื่อลูกค้าจริง (`SCB ไทยพาณิชย์`) ไปใส่ในใบซ้อม
 * ถ้าด่านนี้หลุดอีกรอบ **คนนอกเห็นทันทีโดยไม่มีสัญญาณเตือน**
 */
describe('ใบขอล่วงหน้าห้ามออกหน้าสาธารณะ', () => {
  it('รู้จักใบล่วงหน้าจาก id `siamraj-pre:`', () => {
    expect(isPrequestJob({ id: 'siamraj-pre:OPL6907002' })).toBe(true);
    expect(isPrequestJob({ id: 'siamraj-sql:OPL6907002' })).toBe(false);
  });

  it('🔴 เลขที่ใบเปล่า ๆ ไม่พอ — ใบล่วงหน้ากับใบขอปกติเลขที่ซ้ำกันได้ (จริง 23 ใบ)', () => {
    // เลขเดียวกันเป๊ะ แต่ id คนละตัว → ใบปกติต้องโชว์ ใบล่วงหน้าต้องซ่อน
    expect(isPublicVisibleByPrequest({ id: 'siamraj-sql:OPL6907002' }, false)).toBe(true);
    expect(isPublicVisibleByPrequest({ id: 'siamraj-pre:OPL6907002' }, false)).toBe(false);
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

  it('🔴 ค่าเริ่มต้นของ env ต้องเป็น "ปิด" — ตั้งไม่ครบ/สะกดผิด ห้ามแปลว่าเปิด', () => {
    for (const v of [undefined, '', ' ', 'false', '0', 'no', 'off', 'ture', 'enabled', 'y']) {
      expect(isPublicPrequestEnabled(v)).toBe(false);
      expect(isPublicVisibleByPrequest({ id: 'siamraj-pre:X' }, isPublicPrequestEnabled(v))).toBe(
        false,
      );
    }
  });

  it('เปิดกลับได้ด้วย env — ค่าที่ยอมรับคือ true/1/yes/on', () => {
    for (const v of ['true', 'TRUE', ' true ', '1', 'yes', 'on']) {
      expect(isPublicPrequestEnabled(v)).toBe(true);
      expect(isPublicVisibleByPrequest({ id: 'siamraj-pre:X' }, isPublicPrequestEnabled(v))).toBe(
        true,
      );
    }
  });
});
