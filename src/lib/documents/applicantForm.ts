/**
 * ฟอร์มส่งเอกสารของผู้สมัคร — สถานะและกติกาของหน้า /apply/documents (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 * ตรรกะล้วน ไม่มี React: หน้าเว็บเรียกฟังก์ชันพวกนี้ แล้วเซิร์ฟเวอร์ตรวจซ้ำด้วย `validatePacket` ตัวเดียวกัน
 *
 * กติกา (ห้ามผ่อน):
 * - เปลี่ยนภาพบัตร = ล้างช่องที่มาจากบัตรใบเดิม แล้วเติมเฉพาะที่ OCR อ่านได้จากใบใหม่ (อ่านไม่ได้ = ว่าง ไม่มีค่าตัวอย่าง)
 * - ใบขับขี่เติมเฉพาะช่องใบขับขี่ เลข 13 หลักบนใบขับขี่เก็บแยก ไม่ทับเลขบัตรประชาชน
 * - แก้ข้อมูล/คำตอบ/ภาพ หลังลงนาม = ลายเซ็นและคำยืนยันเดิมใช้ไม่ได้ ต้องลงนามใหม่
 * - ไม่มีคำตอบเอกสารที่เลือกให้ล่วงหน้า
 */
import {
  DOC_TYPES,
  DOCUMENT_FORM_VERSION,
  PERSON_EXTRA_FIELDS,
  PERSON_FIELDS,
  UPLOAD_KINDS,
  UPLOAD_LABEL,
  type DocId,
  type SenderRelation,
  type UploadKind,
} from './documentTypes';
import type { ApplicantState, DraftFileView } from './documentViews';
import type { OcrFields, OcrResult } from './ocrFields';
import { isValidThaiNationalId } from './packetValidation';
import { emptyAddress, validateAddress, type ThaiAddress } from './thaiAddress';

export type UploadSlot = {
  file: DraftFileView;
  /** read = OCR อ่านแล้ว · manual = ไม่มีผล OCR ผู้สมัครกรอกเอง · reading = กำลังอ่าน */
  status: 'reading' | 'read' | 'manual';
  result: OcrResult | null;
  imageConfirmed: boolean;
  /** คำเตือนคุณภาพภาพ (เบลอ · มืด · แสงสะท้อน) ของใบนี้ */
  quality: string[];
};

export type PersonFieldKey = (typeof PERSON_FIELDS)[number][0] | (typeof PERSON_EXTRA_FIELDS)[number][0];

export type ApplicantForm = {
  noticeAccepted: boolean;
  slots: Partial<Record<UploadKind, UploadSlot>>;
  person: Record<PersonFieldKey, string>;
  idLifetime: boolean;
  licenseLifetime: boolean;
  nationalIdConfirmed: boolean;
  registered: ThaiAddress;
  current: ThaiAddress;
  sameAsRegistered: boolean;
  reviewed: boolean;
  consents: Partial<Record<DocId, string>>;
  signMethod: 'typed' | 'drawn';
  signName: string;
  signImage: string;
  signatureIntent: boolean;
  senderRelation: SenderRelation | '';
  confirmed: boolean;
};

export const FORM_STEPS = ['ถ่ายเอกสาร', 'ตรวจข้อมูล', 'อ่านและตอบ', 'ลงนามและส่ง'] as const;

const PERSON_KEYS = [...PERSON_FIELDS, ...PERSON_EXTRA_FIELDS].map(([k]) => k) as PersonFieldKey[];
/** ช่องที่มาจากบัตรประชาชน — เปลี่ยนภาพบัตรแล้วต้องล้าง (เบอร์มือถือไม่ได้มาจากบัตร ไม่ล้าง) */
const ID_KEYS: PersonFieldKey[] = ['prefix', 'firstName', 'lastName', 'dob', 'nationalId', 'firstNameEn', 'lastNameEn', 'idIssued', 'idExpiry'];
const LICENSE_KEYS: PersonFieldKey[] = ['licenseNumber', 'licenseNationalId', 'licenseType', 'licenseIssued', 'licenseExpiry'];

