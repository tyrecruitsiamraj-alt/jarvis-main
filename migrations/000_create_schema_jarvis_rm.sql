-- รันครั้งเดียวถ้ายังไม่มี schema (ใน DBeaver เลือก DB ocr_service แล้วรัน)

create schema if not exists jarvis_rm;

-- ให้ user เชื่อมต่อ (ปรับชื่อ role ตามจริงถ้าไม่ใช่ root)
grant usage on schema jarvis_rm to root;
grant create on schema jarvis_rm to root;
