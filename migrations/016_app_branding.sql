-- Org-wide theme/logo for all browsers (synced via GET/PATCH /api/branding)
CREATE TABLE IF NOT EXISTS app_branding (
  id text PRIMARY KEY DEFAULT 'default',
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_branding (id, payload)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
