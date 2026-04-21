/** วันที่ในระบบเก็บเป็น YYYY-MM-DD (ค.ศ.); UI แสดง/เลือกแบบ วัน/เดือน/ปี พ.ศ. */

export const THAI_MONTHS: { value: number; label: string }[] = [
  { value: 1, label: 'มกราคม' },
  { value: 2, label: 'กุมภาพันธ์' },
  { value: 3, label: 'มีนาคม' },
  { value: 4, label: 'เมษายน' },
  { value: 5, label: 'พฤษภาคม' },
  { value: 6, label: 'มิถุนายน' },
  { value: 7, label: 'กรกฎาคม' },
  { value: 8, label: 'สิงหาคม' },
  { value: 9, label: 'กันยายน' },
  { value: 10, label: 'ตุลาคม' },
  { value: 11, label: 'พฤศจิกายน' },
  { value: 12, label: 'ธันวาคม' },
];

export function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYmd(ymd: string | undefined | null): { y: number; m: number; d: number } | null {
  if (!ymd || typeof ymd !== 'string') return null;
  const m = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime()) || dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  return { y, m: mo, d };
}

export function ceToBeYear(y: number): number {
  return y + 543;
}

export function dmyBeToYmd(day: number, month: number, yearBe: number): string | null {
  const yCe = yearBe - 543;
  const dt = new Date(yCe, month - 1, day);
  if (Number.isNaN(dt.getTime()) || dt.getFullYear() !== yCe || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null;
  }
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${yCe}-${m}-${d}`;
}

/** แสดงเป็น วัน/เดือน/ปี พ.ศ. จาก YYYY-MM-DD หรือสตริง ISO ที่ขึ้นต้นด้วยวันที่ */
export function formatYmdDmyBe(ymd: string | undefined | null): string {
  const raw = (ymd ?? '').trim();
  if (!raw) return '-';
  const p = parseYmd(raw.slice(0, 10));
  if (!p) return raw;
  return `${p.d}/${p.m}/${ceToBeYear(p.y)}`;
}

export function beYearRange(centerCeYear: number, delta = 15): number[] {
  const centerBe = ceToBeYear(centerCeYear);
  const out: number[] = [];
  for (let be = centerBe - delta; be <= centerBe + delta; be += 1) out.push(be);
  return out;
}

/** รายการ YYYY-MM-DD ทุกวันจาก from ถึง to (รวมปลายทาง); to ว่างหรือก่อน from ใช้แค่วันเดียว */
export function buildDateRangeYmd(from: string, to: string | null): string[] {
  if (!from) return [];
  const end = to && to >= from ? to : from;
  const start = new Date(`${from}T00:00:00`);
  const endD = new Date(`${end}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endD.getTime()) || start > endD) return [];

  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= endD) {
    out.push(toYmdLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
