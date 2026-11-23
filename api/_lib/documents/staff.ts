/**
 * ส่งเอกสารผ่าน LINE — ฝั่งเจ้าหน้าที่: สร้าง/ยกเลิกลิงก์ · รายการ · รายละเอียดชุด · ไฟล์ · สิ่งที่ HR ทำกับชุด (เจ้าของ 22 พ.ย. 2569)
 *
 * สิทธิ์: ทุกฟังก์ชันตรวจที่เซิร์ฟเวอร์ด้วยด่านเดียวกับใบสมัคร (BU ของผู้ใช้ · `isApplicationInWriteScope`) —
 * รู้รหัสใบสมัคร/ชุด/ไฟล์ของ BU อื่นก็เปิดไม่ได้ · ไม่มีสิทธิ์ = ตอบก่อนอ่านข้อมูลในชุด
 * HR เห็นเฉพาะภาพที่อยู่ในชุดที่ส่งแล้ว — ฉบับร่างของผู้สมัครไม่ถูกเสิร์ฟให้เจ้าหน้าที่
 * ชุดที่ส่งแล้วแก้ไม่ได้: HR ทำได้แค่ ติดธงขอให้แก้ / รับทราบเรื่องที่ต้องดู / นำเข้า — ทั้งหมดจดเหตุการณ์
 */
import type { UserRole } from '../auth.js';
import { dbQuery, dbTransaction, isPgUniqueViolation } from '../postgres.js';
import { isApplicationInWriteScope } from '../applicationScope.js';
import { loadScopedJobIdSet } from '../siamrajUnitRequests.js';
import { loadUserDepartmentScope } from '../departmentScope.js';
import {
  DocError,
  LINK_TTL_HOURS,
  T,
  decryptText,
  documentReadiness,
  getDocumentSettings,
  iso,
  newToken,
  recordEvent,
  sha256Hex,
} from './core.js';
import { getBlob, type InvitationRow, type StoredPayload } from './applicant.js';
import {
  DOC_TYPES,
  PERSON_LABEL,
  UPLOAD_LABEL,
  answerLabel,
  attentionText,
  isIrecruitDivision,
  type AttentionItem,
  type UploadKind,
} from '../../../src/lib/documents/documentTypes.js';
import { documentStatusOf, isDocumentStatus, type DocumentStatus } from '../../../src/lib/documents/documentStatus.js';
import { PDPA_ERASED_NAME } from '../../../src/lib/pdpaRequests.js';
import type {
  CreatedInvitation,
  DocumentDetail,
  DocumentList,
  ImportAttemptView,
  InvitationView,
  PacketView,
} from '../../../src/lib/documents/documentViews.js';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../../src/lib/pagination.js';

export type { CreatedInvitation, DocumentDetail, DocumentList, ImportAttemptView, InvitationView, PacketView };

export type StaffUser = { sub: string; role: UserRole; email: string };
export type Actor = { id: string; name: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = (what = 'ไม่พบใบสมัครนี้') => new DocError(404, 'not_found', what);
const FORBIDDEN = () => new DocError(403, 'forbidden', 'ไม่มีสิทธิ์เข้าถึงใบสมัครของแผนกอื่น');

type ApplicationRow = {
  id: string;
  full_name: string;
  job_id: string | null;
  job_title: string | null;
  unit_name: string | null;
  department_code: string | null;
  created_by_name: string | null;
};

/** โหลดใบสมัคร + ตรวจสิทธิ์ BU — ผ่านด่านนี้ก่อนเสมอ ค่อยอ่านข้อมูลเอกสาร */
async function scopedApplication(user: StaffUser, applicationId: unknown): Promise<ApplicationRow> {
  if (typeof applicationId !== 'string' || !UUID.test(applicationId)) throw NOT_FOUND();
  const { rows } = await dbQuery<ApplicationRow>(
    `select id, full_name, job_id, job_title, unit_name, department_code, created_by_name from ${T.applications} where id = $1`,
    [applicationId],
  );
  if (!rows[0]) throw NOT_FOUND();
  if (!(await isApplicationInWriteScope(user, rows[0]))) throw FORBIDDEN();
  return rows[0];
}

const jobLabelOf = (a: ApplicationRow): string | null => [a.unit_name, a.job_title].map((v) => (v || '').trim()).filter(Boolean).join(' · ') || null;

// ─── สร้าง / ยกเลิกลิงก์ ──────────────────────────────────────────────────────

/**
 * กด "ส่งเอกสาร" — ได้ลิงก์เฉพาะใบสมัครนี้ ให้เจ้าหน้าที่คัดลอกไปส่ง LINE เอง (ระบบไม่ส่งข้อความ LINE ให้)
 * รหัสลิงก์สุ่ม 32 ไบต์ ฐานเก็บแค่แฮช · ลิงก์เดิมที่ยังไม่หมดอายุยังใช้ได้ (ไม่ตัดของที่อาจส่งไปแล้ว) — ยกเลิกเองได้ที่ปุ่มยกเลิกลิงก์
 */
export async function createInvitation(user: StaffUser, actor: Actor, applicationId: unknown, origin: string): Promise<CreatedInvitation> {
  const app = await scopedApplication(user, applicationId);
  const readiness = await documentReadiness();
  if (!readiness.enabled) throw new DocError(409, 'documents_disabled', 'ระบบส่งเอกสารปิดอยู่ เปิดที่ ตั้งค่า › ส่งเอกสารผ่าน LINE');
  if (!readiness.ready) throw new DocError(409, 'documents_not_ready', readiness.problems[0] ?? 'ระบบส่งเอกสารยังตั้งค่าไม่ครบ');
  if (app.full_name === PDPA_ERASED_NAME) throw new DocError(409, 'erased', 'ใบสมัครนี้ถูกลบข้อมูลตามคำขอแล้ว');
  const settings = await getDocumentSettings();
  const raw = newToken();
  const row = await dbTransaction(async (client) => {
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`document_invitation:${app.id}`]);
    const { rows: last } = await client.query<{ r: number | null }>(`select max(revision) as r from ${T.invitations} where application_id = $1`, [app.id]);
    const { rows } = await client.query<{ id: string; revision: number; expires_at: Date }>(
      `insert into ${T.invitations}
         (application_id, job_id, job_label, department_code, applicant_name, revision, token_hash, created_by, created_by_name, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + make_interval(hours => $10::int))
       returning id, revision, expires_at`,
      [app.id, app.job_id, jobLabelOf(app), (app.department_code || '').trim().toUpperCase() || null, app.full_name, (last[0]?.r ?? 0) + 1, sha256Hex(raw), actor.id, actor.name, LINK_TTL_HOURS],
    );
    await recordEvent(client, { invitationId: rows[0].id, applicationId: app.id, type: 'link_created', actorType: 'staff', actorId: actor.id, actorName: actor.name });
    return rows[0];
  });
  // ลิงก์ LIFF เปิดในแอป LINE แล้ว LINE ยืนยันบัญชีให้ · เครื่องทดสอบ (บัญชีจำลอง) ใช้ลิงก์ตรงของหน้าเว็บ
  const url = readiness.mock && !settings.liffId
    ? `${origin}/apply/documents?invite=${raw}`
    : `https://liff.line.me/${settings.liffId}?invite=${raw}`;
  return { invitationId: row.id, revision: row.revision, url, expiresAt: new Date(row.expires_at).toISOString() };
}

