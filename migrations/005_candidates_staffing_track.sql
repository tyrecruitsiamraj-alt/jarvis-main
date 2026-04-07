-- ถ้ารันครั้งแรกหลังอัปเดตนี้: ใช้สามค่า (รัน 006 ถ้าเคยมีคอลัมน์แบบเก่าแล้ว)
-- regular = พนักงานประจำ, wl = WL, ex = EX

alter table candidates
  add column if not exists staffing_track text not null default 'regular'
  check (staffing_track in ('regular', 'wl', 'ex'));

create index if not exists candidates_staffing_track_idx on candidates (staffing_track);
