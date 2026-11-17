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

/** รูปล่าสุดของใบขอ (ป๊อปโพสต์เอง + Autopost ใช้รูปเดียวกัน) · ไม่มี = null */
export async function fetchLatestPostImage(jobId: string): Promise<string | null> {
  const r = await apiFetch(`/api/post-images?job=${encodeURIComponent(jobId)}`);
  if (!r.ok) return null;
  return ((await r.json()) as { id: string | null }).id ?? null;
}

/** โหลดรูปลงเครื่อง — คนโพสต์เองเอาไปแนบใน Facebook · `false` = โหลดไม่ได้ */
export async function downloadPostImage(id: string, filename: string): Promise<boolean> {
  try {
    const r = await fetch(postImagePath(id));
    if (!r.ok) return false;
    const blob = await r.blob();
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
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
