/**
 * ═══ หน้าหลัก แท็บ "ทีม Online" — ตัวโหลดข้อมูล (อ่านอย่างเดียว · 8 ต.ค. 2569) ═══
 * ชั้นคู่ขนาน — ไม่แก้ตัวดึงของหน้า Dashboard (กติกา "ห้ามเขียนทับแดชบอร์ดเดิม")
 * - ใบขอ = `listSiamrajThroughput` (ตัวเดียวกับการ์ด เข้ามา/ปิด/ยกเลิก ของหน้า Dashboard) แต่กรอง**วันที่ใบส่งเข้ามา** → รวมเป็นใบละแถว
 * - กลุ่มอุตสาหกรรม + ตำแหน่ง = ERP (`ms_site.industry_group_code` · ตำแหน่งตัวเดียวกับใบขอ `primaryJobRoleLabel`)
 * - ราชการ/เอกชน = ที่ทีมระบุเอง (`unit_sector`) · ประกาศ = `job_public_releases` · ใบสมัคร = ไม่นับที่ยกเลิกข้อมูล
 * นับต่อที่ `src/lib/homeOnline.ts` (pure)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { listSiamrajThroughput } from './siamrajUnitRequests.js';
import { getUnitSectorMap } from './unitSectorStore.js';
import { primaryJobRoleLabel } from './siamrajJobMapping.js';
import type { DepartmentScope } from './departmentScope.js';
import { trendBuFromSiteCode } from '../../src/lib/trends/bu.js';
import { groupThroughputByRequest, type OnlineRequestRow } from '../../src/lib/homeOnline.js';

const RELEASES = tableInAppSchema('job_public_releases');
const APPS = tableInAppSchema('public_job_applications');
const CANCELLATIONS = tableInAppSchema('application_cancellations');

type ErpExtra = { request_no: string; industry: string | null; job_name1: string | null; staff_title_name: string | null; job_description_code_1: string | null };

/** กลุ่มอุตสาหกรรม + ตำแหน่งของใบขอ — ทีละ 300 ใบ (พารามิเตอร์ SQL Server จำกัด) */
async function loadErpExtras(requestNos: readonly string[]): Promise<Map<string, ErpExtra>> {
  const out = new Map<string, ErpExtra>();
  for (let i = 0; i < requestNos.length; i += 300) {
    const chunk = requestNos.slice(i, i + 300);
    const params = Object.fromEntries(chunk.map((v, k) => [`r${k}`, v]));
    const rows = await siamrajSqlQuery<ErpExtra>(
      `SELECT RTRIM(A.request_no) AS request_no,
              (SELECT TOP 1 RTRIM(g.industry_group_name) FROM ms_industry_group g WHERE g.industry_group_code = SS.industry_group_code) AS industry,
              (SELECT TOP 1 z.job_description_name FROM hr_ms_job_description_1 z WHERE z.job_description_code_1 = A.job_description_code_1) AS job_name1,
              (SELECT TOP 1 z.staff_title_name FROM hr_ms_staff_title z WHERE z.staff_title_code = A.staff_title_code) AS staff_title_name,
              A.job_description_code_1
         FROM st_request_head A
         LEFT JOIN ms_site SS ON SS.site_code = A.site_code
        WHERE RTRIM(A.request_no) IN (${chunk.map((_, k) => `@r${k}`).join(',')})`,
      params,
    );
    for (const r of rows) out.set(String(r.request_no).trim(), r);
  }
  return out;
}

export async function loadOnlineRequestRows(opts: {
  from: string;
  to: string;
  bu: string | null;
  departmentScope: DepartmentScope;
}): Promise<OnlineRequestRow[]> {
  // 🔴 นับตามวันที่ใบส่งเข้ามา (เจ้าของ 8 ต.ค. 2569 Choice) — หน้า Dashboard ยังนับตามวันที่ต้องการคน (ค่าเริ่มของตัวดึง)
  const records = await listSiamrajThroughput({
    from: opts.from,
    to: opts.to,
    departmentScope: opts.departmentScope,
    dateBasis: 'submitted',
  });
  const grouped = groupThroughputByRequest(
    records.map((r) => ({ ...r, requestDate: r.submittedDate || r.requestDate })),
  ).filter((g) => g.day >= opts.from && g.day <= opts.to);
  const withBu = grouped
    .map((g) => ({ ...g, bu: trendBuFromSiteCode(g.siteCode) }))
    .filter((g) => !opts.bu || g.bu === opts.bu);
  if (withBu.length === 0) return [];

  const jobIds = withBu.map((g) => g.jobId ?? `siamraj-sql:${g.requestNo}`);
  const [extras, sectors, releases, apps] = await Promise.all([
    loadErpExtras(withBu.map((g) => g.requestNo)),
    getUnitSectorMap(),
    dbQuery<{ job_id: string; released_at: string }>(
      `select job_id, released_at from ${RELEASES} where job_id = any($1::text[])`,
      [jobIds],
    ),
    dbQuery<{ job_id: string; n: number }>(
      `select a.job_id, count(*)::int as n
         from ${APPS} a
        where a.job_id = any($1::text[])
          and not exists (select 1 from ${CANCELLATIONS} c where c.application_id = a.id)
        group by a.job_id`,
      [jobIds],
    ),
  ]);
  const releasedAt = new Map(releases.rows.map((r) => [r.job_id, new Date(r.released_at).toISOString()]));
  const appCount = new Map(apps.rows.map((r) => [r.job_id, Number(r.n)]));

  return withBu.map((g, i) => {
    const jobId = jobIds[i];
    const x = extras.get(g.requestNo);
    const position = x ? primaryJobRoleLabel(x.job_name1 ?? undefined, x.staff_title_name ?? undefined, x.job_description_code_1 ?? undefined) : null;
    return {
      requestNo: g.requestNo,
      jobId,
      day: g.day,
      bu: g.bu,
      requested: g.requested,
      filled: g.filled,
      cancelled: g.cancelled,
      remaining: g.remaining,
      unitName: g.unitName,
      industry: x?.industry?.trim() || null,
      sector: (g.siteCode && sectors[g.siteCode]) || null,
      position: position?.trim() || null,
      releasedAt: releasedAt.get(jobId) ?? null,
      applications: appCount.get(jobId) ?? 0,
    };
  });
}
