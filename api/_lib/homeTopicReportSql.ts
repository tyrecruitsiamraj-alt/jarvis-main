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
const MATCHES = tableInAppSchema('board_match_results');

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
    const [{ rows }, m] = await Promise.all([
      dbQuery<Record<string, unknown>>(buildMatchingAiShareSql('report'), params),
      // จับคู่ไว้รอ — ผลที่ระบบคิดไว้ของใบขอ (คิดใหม่ = เวลาเลื่อน ⇒ นับครั้งล่าสุดในช่วง) · คน × ใบขอ แยกสี
      dbQuery<{ jobs: number; people: number; green: number; yellow: number; red: number }>(
        `select count(distinct r.job_id)::int as jobs,
                count(x.m)::int as people,
                count(x.m) filter (where x.m->>'tier' = 'green')::int as green,
                count(x.m) filter (where x.m->>'tier' = 'yellow')::int as yellow,
                count(x.m) filter (where x.m->>'tier' = 'red')::int as red
           from ${MATCHES} r
           left join ${MAP} mp on mp.job_id = r.job_id
           left join lateral jsonb_array_elements(coalesce(r.result->'matches', '[]'::jsonb)) as x(m) on true
          where ($1::timestamptz is null or r.computed_at >= $1::timestamptz)
            and r.computed_at < $2::timestamptz
            and ($3::text is null or ${trendBuSql(siteBuSql('mp.site_code'))} = $3::text)`,
        params,
      ),
    ]);
    const s = m.rows[0];
    return buildMatchingReport(rows.map(toRow), {
      jobs: Number(s?.jobs ?? 0),
      people: Number(s?.people ?? 0),
      green: Number(s?.green ?? 0),
      yellow: Number(s?.yellow ?? 0),
      red: Number(s?.red ?? 0),
    });
  }
  const { rows } = await dbQuery<Record<string, unknown>>(buildFollowAiShareSql(true, 'aftercare', 'report'), [...params, AFTERCARE_TOPIC]);
  return buildAftercareReport(rows.map(toRow));
}
