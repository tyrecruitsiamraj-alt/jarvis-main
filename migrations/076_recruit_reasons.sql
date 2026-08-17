-- master "เหตุผล" ของงานสรรหา (RM) — ปุ่ม "เหตุผล" บนบอร์ด/หน้า RM
--
-- ที่มา: `recruit_master_reason` บน iRecruit (85 แถว) ผูกกับ `recruit_master_process`
--   process 1 = การติดต่อ · 2 = นัดหมาย · 3 = ติดตามการนัดหมาย
--   process_status  A = สำเร็จ · C = ไม่สำเร็จ
--
-- ⚠️ เก็บรหัสตามระบบเดิมเป๊ะ (`'1'/'2'/'3'` และ `'A'/'C'`) ไม่แปลงเป็นคำอังกฤษสวย ๆ
-- เหตุผลเดียวกับ `recruitRmMasters.ts`: ต้องเทียบข้ามระบบได้ตอนย้ายข้อมูล
-- ความหมาย (ป้ายภาษาไทย) อยู่ที่ `src/lib/recruitRmMasters.ts` ที่เดียว
--
-- ⚠️ ไม่ผูก CHECK ที่ hardcode ค่า — ตรวจที่ API จาก constant ชุดเดียว
-- (บทเรียนเดิมจาก 039/053/054/056 · แพตเทิร์นเดียวกับ recruit_channels)

create table if not exists recruit_reasons (
  id uuid primary key default gen_random_uuid(),
  /** ขั้นตอนที่ใช้เหตุผลนี้ — '1' การติดต่อ · '2' นัดหมาย · '3' ติดตามการนัดหมาย */
  process_code text not null,
  /** ผลของขั้นตอน — 'A' สำเร็จ · 'C' ไม่สำเร็จ */
  outcome_code text not null,
  name text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  /** ที่มา — 'irecruit' = ยกมา · null = คนคีย์เอง (แพตเทิร์นเดียวกับ recruit_channels) */
  source text null,
  source_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ยกซ้ำได้: หนึ่ง id ต้นทาง = หนึ่งแถวฝั่งเรา
create unique index if not exists recruit_reasons_source_idx
  on recruit_reasons (source, source_id)
  where source is not null;

-- ชื่อห้ามซ้ำในขั้นตอน+ผลเดียวกัน — เฉพาะแถวที่คนคีย์เอง
-- (ต้นทางมีชื่อซ้ำข้ามขั้นตอนจริง เช่น "ข้อมูลซ้ำ" · "ได้งานแล้ว" จึงคุมแค่ในคู่เดียวกัน)
create unique index if not exists recruit_reasons_manual_name_idx
  on recruit_reasons (process_code, outcome_code, lower(trim(name)))
  where source is null;

create index if not exists recruit_reasons_lookup_idx
  on recruit_reasons (process_code, outcome_code, sort_order);
