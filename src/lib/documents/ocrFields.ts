/**
 * แปลงข้อความที่ OCR อ่านได้จากภาพ → ช่องข้อมูล (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 *
 * กติกา (ห้ามผ่อน): อ่านไม่ได้/ไม่แน่ใจ = เว้นว่างให้ผู้สมัครกรอกเอง ห้ามใส่ค่าตัวอย่างแทน ·
 * เจอเลข 13 หลักหลายชุด = ไม่เลือกให้ · ที่อยู่จับคู่ไม่ชัด = ไม่เลือกให้ ·
 * บัตรประชาชนเป็นแหล่งข้อมูลบุคคล ใบขับขี่ให้เฉพาะข้อมูลใบอนุญาต ทะเบียนบ้านเป็นภาพประกอบ ไม่เขียนทับข้อมูลบุคคล
 */
import { emptyAddress, thaiProvinces, type ThaiAddress } from './thaiAddress';
import type { UploadKind } from './documentTypes';

export const OCR_ENGINE = 'Tesseract.js 6.0.1';
export const OCR_TEXT_MAX = 30_000;

/**
 * ตัวอ่านที่ยอมรับ (23 พ.ย. 2569): Tesseract ในมือถือผู้สมัคร · หรือโมเดลบนเซิร์ฟเวอร์ Ollama ของบริษัท (`Ollama · <ชื่อโมเดล>`)
 * เป็นแค่ป้ายบอกที่มาของข้อความที่อ่านได้ — ผู้สมัครตรวจแก้ทุกช่องเองก่อนส่งเหมือนเดิม
 */
export type OcrEngine = typeof OCR_ENGINE | `Ollama · ${string}`;
export const serverOcrEngine = (model: string): OcrEngine => `Ollama · ${model}`;
export const isOcrEngine = (v: unknown): v is OcrEngine =>
  v === OCR_ENGINE || (typeof v === 'string' && /^Ollama · [\w.:/@-]{1,80}$/.test(v));

export type OcrFields = {
  prefix?: string;
  firstName?: string;
  lastName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nationalId?: string;
  dob?: string;
  idIssued?: string;
  idExpiry?: string;
  licenseNumber?: string;
  licenseType?: string;
  licenseIssued?: string;
  licenseExpiry?: string;
};

export type OcrResult = {
  engine: OcrEngine;
  confidence: number;
  text: string;
  fields: OcrFields;
  address: ThaiAddress;
  warnings: string[];
  processedAt: string;
};

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
export const normalText = (s: string) =>
  s
    .replace(/[๐-๙]/g, (c) => String(THAI_DIGITS.indexOf(c)))
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ')
    .trim();
/**
 * ใช้ตอนจับคำเท่านั้น (ข้อความที่เก็บเป็นหลักฐานคงตามที่ OCR อ่าน) — OCR มักแยก "ำ" เป็นนิคหิต + สระอา
 * และสลับวรรณยุกต์ไว้หน้าสระบน/ล่าง ("ท่ี") จัดให้เป็นแบบที่พิมพ์ปกติก่อน
 */
const thaiForMatching = (s: string) => s.replace(/\u0E4D\u0E32/g, '\u0E33').replace(/([\u0E48-\u0E4C])([\u0E31\u0E34-\u0E3A\u0E47])/g, '$2$1');
/** เลข 0 ที่ OCR อ่านเป็นตัว O ในแถวตัวเลขยาว (เลขบัตร) — แก้เฉพาะแถวที่มีตัวเลขจริงหลายตัว ไม่แตะคำภาษาอังกฤษ */
const fixDigitRuns = (s: string) =>
  s.replace(/[\dOo][\dOo -]{11,}[\dOo]/g, (m) => (m.replace(/\D/g, '').length >= 6 ? m.replace(/[Oo]/g, '0') : m));
const compact = (s: string) => s.replace(/[\s.]/g, '');

