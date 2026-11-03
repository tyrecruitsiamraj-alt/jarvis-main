/**
 * Autopost กดทีเดียวจบ (เจ้าของ 3 พ.ย. 2569 "ถ้ากด Auto post … เลือกบัญชี เลือกกลุ่ม เลือก worker แล้วก็ไปโพสต์เลย"
 * → Choice "ใช่ กด Autopost ทีเดียวจบ") — ใบที่ยังไม่ประกาศ: กดส่ง = ประกาศ + สร้างประกาศ/ลิงก์ให้ · ข้อมูลขาดยังกดไม่ได้
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUTOPOST_LINK_PLACEHOLDER, publicPostText } from '@/lib/postText';
import { jobPostingBody, jobPostingDraft } from '@/lib/recruitPostingDraft';
import type { JobRequest } from '@/types';

const job = {
  id: 'siamraj-pre:LAM6910001',
  request_no: 'LAM6910001',
  unit_name: 'บริษัท ทีเอเค โพรดัคส์ แอนด์ เซอร์วิสเชส จำกัด',
  department_code: 'LAM',
  location_address: 'บริษัท ทีเอเค โพรดัคส์ แอนด์ เซอร์วิสเชส จำกัด อำเภอนครชัยศรี จังหวัด นครปฐม',
  staff_title_name: 'พนักงานคลังสินค้า',
  contact_name: null,
  contact_phone: null,
} as unknown as JobRequest;

describe('ค่าตั้งต้นของประกาศ = ชุดเดียวกับป๊อป Gen link', () => {
  it('ประกาศของใบขอ: ลิงก์กลาง 1 อัน · จังหวัดถอดจากที่อยู่', () => {
    const b = jobPostingBody(job);
    expect(b.jobId).toBe('siamraj-pre:LAM6910001');
    expect(b.channels).toEqual([]);
    expect(b.province).toBe(jobPostingDraft(job).province);
    expect(b.title).toBe(jobPostingDraft(job).title);
  });
  it('ป๊อป Gen link ใช้ตัวเดียวกัน', () => {
    expect(readFileSync('src/components/jobs/GenApplyLinkDialog.tsx', 'utf8')).toContain('const draft = job ? jobPostingDraft(job) : null;');
  });
});

describe('ตัวแทนลิงก์', () => {
  it('ไม่ขึ้นหน้าสมัคร (เหมือนบรรทัดลิงก์)', () => {
    expect(publicPostText(`รับสมัครพนักงาน\nสมัครงานได้ที่ : ${AUTOPOST_LINK_PLACEHOLDER}\nโทร 0812345678`)).toBe('รับสมัครพนักงาน\nโทร 0812345678');
  });
  it('กดส่ง = ประกาศ + สร้างประกาศ แล้วแทนตัวแทนด้วยลิงก์จริงก่อนส่ง', () => {
    const src = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(src).toContain('posting = await createRecruitPosting(jobPostingBody(job));');
    expect(src).toContain('await releaseJobsToPublic([job.id]);');
    expect(src).toContain('const finalCaption = caption.split(AUTOPOST_LINK_PLACEHOLDER).join(applyLink);');
    expect(src).toContain('autopostMissing(job, { hasLink: true })');
  });
});

describe('ข้อความที่เคยแก้ไว้ ลิงก์ตามที่เลือกเสมอ (รูปหน้างาน 3 พ.ย. 2569 "ข้อความต้องมีลิงก์สมัครที่เลือก")', () => {
  it('แทนลิงก์สมัครเก่าและตัวแทนลิงก์ด้วยลิงก์ที่เลือก · ข้อความอื่นไม่แตะ', async () => {
    const { syncCaptionLink } = await import('@/components/jobs/AutopostDialog');
    const now = 'https://jarvis.siamrajathanee.dev/apply/p/eymkhef';
    expect(syncCaptionLink('รับสมัครคนขับรถ\nหรือสมัครงานได้ที่ : https://jarvis.siamrajathanee.dev/apply/p/64hfy6f', now)).toBe(`รับสมัครคนขับรถ\nหรือสมัครงานได้ที่ : ${now}`);
    expect(syncCaptionLink(`สมัครงานได้ที่ : ${AUTOPOST_LINK_PLACEHOLDER}`, now)).toBe(`สมัครงานได้ที่ : ${now}`);
    expect(syncCaptionLink('ดูรายละเอียด https://www.facebook.com/groups/123', now)).toBe('ดูรายละเอียด https://www.facebook.com/groups/123');
  });

  it('ไม่มีช่องเลือกลิงก์ (เจ้าของ 3 พ.ย. 2569 "ฉันก็เลือกกลุ่มแล้วหนิ") · ลิงก์กลางของใบสั่ง = ลิงก์ของกลุ่มแรก', () => {
    const src = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(src).not.toContain('testId="autopost-link"');
    expect(src).not.toContain('สร้างลิงก์ใหม่ Facebook');
    expect(src).toContain('const captionLink = AUTOPOST_LINK_PLACEHOLDER;');
    expect(src).toContain('const first = groupLinks[0];');
    expect(src).toContain('const applyLink = first.apply_link;');
  });
});
