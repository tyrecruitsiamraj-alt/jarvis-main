/**
 * สรุปแบบบอท Lumos (หน้าหลัก `?summary=lumos` · 7 ต.ค. 2569) — นิยามอยู่ `src/lib/homeLumosSummary.ts`
 * รอ = ทุกสถานะที่ไม่ใช่ completed/failed/cancelled ⇒ สี่ช่องรวมกัน = ทั้งหมดเสมอ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { followBuJoin, followBuSql, queueBuJoins, queueBuSql } from './homeBuSql.js';
import { FOLLOW_QUEUE_MATCH } from './homeAiShareSql.js';
import { AFTERCARE_TOPIC } from '../../src/lib/aftercareRounds.js';
import { toYmdBangkok } from '../../src/lib/dateTh.js';
import {
  buildFollowPersonCells,
  doneBucketOf,
  followPersonKey,
  emptyFollowBucket,
  type FollowBucket,
  type FollowBucketKey,
  type FollowBuCell,
  type FollowPersonCell,
  type FollowTeamKey,
  type LumosBucket,
} from '../../src/lib/homeLumosSummary.js';
import { FOLLOW_TEAM_REPLACEMENT } from '../../src/lib/followReplacement.js';
import { categorizeFollowRows, FOLLOW_ENTRY_CATEGORY_COLS, FOLLOW_QUEUE_CALL_COLS } from './followCategory.js';
import { journeyResultOf } from '../../src/lib/followJourney.js';

const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const FOLLOW = tableInAppSchema('follow_entries');

/**
 * ใครโทรจริง (เจ้าของ Choice 12 ต.ค. 2569 "นับเป็น AI โทร") — สายที่ตั้งเป็นคนโทรแต่ AI โทรไปแล้วจริง (คิวจบ completed/failed)
 * และคนยังไม่ได้ลงผลเอง = นับเป็น AI · เคสจริง: กดพัก AI 11 ต.ค. 17:08 ขณะ AI กำลังโทร 18 สาย (หน้าหลักนับคน 0 · หน้าติดตามนับผลคน)
 * 🔴 ตัวคู่ฝั่งจอคือ `followCallerOf` (`src/lib/followListFilter.ts`) — ต้องตัดสินแบบเดียวกัน
 */
export const FOLLOW_EFFECTIVE_MODE_SQL = `case
      when f.call_mode = 'manual' and nullif(btrim(f.staff_call_outcome), '') is null
           and f.cancelled_at is null
           and q.status in ('completed', 'failed') then 'ai'
      else coalesce(f.call_mode, 'ai') end`;

