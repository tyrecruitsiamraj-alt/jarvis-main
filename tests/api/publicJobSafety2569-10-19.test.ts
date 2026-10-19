// @vitest-environment node
/** หน้าสมัครงานสาธารณะ: รหัสย่อไซต์ → ชื่อบริษัทเต็ม · ตัดที่อยู่บ้านนาย (QA 19 ต.ค. 2569 · เจ้าของ Choice) */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { publicJobDetails, publicWorkSiteName } from '../../src/lib/publicJobSafety';

describe('publicJobSafety', () => {
  it('ชื่อไซต์ไม่มีอักษรไทย = รหัสย่อ ไม่ส่ง · ชื่อไทยใช้ต่อ', () => {
    expect(publicWorkSiteName('HRSA')).toBeUndefined();
    expect(publicWorkSiteName('krungsri')).toBeUndefined();
    expect(publicWorkSiteName('สมิติเวช ชลบุรี')).toBe('สมิติเวช ชลบุรี');
    expect(publicWorkSiteName('TK park ,สบร')).toBe('TK park ,สบร');
    expect(publicWorkSiteName(null)).toBeUndefined();
  });
  it('ตัดบรรทัดบ้าน/คอนโด/หมู่บ้านของนาย · บรรทัดอื่นอยู่ครบ', () => {
    expect(publicJobDetails(['รับนายคอนโด ลุมพินีวิลล์', 'ทำงาน 6 วัน'])).toEqual(['ทำงาน 6 วัน']);
    expect(publicJobDetails(['นายบ้านอยู่ หมู่บ้านมัณฑนา บางนา'])).toBeUndefined();
    expect(publicJobDetails(['รับนายบริเวณลาดพร้าว โชคชัย4'])).toEqual(['รับนายบริเวณลาดพร้าว โชคชัย4']);
    expect(readFileSync('api/_handlers/public/jobs.ts', 'utf8')).toContain('job_details: publicJobDetails(r.job_details),');
  });
});
