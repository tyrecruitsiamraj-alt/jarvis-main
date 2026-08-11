import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { loadScopedJobIdSet } from '../_lib/siamrajUnitRequests.js';
import {
  cleanRmLicenseTypes,
  isRmSpecificType,
  normalizeRmPhone,
} from '../../src/lib/recruitRmMasters.js';

const tbl = tableInAppSchema('public_job_applications');
const OUT_OF_SCOPE = 'ไม่มีสิทธิ์เข้าถึงใบสมัครของแผนกอื่น';

type ApplicationStatus = 'new' | 'contacted' | 'converted' | 'rejected';
const STATUSES: ApplicationStatus[] = ['new', 'contacted', 'converted', 'rejected'];

function isStatus(v: unknown): v is ApplicationStatus {
  return typeof v === 'string' && (STATUSES as string[]).includes(v);
}

type Row = {
  id: string;
  full_name: string;
  title_prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  age: number | null;
  gender: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  postal_code: string | null;
  weight_kg: string | number | null;
  height_cm: string | number | null;
  education: string | null;
  referral_source: string | null;
  document_filename: string | null;
  document_mime: string | null;
  has_document: boolean;
  job_id: string | null;
  job_title: string | null;
  unit_name: string | null;
  position_interest: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  line_id: string | null;
  specific_type: string | null;
  responsible_name: string | null;
  channel_label: string | null;
  license_types: string[] | null;
  created_by_name: string | null;
  created_at: string | Date;
};

function toNum(v: string | number | null): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function toApplication(r: Row) {
  return {
    id: r.id,
    full_name: r.full_name,
    title_prefix: r.title_prefix || undefined,
    first_name: r.first_name || undefined,
    last_name: r.last_name || undefined,
    phone: r.phone,
    age: r.age ?? undefined,
    gender: r.gender || undefined,
    province: r.province || undefined,
    district: r.district || undefined,
    subdistrict: r.subdistrict || undefined,
    postal_code: r.postal_code || undefined,
    weight_kg: toNum(r.weight_kg),
    height_cm: toNum(r.height_cm),
    education: r.education || undefined,
    referral_source: r.referral_source || undefined,
    document_filename: r.document_filename || undefined,
    document_mime: r.document_mime || undefined,
    has_document: r.has_document === true,
    job_id: r.job_id || undefined,
    job_title: r.job_title || undefined,
    unit_name: r.unit_name || undefined,
    position_interest: r.position_interest || undefined,
    note: r.note || undefined,
    status: r.status,
    admin_note: r.admin_note || undefined,
    line_id: r.line_id || undefined,
    specific_type: r.specific_type || undefined,
    responsible_name: r.responsible_name || undefined,
    channel_label: r.channel_label || undefined,
    license_types: r.license_types && r.license_types.length > 0 ? r.license_types : undefined,
    created_by_name: r.created_by_name || undefined,
    created_at: toIso(r.created_at),
  };
}

// explicit columns (never select document_bytes — it is fetched on demand)
const LIST_COLUMNS = `
  id, full_name, title_prefix, first_name, last_name, phone, age, gender,
  province, district, subdistrict, postal_code,
  weight_kg, height_cm, education, referral_source,
  document_filename, document_mime, (document_bytes is not null) as has_document,
  job_id, job_title, unit_name, position_interest, note, status, admin_note,
  line_id, specific_type, responsible_name, channel_label, license_types, created_by_name,
  created_at
`;

/**
 * ชุดคอลัมน์แบบยังไม่ได้รัน migration 074
 *
 * ⚠️ **ห้ามลบ** จนกว่าจะแน่ใจว่าทุก environment รัน 074 แล้ว — ฐาน local ของเจ้าของ
 * ชี้ production ตัวเดียวกัน ถ้าโค้ดขึ้นก่อน migration แล้ว select คอลัมน์ที่ยังไม่มี
 * บอร์ดรับสมัคร (dialog รายชื่อผู้สมัคร) จะพังทั้งหน้า ไม่ใช่แค่ฟีเจอร์ใหม่ไม่ทำงาน
 * (แพตเทิร์นเดียวกับ JOB_SUMMARY_SQL_LEGACY ใน api/_lib/lumosDispatch.ts)
 */
