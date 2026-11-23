/** DOC-020 ภาพเบลอ/มืด/แสงสะท้อน = เตือนให้ถ่ายใหม่เฉพาะใบนั้น (ไม่อ้างว่าอ่านผ่าน) */
import { describe, expect, it } from 'vitest';
import { measureImageQuality } from './imageQuality';

const W = 120;
const H = 80;
const img = (px: (x: number, y: number) => number) => {
  const a = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = px(x, y);
      a.set([v, v, v, 255], (y * W + x) * 4);
    }
  return a;
};

describe('คุณภาพภาพเอกสาร', () => {
  it('ภาพคม (ขอบตัวหนังสือชัด) ไม่มีคำเตือน', () => {
    const q = measureImageQuality(img((x, y) => ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 ? 230 : 40)), W, H, { checkGlare: true });
    expect(q.warnings).toEqual([]);
  });
  it('ภาพเรียบไม่มีขอบ = เบลอ', () => {
    const q = measureImageQuality(img(() => 180), W, H, { checkGlare: false });
    expect(q.warnings.join()).toMatch(/เบลอ/);
  });
  it('ภาพมืด = เตือนให้ถ่ายในที่สว่าง', () => {
    const q = measureImageQuality(img((x, y) => ((x + y) % 2 ? 50 : 10)), W, H, { checkGlare: false });
    expect(q.warnings.join()).toMatch(/มืด/);
  });
  it('ขาวจ้าเป็นแผ่นกลางบัตร = แสงสะท้อน (บัตรเท่านั้น ทะเบียนบ้านกระดาษขาวไม่ตรวจ)', () => {
    const px = (x: number, y: number) => (x > 20 && x < 80 && y > 10 && y < 70 ? 255 : (x + y) % 2 ? 200 : 30);
    expect(measureImageQuality(img(px), W, H, { checkGlare: true }).warnings.join()).toMatch(/แสงสะท้อน/);
    expect(measureImageQuality(img(px), W, H, { checkGlare: false }).warnings.join()).not.toMatch(/แสงสะท้อน/);
  });
  it('ภาพสแกน/ภาพหน้าจอพื้นขาว ไม่นับเป็นแสงสะท้อน', () => {
    const px = (x: number, y: number) => (x > 30 && x < 90 && y > 20 && y < 60 ? ((x + y) % 2 ? 200 : 30) : 255);
    expect(measureImageQuality(img(px), W, H, { checkGlare: true }).warnings.join()).not.toMatch(/แสงสะท้อน/);
  });
});
