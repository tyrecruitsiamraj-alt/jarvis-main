/**
 * ═══ เลขสายแบบ "วันที่ D · สายที่ N" (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"ตัวเลขที่ลงยาวอะมันต้อง วันที่ 1 สายที่ 1 2 วันที่ 2 สายที่ 1 2 ไม่ใช่ 1 2 3 4 5 6"*
 * ตารางหลายวันนับ `call_round` ต่อทั้งชุด (1…14) เพื่อเลือกบทของ AI — **เลขนั้นยังเก็บเหมือนเดิม**
 * (สายแรกของชุดเท่านั้นที่ใช้บทแนะนำตัว) · ไฟล์นี้คิดแค่เลขที่คนอ่านบนจอ + กองของแท็บ "สายที่ 1/2/3"
 *
 * - ชุด = `group_id` เดียวกัน · **D** = วันตามปฏิทินนับจากวันแรกของชุด (วัน "ไม่โทร" ไม่ทำให้เลขวันเลื่อน)
 *   ขึ้น D เฉพาะชุดที่มีมากกว่าหนึ่งวัน · **N** = ลำดับสายในวันนั้น (เรียงตาม `call_round` แล้วตามเวลา)
 * - สายที่ยกเลิกไม่กินเลขของสายที่ยังอยู่ (ยกเลิกสายเช้า → สายบ่ายเป็นสายที่ 1) · ตัวที่ยกเลิกใช้ลำดับเดิมของมันในวันนั้น
 * - แถวเก่าไม่มีชุด = ใช้ `call_round` ที่คนเลือกไว้ตามเดิม (null = ถอยไปใช้ attempt ที่ `followRoundSlot`)
 *
 * ไฟล์นี้ pure — เทสต์ที่ `src/lib/followDayCall.test.ts`
 */
import type { FollowEntry } from '@/lib/followApi';
import { replaceSlotRoundOfRef } from '@/lib/irecruitReplaceSync';

export type FollowDayCallPos = {
  /** วันที่เท่าไหร่ของชุด — null = ชุดวันเดียว / แถวเก่าไม่มีชุด */
  day: number | null;
  /** สายที่เท่าไหร่ของวันนั้น — null = แถวเก่าที่ไม่รู้ลำดับ */
  call: number | null;
};

type DayCallRow = Pick<FollowEntry, 'id' | 'group_id' | 'scheduled_at' | 'call_round' | 'cancelled'> &
  Partial<Pick<FollowEntry, 'source_ref' | 'plan_day_start' | 'plan_day_no'>>;

/**
 * "ติดตามครั้งที่" ที่ตั้งตอนเพิ่ม (137 · เจ้าของ 6 ต.ค. 2569) — เลขวันแรกของชุด · ไม่ตั้ง/1 = นับ 1 ตามเดิม
 * ตั้งไว้ (> 1) = ชุดวันเดียวก็ขึ้นเลขวัน (เช่น "วันที่ 3 · สายที่ 1") ไม่งั้นคนอ่านไม่รู้ว่าเป็นครั้งที่เท่าไหร่
 */
const startOf = (rows: readonly DayCallRow[]): number | null => {
  let best: number | null = null;
  for (const r of rows) {
    const v = r.plan_day_start;
    if (typeof v === 'number' && Number.isInteger(v) && v > 1 && (best === null || v < best)) best = v;
  }
  return best;
};

/** 🔴 `Intl` ระดับโมดูลเท่านั้น */
const BKK_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const msOf = (iso: string | null | undefined): number => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
};

const ymdOf = (iso: string | null | undefined): string | null => {
  const t = msOf(iso);
  return Number.isFinite(t) ? BKK_YMD.format(new Date(t)) : null;
};

/** จำนวนวันจาก a ถึง b (YYYY-MM-DD ทั้งคู่) — คิดด้วย UTC ล้วน */
const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

const byRoundThenTime = (a: DayCallRow, b: DayCallRow) =>
  (a.call_round ?? Number.POSITIVE_INFINITY) - (b.call_round ?? Number.POSITIVE_INFINITY) ||
  msOf(a.scheduled_at) - msOf(b.scheduled_at) ||
  a.id.localeCompare(b.id);

