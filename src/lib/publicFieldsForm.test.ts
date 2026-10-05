import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import {
  MANUAL_INCOME_LINE_LABEL,
  RESIGNED_INCOME_LINE_LABEL,
  benefitDetailMax,
  benefitEntriesFromText,
  benefitLineOf,
  benefitTextFromEntries,
  buildOverridesPatch,
  formDiffersFromJob,
  formStateForSections,
  formStateFromJob,
  incomeDraftFromForm,
  incomeFormFromDraft,
  placeGuessForForm,
  placeModeOf,
} from '@/lib/publicFieldsForm';
import { cleanBenefitLines } from '@/lib/incomeBreakdown';

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
      payCycles: [],
      visibility: { income: true, benefits: true, ot: true, boss_nationality: true, required_date: true, average_income: true },
    };
    expect(formDiffersFromJob(blank)).toBe(true);
  });
});

/**
 * ═══ ป๊อปไล่งานโฉมใหม่ (30 ก.ย. 2569) — ตัวแปลงหน้าฟอร์ม ═══
 * 🔴 ด่านใหญ่: ของที่บันทึกไว้ → ฟอร์มโฉมใหม่ → กลับเป็นของที่จะบันทึก ต้อง **เท่าเดิมเป๊ะ**
 *    ไม่งั้นแค่เปิดขั้น 2/3 ดูก็ยิงบันทึกเอง (บั๊ก 27 ก.ย. ใบเดียว 44 ครั้ง)
 */
describe('ขั้น 2 — ใบขอเขียนว่า / ใส่รายละเอียดเอง', () => {
  it('มีช่องไหนตั้งเองไว้ = ใส่เอง · ว่างหมด = ตามใบขอ', () => {
    expect(placeModeOf({ province: '', district: '', subdistrict: '' })).toBe('request');
    expect(placeModeOf({ province: 'ลพบุรี', district: '', subdistrict: '' })).toBe('manual');
    expect(placeModeOf({ province: '', district: ' ', subdistrict: 'ท่าหิน' })).toBe('manual');
  });

  it('ติ๊กใส่เอง = เลือกค่าที่อ่านจากใบขอไว้ให้ก่อน · ตัดคำนำหน้า/ข้อความท้ายให้ตรงรายการมาตรฐาน', () => {
    expect(placeGuessForForm('99 ถ.สีลม แขวงสุริยวงศ์ เขตบางรัก กรุงเทพมหานคร 10500')).toEqual({
      province: 'กรุงเทพมหานคร',
      district: 'บางรัก',
      subdistrict: 'สุริยวงศ์',
    });
    // "บางพลี" ต้องไม่ชนะ "บางพลีใหญ่" (ชื่อยาวสุดที่จบคำพอดี)
    expect(placeGuessForForm('123 ม.4 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540')).toEqual({
      province: 'สมุทรปราการ',
      district: 'บางพลี',
      subdistrict: 'บางพลีใหญ่',
    });
  });

  it('อ่านไม่ออก = ว่าง (ห้ามเดา) · อำเภอไม่อยู่ในจังหวัดนั้น = ไม่เลือกให้', () => {
    expect(placeGuessForForm('')).toEqual({ province: '', district: '', subdistrict: '' });
    expect(placeGuessForForm(null)).toEqual({ province: '', district: '', subdistrict: '' });
    expect(placeGuessForForm('อาคารสำนักงานใหญ่ ชั้น 3')).toEqual({ province: '', district: '', subdistrict: '' });
  });
});

