-- ═══ ความยินยอม PDPA ของใบสมัคร (เจ้าของสั่ง 15 ต.ค. 2569) ═══
-- เจ้าของถาม "ตอนพนักงานกรอกชื่อมาเรามีเรื่อง Pdpa ไหม" → ไม่มีเลย · Choice "ทำช่องยินยอม รอข้อความจากบริษัท"
-- แถวละใบ: ยินยอมเมื่อไหร่ · ทางไหน (apply = ผู้สมัครติ๊กเอง · staff = เจ้าหน้าที่คีย์ · import = นำเข้า Excel)
-- version = ข้อความยินยอมฉบับไหน (src/lib/pdpaConsent.ts) — ข้อความเปลี่ยนเมื่อไหร่ย้อนดูได้ว่าใครยินยอมฉบับไหน
-- แยกตารางโดยตั้งใจ — ไม่แตะคอลัมน์ insert เดิมของ public_job_applications (มีหลายทางเข้า)

create table if not exists app_application_consents (
  application_id uuid primary key references public_job_applications(id) on delete cascade,
  consented_at timestamptz not null default now(),
  source text not null,
  version text not null,
  recorded_by text null
);
