/**
 * ═══ SQL ของแท็บ "สัดส่วน" หน้าหลัก (เจ้าของ 28 ต.ค. 2569) — นิยามอยู่หัว `src/lib/homeProportion.ts` ═══
 *
 * ยืมนิยามเดิมของหน้า "ระบบไปกี่ %" (`homeAiShareSql.ts`) ทั้งหมด:
 *   - AI โทรแล้ว = คิวของสายมีผลกลับที่ไม่ใช่ยกเลิก (`FOLLOW_CALLED_BY_AI_SQL`) · คนโทรแล้ว = เจ้าหน้าที่ลงผล (`staff_called_at` · 130)
 *   - ทีม = `follow_team` · ดูแลหลังเริ่มงาน = หัวข้อ `AFTERCARE_TOPIC` · BU = ตัวกลางของหน้าหลัก (`homeBuSql.ts`)
 *   - นับสายที่ถึงเวลาในช่วง (ปลายช่วงไม่เกินตอนนี้) ไม่นับที่ยกเลิก — นับ "ใครโทรไปแล้วจริง" ไม่ใช่แผน
 * AI โทรไม่ติด = ผลล่าสุดของคิวไม่ใช่การคุยกัน (`CONNECTED_OUTCOMES` ตัวเดียวกับใบสมัคร)
 *
 * พารามิเตอร์: `$1` จุดเริ่ม (null = ทั้งหมด) · `$2` จุดจบ (ไม่รวม) · `$3` BU (null = ทุก BU) · ติดตามมี `$4` = หัวข้อดูแลหลังเริ่มงาน
 */
import { tableInAppSchema } from './schema.js';
import { queueOutcome } from './lumosQueueDefs.js';
import { CALLED_BY_STAFF_SQL, CONNECTED_OUTCOMES, HELD_OR_CLAIMED_SQL } from './applicantOverviewSql.js';
import { FOLLOW_BUCKET_SQL, FOLLOW_EFFECTIVE_MODE_SQL } from './homeLumosSummarySql.js';
import { FOLLOW_ENTRY_CATEGORY_COLS, FOLLOW_QUEUE_CALL_COLS } from './followCategory.js';
import { FOLLOW_CALLED_BY_AI_SQL, FOLLOW_QUEUE_MATCH } from './homeAiShareSql.js';
import { appBuJoin, appBuSql, followBuJoin, followBuSql } from './homeBuSql.js';
import { SO_SCRAPING_CREATED_BY } from '../../src/lib/soScrapingLeads.js';

const APPS = tableInAppSchema('public_job_applications');
const FOLLOW = tableInAppSchema('follow_entries');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const CANCELLATIONS = tableInAppSchema('application_cancellations');
const POST_REQUESTS = tableInAppSchema('job_posting_requests');
const IRECRUIT_DUPS = tableInAppSchema('application_irecruit_dups');
const SUPPRESSION = tableInAppSchema('candidate_call_suppression');
const UNIT_NOTES = tableInAppSchema('siamraj_unit_notes');

/** AI โทรแล้วแต่ไม่ได้คุย (ไม่รับ · สายไม่ว่าง · ล้ม) */
const FOLLOW_AI_UNREACHED_SQL = `exists (
    select 1 from ${QUEUE} q
     where ${FOLLOW_QUEUE_MATCH}
       and ${queueOutcome('q')} is not null
       and ${queueOutcome('q')} <> 'cancelled'
       and ${queueOutcome('q')} not in ${CONNECTED_OUTCOMES})`;

/**
 * แถวสายของช่วง (ไม่นับยกเลิก) — ก้อน · AI/คน · ช่องผล (ตัวเดียวกับการ์ดผลโทรของหน้าหลัก `followLedgerBucket`) · เหตุที่ AI ไม่ได้ส่ง
 * นับต่อที่ Node (`summarizeFollowLane`) ⇒ ตัวเลขของแถวกับขั้นที่กดดูมาจากแถวชุดเดียวกัน บวกลบลงตัวเสมอ
 */
export function proportionFollowRowsSql(): string {
  return `
    select ${FOLLOW_ENTRY_CATEGORY_COLS},
           case when f.topic = $4::text then 'aftercare'
                when f.follow_team = 'replacement' then 'replacement'
                else 'starter' end as lane,
           ${FOLLOW_CALLED_BY_AI_SQL} as ai,
           (f.staff_called_at is not null) as staff,
           ${FOLLOW_AI_UNREACHED_SQL} as ai_unreached,
           ${FOLLOW_EFFECTIVE_MODE_SQL} as call_mode,
           f.dispatch_state,
           ${FOLLOW_BUCKET_SQL} as ledger_bucket,
           ${FOLLOW_QUEUE_CALL_COLS}
      from ${FOLLOW} f
      ${followBuJoin('f')}
      left join ${QUEUE} q on ${FOLLOW_QUEUE_MATCH}
     where f.cancelled_at is null
       and ($1::timestamptz is null or f.scheduled_at >= $1::timestamptz)
       and f.scheduled_at < $2::timestamptz
       and ($3::text is null or ${followBuSql('f')} = $3::text)`;
}

