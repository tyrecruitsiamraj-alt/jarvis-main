/**
 * QA รอบ 3 ข้อ 4 (11 ต.ค. 2569 · เจ้าของ Choice "ล้างออก + กันไม่ให้ลงอีก")
 * เบอร์ตัวอย่าง 0812345678 ค้างเป็นเบอร์ฉุกเฉินของ AI 1,049 สาย (มาจากค่าทดสอบ LUMOS_ADMIN_PHONE_OVERRIDE บนเซิร์ฟเวอร์)
 * 🔴 ฝั่งส่ง: ไม่ส่งเบอร์นี้ทั้งเบอร์ที่พูดและเบอร์ฉุกเฉิน · ฝั่งรับ: ช่องเบอร์เจ้าหน้าที่/ผู้ใช้/รายชื่อเจ้าหน้าที่ปฏิเสธ
 * (เบอร์ผู้สมัครเป็นเบอร์นี้ได้ — เทสต์ทั้งระบบใช้เป็นเบอร์ผู้รับ)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isPlaceholderPhone, PLACEHOLDER_PHONE_ERROR } from '../../src/lib/followPhoneGuard';
import { buildFollowReminderPayload } from '../../api/_lib/lumosDispatch';
import { parseFollowInput } from '../../api/_handlers/follow';
import { parseStaffContactInput } from '../../api/_lib/followStaffContacts';

const WHEN = new Date('2026-10-20T02:00:00.000Z');
const entry = (staffPhone: string | null) => ({
  id: 'e6c1f0aa-1111-4222-8333-444455556666',
  recipient_name: 'นายสมชาย ใจดี',
  recipient_phone: '+66899990000',
  topic: 'ติดตามเริ่มงาน',
  note: null,
  staffPhone,
  staffName: 'น้ำหวาน',
  unitName: 'ธนาคารกรุงศรีอยุธยา',
  scheduled_at: WHEN,
});

describe('เบอร์ตัวอย่าง 0812345678', () => {
  it('จับได้ทุกรูป (0 / +66 / ขีด) · เบอร์อื่นไม่โดน', () => {
    for (const p of ['0812345678', '+66812345678', '081-234-5678', '66812345678']) expect(isPlaceholderPhone(p)).toBe(true);
    for (const p of ['0812345679', '0901978515', '', null, undefined]) expect(isPlaceholderPhone(p)).toBe(false);
  });

  it('🔴 payload Follow: เบอร์ฉุกเฉินเป็นเบอร์ตัวอย่าง = ไม่มีคีย์ admin_phone · เบอร์จริงยังส่ง', () => {
    expect('admin_phone' in buildFollowReminderPayload(entry(null), '+66812345678')).toBe(false);
    expect(buildFollowReminderPayload(entry(null), '+66901978515').admin_phone).toBe('+66901978515');
  });

  it('🔴 payload Follow: เบอร์เจ้าหน้าที่เป็นเบอร์ตัวอย่าง = AI ไม่พูดเบอร์นี้', () => {
    const p = buildFollowReminderPayload(entry('0812345678'), '+66812345678');
    expect(JSON.stringify(p.steps)).not.toMatch(/081[\s-]?234[\s-]?5678|0 8 1 2 3 4 5 6 7 8/);
    expect('admin_phone' in p).toBe(false);
  });

  it('ฟอร์มติดตาม: เบอร์เจ้าหน้าที่เป็นเบอร์ตัวอย่าง = ปฏิเสธ · เบอร์ผู้สมัครเป็นเบอร์นี้ได้', () => {
    const base = { recipient_name: 'ก', recipient_phone: '0812345678', topic: 'ติดตามเริ่มงาน', scheduled_at: '2026-10-20T02:00:00.000Z' };
    expect(parseFollowInput({ ...base, staff_phone: '081-234-5678' }, new Date('2026-10-11T00:00:00Z')).error).toBe(PLACEHOLDER_PHONE_ERROR);
    expect(parseFollowInput({ ...base, staff_phone: '0901978515' }, new Date('2026-10-11T00:00:00Z')).error).toBeNull();
  });

  it('รายชื่อเจ้าหน้าที่ + ผู้ใช้งาน ปฏิเสธเบอร์ตัวอย่าง · ช่องกรอกผู้สมัครเลิกใช้เบอร์ตัวอย่างเป็น placeholder', () => {
    expect(parseStaffContactInput({ name: 'ก', phone: '0812345678' }).error).toBe(PLACEHOLDER_PHONE_ERROR);
    expect(readFileSync('api/_handlers/app-users.ts', 'utf8')).toMatch(/isPlaceholderPhone\(e164\)\) return sendError\(res, 400, 'Bad request', PLACEHOLDER_PHONE_ERROR\)/);
    expect(readFileSync('src/pages/follow/FollowPage.tsx', 'utf8')).not.toMatch(/placeholder="0812345678"/);
  });

  it('รายการติดตามไม่โชว์เบอร์ตัวอย่างที่ค้างในคิวเหมือนเบอร์จริง', () => {
    expect(readFileSync('api/_handlers/follow.ts', 'utf8')).toMatch(
      /emergency_phone: r\.emergency_phone && !isPlaceholderPhone\(r\.emergency_phone\) \? r\.emergency_phone : null/,
    );
  });
});
