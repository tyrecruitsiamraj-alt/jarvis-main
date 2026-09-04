// @vitest-environment node
/**
 * **กติกา UI: หน้าหลักต้องใช้ของ shadcn ไม่ปั้นเปลือกเอง**
 *
 * เจ้าของทัก 3 ก.ย. 2569: *"หน้า UI ฉันให้ใช้ Shadcn เพื่อคุม Framework
 * ห้ามสร้าง component เอง ลืมไหม หน้า UI หน้าหลักมันดูสะเปะสะปะ"*
 *
 * ที่มันสะเปะสะปะเพราะแต่ละแผงปั้นเปลือก/ปุ่มของตัวเอง ⇒ ด่านนี้กันไม่ให้กลับไปเป็นแบบนั้น
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const HOME_FILES = [
  'src/pages/HomePage.tsx',
  'src/components/home/HomeSection.tsx',
  'src/components/home/FollowTodayPanel.tsx',
  'src/components/home/LumosCallHealthPanel.tsx',
];

describe('เปลือกแผงหน้าหลัก', () => {
  it('🔴 HomeSection ประกอบจาก Card ของ shadcn — ไม่ได้ปั้นเอง', () => {
    const s = read('src/components/home/HomeSection.tsx');
    expect(s).toContain("from '@/components/ui/card'");
    expect(s).toMatch(/<Card\b/);
    // ห้ามวาดกรอบ/พื้นเองซ้อนกับ Card — ตัดคอมเมนต์ก่อน (คอมเมนต์อ้างคลาสเก่าได้)
    const code = s
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n');
    expect(code).not.toMatch(/rounded-2xl border border-white/);
  });

  it('ก้อน "ตัวเลขวันนี้" อยู่ในเปลือกเดียวกับแผงอื่น', () => {
    const home = read('src/pages/HomePage.tsx');
    expect(home).toMatch(/<HomeSection[\s\S]{0,200}ตัวเลขวันนี้/);
  });

  it('🔴 จังหวะแนวตั้งชุดเดียว — ไม่ใส่ mb ทีละแผง', () => {
    const home = read('src/pages/HomePage.tsx');
    expect(home).toMatch(/space-y-5/);
    expect(home).not.toMatch(/className="mb-5"/);
    expect(home).not.toMatch(/className="mb-6"/);
  });
});

describe('ปุ่มบนหน้าหลัก', () => {
  it('🔴 ห้ามใช้คลาส jarvis-btn-* (ปุ่มที่ปั้นเองใน CSS) — ใช้ Button ของ shadcn', () => {
    for (const f of HOME_FILES) {
      const src = read(f);
      // ตัดคอมเมนต์ออกก่อน — คอมเมนต์อ้างชื่อคลาสเพื่ออธิบายได้
      const code = src
        .split('\n')
        .filter((l) => !/^\s*(\*|\/\/|\{\/\*)/.test(l))
        .join('\n');
      expect(code, f).not.toMatch(/className="[^"]*jarvis-btn/);
    }
  });

  it('ไฟล์ที่มีปุ่มต้อง import Button จาก shadcn', () => {
    for (const f of ['src/pages/HomePage.tsx', 'src/components/home/FollowTodayPanel.tsx']) {
      expect(read(f), f).toContain("from '@/components/ui/button'");
    }
  });
});
