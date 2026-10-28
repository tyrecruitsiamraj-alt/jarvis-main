import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { readImportRows } from '../../api/_lib/importDocRows';
import { IMPORT_COLUMNS, mapImportHeader, planImportRows } from '../../src/lib/applicantImport';

// เจ้าของ 28 ต.ค. 2569 "นำเข้าเป็น jpg jpeg pdf word ด้วยได้ไหม" → Choice "Word + PDF ตามแบบฟอร์ม" (อ่านเองในเครื่อง ไม่ใช้ AI)
const isHeader = (c: string[]) => mapImportHeader(c).missing.length === 0;
const HEADERS = IMPORT_COLUMNS.map((c) => c.header);
const read = (f: string) => readImportRows(readFileSync(`tests/fixtures/import/${f}`), isHeader, 'x', HEADERS);
const plan = (rows: unknown[][], raw: unknown[][]) => {
  const [h, ...data] = rows;
  return planImportRows(data, mapImportHeader(h ?? []).index, {} as never, raw.slice(1));
};

describe('นำเข้าผู้สมัครจาก Word / PDF', () => {
  it('Word: ตารางหัวตามแบบฟอร์ม → แถวครบ · คำที่ Word แตกเป็นหลายชิ้นต่อกลับ', async () => {
    const r = await read('applicants-word.docx');
    expect(r.kind).toBe('word');
    expect(r.rows[1]).toEqual(['สมชาย', 'ทดสอบนำเข้า', '0899990001', '30', 'ชาย', 'กรุงเทพมหานคร']);
    expect(plan(r.rows, r.raw).filter((p) => p.ok)).toHaveLength(3);
  });

  it('PDF ภาษาไทย (Chrome พิมพ์จากตาราง): ต่อคำที่แตก · ข้อมูลชิดซ้ายเข้าช่องถูก', async () => {
    const r = await read('applicants-short.pdf');
    expect(r.kind).toBe('pdf');
    expect(r.rows.slice(1)).toEqual([
      ['สมชาย', 'ทดสอบนำเข้า', '0899990001', '30', 'ชาย', 'กรุงเทพมหานคร'],
      ['สมหญิง', 'ทดสอบนำเข้า', '0899990002', '25 ปี', 'หญิง', 'นนทบุรี'],
      ['สมศักดิ์', 'ทดสอบนำเข้า', '0899990003', '', 'ชาย', 'ชลบุรี'],
    ]);
  });

  it('PDF ครบ 11 คอลัมน์ 10 คน · ช่องที่ว่างบางแถว (LINE ID · ใบขับขี่) ไม่ทำให้ช่องอื่นเลื่อน', async () => {
    const r = await read('applicants-full.pdf');
    expect(r.rows[0]).toHaveLength(11);
    expect(r.rows).toHaveLength(11);
    expect(r.rows[1]).toEqual(['สมชาย', 'ใจดี', '0800123450', '', 'ชาย', 'line_0', 'กรุงเทพมหานคร', 'บางกะปิ', 'ขับรถ', 'ม.ปลาย/ปวช.', 'ใบขับขี่บุคคล 5 ปี']);
    expect(plan(r.rows, r.raw).filter((p) => p.ok)).toHaveLength(10);
  });

  it('Excel ยังอ่านแบบเดิม', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['ชื่อ', 'นามสกุล', 'เบอร์โทร', 'เพศ'], ['ก', 'ข', '0899990009', 'ชาย']]), 'x');
    const r = await readImportRows(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), isHeader, 'x', HEADERS);
    expect(r.kind).toBe('excel');
    expect(r.rows[1]).toEqual(['ก', 'ข', '0899990009', 'ชาย']);
  });
});
