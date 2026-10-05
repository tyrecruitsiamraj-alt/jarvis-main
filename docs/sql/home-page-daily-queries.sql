-- ═══ คิวรีตัวเลขหน้าหลัก "ระบบไปกี่ %" แยกรายวัน (สร้างจากโค้ดจริง 2026-10-05) ═══
--
-- ที่มา: api/_lib/homeAiShareSql.ts (โหมด byDayBu = ตัวเดียวกับกราฟตอนกดการ์ดบนหน้าหลัก)
-- แต่ละคิวรีห่อให้รวมทุก BU เป็น "แถวละวัน" — ผลรวมทุกแถว = เลขในกล่องบนหน้าหลักของช่วงเดียวกัน
-- วัน = วันตามเวลาไทย (Asia/Bangkok) · อ่านอย่างเดียว ไม่แก้ข้อมูล
--
-- 🔧 ที่ต้องแก้เวลาใช้ (ค้นแล้วแทนที่ทั้งไฟล์):
--   '2026-10-01 00:00:00+07'   = วันเริ่ม (รวมวันนี้)
--   '2026-10-06 00:00:00+07'   = วันจบ (ไม่รวม — อยากได้ถึงวันที่ 5 ใส่วันที่ 6)
--   null::text   = ทุก BU · อยากดู BU เดียวเปลี่ยนเป็น 'LBD'::text / 'LML'::text / 'LBA'::text
--   ⚠️ หน้าหลักตัดปลายช่วงที่ "ตอนนี้" (ยกเว้นก้อนติดตามที่นับแผนทั้งช่วง) — ดูย้อนหลังได้ผลเท่าหน้าหลักพอดี
--      ถ้าวันจบเป็นอนาคต ก้อนผู้สมัคร/ดูแล/จับคู่งานอาจต่างจากหน้าหลักเล็กน้อย
--
-- คอลัมน์: total = ทั้งหมด · ai = AI · staff = คน · both = ทั้งสองทาง · not_called = ยังไม่มีใครโทร

-- ════════════════════════════════════════════════════════════════════
-- ติดตาม
-- หน่วย = สาย (1 แถวในตาราง = 1 สาย) · นับแบบแผน: ทุกสายที่นัดในวันนั้น รวมที่ยกเลิก (เหมือนเลข "ทั้งหมด" หน้าติดตาม)
-- ai = ตั้งให้ AI โทร · staff = ตั้งให้คนโทร · team_replacement = ของแท็บติดตามส่งคนแทน (team_replacement_ai = ในนั้นตั้งให้ AI)
-- ════════════════════════════════════════════════════════════════════
select day,
       sum("total")::int as "total",
       sum("ai")::int as "ai",
       sum("staff")::int as "staff",
       sum("team_replacement")::int as "team_replacement",
       sum("team_replacement_ai")::int as "team_replacement_ai"
  from (
  with f0 as (
      select f.call_mode,
             /* ทีมของสาย (131) — หน้าแรกแยก "ติดตามคนเริ่มงาน / ติดตามส่งคนแทน" (เจ้าของสั่ง 4 ต.ค. 2569) */
             (f.follow_team = 'replacement') as replacement,
             (f.call_mode is distinct from 'manual') as ai,
             (f.call_mode = 'manual') as staff,
             exists (
      select 1 from "jarvis_rm".lumos_dispatch_queue q
       where q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text
         and q.status in ('pending', 'delivered')
         and coalesce(q.last_outcome, q.result->>'outcome') is null) as waiting_ai,
             to_char(timezone('Asia/Bangkok', f.scheduled_at), 'YYYY-MM-DD') as day,
             (case upper(btrim(coalesce(nullif(btrim(f_bu.department_code), ''), case when f.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(f.site_code from 3 for 3)) end))) when 'LML' then 'LM' when 'DSL' then 'DS' when 'SNJ' then 'SN' when 'CRS' then 'CR' else nullif(upper(btrim(coalesce(nullif(btrim(f_bu.department_code), ''), case when f.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(f.site_code from 3 for 3)) end))), '') end) as bu
        from "jarvis_rm".follow_entries f
        left join "jarvis_rm".users f_bu on f_bu.id = f.created_by
       where true
         and f.topic is distinct from 'ถามความเป็นอยู่หลังเริ่มงาน'::text
         and ('2026-10-01 00:00:00+07'::timestamptz is null or f.scheduled_at >= '2026-10-01 00:00:00+07'::timestamptz)
         and ('2026-10-06 00:00:00+07'::timestamptz is null or f.scheduled_at < '2026-10-06 00:00:00+07'::timestamptz)
         and (null::text is null or (case upper(btrim(coalesce(nullif(btrim(f_bu.department_code), ''), case when f.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(f.site_code from 3 for 3)) end))) when 'LML' then 'LM' when 'DSL' then 'DS' when 'SNJ' then 'SN' when 'CRS' then 'CR' else nullif(upper(btrim(coalesce(nullif(btrim(f_bu.department_code), ''), case when f.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(f.site_code from 3 for 3)) end))), '') end) = null::text)
    )
    select day, bu,
           count(*)::int                                                         as total,
           count(*) filter (where ai and not staff)::int                                      as ai,
           count(*) filter (where staff and not ai)::int                                   as staff,
           count(*) filter (where ai and staff)::int                                    as both,
           count(*) filter (where not ai and not staff)::int                               as not_called,
           count(*) filter (where not ai and not staff and waiting_ai)::int                as waiting_ai,
           count(*) filter (where not ai and not staff and call_mode = 'manual')::int      as waiting_staff,
           count(*) filter (where replacement)::int                                              as team_replacement,
           count(*) filter (where replacement and ai and not staff)::int                      as team_replacement_ai
      from f0
     group by day, bu
     order by day, bu
  ) by_day_bu
 group by day
 order by day;


