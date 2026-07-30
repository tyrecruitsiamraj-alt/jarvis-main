-- นับจำนวนครั้งที่เสิร์ฟให้ Lumos — เปลี่ยน delivery เป็น at-least-once:
-- รายการที่ถูกดึงแล้วแต่ไม่มีผลกลับ จะถูกเสิร์ฟซ้ำ (สูงสุด 5 ครั้ง) จนกว่า Lumos จะ POST ผล

alter table lumos_dispatch_queue
  add column if not exists delivery_count integer not null default 0;

-- ของเดิมที่เคยถูกดึงไปแล้วก่อน migration นี้: ตั้งเป็นเพดาน (5) เพื่อไม่ให้ถูกยิงซ้ำอัตโนมัติ
-- (ถ้าต้องการส่งซ้ำชุดไหน ให้ reset delivery_count/status เป็นรายกรณี)
update lumos_dispatch_queue
   set delivery_count = 5
 where status = 'delivered' and delivery_count = 0;
