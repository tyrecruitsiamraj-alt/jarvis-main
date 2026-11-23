/**
 * ข้อมูลจำลองของเทสต์ส่งเอกสารผ่าน LINE — ผู้ใช้ ใบสมัคร ต้นฉบับ และทางลัดเดินฟอร์มของผู้สมัคร
 * ทุกชื่อ/เบอร์/เลขบัตรเป็นของสมมติ
 */
import { randomUUID } from 'node:crypto';
import { HAS_DB, call, cookieOf, dataUrl, documentImage, fakeNationalId, mockLineToken, signaturePng, templatePage, type Json, type Reply } from './harness';
import { dbQuery } from '../../../api/_lib/postgres';
import { signAuthToken, AUTH_COOKIE_NAME } from '../../../api/_lib/auth';
import { resetRateLimitsForTests } from '../../../api/_lib/rateLimit';
import { T, clearDocumentSettingsCache } from '../../../api/_lib/documents/core';
import settingsHandler from '../../../api/_handlers/document-settings';
import invitationsHandler from '../../../api/_handlers/document-invitations';
import packetsHandler from '../../../api/_handlers/document-packets';
import notificationsHandler from '../../../api/_handlers/notifications';
import publicHandler from '../../../api/_handlers/public/applicant-documents';
import { DOC_IDS, DOCUMENT_FORM_VERSION, UPLOAD_KINDS, type UploadKind } from '../../../src/lib/documents/documentTypes';
import { OCR_ENGINE } from '../../../src/lib/documents/ocrFields';

export { HAS_DB, settingsHandler, invitationsHandler, packetsHandler, notificationsHandler, publicHandler };

export type TestUser = { id: string; email: string; role: string; cookie: string };

export async function resetAll(): Promise<void> {
  await dbQuery(
    `truncate ${T.imports}, ${T.outbox}, ${T.packets}, ${T.blobs}, ${T.files}, ${T.sessions}, ${T.events}, ${T.invitations},
              ${T.templatePages}, ${T.templates}, ${T.settings}, ${T.notifications} restart identity cascade`,
  );
  await dbQuery(`truncate jarvis_rm.audit_logs`);
  await dbQuery(`delete from ${T.applications}`);
  await dbQuery(`delete from ${T.users}`);
  clearDocumentSettingsCache();
  resetRateLimitsForTests();
}

export async function addUser(role: string, bu: string | null, opts: { active?: boolean; nickname?: string; extra?: string[] } = {}): Promise<TestUser> {
  const id = randomUUID();
  const email = `${role}-${id.slice(0, 8)}@example.test`;
  await dbQuery(
    `insert into ${T.users} (id, email, password_hash, role, full_name, is_active, department_code, nickname, extra_department_codes)
     values ($1, $2, 'x', $3, $4, $5, $6, $7, $8)`,
    [id, email, role, `ผู้ใช้ทดสอบ ${role}`, opts.active ?? true, bu, opts.nickname ?? `ทดสอบ-${role}`, opts.extra ?? []],
  );
  return { id, email, role, cookie: `${AUTH_COOKIE_NAME}=${signAuthToken({ sub: id, email, role: role as never })}` };
}

export async function addApplication(name: string, bu: string | null, opts: { jobId?: string | null; withCv?: boolean } = {}): Promise<string> {
  const { rows } = await dbQuery<{ id: string }>(
    `insert into ${T.applications} (full_name, phone, job_id, job_title, unit_name, department_code, document_filename, document_mime, document_size, document_bytes)
     values ($1, $2, $3, 'พนักงานขับรถ', 'หน่วยงานทดสอบ', $4, $5, $6, $7, $8) returning id`,
    [name, '0800000000', opts.jobId ?? null, bu, opts.withCv ? 'cv.pdf' : null, opts.withCv ? 'application/pdf' : null, opts.withCv ? 9 : null, opts.withCv ? Buffer.from('%PDF-test') : null],
  );
  return rows[0].id;
}

