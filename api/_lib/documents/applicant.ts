/**
 * ส่งเอกสารผ่าน LINE — ฝั่งผู้สมัคร: เปิดลิงก์ · แนบภาพ · ส่งชุด (เจ้าของ 22 พ.ย. 2569)
 *
 * ผู้สมัครไม่มีบัญชี Jarvis — สิทธิ์มาจาก 3 อย่างพร้อมกัน: รหัสลิงก์ (เจ้าหน้าที่ส่งให้) + บัญชี LINE ที่ LINE ยืนยัน + คุกกี้ของรอบนี้
 * - บัญชี LINE แรกที่เปิด = ผูกกับลิงก์ทันที (คำสั่งเดียวที่ฐาน บัญชีที่สองแพ้เสมอ ไม่เขียนทับ) และ HR เห็นชื่อ/รูป/เวลาเปิดตั้งแต่ตอนนั้น
 * - การเปิดลิงก์เป็นข้อมูลถาวรบนแถวลิงก์ + ตารางเหตุการณ์ ไม่หายเมื่อคุกกี้หมดอายุหรือถูกล้าง
 * - ภาพที่แนบเป็นฉบับร่าง (HR ยังไม่เห็นเป็นชุด) จนกดยืนยันส่ง · แนบใหม่ = แทนฉบับร่างเดิมของประเภทนั้น
 * - ส่งได้ 1 ชุดต่อลิงก์ ในธุรกรรมเดียว: ชุด + ภาพ + คิวแจ้งเตือน + เหตุการณ์ · กดซ้ำ/เน็ตหลุดแล้วส่งอีก = ได้ชุดเดิมกลับไป ไม่สร้างซ้ำ
 */
import type { PoolClient } from 'pg';
import { dbQuery, dbTransaction } from '../postgres.js';
import { isProductionLike, parseCookies } from '../auth.js';
import type { ApiReq } from '../http.js';
import { resolveClientIp, resolveUserAgent } from '../audit.js';
import {
  DocError,
  SESSION_TTL_HOURS,
  T,
  TOKEN_RE,
  bangkokToday,
  decryptBytes,
  decryptText,
  encryptBytes,
  encryptText,
  getDocumentSettings,
  inviteKeyOf,
  iso,
  listActiveTemplates,
  newToken,
  recordEvent,
  sha256Hex,
  type ActiveTemplate,
} from './core.js';
import { verifyLineIdToken, type VerifiedLineProfile } from './line.js';
import { checkDrawnSignature } from './signature.js';
import { dispatchOutboxSoon, enqueuePacketNotification } from './outbox.js';
import { DOC_TYPES, DOCUMENT_FORM_VERSION, isUploadKind, type DocId, type UploadKind } from '../../../src/lib/documents/documentTypes.js';
import { checkUploadBytes } from '../../../src/lib/documents/uploadValidation.js';
import { PacketError, computeAttention, stableStringify, validatePacket, type Packet } from '../../../src/lib/documents/packetValidation.js';
import { planDocumentPacketNotification } from '../../../src/lib/documents/documentNotification.js';
import { PDPA_CONSENT_VERSION } from '../../../src/lib/pdpaConsent.js';
import type { ApplicantDocumentView, ApplicantState, DraftFileView } from '../../../src/lib/documents/documentViews.js';

export type { ApplicantDocumentView, ApplicantState, DraftFileView };

export const SESSION_COOKIE = 'jarvis_doc_session';
export const SESSION_COOKIE_PATH = '/api/public/applicant-documents';
/** แนบได้กี่ครั้งต่อลิงก์ (รวมถ่ายใหม่) — กันยิงภาพเข้ามาไม่จำกัด */
export const MAX_UPLOADS_PER_INVITATION = 40;

export type InvitationRow = {
  id: string;
  application_id: string;
  job_id: string | null;
  job_label: string | null;
  department_code: string | null;
  applicant_name: string;
  revision: number;
  token_hash: string;
  created_by: string;
  created_by_name: string | null;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  claimed_line_user_id: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  line_verified_at: Date | null;
  first_opened_at: Date | null;
  last_opened_at: Date | null;
  open_count: number;
};

