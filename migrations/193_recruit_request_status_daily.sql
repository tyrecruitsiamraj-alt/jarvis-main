-- สถานะทำงานของใบขอ ณ สิ้นวัน (เจ้าของ 20 พ.ย. 2569 Choice "เริ่มกดจดทุกคืน") — ERP เก็บแค่สถานะปัจจุบัน
-- ภาพรวมโหมดเทียบเดือนจึงเทียบ "กำลังดำเนินการสรรหา / รอแจ้งเข้า …" ย้อนหลังไม่ได้ → จดใบที่ยังเปิดทุกใบ วันละแถว
-- ตัวจด `api/_lib/requestDailySnapshot.ts` เขียนทับของวันนี้ทุกชั่วโมง (รอบสุดท้ายของวัน = สิ้นวัน) · ตารางใหม่ เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม
create table if not exists recruit_request_status_daily (
  day date not null,
  job_id text not null,
  work_status text not null,
  recorded_at timestamptz not null default now(),
  primary key (day, job_id)
);
