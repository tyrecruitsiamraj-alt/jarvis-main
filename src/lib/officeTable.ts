/**
 * ═══ อ่านตารางจากไฟล์ Word (.docx) · Excel (.xlsx) · CSV/ข้อความ ในเบราว์เซอร์ → TSV (เจ้าของ 15 พ.ย. 2569) ═══
 * > *"เพิ่มข้อสอบลองดู Knowa ว่าเพิ่มยังไง … Knowa นำเข้าเป็นไฟล์ได้ จัดรูปแบบอะไรต่างๆก็ได้"*
 * แปลงจาก KNOWA `lib/utils/office-import.ts` (ผ่านเว็บจริงแล้ว) — ไม่ใช้ไลบรารี: .docx/.xlsx คือ ZIP ข้างในเป็น XML
 * แตกด้วย `DecompressionStream` ของเบราว์เซอร์ · ไฟล์ไม่ถึงเซิร์ฟเวอร์ ผู้ใช้เห็นตารางที่อ่านได้ก่อนกดเพิ่มเสมอ
 * ใช้ที่: นำเข้าข้อสอบ `quizImport.ts` (ข้อความที่ได้ป้อนเข้า `parseQuizImport` ตัวเดียว)
 */

export type OfficeParseResult = {
  /** ตารางรูป TSV */
  tsv: string;
  rowCount: number;
  /** อ่านมาจากอะไร — บอกผู้ใช้ว่าระบบตีความไฟล์แบบไหน */
  sourceTh: string;
  /** อ่านไม่ได้เพราะอะไร (ข้อความถึงผู้ใช้) */
  errorTh?: string;
};

/** หัวตารางของข้อที่อ่านจากข้อความเรียงใน Word — ตัวอ่านข้อสอบจับคอลัมน์จากหัวนี้ */
export const PARAGRAPH_HEADERS = ['คำถาม', 'ตัวเลือก ก', 'ตัวเลือก ข', 'ตัวเลือก ค', 'ตัวเลือก ง', 'เฉลย', 'ทักษะ', 'คะแนน'];

/**
 * ดึงไฟล์หนึ่งไฟล์ออกจาก ZIP — ไล่ local file header · รับ 0 = ไม่บีบ · 8 = deflate (เท่าที่ Office ใช้)
 * ⚠️ `deflate-raw` ไม่ใช่ `deflate` — ข้อมูลใน ZIP ไม่มีหัว zlib
 */
async function unzipEntry(buf: ArrayBuffer, wantName: string): Promise<Uint8Array | null> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let p = 0;
  while (p + 30 <= bytes.length) {
    if (view.getUint32(p, true) !== 0x04034b50) break;
    const method = view.getUint16(p + 8, true);
    const compSize = view.getUint32(p + 18, true);
    const nameLen = view.getUint16(p + 26, true);
    const extraLen = view.getUint16(p + 28, true);
    const nameStart = p + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    if (name === wantName) {
      const data = bytes.subarray(dataStart, dataStart + compSize);
      if (method === 0) return data;
      if (method !== 8) return null;
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    // ขนาด 0 + ธง bit 3 = ขนาดจริงอยู่ท้ายข้อมูล ไล่ต่อไม่ได้ — ตอบว่าอ่านไม่ได้ ดีกว่าเดาตำแหน่งผิด
    if (compSize === 0 && (view.getUint16(p + 6, true) & 0x08) !== 0) return null;
    p = dataStart + compSize;
  }
  return null;
}

/** ถอด entity ของ XML (ห้าม innerHTML — ไฟล์มาจากผู้ใช้) */
function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

const textRuns = (xml: string) =>
  // <w:t> หรือ <w:t xml:space=…> เท่านั้น — `<w:t[^>]*>` จับ <w:tc>/<w:tbl>/<w:tab/> ไปด้วย
  (xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) ?? []).map((m) => unescapeXml(m.replace(/<[^>]+>/g, ''))).join('');

/** ตารางแรกที่มีข้อมูลใน Word — แท็บ/ขึ้นบรรทัดในเซลล์ = ช่องว่าง (ไม่งั้นคำติดกันและคอลัมน์เกิน) */
function docxTablesToRows(xml: string): string[][] {
  const rows: string[][] = [];
  for (const tbl of xml.match(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g) ?? []) {
    for (const tr of tbl.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) ?? []) {
      const cells = (tr.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) ?? []).map((tc) =>
        textRuns(tc.replace(/<w:tab\b[^>]*\/?>/g, '<w:t> </w:t>').replace(/<w:br\b[^>]*\/?>/g, '<w:t> </w:t>').replace(/<\/w:p>/g, '<w:t> </w:t></w:p>'))
          .replace(/\s+/g, ' ')
          .trim(),
      );
      if (cells.some((c) => c.length > 0)) rows.push(cells);
    }
    if (rows.length > 0) break;
  }
  return rows;
}

function docxParagraphs(xml: string): string[] {
  return (xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? []).map((p) => textRuns(p).replace(/\s+/g, ' ').trim()).filter((t) => t.length > 0);
}