export async function revokeInvitation(user: StaffUser, actor: Actor, invitationId: unknown): Promise<{ applicationId: string }> {
  if (typeof invitationId !== 'string' || !UUID.test(invitationId)) throw NOT_FOUND('ไม่พบลิงก์นี้');
  const { rows } = await dbQuery<{ application_id: string }>(`select application_id from ${T.invitations} where id = $1`, [invitationId]);
  if (!rows[0]) throw NOT_FOUND('ไม่พบลิงก์นี้');
  await scopedApplication(user, rows[0].application_id);
  await dbTransaction(async (client) => {
    const { rows: done } = await client.query<{ id: string }>(
      `update ${T.invitations} i set revoked_at = now(), revoked_by = $2, revoked_by_name = $3
        where i.id = $1 and i.revoked_at is null
          and not exists (select 1 from ${T.packets} p where p.invitation_id = i.id)
        returning i.id`,
      [invitationId, actor.id, actor.name],
    );
    if (!done[0]) throw new DocError(409, 'cannot_revoke', 'ลิงก์นี้ยกเลิกไปแล้ว หรือส่งเอกสารแล้ว');
    // คุกกี้ของรอบที่เปิดค้างไว้ใช้ต่อไม่ได้ทันที
    await client.query(`update ${T.sessions} set revoked_at = now() where invitation_id = $1 and revoked_at is null`, [invitationId]);
    await recordEvent(client, { invitationId, applicationId: rows[0].application_id, type: 'link_revoked', actorType: 'staff', actorId: actor.id, actorName: actor.name });
  });
  return { applicationId: rows[0].application_id };
}

// ─── รายการ ──────────────────────────────────────────────────────────────────
/** ตัวตัดสินสถานะฝั่งฐาน — ต้องให้ผลเท่ากับ `documentStatusOf` (src/lib/documents/documentStatus.ts) */
export const DOCUMENT_STATUS_SQL = `case
  when p.id is not null and not (l.id <> p.invitation_id and l.created_at > p.submitted_at and l.revoked_at is null and l.expires_at > now()) then
    case when exists (select 1 from ${T.imports} x where x.packet_id = p.id and x.status = 'success') then 'imported'
         when p.review_flag or (jsonb_array_length(p.attention) > 0 and p.attention_ack_at is null) then 'needs_fix'
         else 'ready' end
  when l.revoked_at is not null then 'link_revoked'
  when l.expires_at <= now() then 'link_expired'
  when l.first_opened_at is not null then 'opened'
  else 'not_opened'
end`;

/** เงื่อนไขสิทธิ์ BU ของใบสมัคร (alias a) — ตัวเดียวกับรายการใบสมัคร (`buildApplicationsListQuery`) */
async function scopeSql(user: StaffUser, params: unknown[]): Promise<string> {
  const scopedJobIds = await loadScopedJobIdSet(user);
  if (!scopedJobIds) return 'true';
  const dept = await loadUserDepartmentScope(user);
  params.push([...scopedJobIds]);
  const byJob = `a.job_id = any($${params.length}::text[])`;
  if (dept.mode !== 'code') return byJob;
  params.push(dept.codes);
  return `(${byJob} or upper(btrim(a.department_code)) = any($${params.length}::text[])
           or (a.created_by_name = 'iRecruit' and a.job_id is null and nullif(btrim(a.department_code), '') is null))`;
}



/** ต่อหน้าชุดเดียวกับรายการอื่นทั้งระบบ (`ListPaginationBar`) */
export const DOCUMENT_PAGE_SIZES = PAGE_SIZE_OPTIONS;

