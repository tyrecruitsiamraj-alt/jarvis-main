/** เบอร์ไทยรูปเดียวกับที่ API สาธารณะส่ง (0XX-XXX-XXXX) — ไม่ใช่เบอร์มือถือ/ว่าง = null */
export function formatRecruiterPhone(raw: string | null | undefined): string | null {
  let d = (raw ?? '').replace(/\D/g, '');
  if (d.startsWith('66') && d.length === 11) d = `0${d.slice(2)}`;
  if (!/^0\d{8,9}$/.test(d) || d === '0812345678') return null;
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d;
}
