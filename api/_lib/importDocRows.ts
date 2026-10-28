/**
 * ═══ อ่านไฟล์นำเข้าผู้สมัคร Excel · Word · PDF → แถวตาราง (เจ้าของ 28 ต.ค. 2569 Choice "Word + PDF ตามแบบฟอร์ม") ═══
 * ทุกแบบต้องเป็น **ตารางหัวคอลัมน์เดียวกับแบบฟอร์ม Excel** (ชื่อ · นามสกุล · เบอร์โทร · เพศ …) — อ่านเองในเครื่อง ไม่ส่งไป AI
 * - Excel (.xlsx/.xls) = SheetJS แบบเดิม
 * - Word (.docx) = แตก zip อ่าน word/document.xml เอาตารางแรกที่หัวตรงแบบฟอร์ม (`isHeader`)
 * - PDF = pdfjs อ่านตัวอักษร+ตำแหน่ง → จัดเป็นบรรทัดตามแนวตั้ง → แบ่งคอลัมน์ตามตำแหน่งหัวตาราง
 *   (PDF ที่เป็นรูปสแกน = ไม่มีตัวอักษร อ่านไม่ได้ · ตัวที่ซ้อนบรรทัดในช่องเดียวอาจแตกเป็นแถวใหม่)
 * คืน `rows` (ข้อความ) + `raw` (Excel = ค่าดิบ · Word/PDF = ข้อความชุดเดียวกัน)
 */
import { inflateRawSync } from 'node:zlib';
import * as XLSX from 'xlsx';

export type ImportFileKind = 'excel' | 'word' | 'pdf';
export type ImportRows = { kind: ImportFileKind; rows: unknown[][]; raw: unknown[][] };

/** ไฟล์ zip (xlsx/docx) — อ่านรายการไฟล์จาก central directory แล้วแตกเฉพาะชื่อที่ขอ */
export function readZipEntry(buf: Buffer, name: string): Buffer | null {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count && p + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const entryName = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (entryName === name) {
      const lnLen = buf.readUInt16LE(localOff + 26);
      const lxLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lnLen + lxLen;
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');

/** ข้อความในช่องตาราง Word — ต่อ <w:t> ทุกตัว · ย่อหน้าใหม่ในช่อง = ช่องว่าง */
function cellText(xml: string): string {
  const paras = xml.split(/<\/w:p>/);
  return paras
    .map((p) => [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXml(m[1])).join(''))
    .filter((t) => t.trim())
    .join(' ')
    .trim();
}

/** ตารางทุกตารางในไฟล์ Word → แถว × ช่อง (ข้อความ) */
export function docxTables(buf: Buffer): string[][][] {
  const xml = readZipEntry(buf, 'word/document.xml')?.toString('utf8');
  if (!xml) throw new Error('ไม่ใช่ไฟล์ Word');
  const tables: string[][][] = [];
  for (const t of xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)) {
    const rows: string[][] = [];
    for (const r of t[1].matchAll(/<w:tr[ >]([\s\S]*?)<\/w:tr>/g)) {
      rows.push([...r[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((c) => cellText(c[1])));
    }
    if (rows.length > 0) tables.push(rows);
  }
  return tables;
}

type PdfItem = { str: string; x: number; y: number; w: number };

/** ตัวอักษรทุกชิ้นใน PDF พร้อมตำแหน่ง (ทุกหน้าต่อกัน · y ของหน้าถัดไปเลื่อนลง) */
async function pdfItems(buf: Buffer): Promise<PdfItem[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
  const out: PdfItem[] = [];
  let offset = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const { height } = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      out.push({ str: it.str, x: it.transform[4], y: offset + (height - it.transform[5]), w: it.width });
    }
    offset += height;
  }
  await doc.destroy();
  return out;
}

/** จัดตัวอักษรเป็นบรรทัด (y ใกล้กัน) เรียงซ้ายไปขวา */
function pdfLines(items: PdfItem[]): PdfItem[][] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: PdfItem[][] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= 3) last.push(it);
    else lines.push([it]);
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x));
}