const NOT_FOUND = () => new DocError(404, 'invite_not_found', 'ไม่พบลิงก์นี้ ขอลิงก์ใหม่จากเจ้าหน้าที่ที่ส่งให้');
const REVOKED = () => new DocError(410, 'invite_revoked', 'ลิงก์นี้ถูกยกเลิกแล้ว ขอลิงก์ใหม่จากเจ้าหน้าที่ที่ส่งให้');
const EXPIRED = () => new DocError(410, 'invite_expired', 'ลิงก์หมดอายุแล้ว ขอลิงก์ใหม่จากเจ้าหน้าที่ที่ส่งให้');
const DISABLED = () => new DocError(503, 'documents_disabled', 'ระบบส่งเอกสารปิดอยู่ ติดต่อเจ้าหน้าที่ที่ส่งลิงก์นี้');

function assertUsable(inv: Pick<InvitationRow, 'revoked_at' | 'expires_at'>): void {
  if (inv.revoked_at) throw REVOKED();
  if (new Date(inv.expires_at).getTime() <= Date.now()) throw EXPIRED();
}

export async function findInvitationByToken(raw: unknown): Promise<InvitationRow> {
  if (typeof raw !== 'string' || !TOKEN_RE.test(raw)) throw NOT_FOUND();
  const { rows } = await dbQuery<InvitationRow>(`select * from ${T.invitations} where token_hash = $1`, [sha256Hex(raw)]);
  if (!rows[0]) throw NOT_FOUND();
  return rows[0];
}

// ─── สิ่งที่หน้าผู้สมัครต้องรู้ ───────────────────────────────────────────────

const documentViews = (templates: ActiveTemplate[]): ApplicantDocumentView[] =>
  DOC_TYPES.flatMap((d) => {
    const t = templates.find((x) => x.docType === d.id);
    return t ? [{ id: d.id, title: d.title, answers: d.answers.map((a) => ({ value: a.value, label: a.label })), pages: t.pageCount, hash: t.sha256 }] : [];
  });

async function stateOf(inv: InvitationRow, profile: { displayName: string; pictureUrl: string | null }): Promise<ApplicantState> {
  const [templates, drafts, packet] = await Promise.all([
    listActiveTemplates(),
    dbQuery<{ id: string; kind: string; mime: string; size: number; sha256: string }>(
      `select distinct on (kind) id, kind, mime, size, sha256 from ${T.files}
        where invitation_id = $1 and state = 'draft' order by kind, uploaded_at desc`,
      [inv.id],
    ),
    dbQuery<{ id: string; submitted_at: Date }>(`select id, submitted_at from ${T.packets} where invitation_id = $1`, [inv.id]),
  ]);
  return {
    inviteKey: inviteKeyOf(inv.token_hash),
    applicant: { name: inv.applicant_name, jobLabel: inv.job_label, bu: inv.department_code },
    profile,
    expiresAt: new Date(inv.expires_at).toISOString(),
    formVersion: DOCUMENT_FORM_VERSION,
    noticeVersion: PDPA_CONSENT_VERSION,
    documents: documentViews(templates),
    drafts: packet.rows[0] ? [] : drafts.rows.filter((r) => isUploadKind(r.kind)).map((r) => ({ ...r, kind: r.kind as UploadKind })),
    submitted: packet.rows[0] ? { packetId: packet.rows[0].id, submittedAt: new Date(packet.rows[0].submitted_at).toISOString() } : null,
  };
}

// ─── เปิดลิงก์ ───────────────────────────────────────────────────────────────
export type OpenResult = { state: ApplicantState; cookie: string };

function sessionCookie(raw: string, maxAgeSeconds: number): string {
  const secure = isProductionLike() ? 'Secure; ' : '';
  return `${SESSION_COOKIE}=${raw}; Path=${SESSION_COOKIE_PATH}; HttpOnly; ${secure}SameSite=Lax; Max-Age=${Math.max(1, Math.floor(maxAgeSeconds))}`;
}

