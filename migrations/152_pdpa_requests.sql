-- ═══ คำขอใช้สิทธิ์ข้อมูลส่วนบุคคล (PDPA) — เจ้าของเลือกทำ 18 ต.ค. 2569 ═══
-- เจ้าของสั่งไว้: "ต้องเรียกดูได้ ต้องขอยกเลิกข้อมูลได้ด้วยเช่นกันนะ" · Choice 17 ต.ค. 2569:
--   ยื่นทางฟอร์มบนหน้าสมัคร + เจ้าหน้าที่ลงแทนได้ · ยืนยันตัวตนด้วยการโทรกลับเบอร์ที่สมัคร
--   ขอลบ = หยุดโทรทันที + ลบจริงหลังยืนยันตัวตน (ชื่อ/เบอร์/ที่อยู่ถูกล้าง เหลือตัวเลขสถิติ)
-- kind:   access (ขอดู) · correct (ขอแก้) · delete (ขอลบ) · object (คัดค้าน/ให้หยุดติดต่อ)
-- status: received (รอยืนยันตัวตน) · verified (ยืนยันตัวตนแล้ว) · done (ทำเสร็จ) · rejected (ไม่ดำเนินการ)
-- ⚠️ ไม่ใส่ CHECK บนคอลัมน์ข้อความ (กับดักเดิม: เพิ่มค่าใหม่แล้วชน constraint) — ตรวจค่าในโค้ด `src/lib/pdpaRequests.ts`

create table if not exists app_pdpa_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  full_name text not null,
  phone_e164 text not null,
  detail text null,
  source text not null,
  status text not null default 'received',
  created_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '30 days'),
  created_by_name text null,
  verified_at timestamptz null,
  verified_by_name text null,
  done_at timestamptz null,
  done_by_name text null,
  done_note text null,
  client_ip text null
);

create index if not exists app_pdpa_requests_status_idx on app_pdpa_requests (status, created_at desc);
create index if not exists app_pdpa_requests_phone_idx on app_pdpa_requests (phone_e164);
