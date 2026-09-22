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
