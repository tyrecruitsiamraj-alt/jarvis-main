/**
 * ═══ iRecruit → Jarvis: ดึงเอกสารที่ผู้สมัครส่งผ่าน LINE (เจ้าของ 23 พ.ย. 2569) ═══
 * > "irecruit จะเรียกโหลดรูปอะเพื่อไปที่ irecruit" · "เฉพาะคนที่บัตรประชาชนตรงกับ irecruit"
 *
 * iRecruit ถามด้วยเลขบัตรประชาชนของคนที่มีอยู่ในระบบเขา → ได้ชุดเอกสารล่าสุดของคนนั้น (ข้อมูล + รายการรูป/PDF)
 * ⇒ คนที่ iRecruit ไม่มีเลขบัตร = ดึงไม่ได้ · ไม่มีเส้นไล่รายการทุกคน
 * ไฟล์ (รูป/PDF) ต้องส่งเลขบัตรมาคู่กับรหัสไฟล์ทุกครั้ง — รู้รหัสไฟล์อย่างเดียวเปิดไม่ได้
 * iRecruit บันทึกเสร็จแล้วส่งเลขที่ผู้สมัครกลับ = ชุดขึ้น "นำเข้าแล้ว" ในแท็บเอกสาร (แบบเดียวกับ HR บันทึกเลขที่เอง)
 *
 * 🔴 ห้ามพิมพ์เลขบัตร/ข้อมูลในชุดลง log · จดเหตุการณ์แค่รหัสชุด
 */
import { dbQuery, isPgUniqueViolation } from '../postgres.js';
import { DocError, T, decryptText, nationalIdDigests, recordEvent } from './core.js';
import { getBlob, type StoredPayload } from './applicant.js';
import { packetPdf } from './pdf.js';
import { DOC_TYPES, PERSON_LABEL, UPLOAD_LABEL, answerLabel, isDocId } from '../../../src/lib/documents/documentTypes.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const IRECRUIT_PULL_ACTOR = { id: '00000000-0000-0000-0000-000000000000', name: 'iRecruit' } as const;

type Row = {
  id: string; invitation_id: string; application_id: string; job_label: string | null; submitted_at: Date; form_version: string;
  payload_enc: string; payload_key_id: string; payload_hash: string; line_user_id: string; attention: unknown[];
  template_versions: Record<string, { id: string; version: number; sha256: string }>; national_id_hash: string | null;
};

/** เลขบัตร 13 หลัก (เว้นวรรค/ขีดได้) · ไม่ใช่ = null */
export function nationalIdOf(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/[\s-]/g, '');
  return /^\d{13}$/.test(digits) ? digits : null;
}

const decrypt = (r: Row): StoredPayload => JSON.parse(decryptText(r.payload_enc, r.payload_key_id)) as StoredPayload;

/**
 * ชุดล่าสุดของเลขบัตรนี้ (ส่งแล้ว ไม่ถูกล้างตาม PDPA) · ไม่มี = null
 * ชุดใหม่ค้นด้วยแฮชเลขบัตร (`national_id_hash` · HMAC ด้วยกุญแจระบบ ย้อนเป็นเลขบัตรไม่ได้) · ชุดก่อนมีคอลัมน์นี้ถอดรหัสเทียบทีละชุด (อ่านอย่างเดียว ไม่เขียนกลับ)
 */
export async function latestPacketByNationalId(nationalId: string): Promise<{ row: Row; payload: StoredPayload } | null> {
  const { rows } = await dbQuery<Row>(
    `select id, invitation_id, application_id, job_label, submitted_at, form_version, payload_enc, payload_key_id, payload_hash,
            line_user_id, attention, template_versions, national_id_hash
       from ${T.packets}
      where erased_at is null and (national_id_hash = any($1::text[]) or national_id_hash is null)
      order by submitted_at desc
      limit 500`,
    [nationalIdDigests(nationalId)],
  );
  const digests = new Set(nationalIdDigests(nationalId));
  for (const row of rows) {
    if (row.national_id_hash && !digests.has(row.national_id_hash)) continue;
    const payload = decrypt(row);
    if (String(payload.person?.nationalId ?? '').replace(/\D/g, '') === nationalId) return { row, payload };
  }
  return null;
}

async function requirePacket(nationalId: unknown, packetId?: unknown) {
  const id = nationalIdOf(nationalId);
  if (!id) throw new DocError(400, 'bad_request', 'ส่งเลขบัตรประชาชน 13 หลักใน national_id');
  const hit = await latestPacketByNationalId(id);
  if (!hit) throw new DocError(404, 'not_found', 'ไม่พบเอกสารของเลขบัตรนี้');
  if (packetId !== undefined && packetId !== hit.row.id) throw new DocError(404, 'not_found', 'ไม่พบชุดเอกสารนี้ของเลขบัตรนี้');
  return hit;
}

