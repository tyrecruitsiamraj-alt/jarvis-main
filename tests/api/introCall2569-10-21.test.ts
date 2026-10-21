// @vitest-environment node
/**
 * ═══ บทโทรเบื้องต้น — ใบเพิ่มเอง ไม่ผูกหน่วยงาน + ส่ง AI (เจ้าของ 21 ต.ค. 2569) ═══
 * "คุณ... จากสยามราช คุณยังสนใจงานไหม อยู่จังหวัดอะไร อายุเท่าไหร่ … เพื่อยืนยันว่ามีตัวตนไม่ใช่กรอกมาเล่น"
 * 🔴 ห้ามเติมคำถามที่ไม่ได้สั่ง · ใบเพิ่มเอง = บทนี้ · รายชื่อ iRecruit / กรอกผ่านลิงก์ = บททักทายเดิม
 * 🔴 อายุ/จังหวัดที่ได้ เติมลงใบเฉพาะช่องที่ว่าง (Choice)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a), isPgUndefinedTable: () => false }));

const { CALL_SCRIPT_TEMPLATES: T } = await import('../../api/_lib/lumosCallScript.templates.js');
const { buildGreetingPayload } = await import('../../api/_lib/lumosDispatch.js');
const { isStaffKeyedApplication } = await import('../../src/lib/greetingCall.js');
const { fillApplicationFromIntroCall } = await import('../../api/_lib/introCallFill.js');
const { EDITABLE_SCRIPT_KEYS } = await import('../../api/_lib/callScriptStore.js');

const app = { id: '11111111-1111-1111-1111-111111111111', full_name: 'นายสมชาย ใจดี', phone: '0812345678', province: 'ชลบุรี' };

beforeEach(() => dbQuery.mockReset());

describe('บทโทรเบื้องต้น', () => {
  it('🔴 คำถามตามที่เจ้าของสั่ง: ชื่อ+ยังหางาน → จังหวัด → อายุ (ไม่มีคำถามอื่น)', () => {
    const lines = T.โทรเบื้องต้น;
    expect(lines.slice(0, 3)).toEqual(['{ชื่อผู้รับ}ยังสนใจหางานอยู่ไหมคะ', 'ตอนนี้อยู่จังหวัดอะไรคะ', 'อายุเท่าไหร่คะ']);
    expect(lines.filter((l) => /\?|คะ$/.test(l) && !/ขอบคุณ|ไม่เป็นไร/.test(l))).toHaveLength(3);
  });

  it('ใบที่เจ้าหน้าที่เพิ่มเอง = บทนี้ · iRecruit / กรอกเอง = บททักทายเดิม', () => {
    const staff = buildGreetingPayload({ ...app, created_by_name: 'staff@siamraj.com' })!;
    expect(staff.questions[0]).toBe('คุณสมชาย ใจดี ยังสนใจหางานอยู่ไหมคะ');
    expect(staff.questions.join(' ')).not.toContain('เคยฝากใบสมัคร');
    const irecruit = buildGreetingPayload({ ...app, created_by_name: 'iRecruit' })!;
    expect(irecruit.questions[0]).toContain('เคยฝากใบสมัคร');
    expect(isStaffKeyedApplication(null)).toBe(false);
  });

  it('แก้บทได้จากหน้าตั้งค่า (คีย์ intro อยู่ในลิสต์)', () => {
    expect(EDITABLE_SCRIPT_KEYS).toContain('intro');
  });
});

describe('เติมอายุ/จังหวัดลงใบเฉพาะช่องที่ว่าง', () => {
  const transcript = [
    { role: 'agent', text: 'คุณสมชาย ยังสนใจหางานอยู่ไหมคะ' },
    { role: 'user', text: 'สนใจครับ' },
    { role: 'agent', text: 'ตอนนี้อยู่จังหวัดอะไรคะ' },
    { role: 'user', text: 'อยู่ระยองครับ' },
    { role: 'agent', text: 'อายุเท่าไหร่คะ' },
    { role: 'user', text: '34 ครับ' },
  ];

  it('🔴 ช่องว่างทั้งคู่ = เติมอายุ 34 + ระยอง', async () => {
    dbQuery
      .mockResolvedValueOnce({ rows: [{ id: app.id, age: null, province: null, created_by_name: 'staff@x', transcript }] })
      .mockResolvedValueOnce({ rows: [{ id: app.id }] });
    expect(await fillApplicationFromIntroCall(7)).toEqual({ filled: true });
    expect(dbQuery.mock.calls[1][1]).toEqual([app.id, 34, 'ระยอง']);
    expect(String(dbQuery.mock.calls[1][0])).toContain('coalesce(age, $2::int)');
  });

  it('คนคีย์ไว้ครบแล้ว = ไม่แตะ', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ id: app.id, age: 40, province: 'ชลบุรี', created_by_name: 'staff@x', transcript }] });
    expect(await fillApplicationFromIntroCall(7)).toEqual({ filled: false });
    expect(dbQuery).toHaveBeenCalledTimes(1);
  });

  it('รายชื่อ iRecruit (บททักทายเดิม) = ไม่เขียนทับใบ', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ id: app.id, age: null, province: null, created_by_name: 'iRecruit', transcript }] });
    expect(await fillApplicationFromIntroCall(7)).toEqual({ filled: false });
    expect(dbQuery).toHaveBeenCalledTimes(1);
  });

  it('ล้ม = ไม่โยน (รับผลโทรต้องไม่ล้ม)', async () => {
    dbQuery.mockRejectedValueOnce(new Error('db down'));
    expect(await fillApplicationFromIntroCall(7)).toEqual({ filled: false });
  });
});
