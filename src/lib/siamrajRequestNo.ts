/** ส่วนตัวเลขท้ายเลขใบขอ เช่น LBM6905015 → 6905015 */
export function extractRequestNoDigitSuffix(value: string): string | null {
  const m = value.trim().match(/\d{5,}$/);
  return m ? m[0] : null;
}

export function requestNoMatchesSearch(query: string, requestNo: string | undefined): boolean {
  const q = query.trim().toLowerCase();
  const no = (requestNo || '').trim().toLowerCase();
  if (!q || !no) return false;
  if (no === q || no.includes(q) || q.includes(no)) return true;
  const qDigits = extractRequestNoDigitSuffix(q);
  const noDigits = extractRequestNoDigitSuffix(no);
  if (!(qDigits && noDigits && qDigits === noDigits)) return false;
  // ตัวอักษรนำหน้าที่พิมพ์มาต้องอยู่ในเลขใบขอตามลำดับ (ย่อได้ "lm6905015" → LBM6905015)
  // เจ้าของ 21 ต.ค. 2569: ค้น LBM6910003 แล้ว OPL/PEO/LAM/SQ/DSO6910003 ขึ้นมาด้วย "ก็งงดิ่"
  return isSubsequence(q.slice(0, q.length - qDigits.length).replace(/[^a-z]/g, ''), no.slice(0, no.length - noDigits.length));
}

function isSubsequence(letters: string, within: string): boolean {
  let j = 0;
  for (const c of letters) {
    j = within.indexOf(c, j);
    if (j < 0) return false;
    j += 1;
  }
  return true;
}
