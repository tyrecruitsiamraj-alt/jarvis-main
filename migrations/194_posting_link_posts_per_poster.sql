-- ═══ โพสต์เอง: คนละแถวต่อคนที่วาง (เจ้าของ 20 พ.ย. 2569 "ฉันใช้บัญชีฉันเพราะฉันไม่เคยให้ Pakorn กดเลย") ═══
-- เดิม 1 ลิงก์ · 1 วัน = แถวเดียว (177) ⇒ คนที่สองวางลิงก์โพสต์ลงลิงก์เดียวกันวันเดียวกัน = ไปเขียนทับลิงก์โพสต์ของคนแรก
-- แต่ชื่อคนโพสต์ยังเป็นคนแรก (บนเว็บจริง 20 พ.ย. 2569 ลิงก์ของเจ้าของไปอยู่ในชื่อเจมส์ · ลิงก์เดิมของเจมส์หาย)
-- → ไม่ซ้ำกันที่ (ลิงก์ · วัน · คนวาง) · คนเดิมวางซ้ำวันเดียวกัน = แก้แถวของตัวเอง · ไม่แตะข้อมูลเดิม (แถวเดิมผ่านเงื่อนไขใหม่อยู่แล้ว)
create unique index if not exists recruit_posting_link_posts_link_day_poster on recruit_posting_link_posts (link_id, day, posted_by_user_id);
alter table recruit_posting_link_posts drop constraint if exists recruit_posting_link_posts_pkey;
