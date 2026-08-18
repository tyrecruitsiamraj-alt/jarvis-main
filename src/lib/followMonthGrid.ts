import type { FollowEntry } from '@/lib/followApi';
import { groupFollowEntries } from '@/lib/followGrouping';

/**
 * **ตารางสรุปรายเดือนของหน้า Follow** — คน × วัน (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-5
 * โดยส่ง HTML ตารางมอบหมายงานมาเป็นตัวอย่าง: แถว = คน · คอลัมน์ = วันของเดือน ·
 * ช่อง = สถานะของวันนั้น · คอลัมน์อาทิตย์ tint)
 *
 * แถว = กลุ่มเดียวกับการ์ดลิสต์ (เบอร์ 9 ตัวท้าย + เรื่อง — `followGrouping.ts`)
 * ช่อง = รอบโทรของคนนั้นในวันนั้น (เทียบวันแบบเวลาไทย) · สีบอกผลรวมของวัน
 *
 * ลำดับความสำคัญของสีเมื่อวันเดียวมีหลายรอบ: **แดง (หลุด) > เหลือง (ต้องตามต่อ) >
 * เขียว (จบดี) > ฟ้า (สายกำลังเดิน) > เทา (รอโทร)** — ของแรงสุดชนะ เพราะตาราง
 * มีไว้กวาดตาหาปัญหา ไม่ใช่โชว์ความคืบหน้าเฉลี่ย
 */

export type MonthCellTone = 'success' | 'danger' | 'warn' | 'info' | 'neutral';

export type FollowMonthCell = {
  /** จำนวนรอบของวันนั้น (ไม่นับที่ยกเลิก) */
  count: number;
  tone: MonthCellTone;
  /** true = วันนั้นมีแต่รอบที่ยกเลิก — โชว์จาง ๆ พอให้รู้ว่าเคยตั้งไว้ */
  muted: boolean;
  entries: FollowEntry[];
};

export type FollowMonthRow = {
  key: string;
  name: string;
  phone: string;
  topic: string;
  /** YYYY-MM-DD → ช่อง (เฉพาะวันที่มีของ) */
  cells: Map<string, FollowMonthCell>;
};

/** วันตามเวลาไทยของรอบนั้น — ใช้ scheduled_at (วันที่ตั้งใจให้โทร) เป็นหลัก */
function bangkokDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

/** ผลปิดงานที่แปลว่า "จบดี" — คู่กับ FOLLOW_OUTCOME_LOST ฝั่ง followOutcome */
const GOOD_OUTCOMES = new Set(['went', 'arrived', 'done']);
const LOST_OUTCOMES = new Set(['cancelled', 'job_cancelled', 'no_show_start']);

/** สีของรอบเดียว — ตารางรวมทั้งวันด้วยลำดับความสำคัญอีกที */
export function entryTone(e: FollowEntry): MonthCellTone {
  if (e.completed_at && e.outcome_code) {
    if (LOST_OUTCOMES.has(e.outcome_code)) return 'danger';
    if (GOOD_OUTCOMES.has(e.outcome_code)) return 'success';
    return 'warn'; // ลา / เลื่อน / อื่น ๆ — ยังไม่จบจริง ต้องตามต่อ
  }
  switch (e.call_status) {
    case 'completed':
      return 'success'; // โทรติดแล้ว
    case 'failed':
      return 'warn'; // โทรไม่ติด — ต้องตามต่อ
    case 'delivered':
      return 'info'; // สายกำลังเดินอยู่ฝั่ง AI
    default:
      return 'neutral'; // รอโทร
  }
}

/** แรงสุดชนะ — ตารางมีไว้กวาดตาหาปัญหา */
const TONE_PRIORITY: MonthCellTone[] = ['danger', 'warn', 'success', 'info', 'neutral'];

export function combineTones(tones: MonthCellTone[]): MonthCellTone {
  for (const t of TONE_PRIORITY) if (tones.includes(t)) return t;
  return 'neutral';
}

export function buildFollowMonthGrid(entries: FollowEntry[], month: string): FollowMonthRow[] {
  const groups = groupFollowEntries(entries);
  const rows: FollowMonthRow[] = [];

  for (const g of groups) {
    const cells = new Map<string, FollowMonthCell>();
    for (const e of g.rounds) {
      const day = bangkokDay(e.scheduled_at);
      if (!day || !day.startsWith(month)) continue;
      let cell = cells.get(day);
      if (!cell) {
        cell = { count: 0, tone: 'neutral', muted: true, entries: [] };
        cells.set(day, cell);
      }
      cell.entries.push(e);
      if (!e.cancelled) {
        cell.count += 1;
        cell.muted = false;
      }
    }
    for (const cell of cells.values()) {
      const active = cell.entries.filter((e) => !e.cancelled);
      cell.tone = active.length > 0 ? combineTones(active.map(entryTone)) : 'neutral';
    }
    // คนที่ไม่มีรอบในเดือนนี้เลย ไม่ต้องมีแถว — ตารางคือ "เดือนนี้ใครมีนัดวันไหน"
    if (cells.size > 0) {
      rows.push({ key: g.key, name: g.name, phone: g.phone, topic: g.topic, cells });
    }
  }
  return rows;
}

/** วันทั้งหมดของเดือน (YYYY-MM-DD) + เลขวัน + ตัวย่อวันไทย + ธงวันอาทิตย์ */
export function monthDayColumns(
  month: string,
): Array<{ ymd: string; day: number; weekday: string; isSunday: boolean }> {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return [];
  const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: Array<{ ymd: string; day: number; weekday: string; isSunday: boolean }> = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    out.push({
      ymd: `${month}-${String(d).padStart(2, '0')}`,
      day: d,
      weekday: WEEKDAYS[dow],
      isSunday: dow === 0,
    });
  }
  return out;
}
