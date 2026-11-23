/**
 * ตรวจชุดเอกสารก่อนรับ (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569) — หน้าผู้สมัครและเซิร์ฟเวอร์ใช้ตัวเดียวกัน
 * เซิร์ฟเวอร์ตรวจซ้ำทุกครั้ง ไม่เชื่อค่าที่หน้าเว็บส่งมา
 *
 * กติกา (ห้ามผ่อน):
 * - ไม่มีคำตอบที่ติ๊กให้ล่วงหน้า · ไม่ตอบ = ส่งไม่ได้ · คำตอบ "ไม่ยินยอม/ขอคุย" เก็บตามจริง ลายเซ็นไม่เปลี่ยนให้เป็นยินยอม
 * - สัญญา EX ทุกคนต้องยอมรับ
 * - ต้นฉบับที่ผู้สมัครอ่านต้องเป็นรุ่นปัจจุบัน (เทียบแฮช) — รุ่นเก่า = เปิดลิงก์ใหม่แล้วอ่านอีกครั้ง
 * - ชื่อผู้ลงนามต้องตรงกับชื่อ-นามสกุลที่กรอก
 */
import {
  DATE_FIELDS,
  DOC_TYPES,
  DOCUMENT_FORM_VERSION,
  PERSON_EXTRA_FIELDS,
  PERSON_FIELDS,
  PERSON_PREFIXES,
  SENDER_RELATIONS,
  UPLOAD_KINDS,
  UPLOAD_LABEL,
  type AttentionItem,
  type DocId,
  type PacketPerson,
  type SenderRelation,
  type UploadKind,
} from './documentTypes';
import { OCR_ENGINE, OCR_TEXT_MAX, type OcrFields, type OcrResult } from './ocrFields';
import { formatAddress, validateAddress, type ThaiAddress } from './thaiAddress';
import { validateUploadList } from './uploadValidation';

export class PacketError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type PacketOcrEntry = { status: 'read' | 'manual'; imageConfirmed: true; result: OcrResult | null };
export type PacketOcrAudit = Record<UploadKind, PacketOcrEntry>;

export type Packet = {
  version: string;
  noticeVersion: string;
  person: PacketPerson & { address: string; currentAddress: string };
  addresses: { registered: ThaiAddress; current: ThaiAddress; sameAsRegistered: boolean };
  consents: Record<DocId, string>;
  /** แฮชของต้นฉบับรุ่นที่ผู้สมัครอ่าน ต่อเอกสาร */
  templates: Record<DocId, string>;
  signature: { method: 'typed' | 'drawn'; name: string; image: string };
  attachments: { id: string; kind: UploadKind }[];
  ocr: PacketOcrAudit;
  senderRelation: SenderRelation;
};

export const SIGNATURE_IMAGE_MAX = 180_000;

/** เลขบัตรประชาชนไทย 13 หลัก — หลักสุดท้ายเป็นตัวตรวจ */
export function isValidThaiNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

const isRealDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;

const OCR_FIELD_KEYS: (keyof OcrFields)[] = [
  'prefix',
  'firstName',
  'lastName',
  'firstNameEn',
  'lastNameEn',
  'nationalId',
  'dob',
  'idIssued',
  'idExpiry',
  'licenseNumber',
  'licenseType',
  'licenseIssued',
  'licenseExpiry',
];
const ADDRESS_KEYS: (keyof ThaiAddress)[] = ['house', 'moo', 'soi', 'road', 'provinceId', 'districtId', 'subdistrictId', 'postalCode'];

/** เก็บผล OCR เฉพาะช่องที่รู้จัก ตัดความยาว — กันยัดข้อมูลอื่นเข้ามาในชุด */
function cleanOcrResult(raw: unknown): OcrResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.engine !== OCR_ENGINE || typeof r.text !== 'string') return null;
  const fields: OcrFields = {};
  const rf = (r.fields && typeof r.fields === 'object' ? r.fields : {}) as Record<string, unknown>;
  for (const k of OCR_FIELD_KEYS) if (typeof rf[k] === 'string' && (rf[k] as string).length <= 150) fields[k] = rf[k] as string;
  const ra = (r.address && typeof r.address === 'object' ? r.address : {}) as Record<string, unknown>;
  const address = {} as ThaiAddress;
  for (const k of ADDRESS_KEYS) address[k] = typeof ra[k] === 'string' ? (ra[k] as string).slice(0, 80) : '';
  return {
    engine: OCR_ENGINE,
    confidence: typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? Math.max(0, Math.min(100, r.confidence)) : 0,
    text: r.text.slice(0, OCR_TEXT_MAX),
    fields,
    address,
    warnings: Array.isArray(r.warnings) ? r.warnings.filter((w): w is string => typeof w === 'string').slice(0, 10).map((w) => w.slice(0, 200)) : [],
    processedAt: typeof r.processedAt === 'string' ? r.processedAt.slice(0, 40) : '',
  };
}

