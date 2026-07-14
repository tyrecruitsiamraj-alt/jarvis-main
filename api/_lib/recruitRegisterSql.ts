import { irecruitSqlQuery } from './irecruitSqlServer.js';

export type RecruitRegisterSqlRow = {
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  age: number | null;
  sex: string | null;
  province_name: string | null;
  district_name: string | null;
  job_name_th: string | null;
  process_status_name: string;
  created_at: Date | string;
};

export type RecruitRegistration = {
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  age: number | null;
  sex: string | null;
  province_name: string | null;
  district_name: string | null;
  job_name_th: string | null;
  process_status_name: string;
  created_at: string;
  /** ข้อความสำหรับ geocode คร่าวๆ (อำเภอ + จังหวัด) */
  location_label: string | null;
};

export const RECRUIT_REGISTER_LIST_SQL = `
SELECT
    rr.first_name,
    rr.last_name,
    rr.phone_number,
    rr.age,
    rr.sex,
    p.pro_thname       AS province_name,
    d.district_thlist  AS district_name,
    rmj.name_th        AS job_name_th,
    CASE rr.process_status
        WHEN 'W' THEN N'รอดำเนินการ'
        WHEN 'A' THEN N'สำเร็จ'
        ELSE N'ไม่สำเร็จ'
    END                AS process_status_name,
    rr.created_at
FROM recruit_register rr
LEFT JOIN recruit_master_job rmj ON rmj.id = rr.job_interest_id
LEFT JOIN z_ms_province p        ON p.pro_id = rr.province_cerrently_id
LEFT JOIN z_ms_district d        ON d.district_id = rr.district_cerrently_id
WHERE rr.owner = @owner
  AND rr.status = 'A'
  AND rr.is_lead IS NULL
  AND rr.deleted_at IS NULL
ORDER BY rr.created_at DESC
`;

export const RECRUIT_REGISTER_MAX_LIMIT = 2000;

function toIso(v: Date | string | null | undefined): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

function buildLocationLabel(
  district: string | null | undefined,
  province: string | null | undefined,
): string | null {
  const d = district?.trim();
  const p = province?.trim();
  if (!d && !p) return null;
  if (d && p) return `${d}, ${p}`;
  return d || p || null;
}

function mapRow(r: RecruitRegisterSqlRow): RecruitRegistration {
  const province_name = r.province_name?.trim() || null;
  const district_name = r.district_name?.trim() || null;
  return {
    first_name: r.first_name?.trim() || null,
    last_name: r.last_name?.trim() || null,
    phone_number: r.phone_number?.trim() || null,
    age: typeof r.age === 'number' ? r.age : r.age == null ? null : Number(r.age),
    sex: r.sex?.trim() || null,
    province_name,
    district_name,
    job_name_th: r.job_name_th?.trim() || null,
    process_status_name: r.process_status_name,
    created_at: toIso(r.created_at),
    location_label: buildLocationLabel(district_name, province_name),
  };
}

function clampLimit(limit?: number): number | undefined {
  if (limit == null || !Number.isFinite(limit)) return undefined;
  return Math.min(Math.max(Math.floor(limit), 1), RECRUIT_REGISTER_MAX_LIMIT);
}

/** ผู้สมัครแบบ richer สำหรับ AI matching (มี positionName/ใบขับขี่/นน.-สส. เพิ่ม) */
export type RecruitCandidateForMatch = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  line_id: string | null;
  sex: string | null;
  age: number | null;
  weight: string | null;
  height: string | null;
  /** รายชื่อประเภทใบขับขี่ที่ decode แล้ว เช่น ["ท.2","ท.4"] */
  driving_licenses: string[];
  /** ตำแหน่งที่สมัคร (free-text) — สัญญาณแมทที่ดีที่สุด */
  position_name: string | null;
  /** ตำแหน่งจาก catalog (job_interest_id) */
  job_name_th: string | null;
  /** ที่มา/ประเภท lead เช่น "ไม่เจาะจง (ฟรี)" */
  specific_name: string | null;
  province_name: string | null;
  district_name: string | null;
  location_label: string | null;
  process_status_name: string;
  created_at: string;
};

type RecruitCandidateForMatchSqlRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  line_id: string | null;
  sex: string | null;
  age: number | null;
  weight: string | null;
  height: string | null;
  driving_license: string | null;
  position_name: string | null;
  job_name_th: string | null;
  specific_name: string | null;
  province_name: string | null;
  district_name: string | null;
  process_status_name: string;
  created_at: Date | string;
};

/** driving_license เก็บเป็น JSON array ของ code เช่น ["2","4"] → ชื่อประเภท */
const DRIVING_LICENSE_NAME_BY_CODE: Record<string, string> = {
  '1': 'ใบขับขี่บุคคล',
  '2': 'ท.2',
  '3': 'ท.3',
  '4': 'ท.4',
  '5': 'ใบขับขี่สาธารณะ',
};

function decodeDrivingLicenses(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((c) => DRIVING_LICENSE_NAME_BY_CODE[String(c).trim()] || null)
      .filter((x): x is string => Boolean(x));
  } catch {
    return [];
  }
}

