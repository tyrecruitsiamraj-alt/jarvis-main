// @vitest-environment node
/**
 * ไฟล์ตัวอย่างนำเข้าผู้สมัครมี Dropdown ในไฟล์ (เจ้าของ 12 ต.ค. 2569: "อะไรที่ต้องเลือก ทำ Dropdown ในไฟล์ให้เขาเลือกเลยได้ไหม")
 * ล็อก: ไฟล์ยังอ่านได้แบบเดิม (หัวคอลัมน์ชุดเดิม) · มี dataValidations ครบช่องที่มีรายการ · รายการอยู่ชีตซ่อน · อำเภอตามจังหวัดในแถว
 */
import { describe, expect, it } from 'vitest';
import * as XLSXNS from 'xlsx';
import {
  buildImportTemplateBase64,
  dataValidationsXml,
  importListsSheet,
  importValidationRules,
  IMPORT_LISTS_SHEET_NAME,
} from '../../api/_lib/importTemplate';
import { IMPORT_SHEET_NAME, IMPORT_VALUES_SHEET_NAME, importTemplateHeaders, mapImportHeader } from '../../src/lib/applicantImport';
import { THAI_PROVINCE_NAMES_SORTED } from '../../src/lib/thaiProvinces';

type Cfb = { read: (d: Buffer, o: { type: 'buffer' }) => unknown; find: (z: unknown, p: string) => { content: Uint8Array } | null };
const X = ((XLSXNS as unknown as { default?: typeof XLSXNS }).default ?? XLSXNS) as typeof XLSXNS & { CFB: Cfb };

function sheetXml(b64: string, path: string): string {
  const zip = X.CFB.read(Buffer.from(b64, 'base64'), { type: 'buffer' });
  return Buffer.from(X.CFB.find(zip, path)!.content).toString('utf8');
}

describe('ไฟล์ตัวอย่างนำเข้า — Dropdown ในไฟล์', () => {
  const b64 = buildImportTemplateBase64(['พนักงานขับรถ', 'แม่บ้าน', 'แม่บ้าน', ' ']);

  it('ยังอ่านได้แบบเดิม: ชีตผู้สมัคร + หัวคอลัมน์ชุดเดิม · ชีตรายการถูกซ่อน', () => {
    const wb = X.read(Buffer.from(b64, 'base64'), { type: 'buffer' });
    expect(wb.SheetNames).toEqual([IMPORT_SHEET_NAME, IMPORT_VALUES_SHEET_NAME, IMPORT_LISTS_SHEET_NAME]);
    expect(wb.Workbook?.Sheets?.map((s) => s.Hidden ?? 0)).toEqual([0, 0, 1]);
    const header = X.utils.sheet_to_json<unknown[]>(wb.Sheets[IMPORT_SHEET_NAME], { header: 1 })[0];
    expect(header).toEqual(importTemplateHeaders());
    expect(mapImportHeader(header).missing).toEqual([]);
  });

  it('🔴 Dropdown ครบ 7 ช่อง · ต้องเลือกจากรายการ = เพศ/จังหวัด/ประเภทเจาะจง/วุฒิ · เตือนแต่ให้ผ่าน = อำเภอ/ตำแหน่ง/ใบขับขี่', () => {
    const xml = sheetXml(b64, '/xl/worksheets/sheet1.xml');
    expect(xml).toMatch(/<\/sheetData><dataValidations count="7">/);
    const v = [...xml.matchAll(/<dataValidation [^>]*sqref="([A-Z]+)2:[A-Z]+501"/g)].map((m) => [m[1], /errorStyle="warning"/.test(m[0])]);
    expect(Object.fromEntries(v)).toEqual({ E: false, G: false, H: true, J: false, K: false, L: true, I: true });
  });

  it('อำเภอ = เฉพาะของจังหวัดในแถวเดียวกัน (OFFSET + MATCH + COUNTIF บนตารางเรียงตามจังหวัด)', () => {
    const lists = importListsSheet([]);
    const district = importValidationRules(lists).find((r) => r.key === 'district')!;
    expect(district.formula).toBe(
      `OFFSET('รายการ'!$D$1,MATCH($G2,'รายการ'!$C$2:$C$${lists.districtRows + 1},0),0,COUNTIF('รายการ'!$C$2:$C$${lists.districtRows + 1},$G2),1)`,
    );
    // ตารางจังหวัด/อำเภอเรียงตามจังหวัด (สูตรตัดช่วงต่อกันได้)
    const provCol = lists.rows.slice(1).map((r) => r[2]).filter(Boolean);
    const firstIdx = new Map<string, number>();
    provCol.forEach((p, i) => (firstIdx.has(p) ? null : firstIdx.set(p, i)));
    for (const [p, i] of firstIdx) expect(provCol.slice(i, i + provCol.filter((x) => x === p).length).every((x) => x === p)).toBe(true);
    expect(lists.provinces).toBe(THAI_PROVINCE_NAMES_SORTED.length);
  });

  it('ตำแหน่ง: ตัดซ้ำ/ช่องว่าง · ไม่มีรายชื่อ = ไม่มี Dropdown ตำแหน่ง', () => {
    expect(importListsSheet(['ก', 'ก', ' ', 'ข']).titles).toBe(2);
    expect(importValidationRules(importListsSheet([])).some((r) => r.key === 'position_interest')).toBe(false);
  });

  it('ข้อความใน XML ถูก escape', () => {
    expect(dataValidationsXml([{ key: 'gender', formula: 'A<B&C', strict: true, prompt: '"x"' }])).toContain('<formula1>A&lt;B&amp;C</formula1>');
  });
});
