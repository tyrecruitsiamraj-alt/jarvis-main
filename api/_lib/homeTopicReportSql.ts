/**
 * รายงานผลโทรของ งานสรรหา · จับคู่งาน · ดูแลหลังเริ่มงาน (หน้าหลัก `?report=<ก้อน>` · 7 ต.ค. 2569)
 * แถว = โหมด `report` ของตัวนับกล่อง (ชุดเดียวกับกล่อง ทั้งหมด/AI/คน) · นับต่อที่ `src/lib/homeTopicReport.ts` (pure)
 * ประกาศ = ใบขอที่ประกาศ (`job_public_releases.released_at`) ในช่วง — ⚠️ ประกาศซ้ำเขียนทับเวลา ⇒ นับตามครั้งล่าสุด
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { buildApplicantAiShareSql, buildFollowAiShareSql, buildMatchingAiShareSql } from './homeAiShareSql.js';
import { siteBuSql, trendBuSql } from './siteBuSql.js';
import { AFTERCARE_TOPIC } from '../../src/lib/aftercareRounds.js';
import {
  buildAftercareReport,
  buildApplicantsReport,
  buildMatchingReport,
  type ReportSourceRow,
  type TopicReport,
  type TopicReportBlock,
} from '../../src/lib/homeTopicReport.js';

const RELEASES = tableInAppSchema('job_public_releases');
const MAP = tableInAppSchema('job_site_map');

const bool = (v: unknown) => v === true || v === 't' || v === 'true';

function toRow(r: Record<string, unknown>): ReportSourceRow {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  return {
    ai: bool(r.ai),
    staff: bool(r.staff),
    bu: str(r.bu),
    ai_outcome: str(r.ai_outcome),
    ai_summary: str(r.ai_summary),
    ai_reply: str(r.ai_reply),
    ai_at: (r.ai_at as string | Date | null) ?? null,
    staff_outcome: str(r.staff_outcome),
    staff_at: (r.staff_at as string | Date | null) ?? null,
    age: r.age == null ? null : Number(r.age),
    appointment: r.appointment == null ? null : bool(r.appointment),
    attendance: str(r.attendance),
    log_ok: r.log_ok == null ? null : bool(r.log_ok),
    log_at: (r.log_at as string | Date | null) ?? null,
    retry: bool(r.retry),
    in_queue: bool(r.in_queue),
    held: bool(r.held),
    waiting_ai: bool(r.waiting_ai),
    holding: bool(r.holding),
    waiting_staff: bool(r.waiting_staff),
  };
}

export async function loadTopicReport(block: TopicReportBlock, start: Date | null, end: Date, bu: string | null): Promise<TopicReport> {
  const params = [start ? start.toISOString() : null, end.toISOString(), bu];
  if (block === 'applicants') {
    const [{ rows }, pub] = await Promise.all([
      dbQuery<Record<string, unknown>>(buildApplicantAiShareSql('report'), params),
      dbQuery<{ n: number }>(
        `select count(*)::int as n
           from ${RELEASES} r
           left join ${MAP} m on m.job_id = r.job_id
          where ($1::timestamptz is null or r.released_at >= $1::timestamptz)
            and r.released_at < $2::timestamptz
            and ($3::text is null or ${trendBuSql(siteBuSql('m.site_code'))} = $3::text)`,
        params,
      ),
    ]);
    return buildApplicantsReport(rows.map(toRow), Number(pub.rows[0]?.n ?? 0));
  }
  if (block === 'matching') {
    const { rows } = await dbQuery<Record<string, unknown>>(buildMatchingAiShareSql('report'), params);
    return buildMatchingReport(rows.map(toRow));
  }
  const { rows } = await dbQuery<Record<string, unknown>>(buildFollowAiShareSql(true, 'aftercare', 'report'), [...params, AFTERCARE_TOPIC]);
  return buildAftercareReport(rows.map(toRow));
}