const LIST_COLUMNS_LEGACY = `
  id, full_name, title_prefix, first_name, last_name, phone, age, gender,
  province, district, subdistrict, postal_code,
  weight_kg, height_cm, education, referral_source,
  document_filename, document_mime, (document_bytes is not null) as has_document,
  job_id, job_title, unit_name, position_interest, note, status, admin_note,
  null::text as line_id, null::text as specific_type, null::text as responsible_name,
  null::text as channel_label, null::text[] as license_types, null::text as created_by_name,
  created_at
`;

/** 42703 undefined_column — โค้ดใหม่ขึ้นก่อน migration 074 */
function isUndefinedColumn(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703'
  );
}

/** ยิงด้วยคอลัมน์ชุดใหม่ก่อน · ยังไม่ migrate ค่อยถอยไปชุดเก่า (คอลัมน์ใหม่เป็น null) */
async function queryWithLegacyFallback(sql: string, params: unknown[]): Promise<Row[]> {
  try {
    const { rows } = await dbQuery<Row>(sql.replace(/\{\{cols\}\}/g, LIST_COLUMNS), params);
    return rows;
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    const { rows } = await dbQuery<Row>(sql.replace(/\{\{cols\}\}/g, LIST_COLUMNS_LEGACY), params);
    return rows;
  }
}

/** GET /api/job-applications
 *   ?job_id=<id>  → applicants submitted for that job (newest first)
 *   ?counts=1     → { counts: { [job_id]: n } } for badge display on the board
 */
/**
 * POST /api/job-applications — เจ้าหน้าที่คีย์ใบสมัครเข้ามาเอง (ฟอร์ม "เพิ่มข้อมูลผู้สมัคร")
 *
 * ระบบเดิมมีฟอร์มนี้เพราะคนโทรเข้ามาสมัครทางโทรศัพท์ ไม่ได้กรอกลิงก์เอง
 *
 * ⚠️ **ลงตารางเดียวกับใบสมัครจากลิงก์** (`public_job_applications`) ไม่แยกตารางใหม่
 * ไม่งั้นหน้า RM/บอร์ดต้องนับสองที่แล้วยอดไม่ตรงกัน · `created_by_name` เป็นตัวบอกว่า
 * ใบนี้เจ้าหน้าที่คีย์ (มีค่า) หรือผู้สมัครกรอกเอง (null)
 *
 * ⚠️ ไม่ผูก `job_id` — ใบที่คีย์เองยังไม่รู้ว่าจะเข้างานไหน (ต่างจากใบที่มาทางลิงก์
 * ของประกาศ) จึงเป็น "สมัครทั่วไป" จนกว่าเจ้าหน้าที่จะจับคู่งานให้
 * ผลข้างเคียงที่ต้องรู้: ใบที่ job_id เป็น null คนที่ถูกล็อก BU จะไม่เห็น (กติกาเดิมของ GET)
 * → ให้เฉพาะ admin/ผู้ที่เห็นทุก BU คีย์ได้ ไม่ใช่คีย์แล้วหายไปเลย
 */
