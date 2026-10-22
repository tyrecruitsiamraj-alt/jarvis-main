/** ช่องจังหวัด/อำเภอพิมพ์ค้นได้ (เจ้าของ 22 ต.ค. 2569 "ทำให้ค้นหาได้") — ฟอร์มเพิ่มผู้สมัคร + ป๊อป Gen link */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('จังหวัด/อำเภอค้นหาได้', () => {
  it('ใช้ SearchableSelect ไม่ใช่ดรอปดาวน์ธรรมดา', () => {
    const add = read('src/components/recruit-rm/AddApplicantDialog.tsx');
    expect(add).toMatch(/<SearchableSelect\s+ariaLabel="จังหวัด"/);
    expect(add).toMatch(/<SearchableSelect\s+ariaLabel="อำเภอ\/เขต"/);
    expect(add).not.toMatch(/<FieldSelect\s+ariaLabel="จังหวัด"/);
    expect(read('src/components/jobs/GenApplyLinkDialog.tsx')).toMatch(/<SearchableSelect\s+ariaLabel="จังหวัด"/);
    expect(read('src/components/shared/SearchableSelect.tsx')).toContain('aria-label={ariaLabel}');
  });
});

describe('ฟอร์มเพิ่มผู้สมัคร ถอดช่องประเภทเจาะจง (เจ้าของ 22 ต.ค. 2569 "เอาออกเลย")', () => {
  it('ไม่มีช่อง/ค่าประเภทเจาะจงในฟอร์มเพิ่ม', () => {
    const add = read('src/components/recruit-rm/AddApplicantDialog.tsx');
    expect(add).not.toContain('ariaLabel="ประเภทเจาะจง"');
    expect(add).not.toContain('specific_type:');
  });
});
