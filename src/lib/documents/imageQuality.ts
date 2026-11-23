/**
 * ตรวจคุณภาพภาพเอกสารบนเครื่องผู้สมัคร — เบลอ · มืด · แสงสะท้อน (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 *
 * ผลเป็น "คำเตือนให้ถ่ายใหม่เฉพาะใบนั้น" ไม่ใช่ตัวตัดสินว่าเอกสารผ่าน (ผู้สมัครยืนยันเองว่าภาพชัด · HR เห็นภาพจริง)
 * ไม่ใช้ค่าความมั่นใจของ OCR ตัวเดียวตัดสิน — ภาพคมแต่ OCR อ่านพลาดก็มี ภาพเบลอแต่ OCR เดาได้ก็มี
 * ตรรกะล้วน รับพิกเซล RGBA (ย่อแล้ว) — เทสต์ได้โดยไม่ต้องมีเบราว์เซอร์
 */
export type ImageQuality = { sharpness: number; brightness: number; glare: number; warnings: string[] };

/** ต่ำกว่านี้ถือว่าเบลอ (ความแปรปรวนของขอบภาพ บนภาพย่อกว้าง ~640px) */
export const BLUR_THRESHOLD = 45;
export const DARK_THRESHOLD = 60;
/** สัดส่วนพิกเซลขาวจ้าที่ถือว่ามีแสงสะท้อน — ใช้กับบัตร (ทะเบียนบ้านเป็นกระดาษขาว ไม่ตรวจ) */
export const GLARE_THRESHOLD = 0.12;
/** ขอบภาพขาวจ้าเกินนี้ = ภาพสแกน/ภาพหน้าจอพื้นขาว ไม่ใช่แสงสะท้อน (รูปถ่ายบัตรวางบนโต๊ะ ขอบภาพเป็นพื้นโต๊ะ) */
export const WHITE_BORDER_RATIO = 0.6;

export function measureImageQuality(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, opts: { checkGlare: boolean }): ImageQuality {
  const n = width * height;
  const gray = new Float32Array(n);
  let sum = 0;
  let blown = 0;
  let border = 0;
  let borderBlown = 0;
  const edgeX = Math.max(1, Math.round(width * 0.05));
  const edgeY = Math.max(1, Math.round(height * 0.05));
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const v = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = v;
    sum += v;
    const isBlown = r >= 250 && g >= 250 && b >= 250;
    if (isBlown) blown++;
    const x = i % width;
    const y = (i - x) / width;
    if (x < edgeX || x >= width - edgeX || y < edgeY || y >= height - edgeY) {
      border++;
      if (isBlown) borderBlown++;
    }
  }
  // ความคม = ความแปรปรวนของ Laplacian (ขอบชัด = ค่าสูง)
  let lapSum = 0;
  let lapSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      lapSum += lap;
      lapSq += lap * lap;
      count++;
    }
  }
  const mean = count ? lapSum / count : 0;
  const sharpness = count ? lapSq / count - mean * mean : 0;
  const brightness = n ? sum / n : 0;
  // ขอบภาพขาวเกือบทั้งหมด = ภาพพื้นขาว (สแกน/หน้าจอ) ไม่นับเป็นแสงสะท้อน
  const whiteBackground = border > 0 && borderBlown / border > WHITE_BORDER_RATIO;
  const glare = n && !whiteBackground ? blown / n : 0;
  const warnings: string[] = [];
  if (sharpness < BLUR_THRESHOLD) warnings.push('ภาพเบลอ ถือเครื่องให้นิ่งแล้วถ่ายใหม่');
  if (brightness < DARK_THRESHOLD) warnings.push('ภาพมืด ถ่ายใหม่ในที่สว่าง');
  if (opts.checkGlare && glare > GLARE_THRESHOLD) warnings.push('มีแสงสะท้อนบนบัตร เอียงบัตรหลบแสงแล้วถ่ายใหม่');
  return { sharpness, brightness, glare, warnings };
}