-- ════════════════════════════════════════════════════════════════════
-- ดูแลหลังเริ่มงาน
-- หน่วย = สาย · เฉพาะสายที่ถึงเวลานัดแล้ว ไม่นับยกเลิก · ai/staff = ใครโทรไปแล้วจริง · both = โทรทั้งสองทาง
-- not_called = ยังไม่มีใครโทร (waiting_ai = รอคิว AI · waiting_staff = ตั้งให้คนโทร)
-- ════════════════════════════════════════════════════════════════════
select day,
       sum("total")::int as "total",
       sum("ai")::int as "ai",
       sum("staff")::int as "staff",
       sum("both")::int as "both",
       sum("not_called")::int as "not_called",
       sum("waiting_ai")::int as "waiting_ai",
       sum("waiting_staff")::int as "waiting_staff"
  from (
  with f0 as (
      select f.call_mode,
             /* ทีมของสาย (131) — หน้าแรกแยก "ติดตามคนเริ่มงาน / ติดตามส่งคนแทน" (เจ้าของสั่ง 4 ต.ค. 2569) */
             (f.follow_team = 'replacement') as replacement,
             exists (
      select 1 from "jarvis_rm".lumos_dispatch_queue q
       where q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text
         and coalesce(q.last_outcome, q.result->>'outcome') is not null
         and coalesce(q.last_outcome, q.result->>'outcome') <> 'cancelled') as ai,
             (f.staff_called_at is not null) as staff,
             exists (
      select 1 from "jarvis_rm".lumos_dispatch_queue q
       where q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text
         and q.status in ('pending', 'delivered')
         and coalesce(q.last_outcome, q.result->>'outcome') is null) as waiting_ai,
             to_char(timezone('Asia/Bangkok', f.scheduled_at), 'YYYY-MM-DD') as day,
             (case upper(btrim(coalesce(nullif(btrim(f_bu.department_code), ''), case when f.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(f.site_code from 3 for 3)) end))) when 'LML' then 'LM' when 'DSL' then 'DS' when 'SNJ' then 'SN' when 'CRS' then 'CR' else nullif(upper(btrim(coalesce(nullif(btrim(f_bu.department_code), ''), case when f.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(f.site_code from 3 for 3)) end))), '') end) as bu
        from "jarvis_rm".follow_entries f
        left join "jarvis_rm".users f_bu on f_bu.id = f.created_by
       where f.cancelled_at is null
         and f.topic = 'ถามความเป็นอยู่หลังเริ่มงาน'::text
         and ('2026-10-01 00:00:00+07'::timestamptz is null or f.scheduled_at >= '2026-10-01 00:00:00+07'::timestamptz)
         and ('2026-10-06 00:00:00+07'::timestamptz is null or f.scheduled_at < '2026-10-06 00:00:00+07'::timestamptz)
         and (null::text is null or (case upper(btrim(coalesce(nullif(btrim(f_bu.department_code), ''), case when f.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(f.site_code from 3 for 3)) end))) when 'LML' then 'LM' when 'DSL' then 'DS' when 'SNJ' then 'SN' when 'CRS' then 'CR' else nullif(upper(btrim(coalesce(nullif(btrim(f_bu.department_code), ''), case when f.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(f.site_code from 3 for 3)) end))), '') end) = null::text)
    )
    select day, bu,
           count(*)::int                                                         as total,
           count(*) filter (where ai and not staff)::int                                      as ai,
           count(*) filter (where staff and not ai)::int                                   as staff,
           count(*) filter (where ai and staff)::int                                    as both,
           count(*) filter (where not ai and not staff)::int                               as not_called,
           count(*) filter (where not ai and not staff and waiting_ai)::int                as waiting_ai,
           count(*) filter (where not ai and not staff and call_mode = 'manual')::int      as waiting_staff,
           count(*) filter (where replacement)::int                                              as team_replacement,
           count(*) filter (where replacement and ai and not staff)::int                      as team_replacement_ai
      from f0
     group by day, bu
     order by day, bu
  ) by_day_bu
 group by day
 order by day;


