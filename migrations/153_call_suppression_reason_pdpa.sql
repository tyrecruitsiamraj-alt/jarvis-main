-- บัญชีห้ามโทรรับเหตุผล 'pdpa' (เจ้าตัวขอลบข้อมูล / ขอให้หยุดติดต่อ · คำขอ PDPA 18 ต.ค. 2569)
-- ถอด CHECK เดิม (not_looking / wrong_number / manual) แทนการเพิ่มค่า — บทเรียนเดิม: CHECK บนคอลัมน์ข้อความชนทุกครั้งที่มีค่าใหม่
-- ค่าที่ยอมรับคุมที่ type ของ `suppressPhone` (api/_lib/callFollowup.ts) ที่เดียว
alter table candidate_call_suppression drop constraint if exists candidate_call_suppression_reason_check;
