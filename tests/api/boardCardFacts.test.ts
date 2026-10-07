/** การ์ดหน้างานสรรหาต้องบอกครบ: จังหวัด+เขต/อำเภอ · รายได้ · เพศ อายุ · ชื่อหน่วยงาน (เจ้าของ 4 ต.ค. 2569 ข้อ 7) */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import { boardCardAge, boardCardGender, boardCardPlace, boardCardUnitName } from '@/lib/boardCardFacts';

const job = (over: Partial<JobRequest>): JobRequest => ({ id: 'x', request_no: 'R1', ...over }) as JobRequest;

describe('boardCardPlace — จังหวัด · เขต/อำเภอ', () => {
  it('ถอดจากที่อยู่ใบขอ · ตัดคำนำหน้า เขต/อ.', () => {
    expect(boardCardPlace(job({ location_address: 'แขวงช่องนนทรี เขตยานนาวา กรุงเทพมหานคร 10120' }))).toBe('กรุงเทพมหานคร · ยานนาวา');
    expect(boardCardPlace(job({ location_address: 'ต.บางโฉลง อ.บางพลี จ.สมุทรปราการ' }))).toBe('สมุทรปราการ · บางพลี');
  });
  it('ทีม Online กรอกเองชนะที่อยู่ใบขอ · ไม่รู้จังหวัด = บอกตรง ๆ', () => {
    expect(boardCardPlace(job({ override_province: 'ชลบุรี', override_district: 'อำเภอศรีราชา', location_address: '' }))).toBe('ชลบุรี · ศรีราชา');
    expect(boardCardPlace(job({ location_address: '' }))).toBe('ยังไม่ระบุสถานที่');
  });
});

describe('เพศ · อายุ', () => {
  it('ทีม Online เลือกชนะใบขอ · ไม่ระบุ = known false (สีเตือน)', () => {
    expect(boardCardGender(job({ gender_requirement: 'M' }))).toEqual({ text: 'ชาย', known: true });
    expect(boardCardGender(job({ gender_requirement: 'O', field_overrides: { gender: 'หญิง' } }))).toEqual({ text: 'หญิง', known: true });
    expect(boardCardGender(job({ gender_requirement: 'O' }))).toEqual({ text: 'ไม่ระบุเพศ', known: false });
    expect(boardCardGender(job({ field_overrides: { gender: 'ไม่จำกัด' } }))).toEqual({ text: 'ไม่จำกัดเพศ', known: true });
  });
  it('อายุทุกรูป', () => {
    expect(boardCardAge({ age_range_min: 20, age_range_max: 55 })).toBe('อายุ 20–55 ปี');
    expect(boardCardAge({ age_range_min: 25, age_range_max: 25 })).toBe('อายุ 25 ปี');
    expect(boardCardAge({ age_range_min: 18, age_range_max: null })).toBe('อายุ 18 ปีขึ้นไป');
    expect(boardCardAge({ age_range_min: null, age_range_max: 45 })).toBe('อายุไม่เกิน 45 ปี');
    expect(boardCardAge({ age_range_min: 0, age_range_max: null })).toBe('ไม่ระบุอายุ');
  });
});

describe('ชื่อหน่วยงาน', () => {
  it('โชว์เมื่อต่างจากหัวการ์ด (หัว = จุดทำงาน) · ซ้ำ/ว่าง = ไม่โชว์', () => {
    expect(boardCardUnitName(job({ work_site_name: 'KYE', unit_name: 'บริษัท เควายอี จำกัด' }))).toBe('บริษัท เควายอี จำกัด');
    expect(boardCardUnitName(job({ unit_name: 'บริษัท เควายอี จำกัด' }))).toBeNull();
    expect(boardCardUnitName(job({ work_site_name: 'KYE', unit_name: '' }))).toBeNull();
  });
  /** 5 ต.ค. 2569: ข้อมูลงานย้ายไป `JobPublicFacts` ตัวเดียวกับหน้า /apply · ชื่อคู่สัญญาถอดจากการ์ด (หน้า /apply ไม่มี) */
  it('การ์ดใช้ส่วนข้อมูลตัวเดียวกับหน้า /apply · ส่วนนั้นใช้ตัวกลางครบ', () => {
    const card = readFileSync('src/components/jobs/BoardJobCard.tsx', 'utf8');
    expect(card).toContain('<JobPublicFacts job={job} staff />');
    expect(card).not.toContain('boardCardUnitName(job)');
    const facts = readFileSync('src/components/jobs/JobPublicFacts.tsx', 'utf8');
    for (const f of ['boardCardPlace(job)', 'boardCardAge(job)', 'boardCardGender(job)', 'jobIncomeLine(job)', 'jobAverageIncome(job)']) {
      expect(facts).toContain(f);
    }
  });
});
