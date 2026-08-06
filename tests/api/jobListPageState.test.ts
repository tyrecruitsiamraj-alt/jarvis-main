import { describe, it, expect } from 'vitest';
import {
  buildJobListSearchParams,
  mergeJobListState,
  parseJobListSearchParams,
  JOB_LIST_DEFAULTS,
} from '../../src/lib/jobListPageState';

describe('jobListPageState', () => {
  it('parses and builds work status filter (ws) — single legacy value', () => {
    const state = parseJobListSearchParams(new URLSearchParams('ws=waiting_interview&p=3'));
    expect(state.workStatusFilter).toEqual(['waiting_interview']);
    expect(state.page).toBe(3);
    const params = buildJobListSearchParams(state);
    expect(params.get('ws')).toBe('waiting_interview');
    expect(params.get('p')).toBe('3');
  });

  it('parses and builds multiple work statuses (comma list)', () => {
    const state = parseJobListSearchParams(
      new URLSearchParams('ws=daily_work,daily_pay,bogus,all'),
    );
    expect(state.workStatusFilter).toEqual(['daily_work', 'daily_pay']); // ค่าเพี้ยน/all ถูกตัดทิ้ง
    const params = buildJobListSearchParams(state);
    expect(params.get('ws')).toBe('daily_work,daily_pay');
    // ว่าง = ทั้งหมด → ไม่ใส่ ws ใน URL
    expect(
      buildJobListSearchParams({ ...JOB_LIST_DEFAULTS, workStatusFilter: [] }).get('ws'),
    ).toBeNull();
  });

  it('resets page when work status filter changes', () => {
    const next = mergeJobListState(
      { ...JOB_LIST_DEFAULTS, page: 3, workStatusFilter: [] },
      { workStatusFilter: ['evaluating'] },
    );
    expect(next.page).toBe(1);
    expect(next.workStatusFilter).toEqual(['evaluating']);
  });

  it('keeps page when only page is patched', () => {
    const next = mergeJobListState({ ...JOB_LIST_DEFAULTS, page: 2 }, { page: 3 });
    expect(next.page).toBe(3);
  });

  it('ทุกฟิลเตอร์เริ่มต้นเป็น [] = ทั้งหมด และไม่โผล่ใน URL', () => {
    const params = buildJobListSearchParams(JOB_LIST_DEFAULTS);
    for (const key of ['u', 'd', 'st', 'y', 'r', 'sc', 'opl', 'urg', 'ws', 'nf', 'sr', 'ag']) {
      expect(params.get(key)).toBeNull();
    }
  });

  it('อ่านลิงก์เก่าที่เป็นค่าเดี่ยวได้ (backward compatible)', () => {
    const state = parseJobListSearchParams(
      new URLSearchParams('d=DS&st=driver&y=2569&r=ตั้ม&sc=เนส&opl=อั๋น&urg=urgent&nf=has&sr=send&ag=1-7'),
    );
    expect(state.departmentFilter).toEqual(['DS']);
    expect(state.jobSubtypeFilter).toEqual(['driver']);
    expect(state.recruiterFilter).toEqual(['ตั้ม']);
    expect(state.screenerFilter).toEqual(['เนส']);
    expect(state.oplFilter).toEqual(['อั๋น']);
    expect(state.urgencyFilter).toEqual(['urgent']);
    expect(state.noteFilter).toEqual(['has']);
    expect(state.replacementFilter).toEqual(['send']);
    expect(state.ageDaysFilter).toEqual(['1-7']);
  });

  it('ลิงก์เก่าที่มีตัวกรองปี (y=) ถูกมองข้าม — เอาฟิลเตอร์ปีออกจากหน้าแล้ว', () => {
    const state = parseJobListSearchParams(new URLSearchParams('y=2569&d=DS'));
    expect('yearFilter' in state).toBe(false);
    expect(state.departmentFilter).toEqual(['DS']);
    expect(buildJobListSearchParams(state).has('y')).toBe(false);
  });

  it('ลิงก์เก่าที่ระบุ all แปลว่าทั้งหมด → []', () => {
    const state = parseJobListSearchParams(new URLSearchParams('d=all&urg=all&nf=all&sr=all&y=all'));
    expect(state.departmentFilter).toEqual([]);
    expect(state.urgencyFilter).toEqual([]);
    expect(state.noteFilter).toEqual([]);
    expect(state.replacementFilter).toEqual([]);
  });

  it('อ่าน/เขียนหลายค่าได้ครบทุกฟิลเตอร์ และตัดค่าเพี้ยน/ค่าซ้ำทิ้ง', () => {
    const state = parseJobListSearchParams(
      new URLSearchParams('d=DS,LM,DS&urg=urgent,advance,bogus&nf=has,empty&sr=send,no_send,unset&r=ตั้ม,เล็ก'),
    );
    expect(state.departmentFilter).toEqual(['DS', 'LM']); // ซ้ำถูกตัด
    expect(state.urgencyFilter).toEqual(['urgent', 'advance']); // bogus ถูกตัด
    expect(state.noteFilter).toEqual(['has', 'empty']);
    expect(state.replacementFilter).toEqual(['send', 'no_send', 'unset']);
    expect(state.recruiterFilter).toEqual(['ตั้ม', 'เล็ก']);

    const params = buildJobListSearchParams(state);
    expect(params.get('d')).toBe('DS,LM');
    expect(params.get('urg')).toBe('urgent,advance');
    expect(params.get('r')).toBe('ตั้ม,เล็ก');
  });

  it('urgency ค่าเก่า overdue/escalated ถูก map เป็น advance', () => {
    expect(parseJobListSearchParams(new URLSearchParams('urg=overdue')).urgencyFilter).toEqual(['advance']);
    expect(parseJobListSearchParams(new URLSearchParams('urg=escalated')).urgencyFilter).toEqual(['advance']);
  });

  it('ช่วงวันผ่านมาแบบเก่า (8-14 / 15-30) ถูกแปลงเป็นช่วงปัจจุบัน', () => {
    expect(parseJobListSearchParams(new URLSearchParams('ag=8-14,15-30')).ageDaysFilter).toEqual([
      '8-15',
      '16-30',
    ]);
  });

  it('เปลี่ยนฟิลเตอร์ตัวไหนก็รีเซ็ตกลับหน้า 1', () => {
    for (const patch of [
      { departmentFilter: ['DS'] },
      { urgencyFilter: ['urgent' as const] },
      { noteFilter: ['has' as const] },
      { recruiterFilter: ['ตั้ม'] },
    ]) {
      expect(mergeJobListState({ ...JOB_LIST_DEFAULTS, page: 5 }, patch).page).toBe(1);
    }
  });
});