/**
 * ผู้สมัครเปิดลิงก์: ตรวจลิงก์ → LINE ยืนยันบัญชี → ผูกบัญชีกับลิงก์ + จดการเปิด (ธุรกรรมเดียว) → ออกคุกกี้ของรอบนี้
 * `fetcher` = ตัวเรียก LINE (เทสต์ใส่ตัวจำลอง)
 */
export async function openInvitation(rawToken: unknown, idToken: unknown, fetcher: typeof fetch = fetch): Promise<OpenResult> {
  const inv = await findInvitationByToken(rawToken);
  assertUsable(inv);
  const settings = await getDocumentSettings();
  if (!settings.enabled) throw DISABLED();
  const profile: VerifiedLineProfile = await verifyLineIdToken(idToken, settings.lineChannelId, fetcher);

  const rawSession = newToken();
  const opened = await dbTransaction(async (client) => {
    // ผูกบัญชีแรกแบบคำสั่งเดียว — สองบัญชีเปิดพร้อมกัน ฐานให้ผ่านได้บัญชีเดียว
    const { rows } = await client.query<InvitationRow & { was_new: boolean }>(
      `update ${T.invitations} i
          set claimed_line_user_id = $2, line_display_name = $3, line_picture_url = $4, line_verified_at = now(),
              first_opened_at = coalesce(i.first_opened_at, now()), last_opened_at = now(), open_count = i.open_count + 1
        where i.id = $1 and (i.claimed_line_user_id is null or i.claimed_line_user_id = $2)
          and i.revoked_at is null and i.expires_at > now()
        returning i.*, (i.open_count = 1) as was_new`,
      [inv.id, profile.userId, profile.displayName, profile.pictureUrl],
    );
    const row = rows[0];
    if (!row) return null;
    await recordEvent(client, {
      invitationId: inv.id,
      applicationId: inv.application_id,
      type: row.was_new ? 'opened' : 'reopened',
      actorType: 'applicant',
      actorId: profile.userId,
      actorName: profile.displayName,
      detail: { hasPicture: Boolean(profile.pictureUrl) },
    });
    const expiresAt = new Date(Math.min(new Date(row.expires_at).getTime(), Date.now() + SESSION_TTL_HOURS * 3_600_000));
    await client.query(
      `insert into ${T.sessions} (token_hash, invitation_id, line_user_id, expires_at) values ($1, $2, $3, $4)`,
      [sha256Hex(rawSession), inv.id, profile.userId, expiresAt],
    );
    return { row, expiresAt };
  });

  if (!opened) {
    // อ่านซ้ำว่าแพ้เพราะอะไร: ถูกยกเลิก/หมดอายุระหว่างทาง หรือผูกกับบัญชีอื่นไปแล้ว
    const { rows } = await dbQuery<InvitationRow>(`select * from ${T.invitations} where id = $1`, [inv.id]);
    if (rows[0]) assertUsable(rows[0]);
    await recordEvent(null, {
      invitationId: inv.id,
      applicationId: inv.application_id,
      type: 'account_conflict',
      actorType: 'applicant',
      actorId: profile.userId,
      actorName: profile.displayName,
    }).catch(() => undefined);
    throw new DocError(409, 'account_conflict', 'ลิงก์นี้ผูกกับ LINE บัญชีอื่นแล้ว ติดต่อเจ้าหน้าที่ที่ส่งลิงก์เพื่อขอลิงก์ใหม่');
  }
  return {
    state: await stateOf(opened.row, { displayName: profile.displayName, pictureUrl: profile.pictureUrl }),
    cookie: sessionCookie(rawSession, (opened.expiresAt.getTime() - Date.now()) / 1000),
  };
}

// ─── คุกกี้ของรอบนี้ ──────────────────────────────────────────────────────────
export type ApplicantContext = { invitation: InvitationRow; lineUserId: string; sessionHash: string };

const LOGIN_AGAIN = () => new DocError(401, 'applicant_login_required', 'เวลาเข้าใช้งานหมดแล้ว เปิดลิงก์จาก LINE อีกครั้ง');