/**
 * ใบสมัครที่ยังไม่มีใครโทร — เหตุว่าทำไม (เจ้าของ 28 ต.ค. 2569 "ไม่โทรเท่าไหร่ เพราะอะไร … ขี้สงสัยแล้วตอบให้หมด")
 * ลำดับเดียว (CASE) ⇒ ใบละเหตุเดียว · ใบขอปิดแล้วต้องถาม ERP ⇒ ส่ง job_id ของใบที่ยังไม่รู้เหตุไปเช็กต่อที่ Node
 * + `claimed` = มีคนเก็บไป/ถืองานอยู่ (ใช้กับคนที่บอก AI ว่าสนใจด้วย — รอโทรแยก "เก็บแล้ว" กับ "ยังไม่มีใครเก็บ")
 */
export function proportionAppReasonsSql(): string {
  return `
    select a.id::text as id, a.job_id, ${HELD_OR_CLAIMED_SQL} as claimed,
           case
             when exists (select 1 from ${IRECRUIT_DUPS} d where d.application_id = a.id) then 'dup'
             when a.created_by_name = '${SO_SCRAPING_CREATED_BY}' then 'soScraping'
             when a.created_by_name is not null then 'keyed'
             when a.job_id is null then 'noJob'
             when a.ai_block_reason is not null then 'block'
             when a.phone_e164 is not null and exists (
               select 1 from ${SUPPRESSION} s where s.phone_e164 = a.phone_e164 and s.suppressed_until > now()) then 'suppressed'
             when not exists (
               select 1 from ${UNIT_NOTES} n
                where n.request_no = regexp_replace(a.job_id, '^siamraj-(sql|pre):', '')
                  and (n.field_overrides ? 'income' or n.field_overrides ? 'total_income')) then 'noIncome'
             else null end as reason,
           a.ai_block_reason as block_reason
      from ${APPS} a ${appBuJoin('a')}
     where ($1::timestamptz is null or a.created_at >= $1::timestamptz) and a.created_at < $2::timestamptz
       and ($3::text is null or ${appBuSql('a')} = $3::text)
       and not exists (select 1 from ${CANCELLATIONS} x where x.application_id = a.id)
       and not ${CALLED_BY_STAFF_SQL}`;
}

/**
 * ทางเข้า: ใบสมัคร (ไม่นับที่ยกเลิกข้อมูล) ตามวันกรอก · ใบส่งคนแทนตามวันที่สร้างแถว (นับใบ ไม่ใช่สาย) · คำขอโพสต์
 * ใบสมัคร: `source = 'irecruit'` = ดึง iRecruit · คนสร้าง = So Scraping = ระบบ · มีชื่อคนสร้างอื่น = คนคีย์/นำเข้า · ไม่มี = กรอกเอง
 */
export function proportionEntrySql(): string {
  return `
  select
    (select count(*) filter (where a.source is distinct from 'irecruit' and a.created_by_name is null)::int
       from ${APPS} a ${appBuJoin('a')}
      where ($1::timestamptz is null or a.created_at >= $1::timestamptz) and a.created_at < $2::timestamptz
        and ($3::text is null or ${appBuSql('a')} = $3::text)
        and not exists (select 1 from ${CANCELLATIONS} x where x.application_id = a.id)) as self_apply,
    (select count(*) filter (where a.source = 'irecruit')::int
       from ${APPS} a ${appBuJoin('a')}
      where ($1::timestamptz is null or a.created_at >= $1::timestamptz) and a.created_at < $2::timestamptz
        and ($3::text is null or ${appBuSql('a')} = $3::text)
        and not exists (select 1 from ${CANCELLATIONS} x where x.application_id = a.id)) as irecruit,
    (select count(*) filter (where a.source is distinct from 'irecruit' and a.created_by_name = '${SO_SCRAPING_CREATED_BY}')::int
       from ${APPS} a ${appBuJoin('a')}
      where ($1::timestamptz is null or a.created_at >= $1::timestamptz) and a.created_at < $2::timestamptz
        and ($3::text is null or ${appBuSql('a')} = $3::text)
        and not exists (select 1 from ${CANCELLATIONS} x where x.application_id = a.id)) as so_scraping,
    (select count(*) filter (where a.source is distinct from 'irecruit' and a.created_by_name is not null
                               and a.created_by_name <> '${SO_SCRAPING_CREATED_BY}')::int
       from ${APPS} a ${appBuJoin('a')}
      where ($1::timestamptz is null or a.created_at >= $1::timestamptz) and a.created_at < $2::timestamptz
        and ($3::text is null or ${appBuSql('a')} = $3::text)
        and not exists (select 1 from ${CANCELLATIONS} x where x.application_id = a.id)) as staff_keyed,
    (select count(distinct split_part(f.source_ref, ':', 2))::int
       from ${FOLLOW} f ${followBuJoin('f')}
      where f.source_ref like 'irecruit-replace:%'
        and ($1::timestamptz is null or f.created_at >= $1::timestamptz) and f.created_at < $2::timestamptz
        and ($3::text is null or ${followBuSql('f')} = $3::text)) as replace_sync,
    (select count(distinct split_part(f.source_ref, ':', 2))::int
       from ${FOLLOW} f ${followBuJoin('f')}
      where f.source_ref like 'manual-replace:%'
        and ($1::timestamptz is null or f.created_at >= $1::timestamptz) and f.created_at < $2::timestamptz
        and ($3::text is null or ${followBuSql('f')} = $3::text)) as replace_manual,
    (select count(*)::int from ${POST_REQUESTS} p
      where ($1::timestamptz is null or p.created_at >= $1::timestamptz) and p.created_at < $2::timestamptz
        and p.status is distinct from 'rejected') as post_orders`;
}
