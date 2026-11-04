/**
 * Gen link ที่หน้ารายละเอียดใบขอ (เจ้าของ 4 พ.ย. 2569 "gen link ตรงนี้ไม่ได้หรอ" → "ก็แบบหน้างานสรรหาไง" → "เอารวมกันสิ่")
 * = ตัวเลือกที่ 3 ในช่อง "สั่งอะไร" ของกล่อง Autopost / Scrap (ไม่ใช่กล่องแยก) · ใช้ชิ้นเดียวกับหน้างานสรรหา ApplyLinksPanel
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('Gen link รวมในกล่อง Autopost / Scrap', () => {
  it('หน้ารายละเอียดใบขอ: กล่องเดียว หัว "Autopost / Scrap / Gen link" · ไม่มีกล่องลิงก์สมัครแยก', () => {
    const detail = read('src/pages/jobs/SiamrajUnitRequestDetailPage.tsx');
    expect(detail).toContain('<OrderPostButton job={data} withGenLink />');
    expect(detail).toContain('Autopost / Scrap / Gen link');
    expect(detail).not.toContain('detail-apply-links');
  });

  it('ช่อง "สั่งอะไร" มี Gen link เฉพาะที่ขอ (หน้ารายละเอียด) · เลือกแล้วขึ้นลิงก์ที่มี + ปุ่ม Gen link พับไว้ กดกางค่อยใช้', () => {
    const order = read('src/components/jobs/OrderPostButton.tsx');
    expect(order).toContain("options={withGenLink ? [...KIND_OPTIONS, GEN_LINK_OPTION] : KIND_OPTIONS}");
    // 4 พ.ย. 2569 เจ้าของ "ย่อไว้กดกางออกค่อยให้ทำงานได้" — ไม่กางฟอร์มค้าง
    expect(order).toContain('<JobApplyLinks job={job} />');
    expect(read('src/components/jobs/ApplyLinksPanel.tsx')).not.toContain('formOpen');
  });

  it('หน้างานสรรหาใช้ชิ้นเดียวกัน ไม่มีโค้ด Gen link ซ้ำในหน้า', () => {
    const board = read('src/pages/jobs/BoardPostingPage.tsx');
    expect(board).toContain('<ApplyLinksPanel');
    expect(board).not.toContain('<AddChannelLinks');
    expect(board).not.toContain('<PostingLinksList');
  });

  it('ชิ้นกลาง: มีประกาศเปิด = Gen link เพิ่ม · ยังไม่มี = ฟอร์มแรก · ยังโหลดไม่เสร็จไม่โชว์ฟอร์ม (กันสร้างประกาศซ้ำ) · อ่านไม่ได้ = ปิด', () => {
    const panel = read('src/components/jobs/ApplyLinksPanel.tsx');
    expect(panel).toContain("{linkCount ? 'Gen link เพิ่ม' : 'Gen link'}");
    expect(panel).toContain('postings === null || !job ? null : openPosting ? (');
    expect(panel).toMatch(/data-testid="gen-link-toggle" disabled=\{failed\}/);
    expect(panel).toContain('setPostings(await fetchRecruitPostings({ jobId: job.id }));');
  });
});
