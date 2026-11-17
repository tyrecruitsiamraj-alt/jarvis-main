import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { syncCaptionLink } from '@/components/jobs/AutopostDialog';
import { AUTOPOST_LINK_PLACEHOLDER } from '@/lib/postText';

describe('โพสต์เองพร้อมรูป (17 พ.ย. 2569)', () => {
  it('ข้อความที่ทีมบันทึกไว้ได้ลิงก์ของโพสต์เองแทนลิงก์เดิม/ตัวแทนลิงก์', () => {
    const link = 'https://jarvis.siamrajathanee.dev/apply/p/NEW123';
    const saved = `รับสมัคร\nสมัครงานได้ที่ : ${AUTOPOST_LINK_PLACEHOLDER}\nหรือ https://jarvis.siamrajathanee.dev/apply/p/OLD999`;
    const out = syncCaptionLink(saved, link);
    expect(out).not.toContain(AUTOPOST_LINK_PLACEHOLDER);
    expect(out).not.toContain('OLD999');
    expect(out.split(link).length - 1).toBe(2);
  });

  it('ป๊อปโพสต์เองมีรูปทั้งตอนเลือกและหลังเตรียมโพสต์ · Autopost หยิบรูปล่าสุดของใบขอ', () => {
    const panel = readFileSync('src/components/jobs/ManualPostPanel.tsx', 'utf8');
    expect(panel.match(/<PostImageField job=\{job\} attach=\{attachImage\} onAttachChange=\{setAttachImage\} \/>/g)?.length).toBe(2);
    // เลือกก่อน ไม่แนบรูป/แนบรูป (17 พ.ย. 2569) · ค่าเริ่ม ไม่แนบ
    expect(panel).toContain('React.useState(false)');
    const field = readFileSync('src/components/jobs/PostImageField.tsx', 'utf8');
    expect(field).toContain("'ไม่แนบรูป'");
    expect(field).toMatch(/\{attach \? \(/);
    const auto = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(auto).toContain('fetchLatestPostImage(job.id)');
  });

  it('GET /api/post-images?job= ใช้สิทธิ์เดียวกับสั่งโพสต์', () => {
    const h = readFileSync('api/_handlers/post-images.ts', 'utf8');
    expect(h).toContain("withRbac(handler, 'matching-job-postings')");
    expect(h).toContain('latestPostImageId(jobId)');
  });
});
