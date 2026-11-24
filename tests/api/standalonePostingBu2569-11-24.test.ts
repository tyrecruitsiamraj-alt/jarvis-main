import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePostingInput } from '../../src/lib/recruitPostings';

/**
 * BU ของกล่องลอย (เจ้าของ 24 พ.ย. 2569) — เดิมกล่องใหม่ได้ LBD ให้เอง ⇒ "รับสมัครพนักงานสวน" ผู้สมัคร 8 คนไปอยู่ LBD ทีม LM มองไม่เห็น
 * ตอนนี้: ป๊อปสร้างลิงก์ต้องเลือก BU · ป๊อปแก้ไขประกาศลอยย้าย BU ได้ ผู้สมัครย้ายตาม
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('สร้างประกาศลอยต้องมี BU จริง', () => {
  const base = { jobId: null, standaloneKind: 'central', title: 'รับสมัครพนักงานสวน' };
  it('ว่าง / รหัสที่ไม่มีจริง = ไม่ผ่าน · BU จริง = ผ่าน', () => {
    expect(validatePostingInput({ ...base, departmentCode: '' })).toBe('ประกาศที่ไม่ผูกใบขอ ต้องเลือก BU');
    expect(validatePostingInput({ ...base, departmentCode: 'XX' })).toBe('ประกาศที่ไม่ผูกใบขอ ต้องเลือก BU');
    expect(validatePostingInput({ ...base, departmentCode: 'LM' })).toBeNull();
  });
  it('ประกาศผูกใบขอไม่ต้องเลือก BU (ตามใบขอ)', () => {
    expect(validatePostingInput({ jobId: 'siamraj-sql:LMO6911008', title: 'คนสวน', departmentCode: null })).toBeNull();
  });
});

describe('หน้าเว็บไม่ใส่ BU ให้เอง', () => {
  it('กล่องที่ยังไม่มีประกาศ = ว่าง ให้เลือกในป๊อป (ไม่มี LBD ตั้งต้นแล้ว)', () => {
    const board = read('src/components/jobs/JobBoardView.tsx');
    expect(board).toContain("departmentCode: s.bus[0] ?? '',");
    expect(board).not.toContain('BOARD_DEFAULT_BU');
  });
  it('ป๊อปสร้างลิงก์มีช่อง BU · ยังไม่เลือก = Gen link ไม่ได้', () => {
    const d = read('src/components/jobs/GenApplyLinkDialog.tsx');
    expect(d).toContain('data-testid="genlink-bu"');
    expect(d).toContain('disabled={saving || !title.trim() || missingGroup || missingBu}');
    expect(d).toContain('เลือก BU ก่อน Gen link');
  });
});

describe('ย้าย BU ของประกาศลอย', () => {
  it('server: เฉพาะประกาศลอย · ต้องมีสิทธิ์ BU ปลายทาง · จด audit', () => {
    const h = read('api/_handlers/recruit-postings.ts');
    expect(h).toContain("if ('departmentCode' in body) {");
    expect(h).toContain("scope.codes.includes(toBu)");
    expect(h).toContain("action: 'recruit_posting.move_bu'");
    const lib = read('api/_lib/recruitPostings.ts');
    expect(lib).toContain('export async function moveStandalonePostingBu(');
    expect(lib).toContain("if (p.job_id) throw new Error('ประกาศที่ผูกใบขอ ใช้ BU ตามใบขอ ย้ายไม่ได้');");
    // ผู้สมัครย้ายตามเฉพาะคนที่ยังอยู่ BU เดิมของประกาศ
    expect(lib).toContain('AND a.department_code IS NOT DISTINCT FROM $3');
  });
  it('ปุ่ม "ย้าย BU" ต้องกดยืนยันอีกครั้ง · อยู่ในป๊อป "ทำอะไรไปแล้ว" ของการ์ดกล่องลอย (ทางเข้าที่กดได้จริง) + ป๊อปแก้ไขประกาศ', () => {
    const m = read('src/components/jobs/PostingBuMover.tsx');
    expect(m).toContain('data-testid="posting-bu-move"');
    expect(m).toContain('data-testid="posting-bu-confirm"');
    expect(m).toContain('if (posting.jobId) return null;');
    const a = read('src/components/jobs/JobPostActionsDialog.tsx');
    expect(a).toContain('<PostingBuMover posting={p}');
    expect(a).toContain("list.filter((p) => p.standaloneKind === standaloneKind)");
    expect(read('src/components/jobs/EditPostingDialog.tsx')).toContain('<PostingBuMover posting={posting}');
  });
});
