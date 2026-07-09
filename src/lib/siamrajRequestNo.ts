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
  return !!(qDigits && noDigits && qDigits === noDigits);
}
