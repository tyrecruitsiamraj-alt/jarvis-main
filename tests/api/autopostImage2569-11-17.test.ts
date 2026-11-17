// @vitest-environment node
/**
 * โพสต์พร้อมรูป (เจ้าของ 17 พ.ย. 2569 "คนอยากโพสต์พร้อมรูป" · Choice ทำทั้ง Jarvis + So Scraping)
 * ป๊อป Autopost แนบรูป → ใบสั่งส่ง image_url เต็ม → So Scraping เก็บเป็น image_ref → บอทดาวน์โหลดตอนโพสต์
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { postImageIdFromUrl, postImagePath, postImageUrl } from '../../src/lib/postImagesApi';

const ID = '3f6c1a52-8d4e-4b7a-9c21-5e0f7b9d2a10';

describe('ลิงก์รูปแนบโพสต์', () => {
  it('ใบสั่งส่งลิงก์เต็ม ตรงรูปแบบที่ So Scraping รับ (https://<Jarvis>/api/public/post-image?id=<uuid>)', () => {
    expect(postImageUrl(ID, 'https://jarvis.siamrajathanee.dev')).toBe(`https://jarvis.siamrajathanee.dev/api/public/post-image?id=${ID}`);
    expect(postImagePath(ID)).toBe(`/api/public/post-image?id=${ID}`);
  });
  it('เปิดป๊อปสั่งซ้ำ อ่านรหัสรูปเดิมจากใบสั่งก่อนได้ · ลิงก์อื่นไม่นับ', () => {
    expect(postImageIdFromUrl(`https://jarvis.siamrajathanee.dev/api/public/post-image?id=${ID}`)).toBe(ID);
    expect(postImageIdFromUrl('https://example.com/a.png')).toBeNull();
    expect(postImageIdFromUrl(null)).toBeNull();
  });
});

describe('เส้น API + ป๊อป', () => {
  it('อัปโหลดต้องล็อกอิน (สิทธิ์สั่งโพสต์) · ตัวรูปเปิดได้ไม่ล็อกอิน · ดูชนิดจากไบต์', () => {
    const reg = readFileSync('api/_handlers/registry.ts', 'utf8');
    expect(reg).toContain("'/api/post-images': postImagesHandler");
    expect(reg).toContain("'/api/public/post-image': publicPostImageHandler");
    expect(readFileSync('api/_handlers/post-images.ts', 'utf8')).toContain("withRbac(handler, 'matching-job-postings')");
    expect(readFileSync('api/_handlers/public/post-image.ts', 'utf8')).toMatch(/isQuizImageId\(id\) \? await getPostImage\(id\)/);
    expect(readFileSync('api/_lib/postImages.ts', 'utf8')).toContain('sniffQuizImage(bytes)');
  });
  it('ป๊อป: แบบมีรูปต้องแนบรูปก่อนส่ง · ส่ง image_url ไปกับใบสั่ง', () => {
    const d = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(d).toContain("...(withImage && !imageId ? ['แนบรูป'] : [])");
    expect(d).toContain('image_url: postImageUrl(imageId)');
    expect(d).toContain('data-testid="autopost-image-pick"');
  });
});
