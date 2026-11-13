/**
 * Gen link ที่หน้ารายละเอียดใบขอ (เจ้าของ 4 พ.ย. 2569 "gen link ตรงนี้ไม่ได้หรอ" → "ก็แบบหน้างานสรรหาไง" → "เอารวมกันสิ่")
 * = ตัวเลือกที่ 3 ในช่อง "สั่งอะไร" ของกล่อง Autopost / Scrap (ไม่ใช่กล่องแยก) · ใช้ชิ้นเดียวกับหน้างานสรรหา ApplyLinksPanel
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('Gen link รวมในกล่อง Autopost / Scrap', () => {
  // 11 พ.ย. 2569 เจ้าของรวมเหลือ 3 อย่าง (Autopost · Scrap · โพสต์เอง) — Gen link อยู่ใน โพสต์เอง › ช่องทางอื่น ทุกที่
  it('หน้ารายละเอียดใบขอ: กล่องเดียว หัว "Autopost / Scrap / โพสต์เอง" · ไม่มีกล่องลิงก์สมัครแยก', () => {
    // 13 พ.ย. 2569 กล่องนี้ย้ายจากหน้ารายละเอียดไปแท็บของตัวเอง (`/actions`) · ป๊อปประกาศยังใช้กล่องพับตัวเดิม
    const order = read('src/components/jobs/OrderPostButton.tsx');
    expect(order).toContain('const [open, setOpen] = React.useState(false);');
    expect(order).toContain('{open ? <OrderPostButton {...props} /> : null}');
    expect(order).toContain('        Autopost / Scrap / โพสต์เอง\n');
    expect(order).not.toContain('withGenLink');
    expect(read('src/components/jobs/AutopostDialog.tsx')).toContain('<OrderPostButton key={job.id} job={job} defaultKind="autopost" onSent={onSent} />');
    expect(read('src/pages/jobs/SiamrajUnitRequestDetailPage.tsx')).not.toContain('detail-apply-links');
  });

  it('ช่อง "สั่งอะไร" 3 อย่างทุกที่ · โพสต์เอง = เลือกช่องทางแบบ Gen link ในที่เดียว ไม่แยก กลุ่ม Facebook / ช่องทางอื่น (13 พ.ย. 2569)', () => {
    const order = read('src/components/jobs/OrderPostButton.tsx');
    expect(order).toContain('options={KIND_OPTIONS}');
    expect(order).not.toContain("label: 'ช่องทางอื่น (Tiktok · Facebook Page · LINE · Webjob …)'");
    expect(order).toContain('<ManualPostPanel job={job} onChanged={onLinksChanged} />');
    expect(read('src/components/jobs/ApplyLinksPanel.tsx')).not.toContain('formOpen');
  });

  it('ป๊อปประกาศ: Gen link รวมในกล่องเดียวกับหน้าใบขอ (เจ้าของ 4 พ.ย. 2569 "ทำไมไม่รวมกันแบบหน้าใบขอ") · ไม่มีการ์ดลิงก์สมัครแยก', () => {
    const board = read('src/pages/jobs/BoardPostingPage.tsx');
    expect(board).toContain('caption={postText} onLinksChanged={() => void loadPostings()}');
    expect(board).not.toContain('<ApplyLinksPanel');
    expect(board).not.toContain('title="ลิงก์สมัคร"');
    expect(board).not.toContain('wantLink');
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