export function blankForm(): ApplicantForm {
  return {
    noticeAccepted: false,
    slots: {},
    person: Object.fromEntries(PERSON_KEYS.map((k) => [k, ''])) as Record<PersonFieldKey, string>,
    idLifetime: false,
    licenseLifetime: false,
    nationalIdConfirmed: false,
    registered: emptyAddress(),
    current: emptyAddress(),
    sameAsRegistered: false,
    reviewed: false,
    consents: {},
    signMethod: 'typed',
    signName: '',
    signImage: '',
    signatureIntent: false,
    senderRelation: '',
    confirmed: false,
  };
}

/** ลายเซ็นและคำยืนยันผูกกับข้อมูล ณ ตอนลงนาม — ข้อมูลเปลี่ยนแล้วต้องลงนามใหม่ */
export function unsign(form: ApplicantForm): ApplicantForm {
  if (!form.signName && !form.signImage && !form.signatureIntent && !form.confirmed) return form;
  return { ...form, signName: '', signImage: '', signatureIntent: false, confirmed: false };
}

/** ข้อมูลบุคคล/ที่อยู่เปลี่ยน = ต้องตรวจเทียบกับภาพใหม่ และลงนามใหม่ */
const touched = (form: ApplicantForm): ApplicantForm => ({ ...unsign(form), reviewed: false });

export function editPerson(form: ApplicantForm, key: PersonFieldKey, value: string): ApplicantForm {
  const next = touched({ ...form, person: { ...form.person, [key]: value } });
  return key === 'nationalId' ? { ...next, nationalIdConfirmed: false } : next;
}

export const editForm = (form: ApplicantForm, patch: Partial<Pick<ApplicantForm, 'idLifetime' | 'licenseLifetime' | 'nationalIdConfirmed' | 'registered' | 'current' | 'sameAsRegistered'>>): ApplicantForm =>
  touched({ ...form, ...patch });

export const setConsent = (form: ApplicantForm, doc: DocId, value: string): ApplicantForm => ({ ...unsign(form), consents: { ...form.consents, [doc]: value } });

/** แนบภาพใหม่สำเร็จ — ช่องที่มาจากใบเดิมถูกล้าง รอผล OCR ของใบใหม่ */
export function setSlotFile(form: ApplicantForm, kind: UploadKind, file: DraftFileView, quality: string[]): ApplicantForm {
  const person = { ...form.person };
  let next = touched(form);
  if (kind === 'id') {
    for (const k of ID_KEYS) person[k] = '';
    next = { ...next, registered: emptyAddress(), idLifetime: false, nationalIdConfirmed: false };
  }
  if (kind === 'license') {
    for (const k of LICENSE_KEYS) person[k] = '';
    next = { ...next, licenseLifetime: false };
  }
  // ทะเบียนบ้านเป็นภาพประกอบ ไม่อ่าน OCR
  const slot: UploadSlot = { file, status: kind === 'house' ? 'manual' : 'reading', result: null, imageConfirmed: false, quality };
  return { ...next, person, slots: { ...form.slots, [kind]: slot } };
}

const defined = (fields: OcrFields): [keyof OcrFields, string][] =>
  (Object.entries(fields) as [keyof OcrFields, string | undefined][]).filter((e): e is [keyof OcrFields, string] => typeof e[1] === 'string' && e[1] !== '');

