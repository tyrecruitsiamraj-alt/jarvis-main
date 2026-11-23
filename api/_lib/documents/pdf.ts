/**
 * PDF ของเอกสาร 1 ฉบับในชุดที่ส่งแล้ว (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 *
 * = ต้นฉบับรุ่นที่ผู้สมัครอ่านครบทุกหน้า + หน้าแนบท้าย "ข้อมูล คำตอบ และลายเซ็น" จากชุดเดียวกัน (ข้อมูล · คำตอบ · ลายเซ็น · เวลา · รุ่น ตรงกันทั้งฉบับ)
 * ไม่ได้เติมข้อความลงช่องของกระดาษต้นฉบับ (ต้องมีผังช่องที่ HR อนุมัติก่อน) และไม่เซ็นแทนบริษัท/พยาน
 * คำตอบพิมพ์ตามที่ผู้สมัครเลือกจริง — "ไม่ยินยอม/ขอคุย" ก็พิมพ์อย่างนั้น
 * สร้างครั้งแรกแล้วเก็บไว้ (เข้ารหัส + แฮช) ครั้งต่อไปได้ไฟล์เดิมทุกไบต์ · เปิดได้เฉพาะคนที่มีสิทธิ์ดูชุด
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { dbQuery } from '../postgres.js';
import { DocError, T, sha256Hex } from './core.js';
import { getBlob, putBlob, type StoredPayload } from './applicant.js';
import { getTemplatePages } from './templates.js';
import {
  PERSON_LABEL,
  SENDER_RELATION_LABEL,
  SIGNATURE_METHOD_LABEL,
  answerLabel,
  docTypeOf,
  isDocId,
  type DocId,
} from '../../../src/lib/documents/documentTypes.js';

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 44;
/** ระยะบรรทัด (เท่าของขนาดตัวอักษร) — ตัวไทยมีสระบน/ล่าง ต่ำกว่านี้ชนกัน */
const LINE = 1.6;
const INK = rgb(0.07, 0.125, 0.235);
const MUTED = rgb(0.4, 0.43, 0.5);
const ACCENT = rgb(0.55, 0.184, 0.224);

const fontBytes = (name: string): Buffer => readFileSync(fileURLToPath(new URL(`../../_assets/fonts/${name}`, import.meta.url)));
let fonts: { regular: Buffer; medium: Buffer } | null = null;
const loadFonts = () => (fonts ??= { regular: fontBytes('Kanit-Regular.ttf'), medium: fontBytes('Kanit-Medium.ttf') });

const THAI_DATETIME = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'long', timeStyle: 'short' });
const THAI_DATE = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', dateStyle: 'long' });
const WORDS = new Intl.Segmenter('th', { granularity: 'word' });
const DATE_KEYS = new Set(['dob', 'idIssued', 'idExpiry', 'licenseIssued', 'licenseExpiry']);

const thaiDate = (ymd: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? THAI_DATE.format(new Date(`${ymd}T00:00:00Z`)) : ymd);

/**
 * ตัดตัวอักษรที่ฟอนต์ไม่มี (อีโมจิในชื่อ LINE ฯลฯ) — ไม่งั้นขึ้นเป็นกล่องเปล่าใน PDF · ชื่อเต็มยังอยู่ในหน้ารายละเอียดของชุด
 */
export function printable(text: string, font: PDFFont): string {
  const have = new Set(font.getCharacterSet());
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    // ตัวเชื่อม/ตัวเลือกแบบอีโมจิ ทิ้งไปพร้อมอีโมจิ
    if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) continue;
    if (cp === 0x20 || have.has(cp)) out += ch;
  }
  return out.replace(/ {2,}/g, ' ').trim();
}

