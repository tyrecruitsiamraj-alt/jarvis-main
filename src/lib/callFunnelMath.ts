/**
 * เลขคณิตของ funnel การโทร — นิยาม "ฐาน" ของทุกเปอร์เซ็นต์อยู่ที่นี่ที่เดียว
 *
 * บทเรียนจริง (7 ส.ค. 2569): ผลกลับ 458 สาย เป็นสายที่คนกดยกเลิกเอง 409
 * ถ้าเอา 458 เป็นฐาน จะได้ "โทรติด 7%" ซึ่งหลอกตา — สายที่โทรจริง 49 สาย
 * ติดถึง 61% · ตัวเลขชุดนี้คือข้อมูลประกอบการตัดสินใจเปิดโหมด auto
 * เพี้ยนเมื่อไหร่เจ้าของตัดสินใจผิดทาง จึงมีเทสต์คุมที่ tests/api/callFunnelMath.test.ts
 */

/** รับแบบโครงสร้าง ไม่ผูกกับ CallFunnel ตรง ๆ — ให้เทสต์/ตัวเรียกอื่นใช้ได้โดยไม่ลาก apiFetch มา */
export type FunnelCounts = {
  withResult: number;
  connected: number;
  needsHuman: number;
  byOutcome: Record<string, number>;
};

/**
 * ฐานของเปอร์เซ็นต์ = สายที่มีผลจริง — **หักสายที่คนกดยกเลิกออกเสมอ**
 * เพราะสายยกเลิกไม่เคยถูกโทร ไม่ใช่ทั้งความสำเร็จและความล้มเหลวของการโทร
 */
export function resolvedCallBase(f: Pick<FunnelCounts, 'withResult' | 'byOutcome'>): number {
  return f.withResult - (f.byOutcome.cancelled ?? 0);
}

export type ConversionRates = {
  /** สายที่มีผลจริง (หักยกเลิกแล้ว) — ตัวหารของทุกเปอร์เซ็นต์ */
  base: number;
  /** % โทรติด (ได้คุยกับคนจริง) */
  connectedPct: number;
  /** % สนใจงาน */
  confirmedPct: number;
  /** % ตกถังต้องคนตาม */
  needsHumanPct: number;
};

/** คืน null เมื่อไม่มีสายที่มีผลจริง — ตัวเรียกไม่ต้องกันหารศูนย์เอง */
export function conversionRates(f: FunnelCounts): ConversionRates | null {
  const base = resolvedCallBase(f);
  if (base <= 0) return null;
  const pct = (n: number) => Math.round((n / base) * 100);
  return {
    base,
    connectedPct: pct(f.connected),
    confirmedPct: pct(f.byOutcome.confirmed ?? 0),
    needsHumanPct: pct(f.needsHuman),
  };
}
