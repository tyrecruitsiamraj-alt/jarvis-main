/**
 * ═══ รอบรับเงิน (เจ้าของ 4 ต.ค. 2569) ═══
 * *"จ่ายรายวันตรงสวัสดิการมันไม่ใช่สวัสดิการ มันเป็นแค่ทางเลือกรับเงิน ให้เลือกได้ว่าจะรับรายเดือน รายวัน รายสัปดาห์"*
 *
 * เก็บที่ `field_overrides.pay_cycles` (เลือกได้หลายแบบ — บางงานให้เลือกรับรายวันหรือรายเดือนก็ได้)
 * ใบเก่าที่ติ๊ก "จ่ายรายวัน" ไว้ในสวัสดิการ = รับรายวัน (อ่านอย่างเดียว · ย้ายจริงตอนมีคนแก้หน้า 3)
 */
export const PAY_CYCLES = [
  { key: 'monthly', label: 'รายเดือน' },
  { key: 'weekly', label: 'รายสัปดาห์' },
  { key: 'daily', label: 'รายวัน' },
] as const;

export type PayCycle = (typeof PAY_CYCLES)[number]['key'];

const KEYS = new Set<string>(PAY_CYCLES.map((c) => c.key));

/** ล้างค่าที่รับมา — เหลือเฉพาะที่รู้จัก ไม่ซ้ำ เรียงตาม `PAY_CYCLES` */
export function cleanPayCycles(raw: unknown): PayCycle[] {
  if (!Array.isArray(raw)) return [];
  const got = new Set(raw.filter((v): v is string => typeof v === 'string' && KEYS.has(v)));
  return PAY_CYCLES.map((c) => c.key).filter((k) => got.has(k));
}

/** บรรทัดสวัสดิการยุคเก่าที่จริง ๆ คือรอบรับเงิน */
export function isLegacyDailyPayLine(line: string): boolean {
  const t = line.trim();
  return t === 'daily_pay' || t === 'จ่ายรายวัน' || t.startsWith('จ่ายรายวัน ');
}

/** รอบรับเงินของใบ — ที่ตั้งไว้ ไม่งั้นอ่านจากสวัสดิการยุคเก่า */
export function payCyclesOf(src: {
  field_overrides?: { pay_cycles?: unknown } | null;
  pay_cycles?: unknown;
  extra_benefits?: readonly string[] | null;
}): PayCycle[] {
  const saved = cleanPayCycles(src.field_overrides?.pay_cycles ?? src.pay_cycles);
  if (saved.length > 0) return saved;
  return (src.extra_benefits ?? []).some((b) => typeof b === 'string' && isLegacyDailyPayLine(b)) ? ['daily'] : [];
}

/**
 * บรรทัดบนการ์ด (เจ้าของ 5 ต.ค. 2569: *"รับเงินรายเดือน · รายสัปดาห์ · รายวัน บอกว่าเลือกได้"*)
 * หลายรอบ = "เลือกรับเงินได้ รายเดือน · รายสัปดาห์ · รายวัน" · รอบเดียว = "รับเงินรายเดือน" · ว่าง = ''
 */
export function payCycleCardText(cycles: readonly PayCycle[]): string {
  if (cycles.length === 0) return '';
  const labels = cycles.map((k) => PAY_CYCLES.find((c) => c.key === k)?.label ?? k);
  return labels.length > 1 ? `เลือกรับเงินได้ ${labels.join(' · ')}` : `รับเงิน${labels[0]}`;
}

/** "รับเงินรายวัน · รายเดือน" — ว่าง = '' */
export function payCycleText(cycles: readonly PayCycle[]): string {
  if (cycles.length === 0) return '';
  return `รับเงิน${cycles.map((k) => PAY_CYCLES.find((c) => c.key === k)?.label ?? k).join(' · ')}`;
}
