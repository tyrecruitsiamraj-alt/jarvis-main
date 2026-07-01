-- Link Jarvis users to Azure AD object id (Microsoft SSO).
ALTER TABLE users ADD COLUMN IF NOT EXISTS azure_oid text;

CREATE UNIQUE INDEX IF NOT EXISTS users_azure_oid_unique
  ON users (azure_oid)
  WHERE azure_oid IS NOT NULL;