export async function listDocuments(
  user: StaffUser,
  query: { page?: unknown; pageSize?: unknown; status?: unknown; q?: unknown; bu?: unknown },
): Promise<DocumentList> {
  const pageSize = (DOCUMENT_PAGE_SIZES as readonly number[]).includes(Number(query.pageSize)) ? Number(query.pageSize) : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const params: unknown[] = [];
  const conds = [await scopeSql(user, params)];
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 80) : '';
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    conds.push(`(a.full_name ilike $${params.length} or l.applicant_name ilike $${params.length} or coalesce(l.job_label, '') ilike $${params.length})`);
  }
  const bu = typeof query.bu === 'string' ? query.bu.trim().toUpperCase() : '';
  if (bu && /^[A-Z]{1,6}$/.test(bu)) {
    params.push(bu);
    conds.push(`upper(btrim(coalesce(a.department_code, l.department_code, ''))) = $${params.length}`);
  }
  // ลิงก์ล่าสุดของแต่ละใบสมัคร + ชุดล่าสุดที่ส่งแล้ว (ถ้ามี) = 1 แถวต่อผู้สมัคร ไม่มีแถวซ้ำ
  const base = `
    with latest as (
      select distinct on (i.application_id) i.* from ${T.invitations} i order by i.application_id, i.created_at desc, i.revision desc
    ), doc_rows as (
      select l.application_id, l.applicant_name, l.job_label, l.created_at as link_created_at, l.created_by_name, l.expires_at,
             l.line_display_name, l.line_picture_url, l.first_opened_at, l.last_opened_at,
             upper(btrim(coalesce(a.department_code, l.department_code, ''))) as bu, a.full_name,
             p.id as packet_id, p.submitted_at, p.person_name,
             ${DOCUMENT_STATUS_SQL} as status
        from latest l
        join ${T.applications} a on a.id = l.application_id
        left join lateral (
          select * from ${T.packets} p where p.application_id = l.application_id order by p.submitted_at desc limit 1
        ) p on true
       where ${conds.join(' and ')}
    )`;
  const status = isDocumentStatus(query.status) ? query.status : query.status === 'submitted' ? 'submitted' : null;
  const statusCond = status === 'submitted' ? `status in ('needs_fix', 'ready', 'imported')` : status ? `status = '${status}'` : 'true';
  const [counts, rows] = await Promise.all([
    dbQuery<{ status: string; n: string }>(`${base} select status, count(*) as n from doc_rows group by status`, params),
    dbQuery<{
      application_id: string; applicant_name: string; job_label: string | null; link_created_at: Date; created_by_name: string | null; expires_at: Date;
      line_display_name: string | null; line_picture_url: string | null; first_opened_at: Date | null; last_opened_at: Date | null;
      bu: string; full_name: string; packet_id: string | null; submitted_at: Date | null; person_name: string | null; status: string;
    }>(
      `${base} select * from doc_rows where ${statusCond}
        order by coalesce(submitted_at, last_opened_at, link_created_at) desc, application_id
        limit ${pageSize} offset ${(page - 1) * pageSize}`,
      params,
    ),
  ]);
  return {
    items: rows.rows.map((r) => ({
      applicationId: r.application_id,
      applicantName: r.full_name || r.applicant_name,
      jobLabel: r.job_label,
      bu: r.bu || null,
      status: r.status as DocumentStatus,
      linkCreatedAt: iso(r.link_created_at)!,
      linkCreatedByName: r.created_by_name,
      linkExpiresAt: iso(r.expires_at)!,
      line: r.first_opened_at
        ? { displayName: r.line_display_name ?? '', pictureUrl: r.line_picture_url, firstOpenedAt: iso(r.first_opened_at)!, lastOpenedAt: iso(r.last_opened_at)! }
        : null,
      packetId: r.packet_id,
      submittedAt: iso(r.submitted_at),
      personName: r.person_name,
    })),
    // ยอดรวมมาจากตัวนับต่อสถานะ (คิวรีเดียวกับชิป) — ขอหน้าที่เกินช่วงก็ยังได้ยอดถูก
    total: counts.rows
      .filter((c) => (status === 'submitted' ? ['needs_fix', 'ready', 'imported'].includes(c.status) : status ? c.status === status : true))
      .reduce((n, c) => n + (Number(c.n) || 0), 0),
    page,
    pageSize,
    counts: Object.fromEntries(counts.rows.map((c) => [c.status, Number(c.n) || 0])),
  };
}

/** มีงานเอกสารในสิทธิ์ของคนนี้ไหม — ปิดฟีเจอร์แล้วแท็บยังอยู่ให้ดูของเดิมได้ */
export async function hasDocumentHistory(user: StaffUser): Promise<boolean> {
  const params: unknown[] = [];
  const scope = await scopeSql(user, params);
  const { rows } = await dbQuery(
    `select 1 from ${T.invitations} l join ${T.applications} a on a.id = l.application_id where ${scope} limit 1`,
    params,
  );
  return rows.length > 0;
}

// ─── รายละเอียดของผู้สมัคร 1 คน ───────────────────────────────────────────────





type PacketRow = {
  id: string; invitation_id: string; application_id: string; revision: number; form_version: string; template_versions: Record<string, { version: number; pages: number }>;
  person_name: string; payload_enc: string; payload_key_id: string; payload_hash: string; attention: AttentionItem[];
  line_user_id: string; line_display_name: string; line_picture_url: string | null; line_verified_at: Date; sender_relation: string;
  submitted_at: Date; review_flag: boolean; review_note: string | null; reviewed_by_name: string | null; reviewed_at: Date | null;
  attention_ack_at: Date | null; attention_ack_by_name: string | null; attention_ack_note: string | null; erased_at: Date | null;
};

function importView(r: { id: string; department: string; mode: string; status: string; external_id: string | null; error: string | null; requested_by_name: string | null; created_at: Date }): ImportAttemptView {
  return { id: r.id, department: r.department, mode: r.mode, status: r.status, externalId: r.external_id, error: r.error, requestedByName: r.requested_by_name, createdAt: iso(r.created_at)! };
}

async function importsOf(packetId: string): Promise<ImportAttemptView[]> {
  const { rows } = await dbQuery<Parameters<typeof importView>[0]>(
    `select id, department, mode, status, external_id, error, requested_by_name, created_at from ${T.imports} where packet_id = $1 order by created_at desc`,
    [packetId],
  );
  return rows.map(importView);
}

