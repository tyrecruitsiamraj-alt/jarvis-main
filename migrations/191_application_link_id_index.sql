-- ดัชนีใบสมัครตามลิงก์ (เจ้าของ 19 พ.ย. 2569 "หน้าภาพรวมโหลดช้า")
-- วัดบนเว็บจริง: รายการลิงก์โพสต์เอง (`loadManualLinks`) 11.3 วิ — นับผู้สมัครรายลิงก์ `count(*) where a.link_id = l.id`
-- ลิงก์ในช่วง ~2,900 อัน × ไล่ใบสมัครทั้งตาราง (ไม่มีดัชนี link_id) · ใช้กับทุกที่ที่นับผู้สมัครรายลิงก์ (รายการลิงก์ · โพสต์เองรายวัน)
-- ลิงก์ตามวันสร้าง: ทุกเส้นที่กรองลิงก์ตามช่วงวันที่ (`l.created_at >= …`) · เพิ่มอย่างเดียว ไม่แตะข้อมูล
create index if not exists public_job_applications_link_id_idx on public_job_applications (link_id) where link_id is not null;
create index if not exists recruit_posting_links_created_at_idx on recruit_posting_links (created_at);
