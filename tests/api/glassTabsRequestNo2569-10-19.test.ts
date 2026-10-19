// @vitest-environment node
/**
 * เจ้าของ 19 ต.ค. 2569 (หน้าไล่งานของใบ › ตรวจสอบ):
 * - "หาพื้นที่จากตรงนี้เอาเลขที่ใบขอมาโชว์หน่อย" → เลขที่ใบขอชิดขวาแถวป้ายช่องที่ขาด
 * - "พวก menu bar ฉันอยากได้แบบ Glass Menu" → `TabsList variant="glass"` (variant ใน ui/tabs ที่เดียว · ไม่เขียน CSS ใหม่)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('หน้าไล่งานของใบ', () => {
  it('เลขที่ใบขออยู่แถวเดียวกับป้ายช่องที่ขาด', () => {
    const src = read('src/pages/jobs/BoardPostingPage.tsx');
    expect(src).toContain('data-testid="quick-request-no"');
    expect(src).toContain('{job.request_no}');
  });
  it('แถบตรวจสอบ/รายชื่อ เป็นแถบกระจก', () => {
    expect(read('src/pages/jobs/BoardPostingPage.tsx')).toContain('<TabsList variant="glass"');
  });
});

describe('ui/tabs: variant glass', () => {
  const src = read('src/components/ui/tabs.tsx');
  it('มี glass ทั้งแถบและแท็บ · ค่าตั้งต้นหน้าตาเดิม · ไม่เบลอ · ไม่มี hex', () => {
    expect(src).toContain('glass: [');
    expect(src).toContain('default: "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground"');
    expect(src).not.toMatch(/"[^"\n]*backdrop-blur/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});

describe('แผงเมนูหลักเป็นกระจก (เจ้าของ 19 ต.ค. 2569 "เนี่ยเอาเนี่ยเป็น Glass")', () => {
  it('ui/sheet มี surface frosted (ม่านเบลอให้ ตัวแผงไม่เบลอเอง) · ลิ้นชักเมนูใช้', () => {
    const sheet = read('src/components/ui/sheet.tsx');
    expect(sheet).toContain('frosted:');
    expect(sheet).toContain('surface === "glass" || surface === "frosted" ? SHEET_OVERLAY_GLASS');
    expect(read('src/components/layout/AppNavDrawer.tsx')).toContain('surface="frosted"');
  });
});

describe('รอบ 2: กระจกทั้งระบบ + หน้าไม่กระโดด (เจ้าของ 19 ต.ค. 2569)', () => {
  it('แถบแท็บทุกจุดเป็นกระจก (Radix 7 จุด + แถบทำมือ 4 จุด)', () => {
    for (const f of [
      'src/components/follow/FollowPlanningCalendar.tsx',
      'src/components/home-ai-share/AiShareDetail.tsx',
      'src/components/recruit-rm/ApplicantContactDialog.tsx',
      'src/components/jobs/BoardPublishSheet.tsx',
      'src/pages/HomeAiSharePage.tsx',
      'src/pages/follow/FollowPage.tsx',
      'src/pages/settings/CallScriptsTab.tsx',
    ]) expect(read(f), f).toContain('<TabsList variant="glass"');
    for (const f of [
      'src/components/jobs/UnitRequestTabs.tsx',
      'src/components/jobs/UnitSectionTabs.tsx',
      'src/components/jobs/JobBoardView.tsx',
      'src/components/recruit-rm/RmWorkspace.tsx',
    ]) expect(read(f), f).toContain('glassTabClass(');
  });
  it('หัวหน้าเว้นบรรทัดย่อยเมื่อส่ง subtitle="" · แท็บใบขอไม่มีขอบบนเกิน', () => {
    expect(read('src/components/shared/PageHeader.tsx')).toContain('subtitle !== undefined ?');
    expect(read('src/pages/jobs/UnitRequestTabPage.tsx')).toContain('className="space-y-4 px-4 pb-4 md:px-6"');
  });
});