/** OCR ของภาพนี้เสร็จ (`result` = null คืออ่านไม่สำเร็จ) — ภาพถูกเปลี่ยนไปแล้ว = ทิ้งผล */
export function setSlotOcr(form: ApplicantForm, kind: UploadKind, fileId: string, result: OcrResult | null): ApplicantForm {
  const slot = form.slots[kind];
  if (!slot || slot.file.id !== fileId) return form;
  const slots = { ...form.slots, [kind]: { ...slot, status: result ? 'read' : 'manual', result } satisfies UploadSlot };
  if (!result) return { ...form, slots };
  const person = { ...form.person };
  let next = touched(form);
  if (kind === 'id') {
    for (const [k, v] of defined(result.fields)) if ((ID_KEYS as string[]).includes(k)) person[k as PersonFieldKey] = v;
    next = { ...next, registered: { ...result.address }, nationalIdConfirmed: false };
  } else if (kind === 'license') {
    for (const [k, v] of defined(result.fields)) {
      // เลข 13 หลักบนใบขับขี่เก็บแยก ใช้เทียบกับบัตรประชาชน — ไม่ทับเลขบัตร
      if (k === 'nationalId') person.licenseNationalId = v;
      else if ((LICENSE_KEYS as string[]).includes(k)) person[k as PersonFieldKey] = v;
    }
  }
  return { ...next, person, slots };
}

/** กด "อ่านอีกครั้ง" — ใบนี้กลับไปอยู่ระหว่างอ่าน (ปุ่มถัดไปรอจนอ่านเสร็จ) */
export function markSlotReading(form: ApplicantForm, kind: UploadKind): ApplicantForm {
  const slot = form.slots[kind];
  return slot ? { ...form, slots: { ...form.slots, [kind]: { ...slot, status: 'reading' } satisfies UploadSlot } } : form;
}

export function confirmSlotImage(form: ApplicantForm, kind: UploadKind, imageConfirmed: boolean): ApplicantForm {
  const slot = form.slots[kind];
  return slot ? { ...unsign(form), slots: { ...form.slots, [kind]: { ...slot, imageConfirmed } } } : form;
}

/** เลขบัตรบนบัตรประชาชนกับบนใบขับขี่ไม่ตรงกัน — แสดงให้เห็น ไม่แก้ให้เอง */
export const nationalIdConflict = (form: ApplicantForm): boolean =>
  Boolean(form.person.nationalId) && Boolean(form.person.licenseNationalId) && form.person.nationalId !== form.person.licenseNationalId;

export const needsNationalIdConfirm = (form: ApplicantForm): boolean => /^\d{13}$/.test(form.person.nationalId) && !isValidThaiNationalId(form.person.nationalId);

/** อายุเต็มปี ณ วันนี้ — คิดจากวันเกิด ไม่ให้กรอกซ้ำ */
export function ageOn(dob: string, today: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!m || !t) return null;
  const age = Number(t[1]) - Number(m[1]) - (`${t[2]}${t[3]}` < `${m[2]}${m[3]}` ? 1 : 0);
  return age >= 0 && age < 130 ? age : null;
}

export const fullName = (form: ApplicantForm): string => `${form.person.firstName.trim()} ${form.person.lastName.trim()}`.trim();

