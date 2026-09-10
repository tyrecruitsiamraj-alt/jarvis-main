import { describe, expect, it } from 'vitest';
import { cleanFieldOverrides } from '../../api/_lib/siamrajUnitNotes.js';
import { buildLeadRulesPatch } from '../../src/components/jobs/RequestLeadRulesCard.js';

/**
 * เกณฑ์ความเร่งเฉพาะใบ — ฝั่ง**เก็บลงฐาน** (เจ้าของสั่ง 10 ก.ย. 2569)
 *
 * `siamraj_unit_notes.field_overrides` ถูกเขียนทับ**ทั้งก้อน** ตอนบันทึก
 * (`upsertUnitNote` ไม่ merge ให้) จุดนี้จึงพังแบบเงียบได้ง่ายที่สุดในงานนี้:
 * ตั้งเกณฑ์ครั้งเดียวแล้วรายได้/สวัสดิการที่ทีมแก้ไว้หายหมดโดยไม่มี error
 */

describe('เกณฑ์ความเร่งเฉพาะใบ — เข้าฐานได้และไม่ทับของเดิม', () => {
  it('เก็บ lead_rules ที่ถูกต้องไว้ครบ', () => {
    const out = cleanFieldOverrides({
      lead_rules: { urgent_threshold_days: 3, sla_days: { urgent: 10, advance: 20 } },
    });
    expect(out?.lead_rules).toEqual({
      urgent_threshold_days: 3,
      sla_days: { urgent: 10, advance: 20 },
    });
  });

  it('ค่าเพี้ยนถูกตัดทิ้งตั้งแต่ก่อนเข้าฐาน (ติดลบ · เกินปี · ให้เวลา 0 วัน)', () => {
    expect(
      cleanFieldOverrides({ lead_rules: { urgent_threshold_days: -1, sla_days: { urgent: 0 } } })
        ?.lead_rules,
    ).toBeNull();
    expect(cleanFieldOverrides({ lead_rules: { urgent_threshold_days: 999 } })?.lead_rules).toBeNull();
  });

  it('ตัว sanitize ฝั่ง API เป็นตัวเดียวกับหน้าเว็บ — ค่าที่บันทึกได้ต้องคำนวณได้', () => {
    // ทศนิยมถูกตัดเหมือนกันทั้งสองฝั่ง (กฎอยู่ที่ requestLeadKind.ts ที่เดียว)
    expect(cleanFieldOverrides({ lead_rules: { urgent_threshold_days: 3.9 } })?.lead_rules).toEqual({
      urgent_threshold_days: 3,
    });
  });

  it('🔴 บันทึกเกณฑ์แล้ว override เดิมต้องอยู่ครบ — ไม่งั้นรายได้/สวัสดิการหายเงียบ', () => {
    const job = {
      field_overrides: {
        total_income: 18000,
        benefits: ['ที่พักฟรี'],
        age_min: 20,
        province: 'นนทบุรี',
      },
    } as Parameters<typeof buildLeadRulesPatch>[0];

    const patch = buildLeadRulesPatch(job, { urgent_threshold_days: 3 });
    const stored = cleanFieldOverrides(patch);

    expect(stored?.total_income).toBe(18000);
    expect(stored?.benefits).toEqual(['ที่พักฟรี']);
    expect(stored?.age_min).toBe(20);
    expect(stored?.province).toBe('นนทบุรี');
    expect(stored?.lead_rules).toEqual({ urgent_threshold_days: 3 });
  });

  it('ล้างเกณฑ์ (กลับไปใช้ค่ากลาง) ก็ต้องไม่ล้างของอื่นไปด้วย', () => {
    const job = { field_overrides: { total_income: 18000 } } as Parameters<
      typeof buildLeadRulesPatch
    >[0];
    const stored = cleanFieldOverrides(buildLeadRulesPatch(job, null));
    expect(stored?.total_income).toBe(18000);
    expect(stored?.lead_rules).toBeNull();
  });
});
