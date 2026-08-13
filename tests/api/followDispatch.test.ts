import { describe, it, expect } from 'vitest';
import { buildFollowReminderPayload } from '../../api/_lib/lumosDispatch';
import { parseFollowInput } from '../../api/_handlers/follow';
import { checkApiAccess } from '../../api/_lib/rbac';
import { APP_FUNCTIONS, primaryFunctionForPath, OPL_READ_FUNCTIONS } from '../../src/lib/roleFunctions';

const WHEN = new Date('2026-08-15T09:30:00+07:00');

describe('parseFollowInput', () => {
  const NOW = new Date('2026-07-30T15:00:00+07:00');

  it('ช่องไม่บังคับหายไปทั้งหมดก็ต้องผ่าน (เคยพัง 500 เพราะเว้น note ว่าง)', () => {
    const r = parseFollowInput(
      { recipient_name: 'สมชาย ใจดี', recipient_phone: '0812345678', topic: 'ตามเอกสาร' },
      NOW,
    );
    expect(r.error).toBeNull();
    expect(r.value).not.toBeNull();
    expect(r.value!.note).toBeNull();
    expect(r.value!.phone).toBe('+66812345678');
    expect(r.value!.when.toISOString()).toBe(NOW.toISOString());
  });

  it('note/scheduled_at เป็นค่าว่างหรือชนิดผิด ก็ไม่ throw', () => {
    for (const extra of [{ note: '' }, { note: null }, { note: 123 }, { scheduled_at: '' }, { scheduled_at: null }]) {
      const r = parseFollowInput(
        { recipient_name: 'ก', recipient_phone: '0800000000', topic: 'ข', ...extra },
        NOW,
      );
      expect(r.error).toBeNull();
      expect(r.value).not.toBeNull();
    }
  });

  it('เก็บ note ที่กรอกมาและ trim ให้', () => {
    const r = parseFollowInput(
      { recipient_name: 'ก', recipient_phone: '0800000000', topic: 'ข', note: '  ถามวันสะดวก  ' },
      NOW,
    );
    expect(r.value!.note).toBe('ถามวันสะดวก');
  });

  it('ปฏิเสธเมื่อขาดชื่อ / เรื่อง / เบอร์ไม่ถูกต้อง / วันเวลาเพี้ยน', () => {
    expect(parseFollowInput({ recipient_phone: '0812345678', topic: 'ก' }, NOW).error).toContain('ชื่อ');
    expect(parseFollowInput({ recipient_name: 'ก', recipient_phone: '0812345678' }, NOW).error).toContain('เรื่อง');
    expect(parseFollowInput({ recipient_name: 'ก', recipient_phone: '02-123-4567', topic: 'ข' }, NOW).error).toContain('เบอร์');
    expect(
      parseFollowInput(
        { recipient_name: 'ก', recipient_phone: '0812345678', topic: 'ข', scheduled_at: 'ไม่ใช่วันที่' },
        NOW,
      ).error,
    ).toContain('วันเวลา');
    expect(parseFollowInput(null, NOW).error).toBe('Invalid JSON body');
  });

  it('เบอร์เจ้าหน้าที่: ไม่กรอกก็ผ่าน · กรอกแล้วเก็บตามที่พิมพ์ (เบอร์ต่อภายในใช้ได้)', () => {
    // เจ้าของสั่ง 13 ส.ค. 2569 — ช่องนี้แทน "รายละเอียดเพิ่มเติม" เดิม
    // ⚠️ ไม่บังคับ E.164 เพราะเป็นเบอร์ที่ AI **พูดให้ฟัง** ไม่ใช่เบอร์ที่ระบบโทรออก
    const base = { recipient_name: 'ก', recipient_phone: '0800000000', topic: 'ข' };
    expect(parseFollowInput(base, NOW).value!.staffPhone).toBeNull();
    expect(parseFollowInput({ ...base, staff_phone: '021234567 ต่อ 101' }, NOW).value!.staffPhone).toBe(
      '021234567 ต่อ 101',
    );
    expect(parseFollowInput({ ...base, staff_phone: '' }, NOW).value!.staffPhone).toBeNull();
  });

  it('เบอร์เจ้าหน้าที่ที่ไม่มีตัวเลขพอ ต้องไม่ผ่าน — ผู้สมัครจะโทรกลับไม่ได้', () => {
    const r = parseFollowInput(
      { recipient_name: 'ก', recipient_phone: '0800000000', topic: 'ข', staff_phone: 'ถามพี่แดง' },
      NOW,
    );
    expect(r.error).toContain('เบอร์เจ้าหน้าที่');
    expect(r.value).toBeNull();
  });

  it('ใช้ scheduled_at ที่ส่งมาเมื่อเป็นวันเวลาที่ถูกต้อง', () => {
    const r = parseFollowInput(
      { recipient_name: 'ก', recipient_phone: '0812345678', topic: 'ข', scheduled_at: '2026-08-15T09:30:00+07:00' },
      NOW,
    );
    expect(r.value!.when.toISOString()).toBe(WHEN.toISOString());
  });
});

