// @vitest-environment node
/**
 * QA 17 ต.ค. 2569 กลุ่ม "หน้าสมัคร /apply/p" — เจ้าของเลือกแก้ 18 ต.ค. 2569
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ลิงก์สมัครโหลดล้ม ≠ ลิงก์ใช้ไม่ได้', () => {
  it('catch ไปที่สถานะล้ม + ปุ่มลองอีกครั้ง · 404 เท่านั้นที่บอกลิงก์ใช้ไม่ได้', () => {
    const src = read('src/pages/public/PublicPostingApplyPage.tsx');
    expect(src).toContain('if (!cancelled) setFailed(true);');
    expect(src).toContain('ลองอีกครั้ง');
    expect(src).not.toMatch(/\.catch\(\(\) => \{\s*if \(!cancelled\) setNotFound\(true\);/);
  });
  it('หน้ารวม /apply โหลดล้มส่ง loadError (ไม่กลายเป็น "ไม่มีตำแหน่งตรงตัวกรอง")', () => {
    expect(read('src/pages/public/PublicJobBoardPage.tsx')).toContain('loadError={loadError}');
  });
});

describe('ฐานเงินเดือนขึ้นเสมอ + อัตราที่รับเป็นอัตราจริง', () => {
  const src = read('api/_handlers/public/jobs.ts');
  it('ทีมแยกรายได้เองก็ยังส่งฐานจาก ERP', () => {
    expect(src).toContain('...(income?.base != null ? { monthly_income_base: income.base } : {}),');
  });
  it('ส่ง position_units (เหลือหา) ออกหน้าสาธารณะ', () => {
    expect(src).toMatch(/position_units: \(\(\) => \{/);
  });
});

describe('เจ้าหน้าที่เปิดดูลิงก์ไม่นับคลิก', () => {
  it('apply-link + ลิงก์สั้น เช็ก isSignedInViewer', () => {
    expect(read('api/_handlers/public/apply-link.ts')).toContain('countHit: !isSignedInViewer(req)');
    expect(read('api/_handlers/short-links-resolve.ts')).toContain('isSignedInViewer(req)');
    expect(read('api/_lib/recruitPostings.ts')).toContain('if (opts.countHit !== false) void dbQuery(');
  });
});

describe('ฟอร์มสมัคร', () => {
  const src = read('src/components/jobs/PublicApplyDialog.tsx');
  it('เพศไม่เลือกไว้ล่วงหน้า + บังคับเลือก', () => {
    expect(src).toContain("useState<Gender | ''>('')");
    expect(src).toContain("if (!gender) return setError('กรุณาเลือกเพศ');");
  });
  it('เบอร์ขึ้นต้น 0 · 9–10 หลัก · ไม่มีเด็กชาย/เด็กหญิง', () => {
    expect(src).toContain('/^0\\d{8,9}$/');
    expect(src).toContain("!o.value.startsWith('เด็ก')");
  });
});