/**
 * อ่านสิทธิ์จากคุกกี้ — ทุกคำขอของผู้สมัครผ่านที่นี่: รอบยังไม่หมดอายุ · ลิงก์ยังใช้ได้ · บัญชี LINE ของรอบ = บัญชีที่ผูกกับลิงก์
 * `inviteKey` (ถ้าส่งมา) ต้องตรงกับลิงก์ของรอบ — เปิดสองลิงก์ในเครื่องเดียวแล้วไม่สลับกัน
 */
export async function loadApplicantContext(req: ApiReq, inviteKey?: string | null): Promise<ApplicantContext> {
  const raw = req.headers?.cookie;
  const token = parseCookies(Array.isArray(raw) ? raw.join('; ') : raw)[SESSION_COOKIE];
  if (!token || !TOKEN_RE.test(token)) throw LOGIN_AGAIN();
  const sessionHash = sha256Hex(token);
  const { rows } = await dbQuery<InvitationRow & { s_line_user_id: string; s_expires_at: Date; s_revoked_at: Date | null }>(
    `select i.*, s.line_user_id as s_line_user_id, s.expires_at as s_expires_at, s.revoked_at as s_revoked_at
       from ${T.sessions} s join ${T.invitations} i on i.id = s.invitation_id
      where s.token_hash = $1`,
    [sessionHash],
  );
  const row = rows[0];
  if (!row || row.s_revoked_at || new Date(row.s_expires_at).getTime() <= Date.now()) throw LOGIN_AGAIN();
  if (row.claimed_line_user_id !== row.s_line_user_id) throw LOGIN_AGAIN();
  assertUsable(row);
  if (inviteKey !== undefined && inviteKey !== null && inviteKey !== inviteKeyOf(row.token_hash)) {
    throw new DocError(403, 'invite_mismatch', 'ลิงก์ไม่ตรงกับที่เปิดอยู่ เปิดลิงก์จาก LINE อีกครั้ง');
  }
  return { invitation: row, lineUserId: row.s_line_user_id, sessionHash };
}

export async function applicantStateOf(ctx: ApplicantContext): Promise<ApplicantState> {
  const inv = ctx.invitation;
  return stateOf(inv, { displayName: inv.line_display_name ?? '', pictureUrl: inv.line_picture_url });
}

// ─── ที่เก็บภาพ (เข้ารหัสในฐาน) — เปลี่ยนที่เก็บภายหลังได้โดยแก้สามฟังก์ชันนี้ ───────
type Runner = PoolClient | null;
const run = (client: Runner) => (sql: string, params?: unknown[]) => (client ? client.query(sql, params) : dbQuery(sql, params));

export async function putBlob(client: Runner, fileId: string, bytes: Uint8Array): Promise<void> {
  const enc = encryptBytes(bytes);
  await run(client)(`insert into ${T.blobs} (file_id, key_id, bytes) values ($1, $2, $3)`, [fileId, enc.keyId, enc.bytes]);
}

export async function getBlob(fileId: string): Promise<Buffer | null> {
  const { rows } = await dbQuery<{ key_id: string; bytes: Buffer }>(`select key_id, bytes from ${T.blobs} where file_id = $1`, [fileId]);
  return rows[0] ? decryptBytes(rows[0].bytes, rows[0].key_id) : null;
}

export async function removeBlobs(client: Runner, fileIds: string[]): Promise<void> {
  if (fileIds.length) await run(client)(`delete from ${T.blobs} where file_id = any($1::uuid[])`, [fileIds]);
}

// ─── แนบภาพ ──────────────────────────────────────────────────────────────────
const ALREADY_SENT = () => new DocError(409, 'already_sent', 'ส่งเอกสารชุดนี้ไปแล้ว ถ้าต้องแก้ไข ขอลิงก์ใหม่จากเจ้าหน้าที่');