describe('buildFollowReminderPayload', () => {
  it('ส่งเรื่องที่กรอกเป็นข้อความให้ Lumos ผ่าน step แบบ follow_up', () => {
    const p = buildFollowReminderPayload({
      id: 'e6c1f0aa-1111-4222-8333-444455556666',
      recipient_name: 'สมชาย ใจดี',
      recipient_phone: '+66812345678',
      topic: 'ยืนยันวันเริ่มงาน 15 ส.ค.',
      note: 'ถ้ายังไม่พร้อมให้ถามวันที่สะดวก',
      scheduled_at: WHEN,
    });
    expect(p.client_contact_id).toBe('follow::e6c1f0aa-1111-4222-8333-444455556666');
    expect(p.recipient_phone).toBe('+66812345678');
    expect(p.title).toBe('ยืนยันวันเริ่มงาน 15 ส.ค.');
    expect(p.steps).toHaveLength(1);
    expect(p.steps[0].type).toBe('follow_up');
    expect(p.steps[0].message).toBe('ยืนยันวันเริ่มงาน 15 ส.ค. — ถ้ายังไม่พร้อมให้ถามวันที่สะดวก');
    expect(p.steps[0].scheduled_at).toBe(WHEN.toISOString());
  });

  it('ไม่มีหมายเหตุ → ใช้เฉพาะหัวเรื่อง', () => {
    const p = buildFollowReminderPayload({
      id: 'abc',
      recipient_name: 'ก',
      recipient_phone: '+66800000000',
      topic: 'ตามเอกสาร',
      note: null,
      scheduled_at: WHEN,
    });
    expect(p.steps[0].message).toBe('ตามเอกสาร');
  });

  it('มีเบอร์เจ้าหน้าที่ → ต่อท้ายบทพูดให้ผู้สมัครโทรกลับได้', () => {
    // ⚠️ schema ของ Lumos ไม่มีช่องใส่เบอร์ติดต่อกลับ — ช่องเดียวที่ถึงหูผู้สมัคร
    // คือ steps[].message · ถ้าเทสต์นี้ล้มแปลว่าเบอร์หายจากบท ผู้สมัครโทรกลับไม่ได้
    const p = buildFollowReminderPayload({
      id: 'abc',
      recipient_name: 'ก',
      recipient_phone: '+66800000000',
      topic: 'ตามเอกสาร',
      note: null,
      staffPhone: '021234567',
      scheduled_at: WHEN,
    });
    expect(p.steps[0].message).toBe('ตามเอกสาร — ติดต่อกลับได้ที่ 021234567');
  });

  it('มีทั้งหมายเหตุและเบอร์ → เรียงหัวเรื่อง → หมายเหตุ → เบอร์', () => {
    const p = buildFollowReminderPayload({
      id: 'abc',
      recipient_name: 'ก',
      recipient_phone: '+66800000000',
      topic: 'ตามเอกสาร',
      note: 'ถามวันสะดวก',
      staffPhone: '021234567',
      scheduled_at: WHEN,
    });
    expect(p.steps[0].message).toBe('ตามเอกสาร — ถามวันสะดวก — ติดต่อกลับได้ที่ 021234567');
  });
});

describe('follow RBAC', () => {
  it('staff เพิ่ม/ยกเลิกได้ · opl อ่านได้แต่เพิ่มไม่ได้', () => {
    expect(checkApiAccess('staff', 'follow', 'GET').ok).toBe(true);
    expect(checkApiAccess('staff', 'follow', 'POST').ok).toBe(true);
    expect(checkApiAccess('staff', 'follow', 'DELETE').ok).toBe(true);
    expect(checkApiAccess('opl', 'follow', 'GET').ok).toBe(true);
    expect(checkApiAccess('opl', 'follow', 'POST').ok).toBe(false);
  });

  it('เมนู Follow ผูกกับ follow_read และ opl เห็นได้', () => {
    expect(primaryFunctionForPath('/follow')).toBe('follow_read');
    expect(OPL_READ_FUNCTIONS.has('follow_read')).toBe(true);
  });

  it('ฟังก์ชัน Driver Care ถูกถอดออกจากระบบสิทธิ์แล้ว', () => {
    const ids = APP_FUNCTIONS.map((f) => f.id as string);
    expect(ids).toContain('follow_read');
    expect(ids).toContain('follow_manage');
    expect(ids.some((id) => id.startsWith('driver_care'))).toBe(false);
    expect(primaryFunctionForPath('/driver-care')).toBeNull();
  });
});
