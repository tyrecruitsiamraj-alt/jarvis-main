/**
 * ก๊อปปี้ข้อความ — ใช้ทุกปุ่มก๊อปปี้ในระบบ (27 ต.ค. 2569 เจ้าของกด "ก๊อปปี้ลิงก์" แล้วขึ้นก๊อปไม่ได้)
 * `navigator.clipboard` ถูกบางเบราว์เซอร์/หน้าต่างฝังกันไว้ ⇒ ถอยไปวิธีเดิม (textarea + execCommand)
 * ทั้งสองทางไม่ได้ = throw (ผู้เรียกบอกให้เลือกข้อความเอง)
 */
export async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // ถอยไปวิธีเดิมข้างล่าง
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
  if (!ok) throw new Error('copy failed');
}