const OCR_EDIT_FIELDS: [UploadKind, string, string][] = [
  ['id', 'prefix', 'prefix'], ['id', 'firstName', 'firstName'], ['id', 'lastName', 'lastName'], ['id', 'firstNameEn', 'firstNameEn'],
  ['id', 'lastNameEn', 'lastNameEn'], ['id', 'nationalId', 'nationalId'], ['id', 'dob', 'dob'], ['id', 'idIssued', 'idIssued'], ['id', 'idExpiry', 'idExpiry'],
  ['license', 'licenseNumber', 'licenseNumber'], ['license', 'licenseType', 'licenseType'], ['license', 'licenseIssued', 'licenseIssued'],
  ['license', 'licenseExpiry', 'licenseExpiry'], ['license', 'nationalId', 'licenseNationalId'],
];

function packetView(r: PacketRow, imports: ImportAttemptView[]): PacketView {
  const base = {
    id: r.id,
    invitationId: r.invitation_id,
    revision: r.revision,
    submittedAt: iso(r.submitted_at)!,
    formVersion: r.form_version,
    payloadHash: r.payload_hash,
    erased: Boolean(r.erased_at),
    personName: r.person_name,
    line: { userId: r.line_user_id, displayName: r.line_display_name, pictureUrl: r.line_picture_url, verifiedAt: iso(r.line_verified_at)!, senderRelation: r.sender_relation },
    review: { flag: r.review_flag, note: r.review_note, byName: r.reviewed_by_name, at: iso(r.reviewed_at) },
    attentionAck: r.attention_ack_at ? { at: iso(r.attention_ack_at)!, byName: r.attention_ack_by_name, note: r.attention_ack_note } : null,
    attention: (r.attention ?? []).map((a) => ({ code: a.code, text: attentionText(a) })),
    imports,
  };
  if (r.erased_at) {
    return { ...base, person: [], addresses: null, consents: [], signature: null, files: [], ocr: [], ocrEdits: [] };
  }
  const payload = JSON.parse(decryptText(r.payload_enc, r.payload_key_id)) as StoredPayload;
  const person = payload.person as unknown as Record<string, string | boolean | undefined>;
  const personRows = Object.entries(PERSON_LABEL)
    .map(([key, label]) => {
      let value = typeof person[key] === 'string' ? (person[key] as string) : '';
      if (key === 'idExpiry' && person.idLifetime) value = 'ตลอดชีพ';
      if (key === 'licenseExpiry' && person.licenseLifetime) value = 'ตลอดชีพ';
      return { key, label, value };
    })
    .filter((x) => x.value);
  const ocrEdits = OCR_EDIT_FIELDS.flatMap(([kind, ocrKey, personKey]) => {
    const read = (payload.ocr?.[kind]?.result?.fields as Record<string, string | undefined> | undefined)?.[ocrKey];
    const final = typeof person[personKey] === 'string' ? (person[personKey] as string) : '';
    return read && final && read !== final ? [{ label: PERSON_LABEL[personKey] ?? personKey, ocr: read, final }] : [];
  });
  return {
    ...base,
    person: personRows,
    addresses: { registered: payload.person.address, current: payload.person.currentAddress, sameAsRegistered: payload.addresses.sameAsRegistered },
    consents: DOC_TYPES.map((d) => {
      const answer = payload.consents[d.id];
      const t = r.template_versions?.[d.id];
      return {
        doc: d.id,
        title: d.title,
        answer,
        label: answerLabel(d.id, answer),
        followUp: Boolean(d.answers.find((a) => a.value === answer)?.followUp),
        templateVersion: t?.version ?? null,
        pages: t?.pages ?? 0,
      };
    }),
    signature: payload.signature,
    files: payload.files.map((f) => ({ ...f, label: UPLOAD_LABEL[f.kind] })),
    ocr: (Object.keys(UPLOAD_LABEL) as UploadKind[]).map((kind) => {
      const o = payload.ocr?.[kind];
      return { kind, label: UPLOAD_LABEL[kind], status: o?.status ?? 'manual', confidence: o?.result ? Math.round(o.result.confidence) : null, warnings: o?.result?.warnings ?? [], text: o?.result?.text ?? '' };
    }),
    ocrEdits,
  };
}

/**
 * งานเอกสารของผู้สมัคร 1 คน — `packetId` ระบุ = เปิดชุดนั้น (ต้องเป็นของใบสมัครนี้ ไม่ใช่ = ไม่พบ ไม่เปิดชุดอื่นแทน) · ไม่ระบุ = ชุดล่าสุด
 */
