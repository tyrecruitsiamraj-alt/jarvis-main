import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** กดลิงก์โพสต์ = ขึ้นฟอร์มทันที ข้ามหน้ารายละเอียด · งาน/ช่องทางล็อกตามลิงก์ (เจ้าของ 16 พ.ย. 2569) */
describe('ลิงก์โพสต์เปิดฟอร์มทันที', () => {
  const page = readFileSync('src/pages/public/PublicPostingApplyPage.tsx', 'utf8');
  it('โหลดลิงก์ได้ + ยังไม่ปิดรับ = เปิดฟอร์มเอง · ปิดรับแล้วไม่เด้ง', () => {
    expect(page).toContain("if (data.status !== 'closed') setApplyOpen(true);");
  });
  it('เด้งเองไม่นับ "กดสมัคร" (นับเฉพาะคนกดปุ่ม) · ปิดฟอร์มแล้วยังมีปุ่มสมัครงาน', () => {
    const auto = page.slice(page.indexOf('.then((data) =>'), page.indexOf('.catch('));
    expect(auto).not.toContain('trackPublicClick');
    expect(page).toContain('onApply={openApply}');
  });
  it('ฟอร์มไม่มีช่องเลือกตำแหน่ง · งานกับช่องทางมาจากลิงก์', () => {
    const dlg = readFileSync('src/components/jobs/PublicApplyDialog.tsx', 'utf8');
    expect(dlg).toContain('job_id: job?.id ?? posting?.jobId ?? null');
    expect(dlg).toContain("const lockedChannel = posting?.channelLabel?.trim()");
  });
});
