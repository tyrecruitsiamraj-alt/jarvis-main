import { describe, it, expect } from 'vitest';
import { parseStaffContactInput } from '../../api/_lib/followStaffContacts';
import { matchStaffContact, type FollowStaffContact } from '../../src/lib/followStaffContactsApi';
import { checkApiAccess } from '../../api/_lib/rbac';

/**
 * สมุดรายชื่อ+เบอร์เจ้าหน้าที่ผู้ติดตาม (migration 099 · เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)
 * — dropdown บนหน้า Follow · เพิ่มได้เฉพาะ supervisor ขึ้นไป
 */

describe('parseStaffContactInput', () => {
  it('ชื่อ+เบอร์ปกติผ่าน และ trim ให้', () => {
    const r = parseStaffContactInput({ name: '  คุณคิว ทีมสรรหา ', phone: ' 0812345678 ' });
    expect(r.error).toBeNull();
    expect(r.value).toEqual({ name: 'คุณคิว ทีมสรรหา', phone: '0812345678' });
  });

  it('เบอร์บ้าน+ต่อภายในผ่าน — กติกาเดียวกับ staff_phone (ไม่บังคับ E.164)', () => {
    const r = parseStaffContactInput({ name: 'ธุรการ', phone: '021234567 ต่อ 101' });
    expect(r.error).toBeNull();
    expect(r.value?.phone).toBe('021234567 ต่อ 101');
  });

  it('ไม่มีชื่อ = ไม่ผ่าน', () => {
    expect(parseStaffContactInput({ name: '   ', phone: '0812345678' }).error).toContain('ชื่อ');
    expect(parseStaffContactInput({ phone: '0812345678' }).error).toContain('ชื่อ');
  });

  it('ตัวเลขไม่ถึง 8 ตัว = โทรกลับไม่ได้จริง ไม่ผ่าน (7 ตัวตก · 8 ตัวผ่าน — คุมขอบ)', () => {
    expect(parseStaffContactInput({ name: 'ก', phone: '1234567' }).error).toContain('เบอร์');
    expect(parseStaffContactInput({ name: 'ก', phone: '12345678' }).error).toBeNull();
  });

  it('body ไม่ใช่ object / ชนิดผิด ไม่ throw', () => {
    for (const raw of [null, undefined, 'x', 42, [], { name: 1, phone: 2 }]) {
      expect(() => parseStaffContactInput(raw)).not.toThrow();
      expect(parseStaffContactInput(raw).value).toBeNull();
    }
  });
});

describe('matchStaffContact', () => {
  const contacts: FollowStaffContact[] = [
    { id: 'a', name: 'คิว', phone: '0812345678', created_by_name: null, created_at: '' },
    { id: 'b', name: 'ธุรการ', phone: '021234567 ต่อ 101', created_by_name: null, created_at: '' },
  ];

  it('เทียบตรงตัวหลัง trim — เจอทั้งมือถือและเบอร์ต่อภายใน', () => {
    expect(matchStaffContact('0812345678', contacts)?.id).toBe('a');
    expect(matchStaffContact(' 021234567 ต่อ 101 ', contacts)?.id).toBe('b');
  });

  it('ค่าว่าง/ไม่ตรงใคร = null (dropdown จะโชว์เป็น "เบอร์ที่กรอกไว้เดิม")', () => {
    expect(matchStaffContact('', contacts)).toBeNull();
    expect(matchStaffContact(null, contacts)).toBeNull();
    expect(matchStaffContact('0899999999', contacts)).toBeNull();
  });

  it('⚠️ ตั้งใจไม่เทียบเลขท้ายแบบ phoneKey — เบอร์ต่อภายในเลขท้ายไม่ใช่ตัวระบุ', () => {
    // เลขท้าย 9 ตัวของ "021234567 ต่อ 101" คือ "234567101" — ถ้าใครเปลี่ยนไปใช้
    // phoneKey เคสนี้จะ match ผิดตัว เทสต์นี้ล็อกพฤติกรรมไว้
    expect(matchStaffContact('234567101', contacts)).toBeNull();
  });
});

describe('rbac: follow-staff-contacts', () => {
  it('GET อ่านได้ทุก role ที่ล็อกอิน (รวม opl ซึ่ง read-only)', () => {
    for (const role of ['opl', 'staff', 'supervisor', 'admin'] as const) {
      expect(checkApiAccess(role, 'follow-staff-contacts', 'GET').ok).toBe(true);
    }
  });

  it('POST เพิ่มชื่อได้เฉพาะ supervisor ขึ้นไป', () => {
    expect(checkApiAccess('supervisor', 'follow-staff-contacts', 'POST').ok).toBe(true);
    expect(checkApiAccess('admin', 'follow-staff-contacts', 'POST').ok).toBe(true);
    expect(checkApiAccess('staff', 'follow-staff-contacts', 'POST').ok).toBe(false);
    expect(checkApiAccess('opl', 'follow-staff-contacts', 'POST').ok).toBe(false);
  });
});
