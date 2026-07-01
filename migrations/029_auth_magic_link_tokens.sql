CREATE TABLE IF NOT EXISTS auth_magic_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_magic_link_tokens_user_id_idx ON auth_magic_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS auth_magic_link_tokens_expires_at_idx ON auth_magic_link_tokens(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS auth_magic_link_tokens_hash_active_unique
  ON auth_magic_link_tokens(token_hash)
  WHERE used_at IS NULL;