export type PacketContext = {
  /** วันนี้ตามเวลาไทย yyyy-mm-dd */
  today: string;
  /** รุ่นคำแจ้งการใช้ข้อมูลที่ต้องรับทราบก่อนแนบ */
  noticeVersion: string;
  /** แฮชของต้นฉบับรุ่นปัจจุบัน ต่อเอกสาร */
  templates: Record<string, string>;
};

/**
 * ตรวจชุดที่ส่งมา คืนชุดที่ล้างแล้ว (ลำดับช่องคงที่ — ใช้ทำแฮชของชุด) · ผิด = โยน PacketError พร้อมข้อความให้ผู้กรอก
 */
export function validatePacket(raw: unknown, ctx: PacketContext): Packet {
  const fail = (text: string, code = 'invalid_document_packet', status = 400): never => {
    throw new PacketError(code, text, status);
  };
  if (!raw || typeof raw !== 'object') fail('ยังไม่มีชุดข้อมูลเอกสาร');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ข้อมูลจากหน้าสาธารณะ ตรวจทีละช่องข้างล่าง
  const p = raw as Record<string, any>;
  if (p.version !== DOCUMENT_FORM_VERSION) fail('แบบฟอร์มเปลี่ยนรุ่นแล้ว เปิดลิงก์ใหม่แล้วตรวจเอกสารอีกครั้ง', 'stale_form', 409);
  if (p.noticeAccepted !== true || p.noticeVersion !== ctx.noticeVersion) fail('อ่านและยอมรับข้อตกลงการใช้ข้อมูลก่อน');
  if (p.reviewed !== true) fail('ตรวจข้อมูลเทียบกับภาพ แล้วติ๊กยืนยันก่อน');
  if (p.signatureIntent !== true) fail('ติ๊กยืนยันว่าประสงค์ลงนามก่อน');
  if (p.confirmed !== true) fail('ติ๊กยืนยันการส่งก่อน');
  if (!(SENDER_RELATIONS as readonly unknown[]).includes(p.senderRelation)) fail('เลือกว่าส่งเองหรือส่งแทนผู้สมัคร');

  // ── ที่อยู่ ──
  let addresses: Packet['addresses'];
  try {
    if (typeof p.addresses?.sameAsRegistered !== 'boolean') throw new Error('เลือกว่าที่อยู่ปัจจุบันเหมือนทะเบียนบ้านหรือไม่');
    const registered = validateAddress(p.addresses?.registered, 'ที่อยู่ตามทะเบียนบ้าน');
    // ติ๊ก "เหมือนทะเบียนบ้าน" = คัดลอกค่าจริงมาเก็บ ไม่อ้างตัวแปร (แก้ทีหลังแล้วชุดที่ส่งไม่เปลี่ยนตาม)
    const current = p.addresses.sameAsRegistered ? { ...registered } : validateAddress(p.addresses?.current, 'ที่อยู่ปัจจุบัน');
    addresses = { registered, current, sameAsRegistered: p.addresses.sameAsRegistered };
  } catch (e) {
    return fail((e as Error).message);
  }

  // ── ไฟล์แนบ + ผล OCR ──
  let attachments: Packet['attachments'];
  try {
    attachments = validateUploadList(p.attachments);
  } catch (e) {
    return fail((e as Error).message);
  }
  const ocr = {} as PacketOcrAudit;
  for (const kind of UPLOAD_KINDS) {
    const a = p.ocr?.[kind];
    if (!a || a.imageConfirmed !== true || !['read', 'manual'].includes(a.status)) fail(`ตรวจภาพ${UPLOAD_LABEL[kind]}ก่อนส่ง`);
    if (a.result && JSON.stringify(a.result).length > 45_000) fail('ผล OCR ใหญ่เกินไป');
    const result = cleanOcrResult(a.result);
    if (a.status === 'read' && !result) fail(`ยังไม่มีผลอ่านภาพ${UPLOAD_LABEL[kind]}`);
    ocr[kind] = { status: a.status, imageConfirmed: true, result };
  }

  // ── ข้อมูลบุคคล ──
  const person = {} as Packet['person'];
  for (const [key, label] of PERSON_FIELDS) {
    const value = p.person?.[key];
    if (typeof value !== 'string' || !value.trim() || value.length > 100) fail(`กรอก${label}ให้ครบ`);
    person[key] = value.trim();
  }
  if (!(PERSON_PREFIXES as readonly string[]).includes(person.prefix)) fail('เลือกคำนำหน้า');
  if (!/^\d{13}$/.test(person.nationalId)) fail('เลขบัตรประชาชนต้องมี 13 หลัก');
  if (!isValidThaiNationalId(person.nationalId)) {
    if (p.person?.nationalIdConfirmed !== true) fail('เลขบัตรประชาชนไม่ผ่านการตรวจ ตรวจกับบัตรอีกครั้ง', 'national_id_checksum');
    person.nationalIdConfirmed = true;
  }
  if (!/^0\d{9}$/.test(person.phone)) fail('เบอร์มือถือต้องมี 10 หลัก ขึ้นต้นด้วย 0');
  if (!isRealDate(person.dob) || person.dob >= ctx.today || person.dob < '1900-01-01') fail('ตรวจวันเกิดอีกครั้ง');
  for (const [key, label] of PERSON_EXTRA_FIELDS) {
    const value = p.person?.[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string' || value.length > 150) fail(`ตรวจ${label}อีกครั้ง`);
    const v = (value as string).trim();
    if (!v) continue;
    if (DATE_FIELDS.includes(key) && !isRealDate(v)) fail(`ตรวจ${label}อีกครั้ง`);
    person[key] = v;
  }
  if (person.licenseNationalId && !/^\d{13}$/.test(person.licenseNationalId)) fail('เลขบัตรประชาชนบนใบขับขี่ต้องมี 13 หลัก');
  if (person.idIssued && person.idIssued > ctx.today) fail('ตรวจวันออกบัตรประชาชนอีกครั้ง');
  if (person.licenseIssued && person.licenseIssued > ctx.today) fail('ตรวจวันออกใบขับขี่อีกครั้ง');
  if (p.person?.idLifetime === true) {
    person.idLifetime = true;
    delete person.idExpiry;
  }
  if (p.person?.licenseLifetime === true) {
    person.licenseLifetime = true;
    delete person.licenseExpiry;
  }
  person.address = formatAddress(addresses.registered);
  person.currentAddress = formatAddress(addresses.current);

  // ── คำตอบเอกสาร ──
  const consents = {} as Packet['consents'];
  const templates = {} as Packet['templates'];
  for (const d of DOC_TYPES) {
    const value = p.consents?.[d.id];
    if (typeof value !== 'string' || !d.answers.some((a) => a.value === value)) fail(`เลือกคำตอบของ${d.title}`);
    consents[d.id] = value;
    const hash = p.templates?.[d.id];
    if (typeof hash !== 'string' || !ctx.templates[d.id] || hash !== ctx.templates[d.id]) {
      fail('ต้นฉบับเอกสารเปลี่ยนรุ่นแล้ว เปิดลิงก์ใหม่แล้วอ่านอีกครั้ง', 'stale_template', 409);
    }
    templates[d.id] = hash;
  }

  // ── ลายเซ็น ──
  const s = p.signature;
  if (!s || !['typed', 'drawn'].includes(s.method)) fail('เลือกวิธีลงนาม');
  const name = typeof s.name === 'string' ? s.name.trim().replace(/\s+/g, ' ') : '';
  if (name !== `${person.firstName} ${person.lastName}`) fail('ชื่อผู้ลงนามต้องตรงกับชื่อและนามสกุลที่กรอก');
  let image = '';
  if (s.method === 'drawn') {
    if (typeof s.image !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s.image) || s.image.length > SIGNATURE_IMAGE_MAX || s.image.length < 200) {
      fail('เขียนลายเซ็นใหม่อีกครั้ง', 'invalid_signature');
    }
    image = s.image;
  }

  return {
    version: DOCUMENT_FORM_VERSION,
    noticeVersion: ctx.noticeVersion,
    person,
    addresses,
    consents,
    templates,
    signature: { method: s.method, name, image },
    attachments: UPLOAD_KINDS.map((kind) => attachments.find((a) => a.kind === kind)!),
    ocr,
    senderRelation: p.senderRelation,
  };
}

