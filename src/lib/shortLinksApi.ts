import { apiFetch } from '@/lib/apiFetch';

/** สร้าง short link สำหรับ path ภายในระบบ (เช่น /apply?job=...) — ต้องล็อกอิน */
export async function createShortLink(targetPath: string): Promise<{ code: string; path: string }> {
  const r = await apiFetch('/api/short-links', {
    method: 'POST',
    body: JSON.stringify({ targetPath }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'ย่อลิงก์ไม่สำเร็จ');
  }
  return (await r.json()) as { code: string; path: string };
}

/** แปลง short code → target path (public) */
export async function resolveShortLink(code: string): Promise<string | null> {
  const r = await apiFetch(`/api/short-links/resolve?code=${encodeURIComponent(code)}`);
  if (!r.ok) return null;
  const body = (await r.json()) as { targetPath?: string };
  return typeof body.targetPath === 'string' ? body.targetPath : null;
}
