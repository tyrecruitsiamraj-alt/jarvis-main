/**
 * ═══ ส่งเอกสารผ่าน LINE — ชุดเอกสาร คำตอบ ช่องข้อมูล คำบนจอ (เจ้าของ 22 พ.ย. 2569) ═══
 *
 * ที่เดียวที่บอกว่ามีเอกสารอะไรบ้าง ตอบอะไรได้ และผู้สมัครกรอกช่องไหน — หน้าผู้สมัคร · เซิร์ฟเวอร์ · หน้าเจ้าหน้าที่ · PDF ใช้ชุดเดียวกัน
 * เอกสาร 5 ประเภท: ตรวจประวัติ · Tik Tack · ข้อมูลส่วนบุคคล · สัญญา EX (ทุกคนต้องยอมรับ) · ภาพลักษณ์และความลับ
 * ไม่มีใบสมัครงาน/คำถามสัมภาษณ์ (เจ้าหน้าที่เก็บตอนโทร) · ไม่มีด้านหลังบัตรและใบขับขี่
 *
 * แก้ข้อความเอกสาร/คำตอบ/ช่อง เมื่อไหร่ต้องเปลี่ยน `DOCUMENT_FORM_VERSION` — ชุดที่ส่งแล้วจำรุ่นเดิมไว้
 * ไฟล์นี้เบา (ไม่มีข้อมูลที่อยู่) หน้าเจ้าหน้าที่ import ได้
 */

export const DOCUMENT_FORM_VERSION = 'jarvis-documents-2569-11-22-v1';

export const DOC_IDS = ['background', 'payroll', 'privacy', 'ex', 'reputation'] as const;
export type DocId = (typeof DOC_IDS)[number];

export type DocAnswer = { value: string; label: string; /** คำตอบที่ HR ต้องคุยต่อ */ followUp?: 'declined' | 'discuss' };

export type DocType = { id: DocId; title: string; answers: readonly DocAnswer[] };

export const DOC_TYPES: readonly DocType[] = [
  {
    id: 'background',
    title: 'หนังสือยินยอมให้ตรวจประวัติ',
    answers: [
      { value: 'yes', label: 'ยินยอมให้ตรวจประวัติ' },
      { value: 'no', label: 'ไม่ยินยอม / ขอคุยกับเจ้าหน้าที่', followUp: 'declined' },
    ],
  },
  {
    id: 'payroll',
    title: 'รับทราบการใช้แอป Tik Tack',
    answers: [
      { value: 'ack', label: 'รับทราบ' },
      { value: 'discuss', label: 'ขอให้เจ้าหน้าที่อธิบาย', followUp: 'discuss' },
    ],
  },
  {
    id: 'privacy',
    title: 'ความยินยอมใช้ข้อมูลส่วนบุคคล',
    answers: [
      { value: 'yes', label: 'ให้ความยินยอม' },
      { value: 'no', label: 'ไม่ให้ความยินยอม', followUp: 'declined' },
    ],
  },
  {
    // ทุกคนต้องยอมรับ EX — มีคำตอบเดียว ไม่เลือก = ส่งไม่ได้ (ไม่ติ๊กให้ล่วงหน้า)
    id: 'ex',
    title: 'สัญญาจ้าง EX',
    answers: [{ value: 'yes', label: 'อ่านและยอมรับสัญญาจ้าง EX ครบทุกหน้า' }],
  },
  {
    id: 'reputation',
    title: 'ข้อตกลงรักษาภาพลักษณ์และความลับ',
    answers: [
      { value: 'yes', label: 'อ่านและยอมรับ' },
      { value: 'discuss', label: 'ขอคุยกับเจ้าหน้าที่ก่อน', followUp: 'discuss' },
    ],
  },
];

export const isDocId = (v: unknown): v is DocId => typeof v === 'string' && (DOC_IDS as readonly string[]).includes(v);
export const docTypeOf = (id: string): DocType | undefined => DOC_TYPES.find((d) => d.id === id);
export const docTitle = (id: string): string => docTypeOf(id)?.title ?? id;
export const answerOf = (id: string, value: string | undefined): DocAnswer | undefined =>
  docTypeOf(id)?.answers.find((a) => a.value === value);
export const answerLabel = (id: string, value: string | undefined): string => answerOf(id, value)?.label ?? 'ยังไม่มีคำตอบ';

// ─── ภาพที่ต้องแนบ ───────────────────────────────────────────────────────────
export const UPLOAD_KINDS = ['id', 'license', 'house'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];
export const isUploadKind = (v: unknown): v is UploadKind =>
  typeof v === 'string' && (UPLOAD_KINDS as readonly string[]).includes(v);

export const UPLOAD_LABEL: Record<UploadKind, string> = {
  id: 'บัตรประชาชน ด้านหน้า',
  license: 'ใบขับขี่ ด้านหน้า',
  house: 'ทะเบียนบ้าน หน้าที่มีชื่อ',
};

