-- ═══ ดัชนีกล่องแจ้งเตือนให้ตรงกับคำสั่งที่กระดิ่งยิงทุกนาที (เจ้าของ 2 พ.ย. 2569 "งั้นทำเลย" หลังมีคนทัก CPU สูง) ═══
-- listMyNotifications เรียง created_at desc limit 30 ของคนเดียว + ชนิดที่ปักไว้ 14 วัน
-- ดัชนีเดิม (recipient_user_id, read_at, created_at) มี read_at คั่นกลาง ⇒ ต้องอ่านทุกแถวของคนนั้นแล้วค่อยเรียง (คนแจ้งเตือนเยอะสุด ~3,900 แถว)
-- ดัชนีใหม่อ่านจากบนลงล่างแล้วหยุดที่ 30 ได้เลย · เพิ่มอย่างเดียว ดัชนีเดิมยังอยู่
create index if not exists app_notifications_recent_idx
  on app_notifications (recipient_user_id, created_at desc);

create index if not exists app_notifications_type_recent_idx
  on app_notifications (recipient_user_id, type, created_at desc);
