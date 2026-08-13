import { describe, it, expect } from 'vitest';
import {
  DRIVING_POSITION_LABEL,
  isDrivingJobPosition,
  isDrivingPositionPreset,
  jobMatchesPositionFilter,
  jobMatchesStaffFilters,
  resolveApplyPositionPreset,
} from '../../src/lib/jobBoardPositionPreset';
import type { JobRequest } from '@/types';

function job(partial: Partial<JobRequest>): JobRequest {
  return {
    id: '1',
    job_type: 'central',
    job_category: 'private',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    location_address: 'Bangkok',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_date: '2026-07-01',
    required_date: '2026-07-10',
    created_at: '2026-07-01',
    unit_name: 'Test',
    ...partial,
  };
}

describe('jobBoardPositionPreset', () => {
  it('resolves driving aliases to locked งานขับรถ', () => {
    expect(isDrivingPositionPreset('ขับรถ')).toBe(true);
    expect(isDrivingPositionPreset('งานขับรถ')).toBe(true);
    expect(isDrivingPositionPreset('พขร')).toBe(true);
    const preset = resolveApplyPositionPreset('ขับรถ');
    expect(preset).toEqual({
      positionFilter: DRIVING_POSITION_LABEL,
      locked: true,
      isDrivingGroup: true,
    });
  });

  it('matches พขร / valet labels as driving jobs', () => {
    expect(isDrivingJobPosition(job({ job_description_code_1: 'พขร. (ปตน.)' }))).toBe(true);
    expect(isDrivingJobPosition(job({ job_description_code_1: 'พขร. (Valet Parking)' }))).toBe(true);
    expect(isDrivingJobPosition(job({ job_description_code_1: 'พนักงานธุรการ' }))).toBe(false);
    expect(
      jobMatchesPositionFilter(job({ job_description_code_1: 'พขร. (ส่วนกลาง)' }), DRIVING_POSITION_LABEL, {
        isDrivingGroup: true,
      }),
    ).toBe(true);
  });
});

describe('ตัวกรองฝั่งเจ้าหน้าที่ — ประเภทงาน + เจ้าหน้าที่สรรหา (เจ้าของสั่ง 13 ส.ค. 2569)', () => {
  const j = (recruiter?: string, contract?: string) => ({
    recruiter_name: recruiter,
    contract_type_name: contract,
  });

  it('ไม่ได้กรองอะไร = ผ่านทุกใบ', () => {
    expect(jobMatchesStaffFilters(j('คิว', 'คน+รถ'), {})).toBe(true);
    expect(jobMatchesStaffFilters(j(), { recruiter: '', contractType: '' })).toBe(true);
  });

  it('กรองประเภทงานได้ตรงตัว', () => {
    expect(jobMatchesStaffFilters(j('คิว', 'คน+รถ'), { contractType: 'คน+รถ' })).toBe(true);
    expect(jobMatchesStaffFilters(j('คิว', 'คนอย่างเดียว'), { contractType: 'คน+รถ' })).toBe(false);
  });

  it('⚠️ ชื่อเจ้าหน้าที่ต้องเทียบตรงตัว ไม่ใช่ "มีคำนี้อยู่"', () => {
    // ชื่อเล่นเจ้าหน้าที่สั้นและเป็นคำนำหน้าของกันได้ (ฐานจริงมี "กร" · เพิ่มคน
    // ชื่อ "กรกฎ" เมื่อไหร่ ถ้าเทียบแบบ includes จะกรอง "กร" แล้วได้ใบของ "กรกฎ" ปนมา)
    expect(jobMatchesStaffFilters(j('กร'), { recruiter: 'กร' })).toBe(true);
    expect(jobMatchesStaffFilters(j('กรกฎ'), { recruiter: 'กร' })).toBe(false);
    expect(jobMatchesStaffFilters(j('หมิว'), { recruiter: 'หมี' })).toBe(false);
  });

  it('ใบที่ไม่ได้กรอกชื่อเจ้าหน้าที่ ต้องไม่ถูกนับเป็นของใครสักคน', () => {
    expect(jobMatchesStaffFilters(j(undefined, 'คน+รถ'), { recruiter: 'คิว' })).toBe(false);
  });

  it('เว้นวรรคหัวท้ายไม่ทำให้กรองพลาด', () => {
    expect(jobMatchesStaffFilters(j('  คิว  '), { recruiter: 'คิว' })).toBe(true);
    expect(jobMatchesStaffFilters(j('คิว'), { recruiter: ' คิว ' })).toBe(true);
  });

  it('กรองสองตัวพร้อมกัน = ต้องเข้าเงื่อนไขทั้งคู่', () => {
    expect(jobMatchesStaffFilters(j('คิว', 'คน+รถ'), { recruiter: 'คิว', contractType: 'คน+รถ' })).toBe(true);
    expect(jobMatchesStaffFilters(j('คิว', 'คนอย่างเดียว'), { recruiter: 'คิว', contractType: 'คน+รถ' })).toBe(false);
  });
});
