// @vitest-environment node
/**
 * ติ๊กตัวกรองแล้วปุ่มห้ามเลื่อน (เจ้าของ 11 พ.ย. 2569 "ปุ่มมันขยับ … เม้าต้องขยับตามเพื่อกดอีกรอบ ไม่เอาแบบนี้")
 * วัดบนจอก่อนแก้: ติ๊กแรก ตัวเลือกเลื่อนลง 7px (ป้ายเลขบนหัวข้อสูง 24.5 > ตัวหนังสือ 18) + บรรทัด "เหลือ N รายชื่อ" โผล่ดันลงอีกบรรทัด
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getVisiblePageNumbers } from '@/lib/pagination';

const panel = readFileSync('src/components/jobs/BoardFilterPanel.tsx', 'utf8');

describe('แถบตัวกรองไม่เลื่อนตอนติ๊ก', () => {
  it('หัวข้อจองความสูงเท่าป้ายเลข', () => {
    expect(panel.match(/<span className="flex min-h-6 items-center gap-2">/g)).toHaveLength(2);
  });
  it('บรรทัดผลลัพธ์จองที่ไว้เสมอ ยังไม่ติ๊ก = ซ่อนตัวหนังสือ ไม่ถอดบรรทัด', () => {
    expect(panel).toContain("selected === 0 && 'invisible'");
    expect(panel).not.toContain('{selected > 0 && resultText ?');
  });
});

/**
 * ไล่กดทุกหน้าผ่าน UI (Playwright · บล็อกคำขอเขียนทั้งหมด) 11 พ.ย. 2569 — วัดปุ่มที่กดก่อน/หลัง แล้วแก้ทีละต้นเหตุ
 */
const read = (p: string) => readFileSync(p, 'utf8');

describe('ทั้งระบบ: กดแล้วปุ่มอยู่ที่เดิม', () => {
  it('ปุ่มหลักไม่ลอยตอนชี้ · ปุ่มเต็ม/ปุ่มขอบกว้างเท่ากัน (ชิปที่เลือกไม่ดันชิปข้าง ๆ)', () => {
    const btn = read('src/components/ui/button.tsx');
    expect(btn).toContain('"border border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",');
    expect(btn).not.toContain('hover:-translate-y');
    for (const f of ['src/components/home-overview/OverviewParts.tsx', 'src/components/shared/StatCard.tsx', 'src/components/home-ai-share/HomeKpis.tsx']) {
      expect(read(f), f).not.toContain('hover:-translate-y');
    }
  });
  it('เลขหน้า 7 ช่องเสมอเมื่อหน้าเยอะ — แถบชิดขวาไม่เลื่อน', () => {
    for (const p of [1, 2, 3, 4, 5, 9, 14, 15, 16, 17, 18]) expect(getVisiblePageNumbers(p, 18), `หน้า ${p}`).toHaveLength(7);
    expect(getVisiblePageNumbers(2, 18)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 18]);
    expect(getVisiblePageNumbers(9, 18)).toEqual([1, 'ellipsis', 8, 9, 10, 'ellipsis', 18]);
    expect(getVisiblePageNumbers(17, 18)).toEqual([1, 'ellipsis', 14, 15, 16, 17, 18]);
    expect(getVisiblePageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('หน้างานสรรหา: แท็บแรกกว้างเท่าชื่อยาวสุด · ไม่มีแถบขั้นงานดันแท็บลง', () => {
    expect(read('src/components/jobs/JobBoardView.tsx')).toContain("className={cn('col-start-1 row-start-1', p.id !== (picked ?? POSTING_PICKS[0]).id && 'invisible')}");
    expect(read('src/components/layout/StageBanner.tsx')).toContain("if (!step || pathname === '/jobs/board') return null;");
  });
  it('ตัวกรอง: ปุ่มพับอยู่จุดเดียวกับปุ่มกาง', () => {
    expect(panel).toContain("'relative m-3 hidden shrink-0 self-start sm:inline-flex'");
    expect(panel.indexOf('aria-label="พับตัวกรอง"')).toBeLessThan(panel.indexOf('>ตัวกรองเพิ่มเติม</p>'));
  });
  it('รายการใบขอ: ลูกศรเรียงสองตัวเสมอ · ล็อกความกว้างคอลัมน์', () => {
    const page = read('src/pages/jobs/JobListPage.tsx');
    expect(page).not.toContain('▲▼');
    expect(page).toContain('const lockedCols = useLockedColumnWidths(paginated.length > 0);');
  });
  it('ตั้งค่า: เมนูซ้ายสูงไม่ชนขอบ + กดหัวข้อแล้วเลื่อนจอคืนจุดเดิม · ย้ายลำดับเมนูแล้วปุ่มอยู่ใต้เมาส์', () => {
    const s = read('src/pages/settings/AdminSettings.tsx');
    expect(s).toContain('lg:sticky lg:top-4 lg:max-h-[88vh] lg:self-start lg:overflow-y-auto');
    expect(s).toContain('if (window.scrollY > target) window.scrollTo({ top: target });');
    expect(read('src/pages/settings/NavMenuTab.tsx')).toContain('window.scrollBy(0, el.getBoundingClientRect().top - k.top);');
  });
  it('รายชื่อรอลงงาน: เลือกเดือนอื่นแล้วเดือนที่กางอยู่ไม่หุบ', () => {
    expect(read('src/pages/matching/ErpBoardPage.tsx')).toContain('if (selectedMonthKey) setOpenMonths((x) => (selectedMonthKey in x ? x : { ...x, [selectedMonthKey]: true }));');
  });
});

describe('ป๊อปยึดขอบบน — สลับตัวเลือกแล้วป๊อปไม่เลื่อน (11 พ.ย. 2569)', () => {
  it('Dialog ไม่อยู่กลางจอ (กลางจอ + เนื้อหาเปลี่ยนสูง = ทั้งป๊อปเลื่อน)', () => {
    const d = read('src/components/ui/dialog.tsx');
    expect(d).toContain('fixed left-[50%] top-[5vh] z-50 grid max-h-[90vh] w-full max-w-lg translate-x-[-50%] gap-4 overflow-y-auto');
    expect(d).not.toContain('translate-y-[-50%]');
  });
});
