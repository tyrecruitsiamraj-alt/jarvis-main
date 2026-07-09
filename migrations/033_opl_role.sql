-- Add read-only OPL role to users and role_function_grants
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'supervisor', 'staff', 'opl'));

ALTER TABLE role_function_grants DROP CONSTRAINT IF EXISTS role_function_grants_role_check;
ALTER TABLE role_function_grants ADD CONSTRAINT role_function_grants_role_check
  CHECK (role IN ('admin', 'supervisor', 'staff', 'opl'));
