-- สำเนาข้อมูล ERP ของ Dashboard แนวโน้ม (28 ก.ย. 2569)
--
-- 🔴 ทำไม: เจ้าของสั่งทำแท็บ "Dashboard" ในหน้ากล่องงาน + ติดตาม ให้ผู้บริหารดูแนวโน้ม
-- รายวัน/สัปดาห์/เดือน/ปี · ข้อมูลใบขอย้อนหลังอยู่บน ERP (SQL Server) ซึ่งคิวรีช่วงยาวใช้ ~24 วินาที
-- (วัดจริง 28 ก.ย. 2569: 29 เดือน 5,882 แถว = 24.4 วิ) ⇒ ถามสดทุกครั้งที่เปิดแท็บไม่ได้
-- เจ้าของอนุญาต Choice 28 ก.ย.: "ได้ อ่านอย่างเดียว" — ERP อ่านอย่างเดียว · สำเนาเก็บฝั่งเรา
--
-- เก็บเป็นก้อน JSON ต่อคีย์ (ไม่ใช่ตารางแถวละใบขอ) เพราะ:
--   · อ่านทีเดียวทั้งก้อนตอนเปิดแท็บ ไม่มีจอไหน query รายแถว
--   · ERP เป็นต้นฉบับ สำเนานี้ทิ้ง/สร้างใหม่ได้ทุกเมื่อ (ลบแถวทิ้ง = ระบบดึงใหม่เอง)
--
-- ⚠️ ไม่ใช่ที่เก็บประวัติ — ค่าที่นี่ถูกเขียนทับทุกรอบที่รีเฟรช
-- ใครใช้: api/_lib/trendSnapshots.ts (อ่าน/เขียน) · api/_handlers/dashboard-trends.ts

create table if not exists dashboard_trend_snapshots (
  snapshot_key text primary key,
  payload jsonb not null,
  row_count integer not null default 0,
  fetched_at timestamptz not null default now(),
  duration_ms integer null
);

comment on table dashboard_trend_snapshots is
  'สำเนาข้อมูล ERP สำหรับ Dashboard แนวโน้ม (อ่านอย่างเดียวจาก ERP · เขียนทับทุกรอบรีเฟรช · ลบทิ้งได้ ระบบดึงใหม่เอง)';
comment on column dashboard_trend_snapshots.fetched_at is
  'เวลาที่ดึงจาก ERP ได้จริง — หน้าจอเอาไปบอกว่า "ข้อมูลเมื่อ … ที่แล้ว"';