// ─── ช่องที่ผู้สมัครกรอกครั้งเดียว ────────────────────────────────────────────
export const PERSON_PREFIXES = ['นาย', 'นาง', 'นางสาว', 'อื่น ๆ'] as const;

/** ช่องบังคับ */
export const PERSON_FIELDS = [
  ['prefix', 'คำนำหน้า'],
  ['firstName', 'ชื่อ'],
  ['lastName', 'นามสกุล'],
  ['dob', 'วันเกิด'],
  ['nationalId', 'เลขบัตรประชาชน'],
  ['phone', 'เบอร์มือถือ'],
] as const;

/** ช่องเสริม (อ่านจากบัตร/ใบขับขี่ได้ก็เติม อ่านไม่ได้เว้นว่าง) */
export const PERSON_EXTRA_FIELDS = [
  ['firstNameEn', 'ชื่อภาษาอังกฤษ'],
  ['lastNameEn', 'นามสกุลภาษาอังกฤษ'],
  ['idIssued', 'วันออกบัตรประชาชน'],
  ['idExpiry', 'วันหมดอายุบัตรประชาชน'],
  ['licenseNumber', 'เลขใบขับขี่'],
  ['licenseNationalId', 'เลขบัตรประชาชนบนใบขับขี่'],
  ['licenseType', 'ประเภทใบขับขี่'],
  ['licenseIssued', 'วันออกใบขับขี่'],
  ['licenseExpiry', 'วันหมดอายุใบขับขี่'],
] as const;

export type PersonKey = (typeof PERSON_FIELDS)[number][0];
export type PersonExtraKey = (typeof PERSON_EXTRA_FIELDS)[number][0];
export const DATE_FIELDS: readonly string[] = ['dob', 'idIssued', 'idExpiry', 'licenseIssued', 'licenseExpiry'];

export type PacketPerson = Record<PersonKey, string> &
  Partial<Record<PersonExtraKey, string>> & {
    /** บัตร/ใบขับขี่แบบตลอดชีพ — ไม่มีวันหมดอายุ */
    idLifetime?: boolean;
    licenseLifetime?: boolean;
    /** เลขบัตรไม่ผ่านการตรวจหลักสุดท้าย แต่ผู้สมัครยืนยันว่าตรงกับบัตร */
    nationalIdConfirmed?: boolean;
  };

export const PERSON_LABEL: Record<string, string> = Object.fromEntries([...PERSON_FIELDS, ...PERSON_EXTRA_FIELDS]);

export const SENDER_RELATIONS = ['self', 'representative'] as const;
export type SenderRelation = (typeof SENDER_RELATIONS)[number];
export const SENDER_RELATION_LABEL: Record<SenderRelation, string> = {
  self: 'ผู้สมัครเอง',
  representative: 'ส่งแทนผู้สมัคร',
};

export const SIGNATURE_METHOD_LABEL: Record<'typed' | 'drawn', string> = { typed: 'พิมพ์ชื่อ', drawn: 'เขียนลายเซ็น' };

// ─── เรื่องที่ HR ต้องดูเฉพาะจุด (เซิร์ฟเวอร์คิดตอนรับชุด ไม่เชื่อค่าจากหน้าเว็บ) ──────────
export type AttentionCode =
  | 'consent_declined'
  | 'consent_discuss'
  | 'national_id_mismatch'
  | 'national_id_checksum'
  | 'id_expired'
  | 'license_expired';

export type AttentionItem = { code: AttentionCode; doc?: DocId };

export function attentionText(item: AttentionItem): string {
  switch (item.code) {
    case 'consent_declined':
      return `${docTitle(item.doc ?? '')}: ${answerLabel(item.doc ?? '', 'no')}`;
    case 'consent_discuss':
      return `${docTitle(item.doc ?? '')}: ${answerLabel(item.doc ?? '', 'discuss')}`;
    case 'national_id_mismatch':
      return 'เลขบัตรประชาชนบนบัตรกับบนใบขับขี่ไม่ตรงกัน';
    case 'national_id_checksum':
      return 'เลขบัตรประชาชนไม่ผ่านการตรวจหลักสุดท้าย ผู้สมัครยืนยันว่าตรงกับบัตร';
    case 'id_expired':
      return 'บัตรประชาชนหมดอายุแล้ว';
    case 'license_expired':
      return 'ใบขับขี่หมดอายุแล้ว';
    default:
      return String((item as { code: string }).code);
  }
}

// ─── แผนกฝั่ง iRecruit ที่ HR เลือกตอนนำเข้า (ไม่เดาจาก BU · รายการจากหน้าเพิ่มผู้สมัครของ iRecruit 14 ต.ค. 2569) ──
export const IRECRUIT_DIVISIONS = ['BS', 'CR', 'CT', 'DB', 'DS', 'FL', 'IO', 'LA', 'LB', 'LM', 'OUS', 'PE', 'PS', 'SB', 'SN'] as const;
export const isIrecruitDivision = (v: unknown): v is (typeof IRECRUIT_DIVISIONS)[number] =>
  typeof v === 'string' && (IRECRUIT_DIVISIONS as readonly string[]).includes(v);