/** จำนวนหน้าต้นฉบับจำลองต่อเอกสาร = ของจริงในชุดที่ได้รับ (1 + 1 + 1 + 3 + 1 = 7 หน้า) */
export const TEMPLATE_PAGES: Record<string, number> = { background: 1, payroll: 1, privacy: 1, ex: 3, reputation: 1 };

export async function uploadTemplates(admin: TestUser, only?: string[]): Promise<void> {
  let seed = 3;
  for (const docType of DOC_IDS) {
    if (only && !only.includes(docType)) continue;
    const pages = Array.from({ length: TEMPLATE_PAGES[docType] }, () => templatePage(seed++).toString('base64'));
    const r = await call(settingsHandler, { method: 'POST', cookie: admin.cookie, body: { action: 'template', docType, pages } });
    if (r.status !== 201) throw new Error(`template ${docType}: ${r.status} ${JSON.stringify(r.json)}`);
  }
}

export async function enableFeature(admin: TestUser): Promise<void> {
  const r = await call(settingsHandler, { method: 'PUT', cookie: admin.cookie, body: { enabled: true } });
  if (r.status !== 200) throw new Error(`enable: ${r.status} ${JSON.stringify(r.json)}`);
}

export type World = { admin: TestUser; staffLbd: TestUser; staffLba: TestUser; supervisorLbd: TestUser; oplLbd: TestUser; appLbd: string; appLba: string };

/** โลกจำลองพื้นฐาน: ผู้ใช้ 5 คน ใบสมัคร 2 ใบ (LBD · LBA) ต้นฉบับครบ เปิดใช้แล้ว */
export async function world(): Promise<World> {
  await resetAll();
  const admin = await addUser('admin', null);
  const staffLbd = await addUser('staff', 'LBD', { nickname: 'เจ้าหน้าที่ LBD' });
  const staffLba = await addUser('staff', 'LBA', { nickname: 'เจ้าหน้าที่ LBA' });
  const supervisorLbd = await addUser('supervisor', 'LBD', { nickname: 'หัวหน้า LBD' });
  const oplLbd = await addUser('opl', 'LBD');
  await uploadTemplates(admin);
  await enableFeature(admin);
  const appLbd = await addApplication('สมมติ ทดลองระบบ', 'LBD', { withCv: true });
  const appLba = await addApplication('ตัวอย่าง ทดสอบเอกสาร', 'LBA');
  return { admin, staffLbd, staffLba, supervisorLbd, oplLbd, appLbd, appLba };
}

export const inviteOf = (url: string): string => new URL(url).searchParams.get('invite') ?? '';

export async function createLink(user: TestUser, applicationId: string): Promise<{ url: string; invite: string; invitationId: string; reply: Reply }> {
  const reply = await call(invitationsHandler, { method: 'POST', cookie: user.cookie, body: { applicationId } });
  if (reply.status !== 201) throw new Error(`createLink: ${reply.status} ${JSON.stringify(reply.json)}`);
  return { url: reply.json.url, invite: inviteOf(reply.json.url), invitationId: reply.json.invitationId, reply };
}

export type Opened = { cookie: string; k: string; state: Json; sub: string; reply: Reply };

export async function openLink(invite: string, lineName = 'Ty', opts: { sub?: string; picture?: string | null } = {}): Promise<Opened> {
  const line = mockLineToken(lineName, opts);
  const reply = await call(publicHandler, { method: 'POST', body: { action: 'session', invitation: invite, idToken: line.token } });
  return { cookie: cookieOf(reply), k: reply.json?.inviteKey, state: reply.json, sub: line.sub, reply };
}

export async function uploadKind(o: Opened, kind: string, bytes: Buffer): Promise<Reply> {
  return call(publicHandler, { method: 'POST', cookie: o.cookie, body: { action: 'upload', k: o.k, kind, dataBase64: bytes.toString('base64') } });
}

