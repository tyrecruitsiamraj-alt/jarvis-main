/**
 * ส่งลิงก์ชุดข้อสอบ (เจ้าของ 17 พ.ย. 2569: "ทำทั้งสองแบบเลย QR กับส่งทาง LINE")
 * LINE = เปิดหน้าเลือกแชต/กลุ่มของ LINE พร้อมข้อความ · QR = รูป PNG มีชื่อชุดไว้พิมพ์แปะห้องอบรม
 */
import { LOGIN_SCENE } from '@/lib/designTokens';
import { downloadCanvas } from '@/lib/followDayReportImage';

/** ข้อความที่ส่งไป LINE — ชื่อชุดบรรทัดแรก ลิงก์บรรทัดสอง */
export function quizShareText(title: string, url: string): string {
  return `แบบทดสอบ ${title.trim()}\n${url}`;
}

/** https://line.me/R/share — เปิดได้ทั้งมือถือและ LINE บนคอม */
export function quizLineShareUrl(title: string, url: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(quizShareText(title, url))}`;
}

const FONT = (px: number, weight = 400) => `${weight} ${px}px Kanit, sans-serif`;
const W = 640;
const PAD = 48;
const QR = W - PAD * 2;

/** ตัวอักษรใหญ่สุดที่ยังอยู่ในความกว้าง (ชื่อชุดยาว ๆ ไม่ล้นรูป) */
function fitFont(ctx: CanvasRenderingContext2D, text: string, max: number, min: number, weight: number): void {
  for (let px = max; px >= min; px -= 2) {
    ctx.font = FONT(px, weight);
    if (ctx.measureText(text).width <= W - PAD * 2) return;
  }
}

/** รูป QR + ชื่อชุด + ลิงก์ บนพื้นขาว (สแกนได้ทุกธีม) */
export function drawQuizQrCard(qr: HTMLCanvasElement, title: string, url: string): HTMLCanvasElement {
  const H = PAD + 40 + 24 + QR + 24 + 24 + PAD;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = LOGIN_SCENE.canvas;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = LOGIN_SCENE.ink;
  fitFont(ctx, title, 32, 16, 600);
  ctx.fillText(title, W / 2, PAD);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, PAD, PAD + 40 + 24, QR, QR);
  ctx.fillStyle = LOGIN_SCENE.muted;
  fitFont(ctx, url, 18, 10, 400);
  ctx.fillText(url, W / 2, PAD + 40 + 24 + QR + 24);
  return canvas;
}

export async function downloadQuizQrPng(qr: HTMLCanvasElement, title: string, url: string): Promise<boolean> {
  try {
    await document.fonts.load(FONT(32, 600));
  } catch {
    /* โหลดฟอนต์ไม่ได้ก็วาดต่อ */
  }
  const name = title.replace(/[\\/:*?"<>|]/g, '').trim() || 'แบบทดสอบ';
  return downloadCanvas(drawQuizQrCard(qr, title, url), `QR ${name}.png`);
}
