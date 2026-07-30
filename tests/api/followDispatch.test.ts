import { describe, it, expect } from 'vitest';
import { buildFollowReminderPayload } from '../../api/_lib/lumosDispatch';
import { checkApiAccess } from '../../api/_lib/rbac';
import { APP_FUNCTIONS, primaryFunctionForPath, OPL_READ_FUNCTIONS } from '../../src/lib/roleFunctions';

const WHEN = new Date('2026-08-15T09:30:00+07:00');

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
