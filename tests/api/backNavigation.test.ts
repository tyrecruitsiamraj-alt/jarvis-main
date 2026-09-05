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
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

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
  it('ฟอร์มสมัครงานผูกกับปุ่มย้อนกลับแล้ว', () => {
    const dlg = read('src/components/jobs/PublicApplyDialog.tsx');
    expect(dlg).toContain('useCloseOnBack');
    expect(dlg).toMatch(/useCloseOnBack\(open, onClose\)/);
  });

  it('ตัวช่วยเก็บประวัติคืนเมื่อปิดด้วยวิธีอื่น (ประวัติไม่บวม)', () => {
    const hook = read('src/hooks/useCloseOnBack.ts');
    expect(hook).toContain('pushState');
    expect(hook).toContain("addEventListener('popstate'");
    expect(hook).toMatch(/history\.back\(\)/);
  });
});