-- ════════════════════════════════════════════════════════════════════
-- ผู้สมัคร
-- หน่วย = ใบสมัคร · ตามวันที่สมัคร · ไม่นับ Lead · ai/staff/both = ใครโทรไปแล้ว
-- not_called = ยังไม่มีใครโทร (waiting_ai = อยู่คิว AI · held = มีคนเก็บ/ถือไว้ · untouched = ยังไม่มีใครแตะ)
-- ════════════════════════════════════════════════════════════════════
select day,
       sum("total")::int as "total",
       sum("ai")::int as "ai",
       sum("staff")::int as "staff",
       sum("both")::int as "both",
       sum("not_called")::int as "not_called",
       sum("waiting_ai")::int as "waiting_ai",
       sum("held")::int as "held",
       sum("untouched")::int as "untouched"
  from (
  with a0 as (
      select (exists (
    select 1 from "jarvis_rm".lumos_dispatch_queue q
     where q.person_ref = 'app-' || a.id::text
       and coalesce(q.last_outcome, q.result->>'outcome') is not null
       and coalesce(q.last_outcome, q.result->>'outcome') <> 'cancelled') or (a.phone_e164 is not null and exists (
      select 1 from "jarvis_rm".lumos_dispatch_queue q
       where coalesce(q.payload->>'recipient_phone', q.payload->>'phone') = a.phone_e164
         and coalesce(q.last_outcome, q.result->>'outcome') is not null
         and coalesce(q.last_outcome, q.result->>'outcome') <> 'cancelled'
         and coalesce(q.first_result_at, q.updated_at) >= a.created_at))) as ai,
             (exists (
    select 1 from "jarvis_rm".candidate_call_holds h
     where h.source = 'application' and h.candidate_ref = a.id::text
       and h.result_outcome is not null) or exists (
    select 1 from "jarvis_rm".application_contact_logs c where c.application_id = a.id) or (a.phone_e164 is not null and exists (
      select 1 from "jarvis_rm".candidate_call_holds h
       where h.phone_e164 = a.phone_e164
         and h.result_outcome is not null
         and coalesce(h.result_at, h.updated_at, h.released_at, h.held_at) >= a.created_at))) as staff,
             (
    exists (
      select 1 from "jarvis_rm".lumos_dispatch_queue q
       where q.status in ('pending','delivered')
         and coalesce(q.last_outcome, q.result->>'outcome') is null
         and (q.person_ref = 'app-' || a.id::text
              or (a.phone_e164 is not null and coalesce(q.payload->>'recipient_phone', q.payload->>'phone') = a.phone_e164)))
  ) as in_queue,
             (
    a.claimed_by is not null
    or (a.phone_e164 is not null and exists (
         select 1 from "jarvis_rm".candidate_call_holds h
          where h.phone_e164 = a.phone_e164 and h.released_at is null))
  ) as held,
             to_char(timezone('Asia/Bangkok', a.created_at), 'YYYY-MM-DD') as day,
             (case upper(btrim(coalesce(case when a_bm.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(a_bm.site_code from 3 for 3)) end, nullif(btrim(a.department_code), '')))) when 'LML' then 'LM' when 'DSL' then 'DS' when 'SNJ' then 'SN' when 'CRS' then 'CR' else nullif(upper(btrim(coalesce(case when a_bm.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(a_bm.site_code from 3 for 3)) end, nullif(btrim(a.department_code), '')))), '') end) as bu
        from "jarvis_rm".public_job_applications a
        left join "jarvis_rm".job_site_map a_bm on a_bm.job_id = a.job_id
       where not coalesce(a.is_lead, false)
         and ('2026-10-01 00:00:00+07'::timestamptz is null or a.created_at >= '2026-10-01 00:00:00+07'::timestamptz)
         and a.created_at < '2026-10-06 00:00:00+07'::timestamptz
         and (null::text is null or (case upper(btrim(coalesce(case when a_bm.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(a_bm.site_code from 3 for 3)) end, nullif(btrim(a.department_code), '')))) when 'LML' then 'LM' when 'DSL' then 'DS' when 'SNJ' then 'SN' when 'CRS' then 'CR' else nullif(upper(btrim(coalesce(case when a_bm.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(a_bm.site_code from 3 for 3)) end, nullif(btrim(a.department_code), '')))), '') end) = null::text)
    )
    select day, bu,
           count(*)::int                                                                        as total,
           count(*) filter (where ai and not staff)::int                                                     as ai,
           count(*) filter (where staff and not ai)::int                                                  as staff,
           count(*) filter (where ai and staff)::int                                                   as both,
           count(*) filter (where not ai and not staff)::int                                              as not_called,
           count(*) filter (where not ai and not staff and in_queue)::int                                 as waiting_ai,
           count(*) filter (where not ai and not staff and not in_queue and held)::int                    as held,
           count(*) filter (where not ai and not staff and not in_queue and not held)::int                as untouched
      from a0
     group by day, bu
     order by day, bu
  ) by_day_bu
 group by day
 order by day;


