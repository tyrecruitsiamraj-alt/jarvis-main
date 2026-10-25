// @vitest-environment node
/**
 * อายุการเข้าระบบค่าเริ่ม 8 ชั่วโมง (เจ้าของ 25 ต.ค. 2569 Choice "ยืดเวลาเป็น 8 ชั่วโมง")
 * เดิม 30 นาที ⇒ ฟอร์มติดตามขั้น 4 ขึ้น "โหลดรายการประกันไม่ได้" ทั้งที่จริงคือหมดอายุ
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { authTokenTtlSeconds, DEFAULT_AUTH_TTL_SECONDS } from '../../api/_lib/auth';

describe('อายุการเข้าระบบ', () => {
  const before = process.env.AUTH_TOKEN_TTL_SECONDS;
  afterEach(() => {
    if (before === undefined) delete process.env.AUTH_TOKEN_TTL_SECONDS;
    else process.env.AUTH_TOKEN_TTL_SECONDS = before;
  });
  it('ไม่ตั้งค่า = 8 ชั่วโมง · ตั้งค่าได้ทับ · ค่าเพี้ยน = 8 ชั่วโมง', () => {
    delete process.env.AUTH_TOKEN_TTL_SECONDS;
    expect(DEFAULT_AUTH_TTL_SECONDS).toBe(28800);
    expect(authTokenTtlSeconds()).toBe(28800);
    process.env.AUTH_TOKEN_TTL_SECONDS = '3600';
    expect(authTokenTtlSeconds()).toBe(3600);
    process.env.AUTH_TOKEN_TTL_SECONDS = 'abc';
    expect(authTokenTtlSeconds()).toBe(28800);
  });
  it('ทุกจุดที่ออกล็อกอินใช้ค่ากลางตัวเดียว ไม่มี 1800 ค้าง', () => {
    for (const f of ['api/_lib/auth.ts', 'api/_lib/authSession.ts', 'api/_handlers/auth/dev-role.ts']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/AUTH_TOKEN_TTL_SECONDS \|\| 1800/);
    }
  });
});