describe('ขั้น 3 รายได้ — เลือกได้ทางเดียว', () => {
  const roundTrip = (j: JobRequest) => {
    const st = stOf(j);
    const back = incomeFormFromDraft(incomeDraftFromForm(st));
    return formDiffersFromJob({ ...st, ...back });
  };

  it('🔴 เปิดดูเฉย ๆ = ไม่มีอะไรเปลี่ยน ทุกแบบที่เคยบันทึกไว้', () => {
    const cases: Array<JobRequest['field_overrides']> = [
      null,
      { total_income: 15000 },
      { total_income: 0 },
      { income: { period: 'monthly', lines: [{ label: RESIGNED_INCOME_LINE_LABEL, amount: 14500 }], total: null } },
      // ป๊อปเดิมกดใช้รายได้คนเก่าแล้วสลับหน่วยเองได้ — ต้องคงหน่วยเดิม
      { income: { period: 'daily', lines: [{ label: RESIGNED_INCOME_LINE_LABEL, amount: 480 }], total: null } },
      { income: { period: 'daily', lines: [{ label: MANUAL_INCOME_LINE_LABEL, amount: 500 }], total: null } },
      {
        income: {
          period: 'monthly',
          lines: [
            { label: 'เงินเดือน', amount: 15000 },
            { label: 'ค่าเบี้ยขยัน', amount: 500 },
          ],
          total: 18000,
        },
      },
      { income: { period: 'daily', lines: [{ label: 'ค่าแรงรายวัน', amount: 400 }], total: null } },
      // บรรทัดเดียวแต่ปรับยอดรวมไว้ = ทาง "ตามใบขอ" (ห้ามทำยอดรวมหาย)
      { income: { period: 'monthly', lines: [{ label: MANUAL_INCOME_LINE_LABEL, amount: 12000 }], total: 15000 } },
    ];
    for (const fo of cases) expect(roundTrip(job({ field_overrides: fo })), JSON.stringify(fo)).toBe(false);
  });

  it('รู้ว่าเคยตั้งทางไหนไว้ — ป้ายบรรทัดเป็นตัวบอก · ยอดรวมแบบเดิม = ใส่เอง', () => {
    const modeOf = (fo: JobRequest['field_overrides']) => incomeDraftFromForm(formStateFromJob(job({ field_overrides: fo }))).mode;
    expect(modeOf(null)).toBe('request');
    expect(modeOf({ total_income: 15000 })).toBe('manual');
    expect(modeOf({ income: { period: 'monthly', lines: [{ label: RESIGNED_INCOME_LINE_LABEL, amount: 1 }], total: null } })).toBe('resigned');
    expect(modeOf({ income: { period: 'daily', lines: [{ label: MANUAL_INCOME_LINE_LABEL, amount: 500 }], total: null } })).toBe('manual');
    expect(modeOf({ income: { period: 'monthly', lines: [{ label: 'เงินเดือน', amount: 15000 }], total: null } })).toBe('request');
  });

  it('บันทึกเฉพาะทางที่ติ๊ก · ค่าของทางอื่นยังอยู่ในฟอร์ม สลับกลับมาได้', () => {
    const d = {
      ...incomeDraftFromForm(formStateFromJob(job())),
      requestRows: [{ label: 'เงินเดือน', amount: '15000' }],
      manualAmount: '520',
      period: 'daily' as const,
    };
    expect(incomeFormFromDraft({ ...d, mode: 'manual' })).toEqual({
      incomePeriod: 'daily',
      incomeRows: [{ label: MANUAL_INCOME_LINE_LABEL, amount: '520' }],
      incomeTotal: '',
    });
    expect(incomeFormFromDraft({ ...d, mode: 'request' }).incomeRows).toEqual([{ label: 'เงินเดือน', amount: '15000' }]);
    // ใส่เองแต่ยังว่าง = ไม่ตั้งอะไร (หน้าประกาศใช้ของเดิม)
    expect(incomeFormFromDraft({ ...d, mode: 'manual', manualAmount: '' }).incomeRows).toEqual([]);
  });

  it('ยอดใส่เองแบบเดิม: ไม่แตะ = บันทึกแบบเดิม · แก้แล้ว = เก็บแบบมีหน่วย (ต่อวันได้)', () => {
    const legacy = incomeDraftFromForm(formStateFromJob(job({ field_overrides: { total_income: 15000 } })));
    expect(legacy).toMatchObject({ mode: 'manual', manualAmount: '15000', manualLegacy: true });
    expect(incomeFormFromDraft(legacy)).toMatchObject({ incomeRows: [], incomeTotal: '15000' });
    const edited = { ...legacy, manualLegacy: false, manualAmount: '500', period: 'daily' as const };
    const patch = buildOverridesPatch({ ...stOf(job()), ...incomeFormFromDraft(edited) });
    expect(patch.total_income).toBeNull();
    expect(patch.income).toEqual({ period: 'daily', lines: [{ label: MANUAL_INCOME_LINE_LABEL, amount: 500 }], total: null });
  });
});

