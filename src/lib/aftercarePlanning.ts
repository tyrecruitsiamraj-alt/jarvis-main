import type { FollowEntry } from '@/lib/followApi';
import type { AftercarePerson } from '@/lib/aftercareApi';
import { phoneKey } from '@/lib/followDuplicateGuard';
import { buildAftercareRounds, type AftercareRound } from '@/lib/aftercareRounds';
import { followRoundState, type FollowPlanningRound } from '@/lib/followPlanning';

/**
 * ═══ ปฏิทิน Planning ของหน้า "ดูแลหลังเริ่มงาน" (เจ้าของสั่ง 1 ก.ย. 2569) ═══
 *
 * > *"หน้าดูแลหลังเริ่มงาน ก็ขอเป็นภาพแบบ Planning ให้เห็นว่าแต่ละวัน
 * >  ต้องโทรหาใครอะไรยังไงบ้าง"*
 *
 * รูปเดียวกับปฏิทินหน้าติดตาม (แถว = คน · คอลัมน์ = วัน) แต่ **ช่องมีของสองชนิด**:
 *
 * 1. **รอบที่ครบกำหนด** (3/7/30 วันหลังเริ่มงาน) — คำนวณจาก `start_date`
 *    เป็นแค่ "วันที่ควรโทร" ยังไม่ใช่สายจริง
 * 2. **สายที่ตั้งไว้/โทรไปแล้วจริง** — รายการในหน้าติดตามที่ `topic` = ถามความเป็นอยู่ฯ
 *    และเบอร์ตรงกัน (โครง Follow เดิมทั้งชุด — หน้านี้ไม่มีระบบโทรของตัวเอง)
 *
 * 🔴 **สองอย่างนี้ห้ามปนกัน** — "ถึงกำหนดแล้ว" ไม่ได้แปลว่า "โทรแล้ว"
 * ถ้าวาดรวมเป็นก้อนเดียว จอจะบอกว่าทำแล้วทั้งที่ยังไม่มีใครโทร
 * ⚠️ ไม่รู้วันเริ่มงาน = ไม่มีรอบให้คำนวณ ⇒ **ไม่มีแถวในปฏิทิน** (จอต้องบอกแยกว่ามีกี่คน)
 */

export type AftercareCell = {
  /** รอบ preset ที่ครบกำหนดวันนั้น — `null` = วันนั้นไม่ใช่วันครบรอบ */
  round: AftercareRound | null;
  /** สายจริงของวันนั้น (เรียงตามเวลา) — ว่าง = ยังไม่มีใครตั้งสาย */
  calls: FollowPlanningRound[];
};

export type AftercareMonthRow = {
  person: AftercarePerson;
  rounds: AftercareRound[];
  /** YYYY-MM-DD → ช่อง (เฉพาะวันที่มีของ) */
  byDay: Map<string, AftercareCell>;
};

const bangkokTime = (iso: string): string | null => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const bangkokYmd = (iso: string): string | null => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

/**
 * แถวของปฏิทินดูแลหลังเริ่มงานในเดือนนั้น
 *
 * `calls` = รายการติดตามที่หัวข้อเป็นการถามความเป็นอยู่ (หน้าเรียกกรองมาให้แล้ว)
 * — จับคู่กับคนด้วย **เลข 9 ตัวท้ายของเบอร์** เหมือนที่ระบบใช้จับกลุ่มทุกที่
 */
export function buildAftercareMonthRows(
  people: readonly AftercarePerson[],
  calls: readonly FollowEntry[],
  month: string,
  now: Date = new Date(),
): AftercareMonthRow[] {
  const callsByPhone = new Map<string, FollowEntry[]>();
  for (const c of calls) {
    const key = phoneKey(c.recipient_phone);
    if (!key) continue;
    const list = callsByPhone.get(key);
    if (list) list.push(c);
    else callsByPhone.set(key, [c]);
  }

  const out: AftercareMonthRow[] = [];
  for (const person of people) {
    const rounds = buildAftercareRounds(person.start_date, now);
    const byDay = new Map<string, AftercareCell>();
    const touch = (ymd: string): AftercareCell => {
      const cur = byDay.get(ymd) ?? { round: null, calls: [] };
      byDay.set(ymd, cur);
      return cur;
    };

    for (const r of rounds) {
      if (r.date.slice(0, 7) !== month) continue;
      touch(r.date).round = r;
    }

    const key = phoneKey(person.phone_e164);
    for (const entry of key ? (callsByPhone.get(key) ?? []) : []) {
      if (!entry.scheduled_at) continue;
      const ymd = bangkokYmd(entry.scheduled_at);
      if (!ymd || ymd.slice(0, 7) !== month) continue;
      touch(ymd).calls.push({
        entry,
        state: followRoundState(entry, now),
        time: bangkokTime(entry.scheduled_at),
        ymd,
      });
    }

    // เดือนนี้ไม่มีทั้งรอบและสาย = ไม่ต้องมีแถว (ปฏิทินคือ "เดือนนี้ต้องโทรใครวันไหน")
    if (byDay.size === 0) continue;
    for (const cell of byDay.values()) {
      cell.calls.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    }
    out.push({ person, rounds, byDay });
  }

  // คนที่มีของเร็วที่สุดในเดือนอยู่บน — คนที่ต้องโทรก่อนควรอยู่ต้นตาราง
  const firstDay = (r: AftercareMonthRow): string => [...r.byDay.keys()].sort()[0] ?? '9999-12-31';
  return out.sort((a, b) => firstDay(a).localeCompare(firstDay(b)));
}

/** คนที่ยังไม่รู้วันเริ่มงาน — ขึ้นปฏิทินไม่ได้ ต้องบอกแยกว่าค้างอยู่กี่คน */
export function aftercareMissingStartDate(people: readonly AftercarePerson[]): AftercarePerson[] {
  return people.filter((p) => !p.start_date && !p.closed_at);
}
