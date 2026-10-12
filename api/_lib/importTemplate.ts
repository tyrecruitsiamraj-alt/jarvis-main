/**
 * ═══ ไฟล์ตัวอย่างนำเข้าผู้สมัคร — มี Dropdown ในไฟล์ให้เลือก (เจ้าของ 12 ต.ค. 2569) ═══
 * เจ้าของ: *"ตอนที่โหลดไฟล์ที่จะนำเข้า อะไรที่ต้องเลือก ทำ Dropdown ในไฟล์ให้เขาเลือกเลยได้ไหม"*
 *
 * ช่องที่มีรายการ = Dropdown (Data Validation ของ Excel) ชุดเดียวกับฟอร์ม "เพิ่มข้อมูลผู้สมัคร":
 *   เพศ · จังหวัด · อำเภอ/เขต (เฉพาะของจังหวัดที่เลือกในแถวนั้น) · ตำแหน่งงานที่สนใจ · ประเภทเจาะจง · วุฒิการศึกษา · ประเภทใบขับขี่
 *   - เพศ/จังหวัด/ประเภทเจาะจง/วุฒิ = ต้องเลือกจากรายการ (พิมพ์ค่าอื่น Excel ไม่รับ)
 *   - อำเภอ (ยังไม่เลือกจังหวัด) · ตำแหน่ง (พิมพ์ตำแหน่งใหม่ได้เหมือนฟอร์ม) · ใบขับขี่ (หลายใบคั่นด้วย ,) = เตือนแต่ให้ผ่าน
 * รายการอยู่ในชีตซ่อน "รายการ" · ชีต "ค่าที่ใช้ได้" คงไว้ให้ดู
 *
 * SheetJS รุ่นฟรีเขียน Data Validation ไม่ได้ ⇒ สร้างไฟล์ด้วย SheetJS แล้วแทรก `<dataValidations>` ลง XML ของชีต
 * ผ่านตัวจัดการ zip ที่มากับ SheetJS (`XLSX.CFB`) — ไม่เพิ่มไลบรารี
 * ⚠️ Google Sheets อ่าน Dropdown ที่อ้างสูตร (อำเภอ) ไม่ได้ทุกกรณี — ไฟล์ยังกรอกเองได้ ตัวตรวจตอนอัปโหลดเหมือนเดิม
 */
import * as XLSX from 'xlsx';
import {
  IMPORT_COLUMNS,
  IMPORT_MAX_ROWS,
  IMPORT_SHEET_NAME,
  IMPORT_VALUES_SHEET_NAME,
  importTemplateHeaders,
  importValuesSheet,
  type ImportColumnKey,
} from '../../src/lib/applicantImport.js';
import { THAI_PROVINCE_NAMES_SORTED } from '../../src/lib/thaiProvinces.js';
import { getDistrictOptionsForProvince } from '../../src/lib/thaiDistricts.js';

export const IMPORT_LISTS_SHEET_NAME = 'รายการ';

type Cfb = {
  read: (data: Buffer, opts: { type: 'buffer' }) => unknown;
  find: (zip: unknown, path: string) => { content: Uint8Array | Buffer } | null;
  write: (zip: unknown, opts: { fileType: 'zip'; type: 'buffer' }) => Buffer;
};
/** ตัวจัดการ zip ที่มากับ SheetJS — โหลดแบบ ESM อยู่ที่ `default.CFB` · แบบ CJS อยู่ที่ `CFB` */
const CFB: Cfb | undefined =
  (XLSX as unknown as { CFB?: Cfb }).CFB ?? (XLSX as unknown as { default?: { CFB?: Cfb } }).default?.CFB;

