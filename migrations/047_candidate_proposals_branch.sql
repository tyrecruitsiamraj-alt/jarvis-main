-- ผูกการติดต่อ/จอง/ลงงานกับสาขาย่อยของใบขอแบบมีโครงสร้าง
alter table candidate_proposals
  add column if not exists branch_id text null,
  add column if not exists branch_name text null;

create index if not exists candidate_proposals_branch_lookup_idx
  on candidate_proposals (job_id, branch_id, status);