export async function getDocumentDetail(user: StaffUser, applicationId: unknown, packetId?: unknown): Promise<DocumentDetail> {
  const app = await scopedApplication(user, applicationId);
  if (packetId !== undefined && packetId !== null && packetId !== '' && (typeof packetId !== 'string' || !UUID.test(packetId))) {
    throw NOT_FOUND('ไม่พบชุดเอกสารนี้');
  }
  const [inv, packets, events] = await Promise.all([
    dbQuery<InvitationRow & { revoked_by_name: string | null; packet_id: string | null; packet_submitted_at: Date | null }>(
      `select i.*, p.id as packet_id, p.submitted_at as packet_submitted_at
         from ${T.invitations} i left join ${T.packets} p on p.invitation_id = i.id
        where i.application_id = $1 order by i.created_at desc, i.revision desc`,
      [app.id],
    ),
    dbQuery<PacketRow>(`select * from ${T.packets} where application_id = $1 order by submitted_at desc`, [app.id]),
    dbQuery<{ event_type: string; event_at: Date; actor_type: string; actor_name: string | null; detail: Record<string, unknown> | null }>(
      `select event_type, event_at, actor_type, actor_name, detail from ${T.events} where application_id = $1 order by event_at desc, id desc limit 100`,
      [app.id],
    ),
  ]);
  const selected = packetId ? packets.rows.find((p) => p.id === packetId) : packets.rows[0];
  if (packetId && !selected) throw NOT_FOUND('ไม่พบชุดเอกสารนี้');
  const latestLink = inv.rows[0];
  const latestPacket = packets.rows[0];
  const latestImports = latestPacket ? await importsOf(latestPacket.id) : [];
  const status = latestLink
    ? documentStatusOf(
        { id: latestLink.id, createdAt: iso(latestLink.created_at)!, expiresAt: iso(latestLink.expires_at)!, revokedAt: iso(latestLink.revoked_at), firstOpenedAt: iso(latestLink.first_opened_at) },
        latestPacket
          ? {
              invitationId: latestPacket.invitation_id,
              submittedAt: iso(latestPacket.submitted_at)!,
              attentionCount: (latestPacket.attention ?? []).length,
              attentionAcked: Boolean(latestPacket.attention_ack_at),
              reviewFlag: latestPacket.review_flag,
              imported: latestImports.some((i) => i.status === 'success'),
            }
          : null,
      )
    : null;
  return {
    application: { id: app.id, name: app.full_name, jobLabel: jobLabelOf(app), bu: (app.department_code || '').trim().toUpperCase() || null },
    status,
    invitations: inv.rows.map((i) => ({
      id: i.id,
      revision: i.revision,
      createdAt: iso(i.created_at)!,
      createdByName: i.created_by_name,
      expiresAt: iso(i.expires_at)!,
      revokedAt: iso(i.revoked_at),
      revokedByName: i.revoked_by_name,
      line: i.first_opened_at && i.claimed_line_user_id
        ? {
            userId: i.claimed_line_user_id,
            displayName: i.line_display_name ?? '',
            pictureUrl: i.line_picture_url,
            verifiedAt: iso(i.line_verified_at),
            firstOpenedAt: iso(i.first_opened_at)!,
            lastOpenedAt: iso(i.last_opened_at)!,
            openCount: i.open_count,
          }
        : null,
      packetId: i.packet_id,
      submittedAt: iso(i.packet_submitted_at),
    })),
    packets: packets.rows.map((p) => ({ id: p.id, revision: p.revision, submittedAt: iso(p.submitted_at)!, personName: p.person_name, erased: Boolean(p.erased_at) })),
    packet: selected ? packetView(selected, selected.id === latestPacket?.id ? latestImports : await importsOf(selected.id)) : null,
    events: events.rows.map((e) => ({ type: e.event_type, at: iso(e.event_at)!, actorType: e.actor_type, actorName: e.actor_name, detail: e.detail })),
  };
}

// ─── ไฟล์ของชุด ───────────────────────────────────────────────────────────────
/** โหลดชุด + ตรวจสิทธิ์ผ่านใบสมัครของชุด */
export async function scopedPacket(user: StaffUser, packetId: unknown): Promise<PacketRow> {
  if (typeof packetId !== 'string' || !UUID.test(packetId)) throw NOT_FOUND('ไม่พบชุดเอกสารนี้');
  const { rows } = await dbQuery<PacketRow>(`select * from ${T.packets} where id = $1`, [packetId]);
  if (!rows[0]) throw NOT_FOUND('ไม่พบชุดเอกสารนี้');
  await scopedApplication(user, rows[0].application_id);
  return rows[0];
}

/** ภาพที่อยู่ในชุดที่ส่งแล้วเท่านั้น */
export async function staffFile(user: StaffUser, fileId: unknown): Promise<{ mime: string; kind: string; bytes: Buffer; applicationId: string }> {
  const missing = NOT_FOUND('ไม่พบภาพนี้');
  if (typeof fileId !== 'string' || !UUID.test(fileId)) throw missing;
  const { rows } = await dbQuery<{ mime: string; kind: string; application_id: string }>(
    `select mime, kind, application_id from ${T.files} where id = $1 and state = 'committed'`,
    [fileId],
  );
  if (!rows[0]) throw missing;
  await scopedApplication(user, rows[0].application_id);
  const bytes = await getBlob(fileId);
  if (!bytes) throw missing;
  return { mime: rows[0].mime, kind: rows[0].kind, bytes, applicationId: rows[0].application_id };
}

/** ข้อมูลเต็มของชุด (ถอดรหัสแล้ว) สำหรับทำ PDF */
export async function packetForPdf(user: StaffUser, packetId: unknown): Promise<{ row: PacketRow; payload: StoredPayload; applicantName: string; jobLabel: string | null }> {
  const row = await scopedPacket(user, packetId);
  if (row.erased_at) throw new DocError(410, 'erased', 'ชุดนี้ถูกลบข้อมูลตามคำขอแล้ว');
  const { rows } = await dbQuery<{ applicant_name: string; job_label: string | null }>(
    `select applicant_name, job_label from ${T.invitations} where id = $1`,
    [row.invitation_id],
  );
  return {
    row,
    payload: JSON.parse(decryptText(row.payload_enc, row.payload_key_id)) as StoredPayload,
    applicantName: rows[0]?.applicant_name ?? row.person_name,
    jobLabel: rows[0]?.job_label ?? null,
  };
}

// ─── สิ่งที่ HR ทำกับชุด ──────────────────────────────────────────────────────
const noteOf = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, 500) : '');

