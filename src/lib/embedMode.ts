/**
 * **โหมดฝัง (iframe)** ของหน้าสาธารณะ — เจ้าของถาม 3 ก.ย. 2569: *"หน้าสาธารณะ
 * ทำเป็น iframe ได้ไหม"*
 *
 * ตอบ: ฝังได้อยู่แล้ว (ระบบไม่ได้ตั้ง `X-Frame-Options` กันไว้) แต่ถ้าฝังดิบ ๆ
 * จะได้หัวเว็บ + ท้ายเว็บของเราซ้อนเข้าไปในหน้าเขา ⇒ ต่อ `?embed=1` เพื่อ
 * **ตัดหัว-ท้ายและพื้นหลังของเราออก** ให้เนื้อในกลืนไปกับหน้าที่เอาไปวาง
 *
 * 🔴 ตัดแค่ **เปลือก** — เนื้อหา ปุ่มสมัคร และตัวกรองยังครบเหมือนเดิมทุกอย่าง
 * (ห้ามตัดของที่ผู้สมัครต้องใช้ตัดสินใจ · หน้านี้คือหน้าที่คนจริงกำลังจะสมัครงาน)
 *
 * ตัวอย่างที่เอาไปแปะในเว็บบริษัท:
 * ```html
 * <iframe src="https://<โดเมนของเรา>/apply?embed=1"
 *         style="width:100%;border:0" height="1200"></iframe>
 * ```
 */

/** อยู่ในโหมดฝังไหม — อ่านจาก query `?embed=1` ของ URL ปัจจุบัน */
export function isEmbedMode(search: string = window.location.search): boolean {
  const v = new URLSearchParams(search).get('embed');
  return v === '1' || v === 'true';
}

/**
 * อยู่ในกรอบ iframe จริงไหม (ไม่เกี่ยวกับ `?embed=1`)
 * ใช้ตอนส่งความสูงกลับไปให้หน้าแม่ — ไม่ได้อยู่ในกรอบก็ไม่ต้องส่ง
 */
export function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // ต่างโดเมนจนอ่าน window.top ไม่ได้ = อยู่ในกรอบแน่นอน
    return true;
  }
}

/** ชนิดข้อความที่ส่งหาหน้าแม่ — ตั้งชื่อเฉพาะกันชนกับสคริปต์อื่นบนหน้านั้น */
export const EMBED_HEIGHT_MESSAGE = 'so-recruit:height';

/**
 * บอกความสูงหน้าแม่เรื่อย ๆ เพื่อให้ iframe ยืดตามเนื้อหา (ไม่ต้องตั้งความสูงตายตัว)
 * คืนฟังก์ชันสำหรับเลิกติดตาม
 *
 * ⚠️ ส่งไป `'*'` เพราะเราไม่รู้ล่วงหน้าว่าใครเอาไปฝัง — ข้อความมีแค่ตัวเลขความสูง
 * ไม่มีข้อมูลส่วนตัว จึงไม่ใช่ช่องรั่ว
 */
export function startEmbedHeightReporter(): () => void {
  if (!isFramed()) return () => {};
  let last = 0;
  const send = () => {
    const h = Math.ceil(document.documentElement.scrollHeight);
    if (h === last) return;
    last = h;
    window.parent.postMessage({ type: EMBED_HEIGHT_MESSAGE, height: h }, '*');
  };
  send();
  const ro = new ResizeObserver(send);
  ro.observe(document.documentElement);
  window.addEventListener('load', send);
  return () => {
    ro.disconnect();
    window.removeEventListener('load', send);
  };
}