/** ช่องของรายชื่อติดตาม — แยกกันขาด (CASE ลำดับเดียว) ⇒ รวมทุกช่อง = ทั้งหมด · ป๊อปกล่อง AI โทร/คนโทร ใช้ตัวนี้ด้วย */
export const FOLLOW_BUCKET_SQL = `case
      when (${FOLLOW_EFFECTIVE_MODE_SQL}) is distinct from 'manual' then
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

/** แถวสายติดตามของช่วง (ไม่รวมดูแลหลังเริ่มงาน) — ตัวเดียวของการ์ดผลโทร · ตาราง BU · รายการสายยกเลิกของกล่อง */
async function loadFollowLedgerRows(start: Date | null, end: Date | null, bu: string | null): Promise<Record<string, unknown>[]> {
  const { rows } = await dbQuery<Record<string, unknown>>(
    `select ${FOLLOW_ENTRY_CATEGORY_COLS}, ${FOLLOW_EFFECTIVE_MODE_SQL} as call_mode, f.follow_team,
            ${FOLLOW_BUCKET_SQL} as ledger_bucket,
            ${followBuSql('f')} as summary_bu,
            ${FOLLOW_QUEUE_CALL_COLS}
       from ${FOLLOW} f
       ${followBuJoin('f')}
       left join ${QUEUE} q on ${FOLLOW_QUEUE_MATCH}
      where f.topic is distinct from $4::text
        and ($1::timestamptz is null or f.scheduled_at >= $1::timestamptz)
        and ($2::timestamptz is null or f.scheduled_at < $2::timestamptz)
        and ($3::text is null or ${followBuSql('f')} = $3::text)`,
    [start ? start.toISOString() : null, end ? end.toISOString() : null, bu, AFTERCARE_TOPIC],
  );
  return rows;
}

/**
 * id ของสายที่การ์ดผลโทรจัดเป็น "ยกเลิก" (เจ้าของ 21 ต.ค. 2569 "บวกลบกันแล้วมันต้องเท่ากัน")
 * กล่อง/กราฟ/รายชื่อของหัวข้อติดตามตัดสายพวกนี้ออก (`buildFollowAiShareSql` `$5`) ⇒ ทุกก้อนบนหน้าหลักใช้ชุดยกเลิกชุดเดียว
 */
export async function loadFollowCancelledIds(start: Date | null, end: Date | null, bu: string | null): Promise<string[]> {
  const rows = await loadFollowLedgerRows(start, end, bu);
  const derived = categorizeFollowRows(rows);
  return rows.filter((r) => followLedgerBucket(r, derived) === 'cancelled').map((r) => String(r.id));
}

/**
 * ช่องของแถวหนึ่ง (แถวต้องมี `FOLLOW_BUCKET_SQL as ledger_bucket` + คอลัมน์ของ `categorizeFollowRows`)
 * 🔴 ตัวเดียวของการ์ดผลโทร · ตาราง BU · ป๊อปกล่อง AI โทร/คนโทร (QA 10 ต.ค. 2569 ป๊อปเคยนับด้วยหมวดหน้าติดตาม ไป 781 ≠ การ์ด 667 ·
 * เจ้าของเลือก "นับทีละสายตามผลจริง") — ขั้นแรกตัดด้วยผลคิว/ผลที่คนลง · "มีผล" ค่อยแตกด้วยหมวดของหน้าติดตาม
 */
export function followLedgerBucket(
  r: Record<string, unknown>,
  derived: ReturnType<typeof categorizeFollowRows>,
): FollowBucketKey {
  const first = String(r.ledger_bucket) as 'done' | 'waiting' | 'failed' | 'cancelled';
  if (first !== 'done') return first;
  const d = derived.get(String(r.id));
  const outcome =
    (typeof r.staff_call_outcome === 'string' && r.staff_call_outcome.trim()) ||
    (typeof r.call_outcome === 'string' ? r.call_outcome : null);
  return d ? doneBucketOf(journeyResultOf(d.category, outcome)) : 'unclear';
}

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
): Promise<{
  follow: { ai: FollowBucket; staff: FollowBucket };
  followByBu: FollowBuCell[];
  followPeople: FollowPersonCell[];
  applicants: LumosBucket;
  backlog: number;
}> {
  const p = [start ? start.toISOString() : null, end ? end.toISOString() : null, bu];
  const [follow, apps, backlog] = await Promise.all([
    loadFollowLedgerRows(start, end, bu),
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
  // หมวดของหน้าติดตาม — ใช้แตก "มีผล" เท่านั้น (รอ/ล้มเหลว/ยกเลิก ตัดด้วย CASE เดียวกับเดิม)
  const derived = categorizeFollowRows(follow);
  const split = { ai: emptyFollowBucket(), staff: emptyFollowBucket() };
  const byBuCells = new Map<string, FollowBuCell>();
  const personRows: Array<{ key: string; bu: string | null; team: FollowTeamKey; bucket: FollowBucketKey }> = [];
  for (const r of follow) {
    const b = r.call_mode === 'manual' ? split.staff : split.ai;
    const key = followLedgerBucket(r, derived);
    b[key] += 1;
    b.total += 1;
    // แยก BU — ช่องย่อยเดียวกับข้างบน (รวมทุกช่อง = split พอดี)
    const bu = typeof r.summary_bu === 'string' && r.summary_bu ? r.summary_bu : null;
    const team = r.follow_team === FOLLOW_TEAM_REPLACEMENT ? 'replacement' : 'main';
    const caller = r.call_mode === 'manual' ? 'manual' : 'ai';
    const ck = `${bu ?? ''}|${team}|${caller}|${key}`;
    const cell = byBuCells.get(ck) ?? { bu, team, caller, bucket: key, n: 0 };
    cell.n += 1;
    byBuCells.set(ck, cell);
    if (key !== 'cancelled') {
      const at = r.scheduled_at instanceof Date ? r.scheduled_at : new Date(String(r.scheduled_at ?? ''));
      const ymd = Number.isNaN(at.getTime()) ? 'no-date' : toYmdBangkok(at);
      personRows.push({ key: followPersonKey(r.recipient_phone, ymd, String(r.id)), bu, team, bucket: key });
    }
  }
  return {
    follow: split,
    followByBu: [...byBuCells.values()],
    followPeople: buildFollowPersonCells(personRows),
    applicants: bucket(apps.rows[0]),
    backlog: Number(backlog.rows[0]?.n ?? 0),
  };
}