/** ปุ่ม "ถัดไป" ของขั้นนี้กดได้ไหม — คืนข้อความที่ต้องแก้ข้อแรก · ผ่าน = null */
export function stepError(form: ApplicantForm, step: number, ctx: { today: string; documents: readonly { id: string; title: string }[] }): string | null {
  if (step === 0) {
    if (!form.noticeAccepted) return 'ยอมรับข้อตกลงการใช้ข้อมูลก่อน';
    for (const kind of UPLOAD_KINDS) {
      const slot = form.slots[kind];
      if (!slot) return `แนบภาพ${UPLOAD_LABEL[kind]}`;
      // ภาพเบลอ · มืด · แสงสะท้อน = ไม่ให้ผ่าน ต้องถ่ายใหม่ (เจ้าของเคาะ 23 พ.ย. 2569 · เดิมเป็นแค่คำเตือน)
      if (slot.quality.length > 0) return `${UPLOAD_LABEL[kind]}: ${slot.quality[0]}`;
      if (slot.status === 'reading') return `รออ่านภาพ${UPLOAD_LABEL[kind]}ให้เสร็จ`;
      if (!slot.imageConfirmed) return `ตรวจภาพ${UPLOAD_LABEL[kind]}แล้วติ๊กยืนยัน`;
    }
    return null;
  }
  if (step === 1) {
    const p = form.person;
    for (const [key, label] of PERSON_FIELDS) if (!p[key].trim()) return `${key === 'prefix' || key === 'dob' ? 'เลือก' : 'กรอก'}${label}`;
    if (!/^\d{13}$/.test(p.nationalId)) return 'เลขบัตรประชาชนต้องมี 13 หลัก';
    if (needsNationalIdConfirm(form) && !form.nationalIdConfirmed) return 'เลขบัตรประชาชนไม่ผ่านการตรวจ เทียบกับบัตรแล้วติ๊กยืนยัน';
    if (!/^0\d{9}$/.test(p.phone)) return 'เบอร์มือถือต้องมี 10 หลัก ขึ้นต้นด้วย 0';
    if (p.dob >= ctx.today) return 'ตรวจวันเกิดอีกครั้ง';
    if (p.licenseNationalId && !/^\d{13}$/.test(p.licenseNationalId)) return 'เลขบัตรประชาชนบนใบขับขี่ต้องมี 13 หลัก';
    try {
      validateAddress(form.registered, 'ที่อยู่ตามทะเบียนบ้าน');
      if (!form.sameAsRegistered) validateAddress(form.current, 'ที่อยู่ปัจจุบัน');
    } catch (e) {
      return (e as Error).message;
    }
    if (!form.reviewed) return 'ตรวจข้อมูลเทียบกับภาพ แล้วติ๊กยืนยัน';
    return null;
  }
  if (step === 2) {
    for (const d of ctx.documents) if (!form.consents[d.id as DocId]) return `เลือกคำตอบของ${d.title}`;
    return null;
  }
  return null;
}

/** ชุดที่ส่งให้เซิร์ฟเวอร์ — รูปเดียวกับที่ `validatePacket` ตรวจ */
export function packetBody(form: ApplicantForm, state: Pick<ApplicantState, 'noticeVersion' | 'documents'>): Record<string, unknown> {
  const person: Record<string, unknown> = {};
  for (const k of PERSON_KEYS) if (form.person[k].trim()) person[k] = form.person[k].trim();
  if (form.idLifetime) person.idLifetime = true;
  if (form.licenseLifetime) person.licenseLifetime = true;
  if (form.nationalIdConfirmed) person.nationalIdConfirmed = true;
  return {
    version: DOCUMENT_FORM_VERSION,
    noticeAccepted: form.noticeAccepted,
    noticeVersion: state.noticeVersion,
    reviewed: form.reviewed,
    signatureIntent: form.signatureIntent,
    confirmed: form.confirmed,
    senderRelation: form.senderRelation,
    person,
    addresses: { registered: form.registered, current: form.sameAsRegistered ? form.registered : form.current, sameAsRegistered: form.sameAsRegistered },
    consents: form.consents,
    templates: Object.fromEntries(state.documents.map((d) => [d.id, d.hash])),
    signature: { method: form.signMethod, name: form.signName.trim().replace(/\s+/g, ' '), image: form.signMethod === 'drawn' ? form.signImage : '' },
    attachments: UPLOAD_KINDS.flatMap((kind) => (form.slots[kind] ? [{ id: form.slots[kind]!.file.id, kind }] : [])),
    ocr: Object.fromEntries(
      UPLOAD_KINDS.map((kind) => {
        const s = form.slots[kind];
        return [kind, { status: s?.status === 'read' ? 'read' : 'manual', imageConfirmed: s?.imageConfirmed === true, result: s?.status === 'read' ? s.result : null }];
      }),
    ),
  };
}

// ─── จำสิ่งที่กรอกไว้ในแท็บนี้ ─────────────────────────────────────────────────
// มือถือบางรุ่นปิดหน้าเว็บตอนเปิดกล้อง กลับมาแล้วหน้าโหลดใหม่ — ไม่ให้ผู้สมัครกรอกซ้ำ
// เก็บใน sessionStorage (หายเมื่อปิดแท็บ) · ไม่เก็บลายเซ็นและคำยืนยัน (ต้องทำใหม่ทุกครั้ง) · ไม่เก็บรหัสลิงก์

