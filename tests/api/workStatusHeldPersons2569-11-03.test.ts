// @vitest-environment node
/**
 * สถานะทำงาน: กลับเป็น "ดำเนินการ" แล้วชื่อคนไม่หาย (เจ้าของ 3 พ.ย. 2569 "พอกลับมาเป็นดำเนินการชื่อคนมันหายอะ")
 * Choice "เก็บชื่อไว้ เลือกสถานะเดิมแล้วขึ้นกลับมา" — ดำเนินการไม่โชว์ชื่อ แต่เก็บไว้ใน held_persons
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapRow } from '../../api/_lib/siamrajUnitWorkStatus';

const people = [{ first_name: 'สมชาย', last_name: 'ใจดี', status_date: '2026-11-03' }];
const row = (status: string) => ({
  request_no: 'LAM6909002',
  status,
  person_first_name: null,
  person_last_name: null,
  status_date: null,
  persons: people,
  updated_at: '2026-11-03T03:00:00Z',
});

describe('ชื่อคนตอนสถานะดำเนินการ', () => {
  it('ดำเนินการ = ไม่โชว์ชื่อ แต่เก็บไว้ใน held_persons', () => {
    const r = mapRow(row('in_progress'));
    expect(r.persons).toEqual([]);
    expect(r.person_first_name).toBeNull();
    expect(r.held_persons).toEqual(people);
  });
  it('สถานะที่ต้องมีชื่อ = โชว์ชื่อ · held_persons ว่าง', () => {
    const r = mapRow(row('waiting_interview'));
    expect(r.persons).toEqual(people);
    expect(r.person_first_name).toBe('สมชาย');
    expect(r.held_persons).toEqual([]);
  });
  it('บันทึกดำเนินการ = เก็บชื่อชุดล่าสุดไว้ · หน้าใบขอส่งชื่อที่เก็บไว้ให้ช่องชื่อ', () => {
    const lib = readFileSync('api/_lib/siamrajUnitWorkStatus.ts', 'utf8');
    expect(lib).toContain("input.status === 'in_progress' ? (previous ? (previous.status === 'in_progress' ? previous.held_persons : previous.persons) : []) : persons;");
    expect(lib).toContain('JSON.stringify(storedPersons)');
    expect(readFileSync('api/_handlers/siamraj-unit-requests.ts', 'utf8')).toContain('it.work_held_persons = w.held_persons;');
    expect(readFileSync('src/pages/jobs/SiamrajUnitRequestDetailPage.tsx', 'utf8')).toContain('initialHeldPersons={data.work_held_persons}');
    expect(readFileSync('src/components/jobs/UnitRequestWorkStatusField.tsx', 'utf8')).toContain('initialPersons && initialPersons.length > 0 ? initialPersons : initialHeldPersons');
  });
});