/** ติดธง "ขอให้แก้" (บอกจุดที่ต้องแก้) / เอาธงออก — ไม่แตะข้อมูลในชุด ผู้สมัครแก้ด้วยการส่งชุดใหม่จากลิงก์ใหม่ */
export async function setReviewFlag(user: StaffUser, actor: Actor, packetId: unknown, flag: boolean, note: unknown): Promise<{ applicationId: string }> {
  const row = await scopedPacket(user, packetId);
  const text = noteOf(note);
  if (flag && !text) throw new DocError(400, 'bad_request', 'บอกจุดที่ต้องแก้');
  await dbTransaction(async (client) => {
    await client.query(
      `update ${T.packets} set review_flag = $2, review_note = $3, reviewed_by = $4, reviewed_by_name = $5, reviewed_at = now() where id = $1`,
      [row.id, flag, flag ? text : null, actor.id, actor.name],
    );
    await recordEvent(client, { applicationId: row.application_id, packetId: row.id, type: flag ? 'review_flagged' : 'review_cleared', actorType: 'staff', actorId: actor.id, actorName: actor.name, detail: flag ? { note: text } : null });
  });
  return { applicationId: row.application_id };
}

/** รับทราบเรื่องที่ต้องดูของชุด (คุยกับผู้สมัครแล้ว) — คำตอบในชุดยังเป็นของเดิม ไม่ถูกเปลี่ยนเป็นยินยอม */
export async function acknowledgeAttention(user: StaffUser, actor: Actor, packetId: unknown, note: unknown): Promise<{ applicationId: string }> {
  const row = await scopedPacket(user, packetId);
  const text = noteOf(note);
  if (!text) throw new DocError(400, 'bad_request', 'จดว่าคุยกับผู้สมัครแล้วได้ความว่าอย่างไร');
  if ((row.attention ?? []).length === 0) throw new DocError(409, 'nothing_to_ack', 'ชุดนี้ไม่มีเรื่องที่ต้องดู');
  await dbTransaction(async (client) => {
    await client.query(
      `update ${T.packets} set attention_ack_at = now(), attention_ack_by = $2, attention_ack_by_name = $3, attention_ack_note = $4 where id = $1`,
      [row.id, actor.id, actor.name, text],
    );
    await recordEvent(client, { applicationId: row.application_id, packetId: row.id, type: 'attention_acknowledged', actorType: 'staff', actorId: actor.id, actorName: actor.name, detail: { note: text } });
  });
  return { applicationId: row.application_id };
}

// ─── นำเข้า iRecruit (HR กดเองเท่านั้น) ────────────────────────────────────────
export type IrecruitExportResult = { ok: true; externalId: string; evidence?: Record<string, unknown> } | { ok: false; error: string };

/**
 * ตัวต่อไป iRecruit — ตอนนี้ iRecruit ไม่มีทางรับข้อมูลเข้าจากระบบอื่น (หน้าเพิ่มผู้สมัครใช้ session ของคนล็อกอิน · สำรวจ 14 ต.ค. 2569)
 * จึงยังไม่มีตัวจริง: `configured()` = false และปุ่มนำเข้าอัตโนมัติไม่ถูกใช้ · HR บันทึกเลขที่จาก iRecruit เองหลังคีย์ (`recordManualImport`)
 * มีทางเชื่อมเมื่อไหร่ เขียนตัวจริงแล้วลงทะเบียนด้วย `setIrecruitExportAdapter` — ที่เหลือ (กันซ้ำ · ไม่รู้ผล · หลักฐาน) พร้อมแล้ว
 */
export type IrecruitExportAdapter = {
  configured: () => boolean;
  createApplicant: (input: { packetId: string; department: string; idempotencyKey: string; payload: StoredPayload }) => Promise<IrecruitExportResult>;
  /** หาเรคคอร์ดที่อาจสร้างไปแล้ว (ตอนรอบก่อนไม่รู้ผล) — เจอ = เลขที่ฝั่ง iRecruit */
  findExisting?: (input: { idempotencyKey: string; payload: StoredPayload }) => Promise<string | null>;
};

const notConnected: IrecruitExportAdapter = {
  configured: () => false,
  createApplicant: async () => ({ ok: false, error: 'ยังไม่ได้เชื่อม iRecruit' }),
};
let exportAdapter: IrecruitExportAdapter = notConnected;
export const setIrecruitExportAdapter = (a: IrecruitExportAdapter | null): void => {
  exportAdapter = a ?? notConnected;
};
export const irecruitExportConfigured = (): boolean => exportAdapter.configured();

async function importableState(row: PacketRow): Promise<void> {
  if (row.erased_at) throw new DocError(410, 'erased', 'ชุดนี้ถูกลบข้อมูลตามคำขอแล้ว');
  if (row.review_flag) throw new DocError(409, 'needs_fix', 'ชุดนี้ติดธงขอให้แก้อยู่ เอาธงออกก่อนนำเข้า');
  if ((row.attention ?? []).length > 0 && !row.attention_ack_at) {
    throw new DocError(409, 'needs_fix', 'ชุดนี้มีเรื่องที่ต้องดู กดรับทราบก่อนนำเข้า');
  }
  const { rows } = await dbQuery<{ status: string }>(`select status from ${T.imports} where packet_id = $1 and status in ('success', 'pending', 'unknown')`, [row.id]);
  if (rows.some((r) => r.status === 'success')) throw new DocError(409, 'already_imported', 'ชุดนี้นำเข้าแล้ว');
  if (rows.length) throw new DocError(409, 'import_unknown', 'รอบก่อนยังไม่รู้ผล ตรวจใน iRecruit ก่อนว่าถูกสร้างไปแล้วหรือยัง');
}

const departmentOf = (v: unknown): string => {
  if (!isIrecruitDivision(v)) throw new DocError(400, 'bad_request', 'เลือกแผนกใน iRecruit ก่อนนำเข้า');
  return v;
};

