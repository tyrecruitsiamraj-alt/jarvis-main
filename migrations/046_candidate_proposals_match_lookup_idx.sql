-- เร่งการตรวจว่าผู้สมัครถูกจองอยู่กับใบขออื่นหรือไม่ก่อนบันทึกสถานะ Matching
create index if not exists candidate_proposals_candidate_active_lookup_idx
  on candidate_proposals (source, candidate_ref, status, job_id);