/** ตัดบรรทัดตามคำไทย (ไม่ตัดกลางคำ/ไม่ทิ้งสระลอย) */
export function wrapThai(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const { segment } of WORDS.segment(text)) {
    if (font.widthOfTextAtSize(line + segment, size) <= maxWidth) {
      line += segment;
      continue;
    }
    if (line.trim()) lines.push(line.trimEnd());
    line = segment.trimStart();
    // คำเดียวยาวกว่าบรรทัด (เช่น แฮช) — ตัดทีละตัวอักษร
    while (font.widthOfTextAtSize(line, size) > maxWidth) {
      let cut = line.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

export type PacketPdfInput = {
  packetId: string;
  docId: DocId;
  submittedAt: Date;
  formVersion: string;
  payloadHash: string;
  template: { version: number; sha256: string; pages: { mime: string; bytes: Uint8Array }[] };
  payload: StoredPayload;
  jobLabel: string | null;
};

export async function buildPacketPdf(input: PacketPdfInput): Promise<Uint8Array> {
  const def = docTypeOf(input.docId);
  if (!def) throw new DocError(404, 'not_found', 'ไม่พบเอกสารนี้');
  const { payload } = input;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const f = loadFonts();
  const regular = await pdf.embedFont(f.regular, { subset: true });
  const medium = await pdf.embedFont(f.medium, { subset: true });

  // ── ต้นฉบับครบทุกหน้า ──
  for (let i = 0; i < input.template.pages.length; i++) {
    const src = input.template.pages[i];
    const img = src.mime === 'image/png' ? await pdf.embedPng(src.bytes) : await pdf.embedJpg(src.bytes);
    const page = pdf.addPage(A4);
    const scale = Math.min((A4[0] - 44) / img.width, (A4[1] - 66) / img.height);
    page.drawImage(img, { x: (A4[0] - img.width * scale) / 2, y: 30, width: img.width * scale, height: img.height * scale });
    page.drawText(`${def.title} · ต้นฉบับรุ่น ${input.template.version} · หน้า ${i + 1} / ${input.template.pages.length}`, {
      x: 22,
      y: A4[1] - 22,
      size: 9,
      font: regular,
      color: MUTED,
    });
  }

  // ── หน้าแนบท้าย ──
  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - 56;
  const width = A4[0] - MARGIN * 2;
  const ensure = (need: number) => {
    if (y - need < 56) {
      page = pdf.addPage(A4);
      y = A4[1] - 56;
    }
  };
  const write = (text: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const size = opts.size ?? 10.5;
    const font = opts.font ?? regular;
    for (const line of wrapThai(printable(text, font), font, size, width)) {
      ensure(size * LINE);
      page.drawText(line, { x: MARGIN, y, size, font, color: opts.color ?? INK });
      y -= size * LINE;
    }
    y -= opts.gap ?? 0;
  };
  const heading = (text: string) => {
    y -= 6;
    ensure(40);
    page.drawRectangle({ x: MARGIN, y: y - 3, width: 3, height: 14, color: ACCENT });
    page.drawText(text, { x: MARGIN + 10, y, size: 12, font: medium, color: INK });
    y -= 21;
  };
  const row = (label: string, value: string) => write(`${label}: ${value}`);

  write('ข้อมูล คำตอบ และลายเซ็นของผู้ลงนาม', { size: 16, font: medium, gap: 1 });
  write(def.title, { size: 12.5, font: medium, color: ACCENT, gap: 2 });

  heading('คำตอบของผู้ลงนาม');
  write(answerLabel(def.id, payload.consents[def.id]), { size: 12.5, font: medium });

  heading('ข้อมูลผู้ลงนาม');
  const person = payload.person as unknown as Record<string, string | boolean | undefined>;
  for (const [key, label] of Object.entries(PERSON_LABEL)) {
    let value = typeof person[key] === 'string' ? (person[key] as string) : '';
    if (key === 'idExpiry' && person.idLifetime) value = 'ตลอดชีพ';
    else if (key === 'licenseExpiry' && person.licenseLifetime) value = 'ตลอดชีพ';
    else if (DATE_KEYS.has(key)) value = thaiDate(value);
    if (value) row(label, value);
  }
  row('ที่อยู่ตามทะเบียนบ้าน', payload.person.address);
  row('ที่อยู่ปัจจุบัน', payload.addresses.sameAsRegistered ? 'เหมือนทะเบียนบ้าน' : payload.person.currentAddress);

  heading('ลายเซ็น');
  row('ผู้ลงนาม', payload.signature.name);
  row('วิธีลงนาม', SIGNATURE_METHOD_LABEL[payload.signature.method]);
  if (payload.signature.method === 'drawn') {
    const img = await pdf.embedPng(Buffer.from(payload.signature.image.slice(payload.signature.image.indexOf(',') + 1), 'base64'));
    const w = 190;
    const h = Math.min(80, (img.height / img.width) * w);
    ensure(h + 16);
    page.drawRectangle({ x: MARGIN, y: y - h - 2, width: w + 12, height: h + 8, borderColor: MUTED, borderWidth: 0.5 });
    page.drawImage(img, { x: MARGIN + 6, y: y - h + 2, width: w, height: h });
    y -= h + 16;
  } else {
    write(payload.signature.name, { size: 20, font: medium, gap: 4 });
  }
  row('เวลาที่ส่ง', THAI_DATETIME.format(input.submittedAt));
  row('บัญชี LINE ที่ใช้ส่ง', payload.line.displayName || '-');
  row('ผู้ส่ง', SENDER_RELATION_LABEL[payload.line.senderRelation as keyof typeof SENDER_RELATION_LABEL] ?? payload.line.senderRelation);
  if (input.jobLabel) row('ใบขอ', input.jobLabel);

  heading('หลักฐานของชุดเอกสาร');
  const small = { size: 8.5, color: MUTED } as const;
  write(`รหัสชุด: ${input.packetId}`, small);
  write(`รุ่นแบบฟอร์ม: ${input.formVersion} · ต้นฉบับรุ่น ${input.template.version}`, small);
  write(`แฮชต้นฉบับ (SHA-256): ${input.template.sha256}`, small);
  write(`แฮชข้อมูลชุดที่ส่ง (SHA-256): ${input.payloadHash}`, small);
  write('ลายเซ็นยืนยันคำตอบตามที่เลือกข้างบน ช่องลงนามของบริษัทและพยานในต้นฉบับลงนามตามขั้นตอนของบริษัท', { ...small, gap: 2 });
  write('บัญชี LINE ได้รับการยืนยันจาก LINE ข้อมูลเริ่มต้นอ่านจากภาพเอกสารบนเครื่องของผู้ส่ง และผู้ส่งตรวจแก้ก่อนยืนยัน', small);

  pdf.setTitle(`${def.title} - ${printable(payload.signature.name, regular)}`);
  pdf.setSubject(`ชุดเอกสาร ${input.packetId}`);
  pdf.setProducer('So Recruit');
  pdf.setCreator('So Recruit');
  // วันที่ในไฟล์ = เวลาที่ผู้สมัครส่ง — สร้างซ้ำได้ไฟล์เดิม
  pdf.setCreationDate(input.submittedAt);
  pdf.setModificationDate(input.submittedAt);
  return pdf.save({ useObjectStreams: false });
}

const pdfKind = (docId: DocId): string => `pdf:${docId}`;

/**
 * PDF ของเอกสารในชุด — มีที่เก็บไว้แล้วคืนตัวเดิม ยังไม่มีสร้างแล้วเก็บ (ชุดละฉบับละไฟล์เดียว · ฐานกันซ้ำ)
 * `row`/`payload` ต้องผ่านด่านสิทธิ์ของผู้เรียกมาแล้ว
 */
export async function packetPdf(
  row: { id: string; invitation_id: string; application_id: string; line_user_id: string; submitted_at: Date; form_version: string; payload_hash: string; template_versions: Record<string, { id: string; version: number; sha256: string }> },
  payload: StoredPayload,
  jobLabel: string | null,
  docId: unknown,
): Promise<{ bytes: Buffer; sha256: string; filename: string }> {
  if (!isDocId(docId)) throw new DocError(404, 'not_found', 'ไม่พบเอกสารนี้');
  const kind = pdfKind(docId);
  const filename = `${docId}-${row.id.slice(0, 8)}.pdf`;
  const find = async () =>
    (await dbQuery<{ id: string; sha256: string }>(`select id, sha256 from ${T.files} where packet_id = $1 and kind = $2 and state = 'committed'`, [row.id, kind])).rows[0];
  const stored = await find();
  if (stored) {
    const bytes = await getBlob(stored.id);
    if (bytes) return { bytes, sha256: stored.sha256, filename };
  }
  const tv = row.template_versions?.[docId];
  if (!tv) throw new DocError(404, 'not_found', 'ชุดนี้ไม่มีเอกสารฉบับนี้');
  const pages = await getTemplatePages(tv.id);
  if (!pages.length) throw new DocError(404, 'not_found', 'ไม่พบต้นฉบับของเอกสารฉบับนี้');
  const bytes = Buffer.from(
    await buildPacketPdf({
      packetId: row.id,
      docId,
      submittedAt: new Date(row.submitted_at),
      formVersion: row.form_version,
      payloadHash: row.payload_hash,
      template: { version: tv.version, sha256: tv.sha256, pages },
      payload,
      jobLabel,
    }),
  );
  const sha256 = sha256Hex(bytes);
  if (!stored) {
    const { rows } = await dbQuery<{ id: string }>(
      `insert into ${T.files} (invitation_id, application_id, kind, mime, size, sha256, state, line_user_id, committed_at, packet_id)
       values ($1, $2, $3, 'application/pdf', $4, $5, 'committed', $6, now(), $7)
       on conflict (packet_id, kind) where kind like 'pdf:%' do nothing
       returning id`,
      [row.invitation_id, row.application_id, kind, bytes.length, sha256, row.line_user_id, row.id],
    );
    if (rows[0]) await putBlob(null, rows[0].id, bytes);
    else {
      // อีกคำขอสร้างเสร็จก่อน — ใช้ไฟล์ของเขา (ชุดละฉบับละไฟล์เดียว)
      const other = await find();
      const otherBytes = other ? await getBlob(other.id) : null;
      if (other && otherBytes) return { bytes: otherBytes, sha256: other.sha256, filename };
    }
  }
  return { bytes, sha256, filename };
}