const RECRUIT_MATCH_SELECT_FROM = `
SELECT TOP (@limit)
    rr.id,
    rr.first_name,
    rr.last_name,
    rr.phone_number,
    rr.line_id,
    rr.sex,
    rr.age,
    rr.weight,
    rr.height,
    rr.driving_license,
    CAST(rr.positionName AS varchar(400)) AS position_name,
    rmj.name_th        AS job_name_th,
    sp.name            AS specific_name,
    p.pro_thname       AS province_name,
    d.district_thlist  AS district_name,
    CASE rr.process_status
        WHEN 'W' THEN N'รอดำเนินการ'
        WHEN 'A' THEN N'สำเร็จ'
        ELSE N'ไม่สำเร็จ'
    END                AS process_status_name,
    rr.created_at
FROM recruit_register rr
LEFT JOIN recruit_master_job rmj ON rmj.id = rr.job_interest_id
LEFT JOIN recruit_master_specific sp ON sp.id = rr.specific_information
LEFT JOIN z_ms_province p        ON p.pro_id = rr.province_cerrently_id
LEFT JOIN z_ms_district d        ON d.district_id = rr.district_cerrently_id
`;

const RECRUIT_MATCH_BASE_WHERE = `
WHERE rr.owner = @owner
  AND rr.status = 'A'
  AND rr.is_lead IS NULL
  AND rr.deleted_at IS NULL
`;

function mapMatchRow(r: RecruitCandidateForMatchSqlRow): RecruitCandidateForMatch {
  const province_name = r.province_name?.trim() || null;
  const district_name = r.district_name?.trim() || null;
  return {
    id: r.id,
    first_name: r.first_name?.trim() || null,
    last_name: r.last_name?.trim() || null,
    phone_number: r.phone_number?.trim() || null,
    line_id: r.line_id?.trim() || null,
    sex: r.sex?.trim() || null,
    age: typeof r.age === 'number' ? r.age : r.age == null ? null : Number(r.age),
    weight: r.weight?.trim() || null,
    height: r.height?.trim() || null,
    driving_licenses: decodeDrivingLicenses(r.driving_license),
    position_name: r.position_name?.trim() || null,
    job_name_th: r.job_name_th?.trim() || null,
    specific_name: r.specific_name?.trim() || null,
    province_name,
    district_name,
    location_label: buildLocationLabel(district_name, province_name),
    process_status_name: r.process_status_name,
    created_at: toIso(r.created_at),
  };
}

/** escape อักขระพิเศษของ LIKE (% _ [) ไม่ให้ผู้ใช้/คีย์เวิร์ดทำ pattern เพี้ยน */
function escapeLike(s: string): string {
  return s.replace(/[%_[]/g, (c) => `[${c}]`);
}

/** ดึงผู้สมัครล่าสุด (ไม่กรอง keyword) — ใช้เป็น fallback */
export async function listRecruitCandidatesForMatch(options?: {
  owner?: string;
  limit?: number;
}): Promise<RecruitCandidateForMatch[]> {
  const owner = (options?.owner || process.env.RECRUIT_REGISTER_OWNER || 'RM').trim();
  const limit = clampLimit(options?.limit) ?? 500;
  const sql = `${RECRUIT_MATCH_SELECT_FROM}${RECRUIT_MATCH_BASE_WHERE}ORDER BY rr.created_at DESC`;
  const rows = await irecruitSqlQuery<RecruitCandidateForMatchSqlRow>(sql, { owner, limit });
  return rows.map(mapMatchRow);
}

/**
 * ค้นผู้สมัครทั่วทั้งฐานด้วยคีย์เวิร์ด (ตำแหน่งที่สมัคร/ตำแหน่งใน catalog LIKE)
 * — ครอบคลุมทุกคน ไม่ใช่แค่คนล่าสุด
 */
export async function listRecruitCandidatesByKeywords(
  keywords: string[],
  options?: { owner?: string; limit?: number },
): Promise<RecruitCandidateForMatch[]> {
  const owner = (options?.owner || process.env.RECRUIT_REGISTER_OWNER || 'RM').trim();
  const limit = clampLimit(options?.limit) ?? 800;
  const kws = [...new Set(keywords.map((k) => k.trim()).filter((k) => k.length >= 3))].slice(0, 25);
  if (kws.length === 0) return [];

  const likeConds = kws
    .map(
      (_, i) =>
        `(rmj.name_th LIKE @kw${i} OR CAST(rr.positionName AS varchar(400)) LIKE @kw${i})`,
    )
    .join(' OR ');
  const sql = `${RECRUIT_MATCH_SELECT_FROM}${RECRUIT_MATCH_BASE_WHERE}  AND (${likeConds})
ORDER BY rr.created_at DESC`;

  const inputs: Record<string, unknown> = { owner, limit };
  kws.forEach((k, i) => {
    inputs[`kw${i}`] = `%${escapeLike(k)}%`;
  });

  const rows = await irecruitSqlQuery<RecruitCandidateForMatchSqlRow>(sql, inputs);
  return rows.map(mapMatchRow);
}

export async function listRecruitRegistrations(options?: {
  owner?: string;
  limit?: number;
}): Promise<RecruitRegistration[]> {
  const owner = (options?.owner || process.env.RECRUIT_REGISTER_OWNER || 'RM').trim();
  const limit = clampLimit(options?.limit);

  const sql = limit
    ? RECRUIT_REGISTER_LIST_SQL.replace(
        'SELECT',
        'SELECT TOP (@limit)',
        1,
      )
    : RECRUIT_REGISTER_LIST_SQL;

  const inputs: Record<string, unknown> = { owner };
  if (limit) inputs.limit = limit;

  const rows = await irecruitSqlQuery<RecruitRegisterSqlRow>(sql, inputs);
  return rows.map(mapRow);
}
