-- master "ตำแหน่งงาน" ของงานสรรหา (RM) — ช่องตำแหน่งในฟอร์มเพิ่มผู้สมัคร/สร้างลิงก์
--
-- ที่มา: `recruit_master_job` บน iRecruit (499 แถว · owner='RM' 479 แถว)
--   วัดจากต้นทาง 12 ส.ค. 2569: RM active 427 · RM inactive 52 · IOO 20 (ไม่ยก)
--   `type` = รหัส BU ('LBD' 358 · 'LBA' 121) → เก็บเป็น `department_code` ฝั่งเรา
--
-- ⚠️ **ชื่อไทยซ้ำกันจริงในต้นทาง** (เช่น "เจ้าหน้าที่บัญชี" 4 แถว · "Engineer" 3 แถว)
-- เพราะซ้ำข้าม BU และมีของที่ปิดใช้งานแล้วค้างอยู่ — จึง **ห้ามทำ unique บนชื่อ**
-- สำหรับแถวที่ยกมา (แพตเทิร์นเดียวกับ recruit_channels ที่ลูกชื่อซ้ำในพ่อเดียวกัน 53 คู่)
--
-- ⚠️ ไม่ผูก CHECK ที่ hardcode รหัส BU — ตรวจที่ API จาก APP_DEPARTMENT_CODES ชุดเดียว
-- (บทเรียนเดิมจาก 039/053/054/056 · และ 077 ที่ต้องมาผ่อน CHECK ของ call holds ทีหลัง)

create table if not exists recruit_job_titles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  /** ชื่ออังกฤษจากต้นทาง — ส่วนใหญ่ว่าง เก็บไว้ให้ค้นเจอเมื่อมี */
  name_en text null,
  /** รหัส BU ที่ใช้ตำแหน่งนี้ — 'LBD' / 'LBA' · null = ไม่ระบุ/รหัสที่เราไม่รู้จัก */
  department_code text null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  /** ที่มา — 'irecruit' = ยกมา · null = คนคีย์เอง (แพตเทิร์นเดียวกับ recruit_channels/recruit_reasons) */
  source text null,
  source_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ยกซ้ำได้: หนึ่ง id ต้นทาง = หนึ่งแถวฝั่งเรา
create unique index if not exists recruit_job_titles_source_idx
  on recruit_job_titles (source, source_id)
  where source is not null;

-- ชื่อห้ามซ้ำ — **เฉพาะแถวที่คนคีย์เอง** (ของที่ยกมาซ้ำได้ตามต้นทาง)
create unique index if not exists recruit_job_titles_manual_name_idx
  on recruit_job_titles (lower(trim(name)))
  where source is null;

create index if not exists recruit_job_titles_lookup_idx
  on recruit_job_titles (is_active, sort_order);