/** ตำแหน่ง "วันที่ D · สายที่ N" ของทุกสาย (คีย์ = id) */
export function followDayCallPositions(entries: readonly DayCallRow[]): Map<string, FollowDayCallPos> {
  const out = new Map<string, FollowDayCallPos>();
  const sets = new Map<string, DayCallRow[]>();
  for (const e of entries) {
    /**
     * 🔴 แถวส่งคนแทนจาก iRecruit = "สายที่ 1/2/3" ตาม Journey ไม่ใช่ลำดับในวัน (เจ้าของ 6 ต.ค. 2569)
     * เดิมคอนเฟิร์ม 16:00 ขึ้น "วันที่ 1 สายที่ 1" · ก่อน 1 ชม. ขึ้น "วันที่ 2 สายที่ 1" ⇒ สายที่ 2 ของ Journey ไปอยู่กองสายที่ 1
     */
    const slot = replaceSlotRoundOfRef(e.source_ref);
    if (slot != null) {
      out.set(e.id, { day: null, call: slot });
      continue;
    }
    if (!e.group_id) {
      out.set(e.id, { day: startOf([e]), call: e.call_round ?? null });
      continue;
    }
    const list = sets.get(e.group_id);
    if (list) list.push(e);
    else sets.set(e.group_id, [e]);
  }

  for (const rows of sets.values()) {
    const byDay = new Map<string, DayCallRow[]>();
    for (const r of rows) {
      const ymd = ymdOf(r.scheduled_at);
      if (!ymd) {
        out.set(r.id, { day: null, call: r.call_round ?? null });
        continue;
      }
      const list = byDay.get(ymd);
      if (list) list.push(r);
      else byDay.set(ymd, [r]);
    }
    const days = [...byDay.keys()].sort();
    const first = days[0];
    const multiDay = days.length > 1;
    const start = startOf(rows);
    for (const [ymd, list] of byDay) {
      /** เลือกเลขรายวันไว้ (140 · เจ้าของ 8 ต.ค. 2569 "พฤหัส ครั้งที่ 1 · ศุกร์ ครั้งที่ 2 …") = ใช้ตรง ๆ */
      const explicit = list.reduce<number | null>(
        (m, r) => (typeof r.plan_day_no === 'number' && r.plan_day_no >= 1 && (m === null || r.plan_day_no < m) ? r.plan_day_no : m),
        null,
      );
      const day =
        explicit ?? (first && (multiDay || start !== null) ? daysBetween(first, ymd) + (start ?? 1) : null);
      const all = [...list].sort(byRoundThenTime);
      const live = all.filter((r) => !r.cancelled);
      for (const r of all) {
        const order = r.cancelled ? all.indexOf(r) : live.indexOf(r);
        out.set(r.id, { day, call: order + 1 });
      }
    }
  }
  return out;
}

/** เติม `call_day` / `call_of_day` ให้ทุกแถว — เรียกที่เดียวตอนโหลดรายการ (`listFollowEntries`) */
export function withFollowDayCalls<T extends DayCallRow>(entries: readonly T[]): Array<T & { call_day: number | null; call_of_day: number | null }> {
  const pos = followDayCallPositions(entries);
  return entries.map((e) => {
    const p = pos.get(e.id) ?? { day: null, call: e.call_round ?? null };
    return { ...e, call_day: p.day, call_of_day: p.call };
  });
}

/** ป้ายของสายเดียว — "วันที่ 2 · สายที่ 1" (ชุดหลายวัน) / "สายที่ 2" / null = ไม่รู้ลำดับ */
export function followDayCallLabel(pos: { day?: number | null; call?: number | null }): string | null {
  if (pos.call == null) return null;
  return pos.day != null ? `วันที่ ${pos.day} · สายที่ ${pos.call}` : `สายที่ ${pos.call}`;
}

/**
 * ป้ายของแถวในตัวแก้ตาราง — คิดจากเวลาในช่องตอนนี้ (ยังไม่บันทึก) ร่วมกับสายที่โทรไปแล้วของชุด
 * + สายที่ยกเลิกไปแล้ว (`cancelled` · ไม่โชว์ แต่นับวันแรกของชุดเหมือนตารางรายวัน — ป้ายสองที่ต้องตรงกัน)
 * เลขวันนับจากวันแรกของทั้งชุด · ลำดับในวันเรียงตามเวลา · แถวที่เวลายังอ่านไม่ออก = null
 */
export function scheduleDraftDayCallLabels(
  rows: ReadonlyArray<{ key: string; iso: string | null; cancelled?: boolean }>,
): Map<string, string | null> {
  const fake: DayCallRow[] = rows.map((r) => ({
    id: r.key,
    group_id: 'draft',
    scheduled_at: r.iso,
    call_round: null,
    cancelled: Boolean(r.cancelled),
  }));
  const pos = followDayCallPositions(fake);
  return new Map(rows.map((r) => [r.key, r.iso ? followDayCallLabel(pos.get(r.key) ?? { call: null }) : null]));
}