/** ช่องว่างระหว่างตัวอักษรไทย — PDF ภาษาไทยมักแทรกช่องว่างกลางคำ ("กรุ งเทพ") · ชื่อ/นามสกุลอยู่คนละช่องอยู่แล้ว */
const THAI_GAP = /([\u0E00-\u0E7F])\s+(?=[\u0E00-\u0E7F])/g;
/** ช่องว่างรอบ . / - ที่ PDF แทรก ("ม . ปลาย / ปวช .") */
const PUNCT_GAP = /\s*([./-])\s*/g;
const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(THAI_GAP, '$1').replace(PUNCT_GAP, '$1').trim();

/**
 * PDF → แถวตาราง
 * ① หาบรรทัดหัวตาราง: ต่อข้อความทั้งบรรทัด (ตัดช่องว่าง) แล้วหาชื่อหัวคอลัมน์ของแบบฟอร์ม (`headers`) — ครบตาม `isHeader`
 * ② ตำแหน่งหัวแต่ละช่อง = ช่วงซ้าย–ขวาของตัวอักษรที่ประกอบเป็นชื่อหัว
 * ③ บรรทัดถัดไป = แถวข้อมูล · จุดเริ่มช่อง = ตำแหน่งที่ตัวอักษรเริ่มตรงกันหลายแถว (หัวจัดกลาง ข้อมูลชิดซ้ายก็เข้าช่องถูก)
 *    ชิ้นที่ต่อท้ายคำ (" ปี" · สระที่แยกออกมา) ไปช่องเดียวกับชิ้นก่อนหน้า
 */