/** เลขคอลัมน์ (0 = A) → ตัวอักษร */
function colLetter(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const colOf = (key: ImportColumnKey): string => colLetter(IMPORT_COLUMNS.findIndex((c) => c.key === key));

const xmlEscape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Rule = { key: ImportColumnKey; formula: string; strict: boolean; prompt: string };

/** ชีตซ่อน "รายการ": A = จังหวัด · C/D = จังหวัด/อำเภอ (เรียงตามจังหวัด) · F = ตำแหน่ง */
export function importListsSheet(jobTitles: readonly string[]): { rows: string[][]; provinces: number; districtRows: number; titles: number } {
  const pairs: Array<[string, string]> = [];
  for (const p of THAI_PROVINCE_NAMES_SORTED) for (const d of getDistrictOptionsForProvince(p)) pairs.push([p, d]);
  const titles = [...new Set(jobTitles.map((t) => t.trim()).filter(Boolean))];
  const height = Math.max(THAI_PROVINCE_NAMES_SORTED.length, pairs.length, titles.length);
  const rows: string[][] = [['จังหวัด', '', 'จังหวัด', 'อำเภอ/เขต', '', 'ตำแหน่งงาน']];
  for (let i = 0; i < height; i += 1) {
    rows.push([THAI_PROVINCE_NAMES_SORTED[i] ?? '', '', pairs[i]?.[0] ?? '', pairs[i]?.[1] ?? '', '', titles[i] ?? '']);
  }
  return { rows, provinces: THAI_PROVINCE_NAMES_SORTED.length, districtRows: pairs.length, titles: titles.length };
}

/** กติกา Dropdown ต่อคอลัมน์ — สูตรอ้างชีต "ค่าที่ใช้ได้" / "รายการ" */
export function importValidationRules(lists: { provinces: number; districtRows: number; titles: number }): Rule[] {
  const values = importValuesSheet();
  const lastOf = (col: number) => {
    let last = 1;
    values.forEach((r, i) => {
      if (i > 0 && (r[col] ?? '') !== '') last = i + 1;
    });
    return last;
  };
  const V = `'${IMPORT_VALUES_SHEET_NAME}'`;
  const L = `'${IMPORT_LISTS_SHEET_NAME}'`;
  const prov = colOf('province');
  const rules: Rule[] = [
    { key: 'gender', formula: `${V}!$A$2:$A$${lastOf(0)}`, strict: true, prompt: 'เลือกเพศ' },
    { key: 'province', formula: `${L}!$A$2:$A$${lists.provinces + 1}`, strict: true, prompt: 'เลือกจังหวัด' },
    {
      key: 'district',
      // อำเภอของจังหวัดในแถวเดียวกัน — ตารางจังหวัด/อำเภอเรียงตามจังหวัด จึงตัดช่วงด้วย MATCH + COUNTIF ได้
      formula: `OFFSET(${L}!$D$1,MATCH($${prov}2,${L}!$C$2:$C$${lists.districtRows + 1},0),0,COUNTIF(${L}!$C$2:$C$${lists.districtRows + 1},$${prov}2),1)`,
      strict: false,
      prompt: 'เลือกจังหวัดก่อน แล้วเลือกอำเภอ',
    },
    { key: 'specific_type', formula: `${V}!$B$2:$B$${lastOf(1)}`, strict: true, prompt: 'เลือกประเภทเจาะจง' },
    { key: 'education', formula: `${V}!$C$2:$C$${lastOf(2)}`, strict: true, prompt: 'เลือกวุฒิการศึกษา' },
    { key: 'license_types', formula: `${V}!$D$2:$D$${lastOf(3)}`, strict: false, prompt: 'เลือก หรือพิมพ์หลายใบคั่นด้วย ,' },
  ];
  if (lists.titles > 0) {
    rules.push({ key: 'position_interest', formula: `${L}!$F$2:$F$${lists.titles + 1}`, strict: false, prompt: 'เลือก หรือพิมพ์ตำแหน่งใหม่' });
  }
  return rules;
}

export function dataValidationsXml(rules: readonly Rule[]): string {
  const last = IMPORT_MAX_ROWS + 1;
  const items = rules.map((r) => {
    const col = colOf(r.key);
    const style = r.strict ? '' : ' errorStyle="warning"';
    const error = r.strict ? 'เลือกจากรายการเท่านั้น' : 'ค่านี้ไม่อยู่ในรายการ — ตรวจอีกครั้ง';
    return (
      `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"${style}` +
      ` promptTitle="${xmlEscape(IMPORT_COLUMNS.find((c) => c.key === r.key)?.header ?? '')}" prompt="${xmlEscape(r.prompt)}"` +
      ` errorTitle="ไม่อยู่ในรายการ" error="${xmlEscape(error)}" sqref="${col}2:${col}${last}">` +
      `<formula1>${xmlEscape(r.formula)}</formula1></dataValidation>`
    );
  });
  return `<dataValidations count="${items.length}">${items.join('')}</dataValidations>`;
}

/** ไฟล์ตัวอย่าง (.xlsx · base64) — `jobTitles` = รายชื่อตำแหน่งจากระบบ (ว่าง = ไม่มี Dropdown ตำแหน่ง) */
export function buildImportTemplateBase64(jobTitles: readonly string[] = []): string {
  const wb = XLSX.utils.book_new();
  const headers = importTemplateHeaders();
  const sheet = XLSX.utils.aoa_to_sheet([headers]);
  sheet['!cols'] = headers.map((h) => ({ wch: Math.max(12, h.length + 4) }));
  XLSX.utils.book_append_sheet(wb, sheet, IMPORT_SHEET_NAME);
  const values = XLSX.utils.aoa_to_sheet(importValuesSheet());
  values['!cols'] = [{ wch: 10 }, { wch: 36 }, { wch: 32 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, values, IMPORT_VALUES_SHEET_NAME);
  const lists = importListsSheet(jobTitles);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lists.rows), IMPORT_LISTS_SHEET_NAME);
  wb.Workbook = { Sheets: [{}, {}, { Hidden: 1 }] };

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  // ไม่มีตัวจัดการ zip = ส่งไฟล์แบบเดิม (ไม่มี Dropdown) — ดาวน์โหลดต้องไม่ล้ม
  if (!CFB) return buf.toString('base64');
  const zip = CFB.read(buf, { type: 'buffer' });
  const entry = CFB.find(zip, '/xl/worksheets/sheet1.xml');
  if (!entry) return buf.toString('base64');
  const xml = Buffer.from(entry.content).toString('utf8');
  // ลำดับใน XML ของชีต: dataValidations ต้องอยู่หลัง sheetData (และก่อน ignoredErrors/pageMargins)
  entry.content = Buffer.from(xml.replace('</sheetData>', `</sheetData>${dataValidationsXml(importValidationRules(lists))}`), 'utf8');
  return CFB.write(zip, { fileType: 'zip', type: 'buffer' }).toString('base64');
}
