import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import { buildOverridesPatch, formDiffersFromJob, formStateFromJob } from '@/lib/publicFieldsForm';

/**
 * ฟอร์มข้อมูลที่จะขึ้นประกาศ (ป๊อปไล่งานขั้น 2/3) — บั๊กจริงที่เจอ 27 ก.ย. 2569:
 * แค่เปิดขั้น 3 ดู ฟอร์มก็ auto-save เอง วนทุก 1.5 วินาที (ใบเดียว 44 ครั้ง) เขียนเลข ERP 400
 * เป็น "รายได้ที่ Online ตั้ง" และล้างการตั้ง "ซ่อนรายได้จากหน้าสาธารณะ" ของอีกใบ
 *
 * ด่านที่ห้ามหลุด:
 * 1. ฟอร์มที่เติมจากใบขอ = "ไม่มีอะไรเปลี่ยน" เสมอ (เปิดดูเฉย ๆ ห้ามยิงบันทึก)
 * 2. หลังบันทึก (ใบขอฝั่งแม่ถือค่าที่เพิ่งบันทึก) = ไม่มีอะไรเปลี่ยน (วนไม่ได้)
 * 3. ยอดรวมไม่เติมเลข ERP — ใบที่ยังไม่ตั้งรายได้ต้องยัง "ยังไม่ตั้ง" อยู่
 * 4. การตั้งซ่อนช่องบนหน้าสาธารณะต้องอยู่ครบ
 */

const job = (over: Partial<JobRequest> = {}) =>
  ({ id: 'siamraj-sql:T1', request_no: 'T1', total_income: 400, ...over }) as JobRequest;

const stOf = (j: JobRequest) => ({ job: j, ...formStateFromJob(j) });

describe('formStateFromJob', () => {
  it('🔴 ยังไม่ตั้งรายได้ = ช่องยอดรวมว่าง (ไม่เติมเลข ERP 400 ให้เอง)', () => {
    expect(formStateFromJob(job()).incomeTotal).toBe('');
    // บันทึกไปก็ต้องยังเป็น "ยังไม่ตั้ง" (total_income = null = ใช้ค่า ERP)
    expect(buildOverridesPatch(stOf(job())).total_income).toBeNull();
  });

  it('ยอดรวมที่ทีม Online ตั้งไว้ (รวม 0 ที่ตั้งใจ) กลับมาในช่อง', () => {
    expect(formStateFromJob(job({ field_overrides: { total_income: 15000 } })).incomeTotal).toBe('15000');
    expect(formStateFromJob(job({ field_overrides: { total_income: 0 } })).incomeTotal).toBe('0');
  });

  it('การตั้ง "ซ่อนรายได้จากหน้าสาธารณะ" อยู่ครบ', () => {
    const j = job({ field_overrides: { public_visibility: { income: false } } });
    expect(formStateFromJob(j).visibility.income).toBe(false);
    expect(buildOverridesPatch(stOf(j)).public_visibility).toEqual({ income: false });
  });
});

describe('formDiffersFromJob — ด่านเดียวที่ตัดสินว่าจะยิงบันทึก', () => {
  const saved = job({
    override_province: 'ลพบุรี',
    extra_benefits: ['ชุดฟอร์ม'],
    // ⚠️ type ของ JobRequest.field_overrides ฝั่งจอไม่มีคีย์ที่อยู่ (feed แตกไปเป็น override_*)
    // แต่ของจริงจาก API มีครบ — จำลองให้ตรงของจริง
    field_overrides: {
      province: 'ลพบุรี',
      benefits: ['ชุดฟอร์ม'],
      total_income: 12000,
      public_visibility: { income: false },
      gender: 'ชาย',
    } as JobRequest['field_overrides'],
  });

  it('🔴 เปิดดูเฉย ๆ = ไม่มีอะไรเปลี่ยน (ห้ามยิง)', () => {
    expect(formDiffersFromJob(stOf(saved))).toBe(false);
    expect(formDiffersFromJob(stOf(job()))).toBe(false);
  });

  it('🔴 หลังบันทึก ใบขอฝั่งแม่ถือค่าที่เพิ่งบันทึก = ไม่มีอะไรเปลี่ยน (ไม่วน)', () => {
    const edited = { ...stOf(saved), incomeTotal: '13000' };
    expect(formDiffersFromJob(edited)).toBe(true);
    const patch = buildOverridesPatch(edited);
    const after = { ...saved, field_overrides: patch } as JobRequest;
    expect(formDiffersFromJob({ ...edited, job: after })).toBe(false);
  });

  it('แก้จริง = ต่าง (ยิงบันทึก) · คีย์ของขั้นอื่น (เพศ) ถูกพาไปด้วยไม่หาย', () => {
    const edited = { ...stOf(saved), province: 'สระบุรี' };
    expect(formDiffersFromJob(edited)).toBe(true);
    expect(buildOverridesPatch(edited).gender).toBe('ชาย');
  });

  it('ฟอร์มค่าว่าง (ยังเติมไม่ทัน) บนใบที่มีค่า = ต่าง — จึงต้องเริ่มฟอร์มจากใบขอตั้งแต่ render แรก', () => {
    const blank = {
      job: saved,
      province: '',
      district: '',
      subdistrict: '',
      incomePeriod: 'monthly' as const,
      incomeRows: [],
      incomeTotal: '',
      benefitText: '',
      visibility: { income: true, benefits: true, ot: true, boss_nationality: true, required_date: true },
    };
    expect(formDiffersFromJob(blank)).toBe(true);
  });
});
