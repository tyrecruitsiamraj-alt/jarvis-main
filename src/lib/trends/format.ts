/** รูปแบบตัวเลขบนแท็บ Dashboard — จำนวนมีคั่นหลักพัน · สัดส่วนเป็น % เต็ม */
export const formatTrendNumber = (n: number): string => n.toLocaleString('th-TH');

export const formatTrendPct = (r: number): string => `${Math.round(r * 100)}%`;
