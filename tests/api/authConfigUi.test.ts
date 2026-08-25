import { describe, expect, it } from 'vitest';

import { shouldShowPasswordUi, type AuthConfig } from '@/lib/authConfig';

/**
 * กฎ "โชว์ของที่เกี่ยวกับรหัสผ่านไหม" (เจ้าของสั่ง 22 ส.ค. 2569: ล็อกให้เข้าทาง Microsoft)
 *
 * 🔴 ข้อที่ต้องล็อกให้แน่นสุดคือ **fail-safe**: ถ้า Microsoft login ใช้ไม่ได้
 * ต้องโชว์ฟอร์มรหัสผ่านเสมอ ไม่งั้นจะไม่มีทางเข้าระบบเลยแม้แต่ทางเดียว
 * (เครื่อง dev ที่ยังไม่ตั้ง Azure · หรือวันที่ Azure ล่ม)
 */

const cfg = (patch: Partial<AuthConfig>): AuthConfig => ({
  companyEmailLogin: false,
  passwordLogin: true,
  passwordLoginUi: false,
  microsoftLogin: true,
  ...patch,
});

describe('shouldShowPasswordUi', () => {
  it('ค่าตั้งต้นของระบบ (Microsoft พร้อม · env ไม่ได้เปิด) = ซ่อน', () => {
    expect(shouldShowPasswordUi(cfg({}))).toBe(false);
  });

  it('เปิด env JARVIS_PASSWORD_LOGIN_UI = โชว์', () => {
    expect(shouldShowPasswordUi(cfg({ passwordLoginUi: true }))).toBe(true);
  });

  it('🔴 Microsoft ใช้ไม่ได้ → โชว์เสมอ (ห้ามล็อกทุกคนออกจากระบบ)', () => {
    expect(shouldShowPasswordUi(cfg({ microsoftLogin: false }))).toBe(true);
    // แม้ env สั่งซ่อนไว้ก็ต้องโชว์
    expect(shouldShowPasswordUi(cfg({ microsoftLogin: false, passwordLoginUi: false }))).toBe(true);
  });

  it('หลังบ้านไม่รองรับรหัสผ่านเลย = ไม่โชว์ (โชว์ไปก็ล็อกอินไม่ได้)', () => {
    expect(
      shouldShowPasswordUi(cfg({ passwordLogin: false, companyEmailLogin: false, microsoftLogin: false })),
    ).toBe(false);
    // มี magic link (companyEmailLogin) แต่ไม่มี JWT → ยังถือว่าหลังบ้านพร้อม
    expect(
      shouldShowPasswordUi(cfg({ passwordLogin: false, companyEmailLogin: true, microsoftLogin: false })),
    ).toBe(true);
  });

  it('config ยังโหลดไม่เสร็จ/โหลดไม่ได้ = ซ่อน (ของที่สั่งซ่อนห้ามกะพริบโผล่)', () => {
    expect(shouldShowPasswordUi(null)).toBe(false);
    expect(shouldShowPasswordUi(undefined)).toBe(false);
  });
});
