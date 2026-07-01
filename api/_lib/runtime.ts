/** True when running on Vercel/production-like deploy. */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

/**
 * Dev role login (no password) — fail-closed.
 * Allowed only when NOT production AND JARVIS_DEV_ROLE_LOGIN === "true".
 */
export function isDevRoleLoginAllowed(): boolean {
  if (isProductionRuntime()) return false;
  return String(process.env.JARVIS_DEV_ROLE_LOGIN || '').trim().toLowerCase() === 'true';
}

/** Public self-registration — disabled in production unless invite flow exists. */
export function isPublicRegistrationAllowed(): boolean {
  if (isProductionRuntime()) return false;
  const raw = String(process.env.JARVIS_ALLOW_PUBLIC_REGISTER || 'true').trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'no' && raw !== 'off';
}
