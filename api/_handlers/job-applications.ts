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
import { loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { isApplicationInWriteScope } from '../_lib/applicationScope.js';
import {
  cleanRmLicenseTypes,
  isRmSpecificType,
  normalizeRmPhone,
} from '../../src/lib/recruitRmMasters.js';
import { loadAppointmentByPhone, loadLatestCallOutcomeByPhone } from '../_lib/applicantCallOutcomes.js';
import { loadContactAppointments } from '../_lib/applicationContacts.js';
import { toE164Thai } from '../_lib/thaiPhone.js';
import { logError } from '../_lib/logger.js';

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
  claimed_by: string | null;
  claimed_by_name: string | null;
  claimed_at: string | Date | null;
  is_lead: boolean | null;
  lead_by_name: string | null;
  lead_at: string | Date | null;
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

/**
 * แปลงแถวเป็น payload — เรื่อง "เก็บไปติดต่อ" (13 ส.ค. 2569) ส่งเฉพาะ:
 *   claimed        = มีคนเก็บแล้ว (boolean — ทุกคนรู้ได้ว่า "ถูกเก็บแล้ว" เพื่อนับจำนวน)
 *   claimed_by_me  = คนเก็บคือ viewer
 *   claimed_by_name = **เฉพาะของตัวเอง** — เจ้าของสั่ง "คนอื่นจะไม่เห็นชื่อคนที่เก็บไป"
 */
function toApplication(r: Row, viewerId?: string) {
  const claimed = Boolean(r.claimed_by);
  const mine = claimed && !!viewerId && r.claimed_by === viewerId;
  return {
    claimed,
    claimed_by_me: mine,
    claimed_by_name: mine ? (r.claimed_by_name ?? undefined) : undefined,
    // Lead เป็นสถานะระดับระบบ (ไม่ใช่ของใครคนหนึ่ง) — ชื่อคนปัดจึงส่งให้ทุกคนเห็นได้
    // ต่างจาก claim ที่เจ้าของสั่งว่า "คนอื่นจะไม่เห็นชื่อคนที่เก็บไป"
    is_lead: Boolean(r.is_lead),
    lead_by_name: r.lead_by_name ?? undefined,
    lead_at: r.lead_at ? toIso(r.lead_at) : undefined,
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
  created_at,
  claimed_by, claimed_by_name, claimed_at,
  is_lead, lead_by_name, lead_at
`;

/**
 * ชุดคอลัมน์แบบรัน 074+079 แล้วแต่**ยังไม่รัน 083** (คอลัมน์ Lead)
 *
 * ⚠️ ต้องมีชั้นนี้แยก ไม่ใช่ถอยไปชั้นล่างสุด — ฐานแต่ละ environment อยู่คนละอายุ
 * (ตอนเขียน 083: local รันครบ · server จริงยังไม่รันแม้แต่ 080) ถอยข้ามชั้น
 * จะ null ฟิลด์ 079 ที่ฐานมีข้อมูลจริงทิ้ง — กับดักเดิมจากตอนเขียน 079 เป๊ะ
 */
const LIST_COLUMNS_NO_LEAD = `
  id, full_name, title_prefix, first_name, last_name, phone, age, gender,
  province, district, subdistrict, postal_code,
  weight_kg, height_cm, education, referral_source,
  document_filename, document_mime, (document_bytes is not null) as has_document,
  job_id, job_title, unit_name, position_interest, note, status, admin_note,
  line_id, specific_type, responsible_name, channel_label, license_types, created_by_name,
  created_at,
  claimed_by, claimed_by_name, claimed_at,
  false as is_lead, null::text as lead_by_name, null::timestamptz as lead_at
`;

/**
 * ชุดคอลัมน์แบบรัน 074 แล้วแต่**ยังไม่รัน 079** (คอลัมน์ "เก็บไปติดต่อ") —
 * ฟิลด์ 074 ต้องยังมาจริง ถอยไปชุด legacy ล่างไม่ได้ (มันจะ null ฟิลด์ 074 ทิ้ง
 * ทั้งที่ฐานมีข้อมูล — เจอกับดักนี้ตอนเขียน 079: ฐานจริงอยู่กึ่งกลางพอดี)
 */
const LIST_COLUMNS_NO_CLAIM = `
  id, full_name, title_prefix, first_name, last_name, phone, age, gender,
  province, district, subdistrict, postal_code,
  weight_kg, height_cm, education, referral_source,
  document_filename, document_mime, (document_bytes is not null) as has_document,
  job_id, job_title, unit_name, position_interest, note, status, admin_note,
  line_id, specific_type, responsible_name, channel_label, license_types, created_by_name,
  created_at,
  null::uuid as claimed_by, null::text as claimed_by_name, null::timestamptz as claimed_at,
  false as is_lead, null::text as lead_by_name, null::timestamptz as lead_at
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
  created_at,
  null::uuid as claimed_by, null::text as claimed_by_name, null::timestamptz as claimed_at,
  false as is_lead, null::text as lead_by_name, null::timestamptz as lead_at
`;

/** 42703 undefined_column — โค้ดใหม่ขึ้นก่อน migration 074 */
function isUndefinedColumn(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703'
  );
}

/**
 * ยิงด้วยคอลัมน์ชุดใหม่ก่อน · ยังไม่ migrate ค่อยถอยไปชุดเก่า (คอลัมน์ใหม่เป็น null)
 * `{{claimWhere}}` = เงื่อนไขที่อ้างคอลัมน์ claim (079) — ชุด legacy แทนด้วย true
 * เพราะคอลัมน์ยังไม่มีให้อ้าง (ยังไม่มีใครเก็บได้ = ไม่ต้องซ่อนใคร)
 */
/**
 * ประกอบคิวรีลิสต์ใบสมัคร — แยกออกมาเป็นฟังก์ชันล้วนเพื่อให้เทสต์จับได้
 *
 * ⚠️ **จำนวน param ที่ส่งลง pg ต้องเท่ากับ `$n` สูงสุดที่ SQL อ้างเสมอ**
 * ไม่งั้นได้ `bind message supplies 2 parameters, but prepared statement requires 1`
 * แล้ว **ทั้ง endpoint ตาย 500** · บั๊กจริงที่เจ้าของเจอเอง 13 ส.ค. 2569
 * ("โหลดรายชื่อผู้สมัครไม่สำเร็จ") — เดิม push viewerId ทุกครั้งแต่ใส่เงื่อนไข claim
 * ลง WHERE เฉพาะตอนไม่มี jobId → มุมมองรายใบ (dialog บนกล่องงาน) เปิดไม่ได้เลยสักใบ
 *
 * กติกาที่ต้องคงไว้: feed รวมซ่อนใบที่ **คนอื่น** เก็บไปแล้ว · มุมมองรายใบ **ไม่ซ่อน**
 * (dialog ต้องนับได้ว่า "ถูกเก็บแล้ว N คน" — ชื่อคนเก็บถูกตัดที่ toApplication อยู่แล้ว)
 */
export function buildApplicationsListQuery(input: {
  jobId?: string | null;
  scopedJobIds: Set<string> | null;
  viewerId: string;
  /** รหัสแผนกของผู้ใช้ (null = เห็นทุกแผนก) — ใช้คู่กับ department_code บนใบสมัคร */
  viewerDepartment?: string | null;
  /**
   * `?lead=1` — ดู **คลังสำรอง (Lead)** แทนรายชื่อทำงาน (เจ้าของเคาะ 12 ส.ค. 2569:
   * "ปัดแล้วหายจากทุกแท็บ + มีตัวกรองเรียกคืนดู") · ไม่ส่ง = ลิสต์ปกติที่ซ่อน Lead
   */
  leadView?: boolean;
}): {
  sql: string;
  params: unknown[];
  claimWhere: string;
  legacyClaimWhere: string;
  leadWhere: string;
} {
  const { jobId, scopedJobIds, viewerId, viewerDepartment } = input;
  const params: unknown[] = [];
  const conds: string[] = [];
  if (jobId) {
    params.push(jobId);
    conds.push(`job_id = $${params.length}`);
  } else if (scopedJobIds) {
    // ⚠️ **คลังกลาง: ใบขอปิดแล้วรายชื่อต้องไม่หาย** (เจ้าของเคาะ 13 ส.ค. 2569)
    // `scopedJobIds` สร้างจาก **ใบขอที่เปิดอยู่เท่านั้น** — ยึดตัวเดียวแปลว่าพอใบขอปิด
    // คนที่ถูกล็อก BU มองไม่เห็นใบสมัครนั้นอีกเลยทั้งระบบ · จึงยอมรับอีกทาง:
    // ใบที่ **จำแผนกของตัวเองไว้** (migration 082) และตรงกับแผนกผู้ใช้ ก็เห็นได้
    // สิทธิ์ไม่ได้ผ่อน — ยังเป็นแผนกเดียวกันเป๊ะ แค่ไม่ผูกกับ "ใบขอยังเปิดอยู่ไหม"
    params.push([...scopedJobIds]);
    const byJob = `job_id = any($${params.length}::text[])`;
    if (viewerDepartment) {
      params.push(viewerDepartment);
      conds.push(`(${byJob} or department_code = $${params.length})`);
    } else {
      conds.push(byJob);
    }
  }
  let claimWhere = 'true';
  let legacyClaimWhere = 'true';
  if (!jobId) {
    params.push(viewerId);
    claimWhere = `(claimed_by is null or claimed_by::text = $${params.length})`;
    // legacy ต้องยังอ้าง param เดิมครบ (เหตุผลเดียวกับข้างบน)
    legacyClaimWhere = `($${params.length} = $${params.length})`;
    conds.push('{{claimWhere}}');
  }
  /**
   * ⚠️ **Lead ซ่อนทุกแท็บ ไม่ใช่แค่แท็บเดียว** — แท็บของหน้า RM เป็นตัวกรองฝั่งหน้าเว็บ
   * ที่หั่นลิสต์ก้อนเดียวกัน จึงต้องกรองที่ต้นทาง (คิวรีนี้) ไม่ใช่ที่ตัวกรองแต่ละแท็บ
   *
   * ⚠️ เงื่อนไขนี้ **ไม่มี param** โดยตั้งใจ — ชุด legacy จึงแทนด้วย `true` ได้ตรง ๆ
   * ไม่ต้องทำ no-op ที่อ้าง param เหมือน claimWhere (กติกา "ส่ง param เท่ากับที่อ้าง")
   */
  /**
   * ⚠️ เปลี่ยน 14 ส.ค. 2569 (เจ้าของสั่ง): "เก็บ Lead → รายชื่อไปอยู่ที่การติดต่อแทน"
   * (เดิม Lead หายจากทุกแท็บไปคลังสำรอง ?lead=1)
   * - default list (RmWorkspace) → **ส่ง Lead มาด้วย** (`true`) แล้วให้ isInRmTab
   *   ฝั่งหน้าเว็บแบ่ง Lead เข้าแท็บ "การติดต่อ" (คู่กับ claim)
   * - dialog กล่องงาน (jobId) → **ยังซ่อน Lead** (เก็บ Lead แล้วออกจากที่สนใจ ไปการติดต่อ)
   * - ?lead=1 ยังใช้ได้ (แสดงเฉพาะ Lead) เผื่อดูอย่างเดียว แม้เอาปุ่มออกจากหน้าแล้ว
   */
  const leadWhere = jobId ? 'not is_lead' : input.leadView ? 'is_lead' : 'true';
  conds.push('{{leadWhere}}');
  return {
    sql: `select {{cols}} from ${tbl} ${conds.length ? `where ${conds.join(' and ')}` : ''}
        order by created_at desc limit 500`,
    params,
    claimWhere,
    legacyClaimWhere,
    leadWhere,
  };
}

async function queryWithLegacyFallback(
  sql: string,
  params: unknown[],
  claimWhere = 'true',
  // ⚠️ legacy ต้อง**ยังใช้ param ครบทุกตัว** — pg นับ param ที่ส่งมากับที่ SQL อ้างต้องเท่ากัน
  // ('bind message supplies N parameters') จึงแทนด้วยเงื่อนไข no-op ที่อ้าง param เดิม
  legacyClaimWhere = 'true',
  leadWhere = 'true',
): Promise<Row[]> {
  // ไล่สี่ชั้นตามอายุ schema: 074+079+083 → 074+079 → 074 เท่านั้น → ก่อน 074
  // (กลืนเฉพาะ 42703 คอลัมน์หาย — error อื่นโยนต่อ ตามกติกาข้อ 9)
  //
  // ⚠️ ชั้นที่ยังไม่มีคอลัมน์ Lead ใช้ `true` แทนเงื่อนไข — ยังไม่มีใครปัด Lead ได้
  // = ไม่มีใครต้องถูกซ่อน · แต่ถ้าเป็นมุมมอง "คลังสำรอง" จะได้ทุกแถวแทนที่จะได้ศูนย์
  // จึงต้องส่ง `false` มาแทน (ดูจุดเรียกใน handler)
  const fill = (cols: string, cw: string, lw: string) =>
    sql
      .replace(/\{\{cols\}\}/g, cols)
      .replace(/\{\{claimWhere\}\}/g, cw)
      .replace(/\{\{leadWhere\}\}/g, lw);
  try {
    const { rows } = await dbQuery<Row>(fill(LIST_COLUMNS, claimWhere, leadWhere), params);
    return rows;
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
  }
  const legacyLead = leadWhere === 'is_lead' ? 'false' : 'true';
  try {
    const { rows } = await dbQuery<Row>(fill(LIST_COLUMNS_NO_LEAD, claimWhere, legacyLead), params);
    return rows;
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
  }
  try {
    const { rows } = await dbQuery<Row>(
      fill(LIST_COLUMNS_NO_CLAIM, legacyClaimWhere, legacyLead),
      params,
    );
    return rows;
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
  }
  const { rows } = await dbQuery<Row>(fill(LIST_COLUMNS_LEGACY, legacyClaimWhere, legacyLead), params);
  return rows;
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

  return res.status(201).json({ item: toApplication(row, req.user.sub) });
}

/**
 * "เก็บผู้สมัครไปติดต่อ" — เจ้าของสั่ง 13 ส.ค. 2569 (กล่องงาน → เลือก → โผล่แท็บการติดต่อ
 * เห็นเฉพาะคนเก็บ) · เก็บ = claimed_by/claimed_at + สถานะขยับเป็น contacted ถ้ายัง new
 * · คืน = ล้าง claim (เฉพาะคนที่เก็บเอง) — สถานะไม่ย้อนกลับเอง ไม่เดาแทนคน
 */
async function patchClaim(req: AuthedReq, res: ApiRes, id: string, claim: boolean) {
  let curRows: Array<{ claimed_by: string | null; status: string; job_id: string | null; department_code: string | null }>;
  try {
    ({ rows: curRows } = await dbQuery<{ claimed_by: string | null; status: string; job_id: string | null; department_code: string | null }>(
      `select claimed_by, status, job_id, department_code from ${tbl} where id = $1 limit 1`,
      [id],
    ));
  } catch (e) {
    // ยังไม่รัน 079 → บอกตรง ๆ (แพตเทิร์นเดียวกับฟอร์มเพิ่มผู้สมัคร/074 — ไม่เก็บแบบทิ้งข้อมูล)
    if (isUndefinedColumn(e)) {
      return sendError(
        res,
        503,
        'Migration required',
        'ปุ่มเก็บไปติดต่อต้องรัน migration 079 ก่อน (node scripts/migrate.mjs) — ยังใช้ไม่ได้',
      );
    }
    throw e;
  }
  const cur = curRows[0];
  if (!cur) return sendError(res, 404, 'Not found');

  // จำกัดตาม BU — patchClaim แตกแขนงก่อนถึงด่าน scope ของ patchStatus จึงต้องเช็คเองที่นี่
  // (ไม่งั้น staff แผนกอื่นยิง {id, claim:true} เก็บใบข้ามแผนก + ดัน new→contacted ได้ด้วย id)
  if (!(await isApplicationInWriteScope(req.user, cur))) {
    return sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
  }

  if (claim) {
    if (cur.claimed_by && cur.claimed_by !== req.user.sub) {
      // DB ตัดสินการชนอีกชั้นด้วยเงื่อนไขใน UPDATE — ตรงนี้แค่ตอบให้อ่านรู้เรื่อง
      return sendError(res, 409, 'Conflict', 'มีเจ้าหน้าที่คนอื่นเก็บใบนี้ไปแล้ว');
    }
    const { rows } = await dbQuery<{ id: string }>(
      `update ${tbl}
          set claimed_by = $2, claimed_by_name = $3, claimed_at = now(),
              status = case when status = 'new' then 'contacted' else status end,
              updated_at = now()
        where id = $1 and (claimed_by is null or claimed_by = $2)
        returning id`,
      [id, req.user.sub, req.user.email || null],
    );
    if (rows.length === 0) return sendError(res, 409, 'Conflict', 'มีเจ้าหน้าที่คนอื่นเก็บใบนี้ไปแล้ว');
  } else {
    const { rows } = await dbQuery<{ id: string }>(
      `update ${tbl}
          set claimed_by = null, claimed_by_name = null, claimed_at = null, updated_at = now()
        where id = $1 and claimed_by = $2
        returning id`,
      [id, req.user.sub],
    );
    if (rows.length === 0) {
      return sendError(res, 403, 'Forbidden', 'คืนได้เฉพาะใบที่ตัวเองเก็บ');
    }
  }
  await auditFromAuthed(req, {
    action: claim ? 'job_application.claim' : 'job_application.unclaim',
    entityType: 'job_application',
    entityId: id,
    after: { claim },
  });
  const rows = await queryWithLegacyFallback(`select {{cols}} from ${tbl} where id = $1`, [id]);
  if (!rows[0]) return sendError(res, 404, 'Not found');
  return res.status(200).json({ item: toApplication(rows[0], req.user.sub) });
}

/**
 * PATCH `{ id, lead }` — "เก็บ Lead" / "ลบ Lead"
 *
 * ต่างจาก claim ตรงที่ Lead เป็นสถานะ **ระดับระบบ**: ใครปัดก็หายจากรายชื่อของทุกคน
 * (ตามระบบเดิม iRecruit) จึงไม่มีการชนแบบ 409 — คนหลังเขียนทับได้ · `lead_by`
 * เก็บไว้เพื่อสาวกลับว่าใครปัด ไม่ได้เอาไปคุมว่าใครเห็น
 *
 * ⚠️ **ไม่แตะ `status`** — ต่างจาก claim ที่ขยับ new → contacted · การปัดเข้าคลังสำรอง
 * ไม่ได้แปลว่าคุยกับเขาแล้ว การเดาแทนคนตรงนี้จะทำให้ยอด funnel เพี้ยน
 */
async function patchLead(req: AuthedReq, res: ApiRes, id: string, lead: boolean) {
  // จำกัดตาม BU ก่อนเสมอ — กันปัดใบสมัครของแผนกอื่นด้วยการเดา id (กติกาเดียวกับ patchStatus)
  // ต้องยอมใบที่จำแผนกตัวเองไว้ด้วย (082) ไม่งั้นใบขอปิดแล้วกดไม่ได้ทั้งที่แผนกตัวเอง
  const { rows: beforeRows } = await dbQuery<{ job_id: string | null; department_code: string | null }>(
    `select job_id, department_code from ${tbl} where id = $1 limit 1`,
    [id],
  );
  const before = beforeRows[0];
  if (!before) return sendError(res, 404, 'Not found');
  if (!(await isApplicationInWriteScope(req.user, before))) {
    return sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
  }

  const operator =
    (req.user as { full_name?: string; username?: string }).full_name ||
    (req.user as { username?: string }).username ||
    null;
  try {
    await dbQuery(
      lead
        ? `update ${tbl}
              set is_lead = true, lead_by = $2, lead_by_name = $3, lead_at = now(),
                  updated_at = now()
            where id = $1`
        : `update ${tbl}
              set is_lead = false, lead_by = null, lead_by_name = null, lead_at = null,
                  updated_at = now()
            where id = $1`,
      lead ? [id, req.user.sub, operator] : [id],
    );
  } catch (e) {
    // ยังไม่รัน 083 → บอกตรง ๆ ไม่เงียบ (แพตเทิร์นเดียวกับ claim/079)
    if (isUndefinedColumn(e)) {
      return sendError(
        res,
        503,
        'Migration required',
        'ปุ่มเก็บ Lead ต้องรัน migration 083 ก่อน (node scripts/migrate.mjs) — ยังใช้ไม่ได้',
      );
    }
    throw e;
  }

  await auditFromAuthed(req, {
    action: lead ? 'job_application.lead_add' : 'job_application.lead_remove',
    entityType: 'job_application',
    entityId: id,
    after: { lead },
  });
  const rows = await queryWithLegacyFallback(`select {{cols}} from ${tbl} where id = $1`, [id]);
  if (!rows[0]) return sendError(res, 404, 'Not found');
  return res.status(200).json({ item: toApplication(rows[0], req.user.sub) });
}

async function patchStatus(req: AuthedReq, res: ApiRes) {
  const raw = await readJsonBody(req);
  if (typeof raw !== 'object' || raw === null) {
    return sendError(res, 400, 'Bad request', 'Invalid JSON body');
  }
  const b = raw as Record<string, unknown>;
  const id = getString(b.id);
  if (!id) return sendError(res, 400, 'Bad request', 'id required');

  // "เก็บไปติดต่อ / คืน" — action แยกจากการแก้สถานะ/โน้ต
  if (typeof b.claim === 'boolean') return patchClaim(req, res, id, b.claim);
  // "เก็บ Lead / ลบ Lead" — ปัดออกจากรายชื่อทำงาน (ดู migration 083)
  if (typeof b.lead === 'boolean') return patchLead(req, res, id, b.lead);

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
    department_code: string | null;
  }>(`select status, admin_note, job_id, department_code from ${tbl} where id = $1 limit 1`, [id]);
  const before = beforeRows[0];
  if (!before) return sendError(res, 404, 'Not found');

  // จำกัดตาม BU — กันเปลี่ยนสถานะ/โน้ตใบสมัครของงานแผนกอื่นด้วยการเดา id
  // (ยอมใบที่จำแผนกตัวเองไว้ด้วย — ใบขอปิดแล้วต้องยังกดได้ถ้าเป็นแผนกตัวเอง)
  if (!(await isApplicationInWriteScope(req.user, before))) {
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

  return res.status(200).json({ item: toApplication(row, req.user.sub) });
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
      // ⚠️ ต้องกรอง `not is_lead` ให้ตรงกับ dialog กล่องงาน (?job_id= ใช้ leadWhere='not is_lead')
      // ไม่งั้นเก็บ Lead แล้วเลขบนการ์ด (8) ไม่ตรงกับที่กดเข้าไปเห็น (5) — เชื่อไม่ได้
      // ฐานที่ยังไม่รัน 083 (ไม่มีคอลัมน์ is_lead) → ถอยเป็นนับทั้งหมด (42703)
      const countsSql = (leadFilter: string) =>
        `select job_id, count(*)::text as n from ${tbl}
          where job_id is not null ${leadFilter} group by job_id`;
      let rows: Array<{ job_id: string; n: string }>;
      try {
        ({ rows } = await dbQuery<{ job_id: string; n: string }>(countsSql('and not is_lead')));
      } catch (e) {
        if (!isUndefinedColumn(e)) throw e;
        ({ rows } = await dbQuery<{ job_id: string; n: string }>(countsSql('')));
      }
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
    // แผนกของผู้ใช้ — คู่กับ department_code บนใบสมัคร ทำให้ใบขอปิดแล้วรายชื่อยังอยู่
    const deptScope = await loadUserDepartmentScope(req.user);
    const q = buildApplicationsListQuery({
      jobId,
      scopedJobIds,
      viewerId: req.user.sub,
      viewerDepartment: deptScope.mode === 'code' ? deptScope.code : null,
      leadView: getString(req.query?.lead) === '1',
    });
    const rows = await queryWithLegacyFallback(
      q.sql,
      q.params,
      q.claimWhere,
      q.legacyClaimWhere,
      q.leadWhere,
    );
    const items = rows.map((r) => toApplication(r, req.user.sub));

    // แนบผลโทรล่าสุดต่อคน — แท็บ "รายชื่อที่สนใจ" ของกล่องงานใช้ตัวนี้กรอง
    // (เจ้าของเคาะ 13 ส.ค. 2569: สนใจ = ตอบสนใจ **ตอนโทร** ไม่ใช่สถานะใบสมัคร)
    // ⚠️ คิวรีเดียวสำหรับทั้งลิสต์ · ล้มก็ไม่ทำให้รายชื่อหาย แค่ไม่มีผลโทรให้กรอง
    try {
      const byPhone = await loadLatestCallOutcomeByPhone(items.map((i) => i.phone));
      if (byPhone.size > 0) {
        for (const item of items) {
          const hit = byPhone.get(toE164Thai(item.phone || '') || '');
          if (hit) {
            (item as Record<string, unknown>).last_call_outcome = hit.outcome;
            (item as Record<string, unknown>).last_call_at = hit.at;
          }
        }
      }
      // วันนัดสัมภาษณ์ — มาได้ 2 ทาง (แท็บติดตามนัดหมายโชว์คอลัมน์นี้):
      // 1) ตกลงตอนโทร (call hold · migration 085 · คีย์เบอร์)
      // 2) บันทึกผลติดต่อ "สำเร็จ+นัดได้" (contact log · migration 086 · คีย์ใบ)
      // ⚠️ contact log ชนะ — เป็นการบันทึกที่เจาะจงใบนี้ตรง ๆ (มีสถานที่+ใบขอด้วย)
      const [apptByPhone, apptByApp] = await Promise.all([
        loadAppointmentByPhone(items.map((i) => i.phone)),
        loadContactAppointments(items.map((i) => i.id)),
      ]);
      for (const item of items) {
        const fromLog = apptByApp.get(item.id);
        const fromCall = apptByPhone.get(toE164Thai(item.phone || '') || '');
        const at = fromLog?.at ?? fromCall;
        if (at) {
          (item as Record<string, unknown>).appointment_at = at;
          if (fromLog?.place) (item as Record<string, unknown>).appointment_place = fromLog.place;
          if (fromLog?.jobLabel) (item as Record<string, unknown>).appointment_job = fromLog.jobLabel;
        }
      }
    } catch (e) {
      logError('job-applications: load call outcomes failed', e, { userId: req.user.sub });
    }
    return res.status(200).json({ items });
  } catch (e) {
    return handleApiError(res, e, 'job-applications GET', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'job-applications');
