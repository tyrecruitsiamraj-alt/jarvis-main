-- รูปแนบโพสต์ Autopost (เจ้าของ 17 พ.ย. 2569 "คนอยากโพสต์พร้อมรูป" · Choice ทำทั้ง Jarvis + So Scraping)
-- ป๊อป Autopost อัปโหลดรูป → ใบสั่งส่ง image_url (`/api/public/post-image?id=`) ให้ So Scraping → บอทดาวน์โหลดตอนโพสต์
-- รูปไม่ลบ: ใบสั่งเก่า/โพสต์ซ้ำยังชี้รูปเดิมได้ · เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม
create table if not exists job_post_images (
  id uuid primary key default gen_random_uuid(),
  job_id text,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null,
  bytes bytea not null,
  created_by_name text,
  created_at timestamptz not null default now()
);
