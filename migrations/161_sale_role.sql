-- ═══ บทบาท Sale (เจ้าของ 22 ต.ค. 2569 "ทำบทบาท sale ไว้รอ") ═══
-- ฝ่ายขาย — อ่านอย่างเดียวชุดเดียวกับ OPL จนกว่าหน้าประเมิน Tier ใบขอ (Sale → สรรหา → OPL) เสร็จ
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'supervisor', 'staff', 'opl', 'sale'));
