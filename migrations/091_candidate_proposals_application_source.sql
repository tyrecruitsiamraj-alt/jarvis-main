-- เปิดเส้น "จองตัว" จากใบสมัครบอร์ดรับสมัคร (S9 · เจ้าของเคาะ 15 ส.ค. 2569:
-- "หากมีการจองให้ไปโผล่ในหน้าการติดต่อ" — ใบสมัครที่โทรแล้วสนใจ ต้องจองตัวได้)
--
-- เดิม candidate_proposals.source รับแค่ 'board'/'irecruit' (migration 044) →
-- ใบสมัคร (source 'application') จองไม่ได้ (bookingTargetFromHold คืน null)
--
-- ⚠️ **บทเรียน 068/077/085**: CHECK ที่ฐานกับ validator ฝั่งโค้ดต้องแก้พร้อมกัน
-- ไม่งั้นค่าใหม่ผ่านโค้ดแต่ 500 ที่ฐาน (หรือกลับกัน) · migration นี้คู่กับ:
--   - api/_lib/candidateProposals.ts (SOURCES + ProposalSource)
--   - src/lib/candidateProposalsApi.ts (ProposalSource)
--   - src/lib/callResultBooking.ts (bookingTargetFromHold รับ 'application')

alter table candidate_proposals drop constraint if exists candidate_proposals_source_check;
alter table candidate_proposals
  add constraint candidate_proposals_source_check
  check (source in ('board', 'irecruit', 'application'));