/**
 * นำเข้าผ่านตัวต่อ (เมื่อมี) — จดรอบก่อนยิง · ได้เลขที่กลับมา = นำเข้าแล้ว · ปลายทางไม่ตอบ/ขาดกลางทาง = "ไม่รู้ผล"
 * (ห้ามลองใหม่จนกว่าจะตรวจ ไม่งั้นสร้างคนซ้ำ) · กดซ้ำด้วย idempotencyKey เดิม = ได้ผลของรอบเดิม
 */
export async function requestImport(
  user: StaffUser,
  actor: Actor,
  input: { packetId: unknown; department: unknown; idempotencyKey: unknown },
): Promise<ImportAttemptView> {
  if (!exportAdapter.configured()) throw new DocError(503, 'irecruit_not_connected', 'ยังไม่ได้เชื่อม iRecruit คีย์ใน iRecruit เองแล้วบันทึกเลขที่ที่นี่');
  const key = typeof input.idempotencyKey === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(input.idempotencyKey) ? input.idempotencyKey : null;
  if (!key) throw new DocError(400, 'bad_request', 'คำขอไม่ถูกต้อง');
  const department = departmentOf(input.department);
  const row = await scopedPacket(user, input.packetId);
  const same = await dbQuery<Parameters<typeof importView>[0] & { packet_id: string }>(
    `select id, packet_id, department, mode, status, external_id, error, requested_by_name, created_at from ${T.imports} where idempotency_key = $1`,
    [key],
  );
  if (same.rows[0]) {
    if (same.rows[0].packet_id !== row.id) throw new DocError(409, 'bad_request', 'คำขอไม่ถูกต้อง');
    return importView(same.rows[0]);
  }
  await importableState(row);
  let attemptId: string;
  try {
    const ins = await dbQuery<{ id: string }>(
      `insert into ${T.imports} (packet_id, application_id, idempotency_key, department, mode, status, requested_by, requested_by_name)
       values ($1, $2, $3, $4, 'adapter', 'pending', $5, $6) returning id`,
      [row.id, row.application_id, key, department, actor.id, actor.name],
    );
    attemptId = ins.rows[0].id;
  } catch (e) {
    if (isPgUniqueViolation(e)) throw new DocError(409, 'import_unknown', 'มีรอบนำเข้าของชุดนี้ค้างอยู่ รอผลหรือตรวจใน iRecruit ก่อน');
    throw e;
  }
  await recordEvent(null, { applicationId: row.application_id, packetId: row.id, type: 'import_requested', actorType: 'staff', actorId: actor.id, actorName: actor.name, detail: { department } });
  const payload = JSON.parse(decryptText(row.payload_enc, row.payload_key_id)) as StoredPayload;
  let status: 'success' | 'failed' | 'unknown' = 'unknown';
  let externalId: string | null = null;
  let error: string | null = null;
  let evidence: Record<string, unknown> | null = null;
  try {
    const r = await exportAdapter.createApplicant({ packetId: row.id, department, idempotencyKey: key, payload });
    if (r.ok === true && r.externalId.trim()) {
      status = 'success';
      externalId = r.externalId.trim().slice(0, 100);
      evidence = r.evidence ?? null;
    } else {
      status = 'failed';
      error = (r.ok === false ? r.error : 'ปลายทางไม่ส่งเลขที่กลับมา').slice(0, 500);
    }
  } catch (e) {
    // ไม่รู้ว่าปลายทางสร้างไปแล้วหรือยัง — ห้ามเดาว่าล้ม
    error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
  }
  const { rows } = await dbQuery<Parameters<typeof importView>[0]>(
    `update ${T.imports} set status = $2, external_id = $3, error = $4, evidence = $5::jsonb, updated_at = now() where id = $1
     returning id, department, mode, status, external_id, error, requested_by_name, created_at`,
    [attemptId, status, externalId, error, evidence ? JSON.stringify(evidence) : null],
  );
  await recordEvent(null, { applicationId: row.application_id, packetId: row.id, type: 'import_result', actorType: 'system', detail: { status, externalId } });
  return importView(rows[0]);
}

/**
 * รอบที่ "ไม่รู้ผล": ตรวจกับปลายทางว่าสร้างไปแล้วหรือยัง (ตัวต่อ) หรือ HR ตรวจใน iRecruit เองแล้วบอกผล
 * `externalId` = เจอแล้ว เลขที่นี้ · ไม่ส่ง + ตัวต่อหาไม่เจอ/HR ยืนยันว่าไม่มี (`notFound`) = รอบนั้นล้ม เปิดรอบใหม่ได้
 */
export async function resolveUnknownImport(
  user: StaffUser,
  actor: Actor,
  input: { attemptId: unknown; externalId?: unknown; notFound?: unknown },
): Promise<ImportAttemptView> {
  if (typeof input.attemptId !== 'string' || !UUID.test(input.attemptId)) throw NOT_FOUND('ไม่พบรายการนำเข้านี้');
  const { rows: found } = await dbQuery<{ id: string; packet_id: string; status: string; idempotency_key: string }>(
    `select id, packet_id, status, idempotency_key from ${T.imports} where id = $1`,
    [input.attemptId],
  );
  if (!found[0]) throw NOT_FOUND('ไม่พบรายการนำเข้านี้');
  const row = await scopedPacket(user, found[0].packet_id);
  if (found[0].status !== 'unknown' && found[0].status !== 'pending') throw new DocError(409, 'bad_request', 'รายการนี้รู้ผลแล้ว');
  let externalId = typeof input.externalId === 'string' ? input.externalId.trim().slice(0, 100) : '';
  let how = 'staff';
  if (!externalId && input.notFound !== true && exportAdapter.findExisting) {
    const payload = JSON.parse(decryptText(row.payload_enc, row.payload_key_id)) as StoredPayload;
    externalId = (await exportAdapter.findExisting({ idempotencyKey: found[0].idempotency_key, payload })) ?? '';
    how = 'adapter';
    if (!externalId) throw new DocError(409, 'still_unknown', 'ยังตรวจไม่เจอใน iRecruit ตรวจเองแล้วบอกผล');
  }
  if (!externalId && input.notFound !== true) throw new DocError(400, 'bad_request', 'ใส่เลขที่จาก iRecruit หรือยืนยันว่าไม่มีรายการ');
  const { rows } = await dbQuery<Parameters<typeof importView>[0]>(
    `update ${T.imports} set status = $2, external_id = $3, error = $4, evidence = $5::jsonb, updated_at = now() where id = $1
     returning id, department, mode, status, external_id, error, requested_by_name, created_at`,
    [found[0].id, externalId ? 'success' : 'failed', externalId || null, externalId ? null : 'ตรวจแล้วไม่มีรายการใน iRecruit', JSON.stringify({ checkedBy: actor.name, how })],
  );
  await recordEvent(null, { applicationId: row.application_id, packetId: row.id, type: 'import_result', actorType: 'staff', actorId: actor.id, actorName: actor.name, detail: { status: rows[0].status, externalId: externalId || null } });
  return importView(rows[0]);
}

