-- เก็บผล AI แมท "คนของเรา" ต่อใบขอแบบถาวร (จากเดิม in-memory หายทุก restart)
-- ใช้เป็นแหล่งอ่านของ /api/matching/list (server-side pagination workflow filter)
-- และให้หน้า Matching โชว์ผลที่เคยคิดไว้ทันทีโดยไม่ต้องคิดใหม่

create table if not exists board_match_results (
  job_id text primary key,
  request_no text null,
  result jsonb not null,
  computed_at timestamptz not null default now()
);

create index if not exists board_match_results_computed_at_idx
  on board_match_results (computed_at desc);