export async function pdfTableRows(buf: Buffer, headers: readonly string[], isHeader: (cells: string[]) => boolean): Promise<string[][]> {
  const lines = pdfLines(await pdfItems(buf));
  const squash = (s: string) => s.replace(/\s+/g, '');
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    // ข้อความทั้งบรรทัด (ไม่มีช่องว่าง) + ชิ้นที่เป็นเจ้าของตัวอักษรแต่ละตัว
    let text = '';
    const owner: number[] = [];
    line.forEach((it, i) => {
      for (const ch of squash(it.str)) {
        text += ch;
        owner.push(i);
      }
    });
    const found: Array<{ name: string; left: number; right: number }> = [];
    for (const h of headers) {
      const at = text.indexOf(squash(h));
      if (at < 0) continue;
      const first = line[owner[at]];
      const last = line[owner[at + squash(h).length - 1]];
      found.push({ name: h, left: first.x, right: Math.max(last.x + last.w, first.x + first.w) });
    }
    // หัวสั้นที่อยู่ในหัวยาว (เช่น "ชื่อ" ใน "ชื่อเล่น") — เก็บตัวที่ไม่ทับกัน เรียงซ้ายไปขวา
    found.sort((x, y) => x.left - y.left || y.right - x.right);
    const cols = found.filter((f, i) => !found.some((g, j) => j !== i && g.left <= f.left && g.right >= f.right && g.name.length > f.name.length));
    const header = cols.map((c) => c.name);
    if (!isHeader(header)) continue;
    /**
     * จุดเริ่มช่องจริง = ตำแหน่งที่ชิ้นตัวอักษรเริ่มตรงกันอย่างน้อย 2 แถว (ข้อมูลชิดซ้ายในช่อง)
     * ช่อง i เริ่มได้ระหว่าง "ขวาของหัวช่องก่อน" ถึง "ซ้ายของหัวช่องนี้" (หัวจะจัดชิดซ้ายหรือกลางก็ตาม) ·
     * หลายจุดตกช่องเดียวกัน = เอาจุดที่เจอบ่อยสุด (จุดอื่นคือชิ้นที่ PDF แตกกลางคำ) · ไม่ตกช่วงไหน = หัวที่ครอบ/ใกล้สุด
     */
    const dataLines = lines.slice(li + 1);
    const isStart = (it: PdfItem) => !/^[\s\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E30\u0E32\u0E33\u0E45]/.test(it.str);
    const clusters: Array<{ x: number; lines: Set<number> }> = [];
    dataLines.forEach((l, i) => {
      for (const it of l) {
        if (!isStart(it)) continue;
        const c = clusters.find((k) => Math.abs(k.x - it.x) <= 2);
        if (c) c.lines.add(i);
        else clusters.push({ x: it.x, lines: new Set([i]) });
      }
    });
    const need = dataLines.length >= 2 ? 2 : 1;
    const dist = (x: number, c: { left: number; right: number }) => (x < c.left ? c.left - x : x > c.right ? x - c.right : 0);
    const best = new Map<number, { x: number; n: number }>();
    for (const c of clusters) {
      if (c.lines.size < need) continue;
      let col = cols.findIndex((h, i) => c.x >= (i === 0 ? -Infinity : cols[i - 1].right - 1) && c.x <= h.left + 2);
      if (col < 0) {
        col = 0;
        cols.forEach((h, i) => {
          if (dist(c.x, h) < dist(c.x, cols[col])) col = i;
        });
      }
      const cur = best.get(col);
      if (!cur || c.lines.size > cur.n || (c.lines.size === cur.n && c.x < cur.x)) best.set(col, { x: c.x, n: c.lines.size });
    }
    const bounds = [...best.entries()].map(([col, v]) => ({ col, x: v.x })).sort((p, q) => p.x - q.x);
    const starts = bounds.map((b) => b.x);
    const startCol = bounds.map((b) => b.col);
    const colOf = (it: PdfItem) => {
      let col = startCol[0] ?? 0;
      starts.forEach((x, i) => {
        if (it.x + 2 >= x) col = startCol[i];
      });
      return col;
    };
    const rows: string[][] = [header];
    for (const l of dataLines) {
      const row = header.map(() => '');
      for (const it of l) {
        const c = colOf(it);
        row[c] = `${row[c]} ${it.str}`;
      }
      const clean = row.map(tidy);
      if (clean.some((v) => v)) rows.push(clean);
    }
    return rows;
  }
  return [];
}

/**
 * อ่านไฟล์นำเข้า — รู้ชนิดจากเนื้อไฟล์ (ไม่เชื่อนามสกุล) · `isHeader` = ตัวเช็กหัวแบบฟอร์มของตัวนำเข้า
 * Word มีหลายตาราง = เอาตารางแรกที่หัวตรง · ไม่ตรงเลย = ตารางแรก (ให้ตัวนำเข้าฟ้องคอลัมน์ที่ขาด)
 */
export async function readImportRows(
  buf: Buffer,
  isHeader: (cells: string[]) => boolean,
  sheetName: string,
  /** ชื่อหัวคอลัมน์ของแบบฟอร์ม — ใช้หาหัวตารางใน PDF */
  headers: readonly string[] = [],
): Promise<ImportRows> {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') {
    const rows = await pdfTableRows(buf, headers, isHeader);
    return { kind: 'pdf', rows, raw: rows };
  }
  const isZip = buf.readUInt32LE(0) === 0x04034b50;
  if (isZip && readZipEntry(buf, 'word/document.xml')) {
    const tables = docxTables(buf);
    const rows = tables.find((t) => isHeader(t[0] ?? [])) ?? tables[0] ?? [];
    return { kind: 'word', rows, raw: rows };
  }
  const wb = XLSX.read(buf, { type: 'buffer' });
  const name = wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  const sheet = name ? wb.Sheets[name] : undefined;
  if (!sheet) return { kind: 'excel', rows: [], raw: [] };
  return {
    kind: 'excel',
    rows: XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false }),
    raw: XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: false }),
  };
}
