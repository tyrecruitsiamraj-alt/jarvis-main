// @vitest-environment node
/**
 * อายุ 58 ปีขึ้นไป — AI ไม่โทร · ชื่อไปกล่อง "อายุเกิน" แท็บผู้สมัคร (เจ้าของ 5 ต.ค. 2569 · Choice "58 ปีขึ้นไป")
 * 🔴 ด่าน: ทุกเส้นที่ส่งใบสมัครเข้าคิว AI ต้องไม่ส่งคนอายุเกิน และต้องไม่ปั๊มสถานะ "ส่ง AI" ให้ใบที่ไม่ได้ส่งจริง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OVER_AGE_MIN, OVER_AGE_REASON, isOverAge } from '../../src/lib/applicantAge';
import { RM_LIST_VIEWS_SHOWN, RM_LIST_VIEW_LABEL, isInRmListView } from '../../src/lib/recruitRm';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

const code = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const app = (age?: number) => ({ id: 'a', full_name: 'ทดสอบ', age }) as unknown as PublicApplication;

describe('ตัวตัดสินอายุเกิน', () => {
  it('58 ขึ้นไป = เกิน · 57 ไม่เกิน · ไม่รู้อายุ = ไม่เกิน (ส่ง AI ได้ตามเดิม)', () => {
    expect(OVER_AGE_MIN).toBe(58);
    expect(isOverAge(58)).toBe(true);
    expect(isOverAge(63)).toBe(true);
    expect(isOverAge('60')).toBe(true);
    expect(isOverAge(57)).toBe(false);
    expect(isOverAge(null)).toBe(false);
    expect(isOverAge(undefined)).toBe(false);
    expect(isOverAge('')).toBe(false);
    expect(OVER_AGE_REASON).toBe('อายุ 58 ปีขึ้นไป AI ไม่โทร');
  });
});

describe('กล่อง "อายุเกิน" บนแท็บผู้สมัคร', () => {
  it('ปุ่มอยู่คู่กับสนใจ/ไม่สนใจ · เลือกแล้วเหลือเฉพาะคน 58 ขึ้นไป · ทั้งหมดยังเห็นทุกคน', () => {
    expect([...RM_LIST_VIEWS_SHOWN]).toEqual(['all', 'interested', 'declined', 'over_age']);
    expect(RM_LIST_VIEW_LABEL.over_age).toBe('อายุเกิน');
    expect(isInRmListView(app(59), 'over_age')).toBe(true);
    expect(isInRmListView(app(40), 'over_age')).toBe(false);
    expect(isInRmListView(app(), 'over_age')).toBe(false);
    expect(isInRmListView(app(59), 'all')).toBe(true);
  });
});

describe('🔴 ทุกเส้นส่ง AI ของใบสมัครกันอายุเกิน', () => {
  it('คอขวด enqueueLumosInterviewForApplications ข้ามคนอายุเกินก่อนประกอบ payload พร้อมเหตุผล', () => {
    const d = code('api/_lib/lumosDispatch.ts');
    const fn = d.slice(d.indexOf('export async function enqueueLumosInterviewForApplications'));
    const body = fn.slice(0, fn.indexOf('\nexport '));
    const gate = body.indexOf('if (isOverAge(app.age))');
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(body.indexOf('buildApplicationInterviewPayload('));
    expect(body).toContain('reason: OVER_AGE_REASON');
  });

  it('ทุกจุดที่เรียกส่งอายุมาด้วย', () => {
    expect(code('api/_handlers/public/apply.ts')).toContain('age: v.age,');
    expect(code('api/_handlers/application-dispatch.ts')).toContain('a.position_interest, a.age,');
    expect(code('api/_lib/callChoiceWorker.ts')).toContain('a.position_interest, a.age,');
    expect(code('api/_handlers/application-call-choice.ts')).toContain('a.claimed_by_name, a.age,');
  });

  it('ไม่ปั๊มสถานะ "ส่ง AI" ให้ใบอายุเกิน (ตัวส่งเองหลังรอ · ปุ่มเลือกวิธีโทร · ปุ่มส่งทั้งใบขอ)', () => {
    expect(code('api/_lib/callChoiceWorker.ts')).toContain('and (a.age is null or a.age < ${OVER_AGE_MIN})');
    expect(code('api/_handlers/application-dispatch.ts')).toContain('and (a.age is null or a.age < ${OVER_AGE_MIN})');
    const cc = code('api/_handlers/application-call-choice.ts');
    const ai = cc.slice(cc.indexOf('async function chooseAi'));
    expect(ai.indexOf('isOverAge(r.age)')).toBeGreaterThan(0);
    expect(ai.indexOf('isOverAge(r.age)')).toBeLessThan(ai.indexOf("stampChoice(apps.map((a) => a.id), 'ai'"));
  });
});
