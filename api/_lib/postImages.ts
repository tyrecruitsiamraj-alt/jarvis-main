/**
 * รูปแนบโพสต์ Autopost (เจ้าของ 17 พ.ย. 2569 · migration 184) — ป๊อป Autopost อัปโหลด → ใบสั่งส่งลิงก์รูปให้ So Scraping
 * รับเฉพาะ JPG/PNG/WebP ดูจากไบต์จริง (`sniffQuizImage` ตัวเดียวกับรูปข้อสอบ) · หน้าจอย่อรูปก่อนส่ง เพดานนี้กันของหลุด
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { sniffQuizImage, QUIZ_IMAGE_MAX_BYTES } from './skillQuiz.js';

const IMAGES = tableInAppSchema('job_post_images');

export async function savePostImage(
  base64: string,
  meta: { jobId: string | null; byName: string | null },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const bytes = Buffer.from(base64.replace(/^data:[^,]*,/, ''), 'base64');
  if (bytes.length === 0) return { ok: false, message: 'ไม่พบรูป' };
  if (bytes.length > QUIZ_IMAGE_MAX_BYTES) return { ok: false, message: 'รูปใหญ่เกินไป' };
  const mime = sniffQuizImage(bytes);
  if (!mime) return { ok: false, message: 'ใช้ได้เฉพาะรูป JPG PNG หรือ WebP' };
  const { rows } = await dbQuery<{ id: string }>(
    `insert into ${IMAGES} (job_id, mime, size_bytes, bytes, created_by_name) values ($1, $2, $3, $4, $5) returning id::text`,
    [meta.jobId, mime, bytes.length, bytes, meta.byName],
  );
  return { ok: true, id: rows[0].id };
}

export async function getPostImage(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
  const { rows } = await dbQuery<{ mime: string; bytes: Buffer }>(`select mime, bytes from ${IMAGES} where id = $1 limit 1`, [id]);
  return rows[0] ?? null;
}
