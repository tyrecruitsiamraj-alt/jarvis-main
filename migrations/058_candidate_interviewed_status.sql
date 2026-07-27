-- Add 'interviewed' candidate status and Lumos interview result columns

-- ── candidates.status ───────────────────────────────────────────────────────
-- Drop the old inline CHECK (auto-named by PG) and recreate with new value.

ALTER TABLE IF EXISTS jarvis_rm.candidates
  DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE IF EXISTS jarvis_rm.candidates
  ADD CONSTRAINT candidates_status_check
  CHECK (status IN ('inprocess','drop','done','waiting_interview','waiting_to_start','no_job','interviewed'));

ALTER TABLE IF EXISTS public.candidates
  DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE IF EXISTS public.candidates
  ADD CONSTRAINT candidates_status_check
  CHECK (status IN ('inprocess','drop','done','waiting_interview','waiting_to_start','no_job','interviewed'));

-- ── candidate_interviews — Lumos result columns ──────────────────────────────

ALTER TABLE IF EXISTS jarvis_rm.candidate_interviews
  ADD COLUMN IF NOT EXISTS lumos_interview_id  text          NULL,
  ADD COLUMN IF NOT EXISTS outcome             text          NULL,
  ADD COLUMN IF NOT EXISTS ai_score            integer       NULL,
  ADD COLUMN IF NOT EXISTS summary             text          NULL,
  ADD COLUMN IF NOT EXISTS strengths           jsonb         NULL,
  ADD COLUMN IF NOT EXISTS concerns            jsonb         NULL,
  ADD COLUMN IF NOT EXISTS score_rationale     text          NULL,
  ADD COLUMN IF NOT EXISTS confidence          text          NULL
    CHECK (confidence IS NULL OR confidence IN ('high','medium','low')),
  ADD COLUMN IF NOT EXISTS failure_reason      text          NULL,
  ADD COLUMN IF NOT EXISTS transcript          jsonb         NULL,
  ADD COLUMN IF NOT EXISTS recording_url       text          NULL,
  ADD COLUMN IF NOT EXISTS call_attempts       integer       NULL,
  ADD COLUMN IF NOT EXISTS ended_reason        text          NULL,
  ADD COLUMN IF NOT EXISTS duration_min        numeric(6,2)  NULL;

ALTER TABLE IF EXISTS public.candidate_interviews
  ADD COLUMN IF NOT EXISTS lumos_interview_id  text          NULL,
  ADD COLUMN IF NOT EXISTS outcome             text          NULL,
  ADD COLUMN IF NOT EXISTS ai_score            integer       NULL,
  ADD COLUMN IF NOT EXISTS summary             text          NULL,
  ADD COLUMN IF NOT EXISTS strengths           jsonb         NULL,
  ADD COLUMN IF NOT EXISTS concerns            jsonb         NULL,
  ADD COLUMN IF NOT EXISTS score_rationale     text          NULL,
  ADD COLUMN IF NOT EXISTS confidence          text          NULL
    CHECK (confidence IS NULL OR confidence IN ('high','medium','low')),
  ADD COLUMN IF NOT EXISTS failure_reason      text          NULL,
  ADD COLUMN IF NOT EXISTS transcript          jsonb         NULL,
  ADD COLUMN IF NOT EXISTS recording_url       text          NULL,
  ADD COLUMN IF NOT EXISTS call_attempts       integer       NULL,
  ADD COLUMN IF NOT EXISTS ended_reason        text          NULL,
  ADD COLUMN IF NOT EXISTS duration_min        numeric(6,2)  NULL;

CREATE INDEX IF NOT EXISTS candidate_interviews_lumos_id_idx
  ON jarvis_rm.candidate_interviews (lumos_interview_id)
  WHERE lumos_interview_id IS NOT NULL;
