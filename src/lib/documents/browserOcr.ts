/**
 * อ่านภาพเอกสารด้วย OCR บนเครื่องของผู้สมัคร (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 *
 * ภาพไม่ถูกส่งไปผู้ให้บริการ OCR ภายนอก — Tesseract.js 6.0.1 ทำงานในเบราว์เซอร์ · ตัวโปรแกรมมาจากแพ็กเกจ npm ที่ล็อกรุ่น
 * (Vite คัดไฟล์ worker/core ออกมาเป็น asset ของเราเอง) · โมเดลภาษาไทย/อังกฤษอยู่ที่ /ocr/lang (tessdata_fast · ที่มาใน source.json)
 * โหลดเฉพาะหน้าส่งเอกสาร (ไฟล์นี้ถูก import แบบ dynamic) ไม่ถ่วงหน้าอื่นของระบบ
 */
import type { Worker } from 'tesseract.js';
import workerUrl from 'tesseract.js/dist/worker.min.js?url';
import coreSimdUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url';
import coreUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';
import { readOcrFields, type OcrResult } from './ocrFields';
import { measureImageQuality, type ImageQuality } from './imageQuality';
import type { UploadKind } from './documentTypes';

const OCR_TIMEOUT_MS = 90_000;
/** ด้านยาวสุดของภาพที่ส่งและอ่าน — พออ่านตัวหนังสือบนบัตร ไม่หนักเครื่อง */
const MAX_SIDE = 2000;
const UPLOAD_TARGET_BYTES = 3_600_000;

let workerPromise: Promise<Worker> | null = null;
let report: ((text: string) => void) | null = null;

async function supportsSimd(): Promise<boolean> {
  try {
    const { simd } = await import('wasm-feature-detect');
    return await simd();
  } catch {
    return false;
  }
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const origin = window.location.origin;
      return createWorker(['tha', 'eng'], 1, {
        workerPath: new URL(workerUrl, origin).href,
        corePath: new URL((await supportsSimd()) ? coreSimdUrl : coreUrl, origin).href,
        langPath: `${origin}/ocr/lang`,
        workerBlobURL: false,
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') report?.(`กำลังอ่านตัวอักษร ${Math.round(m.progress * 100)}%`);
          else report?.('กำลังเตรียมตัวอ่านภาษาไทย…');
        },
        errorHandler: () => undefined,
      });
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** อ่านภาพ 1 ใบ → ช่องข้อมูล · เกินเวลา/ล้ม = โยน (หน้าเว็บให้ลองใหม่หรือกรอกเอง ไม่เติมค่าแทน) */
export async function recognizeDocument(image: Blob, kind: UploadKind, onProgress: (text: string) => void): Promise<OcrResult> {
  report = onProgress;
  const worker = await getWorker();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await worker.setParameters({ preserve_interword_spaces: '1' });
    const { data } = await Promise.race([
      worker.recognize(image),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('อ่านภาพนานเกินไป ลองอีกครั้ง')), OCR_TIMEOUT_MS);
      }),
    ]);
    return readOcrFields(data.text, kind, data.confidence);
  } catch (e) {
    // ตัวอ่านอาจค้าง — ทิ้งแล้วสร้างใหม่รอบหน้า (เครื่องหน่วยความจำน้อยไม่ค้างยาว)
    workerPromise = null;
    await worker.terminate().catch(() => undefined);
    throw e;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** ปล่อยตัวอ่านเมื่อออกจากหน้า */
export async function disposeOcr(): Promise<void> {
  const p = workerPromise;
  workerPromise = null;
  if (p) await p.then((w) => w.terminate()).catch(() => undefined);
}

export type PreparedImage = { blob: Blob; width: number; height: number; quality: ImageQuality };

const toBlob = (canvas: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('เตรียมภาพไม่ได้'))), 'image/jpeg', q));

/**
 * เตรียมภาพก่อนส่ง: หมุนตามที่กล้องบันทึก · ย่อ · แปลงเป็น JPG (ตัดข้อมูลตำแหน่ง/รุ่นกล้องที่ฝังในไฟล์) · วัดความชัด
 * เปิดไฟล์ไม่ได้ (เช่น HEIC บนเครื่องที่ไม่รองรับ · ไฟล์เสีย) = บอกวิธีแก้ ไม่ส่งไฟล์เดิมขึ้นไป
 */
export async function prepareImage(file: File, kind: UploadKind): Promise<PreparedImage> {
  if (file.size > 25_000_000) throw new Error('ไฟล์ใหญ่เกิน 25 MB ถ่ายใหม่ด้วยกล้องปกติ');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('เปิดภาพนี้ไม่ได้ ถ่ายใหม่ด้วยปุ่มถ่ายรูป หรือบันทึกเป็น JPG แล้วเลือกอีกครั้ง');
  }
  try {
    if (Math.max(bitmap.width, bitmap.height) < 400 || Math.min(bitmap.width, bitmap.height) < 250) {
      throw new Error('ภาพเล็กเกินไป ถ่ายใหม่ให้เห็นตัวหนังสือชัด');
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เตรียมภาพไม่ได้ ลองอีกครั้ง');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // วัดความชัดบนภาพย่อ (เร็ว และค่าเทียบกันได้ทุกเครื่อง)
    const probe = document.createElement('canvas');
    probe.width = 640;
    probe.height = Math.max(1, Math.round((canvas.height / canvas.width) * 640));
    const pctx = probe.getContext('2d');
    let quality: ImageQuality = { sharpness: 0, brightness: 0, glare: 0, warnings: [] };
    if (pctx) {
      pctx.drawImage(canvas, 0, 0, probe.width, probe.height);
      const px = pctx.getImageData(0, 0, probe.width, probe.height);
      quality = measureImageQuality(px.data, probe.width, probe.height, { checkGlare: kind !== 'house' });
    }

    let blob = await toBlob(canvas, 0.9);
    for (const q of [0.8, 0.65]) {
      if (blob.size <= UPLOAD_TARGET_BYTES) break;
      blob = await toBlob(canvas, q);
    }
    if (blob.size > UPLOAD_TARGET_BYTES) throw new Error('ภาพใหญ่เกินไป ถ่ายใหม่ให้เห็นเฉพาะเอกสาร');
    return { blob, width: canvas.width, height: canvas.height, quality };
  } finally {
    bitmap.close();
  }
}