async function createByStaff(req: AuthedReq, res: ApiRes) {
  const raw = await readJsonBody(req);
  if (typeof raw !== 'object' || raw === null) {
    return sendError(res, 400, 'Bad request', 'Invalid JSON body');
  }
  const b = raw as Record<string, unknown>;

  const firstName = (getString(b.first_name) || '').trim().slice(0, 120);
  const lastName = (getString(b.last_name) || '').trim().slice(0, 120);
  if (!firstName) return sendError(res, 400, 'Bad request', 'กรุณากรอกชื่อ');
  if (!lastName) return sendError(res, 400, 'Bad request', 'กรุณากรอกนามสกุล');

  const phone = normalizeRmPhone(b.phone);
  if (!phone) return sendError(res, 400, 'Bad request', 'กรุณากรอกเบอร์โทรให้ครบ 10 หลัก');

  const gender = b.gender === 'male' || b.gender === 'female' ? b.gender : null;
  if (!gender) return sendError(res, 400, 'Bad request', 'กรุณาเลือกเพศ');

  const ageNum = Number(b.age);
  // อายุนอกช่วงนี้แปลว่าคีย์ผิด (พิมพ์ปีเกิดลงช่องอายุเป็นอาการที่เจอบ่อย)
  const age = Number.isFinite(ageNum) && ageNum >= 15 && ageNum <= 80 ? Math.trunc(ageNum) : null;
  if (age === null) return sendError(res, 400, 'Bad request', 'อายุต้องอยู่ระหว่าง 15–80 ปี');

  const scopedJobIds = await loadScopedJobIdSet(req.user);
  if (scopedJobIds) {
    return sendError(
      res,
      403,
      'Forbidden',
      'ใบที่คีย์เองยังไม่ผูกใบขอ ผู้ใช้ที่ถูกล็อก BU จะมองไม่เห็นใบของตัวเอง — ให้แอดมินคีย์แทน',
    );
  }

  const text = (v: unknown, max = 200): string | null => {
    const t = (getString(v) || '').trim();
    return t ? t.slice(0, max) : null;
  };
  const specificType = isRmSpecificType(getString(b.specific_type)) ? getString(b.specific_type) : null;
  const licenses = cleanRmLicenseTypes(b.license_types);
  const staffName = req.user.email || null;

  let rows: Row[];
  try {
    ({ rows } = await dbQuery<Row>(
      `insert into ${tbl}
       (full_name, first_name, last_name, phone, age, gender,
        province, district, education, position_interest,
        line_id, specific_type, responsible_name, channel_id, channel_label,
        license_types, created_by_name, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'new')
     returning ${LIST_COLUMNS}`,
      [
      `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      phone,
      age,
      gender,
      text(b.province, 128),
      text(b.district, 128),
      text(b.education, 128),
      text(b.position_interest),
      text(b.line_id, 128),
      specificType,
      text(b.responsible_name),
      text(b.channel_id, 64),
      text(b.channel_label),
        licenses.length > 0 ? licenses : null,
        staffName,
      ],
    ));
  } catch (e) {
    // ⚠️ ยังไม่รัน migration 074 → **ไม่บันทึกแบบทิ้งฟิลด์** เพราะเจ้าหน้าที่จะคิดว่า
    // เก็บ LINE ID/ใบขับขี่ไว้แล้วทั้งที่หาย · บอกตรง ๆ ว่าต้องรัน migration ก่อน
    if (isUndefinedColumn(e)) {
      return sendError(
        res,
        503,
        'Migration required',
        'ฟอร์มนี้ต้องรัน migration 074 ก่อน (node scripts/migrate.mjs) — ยังบันทึกไม่ได้',
      );
    }
    throw e;
  }
  const row = rows[0];
  if (!row) return sendError(res, 500, 'Server error', 'บันทึกไม่สำเร็จ');

  await auditFromAuthed(req, {
    action: 'job_application.create_by_staff',
    entityType: 'job_application',
    entityId: row.id,
    after: { phone, specific_type: specificType, license_types: licenses },
  });

  return res.status(201).json({ item: toApplication(row) });
}

async function patchStatus(req: AuthedReq, res: ApiRes) {
  const raw = await readJsonBody(req);
  if (typeof raw !== 'object' || raw === null) {
    return sendError(res, 400, 'Bad request', 'Invalid JSON body');
  }
  const b = raw as Record<string, unknown>;
  const id = getString(b.id);
  if (!id) return sendError(res, 400, 'Bad request', 'id required');

  const hasStatus = b.status !== undefined;
  const hasNote = b.admin_note !== undefined;
  if (!hasStatus && !hasNote) {
    return sendError(res, 400, 'Bad request', 'ต้องระบุ status หรือ admin_note');
  }
  if (hasStatus && !isStatus(b.status)) {
    return sendError(res, 400, 'Bad request', 'สถานะไม่ถูกต้อง');
  }
  const adminNote =
    b.admin_note === null || b.admin_note === ''
      ? null
      : typeof b.admin_note === 'string'
        ? b.admin_note.trim().slice(0, 2000)
        : null;

  const { rows: beforeRows } = await dbQuery<{
    status: string;
    admin_note: string | null;
    job_id: string | null;
  }>(`select status, admin_note, job_id from ${tbl} where id = $1 limit 1`, [id]);
  const before = beforeRows[0];
  if (!before) return sendError(res, 404, 'Not found');

  // จำกัดตาม BU — กันเปลี่ยนสถานะ/โน้ตใบสมัครของงานแผนกอื่นด้วยการเดา id
  const scopedJobIds = await loadScopedJobIdSet(req.user);
  if (scopedJobIds && !(before.job_id && scopedJobIds.has(before.job_id))) {
    return sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
  }

  const rows = await queryWithLegacyFallback(
    `
    update ${tbl}
    set status = coalesce($2, status),
        admin_note = case when $3::boolean then $4 else admin_note end,
        updated_at = now()
    where id = $1
    returning {{cols}}
    `,
    [id, hasStatus ? (b.status as string) : null, hasNote, adminNote],
  );
  const row = rows[0];
  if (!row) return sendError(res, 404, 'Not found');

  await auditFromAuthed(req, {
    action: 'job_application.update',
    entityType: 'job_application',
    entityId: row.id,
    before: { status: before.status, admin_note: before.admin_note },
    after: { status: row.status, admin_note: row.admin_note },
  });

  return res.status(200).json({ item: toApplication(row) });
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'POST') {
    try {
      return await createByStaff(req, res);
    } catch (e) {
      return handleApiError(res, e, 'job-applications POST', { userId: req.user.sub });
    }
  }

  if (method === 'PATCH') {
    try {
      return await patchStatus(req, res);
    } catch (e) {
      return handleApiError(res, e, 'job-applications PATCH', { userId: req.user.sub });
    }
  }

  if (method !== 'GET') {
    res.setHeader?.('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader?.('Cache-Control', 'no-store');

  try {
    // จำกัดตาม BU — ใบสมัครผูกกับ job_id ('siamraj-sql:<เลขใบขอ>') จึงกรองจากใบขอที่ผู้ใช้เห็นได้
    // (null = admin เห็นทุกแผนก) · ใบสมัครที่ไม่ระบุงาน (job_id null) ผูก BU ไม่ได้ → staff ไม่เห็น
    const scopedJobIds = await loadScopedJobIdSet(req.user);

    if (getString(req.query?.counts) === '1') {
      const { rows } = await dbQuery<{ job_id: string; n: string }>(
        `select job_id, count(*)::text as n from ${tbl} where job_id is not null group by job_id`,
      );
      const counts: Record<string, number> = {};
      for (const r of rows) {
        if (scopedJobIds && !scopedJobIds.has(r.job_id)) continue;
        counts[r.job_id] = Number(r.n);
      }
      return res.status(200).json({ counts });
    }

    const jobId = getString(req.query?.job_id);
    if (jobId && scopedJobIds && !scopedJobIds.has(jobId)) {
      return sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
    }
    const params: unknown[] = [];
    let where = '';
    if (jobId) {
      params.push(jobId);
      where = `where job_id = $1`;
    } else if (scopedJobIds) {
      params.push([...scopedJobIds]);
      where = `where job_id = any($1::text[])`;
    }

    const rows = await queryWithLegacyFallback(
      `select {{cols}} from ${tbl} ${where} order by created_at desc limit 500`,
      params,
    );
    return res.status(200).json({ items: rows.map(toApplication) });
  } catch (e) {
    return handleApiError(res, e, 'job-applications GET', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'job-applications');
