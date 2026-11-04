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
    // 4 พ.ย. 2569 "ย่อไว้ พอกดค่อยกางออกมา" — กล่องพับไว้ กดหัวแล้วค่อยขึ้นฟอร์ม
    // ป๊อปประกาศใช้กล่องพับตัวเดียวกัน (เจ้าของ 4 พ.ย. 2569 "ทำเหมือนกับตรงหน้าใบขอ") · ป๊อปจากปุ่ม Autopost บนการ์ดไม่พับ
    expect(detail).toContain('<OrderPostFold job={data} withGenLink />');
    const order = read('src/components/jobs/OrderPostButton.tsx');
    expect(order).toContain('const [open, setOpen] = React.useState(false);');
    expect(order).toContain('{open ? <OrderPostButton {...props} /> : null}');
    expect(order).toContain("{props.withGenLink ? 'Autopost / Scrap / Gen link' : 'Autopost / Scrap'}");
    expect(read('src/components/jobs/AutopostDialog.tsx')).toContain('<OrderPostButton key={job.id} job={job} defaultKind="autopost" onSent={onSent} />');
    expect(detail).not.toContain('detail-apply-links');
  });

  it('ช่อง "สั่งอะไร" มี Gen link เฉพาะที่ขอ (หน้ารายละเอียด) · เลือกแล้วขึ้นลิงก์ที่มี + ปุ่ม Gen link พับไว้ กดกางค่อยใช้', () => {
    const order = read('src/components/jobs/OrderPostButton.tsx');
    expect(order).toContain("options={withGenLink ? [...KIND_OPTIONS, GEN_LINK_OPTION] : KIND_OPTIONS}");
    // 4 พ.ย. 2569 เจ้าของ "ย่อไว้กดกางออกค่อยให้ทำงานได้" — ไม่กางฟอร์มค้าง
    expect(order).toContain('<JobApplyLinks job={job} onChanged={onLinksChanged} />');
    expect(read('src/components/jobs/ApplyLinksPanel.tsx')).not.toContain('formOpen');
  });

  it('ป๊อปประกาศ: Gen link รวมในกล่องเดียวกับหน้าใบขอ (เจ้าของ 4 พ.ย. 2569 "ทำไมไม่รวมกันแบบหน้าใบขอ") · ไม่มีการ์ดลิงก์สมัครแยก', () => {
    const board = read('src/pages/jobs/BoardPostingPage.tsx');
    expect(board).toContain('withGenLink onLinksChanged={() => void loadPostings()}');
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
