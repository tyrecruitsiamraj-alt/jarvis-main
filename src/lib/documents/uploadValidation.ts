/**
 * ตรวจภาพที่ผู้สมัครแนบ (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569) — ดูจากไบต์จริง ไม่เชื่อนามสกุล/ชนิดที่ส่งมา
 * รับ JPG · PNG · WebP เท่านั้น (SVG/HTML/PDF เปลี่ยนนามสกุลมาก็ไม่ผ่าน) · อ่านขนาดภาพจากหัวไฟล์ ไม่ถอดทั้งภาพ
 */
import { UPLOAD_KINDS, type UploadKind } from './documentTypes';

export const UPLOAD_MAX_BYTES = 4_000_000;
export const UPLOAD_MIN_BYTES = 2_000;
/** ภาพเล็กกว่านี้อ่านตัวหนังสือบนบัตรไม่ออก */
export const UPLOAD_MIN_WIDTH = 400;
export const UPLOAD_MIN_HEIGHT = 250;
export const UPLOAD_MAX_SIDE = 6000;

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export type UploadedDocument = { id: string; kind: UploadKind; mime: string; size: number; sha256: string };

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

export function imageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (PNG_SIG.every((v, i) => bytes[i] === v)) return 'image/png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** กว้าง × สูง จากหัวไฟล์ · อ่านไม่ได้ = null (ถือว่าไฟล์เสีย) */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const mime = imageMime(bytes);
  const u16 = (o: number) => (bytes[o] << 8) | bytes[o + 1];
  if (mime === 'image/png') {
    if (bytes.length < 24 || ascii(bytes, 12, 16) !== 'IHDR') return null;
    const u32 = (o: number) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
    return { width: u32(16), height: u32(20) };
  }
  if (mime === 'image/jpeg') {
    let o = 2;
    while (o + 9 < bytes.length) {
      if (bytes[o] !== 0xff) return null;
      const marker = bytes[o + 1];
      if (marker === 0xff) {
        o += 1;
        continue;
      }
      // SOF0–SOF15 ยกเว้น DHT (C4) · JPG (C8) · DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: u16(o + 5), width: u16(o + 7) };
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        o += 2;
        continue;
      }
      const len = u16(o + 2);
      if (len < 2) return null;
      o += 2 + len;
    }
    return null;
  }
  if (mime === 'image/webp') {
    if (bytes.length < 30) return null;
    const chunk = ascii(bytes, 12, 16);
    if (chunk === 'VP8 ') return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') {
      return {
        width: (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1,
        height: (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1,
      };
    }
  }
  return null;
}

export type UploadCheck =
  | { ok: true; mime: ImageMime; width: number; height: number }
  | { ok: false; status: 400 | 413 | 415; message: string };

/** ด่านเดียวของภาพที่แนบ — ขนาดไฟล์ · ชนิดจริง · ขนาดภาพ */
export function checkUploadBytes(bytes: Uint8Array): UploadCheck {
  if (bytes.length > UPLOAD_MAX_BYTES) return { ok: false, status: 413, message: 'ภาพใหญ่เกินไป ถ่ายใหม่หรือลดขนาดแล้วแนบอีกครั้ง' };
  if (bytes.length < UPLOAD_MIN_BYTES) return { ok: false, status: 400, message: 'ไฟล์นี้เล็กเกินกว่าจะเป็นภาพเอกสาร' };
  const mime = imageMime(bytes);
  if (!mime) return { ok: false, status: 415, message: 'ใช้ภาพ JPG, PNG หรือ WebP เท่านั้น' };
  const size = imageSize(bytes);
  if (!size || size.width <= 0 || size.height <= 0) return { ok: false, status: 415, message: 'เปิดภาพนี้ไม่ได้ ถ่ายใหม่แล้วแนบอีกครั้ง' };
  if (size.width > UPLOAD_MAX_SIDE || size.height > UPLOAD_MAX_SIDE) {
    return { ok: false, status: 413, message: 'ภาพใหญ่เกินไป ถ่ายใหม่หรือลดขนาดแล้วแนบอีกครั้ง' };
  }
  // บัตรถ่ายแนวตั้งหรือแนวนอนก็ได้ — เทียบด้านยาวกับด้านสั้น
  const long = Math.max(size.width, size.height);
  const short = Math.min(size.width, size.height);
  if (long < UPLOAD_MIN_WIDTH || short < UPLOAD_MIN_HEIGHT) {
    return { ok: false, status: 400, message: 'ภาพเล็กเกินไป ถ่ายใหม่ให้เห็นตัวหนังสือชัด' };
  }
  return { ok: true, mime, ...size };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** รายการไฟล์แนบของชุดที่จะส่ง — ครบ 3 ประเภท คนละไฟล์ */
export function validateUploadList(raw: unknown): { id: string; kind: UploadKind }[] {
  if (!Array.isArray(raw) || raw.length !== UPLOAD_KINDS.length) {
    throw new Error('แนบบัตรประชาชน ใบขับขี่ และทะเบียนบ้านให้ครบ');
  }
  const result = raw.map((v) => {
    const item = v as { id?: unknown; kind?: unknown } | null;
    if (!item || typeof item.id !== 'string' || !UUID.test(item.id) || !(UPLOAD_KINDS as readonly unknown[]).includes(item.kind)) {
      throw new Error('รายการไฟล์แนบไม่ถูกต้อง');
    }
    return { id: item.id.toLowerCase(), kind: item.kind as UploadKind };
  });
  if (new Set(result.map((v) => v.kind)).size !== UPLOAD_KINDS.length || new Set(result.map((v) => v.id)).size !== UPLOAD_KINDS.length) {
    throw new Error('เอกสารแต่ละประเภทต้องเป็นคนละไฟล์');
  }
  return result;
}
