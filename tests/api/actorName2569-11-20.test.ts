/**
 * บอกชื่อบัญชีที่ล็อกอิน (เจ้าของ 20 พ.ย. 2569 "แบบนี้จะรู้ได้ไงว่าใครสั่ง" · Choice "โชว์ชื่อบัญชีที่ล็อกอินบนสุด + บนปุ่มบันทึก")
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { actorNameOf } from '@/lib/actorName';

describe('ชื่อบัญชีที่ล็อกอิน', () => {
  it('ชื่อเล่น › ชื่อเต็ม › อีเมลหน้า @ (กติกาเดียวกับชื่อคนสั่งในรายงาน)', () => {
    expect(actorNameOf({ nickname: 'เจมส์', full_name: 'Pakorn Kanchanachai', email: 'pakkorn.k@siamraj.com' })).toBe('เจมส์');
    expect(actorNameOf({ nickname: null, full_name: 'Administrator', email: 'nitinan.c@siamraj.com' })).toBe('Administrator');
    expect(actorNameOf({ nickname: ' ', full_name: '', email: 'kanyanat.y@siamraj.com' })).toBe('kanyanat.y');
    expect(actorNameOf(null)).toBe('');
  });
  it('มุมขวาบน + ช่องลิงก์โพสต์ + ปุ่ม Autopost/Scrap บอกชื่อ · /api/auth/me ส่งชื่อเล่น', () => {
    expect(readFileSync('src/components/layout/AppLayout.tsx', 'utf8')).toContain('data-testid="header-actor-name">{actorNameOf(user)}');
    expect(readFileSync('src/components/jobs/ManualPostPanel.tsx', 'utf8')).toContain('`บันทึกในชื่อ ${actor}`');
    expect(readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8')).toContain('จะบันทึกในชื่อ {actor}');
    expect(readFileSync('src/components/jobs/OrderPostButton.tsx', 'utf8')).toContain('จะบันทึกในชื่อ {actor}');
    const me = readFileSync('api/_handlers/auth/me.ts', 'utf8');
    expect(me).toContain('nickname: row.nickname?.trim() || null,');
    expect(me.match(/extra_department_codes, nickname/g)?.length).toBe(2);
    expect(readFileSync('src/contexts/AuthContext.tsx', 'utf8')).toContain("nickname: typeof raw.nickname === 'string' && raw.nickname.trim() ? raw.nickname.trim() : null,");
  });
});
