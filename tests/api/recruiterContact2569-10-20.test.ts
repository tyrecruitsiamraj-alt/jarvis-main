// @vitest-environment node
/**
 * เบอร์เจ้าหน้าที่สรรหาบนการ์ดงาน (เจ้าของ 20 ต.ค. 2569 "โชว์เบอร์โทรเจ้าหน้าที่สรรหาด้วย")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { displayThaiPhone, pickRecruiterContact } from '../../api/_lib/recruiterContact';
import { formatRecruiterPhone } from '../../src/lib/recruiterContact';

const read = (p: string) => readFileSync(p, 'utf8');

describe('เบอร์เจ้าหน้าที่สรรหา', () => {
  it('รูปเบอร์ 0XX-XXX-XXXX ทั้งฝั่ง API และหน้าเว็บ · เบอร์ตัวอย่าง/ว่าง = ไม่โชว์', () => {
    expect(displayThaiPhone('+66891234567')).toBe('089-123-4567');
    expect(formatRecruiterPhone('+66891234567')).toBe('089-123-4567');
    expect(formatRecruiterPhone('089 123 4567')).toBe('089-123-4567');
    expect(displayThaiPhone('0812345678')).toBeNull();
    expect(formatRecruiterPhone('')).toBeNull();
  });
  it('ชื่อเล่นซ้ำแล้วเบอร์ต่างกัน = ไม่โชว์ (ห้ามเดาเบอร์ผิดคนให้คนนอก)', () => {
    expect(pickRecruiterContact([{ name: 'คิว', phone: '0891234567' }])).toEqual({ name: 'คิว', phone: '089-123-4567' });
    expect(pickRecruiterContact([{ name: 'คิว', phone: '0891234567' }, { name: 'คิว', phone: '+66891234567' }])).not.toBeNull();
    expect(pickRecruiterContact([{ name: 'คิว', phone: '0891234567' }, { name: 'คิว', phone: '0899999999' }])).toBeNull();
  });
  it('API สาธารณะแนบ recruiter_contact · ชื่อดิบ recruiter_name ไม่ออกหน้าสาธารณะ', () => {
    const src = read('api/_handlers/public/jobs.ts');
    expect(src).toContain('await attachAssignments(stillHiring);');
    expect(src).toContain('recruiter_name_internal: recruiterName');
    expect(src).toContain('function stripInternal');
    expect(src).not.toMatch(/^\s+recruiter_name: r\.recruiter_name/m);
  });
  it('การ์ดงานมีบรรทัดติดต่อ (กดโทรได้) · ตัวอย่างในป๊อปประกาศหาเบอร์จากสมุดเบอร์', () => {
    expect(read('src/components/jobs/JobPublicFacts.tsx')).toContain('data-testid="job-public-contact"');
    expect(read('src/components/jobs/PublicJobCardPreview.tsx')).toContain('contact={contact}');
  });
});
