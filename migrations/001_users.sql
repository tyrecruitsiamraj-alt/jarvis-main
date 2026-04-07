-- App users for JWT auth. Applied with search_path set to PGSCHEMA (e.g. jarvis_rm) when configured.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'supervisor', 'staff')),
  full_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- PG13: expression UNIQUE ใน CREATE TABLE ไม่รองรับ — ใช้ unique index แทน (PG15+ ใช้แบบนี้ก็ได้)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));
