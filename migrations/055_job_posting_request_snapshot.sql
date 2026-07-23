-- 055: แนบ "ข้อมูลใบขอ" (ตำแหน่ง/พื้นที่/รายได้ ฯลฯ) ไปกับคำขอโพสหางาน
-- ปัญหาเดิม: ทีมคอนเทนต์ (api-scraper) เห็นแค่เลขใบขอ เพราะรายละเอียดอยู่ MSSQL ที่เขาต่อไม่ได้
-- แก้: หน้า Matching มีข้อมูลครบอยู่แล้วตอนกดสร้างคำขอ → เก็บ snapshot ลง jsonb ให้ปลายทางใช้เลย
ALTER TABLE jarvis_rm.job_posting_requests
  ADD COLUMN IF NOT EXISTS job_snapshot jsonb;