-- ════════════════════════════════════════════════════════════════════
-- จับคู่งาน
-- หน่วย = คน ต่อหนึ่งใบขอ (เบอร์ + ใบขอ) · ตามวันที่ส่งเข้าคิว AI / วันที่เจ้าหน้าที่รับไปโทร · ai/staff/both = ใครโทรไปแล้ว
-- not_called = ยังไม่มีใครโทร (waiting_ai = รอคิว AI · holding = เจ้าหน้าที่ถือไว้)
-- ════════════════════════════════════════════════════════════════════
select day,
       sum("total")::int as "total",
       sum("ai")::int as "ai",
       sum("staff")::int as "staff",
       sum("both")::int as "both",
       sum("not_called")::int as "not_called",
       sum("waiting_ai")::int as "waiting_ai",
       sum("holding")::int as "holding"
  from (
  with ev as (
      select coalesce(coalesce(q.payload->>'recipient_phone', q.payload->>'phone'), 'ref:' || q.person_ref) as person,
             q.job_ref as job,
             (coalesce(q.last_outcome, q.result->>'outcome') is not null and coalesce(q.last_outcome, q.result->>'outcome') <> 'cancelled') as ai_done,
             false as staff_done,
             (q.status in ('pending', 'delivered') and coalesce(q.last_outcome, q.result->>'outcome') is null) as ai_waiting,
             false as staff_holding,
             q.created_at as at,
             (case upper(btrim(case
        when q.job_ref = 'follow' or q.person_ref like 'follow-%'
          then coalesce(nullif(btrim(q_bu.department_code), ''), case when q_bf.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(q_bf.site_code from 3 for 3)) end)
        else coalesce(case when q_bm.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(q_bm.site_code from 3 for 3)) end, nullif(btrim(q_ba.department_code), ''))
      end)) when 'LML' then 'LM' when 'DSL' then 'DS' when 'SNJ' then 'SN' when 'CRS' then 'CR' else nullif(upper(btrim(case
        when q.job_ref = 'follow' or q.person_ref like 'follow-%'
          then coalesce(nullif(btrim(q_bu.department_code), ''), case when q_bf.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(q_bf.site_code from 3 for 3)) end)
        else coalesce(case when q_bm.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(q_bm.site_code from 3 for 3)) end, nullif(btrim(q_ba.department_code), ''))
      end)), '') end) as bu
        from "jarvis_rm".lumos_dispatch_queue q
        left join "jarvis_rm".job_site_map q_bm on q_bm.job_id = q.job_ref
         left join "jarvis_rm".public_job_applications q_ba on q.person_ref = 'app-' || q_ba.id::text
         left join "jarvis_rm".follow_entries q_bf on q.person_ref = 'follow-' || q_bf.id::text
         left join "jarvis_rm".users q_bu on q_bu.id = q_bf.created_by
       where (q.person_ref like 'card-%' or q.person_ref like 'ir-%') and coalesce(q.job_ref, '') <> 'follow'
         and not coalesce(q.status = 'cancelled' or coalesce(q.last_outcome, q.result->>'outcome') = 'cancelled', false)
      union all
      select h.phone_e164 as person,
             h.job_id as job,
             false as ai_done,
             (h.result_outcome is not null) as staff_done,
             false as ai_waiting,
             (h.released_at is null and h.result_outcome is null) as staff_holding,
             h.held_at as at,
             (case upper(btrim(case when h_bm.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(h_bm.site_code from 3 for 3)) end)) when 'LML' then 'LM' when 'DSL' then 'DS' when 'SNJ' then 'SN' when 'CRS' then 'CR' else nullif(upper(btrim(case when h_bm.site_code ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(h_bm.site_code from 3 for 3)) end)), '') end) as bu
        from "jarvis_rm".candidate_call_holds h
        left join "jarvis_rm".job_site_map h_bm on h_bm.job_id = h.job_id
       where h.source in ('board', 'irecruit')
    ),
    pairs as (
      select person, job,
             bool_or(ai_done) as ai,
             bool_or(staff_done) as staff,
             bool_or(ai_waiting) as waiting_ai,
             bool_or(staff_holding) as holding,
             -- วัน/BU ของคู่ = งานแรกในช่วง (คนเดียวกันใบเดียวกันนับวันเดียว BU เดียว)
             to_char(timezone('Asia/Bangkok', min(at)), 'YYYY-MM-DD') as day,
             (array_agg(bu order by at))[1] as bu
        from ev
       where ('2026-10-01 00:00:00+07'::timestamptz is null or at >= '2026-10-01 00:00:00+07'::timestamptz)
         and at < '2026-10-06 00:00:00+07'::timestamptz
         and (null::text is null or bu = null::text)
       group by person, job
    )
    select day, bu,
           count(*)::int                                                                  as total,
           count(*) filter (where ai and not staff)::int                                               as ai,
           count(*) filter (where staff and not ai)::int                                            as staff,
           count(*) filter (where ai and staff)::int                                             as both,
           count(*) filter (where not ai and not staff)::int                                        as not_called,
           count(*) filter (where not ai and not staff and waiting_ai)::int                         as waiting_ai,
           count(*) filter (where not ai and not staff and not waiting_ai and holding)::int         as holding
      from pairs
     group by day, bu
     order by day, bu
  ) by_day_bu
 group by day
 order by day;

