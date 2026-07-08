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