export async function uploadAll(o: Opened, seedBase = 10): Promise<{ id: string; kind: UploadKind }[]> {
  const out: { id: string; kind: UploadKind }[] = [];
  for (const [i, kind] of UPLOAD_KINDS.entries()) {
    const r = await uploadKind(o, kind, documentImage(seedBase + i));
    if (r.status !== 201) throw new Error(`upload ${kind}: ${r.status} ${JSON.stringify(r.json)}`);
    out.push({ id: r.json.id, kind });
  }
  return out;
}

const ADDRESS = { house: '99/1', moo: '', soi: '', road: '', provinceId: '1', districtId: '1001', subdistrictId: '100101', postalCode: '10200' };

export const ocrRead = (fields: Record<string, string> = {}) => ({
  status: 'read',
  imageConfirmed: true,
  result: { engine: OCR_ENGINE, confidence: 88, text: 'ข้อความจำลองจาก OCR', fields, address: { ...ADDRESS }, warnings: [], processedAt: '2026-11-22T03:00:00.000Z' },
});

/** ชุดเอกสารครบถ้วนพร้อมส่ง — แก้เฉพาะช่องที่เทสต์สนใจผ่าน `patch` */
export function packetBody(o: Opened, files: { id: string; kind: UploadKind }[], patch: (b: Json) => void = () => undefined): Json {
  const nationalId = fakeNationalId(1234567);
  const body = {
    action: 'submit',
    k: o.k,
    version: DOCUMENT_FORM_VERSION,
    noticeAccepted: true,
    noticeVersion: o.state.noticeVersion,
    reviewed: true,
    signatureIntent: true,
    confirmed: true,
    senderRelation: 'self',
    person: {
      prefix: 'นาย',
      firstName: 'ทดลอง',
      lastName: 'อ่านเอกสาร',
      dob: '1995-01-15',
      nationalId,
      phone: '0800000000',
      firstNameEn: 'Thodlong',
      lastNameEn: 'Anekkasan',
      idIssued: '2020-01-10',
      idExpiry: '2030-01-14',
      licenseNumber: '65001234',
      licenseNationalId: nationalId,
      licenseType: 'รถยนต์ส่วนบุคคล',
      licenseIssued: '2022-03-01',
      licenseExpiry: '2029-03-01',
    },
    addresses: { registered: { ...ADDRESS }, current: { ...ADDRESS }, sameAsRegistered: true },
    consents: { background: 'yes', payroll: 'ack', privacy: 'yes', ex: 'yes', reputation: 'yes' },
    templates: Object.fromEntries(o.state.documents.map((d: Json) => [d.id, d.hash])),
    signature: { method: 'drawn', name: 'ทดลอง อ่านเอกสาร', image: dataUrl(signaturePng()) },
    attachments: files,
    ocr: { id: ocrRead({ firstName: 'ทดลอง', lastName: 'อ่านเอกสาร', nationalId }), license: ocrRead({ licenseNumber: '65001234' }), house: { status: 'manual', imageConfirmed: true, result: null } },
  };
  patch(body);
  return body;
}

export async function submit(o: Opened, body: Json): Promise<Reply> {
  return call(publicHandler, { method: 'POST', cookie: o.cookie, body });
}

/** ทางลัด: สร้างลิงก์ → เปิด → แนบ 3 ภาพ → ส่ง · คืนทุกอย่างที่เทสต์ใช้ต่อ */
export async function fullSubmission(user: TestUser, applicationId: string, opts: { lineName?: string; patch?: (b: Json) => void; seedBase?: number } = {}) {
  const link = await createLink(user, applicationId);
  const opened = await openLink(link.invite, opts.lineName ?? 'Ty');
  const files = await uploadAll(opened, opts.seedBase ?? Math.floor(Math.random() * 100000) + 10);
  const body = packetBody(opened, files, opts.patch);
  const reply = await submit(opened, body);
  if (reply.status !== 201) throw new Error(`submit: ${reply.status} ${JSON.stringify(reply.json)}`);
  return { link, opened, files, body, packetId: reply.json.packetId as string, reply };
}

export const count = async (sql: string, params: unknown[] = []): Promise<number> => Number((await dbQuery<{ n: string }>(sql, params)).rows[0]?.n) || 0;