const DRAFT_PREFIX = 'jarvis-doc-draft:';
type SavedDraft = { v: string; step: number; form: ApplicantForm };

export function saveDraft(storage: Pick<Storage, 'setItem'> | null, k: string, step: number, form: ApplicantForm): void {
  if (!storage) return;
  const safe: ApplicantForm = { ...form, signName: '', signImage: '', signatureIntent: false, confirmed: false };
  try {
    storage.setItem(DRAFT_PREFIX + k, JSON.stringify({ v: DOCUMENT_FORM_VERSION, step: Math.min(step, FORM_STEPS.length - 1), form: safe } satisfies SavedDraft));
  } catch {
    /* ที่เก็บเต็ม/ถูกปิด — ไม่จำก็ยังกรอกต่อได้ */
  }
}

export function clearDraft(storage: Pick<Storage, 'removeItem'> | null, k: string): void {
  try {
    storage?.removeItem(DRAFT_PREFIX + k);
  } catch {
    /* ไม่มีอะไรให้ลบ */
  }
}

/**
 * อ่านสิ่งที่จำไว้ — ใช้ได้เฉพาะภาพที่เซิร์ฟเวอร์ยังถือเป็นฉบับร่างของลิงก์นี้ (ภาพที่ไม่ตรง = ทิ้งทั้งผล OCR ของใบนั้น)
 * คำตอบของเอกสารที่ต้นฉบับเปลี่ยนรุ่น/ไม่มีแล้ว = ทิ้ง ให้อ่านใหม่
 */
export function loadDraft(storage: Pick<Storage, 'getItem'> | null, state: Pick<ApplicantState, 'inviteKey' | 'drafts' | 'documents'>): { step: number; form: ApplicantForm } | null {
  let saved: SavedDraft | null = null;
  try {
    const raw = storage?.getItem(DRAFT_PREFIX + state.inviteKey);
    saved = raw ? (JSON.parse(raw) as SavedDraft) : null;
  } catch {
    saved = null;
  }
  const base = blankForm();
  if (!saved || saved.v !== DOCUMENT_FORM_VERSION || !saved.form || typeof saved.form !== 'object') {
    // ไม่มีอะไรจำไว้ แต่เซิร์ฟเวอร์มีภาพร่าง (เปิดจากเครื่องอื่น/แท็บใหม่) — เอาภาพมาให้ตรวจ ข้อมูลกรอกเอง
    if (!state.drafts.length) return null;
    for (const d of state.drafts) base.slots[d.kind] = { file: d, status: 'manual', result: null, imageConfirmed: false, quality: [] };
    return { step: 0, form: base };
  }
  const form: ApplicantForm = { ...base, ...saved.form, person: { ...base.person, ...saved.form.person }, signName: '', signImage: '', signatureIntent: false, confirmed: false, slots: {} };
  let lost = false;
  for (const kind of UPLOAD_KINDS) {
    const server = state.drafts.find((d) => d.kind === kind);
    const local = saved.form.slots?.[kind];
    if (server && local && local.file?.id === server.id) form.slots[kind] = { ...local, file: server, status: local.status === 'reading' ? 'manual' : local.status };
    else if (server) {
      form.slots[kind] = { file: server, status: 'manual', result: null, imageConfirmed: false, quality: [] };
      lost = true;
    } else if (local) lost = true;
  }
  const known = new Set(state.documents.map((d) => d.id));
  form.consents = Object.fromEntries(Object.entries(form.consents ?? {}).filter(([id, v]) => known.has(id as DocId) && DOC_TYPES.some((d) => d.id === id && d.answers.some((a) => a.value === v))));
  const complete = UPLOAD_KINDS.every((kind) => form.slots[kind]);
  return { step: lost || !complete ? 0 : Math.max(0, Math.min(Number(saved.step) || 0, FORM_STEPS.length - 1)), form: lost ? { ...form, reviewed: false } : form };
}