describe('ขั้น 3 สวัสดิการ — ติ๊กจากรายการทั่วไป + รายละเอียดต่อท้าย', () => {
  it('🔴 บรรทัดที่บันทึกไว้ → ฟอร์ม → กลับเป็นบรรทัดเดิมเป๊ะ (ลำดับเดิม · ชื่อซ้ำ/พิมพ์เองไม่หาย)', () => {
    const text = ['ชุดฟอร์ม', 'รถรับส่ง  จาก BTS หมอชิต', 'ข้าวฟรี 1 มื้อ', 'รถรับส่ง', 'ประกันสังคม'].join('\n');
    const entries = benefitEntriesFromText(text);
    expect(entries.map((e) => e.kind)).toEqual(['preset', 'preset', 'custom', 'custom', 'preset']);
    expect(cleanBenefitLines(benefitTextFromEntries(entries).split('\n'))).toEqual(cleanBenefitLines(text.split('\n')));
  });

  it('🔴 ใบเก่าที่เก็บเป็นคีย์ (ก่อน 20 ส.ค.) เปิดดูแล้วไม่เขียนทับ', () => {
    const j = job({ extra_benefits: ['uniform', 'dorm'], field_overrides: { benefits: ['uniform', 'dorm'] } });
    const st = stOf(j);
    expect(formDiffersFromJob({ ...st, benefitText: benefitTextFromEntries(benefitEntriesFromText(st.benefitText)) })).toBe(false);
  });

  it('ใส่รายละเอียด = ชื่อรายการ + เว้นวรรค + รายละเอียด · ทั้งบรรทัดไม่เกิน BENEFIT_LABEL_MAX (60 ตั้งแต่ 4 ต.ค. 2569)', () => {
    expect(benefitLineOf({ kind: 'preset', key: 'shuttle', detail: 'จาก BTS หมอชิต' })).toBe('รถรับส่ง จาก BTS หมอชิต');
    expect(benefitLineOf({ kind: 'preset', key: 'shuttle', detail: '   ' })).toBe('รถรับส่ง');
    expect(benefitDetailMax('shuttle')).toBe(60 - 'รถรับส่ง'.length - 1);
    expect(benefitEntriesFromText('ปรับเงินเดือนประจำปี 3%')).toEqual([{ kind: 'preset', key: 'salary_raise', detail: '3%' }]);
  });
});

describe('🔴 แต่ละขั้นบันทึกเฉพาะช่องของตัวเอง (สลับขั้นเร็วกว่าที่บันทึกเสร็จ)', () => {
  it('ฟอร์มขั้น 3 ที่เปิดมาพร้อมสถานที่เก่า ต้องไม่บันทึกสถานที่เก่าทับของขั้น 2', () => {
    const before = job({ field_overrides: { province: 'ลพบุรี' } as JobRequest['field_overrides'], override_province: 'ลพบุรี' });
    const stale = formStateFromJob(before); // ขั้น 3 เปิดตอนขั้น 2 ยังบันทึกไม่เสร็จ
    // ขั้น 2 บันทึกเสร็จ → ใบขอฝั่งแม่ถือสถานที่ใหม่
    const after = job({ field_overrides: { province: 'สระบุรี' } as JobRequest['field_overrides'], override_province: 'สระบุรี' });
    const own = { place: false, income: true, benefits: true };
    const st = formStateForSections(after, own, stale);
    expect(st.province).toBe('สระบุรี');
    expect(formDiffersFromJob(st)).toBe(false); // ไม่มีอะไรของขั้น 3 เปลี่ยน = ไม่ยิงบันทึก
    // แก้รายได้ในขั้น 3 → บันทึกรายได้ใหม่ + สถานที่ใหม่ของขั้น 2 อยู่ครบ
    const edited = formStateForSections(after, own, { ...stale, incomeTotal: '15000' });
    expect(buildOverridesPatch(edited)).toMatchObject({ province: 'สระบุรี', total_income: 15000 });
  });

  it('ฟอร์มขั้น 2 ไม่แตะรายได้/สวัสดิการ/ช่องที่ให้เห็น ที่ขั้น 3 เพิ่งบันทึก', () => {
    const after = job({
      extra_benefits: ['ชุดฟอร์ม'],
      field_overrides: { benefits: ['ชุดฟอร์ม'], total_income: 12000, public_visibility: { ot: false } },
    });
    const stale = formStateFromJob(job());
    const st = formStateForSections(after, { place: true, income: false, benefits: false }, { ...stale, province: 'ลพบุรี' });
    expect(buildOverridesPatch(st)).toMatchObject({
      province: 'ลพบุรี',
      total_income: 12000,
      benefits: ['ชุดฟอร์ม'],
      public_visibility: { ot: false },
    });
  });
});