/** สิ่งที่ส่งให้ iRecruit — ข้อมูลตามบัตร ที่อยู่ คำตอบเอกสาร รายการรูป/PDF (ลิงก์ = เส้นเดียวกันพร้อมเลขบัตร) */
export async function irecruitPacketView(nationalId: unknown, baseUrl: string) {
  const { row, payload } = await requirePacket(nationalId);
  const nid = nationalIdOf(nationalId)!;
  const { rows: imports } = await dbQuery<{ external_id: string | null; created_at: Date; requested_by_name: string | null }>(
    `select external_id, created_at, requested_by_name from ${T.imports} where packet_id = $1 and status = 'success' limit 1`,
    [row.id],
  );
  const q = (extra: Record<string, string>) => `${baseUrl}?${new URLSearchParams({ national_id: nid, ...extra }).toString()}`;
  const person = payload.person as unknown as Record<string, unknown>;
  return {
    found: true,
    packet_id: row.id,
    submitted_at: row.submitted_at.toISOString(),
    job: row.job_label,
    person: Object.fromEntries(
      Object.keys(PERSON_LABEL).map((k) => [k, typeof person[k] === 'string' && person[k] ? person[k] : null]),
    ),
    person_labels: PERSON_LABEL,
    id_lifetime: person.idLifetime === true,
    license_lifetime: person.licenseLifetime === true,
    address: { registered: payload.person.address, current: payload.person.currentAddress, same_as_registered: payload.addresses.sameAsRegistered },
    consents: DOC_TYPES.map((d) => ({ doc: d.id, title: d.title, answer: payload.consents[d.id] ?? null, answer_label: answerLabel(d.id, payload.consents[d.id]) })),
    sender: { line_display_name: payload.line.displayName, relation: payload.line.senderRelation },
    files: payload.files.map((f) => ({ file_id: f.id, kind: f.kind, label: UPLOAD_LABEL[f.kind], mime: f.mime, url: q({ file: f.id }) })),
    pdfs: DOC_TYPES.map((d) => ({ doc: d.id, title: d.title, url: q({ pdf: d.id, packet_id: row.id }) })),
    imported: imports[0] ? { irecruit_applicant_no: imports[0].external_id, at: imports[0].created_at.toISOString(), by: imports[0].requested_by_name } : null,
  };
}

/** รูปในชุดล่าสุดของเลขบัตรนี้เท่านั้น */
export async function irecruitFile(nationalId: unknown, fileId: unknown): Promise<{ mime: string; bytes: Buffer }> {
  const { row, payload } = await requirePacket(nationalId);
  if (typeof fileId !== 'string' || !UUID.test(fileId) || !payload.files.some((f) => f.id === fileId)) throw new DocError(404, 'not_found', 'ไม่พบภาพนี้');
  const { rows } = await dbQuery<{ mime: string }>(`select mime from ${T.files} where id = $1 and packet_id = $2 and state = 'committed'`, [fileId, row.id]);
  const bytes = rows[0] ? await getBlob(fileId) : null;
  if (!rows[0] || !bytes) throw new DocError(404, 'not_found', 'ไม่พบภาพนี้');
  return { mime: rows[0].mime, bytes };
}

export async function irecruitPdf(nationalId: unknown, packetId: unknown, doc: unknown): Promise<{ bytes: Buffer; filename: string }> {
  if (!isDocId(doc)) throw new DocError(404, 'not_found', 'ไม่พบเอกสารนี้');
  const { row, payload } = await requirePacket(nationalId, packetId);
  const pdf = await packetPdf(row, payload, row.job_label, doc);
  return { bytes: pdf.bytes, filename: pdf.filename };
}

/** iRecruit บันทึกผู้สมัครแล้ว ส่งเลขที่กลับ — ชุดขึ้น "นำเข้าแล้ว" · ส่งซ้ำเลขเดิม = ตอบเหมือนเดิม */
export async function irecruitMarkImported(body: unknown): Promise<{ packet_id: string; irecruit_applicant_no: string; already: boolean }> {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const no = typeof b.irecruit_applicant_no === 'string' ? b.irecruit_applicant_no.trim() : '';
  if (!/^[A-Za-z0-9._/-]{1,60}$/.test(no)) throw new DocError(400, 'bad_request', 'ส่งเลขที่ผู้สมัครของ iRecruit ใน irecruit_applicant_no');
  const department = typeof b.department === 'string' && b.department.trim() ? b.department.trim().slice(0, 60) : 'iRecruit';
  const { row } = await requirePacket(b.national_id, b.packet_id);
  const { rows: done } = await dbQuery<{ external_id: string | null }>(`select external_id from ${T.imports} where packet_id = $1 and status = 'success' limit 1`, [row.id]);
  if (done[0]) {
    if (done[0].external_id === no) return { packet_id: row.id, irecruit_applicant_no: no, already: true };
    throw new DocError(409, 'already_imported', 'ชุดนี้นำเข้าแล้วด้วยเลขที่อื่น');
  }
  try {
    await dbQuery(
      `insert into ${T.imports} (packet_id, application_id, idempotency_key, department, mode, status, external_id, evidence, requested_by, requested_by_name)
       values ($1, $2, $3, $4, 'irecruit_pull', 'success', $5, $6::jsonb, $7, $8)`,
      [row.id, row.application_id, `irecruit:${row.id}`, department, no, JSON.stringify({ source: 'irecruit_api' }), IRECRUIT_PULL_ACTOR.id, IRECRUIT_PULL_ACTOR.name],
    );
  } catch (e) {
    if (isPgUniqueViolation(e)) throw new DocError(409, 'already_imported', 'ชุดนี้นำเข้าแล้ว');
    throw e;
  }
  await recordEvent(null, { applicationId: row.application_id, packetId: row.id, type: 'import_result', actorType: 'system', actorId: null, actorName: IRECRUIT_PULL_ACTOR.name, detail: { status: 'success', externalId: no, department, mode: 'irecruit_pull' } });
  return { packet_id: row.id, irecruit_applicant_no: no, already: false };
}

