-- Admin-configurable function toggles per role (overrides default minimum-role matrix)
CREATE TABLE IF NOT EXISTS role_function_grants (
  role text NOT NULL CHECK (role IN ('admin', 'supervisor', 'staff')),
  function_id text NOT NULL,
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  PRIMARY KEY (role, function_id)
);

CREATE INDEX IF NOT EXISTS role_function_grants_function_id_idx ON role_function_grants (function_id);
