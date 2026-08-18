import { toYmdBangkok } from '@/lib/dateTh';

/**
 * ปฏิทินการโทรของหน้า Follow (เจ้าของสั่ง 18 ส.ค. 2569:
 * *"มี calendar ให้หน่อยเพื่อจะได้รู้ว่าแต่ละวันโทรกี่คน"*)
 *
 * ⚠️ **นับตามปฏิทินกรุงเทพเสมอ** — สายที่ตั้งไว้ตี 1 ของไทยยังเป็น "เมื่อวาน" ที่ UTC
 * ตัดวันฝั่ง UTC = ยอดของวันเพี้ยนไปทั้งเดือน (กับดักเดียวกับคอลัมน์ "ผ่านมาแล้ว")
 *
 * ⚠️ แยก **"นัดจะโทร"** (`scheduled_at`) กับ **"โทรไปแล้ว"** (`called_at`) คนละถัง
 * วันข้างหน้ามีแต่ตัวแรก · วันที่ผ่านมาดูตัวหลังถึงจะรู้ว่าเกิดขึ้นจริงกี่สาย
 * ยุบสองอันเป็นเลขเดียว = อ่านไม่ออกว่า "โทรแล้ว" หรือ "แค่ตั้งไว้"
 *
 * ไฟล์นี้ pure — เทสต์ที่ `tests/api/followCallCalendar.test.ts`
 */

export type CalendarEntry = {
  id: string;
  /** เวลาที่ตั้งให้โทร (ISO) */
  scheduled_at?: string | null;
  /** เวลาที่มีผลโทรกลับมา (ISO) — ไม่มี = ยังไม่เกิดขึ้นจริง */
  called_at?: string | null;
  cancelled?: boolean;
};

export type CalendarDay = {
  /** YYYY-MM-DD ตามปฏิทินกรุงเทพ */
  ymd: string;
  /** ตั้งไว้ว่าจะโทรวันนี้กี่สาย (ไม่นับที่ยกเลิก) */
  planned: number;
  /** โทรไปแล้วจริงกี่สายในวันนี้ */
  called: number;
  /** ยกเลิกไปกี่สาย — แยกถังเพราะไม่ใช่ทั้ง planned และ called */
  cancelled: number;
};

/** วัน (YYYY-MM-DD ไทย) ของค่าเวลา — ค่าเสีย/ว่าง = null ไม่ใช่วันนี้ */
export function callDayKey(iso: string | null | undefined): string | null {
  const raw = (iso ?? '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return toYmdBangkok(d);
}

/** รวมยอดต่อวันของทั้งชุด — คีย์เป็น YYYY-MM-DD ไทย */
export function buildCallCalendar(entries: readonly CalendarEntry[]): Map<string, CalendarDay> {
  const out = new Map<string, CalendarDay>();
  const touch = (ymd: string): CalendarDay => {
    const cur = out.get(ymd) ?? { ymd, planned: 0, called: 0, cancelled: 0 };
    out.set(ymd, cur);
    return cur;
  };
  for (const e of entries) {
    const plannedDay = callDayKey(e.scheduled_at);
    if (plannedDay) {
      // ยกเลิกแล้วไม่ใช่ "จะโทร" อีกต่อไป — แยกถังไว้ ไม่งั้นยอดวันนั้นโป่งด้วยสายที่ตายแล้ว
      if (e.cancelled) touch(plannedDay).cancelled += 1;
      else touch(plannedDay).planned += 1;
    }
    const calledDay = callDayKey(e.called_at);
    // โทรจริงนับที่ **วันที่ผลกลับมา** ซึ่งอาจคนละวันกับที่ตั้งไว้
    if (calledDay) touch(calledDay).called += 1;
  }
  return out;
}

/** เดือนของวัน (YYYY-MM) */
export function monthKeyOf(ymd: string): string {
  return ymd.slice(0, 7);
}

/**
 * ช่องปฏิทินของเดือนนั้น — เริ่มวันอาทิตย์ เติมช่องว่างหัว/ท้ายให้ครบสัปดาห์
 * คืน `null` = ช่องว่างนอกเดือน (ไม่ใช่วันที่ 0)
 */
export function monthGridDays(monthKey: string): Array<string | null> {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return [];
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return [];
  // ใช้ UTC ล้วนในการคำนวณกริด — ไม่เกี่ยวกับเขตเวลาเครื่องผู้ใช้
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells: Array<string | null> = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${m[1]}-${m[2]}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** เลื่อนเดือน (+1 / -1) แบบไม่ข้ามปีผิด */
export function shiftMonth(monthKey: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return monthKey;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