/**
 * ข้อสอบที่พิมพ์เป็นข้อความ (Word หรือวางมา) → แถวตามหัว `PARAGRAPH_HEADERS`
 *   1. คำถาม · ก. ตัวเลือก (ก–ซ · a–h · • -) · เฉลย: ก · ทักษะ: ระบบไฟฟ้า (ใช้กับข้อถัดไปจนกว่าจะเปลี่ยน) · คะแนน: 2
 * ⚠️ ข้อที่ไม่มีเฉลยยังส่งออก (ช่องว่าง) ให้ตัวอ่านข้อสอบบอกว่าแถวไหนขาด — ห้ามตัดทิ้งเงียบ ๆ
 * ⚠️ เลขขึ้นบรรทัด = ข้อใหม่ ถ้าข้อที่อ่านอยู่มีตัวเลือกแล้ว · ยังไม่มีตัวเลือก = ตัวเลือกแบบเลข (1. 2. 3. 4.)
 */
export function paragraphsToRows(lines: readonly string[]): string[][] {
  const rows: string[][] = [];
  let skill = '';
  let cur: { stem: string; opts: string[]; answer: string; points: string } | null = null;
  const flush = () => {
    if (!cur || !cur.stem) return;
    const o = [...cur.opts];
    while (o.length < 4) o.push('');
    rows.push([cur.stem, ...o, cur.answer, skill, cur.points]);
    cur = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const sk = line.match(/^(?:ทักษะ|หมวด|หัวข้อ)\s*[:：]\s*(.+)$/);
    if (sk) {
      flush();
      skill = sk[1].trim();
      continue;
    }
    const ans = line.match(/^(?:เฉลย|คำตอบ|ตอบ|แนวคำตอบ)\s*[:：.]?\s*(.+)$/);
    if (ans && cur) {
      cur.answer = ans[1].trim();
      continue;
    }
    const pts = line.match(/^คะแนน\s*[:：.]?\s*(\d+)/);
    if (pts && cur) {
      cur.points = pts[1];
      continue;
    }
    const letterOpt = line.match(/^(?:[ก-ฮ]|[a-hA-H])\s*[.)]\s*(.+)$/) ?? line.match(/^[•\-–]\s*(.+)$/);
    if (letterOpt && cur && cur.stem) {
      cur.opts.push(letterOpt[1].trim());
      continue;
    }
    const numbered = line.match(/^(?:ข้อที่|ข้อ)?\s*(\d+)\s*[.)]\s*(.+)$/);
    if (numbered) {
      const body = numbered[2].trim();
      if (cur && cur.stem && cur.opts.length === 0 && !cur.answer) cur.opts.push(body);
      else {
        flush();
        cur = { stem: body, opts: [], answer: '', points: '' };
      }
      continue;
    }
    const plainNo = line.match(/^(?:ข้อที่|ข้อ)\s*\d+\s+(.+)$/);
    if (plainNo) {
      flush();
      cur = { stem: plainNo[1].trim(), opts: [], answer: '', points: '' };
      continue;
    }
    // โจทย์ยาวขึ้นบรรทัดใหม่
    if (cur && cur.opts.length === 0 && cur.stem && !cur.answer) cur.stem += ` ${line}`;
  }
  flush();
  return rows;
}

/**
 * ชีตแรกของ Excel — ข้อความส่วนใหญ่อยู่ `xl/sharedStrings.xml` (ชีตอ้างด้วยเลข `t="s"`)
 * ⚠️ กางคอลัมน์ตามตำแหน่งจริงจาก `r="C5"` · เซลล์ว่าง `<c r="D3" s="2"/>` ต้องจบที่ `/>` ของมันเอง (KNOWA เจอบนเว็บจริง 12 พ.ย. 2569)
 */
