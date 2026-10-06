// @vitest-environment node
/**
 * 🔴 ปุ่มดูตัวอย่างหน้าสมัครก่อน gen link (เจ้าของเคาะ 22 ก.ย. 2569 นิยามข้อ 4)
 * หน้าจริงกับตัวอย่างต้องใช้ component ตัวเดียวกัน (ไม่ก๊อปโครง) · ห้าม Dialog ซ้อน
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const PREVIEW = read('src/components/jobs/PublicPostingPreview.tsx');
const PAGE = read('src/pages/public/PublicPostingApplyPage.tsx');
const GEN = read('src/components/jobs/GenApplyLinkDialog.tsx');

describe('PublicPostingPreview — presentational ตัวเดียวใช้ร่วม', () => {
  it('รับ props ล้วน ไม่ fetch เอง', () => {
    expect(PREVIEW).not.toMatch(/\bfetch\(/);
    expect(PREVIEW).not.toContain('useEffect');
    expect(PREVIEW).toContain('PublicPostingPreviewData');
  });
  it('หน้าจริง /apply/p ใช้ component นี้ (ไม่วาดการ์ดเอง)', () => {
    expect(PAGE).toContain('PublicPostingPreview');
    // โครงการ์ดเดิมถูกยกไป component แล้ว — หน้าไม่มี h1 ของตัวเอง
    expect(PAGE).not.toContain('So Recruit · รับสมัครงาน');
  });
});

describe('GenApplyLinkDialog — ตัวอย่างก่อนสร้างลิงก์', () => {
  it('ใช้ PublicPostingPreview ตัวเดียวกับหน้าจริง', () => {
    expect(GEN).toContain('PublicPostingPreview');
    expect(GEN).toContain('previewOpen');
  });
  it('กางในป๊อปเดิม ไม่เปิด Dialog ซ้อน', () => {
    // ตัวอย่างต้องไม่ยัด <Dialog> ตัวใหม่รอบ preview
    const at = GEN.indexOf('previewOpen ? (');
    const block = GEN.slice(at, at + 400);
    expect(block).not.toContain('<Dialog');
  });
  it('ป้อนด้วยค่าที่กรอกอยู่ (title/detail/location/salary/contact)', () => {
    expect(GEN).toContain('data={{ title, detail, locationText, salaryText, contactName, contactPhone }}');
  });
});

/**
 * 🔴 หน้าเปิดจาก Gen link = การ์ดแบบหน้า /apply (เจ้าของ 6 ต.ค. 2569: *"มันต้องเห็นแบบหน้า apply สิ่"*)
 * ข้อมูลงานชุดเดียวกับหน้ารวม · การ์ดประกาศเดิมเป็นทางถอยเมื่อไม่มีใบงาน
 */
describe('หน้าลิงก์ /apply/p = การ์ดเดียวกับหน้า /apply', () => {
  const JOBS = read('api/_handlers/public/jobs.ts');
  const LINK = read('api/_handlers/public/apply-link.ts');
  const linked = JOBS.slice(JOBS.indexOf('export async function getLinkedPublicJob'), JOBS.indexOf('export default async function handler'));

  it('หน้าใช้ PublicJobCardPreview ตัวเดียวกับตัวอย่างในป๊อปประกาศ + ปุ่มสมัครจริง · ส่งใบงานเข้าฟอร์ม', () => {
    expect(PAGE).toContain('<PublicJobCardPreview');
    expect(PAGE).toContain('onApply={() => setApplyOpen(true)}');
    expect(PAGE).toContain('job={job}');
    // ไม่มีใบงาน = การ์ดประกาศเดิม
    expect(PAGE).toContain('<PublicPostingPreview');
  });

  it('เส้นลิงก์คืนใบงานจาก getLinkedPublicJob · โหลดล้ม = null ไม่ทำลิงก์ล่ม', () => {
    expect(LINK).toContain('getLinkedPublicJob(posting.jobId)');
    expect(LINK).toMatch(/catch \(e\)[\s\S]*logWarn/);
  });

  it('ใบงานของลิงก์: ยังมีด่านใบล่วงหน้า + ใบยังเปิด + ทับค่าที่แก้เอง · ไม่ใช้ด่านปล่อยขึ้นหน้ารวม/ได้คนแล้ว', () => {
    expect(linked).toContain('isPublicVisibleByPrequest');
    expect(linked).toContain('isPublicVisible(item)');
    expect(linked).toContain('withStaffOverrides');
    expect(linked).toContain('withBenefits');
    expect(linked).not.toContain('onlyReleasedJobs(');
    expect(linked).not.toContain('withoutFilledJobs(');
  });

  it('หน้ารวม /apply ยังมีด่านปล่อย + ได้คนแล้วครบ (ไม่ถูกแตะ)', () => {
    const single = JOBS.slice(JOBS.indexOf('async function getPublicSiamrajJob'), JOBS.indexOf('/**\n * ใบงานของลิงก์'));
    expect(single).toContain('onlyReleasedJobs(');
    expect(single).toContain('withoutFilledJobs(');
  });
});
