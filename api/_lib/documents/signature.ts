/**
 * ตรวจลายเซ็นที่ผู้สมัครเขียนบนจอ (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 * ภาพเปล่า · โปร่งใสทั้งภาพ · จุดเดียว · ทาทึบทั้งแผ่น = ไม่รับ — ถอดภาพจริงแล้วนับเส้นหมึก ไม่ดูแค่รูปแบบไฟล์
 */
import UPNGModule from '@pdf-lib/upng';
import { DocError, sha256Hex } from './core.js';
import { imageMime, imageSize } from '../../../src/lib/documents/uploadValidation.js';

type Upng = {
  decode: (buf: ArrayBuffer) => { width: number; height: number };
  toRGBA8: (img: unknown) => ArrayBuffer[];
};
const UPNG = ((UPNGModule as unknown as { default?: Upng }).default ?? UPNGModule) as unknown as Upng;

const MAX_W = 1600;
const MAX_H = 800;
/** จุดหมึกขั้นต่ำ — เส้นลายเซ็นสั้นสุดที่ยังนับว่าเขียนจริง */
const MIN_INK = 150;
const MIN_SPAN = 70;
const MAX_INK_RATIO = 0.5;

const INVALID = () => new DocError(400, 'invalid_signature', 'ยังไม่มีลายเซ็น เขียนลายเซ็นใหม่อีกครั้ง');

/** คืนแฮชของภาพลายเซ็น · ไม่ผ่าน = โยน DocError */
export function checkDrawnSignature(dataUrl: string): { sha256: string; inkPixels: number } {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bytes = Buffer.from(b64, 'base64');
  if (imageMime(bytes) !== 'image/png') throw INVALID();
  const size = imageSize(bytes);
  if (!size || size.width < 80 || size.height < 30 || size.width > MAX_W || size.height > MAX_H) throw INVALID();
  let rgba: Uint8Array;
  try {
    const img = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer);
    rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);
  } catch {
    throw INVALID();
  }
  const { width, height } = size;
  if (rgba.length < width * height * 4) throw INVALID();
  let ink = 0;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      // หมึก = ทึบพอ และไม่ใช่สีขาว (พื้นขาวทึบไม่นับ)
      if (rgba[o + 3] > 40 && rgba[o] + rgba[o + 1] + rgba[o + 2] < 690) {
        ink++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const span = maxX >= 0 ? maxX - minX + (maxY - minY) : 0;
  if (ink < MIN_INK || span < MIN_SPAN || ink / (width * height) > MAX_INK_RATIO) throw INVALID();
  return { sha256: sha256Hex(bytes), inkPixels: ink };
}
