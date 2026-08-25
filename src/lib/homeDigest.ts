/**
 * สามแผงล่างของหน้าหลัก (Phase 10.2) — pure ทั้งหมด · มีเทสต์
 *
 * แผงที่ 1 "อัปเดตล่าสุด"     = โต๊ะไหนขยับล่าสุด (เรียงตามเวลาเหตุการณ์)
 * แผงที่ 2 "ผลงานเด่นประจำวัน" = โต๊ะไหนทำได้มากสุดวันนี้ (เรียงตามจำนวน)
 * แผงที่ 3 "ผลโทรเดือนนี้"     = ผลโทรแยกตามคำตอบ (มาจาก flow-summary ที่หน้าแรกโหลดอยู่แล้ว)
 *
 * 🔴 กติกา:
 * 1. **ไม่มีของ = ไม่มีแถว** — แผงที่ว่างต้องบอกว่าว่างด้วยคำ ไม่ใช่แถว 0 ยาวเป็นพืด
 * 2. **ทุกแถวมีหน่วย** (ใบ/สาย/คน/ราย) — บทเรียน "292 กับ 340"
 * 3. **เวลาเป็นข้อความสัมพัทธ์** ("12 นาทีที่แล้ว") แต่ต้องคืน `null` เมื่อไม่รู้เวลา
 *    ห้ามเดาว่า "เมื่อสักครู่"
 */
import type { DeskId } from '@/lib/officeFloor';

export type DeskTodayLike = { count: number; unit: string; lastAt: string | null };

/** ชื่อโต๊ะบนแผง — ต้องตรงกับชื่อในฉากห้องทำงาน (คนละคำ = คนอ่านคิดว่าคนละทีม) */
export const DESK_NAME: Record<DeskId, string> = {
  intake: 'ทีมสรรหา',
  aiCalls: 'AI โทร (Lumos)',
  selection: 'คัดสรร / เสนองาน',
  follow: 'โทรติดตาม (Follow)',
  content: 'คอนเทนต์ / Scraping',
  aftercare: 'ดูแลหลังเริ่มงาน',
};

export type DigestRow = {
  id: DeskId;
  name: string;
  count: number;
  unit: string;
  lastAt: string | null;
};

const DESK_ORDER: readonly DeskId[] = [
  'intake',
  'aiCalls',
  'selection',
  'follow',
  'content',
  'aftercare',
];

/** แปลง map ที่ API ส่งมาเป็นแถว — ข้ามโต๊ะที่ API ไม่ได้ส่งมาเลย */
export function digestRows(map: Record<string, DeskTodayLike> | null | undefined): DigestRow[] {
  if (!map) return [];
  return DESK_ORDER.filter((id) => map[id]).map((id) => ({
    id,
    name: DESK_NAME[id],
    count: Math.max(0, Math.trunc(map[id].count || 0)),
    unit: map[id].unit || 'รายการ',
    lastAt: map[id].lastAt ?? null,
  }));
}

/**
 * "อัปเดตล่าสุด" — เอาเฉพาะโต๊ะที่**มีเวลาเหตุการณ์** แล้วเรียงใหม่สุดก่อน
 * โต๊ะที่วันนี้ไม่ขยับเลยไม่ควรอยู่ในแผงนี้ (ไม่ใช่ "อัปเดต")
 */
export function latestUpdates(rows: readonly DigestRow[], limit = 4): DigestRow[] {
  return rows
    .filter((r) => Boolean(r.lastAt))
    .sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))
    .slice(0, limit);
}

/**
 * "ผลงานเด่นประจำวัน" — เรียงมากไปน้อย · ตัดโต๊ะที่ยังไม่มีผลงานวันนี้ออก
 * เท่ากันให้เรียงตามลำดับงานจริง (ไม่สลับที่ทุกครั้งที่โหลด)
 */
export function dailyLeaders(rows: readonly DigestRow[], limit = 5): DigestRow[] {
  return rows
    .filter((r) => r.count > 0)
    .sort(
      (a, b) => b.count - a.count || DESK_ORDER.indexOf(a.id) - DESK_ORDER.indexOf(b.id),
    )
    .slice(0, limit);
}

/** ความยาวแท่งเทียบตัวมากสุดในชุด (0-100) — ชุดว่างคืน 0 ไม่ใช่ NaN */
export function barPct(value: number, rows: readonly DigestRow[]): number {
  const max = Math.max(...rows.map((r) => r.count), 0);
  if (max <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}

/**
 * เวลาสัมพัทธ์แบบสั้น — ไม่รู้เวลาคืน `null` (จอจะไม่วาดช่องเวลาเลย)
 * ⚠️ รับ `now` เข้ามาเพื่อให้เทสต์ได้ (ห้ามอ่านนาฬิกาในฟังก์ชัน pure)
 */
export function agoText(iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = now.getTime() - t;
  if (diff < 0) return 'อีกไม่นาน';
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'เมื่อครู่นี้';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}
