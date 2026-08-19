import { describe, it, expect } from 'vitest';
import {
  JOB_BOX_KEYS,
  JOB_BOX_LABEL,
  OPEN_BOX_KEYS,
  closedJobBoxOf,
  countOpenBoxes,
  filterByClosedBox,
  filterByOpenBox,
  isClosedBox,
  openJobBoxOf,
} from '../../src/lib/jobBoxGroups';

/** สถานะจริงทั้ง 9 ตัวใน work_status_master (วัดจากฐาน 19 ส.ค. 2569) */
const REAL_STATUSES = [
  'in_progress',
  'on_hold',
  'evaluating',
  'waiting_inform',
  'waiting_interview',
  'waiting_result',
  'waiting_start',
  'daily_work',
  'daily_pay',
] as const;

describe('openJobBoxOf', () => {
  it('🔴 ทุกสถานะจริงต้องมีกล่องรับ — เพิ่มสถานะใหม่แล้วลืมแมป เทสต์นี้จะจับได้', () => {
    for (const s of REAL_STATUSES) {
      expect(OPEN_BOX_KEYS).toContain(openJobBoxOf({ work_status: s }));
    }
  });

  it('🔴 ยังไม่ตั้งสถานะ = กำลังสรรหา (ของจริง 193 จาก 293 ใบ — ตกกล่องแล้วหายทั้งหน้า)', () => {
    expect(openJobBoxOf({})).toBe('sourcing');
    expect(openJobBoxOf({ work_status: null })).toBe('sourcing');
    expect(openJobBoxOf({ work_status: '   ' })).toBe('sourcing');
  });

  it('สถานะที่ไม่รู้จักก็ยังตกกล่องสรรหา ไม่ใช่หายไป', () => {
    expect(openJobBoxOf({ work_status: 'สถานะที่ยังไม่มีในระบบ' })).toBe('sourcing');
  });

  it('จับกลุ่มตามที่เจ้าของเคาะ', () => {
    expect(openJobBoxOf({ work_status: 'in_progress' })).toBe('sourcing');
    expect(openJobBoxOf({ work_status: 'on_hold' })).toBe('sourcing');
    expect(openJobBoxOf({ work_status: 'evaluating' })).toBe('selecting');
    expect(openJobBoxOf({ work_status: 'waiting_interview' })).toBe('selecting');
    expect(openJobBoxOf({ work_status: 'waiting_result' })).toBe('selecting');
    expect(openJobBoxOf({ work_status: 'waiting_inform' })).toBe('waiting');
    expect(openJobBoxOf({ work_status: 'waiting_start' })).toBe('waiting');
    expect(openJobBoxOf({ work_status: 'daily_work' })).toBe('started');
    expect(openJobBoxOf({ work_status: 'daily_pay' })).toBe('started');
  });
});

describe('countOpenBoxes', () => {
  /** สัดส่วนจริงจาก feed วันที่ 19 ส.ค. 2569 (293 ใบ) */
  const realMix = [
    ...Array.from({ length: 193 }, () => ({})),
    ...Array.from({ length: 25 }, () => ({ work_status: 'in_progress' })),
    ...Array.from({ length: 1 }, () => ({ work_status: 'on_hold' })),
    ...Array.from({ length: 10 }, () => ({ work_status: 'evaluating' })),
    ...Array.from({ length: 16 }, () => ({ work_status: 'waiting_interview' })),
    ...Array.from({ length: 3 }, () => ({ work_status: 'waiting_result' })),
    ...Array.from({ length: 19 }, () => ({ work_status: 'waiting_inform' })),
    ...Array.from({ length: 16 }, () => ({ work_status: 'waiting_start' })),
    ...Array.from({ length: 5 }, () => ({ work_status: 'daily_work' })),
    ...Array.from({ length: 5 }, () => ({ work_status: 'daily_pay' })),
  ];

  it('🔴 ผลรวมทุกกล่อง = จำนวนใบทั้งหมด (ห้ามมีใบตกหล่น)', () => {
    const counts = countOpenBoxes(realMix);
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(realMix.length);
    expect(sum).toBe(293);
  });

  it('ได้ตัวเลขตรงกับของจริง', () => {
    expect(countOpenBoxes(realMix)).toEqual({
      sourcing: 219, // 193 + 25 + 1
      selecting: 29, // 10 + 16 + 3
      waiting: 35, // 19 + 16
      started: 10, // 5 + 5
    });
  });

  it('ไม่มีใบเลย = ศูนย์ทุกกล่อง', () => {
    expect(countOpenBoxes([])).toEqual({ sourcing: 0, selecting: 0, waiting: 0, started: 0 });
  });
});

describe('filterByOpenBox', () => {
  const jobs = [
    { id: 'a' },
    { id: 'b', work_status: 'waiting_inform' },
    { id: 'c', work_status: 'daily_pay' },
  ];
  it('เลือกกล่องแล้วเหลือเฉพาะใบในกล่องนั้น', () => {
    expect(filterByOpenBox(jobs, 'waiting').map((j) => j.id)).toEqual(['b']);
    expect(filterByOpenBox(jobs, 'sourcing').map((j) => j.id)).toEqual(['a']);
  });
  it('ไม่เลือกกล่อง = ได้ครบทุกใบ', () => {
    expect(filterByOpenBox(jobs, null)).toHaveLength(3);
  });
});

describe('ปิดแล้ว vs ยกเลิก', () => {
  it('🔴 มี cancel_date = ยกเลิก · ไม่มี = ปิดปกติ (เดิมสองอย่างนี้กองรวมกัน)', () => {
    expect(closedJobBoxOf({ cancel_date: '2026-08-01' })).toBe('cancelled');
    expect(closedJobBoxOf({})).toBe('closed');
    expect(closedJobBoxOf({ cancel_date: null })).toBe('closed');
    expect(closedJobBoxOf({ cancel_date: '  ' })).toBe('closed');
  });

  it('กรองแล้วสองกล่องรวมกัน = ทั้งหมด ไม่ทับกัน', () => {
    const rows = [
      { id: '1', cancel_date: '2026-08-01' },
      { id: '2' },
      { id: '3', cancel_date: '2026-07-30' },
    ];
    const c = filterByClosedBox(rows, 'cancelled');
    const k = filterByClosedBox(rows, 'closed');
    expect(c.map((r) => r.id)).toEqual(['1', '3']);
    expect(k.map((r) => r.id)).toEqual(['2']);
    expect(c.length + k.length).toBe(rows.length);
  });
});

describe('รายการกล่อง', () => {
  it('มี 6 กล่องตามที่เจ้าของเคาะ และมีชื่อครบทุกกล่อง', () => {
    expect(JOB_BOX_KEYS).toHaveLength(6);
    for (const k of JOB_BOX_KEYS) expect(JOB_BOX_LABEL[k]).toBeTruthy();
  });
  it('แยกได้ว่ากล่องไหนต้องไปอ่าน feed ใบปิด', () => {
    expect(isClosedBox('closed')).toBe(true);
    expect(isClosedBox('cancelled')).toBe(true);
    expect(isClosedBox('sourcing')).toBe(false);
  });
});
