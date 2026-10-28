-- ═══ จดแรม/โหลดของเครื่องจริงทุก 1 นาที (เจ้าของ 28 ต.ค. 2569 "เช็ค performance issue ให้ทีมันน่าจะชอบทำให้ล่ม") ═══
-- 27 ต.ค. 20:37–21:22 เครื่องค้างทั้งเครื่องตอน build (Error 1033 · หา github.com ไม่เจอ) แต่ไม่มีตัวเลขเหลือให้ดูเลย
-- ช่วงที่แถวหายไป = เครื่องค้าง/ล่ม · เก็บ 14 วัน (ตัวจดลบของเก่าเอง) · ตัวจดอยู่ api/_lib/systemResourceSampler.ts
create table if not exists system_resource_samples (
  id bigserial primary key,
  sampled_at timestamptz not null default now(),
  mem_total_mb integer,
  mem_available_mb integer,
  swap_total_mb integer,
  swap_free_mb integer,
  load1 numeric(6, 2),
  load5 numeric(6, 2),
  cpu_count integer,
  api_rss_mb integer,
  api_heap_mb integer,
  loop_delay_max_ms integer,
  host_uptime_s integer
);

create index if not exists system_resource_samples_sampled_at_idx on system_resource_samples (sampled_at desc);
