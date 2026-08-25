// @vitest-environment node
/**
 * ปุ่มรวม "เก็บไปโทรเอง" (Phase 3 ข้อ ② · เจ้าของเคาะ 22 ส.ค. 2569)
 *
 * 🔴 บทเรียนที่ทำให้ต้องมีเทสต์ชุดนี้:
 * 1. **สองปุ่มที่ทำงานคนละครึ่ง** — "เก็บไปติดต่อ" (claim บนใบ) กับ "ดึงเข้าถังโทร"
 *    (ล็อกที่เบอร์) · กด claim อย่างเดียว **ไม่กัน AI โทรทับ** (ตัวที่กันคือ hold)
 *    → คนกดปุ่มเดียวแล้วคิดว่าปลอดภัย
 * 2. **ปุ่มคำเดียวกันแต่คนละพฤติกรรม = บั๊ก** (เจอจริง 23 ส.ค.) — คำว่า "ดึงเข้าถังโทร"
 *    ต้องหายไปจากป้ายปุ่มทั้งระบบ ไม่ใช่เหลือไว้ที่เดียวสองความหมาย
 * 3. ปุ่มที่ยิงสายจริงต้องมีขั้นยืนยัน — และหน้าที่อยู่ใน Dialog ห้ามใช้ Dialog ซ้อน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RM_ROW_ACTION_LABEL } from '../../src/lib/recruitRm.js';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/^\s*\/\/.*$/gm, '');

describe('ป้ายปุ่ม', () => {
  it('ปุ่มแถวใช้คำ "เก็บไปโทรเอง" (คำเดียวทั้งระบบ)', () => {
    expect(RM_ROW_ACTION_LABEL.call).toBe('เก็บไปโทรเอง');
  });

  it('คำเก่า "ดึงเข้าถังโทร" ไม่เหลือเป็นป้ายปุ่มบนจอ', () => {
    for (const f of [
      'src/lib/recruitRm.ts',
      'src/components/recruit-rm/RmSearchBar.tsx',
      'src/components/recruit-rm/RmTable.tsx',
    ]) {
      expect(stripComments(read(f))).not.toContain('ดึงเข้าถังโทร');
    }
  });

  it('คำเก่า "เก็บไปติดต่อ" ไม่เหลือเป็นป้ายปุ่มในกล่องงาน', () => {
    const code = stripComments(read('src/components/jobs/JobApplicantsDialog.tsx'));
    // ข้อความ error ของ client API ยังมีคำนี้ได้ (มาจาก lib) — ที่ห้ามคือป้ายบนปุ่ม
    expect(code).not.toMatch(/>\s*เก็บไปติดต่อ\s*</);
    expect(code).toContain('เก็บไปโทรเอง');
  });
});

describe('พฤติกรรมของปุ่มรวม', () => {
  it('ยิงเส้นเดียว /api/application-call-choice ไม่ใช่สองเส้นจากหน้าเว็บ', () => {
    const ws = stripComments(read('src/components/recruit-rm/RmWorkspace.tsx'));
    expect(ws).toContain('chooseApplicationCall');
    // หน้าเว็บต้องไม่จับล็อกเองอีกแล้ว (server ทำทั้งสองอย่างในคำสั่งเดียว)
    expect(ws).not.toContain('acquireCallHold');
  });

  it('server ทำทั้ง claim และ hold ในเส้นเดียว', () => {
    const h = read('api/_handlers/application-call-choice.ts');
    expect(h).toContain('acquireCallHold');
    expect(h).toMatch(/set claimed_by = \$2/);
    // ล็อกไม่ได้ต้องรายงาน ไม่ใช่เงียบ
    expect(h).toContain('AI อาจโทรทับได้');
  });

  it('ส่ง AI เข้าคิวผ่านคอขวดเดิมเท่านั้น', () => {
    const h = read('api/_handlers/application-call-choice.ts');
    expect(h).toContain('enqueueLumosInterviewForApplications');
    expect(h).not.toMatch(/insert\s+into\s+.*lumos_dispatch_queue/i);
  });

  it('เส้นนี้เช็ค BU scope ต่อใบ (กันเดา id ไปแตะใบแผนกอื่น)', () => {
    expect(read('api/_handlers/application-call-choice.ts')).toContain('isApplicationInWriteScope');
  });
});

describe('ขั้นยืนยันก่อนยิงสายจริง', () => {
  it('หน้ารายชื่อ (ไม่ได้อยู่ใน Dialog) ใช้ AlertDialog ของ shadcn', () => {
    const ws = read('src/components/recruit-rm/RmWorkspace.tsx');
    expect(ws).toContain('CallChoiceConfirmDialog');
    const dlg = read('src/components/recruit-rm/CallChoiceConfirmDialog.tsx');
    expect(dlg).toContain("from '@/components/ui/alert-dialog'");
    // ต้องโชว์รายชื่อ ไม่ใช่แค่จำนวน
    expect(dlg).toContain('names');
  });

  it('🔴 กอง AI ในกล่องงานยืนยันแบบบล็อกในหน้า — ห้าม Dialog ซ้อน Dialog', () => {
    const recall = read('src/components/jobs/JobRecallSuggestions.tsx');
    expect(recall).toContain('confirming');
    expect(recall).not.toContain('alert-dialog');
    expect(recall).not.toMatch(/from '@\/components\/ui\/dialog'/);
  });

  it('กอง AI ห้ามค้น/ส่งเองตอนเปิดแท็บ (ต้องกดปุ่ม) — บั๊กเดิม "เปิดแท็บ = โทร 20 คน"', () => {
    const recall = stripComments(read('src/components/jobs/JobRecallSuggestions.tsx'));
    expect(recall).not.toContain('useEffect');
    // ส่งได้เฉพาะหลังกดยืนยัน
    const sendFn = recall.slice(recall.indexOf('const send ='));
    expect(sendFn).toContain('send: true');
    expect(recall).toMatch(/onClick=\{\(\) => setConfirming\(true\)\}/);
  });

  it('ส่งเฉพาะคนที่ติ๊ก — server กรองจากผลที่ AI คิดมาเท่านั้น', () => {
    const handler = read('api/_handlers/matching-selection-recall.ts');
    expect(handler).toContain("getQuery(req, 'refs')");
    expect(handler).toContain('result.matches.filter');
  });
});
