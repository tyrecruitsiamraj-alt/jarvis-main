/**
 * ย่อรูปในเครื่องก่อนอัปโหลด — ด้านยาวไม่เกิน `side` px เป็น JPEG (รูปจากมือถือ 5 MB เหลือราว 200 KB)
 * ใช้ร่วม: รูปข้อสอบ (17 พ.ย. 2569) · รูปแนบโพสต์ Autopost (17 พ.ย. 2569)
 * รูปพื้นโปร่ง (PNG) ได้พื้นขาว ไม่กลายเป็นดำตอนแปลงเป็น JPEG
 */
export async function shrinkImageToJpeg(file: File, side = 1280): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('เลือกไฟล์รูปเท่านั้น');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('เปิดรูปนี้ไม่ได้ ลองรูป JPG หรือ PNG');
  });
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เปิดรูปนี้ไม่ได้');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
