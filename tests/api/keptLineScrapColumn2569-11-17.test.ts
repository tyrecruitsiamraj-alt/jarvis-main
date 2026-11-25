// @vitest-environment node
/**
 * เจ้าของ 17 พ.ย. 2569 (รูปตารางใบขอ LBM6903002):
 *   "เพิ่ม Scrap มาด้วย" → คอลัมน์ Scrap ต่อจากคนกรอก กดเลขไปแท็บผู้สมัคร ▾ Scrap เลือกใบนั้นไว้
 *   "จะรู้ได้ไงว่าเขาเก็บไปโทรหรือยังไม่เก็บ" → แท็บผู้สมัครทุกแถวมีบรรทัดใต้ชื่อ
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rmKeptLine } from '../../src/lib/recruitRm';
import { JOB_LIST_TABLE_COLUMNS, JOB_LIST_TABLE_COLUMN_LABEL, compareJobsByTableColumn } from '../../src/lib/jobListTableSort';
import { boardScrapPathOfRequest } from '../../src/lib/scrapCandidatesApi';
import type { JobRequest } from '../../src/types';

const base = { claimed: false, claimed_by_me: false, claimed_by_name: undefined, is_lead: false, lead_by_me: false, lead_by_name: undefined };

describe('เก็บไปโทรแล้วหรือยัง (บรรทัดใต้ชื่อ)', () => {
  it('ยังไม่มีคนเก็บก็บอก — ไม่ปล่อยว่าง', () => {
    expect(rmKeptLine(base)).toEqual({ kept: false, text: 'ยังไม่มีคนเก็บ' });
  });
  it('ถือสายอยู่ (hold) มาก่อน · ของฉันเขียน ฉัน', () => {
    expect(rmKeptLine(base, { heldByName: 'ต้น', mine: false }).text).toBe('เก็บไปโทรแล้ว · ต้น');
    expect(rmKeptLine(base, { heldByName: 'ต้น', mine: true }).text).toBe('เก็บไปโทรแล้ว · ฉัน');
    expect(rmKeptLine({ ...base, claimed: true, claimed_by_name: 'แบงค์' }).text).toBe('เก็บไปโทรแล้ว · แบงค์');
    // ลิสต์ปกติไม่ส่งชื่อคนเก็บของคนอื่น (13 ส.ค. 2569) — ไม่เดาชื่อ
    expect(rmKeptLine({ ...base, claimed: true })).toEqual({ kept: true, text: 'มีคนเก็บไปโทรแล้ว' });
  });
  it('อยู่ในการติดต่อ (Lead) บอกของใคร', () => {
    expect(rmKeptLine({ ...base, is_lead: true, lead_by_name: 'ฝ้าย' })).toEqual({ kept: true, text: 'อยู่ในการติดต่อ · ฝ้าย' });
  });
  it('ตารางแท็บผู้สมัครใช้บรรทัดนี้ทุกแถว', () => {
    expect(readFileSync('src/components/recruit-rm/RmTable.tsx', 'utf8')).toContain('rmKeptLine(r, holdByRef[r.id])');
  });
});

describe('คอลัมน์ Scrap ในตารางใบขอ', () => {
  it('ต่อจากคนกรอก · ชื่อ โทร/Scrap (19 พ.ย. 2569 "โทรเท่าไหร่/จำนวน Scrap")', () => {
    const i = JOB_LIST_TABLE_COLUMNS.indexOf('applicants');
    expect(JOB_LIST_TABLE_COLUMNS[i + 1]).toBe('scrap');
    expect(JOB_LIST_TABLE_COLUMN_LABEL.scrap).toBe('โทร/Scrap');
  });
  it('เรียงตามยอด Scrap · ยังไม่รู้ยอดตกท้าย', () => {
    const a = { id: 'siamraj-sql:A' } as JobRequest;
    const b = { id: 'siamraj-sql:B' } as JobRequest;
    const c = { id: 'siamraj-sql:C' } as JobRequest;
    const n: Record<string, number | null> = { 'siamraj-sql:A': 3, 'siamraj-sql:B': 40, 'siamraj-sql:C': null };
    const ctx = { scrapCount: (j: JobRequest) => n[j.id] };
    const sorted = [a, b, c].sort((x, y) => compareJobsByTableColumn(x, y, { column: 'scrap', dir: 'desc' }, undefined, ctx));
    expect(sorted.map((j) => j.id)).toEqual(['siamraj-sql:B', 'siamraj-sql:A', 'siamraj-sql:C']);
  });
  it('กดเลขไปแท็บผู้สมัคร ▾ Scrap เลือกใบนั้นไว้', () => {
    expect(boardScrapPathOfRequest('LBM6903002')).toBe('/jobs/board?view=scrap&scrap_req=LBM6903002');
    // 25 พ.ย. 2569 แท็บ Scrap ใช้ตารางผู้สมัคร — เลขใบขอแปลงเป็นตัวกรองใบขอ (`a.job=`) ชุดเดียวกับแท็บผู้สมัคร
    expect(readFileSync('src/pages/jobs/StaffJobBoardPage.tsx', 'utf8')).toContain('params.set(`${APPLICANT_FILTER_PARAM_PREFIX}job`, `siamraj-sql:${scrapReq.toUpperCase()}`)');
    expect(readFileSync('api/_handlers/scrap-candidates.ts', 'utf8')).toContain("one(req.query?.counts) === '1'");
  });
});