const MONTHS_SHORT = ['มค', 'กพ', 'มีค', 'เมย', 'พค', 'มิย', 'กค', 'สค', 'กย', 'ตค', 'พย', 'ธค'];
const MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** วันที่บนบัตร (พ.ศ. หรือ ค.ศ. · ตัวเลขหรือชื่อเดือน) → yyyy-mm-dd ค.ศ. · อ่านไม่ได้ = undefined */
function date(text: string): string | undefined {
  const t = normalText(text);
  const numeric = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  let day = 0;
  let month = 0;
  let year = 0;
  if (numeric) {
    day = +numeric[1];
    month = +numeric[2];
    year = +numeric[3];
  } else {
    // วันกับชื่อเดือนอาจติดกัน ("1มี.ค. 2565") — ชื่อเดือนต้องตรงรายการข้างล่างเท่านั้นถึงจะนับ
    const m = t.match(/(\d{1,2})\s*([^\d\n]+?)\s*(\d{4})/);
    if (!m) return undefined;
    day = +m[1];
    year = +m[3];
    const name = compact(m[2]).toLowerCase();
    month = MONTHS_SHORT.findIndex((x) => name === x) + 1;
    if (!month) month = MONTHS_FULL.findIndex((x) => name === x) + 1;
    if (!month) month = MONTHS_EN.findIndex((x) => name.startsWith(x)) + 1;
  }
  if (year > 2400) year -= 543;
  if (year < 1900 || year > 2150 || !month || !day) return undefined;
  const result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (Number.isNaN(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) return undefined;
  return result;
}

/** บรรทัดที่มีป้ายวันที่ของมันเอง — ห้ามหยิบวันที่ของบรรทัดนั้นมาใส่ช่องอื่น */
const DATE_LABEL = /วัน|เกิด|อายุ|อนุญาต|Date|Birth|Issue|Expiry/i;

function labeled(lines: string[], labels: RegExp): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(labels);
    if (m) {
      // วันที่อยู่บรรทัดเดียวกับป้าย หรือบรรทัดถัดไป (เฉพาะบรรทัดถัดไปที่ไม่มีป้ายวันที่ของตัวเอง)
      const rest = lines[i].slice((m.index || 0) + m[0].length);
      const sameLine = date(rest);
      if (sameLine) return sameLine;
      // บัตรประชาชนจริงพิมพ์วันที่ไว้ "เหนือ" ป้าย (วันออกบัตร / วันบัตรหมดอายุ) — ป้ายอยู่ลำพัง + บรรทัดก่อนหน้าเป็นวันที่ล้วน = ใช้บรรทัดก่อนหน้า
      const prev = lines[i - 1] || '';
      if (rest.trim() === '' && prev.length <= 24 && !DATE_LABEL.test(prev)) {
        const above = date(prev);
        if (above) return above;
      }
      const next = lines[i + 1] || '';
      const found = DATE_LABEL.test(next) ? undefined : date(next);
      if (found) return found;
    }
  }
  return undefined;
}

const unique = <T,>(a: T[]) => [...new Set(a)];

/** OCR มักตกสระบน/ล่างของคำหัวบรรทัด — แก้เฉพาะคำหัวบรรทัดที่รู้จัก ไม่แตะข้อมูล */
const LINE_FIXES: [RegExp, string][] = [
  [/^ทีอยู่/, 'ที่อยู่'],
  [/^ชือตัวและ/, 'ชื่อตัวและ'],
  [/^เกิดวันที/, 'เกิดวันที่'],
  [/^เลขทีใบขับขี/, 'เลขที่ใบขับขี่'],
  [/^วันทีอนุญาต/, 'วันที่อนุญาต'],
  [/^วันสินอายุ/, 'วันสิ้นอายุ'],
];

