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
import { groupThroughputByRequest, type OnlineApplicantRow, type OnlineRequestRow } from '../../src/lib/homeOnline.js';
import {
  AI_QUEUED_AT_SQL,
  CALLED_BY_AI_SQL,
  CALLED_BY_STAFF_SQL,
  IN_QUEUE_SQL,
  LATEST_AI_RESULT_LATERAL,
} from './applicantOverviewSql.js';
import { appBuJoin, appBuSql } from './homeBuSql.js';

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

type OnlineRequestOpts = { from: string; to: string; bu: string | null; departmentScope: DepartmentScope };

/** ใบขอที่ส่งเข้ามาในช่วง (ทุกสถานะ · ใบละแถว · กรอง BU) + รหัสใบ — ฐานเดียวของ "ใบขอเข้ามา" */
async function loadOnlineRequestGroups(opts: OnlineRequestOpts) {
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
  const jobIds = withBu.map((g) => g.jobId ?? `siamraj-sql:${g.requestNo}`);
  return { withBu, jobIds };
}

/**
 * ═══ "ใบขอเข้ามา · ประกาศแล้ว" ตัวเดียวของหน้าหลัก (QA 10 ต.ค. 2569 · เจ้าของเลือก "ใช้นิยามเดียวทั้งสองแท็บ") ═══
 * ใบขอ = ใบขอจริงที่ส่งเข้ามาในช่วง ทุกสถานะ (เปิด · ปิดครบ · ยกเลิก) · ประกาศแล้ว = ในชุดนั้นมีแถวประกาศ (จับด้วย id ตรงตัว)
 * เดิมแท็บงานสรรหานับ "ใบที่ยังเปิด + ใบขอล่วงหน้า" และ "การกดประกาศในช่วง (รวมใบเก่า)" ⇒ 55 · 44 ขณะที่ทีม Online 54 · 4
 * 🔴 ห้ามจับด้วยเลขที่ใบ — ใบขอล่วงหน้าเลขซ้ำใบจริง (`buildReleaseIndex` จับเลขด้วย)
 */
export async function loadOnlineRequestCounts(opts: OnlineRequestOpts): Promise<{ total: number; released: number }> {
  const { withBu, jobIds } = await loadOnlineRequestGroups(opts);
  if (withBu.length === 0) return { total: 0, released: 0 };
  const { rows } = await dbQuery<{ n: number }>(
    `select count(distinct job_id)::int as n from ${RELEASES} where job_id = any($1::text[])`,
    [jobIds],
  );
  return { total: withBu.length, released: Number(rows[0]?.n ?? 0) };
}

export async function loadOnlineRequestRows(opts: OnlineRequestOpts): Promise<OnlineRequestRow[]> {
  const { withBu, jobIds } = await loadOnlineRequestGroups(opts);
  if (withBu.length === 0) return [];

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

/**
 * ใบสมัครที่เข้ามาในช่วง (วันสมัคร · ไม่นับ Lead · ไม่นับที่ยกเลิกข้อมูล) — ส่วน "ใบสมัคร · AI คัดกรอง · คนโทรเอง"
 * หลักฐานโทร/คิว = ตัวเดียวกับกล่องงานสรรหา (`CALLED_BY_AI_SQL` · `IN_QUEUE_SQL` · `LATEST_AI_RESULT_LATERAL`)
 */
export async function loadOnlineApplicantRows(opts: { start: Date | null; end: Date; bu: string | null }): Promise<OnlineApplicantRow[]> {
  const { rows } = await dbQuery<Record<string, unknown>>(
    `select ${appBuSql('a')} as bu,
            a.job_id,
            a.age,
            a.created_at,
            ${AI_QUEUED_AT_SQL} as ai_queued_at,
            ${CALLED_BY_AI_SQL} as ai,
            ${CALLED_BY_STAFF_SQL} as staff,
            ${IN_QUEUE_SQL} as in_queue,
            air.outcome as ai_outcome, air.summary as ai_summary, air.reply as ai_reply
       from ${APPS} a
       ${appBuJoin('a')}
       ${LATEST_AI_RESULT_LATERAL}
      where not coalesce(a.is_lead, false)
        and not exists (select 1 from ${CANCELLATIONS} c where c.application_id = a.id)
        and ($1::timestamptz is null or a.created_at >= $1::timestamptz)
        and a.created_at < $2::timestamptz
        and ($3::text is null or ${appBuSql('a')} = $3::text)`,
    [opts.start ? opts.start.toISOString() : null, opts.end.toISOString(), opts.bu],
  );
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const bool = (v: unknown) => v === true || v === 't' || v === 'true';
  /**
   * ตำแหน่ง = ตำแหน่งของใบขอที่สมัคร (ตัวเดียวกับส่วนใบขอ) — ช่องในใบสมัครเป็นข้อความยาวจากหน้าประกาศ นับรวมไม่ได้
   * ใบขอล่วงหน้าฝั่งเรา (`siamraj-pre:`) / ไม่มีใบขอ = ไม่ระบุ
   */
  const reqNoOf = (jobId: string | null) => (jobId && jobId.startsWith('siamraj-sql:') ? jobId.slice('siamraj-sql:'.length).trim() : null);
  const reqNos = [...new Set(rows.map((r) => reqNoOf(str(r.job_id))).filter((x): x is string => !!x))];
  const extras = reqNos.length ? await loadErpExtras(reqNos) : new Map<string, ErpExtra>();
  const positionOf = (jobId: string | null) => {
    const no = reqNoOf(jobId);
    const x = no ? extras.get(no) : undefined;
    return x ? primaryJobRoleLabel(x.job_name1 ?? undefined, x.staff_title_name ?? undefined, x.job_description_code_1 ?? undefined)?.trim() || null : null;
  };
  return rows.map((r) => ({
    bu: str(r.bu),
    position: positionOf(str(r.job_id)),
    age: r.age == null ? null : Number(r.age),
    queued: r.ai_queued_at != null,
    ai: bool(r.ai),
    staff: bool(r.staff),
    inQueue: bool(r.in_queue),
    aiOutcome: str(r.ai_outcome),
    aiSummary: str(r.ai_summary),
    aiReply: str(r.ai_reply),
  }));
}

