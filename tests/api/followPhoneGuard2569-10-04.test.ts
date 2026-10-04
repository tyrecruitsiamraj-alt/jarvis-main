/**
 * กันเบอร์เจ้าหน้าที่ไปอยู่ช่องเบอร์ผู้สมัคร + เปลี่ยนเบอร์ทั้งชุดฝั่ง server (เจ้าของสั่ง 4 ต.ค. 2569)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localPhoneDigits, staffPhoneAckKey, staffPhoneMatchesApplicant } from '../../src/lib/followPhoneGuard';

describe('staffPhoneMatchesApplicant', () => {
  it('+66 / 66 / มีขีด = เบอร์เดียวกัน', () => {
    expect(localPhoneDigits('+66 89-999-9999')).toBe('0899999999');
    expect(staffPhoneMatchesApplicant('0899999999', ['', '+66899999999'])).toBe(true);
    expect(staffPhoneMatchesApplicant('089-999-9999', ['66899999999'])).toBe(true);
  });
  it('คนละเบอร์ / ช่องว่าง / เบอร์สั้น = ไม่เตือน', () => {
    expect(staffPhoneMatchesApplicant('0899999999', ['0811111111'])).toBe(false);
    expect(staffPhoneMatchesApplicant('', [''])).toBe(false);
    expect(staffPhoneMatchesApplicant('1234', ['1234'])).toBe(false);
  });
  it('คีย์ยืนยันเปลี่ยนตามเบอร์ — แก้เบอร์แล้วต้องเตือนใหม่', () => {
    expect(staffPhoneAckKey('0899999999', ['0899999999'])).not.toBe(staffPhoneAckKey('0899999998', ['0899999998']));
  });
});

describe('ฟอร์มเพิ่มคนเตือนก่อนบันทึก', () => {
  it('submit เช็กเบอร์เจ้าหน้าที่ที่ใช้จริงของทั้งสองโหมด ก่อนยิงสร้าง', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/follow/FollowPage.tsx'), 'utf8');
    const block = src.slice(src.indexOf('const submit = async'), src.indexOf('if (scheduleMode) {\n      if (daysInRange'));
    expect(block).toContain('staffPhoneMatchesApplicant(phone, usedStaffPhones)');
    expect(block).toContain('setFormError(STAFF_PHONE_SAME_WARNING)');
  });
});

describe('server: apply_phone_to_set', () => {
  const src = readFileSync(join(process.cwd(), 'api/_handlers/follow.ts'), 'utf8');
  const block = src.slice(src.indexOf('async function updateFollow'), src.indexOf('resyncFollowPlanWithLumos(id, staffNameOfPhone)'));
  it('เปลี่ยนเฉพาะชุดเดียวกัน ที่ยังไม่ปิด/ไม่ยกเลิก · ก่อนส่งแผนให้ Lumos ครั้งเดียว', () => {
    expect(block).toContain("body.apply_phone_to_set === true && phoneChanged && before.group_id");
    expect(block).toMatch(/where group_id = \$1 and id <> \$2 and cancelled_at is null and completed_at is null\s+and scheduled_at > now\(\)/);
    // ส่งแผนใหม่ให้ Lumos หลังแก้ทั้งชุดแล้ว (resync อ่านทุกรอบจากฐาน) — ไม่ยิงทีละแถว
    expect(block).not.toContain('resyncFollowPlanWithLumos(String(r.id)');
  });
});