/** HR คีย์ใน iRecruit เองแล้วบันทึกเลขที่ — "นำเข้าแล้ว" ต้องมีเลขที่เสมอ ไม่ตั้งจากการกดปุ่มอย่างเดียว */
export async function recordManualImport(
  user: StaffUser,
  actor: Actor,
  input: { packetId: unknown; department: unknown; externalId: unknown },
): Promise<ImportAttemptView> {
  const department = departmentOf(input.department);
  const externalId = typeof input.externalId === 'string' ? input.externalId.trim() : '';
  if (!/^[A-Za-z0-9._/-]{1,60}$/.test(externalId)) throw new DocError(400, 'bad_request', 'ใส่เลขที่ผู้สมัครจาก iRecruit');
  const row = await scopedPacket(user, input.packetId);
  await importableState(row);
  try {
    const { rows } = await dbQuery<Parameters<typeof importView>[0]>(
      `insert into ${T.imports} (packet_id, application_id, idempotency_key, department, mode, status, external_id, evidence, requested_by, requested_by_name)
       values ($1, $2, $3, $4, 'manual', 'success', $5, $6::jsonb, $7, $8)
       returning id, department, mode, status, external_id, error, requested_by_name, created_at`,
      [row.id, row.application_id, `manual:${row.id}`, department, externalId, JSON.stringify({ recordedBy: actor.name }), actor.id, actor.name],
    );
    await recordEvent(null, { applicationId: row.application_id, packetId: row.id, type: 'import_result', actorType: 'staff', actorId: actor.id, actorName: actor.name, detail: { status: 'success', externalId, department, mode: 'manual' } });
    return importView(rows[0]);
  } catch (e) {
    if (isPgUniqueViolation(e)) throw new DocError(409, 'already_imported', 'ชุดนี้นำเข้าแล้ว');
    throw e;
  }
}

/** สถานะของใบสมัคร 1 ใบสำหรับปุ่ม "ส่งเอกสาร" ในป๊อปผู้สมัคร — เบากว่ารายละเอียดเต็ม ไม่ถอดรหัสชุด */
export async function applicationDocumentState(user: StaffUser, applicationId: unknown): Promise<{
  application: { id: string; name: string; jobLabel: string | null };
  status: DocumentStatus | null;
  invitations: InvitationView[];
  latestPacketId: string | null;
}> {
  const d = await getDocumentDetailLight(user, applicationId);
  return d;
}

async function getDocumentDetailLight(user: StaffUser, applicationId: unknown) {
  const app = await scopedApplication(user, applicationId);
  const params: unknown[] = [app.id];
  const { rows: st } = await dbQuery<{ status: string; packet_id: string | null }>(
    `with latest as (select distinct on (i.application_id) i.* from ${T.invitations} i where i.application_id = $1 order by i.application_id, i.created_at desc, i.revision desc)
     select ${DOCUMENT_STATUS_SQL} as status, p.id as packet_id
       from latest l left join lateral (select * from ${T.packets} p where p.application_id = l.application_id order by p.submitted_at desc limit 1) p on true`,
    params,
  );
  const { rows: inv } = await dbQuery<InvitationRow & { revoked_by_name: string | null; packet_id: string | null; packet_submitted_at: Date | null }>(
    `select i.*, p.id as packet_id, p.submitted_at as packet_submitted_at
       from ${T.invitations} i left join ${T.packets} p on p.invitation_id = i.id
      where i.application_id = $1 order by i.created_at desc, i.revision desc limit 5`,
    params,
  );
  return {
    application: { id: app.id, name: app.full_name, jobLabel: jobLabelOf(app) },
    status: st[0] && isDocumentStatus(st[0].status) ? st[0].status : null,
    latestPacketId: st[0]?.packet_id ?? null,
    invitations: inv.map((i) => ({
      id: i.id,
      revision: i.revision,
      createdAt: iso(i.created_at)!,
      createdByName: i.created_by_name,
      expiresAt: iso(i.expires_at)!,
      revokedAt: iso(i.revoked_at),
      revokedByName: i.revoked_by_name,
      line: i.first_opened_at && i.claimed_line_user_id
        ? { userId: i.claimed_line_user_id, displayName: i.line_display_name ?? '', pictureUrl: i.line_picture_url, verifiedAt: iso(i.line_verified_at), firstOpenedAt: iso(i.first_opened_at)!, lastOpenedAt: iso(i.last_opened_at)!, openCount: i.open_count }
        : null,
      packetId: i.packet_id,
      submittedAt: iso(i.packet_submitted_at),
    })),
  };
}
