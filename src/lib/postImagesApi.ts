import { apiFetch } from './apiFetch';
import { shrinkImageToJpeg } from './imageShrink';

/** รูปแนบโพสต์ Autopost (17 พ.ย. 2569) — ย่อในเครื่องแล้วอัปโหลด ได้รหัสรูปกลับ */
export async function uploadPostImage(file: File, jobId: string | null): Promise<string> {
  const data = await shrinkImageToJpeg(file);
  const r = await apiFetch('/api/post-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, job_id: jobId }),
  });
  if (!r.ok) {
    const d = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(d.message || `ระบบตอบ ${r.status}`);
  }
  return ((await r.json()) as { id: string }).id;
}

/** ลิงก์ตัวรูป — ใบสั่งส่งแบบเต็ม (มีโดเมน) ให้บอท So Scraping ดาวน์โหลด · บนจอใช้แบบสั้นได้ */
export const postImagePath = (id: string) => `/api/public/post-image?id=${encodeURIComponent(id)}`;
export const postImageUrl = (id: string, origin = typeof window !== 'undefined' ? window.location.origin : '') => `${origin}${postImagePath(id)}`;

/** รหัสรูปจากลิงก์ในใบสั่งเก่า (เปิดป๊อปซ้ำแล้วรูปเดิมยังอยู่) · ไม่ใช่ลิงก์รูปแนบ = null */
export function postImageIdFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const m = /\/api\/public\/post-image\?id=([0-9a-f-]{36})/i.exec(url);
  return m ? m[1] : null;
}
