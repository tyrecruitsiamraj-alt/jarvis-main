-- Prevent duplicate active assignments for the same job + candidate (DB backstop).

create unique index if not exists job_assignments_active_job_candidate_uidx
  on job_assignments (job_id, candidate_id)
  where status in ('sent', 'passed', 'started');
