// @vitest-environment node
/**
 * **แผงอธิบายระบบบนหน้าเข้าสู่ระบบต้องพูดตรงกับเมนูจริง**
 *
 * เจ้าของทวงงานคิดฝั่งซ้าย 5 ก.ย. 2569 (*"ฝั่งซ้ายไม่ได้คิดหรือต่อยอดอะไรเลยหรอ"*)
 * ⇒ เปลี่ยนจาก "คำโฆษณาที่เขียนมือ" เป็น **ดึงชื่อ/คำอธิบาย/ไอคอนจาก `CONVEYOR_STEPS`**
 * ซึ่งเป็นเมนูจริงหลังล็อกอิน · ด่านนี้กันไม่ให้ใครกลับไปเขียนคำมือทับอีก
 * (ของเดิมเพี้ยนจริง: หน้า Login เขียน "ปล่อยประกาศ + จับคู่คน" ทั้งที่เมนูชื่อ "จับคู่งาน")
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const login = read('src/pages/LoginPage.tsx');
/** โค้ดจริงโดยตัดคอมเมนต์ออก — ไฟล์นี้อธิบายของที่ **เลิกใช้** ไว้ในคอมเมนต์ด้วย */
const loginCode = login
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !/^\s*\/\//.test(l))
  .join('\n');

describe('แผงอธิบายระบบ (ซ้ายมือหน้า Login)', () => {
  it('🔴 ดึงสี่ขั้นจากเมนูจริง ไม่ใช่คำที่เขียนมือไว้เอง', () => {
    expect(login).toContain("from '@/lib/soRecruitNav'");
    expect(login).toMatch(/CONVEYOR_STEPS\.map/);
    // ห้ามมีลิสต์ขั้นที่เขียนมือกลับมาอีก
    expect(loginCode).not.toMatch(/const INTRO_STEPS/);
  });

  it('ใช้ทั้งชื่อ คำอธิบาย และไอคอนของเมนู (ไม่ใช่หยิบมาแค่ชื่อ)', () => {
    expect(login).toMatch(/step\.label/);
    expect(login).toMatch(/step\.blurb/);
    expect(login).toMatch(/step\.icon/);
  });

  it('🔴 ไม่ยิง API ที่วิ่งไปถาม ERP จากหน้าที่ยังไม่ล็อกอิน', () => {
    // วัดจริง 5 ก.ย. 2569: /api/public/jobs = 124 KB / 4.7 วิ ⇒ ห้ามเอามาแปะหน้านี้
    expect(loginCode).not.toContain('/api/public/jobs');
  });
});
