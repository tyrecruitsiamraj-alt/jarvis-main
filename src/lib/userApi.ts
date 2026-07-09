import type { User, UserRole } from '@/types';

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'supervisor' || value === 'staff' || value === 'opl';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Validate a single user object from /api/app-users */
export function parseAppUser(value: unknown): User | null {
  if (!isRecord(value)) return null;

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const email = typeof value.email === 'string' ? value.email.trim() : '';
  const username =
    typeof value.username === 'string' && value.username.trim()
      ? value.username.trim()
      : email;
  const full_name =
    typeof value.full_name === 'string' && value.full_name.trim()
      ? value.full_name.trim()
      : username || email;
  const created_at = typeof value.created_at === 'string' ? value.created_at : '';

  if (!id || !email || !isUserRole(value.role) || typeof value.is_active !== 'boolean' || !created_at) {
    return null;
  }

  return {
    id,
    username,
    full_name,
    email,
    role: value.role,
    is_active: value.is_active,
    created_at,
  };
}

export function parseAppUserList(value: unknown): User[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseAppUser).filter((user): user is User => user !== null);
}
