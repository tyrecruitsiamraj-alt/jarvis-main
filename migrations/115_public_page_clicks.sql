-- 115 — นับคลิกบนหน้าสาธารณะ (เจ้าของถาม 3 ก.ย. 2569: "แท็กจำนวนคลิกได้ไหม ในหน้าสาธารณะ")
--
-- ของที่มีอยู่แล้ว: `recruit_posting_links.hit_count` นับ "คลิกเปิดลิงก์ช่องทาง"
-- (วัดจริง 3 ก.ย.: 24 ลิงก์ · 103 คลิก) แต่ **ไม่รู้ว่าคนที่เข้ามาแล้วทำอะไรต่อ**
-- ตารางนี้เก็บสิ่งที่ยังไม่มี: กดดูงานใบไหน · กดปุ่มสมัครใบไหน · จากช่องทางไหน
--
-- 🔴 **เก็บเป็นยอดรายวัน ไม่เก็บรายคน** — ไม่มี IP ไม่มี user-agent ไม่มีคุกกี้
--    เหตุ: หน้าสาธารณะเป็นหน้าที่คนนอกใช้ ยอดรวมพอตอบคำถามธุรกิจแล้ว
--    (ถามว่า "ประกาศไหนมีคนสนใจ" ไม่ใช่ "ใครเข้ามาดู")
-- 🔴 **ห้ามใส่ CHECK บน action** — ของเดิมโดนมาสองรอบ (source, result_scope)
--    ค่าที่ไม่รู้จักให้เก็บไว้แล้วค่อยอ่าน ดีกว่าเขียนไม่ลงแล้วนับหาย

create table if not exists public_page_clicks (
  id bigserial primary key,
  -- วันไทย (ยอดรายวัน) — คีย์ร่วมกับที่เหลือเพื่อ upsert เพิ่มยอด
  day date not null,
  -- 'open_job' = กดดูรายละเอียดงาน · 'open_apply' = กดปุ่มสมัคร · 'submit' = ส่งใบสมัคร
  action text not null,
  -- ใบขอ/ประกาศที่ถูกกด — เก็บเป็นข้อความเพราะมีทั้ง id ใบขอ (3 prefix) และ id ประกาศ
  job_ref text null,
  posting_id uuid null,
  -- ช่องทางที่พาเข้ามา (จากรหัสลิงก์) — null = เข้าหน้ารวมตรง ๆ
  link_code text null,
  -- มาจากหน้าที่เอาไปฝัง iframe ไหม (?embed=1)
  embedded boolean not null default false,
  hits integer not null default 0,
  updated_at timestamptz not null default now()
);

-- หนึ่งแถวต่อ (วัน · การกระทำ · เป้าหมาย · ช่องทาง · ฝัง) — ที่เหลือบวกเข้าแถวเดิม
create unique index if not exists public_page_clicks_key_idx
  on public_page_clicks (
    day, action, coalesce(job_ref, ''), coalesce(posting_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(link_code, ''), embedded
  );

create index if not exists public_page_clicks_day_idx on public_page_clicks (day desc);
create index if not exists public_page_clicks_job_idx on public_page_clicks (job_ref) where job_ref is not null;