function xlsxToRows(sheetXml: string, sharedXml: string | null): string[][] {
  const shared: string[] = [];
  for (const si of sharedXml?.match(/<si\b[\s\S]*?<\/si>/g) ?? []) {
    shared.push((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((m) => unescapeXml(m.replace(/<[^>]+>/g, ''))).join(''));
  }
  const colIndex = (ref: string): number => {
    let n = 0;
    for (const ch of ref.match(/^[A-Z]+/)?.[0] ?? 'A') n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  const rows: string[][] = [];
  for (const row of sheetXml.match(/<row\b(?:[^>]*?\/>|[^>]*>[\s\S]*?<\/row>)/g) ?? []) {
    const cells: string[] = [];
    for (const c of row.match(/<c\b(?:[^>]*?\/>|[^>]*>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = c.match(/\sr="([A-Z]+\d+)"/)?.[1] ?? '';
      const type = c.match(/\st="([^"]+)"/)?.[1] ?? '';
      let value = '';
      if (type === 'inlineStr') value = (c.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((m) => unescapeXml(m.replace(/<[^>]+>/g, ''))).join('');
      else {
        const v = c.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1];
        if (v != null) value = type === 's' ? (shared[Number(v)] ?? '') : unescapeXml(v);
      }
      const at = ref ? colIndex(ref) : cells.length;
      while (cells.length < at) cells.push('');
      cells[at] = value.replace(/\s+/g, ' ').trim();
    }
    if (cells.some((x) => x.length > 0)) rows.push(cells);
  }
  return rows;
}

/** แถว → TSV — ตัดแท็บในเซลล์ก่อน ไม่งั้นคอลัมน์เพี้ยน */
export function rowsToTsv(rows: readonly string[][]): string {
  return rows.map((r) => r.map((c) => c.replace(/\t/g, ' ')).join('\t')).join('\n');
}

const fail = (errorTh: string): OfficeParseResult => ({ tsv: '', rowCount: 0, sourceTh: '', errorTh });

/** Word/Excel → TSV · ไฟล์สแกน (รูป) อ่านไม่ได้ต้องบอกตรง ๆ ไม่คืนตารางว่างให้เดา */
export async function officeFileToTsv(file: { name: string; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<OfficeParseResult> {
  const lower = file.name.toLowerCase();
  const isDocx = lower.endsWith('.docx');
  if (!isDocx && !lower.endsWith('.xlsx')) return fail('รับไฟล์ .xlsx · .docx · .csv · .txt — ไฟล์ .doc/.xls รุ่นเก่าให้บันทึกเป็นรุ่นใหม่ก่อน');
  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch {
    return fail('อ่านไฟล์ไม่สำเร็จ ลองเลือกไฟล์ใหม่');
  }
  try {
    if (isDocx) {
      const raw = await unzipEntry(buf, 'word/document.xml');
      if (!raw) return fail('ไฟล์นี้ไม่ใช่ Word ที่อ่านได้ — ถ้าเป็นไฟล์เก่า (.doc) ให้บันทึกเป็น .docx ก่อน');
      const xml = new TextDecoder().decode(raw);
      const table = docxTablesToRows(xml);
      if (table.length > 0) return { tsv: rowsToTsv(table), rowCount: table.length, sourceTh: `อ่านจากตารางในไฟล์ Word (${table.length} แถว)` };
      const rows = paragraphsToRows(docxParagraphs(xml));
      if (rows.length > 0) {
        return { tsv: rowsToTsv([PARAGRAPH_HEADERS, ...rows]), rowCount: rows.length, sourceTh: `อ่านจากข้อความในไฟล์ Word (${rows.length} ข้อ)` };
      }
      return fail('อ่านข้อสอบจากไฟล์นี้ไม่ได้ — ถ้าเป็นรูปสแกน ต้องพิมพ์เป็นข้อความก่อน หรือจัดเป็นตารางตามแบบฟอร์มแล้วลองใหม่');
    }
    const sheet = await unzipEntry(buf, 'xl/worksheets/sheet1.xml');
    if (!sheet) return fail('ไฟล์นี้ไม่ใช่ Excel ที่อ่านได้ — ถ้าเป็นไฟล์เก่า (.xls) ให้บันทึกเป็น .xlsx ก่อน');
    const sharedRaw = await unzipEntry(buf, 'xl/sharedStrings.xml');
    const rows = xlsxToRows(new TextDecoder().decode(sheet), sharedRaw ? new TextDecoder().decode(sharedRaw) : null);
    if (rows.length === 0) return fail('ชีตแรกของไฟล์นี้ว่าง — ย้ายตารางข้อสอบมาไว้ชีตแรกแล้วลองใหม่');
    return { tsv: rowsToTsv(rows), rowCount: rows.length, sourceTh: `อ่านจากชีตแรกของไฟล์ Excel (${rows.length} แถว)` };
  } catch {
    return fail('แตกไฟล์ไม่สำเร็จ — ไฟล์อาจเสียหายหรือตั้งรหัสผ่านไว้');
  }
}

/**
 * CSV/ข้อความให้ได้ภาษาไทยถูกทุกแบบที่ Excel บันทึก: UTF-8 (มี/ไม่มี BOM) · windows-874 · UTF-16 (Unicode Text)
 * ไทยกลายเป็น ??? ไปแล้วตอนบันทึก = กู้ไม่ได้ บอกให้บันทึกใหม่
 */
export async function decodeTextFile(file: { arrayBuffer: () => Promise<ArrayBuffer> }): Promise<{ text: string; errorTh?: string }> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { text: '', errorTh: 'อ่านไฟล์ไม่สำเร็จ ลองเลือกไฟล์ใหม่' };
  }
  let text: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
  else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder('windows-874').decode(bytes);
    }
  }
  text = text.replace(/^\uFEFF/, '');
  if (!/[฀-๿]/.test(text) && /\?{3,}/.test(text)) {
    return { text: '', errorTh: 'ภาษาไทยในไฟล์นี้หายไปตั้งแต่ตอนบันทึก (เห็นเป็น ???) — บันทึกใหม่เป็น "CSV UTF-8" หรือ Excel (.xlsx)' };
  }
  return { text };
}
