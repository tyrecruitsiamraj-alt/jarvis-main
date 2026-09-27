import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import {
  erpGenderLabel,
  genderLabel,
  genderNeedsChoice,
  onlineGenderChoice,
} from '@/lib/genderRequirement';

/**
 * เพศที่รับ (เจ้าของเคาะ 26 ก.ย. 2569 — ใบขอเป็น O ต้องเลือกก่อนส่งประกาศ · ช่องอยู่ขั้น 1)
 * ด่านที่ห้ามหลุด:
 * 1. O / B / ว่าง บนจอ = "ไม่ระบุ" (ไม่ใช่ตัว O ดิบ)
 * 2. ใบขอ O ที่ทีม Online ยังไม่เลือก = ต้องเลือกก่อนส่ง
 * 3. เลือกแล้ว (ชาย/หญิง/ไม่จำกัด) = ส่งได้ · ค่าแปลกที่หน้าอื่นเผลอเก็บไว้ไม่นับว่าเลือกแล้ว
 */

const job = (over: Partial<JobRequest>) => over as JobRequest;

describe('genderLabel', () => {
  it('รหัส ERP → คำบนจอ', () => {
    expect(genderLabel('M')).toBe('ชาย');
    expect(genderLabel('หญิง')).toBe('หญิง');
    expect(genderLabel('ไม่จำกัด')).toBe('ไม่จำกัด');
    expect(genderLabel('O')).toBe('ไม่ระบุ');
    expect(genderLabel('ไม่ระบุ')).toBe('ไม่ระบุ');
    expect(genderLabel('')).toBe('ไม่ระบุ');
    expect(genderLabel(undefined)).toBe('ไม่ระบุ');
  });
});

describe('genderNeedsChoice — ต้องเลือกก่อนส่งประกาศไหม', () => {
  it('🔴 ใบขอเป็น O และยังไม่มีใครเลือก = ต้องเลือก', () => {
    expect(genderNeedsChoice(job({ gender_requirement: 'O' }))).toBe(true);
    expect(genderNeedsChoice(job({ gender_requirement: undefined }))).toBe(true);
  });

  it('ใบขอบอกชาย/หญิงมาแล้ว = ส่งได้', () => {
    expect(genderNeedsChoice(job({ gender_requirement: 'ชาย' }))).toBe(false);
  });

  it('ทีม Online เลือกแล้ว (feed ทับค่าให้แล้ว) = ส่งได้ และยังรู้ว่าใบขอเขียนอะไร', () => {
    const j = job({
      gender_requirement: 'ไม่จำกัด',
      erp_gender_requirement: 'O',
      field_overrides: { gender: 'ไม่จำกัด' },
    });
    expect(onlineGenderChoice(j)).toBe('ไม่จำกัด');
    expect(genderNeedsChoice(j)).toBe(false);
    expect(erpGenderLabel(j)).toBe('ไม่ระบุ');
  });

  it('ค่าแปลกที่หน้าอื่นเผลอเก็บไว้ (เช่น O) ไม่นับว่าเลือกแล้ว', () => {
    const j = job({ gender_requirement: 'O', erp_gender_requirement: 'O', field_overrides: { gender: 'O' } });
    expect(onlineGenderChoice(j)).toBeNull();
    expect(genderNeedsChoice(j)).toBe(true);
  });
});
