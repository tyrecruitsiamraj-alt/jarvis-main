import { describe, expect, it } from 'vitest';

import { jobBoardCardTitle, publicJobPositionLabel } from '../../src/lib/unitRequestDisplay';
import type { JobRequest } from '../../src/types';

/**
 * 🔴 **หัวข้อประกาศรับสมัครต้องนำด้วยตำแหน่งงาน ไม่ใช่ชื่อหน่วยงาน**
 *
 * เจอ 27 ส.ค. 2569 ตอนให้โมเดลอ่อนสุดสวมบทพนักงานใหม่ทำภารกิจ "ไปสร้างลิงก์รับสมัคร"
 * มันเดินถึงฟอร์มได้ แต่ไม่กล้ากดปุ่มสุดท้าย (มั่นใจ 1/10) เหตุผลข้อแรกคือ
 * *"หัวข้อประกาศ 'ธนบุรีประกอบรถยนต์' อาจไม่ใช่ตำแหน่งที่เหมาะสม"* — มันถูก
 *
 * ค่านี้ไปเป็น `<h1>` บนหน้าสมัครสาธารณะ ⇒ คนหางานกดลิงก์มาต้องเห็นว่า
 * **รับตำแหน่งอะไร** ก่อนเห็นว่าบริษัทอะไร
 *
 * เทสต์นี้ล็อกสูตรค่าตั้งต้นไว้ (สูตรจริงอยู่ใน `GenApplyLinkDialog`)
 * ⚠️ ถ้าจะเปลี่ยนสูตร ต้องมาแก้ที่นี่ด้วย = มีคนอ่านเหตุผลข้างบนอีกรอบ
 */

function job(over: Partial<JobRequest>): JobRequest {
  return { id: 'x', source: 'siamraj', job_type: 'driver', ...over } as JobRequest;
}

/** สูตรเดียวกับค่าตั้งต้นในฟอร์มสร้างลิงก์ */
function defaultPostingTitle(j: JobRequest): string {
  return [publicJobPositionLabel(j), jobBoardCardTitle(j)].filter(Boolean).join(' \u00b7 ');
}

describe('ค่าตั้งต้นของหัวข้อประกาศ', () => {
  const driver = job({
    unit_name: 'ธนบุรีประกอบรถยนต์',
    job_description_code_1: 'ขับรถ',
    request_no: 'LMO6801013',
  });

  it('ขึ้นต้นด้วยตำแหน่งงาน ไม่ใช่ชื่อหน่วยงาน', () => {
    const title = defaultPostingTitle(driver);
    expect(title.startsWith('ขับรถ')).toBe(true);
    expect(title.startsWith('ธนบุรี')).toBe(false);
  });

  it('ยังมีชื่อหน่วยงานต่อท้าย — ผู้สมัครต้องรู้ว่าไปทำงานที่ไหน', () => {
    expect(defaultPostingTitle(driver)).toBe('ขับรถ \u00b7 ธนบุรีประกอบรถยนต์');
  });

  it('ไม่มีตำแหน่งในใบขอ ก็ยังได้หัวข้อที่ไม่ว่าง (ไม่ปล่อยให้หัวเรื่องหาย)', () => {
    const t = defaultPostingTitle(job({ unit_name: 'บริษัท ก', job_description_code_1: undefined }));
    expect(t.trim().length).toBeGreaterThan(0);
    expect(t).toContain('บริษัท ก');
  });

  it('ไม่มีชื่อหน่วยงาน ก็ยังได้ตำแหน่งนำ', () => {
    const t = defaultPostingTitle(
      job({ unit_name: undefined, request_no: 'LMO1', job_description_code_1: 'คนสวน' }),
    );
    expect(t.startsWith('คนสวน')).toBe(true);
  });
});
