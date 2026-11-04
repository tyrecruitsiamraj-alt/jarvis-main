/**
 * Gen link ที่หน้ารายละเอียดใบขอ แบบหน้างานสรรหา (เจ้าของ 4 พ.ย. 2569 "gen link ตรงนี้ไม่ได้หรอ" → "ก็แบบหน้างานสรรหาไง")
 * สองหน้าใช้ชิ้นเดียว ApplyLinksPanel — "มีแล้ว N ลิงก์" + ปุ่ม Gen link กางลง (มีประกาศ = Gen link เพิ่ม · ยังไม่มี = ฟอร์มแรก)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ลิงก์สมัคร: ชิ้นเดียวสองหน้า', () => {
  it('หน้ารายละเอียดใบขอมีส่วนลิงก์สมัคร โหลดประกาศของใบเอง แล้วใช้ ApplyLinksPanel', () => {
    const detail = read('src/pages/jobs/SiamrajUnitRequestDetailPage.tsx');
    expect(detail).toContain('data-testid="detail-apply-links"');
    expect(detail).toContain('setPostings(await fetchRecruitPostings({ jobId: job.id }));');
    expect(detail).toContain('<ApplyLinksPanel job={job} postings={postings} failed={failed} onReload={() => void load()} />');
  });

  it('หน้างานสรรหาใช้ชิ้นเดียวกัน ไม่มีโค้ด Gen link ซ้ำในหน้า', () => {
    const board = read('src/pages/jobs/BoardPostingPage.tsx');
    expect(board).toContain('<ApplyLinksPanel');
    expect(board).not.toContain('<AddChannelLinks');
    expect(board).not.toContain('<PostingLinksList');
  });

  it('ชิ้นกลาง: มีประกาศเปิด = Gen link เพิ่ม (AddChannelLinks) · ยังไม่มี = ฟอร์มแรก (GenApplyLinkDialog embedded) · อ่านไม่ได้ = ปิดปุ่ม', () => {
    const panel = read('src/components/jobs/ApplyLinksPanel.tsx');
    expect(panel).toContain("{linkCount ? 'Gen link เพิ่ม' : 'Gen link'}");
    expect(panel).toContain('<AddChannelLinks');
    expect(panel).toContain('<GenApplyLinkDialog\n              embedded');
    expect(panel).toMatch(/data-testid="gen-link-toggle" disabled=\{failed\}/);
  });
});
