// @vitest-environment node
/**
 * แท็บการติดต่อปุ่ม "ทุกคน" เฉพาะ role ที่เจ้าของกำหนด (เจ้าของ 10 พ.ย. 2569)
 * > *"หน้าการติดต่อ ที่จะเห็นทุกคนได้เฉพาะคนที่ฉันกำหนดเท่านั้น ตอนนี้ให้เฉพาะ Admin … แล้วก็ Supervisor"*
 * ค่าเริ่ม Admin + Supervisor · เปิด/ปิดราย role ที่ ตั้งค่า › สิทธิ์ฟังก์ชัน · ฝั่ง API บังคับซ้ำ (ไม่พึ่งการซ่อนปุ่ม)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_FUNCTIONS, isFunctionEnabledForRole } from '@/lib/roleFunctions';
import { FUNCTION_DEFAULT_MIN_ROLE, VALID_FUNCTION_IDS, defaultFunctionEnabled, effectiveFunctionEnabled } from '../../api/_lib/roleFunctionGrants';

describe('สิทธิ์ contact_view_all', () => {
  it('ค่าเริ่ม: Admin + Supervisor เท่านั้น (ทั้งจอและ API)', () => {
    const expected = { admin: true, supervisor: true, staff: false, opl: false, sale: false } as const;
    for (const [role, on] of Object.entries(expected)) {
      expect(isFunctionEnabledForRole(role as never, 'contact_view_all')).toBe(on);
      expect(defaultFunctionEnabled(role as never, 'contact_view_all')).toBe(on);
    }
  });
  it('เจ้าของเปิดให้ Staff ได้จากหน้าตั้งค่า (override ชนะค่าเริ่ม) · ปิด Supervisor ได้', () => {
    expect(VALID_FUNCTION_IDS.has('contact_view_all')).toBe(true);
    expect(effectiveFunctionEnabled('staff', 'contact_view_all', new Map([['staff:contact_view_all', true]]))).toBe(true);
    expect(effectiveFunctionEnabled('supervisor', 'contact_view_all', new Map([['supervisor:contact_view_all', false]]))).toBe(false);
  });
  it('ทุกฟังก์ชันบนจอมีในตารางฝั่ง API ขั้นต่ำเท่ากัน (ลืมฝั่งเดียว = กดเปิด/ปิดไม่ได้เงียบ ๆ)', () => {
    for (const fn of APP_FUNCTIONS) expect([fn.id, FUNCTION_DEFAULT_MIN_ROLE[fn.id]]).toEqual([fn.id, fn.minimumRole]);
  });
});

describe('บังคับใช้', () => {
  it('API: ขอ scope=all โดยไม่มีสิทธิ์ = 403 · ป้ายผู้เก็บขึ้นเฉพาะเมื่อผ่านสิทธิ์', () => {
    const h = readFileSync('api/_handlers/job-applications.ts', 'utf8');
    expect(h).toContain("checkFunctionAccess(req.user.role, 'contact_view_all')");
    expect(h).toContain("sendError(res, 403, 'Forbidden', 'ไม่มีสิทธิ์ดูรายชื่อการติดต่อของทุกคน')");
    expect(h).toContain('const showClaimer = everyoneContact;');
  });
  it('จอ: ปุ่ม ของฉัน/ทุกคน และการโหลดของทุกคน ผูกกับสิทธิ์', () => {
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    expect(ws).toContain("const canSeeEveryoneContact = isFunctionEnabled('contact_view_all');");
    expect(ws).toContain('{canSeeEveryoneContact && !leadView && !cancelledView ? (');
    expect(ws).toContain("const everyoneContact = canSeeEveryoneContact && tab === 'contact'");
  });
});
