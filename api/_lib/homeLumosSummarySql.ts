/**
 * สรุปแบบบอท Lumos (หน้าหลัก `?summary=lumos` · 7 ต.ค. 2569) — นิยามอยู่ `src/lib/homeLumosSummary.ts`
 * รอ = ทุกสถานะที่ไม่ใช่ completed/failed/cancelled ⇒ สี่ช่องรวมกัน = ทั้งหมดเสมอ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { followBuJoin, followBuSql, queueBuJoins, queueBuSql } from './homeBuSql.js';
import { FOLLOW_QUEUE_MATCH } from './homeAiShareSql.js';
import { AFTERCARE_TOPIC } from '../../src/lib/aftercareRounds.js';
import { emptyLumosBucket, type LumosBucket } from '../../src/lib/homeLumosSummary.js';

const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const FOLLOW = tableInAppSchema('follow_entries');

/** ช่องของรายชื่อติดตาม — แยกกันขาด (CASE ลำดับเดียว) ⇒ รวมทุกช่อง = ทั้งหมด */
const FOLLOW_BUCKET_SQL = `case
      when f.call_mode is distinct from 'manual' then
        case when q.status = 'completed' then 'done'
             when q.status = 'failed' then 'failed'
             when q.status = 'cancelled' or f.cancelled_at is not null then 'cancelled'
             else 'waiting' end
      else
        case when f.staff_call_outcome = 'no_answer' then 'failed'
             when nullif(btrim(f.staff_call_outcome), '') is not null then 'done'
             when f.cancelled_at is not null then 'cancelled'
             else 'waiting' end
    end`;

const BUCKET_COLS = `count(*)::int as total,
         count(*) filter (where q.status = 'completed')::int as done,
         count(*) filter (where q.status = 'failed')::int as failed,
         count(*) filter (where q.status = 'cancelled')::int as cancelled,
         count(*) filter (where q.status is null or q.status not in ('completed', 'failed', 'cancelled'))::int as waiting`;

type Row = { total: number; done: number; failed: number; cancelled: number; waiting: number };
const bucket = (r: Row | undefined): LumosBucket => ({
  total: Number(r?.total ?? 0),
  done: Number(r?.done ?? 0),
  waiting: Number(r?.waiting ?? 0),
  failed: Number(r?.failed ?? 0),
  cancelled: Number(r?.cancelled ?? 0),
});

export async function loadHomeLumosSummary(
  start: Date | null,
  end: Date | null,
  bu: string | null,
): Promise<{ follow: { ai: LumosBucket; staff: LumosBucket }; applicants: LumosBucket; backlog: number }> {
  const p = [start ? start.toISOString() : null, end ? end.toISOString() : null, bu];
  const [follow, apps, backlog] = await Promise.all([
    dbQuery<{ who: string; bucket: keyof Omit<LumosBucket, 'total'>; n: number }>(
      `select case when f.call_mode = 'manual' then 'staff' else 'ai' end as who,
              ${FOLLOW_BUCKET_SQL} as bucket,
              count(*)::int as n
         from ${FOLLOW} f
         ${followBuJoin('f')}
         left join ${QUEUE} q on ${FOLLOW_QUEUE_MATCH}
        where f.topic is distinct from $4::text
          and ($1::timestamptz is null or f.scheduled_at >= $1::timestamptz)
          and ($2::timestamptz is null or f.scheduled_at < $2::timestamptz)
          and ($3::text is null or ${followBuSql('f')} = $3::text)
        group by 1, 2`,
      [...p, AFTERCARE_TOPIC],
    ),
    dbQuery<Row>(
      `select ${BUCKET_COLS}
         from ${QUEUE} q
         ${queueBuJoins('q')}
        where q.channel = 'interview'
          and ($1::timestamptz is null or q.created_at >= $1::timestamptz)
          and ($2::timestamptz is null or q.created_at < $2::timestamptz)
          and ($3::text is null or ${queueBuSql('q')} = $3::text)`,
      p,
    ),
    start
      ? dbQuery<{ n: number }>(
          `select count(*)::int as n
             from ${QUEUE} q
             ${queueBuJoins('q')}
            where q.channel = 'interview'
              and q.created_at < $1::timestamptz
              and (q.status is null or q.status not in ('completed', 'failed', 'cancelled'))
              and ($2::text is null or ${queueBuSql('q')} = $2::text)`,
          [p[0], bu],
        )
      : Promise.resolve({ rows: [{ n: 0 }] }),
  ]);
  const split = { ai: emptyLumosBucket(), staff: emptyLumosBucket() };
  for (const r of follow.rows) {
    const b = r.who === 'staff' ? split.staff : split.ai;
    b[r.bucket] += Number(r.n);
    b.total += Number(r.n);
  }
  return { follow: split, applicants: bucket(apps.rows[0]), backlog: Number(backlog.rows[0]?.n ?? 0) };
}