/** เรื่องที่ HR ต้องดูเฉพาะจุด — ว่าง = ข้อมูลครบ พร้อมนำเข้า (ไม่ตัดสินว่ารับ/ไม่รับเข้าทำงาน) */
export function computeAttention(packet: Packet, today: string): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const d of DOC_TYPES) {
    const followUp = d.answers.find((a) => a.value === packet.consents[d.id])?.followUp;
    if (followUp === 'declined') out.push({ code: 'consent_declined', doc: d.id });
    if (followUp === 'discuss') out.push({ code: 'consent_discuss', doc: d.id });
  }
  const { person } = packet;
  if (person.licenseNationalId && person.licenseNationalId !== person.nationalId) out.push({ code: 'national_id_mismatch' });
  if (!isValidThaiNationalId(person.nationalId)) out.push({ code: 'national_id_checksum' });
  if (!person.idLifetime && person.idExpiry && person.idExpiry < today) out.push({ code: 'id_expired' });
  if (!person.licenseLifetime && person.licenseExpiry && person.licenseExpiry < today) out.push({ code: 'license_expired' });
  return out;
}

/** JSON ที่ลำดับคีย์คงที่ — ชุดเดียวกันได้แฮชเดียวกันเสมอ (ใช้ตัดสินว่ากดส่งซ้ำหรือส่งของใหม่) */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}
