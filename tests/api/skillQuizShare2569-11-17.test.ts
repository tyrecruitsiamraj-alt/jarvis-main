import { describe, expect, it } from 'vitest';
import { quizLineShareUrl, quizShareText } from '@/lib/skillQuizShare';

describe('ส่งลิงก์ชุดข้อสอบทาง LINE (17 พ.ย. 2569)', () => {
  const url = 'https://jarvis.siamrajathanee.dev/quiz/s/abc123';

  it('ข้อความ = ชื่อชุดบรรทัดแรก ลิงก์บรรทัดสอง', () => {
    expect(quizShareText('  ช่างไฟ ระดับ 1 ', url)).toBe(`แบบทดสอบ ช่างไฟ ระดับ 1\n${url}`);
  });

  it('เปิดหน้าแชร์ของ LINE พร้อมข้อความที่เข้ารหัสแล้ว ลิงก์กลับมาครบ', () => {
    const share = quizLineShareUrl('ช่างไฟ & แอร์', url);
    expect(share.startsWith('https://line.me/R/share?text=')).toBe(true);
    const text = decodeURIComponent(share.slice('https://line.me/R/share?text='.length));
    expect(text).toBe(`แบบทดสอบ ช่างไฟ & แอร์\n${url}`);
    expect(share).not.toContain('&');
  });
});
