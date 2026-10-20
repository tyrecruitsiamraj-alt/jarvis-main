import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * หน้าจับคู่งานโฉมเดียวกับโพสต์ประกาศ (เจ้าของ 15 ต.ค. 2569: "ไม่สวยเลย ไม่เข้ากับอันอื่นๆเลย" · Choice "แบบโพสต์ประกาศ")
 */
const page = readFileSync('src/pages/matching/MatchingPage.tsx', 'utf8');
const panel = readFileSync('src/components/matching/AiCallFlowPanel.tsx', 'utf8');
const stats = readFileSync('src/components/matching/LumosPanels.tsx', 'utf8');

describe('หน้าจับคู่งาน = โฉมโพสต์ประกาศ', () => {
  it('แผงตัวเลข 16 กล่อง → แถวชิป 2 แถว (AI · เก็บไปโทรเอง) · ยังกดดูรายชื่อ/สลับต้นทางได้', () => {
    expect(panel).not.toContain('PageHeroStrip');
    expect(panel).toContain('data-testid={`ai-call-flow-${side}`}');
    expect(panel).toContain('onOpen={side === \'ai\' ? () => onOpenCell(c) : null}');
    expect(panel).toContain('aria-pressed={source === t.id}');
  });

  it('ชิปกรองใบขอ = ปุ่ม xs ทึบเมื่อเลือก (แบบชิปเลนโพสต์ประกาศ) · 4 ชิปเดิมครบ', () => {
    expect(page).toMatch(/size="xs"\s+variant=\{c\.active \? 'default' : 'outline'\}/);
    for (const label of ["'ทั้งหมด'", "'งานด่วน'", "'มีคนแนะนำ'", "'ไม่มีคนแนะนำ'"]) expect(page).toContain(`label: ${label}`);
  });

  it('การ์ดใบขอ = กริด 3 คอลัมน์ + Card · ชื่อ/ป้ายอายุชุดเดียวกับการ์ดโพสต์ประกาศ · ไม่มีแถบสีซ้าย', () => {
    expect(page).toContain("'grid gap-3 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3'");
    expect(page).toContain('jobBoardCardTitle(j)');
    expect(page).toContain('publicJobTitle(j)');
    expect(page).toContain('JOB_AGE_CHIP_META[age.level].chipCls');
    expect(page).not.toContain("'absolute inset-y-0 left-0 w-1.5'");
  });

  it('ตัดหนัก (15 ต.ค. 2569): แผง AI โทรพับเป็นปุ่ม · การ์ดปุ่มเดียว · ของที่ตัดย้ายไปป๊อปรายละเอียด', () => {
    expect(page).toContain('<AiCallFlowPanel defaultSource="all" open={aiFlowOpen} onTotal={setAiFlowTotal} />');
    expect(page).toContain('useState(false);\n  const [aiFlowTotal');
    expect(panel).toContain('if (!open) return null;');
    const grid = page.slice(page.indexOf('data-testid="matching-job-grid"'), page.indexOf('data-testid="matching-job-grid"') + 6000);
    expect(grid).not.toContain('<SelectionRecallButton');
    expect(grid).not.toContain('LumosJobSummaryStats');
    const moved = page.slice(page.indexOf('data-testid="matching-detail-moved"') - 2000);
    expect(moved).toContain('cardNextAction(mc, serverLumosSummary[jobDetail.id])');
    // 20 ต.ค. 2569: ชุดเดียวของหน้าต่าง — ใช้ชุดรายคนเมื่อชุดจากรายการใบขอตามไม่ทัน
    expect(moved).toContain('<LumosJobSummaryStats s={s} variant="inline" />');
    expect(moved).toContain('const server = serverLumosSummary[jobDetail.id];');
    expect(moved).toContain('<SelectionRecallButton jobId={jobDetail.id} />');
    expect(stats).toContain("if (variant === 'inline')");
  });
});