export function readOcrFields(raw: string, kind: UploadKind, confidence: number, engine: OcrEngine = OCR_ENGINE): OcrResult {
  const text = normalText(raw).slice(0, OCR_TEXT_MAX);
  const forMatching = thaiForMatching(text);
  const lines = forMatching
    .split('\n')
    .map((s) => LINE_FIXES.reduce((line, [re, to]) => line.replace(re, to), s.trim()))
    .filter(Boolean);
  const fields: OcrFields = {};
  const address = emptyAddress();
  const warnings: string[] = [];
  if (confidence < 40) warnings.push('อ่านภาพได้ไม่ชัด ถ่ายใหม่ให้ตรงและมีแสงพอ หรือยืนยันว่าภาพชัดแล้วกรอกข้อมูลเอง');
  const ids = unique((fixDigitRuns(forMatching).match(/(?<!\d)(?:\d[ -]*){13}(?!\d)/g) || []).map((s) => s.replace(/\D/g, ''))).filter((s) => s.length === 13);

  if (kind === 'id') {
    if (ids.length === 1) fields.nationalId = ids[0];
    else warnings.push(ids.length > 1 ? 'พบเลข 13 หลักหลายชุด ตรวจเลขบัตรเอง' : 'อ่านเลขบัตร 13 หลักไม่ได้');
    const names = lines
      .map((l) => l.match(/(?:ชื่อตัวและชื่อสกุล\s*[:：]?\s*|ชื่อ(?:\s*[-–]\s*นามสกุล)?\s*[:：]\s*|^)(นางสาว|นาง|นาย)\s+([^\n]+)/))
      .filter(Boolean) as RegExpMatchArray[];
    if (names.length === 1) {
      const words = names[0][2].trim().split(/\s+/);
      if (words.length === 2) {
        fields.prefix = names[0][1];
        fields.firstName = words[0];
        fields.lastName = words[1];
      } else warnings.push('ชื่อไทยแยกไม่ชัด ตรวจชื่อกับนามสกุลเอง');
    }
    // ชื่อกับนามสกุลอังกฤษอยู่บรรทัดเดียวกันได้ ("Name Mr. Somchai Last name Thodsobdee") — ตัด "Last name" ออกจากชื่อ
    const EN_TITLE = String.raw`(?:Mr\.?|Mrs\.?|Miss|Ms\.?)?\s*`;
    const enBoth = lines.map((l) => l.match(new RegExp(String.raw`^Name\s*[:：]?\s*${EN_TITLE}([A-Za-z][A-Za-z -]*?)\s+(?:Last\s*name|Surname)\s*[:：]?\s*([A-Za-z][A-Za-z -]*)$`, 'i'))).find(Boolean);
    const enFirst = enBoth ?? lines.map((l) => l.match(new RegExp(String.raw`^Name\s*[:：]?\s*${EN_TITLE}([A-Za-z][A-Za-z -]*)$`, 'i'))).find(Boolean);
    if (enFirst) fields.firstNameEn = enFirst[1].trim();
    const enLast = enBoth ? [enBoth[0], enBoth[2]] : lines.map((l) => l.match(/^(?:Last\s*name|Surname)\s*[:：]?\s*([A-Za-z][A-Za-z -]*)$/i)).find(Boolean);
    if (enLast) fields.lastNameEn = enLast[1].trim();
    fields.dob = labeled(lines, /(?:เกิดวันที่|วันเกิด|Date\s*of\s*Birth|Birth\s*Date)\s*[:：]?/i);
    fields.idIssued = labeled(lines, /(?:วันออกบัตร|วันที่ออกบัตร|Date\s*of\s*Issue)\s*[:：]?/i);
    // บัตรจริงเขียน "วันบัตรหมดอายุ"
    fields.idExpiry = labeled(lines, /(?:วันบัตรหมดอายุ|วันหมดอายุ|วันที่หมดอายุ|Date\s*of\s*Expiry)\s*[:：]?/i);

    const lineIndex = lines.findIndex((l) => /(?:^ที่อยู่|^Address\b)/i.test(l));
    // ป้าย "ที่อยู่" อ่านไม่ออก — ใช้บรรทัดเดียวที่มีทั้งชื่อจังหวัดและอำเภอ/เขต (มีหลายบรรทัด = ไม่เดา)
    const addressLines = lines.filter(
      (l) => /(?:อ\.|อำเภอ|เขต)/.test(l) && thaiProvinces.some((p) => compact(l).includes(compact(p.name)) || (p.name === 'กรุงเทพมหานคร' && /(?:กรุงเทพฯ|กทม)/.test(l))),
    );
    const source = lineIndex >= 0 ? lines.slice(lineIndex, lineIndex + 4).join(' ') : addressLines.length === 1 ? addressLines[0] : '';
    const sourceCompact = compact(source);
    const provinces = thaiProvinces.filter(
      (p) => sourceCompact.includes(compact(p.name)) || (p.name === 'กรุงเทพมหานคร' && /(?:กรุงเทพฯ|กรุงเทพมหานคร|กทม)/.test(sourceCompact)),
    );
    if (provinces.length === 1) {
      const p = provinces[0];
      address.provinceId = p.id;
      const districts = p.districts.filter(
        (d) => sourceCompact.includes(compact(d.prefix + d.name)) || sourceCompact.includes(compact((d.prefix === 'เขต' ? 'เขต' : 'อ.') + d.name)),
      );
      if (districts.length === 1) {
        const d = districts[0];
        address.districtId = d.id;
        const withPrefix = d.subdistricts.filter(
          (s) => sourceCompact.includes(compact(s.prefix + s.name)) || sourceCompact.includes(compact((s.prefix === 'แขวง' ? 'แขวง' : 'ต.') + s.name)),
        );
        // OCR อ่าน "ต." เพี้ยน ("3.บางพลีใหญ่") — ใช้ชื่อตำบลเปล่าภายในอำเภอที่จับได้แล้ว
        // นับเฉพาะชื่อที่ไม่ใช่ส่วนหนึ่งของชื่อตำบลอื่นที่เจอด้วย · เจอมากกว่าหนึ่ง = ไม่เลือกให้
        // ตัดชื่ออำเภอออกก่อน ไม่ให้ตำบลที่ชื่อเดียวกับอำเภอถูกเลือกเพราะเจอชื่ออำเภอ
        const withoutDistrict = [compact(d.prefix + d.name), compact('อ.' + d.name), compact('เขต' + d.name)].reduce((s, x) => s.split(x).join(' '), sourceCompact);
        const bare = d.subdistricts.filter((s) => withoutDistrict.includes(compact(s.name)));
        const subs = withPrefix.length ? withPrefix : bare.filter((s) => !bare.some((o) => o !== s && o.name.includes(s.name)));
        if (subs.length === 1) {
          const s = subs[0];
          address.subdistrictId = s.id;
          if (s.postalCodes.length === 1) address.postalCode = s.postalCodes[0];
        }
      }
    }
    const house = source.match(/(?:ที่อยู่|Address)\s*[:：]?\s*(\d+[\d/-]*)/i) ?? (lineIndex < 0 ? source.match(/(?:^|\s)(\d+(?:\/\d+)?)\s+(?:หมู่|ม\.|ซ|ถ|ต\.|ตำบล|แขวง)/) : null);
    if (house) address.house = house[1];
    const moo = source.match(/(?:หมู่(?:ที่)?|ม\.)\s*(\d+)/);
    if (moo) address.moo = moo[1];
    const soi = source.match(/(?:ซอย|ซ\.)\s*([^\s]+)/);
    if (soi) address.soi = soi[1];
    const road = source.match(/(?:ถนน|ถ\.)\s*([^\s]+)/);
    if (road) address.road = road[1];
    if (!address.subdistrictId) warnings.push('ที่อยู่บางส่วนอ่านไม่ได้หรือจับคู่ไม่ชัด เลือกจังหวัด อำเภอ และตำบลเอง');
  } else if (kind === 'license') {
    // ใบขับขี่รุ่นใหม่พิมพ์ "ฉบับที่ / No."
    const number = lines.map((l) => l.match(/(?:เลขที่ใบ(?:อนุญาต|ขับขี่)|เลขที่|ฉบับที่|License\s*(?:No\.?|Number)|\bNo\.)\s*[:：]?\s*([A-Z0-9-]{5,20})/i)).find(Boolean);
    if (number) fields.licenseNumber = number[1];
    const type = lines.map((l) => l.match(/(?:ประเภท|Type)\s*[:：]?\s*(.{2,80})/i)).find(Boolean);
    // ตัดที่ป้ายถัดไป — ตัวอ่านบางตัวคืนหลายช่องมาในบรรทัดเดียว ("ประเภท รถยนต์ส่วนบุคคล เกิดวันที่ …")
    if (type) fields.licenseType = type[1].split(/\s+(?=เกิดวันที่|วันเกิด|Date\b|วันที่|วันสิ้นอายุ|วันหมดอายุ|เลขประจำตัว|ชื่อ|Name\b|ฉบับที่|No\.)/i)[0].trim().slice(0, 60);
    // OCR อ่าน "ญ" เป็น "ณ" บ่อย ("วันที่อนุณาต")
    fields.licenseIssued = labeled(lines, /(?:วันที่อนุ[ญณ]าต|วันอนุ[ญณ]าต|วันที่ออกบัตร|วันออกบัตร|Date\s*of\s*Issue)\s*[:：]?/i);
    fields.licenseExpiry = labeled(lines, /(?:วันสิ้นอายุ|วันหมดอายุ|วันที่หมดอายุ|Date\s*of\s*Expiry)\s*[:：]?/i);
    if (ids.length === 1) fields.nationalId = ids[0];
    if (!fields.licenseNumber) warnings.push('อ่านเลขใบขับขี่ไม่ได้ ตรวจและกรอกเอง');
  } else {
    warnings.push('ทะเบียนบ้านใช้เป็นภาพประกอบ ไม่เขียนทับข้อมูลบุคคลที่อ่านจากบัตรประชาชน');
  }
  return {
    engine,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    text,
    fields,
    address,
    warnings,
    processedAt: new Date().toISOString(),
  };
}
