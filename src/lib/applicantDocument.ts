/**
 * ═══ ไฟล์แนบของใบสมัคร — ตรรกะล้วน (ไม่มี React) ═══
 *
 * เจ้าของแจ้ง 7 ก.ย. 2569: กดปุ่มตา "ดูรายละเอียด" แล้ว *"มีไฟล์แนบมาแต่ดูไม่ได้"*
 * ต้นเหตุ: ป๊อปรายละเอียด (`ApplicantContactDialog`) **ไม่เคยวาดส่วนไฟล์แนบเลย** —
 * ตารางขึ้นไอคอน 📄 "มีเอกสารแนบ" (`RmTable`) แต่ในป๊อปไม่มีทั้งลิงก์และปุ่ม
 * ⇒ คนเห็นว่ามีไฟล์ แต่ไม่มีทางเปิด · เส้น `/api/job-application-document` มีอยู่แล้ว
 * และทำงานปกติ (JobApplicantsDialog ใช้ดาวน์โหลดอยู่) — ขาดแค่หน้าจอ
 *
 * 🔴 ห้ามเปิด public — เส้นเดิมเป็น GET + `withRbac('job-applications')` +
 * `isApplicationInWriteScope` (จำกัด BU) อยู่แล้ว ไม่แตะ
 */

/** ชนิดที่เปิดดูได้ในหน้าเลย vs ต้องดาวน์โหลดไปเปิดเอง */
export type AttachmentKind = 'image' | 'pdf' | 'other';

/**
 * ดูจาก mime ก่อน (ของจริงจากตอนอัปโหลด) แล้วค่อยถอยไปดูนามสกุล
 * — ใบเก่าบางใบเก็บ mime เป็น `application/octet-stream` ทั้งที่เป็น PDF
 */
export function attachmentKind(mime?: string | null, filename?: string | null): AttachmentKind {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  const ext = (filename || '').toLowerCase().split('.').pop() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}

/** ป้ายบอกคนอ่านว่าไฟล์นี้เปิดดูในหน้าได้ไหม */
export function attachmentKindLabel(kind: AttachmentKind): string {
  if (kind === 'image') return 'รูปภาพ';
  if (kind === 'pdf') return 'ไฟล์ PDF';
  return 'ไฟล์เอกสาร';
}

/**
 * base64 → Blob
 *
 * 🔴 ทำไมต้องเป็น Blob ไม่ใช่ `data:` URL: เบราว์เซอร์ **บล็อกการเปิด `data:` URL
 * เป็นหน้าใหม่** (Chrome ตั้งแต่ 60) ⇒ `<a href="data:…" target="_blank">` ได้หน้าว่าง
 * ส่วน `<iframe src="data:application/pdf">` ก็ถูกบล็อกด้วย · `blob:` ของ origin
 * ตัวเองเปิดได้ทั้งแท็บใหม่และ iframe
 */
export function base64ToBlob(dataBase64: string, mime: string): Blob {
  const bin = atob(dataBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

/** ชื่อไฟล์ที่เอาไปโชว์/ดาวน์โหลดได้เสมอ (ว่าง = ตั้งชื่อกลาง ๆ ให้) */
export function attachmentFilename(filename?: string | null): string {
  const name = (filename || '').trim();
  return name === '' ? 'เอกสารแนบ' : name;
}
