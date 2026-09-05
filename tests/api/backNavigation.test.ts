// @vitest-environment node
/**
 * ═══ ปุ่มย้อนกลับต้องพาไปที่ที่คนคาดหวัง ═══
 *
 * เจ้าของสั่งทดสอบเอง 5 ก.ย. 2569: *"เวลาทำอะไรไป แล้วจะย้อนกลับไปหน้าเดิมมันกลับไหม
 * ไม่ใช่ย้อนแล้วไปไหนไม่รู้ งงแน่"* — ทดสอบบนจอจริงแล้วพัง **2 เคส**:
 *
 * 1. อยู่กล่องงาน → กดแท็บ "รายชื่อผู้สมัคร" → กดย้อนกลับ → **เด้งไปหน้าแรก**
 *    (ควรกลับไปแท็บ "กล่องงาน") · เหตุ: สลับแท็บใช้ `replace: true` ประวัติเลยถูกทับ
 * 2. หน้าสาธารณะ `/apply` → เปิดฟอร์มสมัคร → กดย้อนกลับ → **หลุดออกจากหน้าไปเลย
 *    และของที่กรอกค้างหายหมด** (บนมือถือคนปัดย้อนกลับแทนปุ่มปิดตลอด)
 */
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

/** ไฟล์ใน src/ ที่มีข้อความนี้ (รวมในคอมเมนต์ — ตัวเรียกต้องกรองด้วย `codeOf` เอง) */
const filesMentioning = (needle: string): string[] =>
  execSync(`grep -rlF ${JSON.stringify(needle)} src --include='*.tsx' --include='*.ts' || true`, {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);

/** ตัดคอมเมนต์ออกก่อน — ไฟล์พวกนี้อธิบายของที่ "เลิกใช้แล้ว" ไว้ในคอมเมนต์ */
const codeOf = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');

describe('สลับแท็บ/ตัวกรอง = คนกดเอง ⇒ ต้อง push ไม่ใช่ replace', () => {
  const CASES: Array<[string, RegExp]> = [
    ['กล่องงาน — สลับแท็บ', /params\.delete\('tab'\);\s*setSearchParams\(params\);/],
    ['RmWorkspace — สลับแท็บ', /params\.set\('tab', next\);\s*setSearchParams\(params\);/],
    ['RmWorkspace — สลับมุมมอง Lead', /next\.delete\('lead'\);\s*setSearchParams\(next\);/],
    ['RmWorkspace — สลับรายการ', /params\.set\('list', next\);\s*setSearchParams\(params\);/],
    ['แผงคุมสรรหา — เลือกถัง', /params\.set\('bucket', bucket\);\s*setSearchParams\(params\);/],
  ];
  const FILES: Record<string, string> = {
    'กล่องงาน — สลับแท็บ': 'src/pages/jobs/StaffJobBoardPage.tsx',
    'RmWorkspace — สลับแท็บ': 'src/components/recruit-rm/RmWorkspace.tsx',
    'RmWorkspace — สลับมุมมอง Lead': 'src/components/recruit-rm/RmWorkspace.tsx',
    'RmWorkspace — สลับรายการ': 'src/components/recruit-rm/RmWorkspace.tsx',
    'แผงคุมสรรหา — เลือกถัง': 'src/components/recruit-rm/RecruitControlPanel.tsx',
  };

  for (const [label, re] of CASES) {
    it(`🔴 ${label}`, () => {
      expect(re.test(codeOf(FILES[label])), `${label} ยังใช้ replace อยู่`).toBe(true);
    });
  }
});

describe('ป๊อปอัปของหน้าสาธารณะ — ย้อนกลับ = ปิดฟอร์ม ไม่ใช่ออกจากหน้า', () => {
  /**
   * 🔴 แก้ 5 ก.ย. 2569 (Wave 3.2): ฟอร์มนี้ **ไม่เรียก `useCloseOnBack` เองแล้ว** —
   * ย้ายไปผูกที่ `<Dialog>` ของ shadcn ที่เดียวทั้งระบบ (เรียกซ้ำ = ซ้อนกันเปล่า ๆ)
   * สิ่งที่ต้องคุมไว้จึงเป็น "ฟอร์มยังคุมสถานะเปิด-ปิดจากข้างนอกอยู่" ซึ่งเป็นเงื่อนไข
   * ที่ทำให้ตัวห่อกลางทำงานให้ · พฤติกรรมจริงคุมด้วยชุดเทสต์ตัวห่อกลางข้างล่าง
   */
  it('ฟอร์มสมัครงานยังคุมสถานะเปิด-ปิดจากข้างนอก (ตัวห่อกลางจึงผูกย้อนกลับให้ได้)', () => {
    const dlg = codeOf('src/components/jobs/PublicApplyDialog.tsx');
    expect(dlg).toMatch(/<Dialog open=\{open\} onOpenChange=\{\(o\) => !o && onClose\(\)\}>/);
    expect(dlg, 'เรียก useCloseOnBack เองซ้ำกับตัวห่อกลาง').not.toContain('useCloseOnBack');
  });

  it('ตัวช่วยเก็บประวัติคืนเมื่อปิดด้วยวิธีอื่น (ประวัติไม่บวม)', () => {
    const hook = read('src/hooks/useCloseOnBack.ts');
    expect(hook).toContain('pushState');
    expect(hook).toContain("addEventListener('popstate'");
    expect(hook).toMatch(/history\.back\(\)/);
  });
});

/**
 * ═══ Wave 3.2 — ป๊อปอัปทั้งระบบผูกปุ่มย้อนกลับ (5 ก.ย. 2569) ═══
 *
 * ผูกไว้ **ที่เดียว** ที่ตัวห่อของ shadcn แทนการไล่ใส่ทีละจอ 40 กว่าจุด
 * ⇒ ป๊อปอัปใหม่ที่ใครเขียนต่อจากนี้ได้ฟรีทันที ไม่มีทางลืม
 * เทสต์ชุดนี้กันคนถอดสายนี้ออกโดยไม่ตั้งใจ (เช่นตอน `npx shadcn add dialog` ทับไฟล์)
 */
describe('ป๊อปอัปทั้งระบบ — ย้อนกลับ = ปิดป๊อปอัป (ผูกที่ตัวห่อกลาง)', () => {
  const ROOTS: Array<[string, string]> = [
    ['Dialog', 'src/components/ui/dialog.tsx'],
    ['AlertDialog', 'src/components/ui/alert-dialog.tsx'],
    ['Sheet', 'src/components/ui/sheet.tsx'],
  ];

  for (const [label, file] of ROOTS) {
    it(`🔴 <${label}> ผูก useCloseOnBack ไว้ที่ตัวห่อ`, () => {
      const src = codeOf(file);
      expect(src, `${file} ไม่ได้ import useCloseOnBack`).toContain('useCloseOnBack');
      // สั่งปิดผ่าน onOpenChange ⇒ เงื่อนไขห้ามปิดของแต่ละจอยังทำงานเหมือนเดิม
      expect(src).toMatch(/useCloseOnBack\(.*onOpenChange\?\.\(false\)/);
      // ต้องมีทางปิดความสามารถนี้ไว้ให้ป๊อปอัปที่ผูกกับ URL
      expect(src, `${file} ไม่มี prop backClose ให้ opt-out`).toContain('backClose');
    });
  }

  it('ตัวจัดการประวัติใช้ป้ายเดียวทั้งระบบ (ป๊อปอัปซ้อนกันแล้วประวัติไม่บวม)', () => {
    const hook = read('src/hooks/useCloseOnBack.ts');
    expect(hook).toContain('pushState');
    expect(hook).toContain("addEventListener('popstate'");
    expect(hook).toMatch(/history\.back\(\)/);
    // กองป๊อปอัประดับโมดูล = ปักป้ายชั้นเดียว ปิดทีละชั้นจากบนลงล่าง
    expect(hook).toMatch(/const stack: Layer\[\] = \[\]/);
    // 🔴 ต้องคัดลอก state เดิมของ router มาด้วย ไม่งั้นตัวนับ idx หลุดหลังเปลี่ยนหน้าจากในป๊อปอัป
    expect(hook).toMatch(/pushState\(\{ \.\.\.current, \[MARK\]: true \}/);
  });

  it('🔴 ห้ามมีจอไหนเรียก useCloseOnBack เองอีก (ซ้อนกับตัวห่อกลาง)', () => {
    const hits = filesMentioning('useCloseOnBack')
      .filter((f) => !f.startsWith('src/hooks/'))
      .filter((f) => !f.startsWith('src/components/ui/'))
      // ⚠️ ดูจาก **โค้ดจริง** ไม่ใช่คอมเมนต์ที่อธิบายว่าเลิกใช้แล้ว
      .filter((f) => codeOf(f).includes('useCloseOnBack'))
      // ตัวที่เปลี่ยนหน้าจากในป๊อปอัป ใช้ helper คนละตัว (consumeBackMarkerForNavigation)
      .filter((f) => !codeOf(f).includes('consumeBackMarkerForNavigation'));
    expect(hits, `ไฟล์พวกนี้เรียก useCloseOnBack เอง ซึ่งซ้อนกับตัวห่อกลาง: ${hits.join(', ')}`).toEqual([]);
  });

  it('เปลี่ยนหน้าจากในลิ้นชัก ☰ ต้อง navigate แบบ replace (ไม่งั้นย้อนกลับครั้งที่สองไม่ไปไหน)', () => {
    const drawer = codeOf('src/components/layout/AppNavDrawer.tsx');
    expect(drawer).toMatch(/navigate\(resolveDockNavTarget\(path\), \{ replace: consumeBackMarkerForNavigation\(\) \}\)/);
  });
});

/**
 * ═══ Wave 3.3 — เปิด/ปิดรายละเอียดใบขอ (`?jobId=`) กับประวัติ ═══
 *
 * 🔴 เดิมเปิดแผงโดย **ไม่แตะ URL เลย** ⇒ กดย้อนกลับแล้วหลุดออกจากหน้าทั้งหน้า
 * ตอนนี้เปิด = push `?jobId=` · ย้อนกลับ = ปิดแผงกลับลิสต์เดิม
 */
describe('รายละเอียดใบขอที่ผูกกับ ?jobId= — สองหน้าต้องเหมือนกันเป๊ะ', () => {
  const PAGES: Array<[string, string]> = [
    ['จับคู่งาน', 'src/pages/matching/MatchingPage.tsx'],
    ['ตรวจก่อนส่ง', 'src/pages/matching/PreCheckPage.tsx'],
  ];

  for (const [label, file] of PAGES) {
    it(`🔴 ${label} — ใช้ helper กลางตัวเดียวกัน ห้ามเขียนพฤติกรรมของตัวเอง`, () => {
      const src = codeOf(file);
      expect(src).toContain('useUrlDialogHistory');
      expect(src).toMatch(/jobUrlHistory\.openWithUrl\(/);
      expect(src).toMatch(/jobUrlHistory\.closeAndSyncUrl\(\)/);
      // ห้ามเหลือ replace-delete ที่เขียนเองในหน้า (พฤติกรรมย้ายไปอยู่ที่ helper แล้ว)
      expect(src).not.toMatch(/next\.delete\('jobId'\)/);
      // แผงนี้ผูกกับ URL แล้ว ⇒ ต้องปิดตัวห่อกลางไม่ให้ปักประวัติซ้ำ
      expect(src).toMatch(/<Sheet backClose=\{false\}/);
    });
  }

  it('helper: เปิด = push · ปิดโดยเราเป็นคน push = ถอยประวัติ · เข้าด้วยลิงก์ตรง = replace-delete', () => {
    const hook = read('src/hooks/useUrlDialogHistory.ts');
    // เปิด = push (setSearchParams ที่ **ไม่มี** replace)
    expect(hook).toMatch(/pendingOpenRef\.current = value;\s*\n[^\n]*\n\s*setSearchParams\(next\);/);
    expect(hook).toMatch(/window\.history\.back\(\);/);
    expect(hook).toMatch(/setSearchParams\(next, \{ replace: true \}\);/);
    // 🔴 ปิดแผงเฉพาะตอนค่า "เคยมีแล้วหายไป" — กันแผงปิดตัวเองทันทีที่เปิด
    expect(hook).toMatch(/if \(isOpen && prev && !pendingOpenRef\.current\) closeRef\.current\(\);/);
  });

  it('🔴 backClose={false} ใช้ได้เฉพาะจอที่จัดการประวัติเองด้วย useUrlDialogHistory', () => {
    const hits = filesMentioning('backClose={false}')
      // ตัวห่อกลางเองพูดถึง prop นี้ในคอมเมนต์อธิบายวิธีใช้ ไม่ใช่จุดที่ opt-out
      .filter((f) => !f.startsWith('src/components/ui/'))
      .filter((f) => codeOf(f).includes('backClose={false}'));
    expect(hits.length, 'ไม่มีจอไหน opt-out เลย = สายผูกน่าจะหลุด').toBeGreaterThan(0);
    for (const f of hits) {
      expect(codeOf(f), `${f} ปิดปุ่มย้อนกลับทิ้งโดยไม่จัดการประวัติเอง`).toContain('useUrlDialogHistory');
    }
  });
});