export async function saveDraftUpload(ctx: ApplicantContext, kind: unknown, bytes: Uint8Array): Promise<DraftFileView> {
  if (!isUploadKind(kind)) throw new DocError(400, 'bad_request', 'เลือกประเภทเอกสารที่จะแนบ');
  const check = checkUploadBytes(bytes);
  if (check.ok === false) throw new DocError(check.status, 'invalid_image', check.message);
  const inv = ctx.invitation;
  const sha256 = sha256Hex(bytes);
  return dbTransaction(async (client) => {
    // ล็อกแถวลิงก์ — แนบพร้อมกันสองคำขอ/แนบชนกับการกดส่ง เรียงทีละอัน
    const { rows: locked } = await client.query<InvitationRow>(`select * from ${T.invitations} where id = $1 for update`, [inv.id]);
    if (!locked[0]) throw NOT_FOUND();
    assertUsable(locked[0]);
    const { rows: sent } = await client.query(`select 1 from ${T.packets} where invitation_id = $1`, [inv.id]);
    if (sent[0]) throw ALREADY_SENT();
    const { rows: n } = await client.query<{ n: string }>(`select count(*) as n from ${T.files} where invitation_id = $1`, [inv.id]);
    if (Number(n[0]?.n) >= MAX_UPLOADS_PER_INVITATION) {
      throw new DocError(429, 'too_many_uploads', 'แนบภาพหลายครั้งเกินไป ขอลิงก์ใหม่จากเจ้าหน้าที่');
    }
    // ภาพใหม่แทนฉบับร่างเดิมของประเภทเดียวกัน (ตัวภาพเดิมลบทิ้ง เหลือแถวไว้เป็นประวัติ)
    const { rows: old } = await client.query<{ id: string }>(
      `update ${T.files} set state = 'discarded', discarded_at = now()
        where invitation_id = $1 and kind = $2 and state = 'draft' returning id`,
      [inv.id, kind],
    );
    await removeBlobs(client, old.map((r) => r.id));
    const { rows } = await client.query<{ id: string }>(
      `insert into ${T.files} (invitation_id, application_id, kind, mime, size, sha256, width, height, line_user_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [inv.id, inv.application_id, kind, check.mime, bytes.length, sha256, check.width, check.height, ctx.lineUserId],
    );
    await putBlob(client, rows[0].id, bytes);
    await recordEvent(client, {
      invitationId: inv.id,
      applicationId: inv.application_id,
      type: old.length ? 'file_replaced' : 'file_uploaded',
      actorType: 'applicant',
      actorId: ctx.lineUserId,
      detail: { kind, size: bytes.length },
    });
    return { id: rows[0].id, kind, mime: check.mime, size: bytes.length, sha256 };
  });
}

/** ภาพของลิงก์นี้เท่านั้น (ฉบับร่างหรือที่ส่งแล้ว) — รหัสไฟล์ของลิงก์อื่น = ไม่พบ */
export async function applicantFile(ctx: ApplicantContext, fileId: unknown): Promise<{ mime: string; kind: string; bytes: Buffer }> {
  const missing = new DocError(404, 'not_found', 'ไม่พบภาพของลิงก์นี้');
  if (typeof fileId !== 'string' || !/^[0-9a-f-]{36}$/i.test(fileId)) throw missing;
  const { rows } = await dbQuery<{ mime: string; kind: string }>(
    `select mime, kind from ${T.files}
      where id = $1 and invitation_id = $2 and line_user_id = $3 and state in ('draft', 'committed')`,
    [fileId, ctx.invitation.id, ctx.lineUserId],
  );
  if (!rows[0]) throw missing;
  const bytes = await getBlob(fileId);
  if (!bytes) throw missing;
  return { ...rows[0], bytes };
}

// ─── ส่งชุดเอกสาร ─────────────────────────────────────────────────────────────
export type StoredPayload = Packet & {
  files: DraftFileView[];
  attention: ReturnType<typeof computeAttention>;
  line: { userId: string; displayName: string; pictureUrl: string | null; verifiedAt: string; senderRelation: string };
};

export type SubmitResult = { packetId: string; submittedAt: string; already: boolean };

const personName = (p: Packet['person']): string =>
  `${p.prefix === 'อื่น ๆ' ? '' : p.prefix}${p.firstName} ${p.lastName}`.trim();

/**
 * รับชุดเอกสาร — ตรวจทุกอย่างที่เซิร์ฟเวอร์ แล้วบันทึกชุด + คิวแจ้งเตือนในธุรกรรมเดียว
 * คืนรหัสชุดเมื่อบันทึกยืนยันแล้วเท่านั้น · ชุดเดิมถูกส่งซ้ำ (แฮชเท่ากัน บัญชีเดิม) = คืนชุดเดิม
 */
export async function submitPacket(ctx: ApplicantContext, body: unknown, req: ApiReq): Promise<SubmitResult> {
  const inv = ctx.invitation;
  const templates = await listActiveTemplates();
  const today = bangkokToday();
  let packet: Packet;
  try {
    packet = validatePacket(body, {
      today,
      noticeVersion: PDPA_CONSENT_VERSION,
      templates: Object.fromEntries(templates.map((t) => [t.docType, t.sha256])),
    });
  } catch (e) {
    if (e instanceof PacketError) throw new DocError(e.status, e.code, e.message);
    throw e;
  }
  const signature =
    packet.signature.method === 'drawn'
      ? checkDrawnSignature(packet.signature.image)
      : { sha256: sha256Hex(`typed:${packet.signature.name}`) };
  const payloadHash = sha256Hex(stableStringify(packet));
  const attention = computeAttention(packet, today);

  const result = await dbTransaction(async (client) => {
    const { rows: locked } = await client.query<InvitationRow>(`select * from ${T.invitations} where id = $1 for update`, [inv.id]);
    const row = locked[0];
    if (!row) throw NOT_FOUND();
    const { rows: existing } = await client.query<{ id: string; payload_hash: string; line_user_id: string; submitted_at: Date }>(
      `select id, payload_hash, line_user_id, submitted_at from ${T.packets} where invitation_id = $1`,
      [inv.id],
    );
    if (existing[0]) {
      if (existing[0].payload_hash === payloadHash && existing[0].line_user_id === ctx.lineUserId) {
        return { packetId: existing[0].id, submittedAt: new Date(existing[0].submitted_at).toISOString(), already: true };
      }
      throw ALREADY_SENT();
    }
    assertUsable(row);
    if (row.claimed_line_user_id !== ctx.lineUserId) throw LOGIN_AGAIN();

    // ภาพที่อ้างต้องเป็นฉบับร่างของลิงก์นี้ บัญชีนี้ และตรงประเภท
    const { rows: files } = await client.query<{ id: string; kind: string; mime: string; size: number; sha256: string }>(
      `select id, kind, mime, size, sha256 from ${T.files}
        where id = any($1::uuid[]) and invitation_id = $2 and line_user_id = $3 and state = 'draft'`,
      [packet.attachments.map((a) => a.id), inv.id, ctx.lineUserId],
    );
    const picked: DraftFileView[] = [];
    for (const a of packet.attachments) {
      const f = files.find((x) => x.id === a.id);
      if (!f || f.kind !== a.kind) throw new DocError(400, 'attachment_mismatch', 'ภาพที่แนบไม่ตรงกับลิงก์นี้ แนบภาพใหม่แล้วส่งอีกครั้ง');
      picked.push({ id: f.id, kind: a.kind, mime: f.mime, size: f.size, sha256: f.sha256 });
    }
    if (new Set(picked.map((f) => f.sha256)).size !== picked.length) {
      throw new DocError(400, 'duplicate_images', 'ภาพที่แนบซ้ำกัน ตรวจว่าแนบบัตร ใบขับขี่ และทะเบียนบ้านเป็นคนละภาพ');
    }

    const stored: StoredPayload = {
      ...packet,
      files: picked,
      attention,
      line: {
        userId: ctx.lineUserId,
        displayName: row.line_display_name ?? '',
        pictureUrl: row.line_picture_url,
        verifiedAt: iso(row.line_verified_at) ?? new Date().toISOString(),
        senderRelation: packet.senderRelation,
      },
    };
    const enc = encryptText(JSON.stringify(stored));
    const templateVersions = Object.fromEntries(
      templates.map((t) => [t.docType, { id: t.id, version: t.version, sha256: t.sha256, pages: t.pageCount }]),
    );
    const { rows: ins } = await client.query<{ id: string; submitted_at: Date }>(
      `insert into ${T.packets}
         (invitation_id, application_id, job_id, job_label, department_code, revision, form_version, notice_version,
          template_versions, person_name, payload_enc, payload_key_id, payload_hash, signature_method, signature_hash,
          attention, line_user_id, line_display_name, line_picture_url, line_verified_at, sender_relation, client_ip, user_agent)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20, $21, $22, $23)
       returning id, submitted_at`,
      [
        inv.id,
        inv.application_id,
        row.job_id,
        row.job_label,
        row.department_code,
        row.revision,
        packet.version,
        packet.noticeVersion,
        JSON.stringify(templateVersions),
        personName(packet.person),
        enc.text,
        enc.keyId,
        payloadHash,
        packet.signature.method,
        signature.sha256,
        JSON.stringify(attention),
        ctx.lineUserId,
        stored.line.displayName,
        stored.line.pictureUrl,
        stored.line.verifiedAt,
        packet.senderRelation,
        resolveClientIp(req),
        (resolveUserAgent(req) ?? '').slice(0, 300) || null,
      ],
    );
    const packetId = ins[0].id;
    const ids = picked.map((f) => f.id);
    await client.query(`update ${T.files} set state = 'committed', committed_at = now(), packet_id = $2 where id = any($1::uuid[])`, [ids, packetId]);
    // ฉบับร่างที่ไม่ได้อยู่ในชุด (ถ่ายใหม่แล้วไม่ใช้) — ไม่ให้ค้างเป็นภาพกำพร้า
    const { rows: leftovers } = await client.query<{ id: string }>(
      `update ${T.files} set state = 'discarded', discarded_at = now() where invitation_id = $1 and state = 'draft' returning id`,
      [inv.id],
    );
    await removeBlobs(client, leftovers.map((r) => r.id));
    const plan = planDocumentPacketNotification({
      committed: true,
      packetId,
      applicationId: inv.application_id,
      createdByUserId: row.created_by,
      applicantName: row.applicant_name,
      requestLabel: row.job_label ?? '',
    });
    if (plan) await enqueuePacketNotification(client, plan, packetId);
    await recordEvent(client, {
      invitationId: inv.id,
      applicationId: inv.application_id,
      packetId,
      type: 'submitted',
      actorType: 'applicant',
      actorId: ctx.lineUserId,
      actorName: stored.line.displayName,
      detail: { senderRelation: packet.senderRelation, attention: attention.length },
    });
    return { packetId, submittedAt: new Date(ins[0].submitted_at).toISOString(), already: false };
  });

  // ชุดอยู่ในฐานแล้ว — ลองแจ้งทันที (ล้มไม่เป็นไร คิวยังอยู่)
  if (!result.already) void dispatchOutboxSoon();
  return result;
}

/** ใบรับของผู้สมัคร — เห็นเฉพาะชุดของลิงก์ตัวเอง */
export async function applicantReceipt(ctx: ApplicantContext): Promise<{ packetId: string; submittedAt: string; personName: string; consents: Record<string, string> } | null> {
  const { rows } = await dbQuery<{ id: string; submitted_at: Date; person_name: string; payload_enc: string; payload_key_id: string }>(
    `select id, submitted_at, person_name, payload_enc, payload_key_id from ${T.packets}
      where invitation_id = $1 and line_user_id = $2 and erased_at is null`,
    [ctx.invitation.id, ctx.lineUserId],
  );
  const r = rows[0];
  if (!r) return null;
  const payload = JSON.parse(decryptText(r.payload_enc, r.payload_key_id)) as StoredPayload;
  return { packetId: r.id, submittedAt: new Date(r.submitted_at).toISOString(), personName: r.person_name, consents: payload.consents };
}
