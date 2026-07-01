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

function parseEnvFlag(raw: string | undefined, defaultWhenUnset: boolean): boolean {
  if (raw == null || String(raw).trim() === '') return defaultWhenUnset;
  const v = String(raw).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return defaultWhenUnset;
}

/** Public self-registration — ปิดใน production โดยค่าเริ่มต้น; เปิดได้ด้วย JARVIS_ALLOW_PUBLIC_REGISTER=true */
export function isPublicRegistrationAllowed(): boolean {
  return parseEnvFlag(process.env.JARVIS_ALLOW_PUBLIC_REGISTER, !isProductionRuntime());
}
