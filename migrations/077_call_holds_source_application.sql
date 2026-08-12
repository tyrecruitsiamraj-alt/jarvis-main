-- เพิ่ม 'application' เข้า source ของล็อกโทร (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก:
-- "ดึงเก็บไปโทร" จากแถวรายชื่อผู้สมัครบนบอร์ดรับสมัคร)
--
-- migration 068 ใส่ CHECK ไว้ที่คอลัมน์ (ต่างจาก recruit_postings ที่จงใจไม่ใส่) —
-- โค้ดฝั่ง API/UI รองรับ 'application' ไปก่อนแล้ว แต่ insert ชนข้อจำกัดนี้
-- (เจอตอนตรวจจริง: POST 500 `candidate_call_holds_source_check`)
--
-- ⚠️ ตัวตรวจค่าจริงอยู่ที่ `isCallHoldSource()` ใน api/_lib/candidateCallHolds.ts
-- CHECK นี้เป็นแค่รั้วชั้นฐาน — เพิ่ม source ใหม่ครั้งหน้าต้องแก้ทั้งสองที่

alter table candidate_call_holds
  drop constraint if exists candidate_call_holds_source_check;

alter table candidate_call_holds
  add constraint candidate_call_holds_source_check
  check (source in ('board', 'irecruit', 'application'));
