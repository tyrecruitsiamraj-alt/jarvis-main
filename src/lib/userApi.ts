import type { User, UserRole } from '@/types';

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'supervisor' || value === 'staff' || value === 'opl' || value === 'sale';
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
    ...(typeof value.department_code === 'string' && value.department_code.trim()
      ? { department_code: value.department_code.trim().toUpperCase() }
      : {}),
    ...(typeof value.phone === 'string' && value.phone.trim() ? { phone: value.phone.trim() } : {}),
    /**
     * ชื่อเล่น + สายงาน (114) — ⚠️ **ตัวตรวจนี้ทิ้งฟิลด์ที่ไม่ได้เขียนไว้**
     * เพิ่มช่องใหม่ที่ API แล้วลืมมาเติมตรงนี้ = จอไม่เห็นค่า ทั้งที่ฐานบันทึกไว้แล้ว
     * (เจอจริงตอนตรวจ 1 ก.ย. 2569 — บันทึกผ่าน แต่รีเฟรชแล้วช่องว่าง)
     */
    nickname: typeof value.nickname === 'string' && value.nickname.trim() ? value.nickname.trim() : null,
    job_lanes: Array.isArray(value.job_lanes)
      ? value.job_lanes.filter((x): x is string => typeof x === 'string')
      : [],
  };
}

export function parseAppUserList(value: unknown): User[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseAppUser).filter((user): user is User => user !== null);
}

/**
 * `/api/app-user-names` → ชื่อให้ช่อง "ผู้รับผิดชอบ" (11 ต.ค. 2569) — ทุก role อ่านได้ · ไม่มีอีเมล
 * แถวที่ไม่มี id/ชื่อทิ้งเงียบ ๆ · รูปผิดทั้งก้อน = ลิสต์ว่าง
 */
export function parseResponsibleNames(value: unknown): Array<{ id: string; name: string; label?: string }> {
  const list = isRecord(value) && Array.isArray(value.users) ? value.users : [];
  const out: Array<{ id: string; name: string; label?: string }> = [];
  for (const u of list) {
    if (!isRecord(u)) continue;
    const id = typeof u.id === 'string' ? u.id : '';
    const name = typeof u.name === 'string' ? u.name.trim() : '';
    // ชื่อเล่น (ขอแบบ ?lane= · 21 ต.ค. 2569) — โชว์บนจอ ค่าที่เก็บยังเป็นชื่อเต็ม
    const label = typeof u.label === 'string' && u.label.trim() ? u.label.trim() : undefined;
    if (id && name) out.push(label ? { id, name, label } : { id, name });
  }
  return out;
}
