/**
 * สรุปแบบบอท Lumos (หน้าหลัก `?summary=lumos` · 7 ต.ค. 2569) — นิยามอยู่ `src/lib/homeLumosSummary.ts`
 * รอ = ทุกสถานะที่ไม่ใช่ completed/failed/cancelled ⇒ สี่ช่องรวมกัน = ทั้งหมดเสมอ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { queueBuJoins, queueBuSql } from './homeBuSql.js';
import type { LumosBucket } from '../../src/lib/homeLumosSummary.js';

const QUEUE = tableInAppSchema('lumos_dispatch_queue');

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
): Promise<{ follow: LumosBucket; applicants: LumosBucket; backlog: number }> {
  const p = [start ? start.toISOString() : null, end ? end.toISOString() : null, bu];
  const [follow, apps, backlog] = await Promise.all([
    dbQuery<Row>(
      `select ${BUCKET_COLS}
         from ${QUEUE} q
         ${queueBuJoins('q')}
        where q.channel = 'reminder' and q.job_ref = 'follow'
          and ($1::timestamptz is null or coalesce(q_bf.scheduled_at, q.created_at) >= $1::timestamptz)
          and ($2::timestamptz is null or coalesce(q_bf.scheduled_at, q.created_at) < $2::timestamptz)
          and ($3::text is null or ${queueBuSql('q')} = $3::text)`,
      p,
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
  return { follow: bucket(follow.rows[0]), applicants: bucket(apps.rows[0]), backlog: Number(backlog.rows[0]?.n ?? 0) };
}
