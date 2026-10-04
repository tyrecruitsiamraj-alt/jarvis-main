/**
 * ชื่อเมนูที่เจ้าของเปลี่ยน 4 ต.ค. 2569:
 *   หน้าสมัครสาธารณะ (/apply) → ประกาศ · คลังคน → รายชื่อรอลงงาน · กล่องงาน → งานสรรหา
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONVEYOR_VAULT } from '@/lib/soRecruitNav';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ชื่อเมนูใหม่ 4 ต.ค. 2569', () => {
  it('เมนูข้าง: งานสรรหา · รายชื่อรอลงงาน', () => {
    expect(CONVEYOR_VAULT.find((v) => v.key === 'job-boxes')?.label).toBe('งานสรรหา');
    expect(CONVEYOR_VAULT.find((v) => v.key === 'candidates')?.label).toBe('รายชื่อรอลงงาน');
  });

  it('เมนูล่าง + หัวหน้ารายชื่อ ใช้ชื่อเดียวกัน', () => {
    expect(read('src/components/layout/bottom-nav/dockNavConfig.tsx')).toContain("label: 'รายชื่อรอลงงาน'");
    expect(read('src/pages/matching/CandidatesPage.tsx')).toContain('title="รายชื่อรอลงงาน"');
  });

  it('ทางเข้า /apply เขียนว่า "ประกาศ" ไม่เหลือ "หน้าสมัครสาธารณะ" บนจอ', () => {
    expect(read('src/components/layout/AppNavDrawer.tsx')).toContain('ประกาศ (/apply)</span>');
    expect(read('src/components/layout/JobBoardHeaderMenu.tsx')).toContain('<p className="text-sm font-medium">ประกาศ</p>');
    for (const f of ['src/components/layout/AppNavDrawer.tsx', 'src/components/layout/JobBoardHeaderMenu.tsx']) {
      expect(read(f)).not.toMatch(/>\s*หน้าสมัครสาธารณะ/);
    }
  });
});
