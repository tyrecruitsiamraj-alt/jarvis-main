/**
 * ═══ สรุปแผนติดตามทั้งวัน — ตรรกะล้วน (เจ้าของสั่ง 2 ต.ค. 2569 · Choice "หน้าสรุปบนจอ") ═══
 *
 * > *"เพิ่มดึงรายงานแผนติดตามทั้งหมดของวันนั้นๆ"*
 *
 * หนึ่งแถว = หนึ่งสายของวันนั้น เรียงตามเวลา · **ทุกสายของแท็บทีมนี้** ไม่สนตัวกรองบนจอ (งานจบหรือยัง / ใครโทร / สายที่)
 * เพราะเป็นรายงานของทั้งวัน · สายที่ยกเลิกอยู่ในรายงานด้วย (บอกว่ายกเลิก) · ป้ายสาย/ผลโทรใช้ตัวเดียวกับตาราง
 * `followDayReportTsv` = ข้อความคั่นแท็บ วางลง Excel/LINE ได้
 */
import type { FollowEntry } from '@/lib/followApi';
import { groupFollowEntries } from '@/lib/followGrouping';
import { buildFollowDayCalls, buildFollowPlanningRows, roundResultLabel } from '@/lib/followPlanning';
import { followDayCallLabel } from '@/lib/followDayCall';
import { followCallerOf, FOLLOW_CALLER_LABEL } from '@/lib/followListFilter';

export type FollowDayReportRow = {
  id: string;
  time: string;
  name: string;
  phone: string;
  unit: string;
  call: string;
  caller: string;
  result: string;
  cancelled: boolean;
};

/**
 * ตัวกรองก่อนดู/โหลดรูป (เจ้าของสั่ง 3 ต.ค. 2569: *"สรุปแผนก็ทำให้เลือกวัน เลือกสายได้
 * เลือกว่าจะดูแค่คนหรือ AI หรือหมดเลย ก่อนโหลดรูป"*) — วันเลือกที่ ymd ของ build
 */
export type FollowDayReportFilter = {
  caller: 'all' | 'ai' | 'manual';
  /** เลขสาย (1/2/3…) หรือ 'all' */
  call: number | 'all';
};

export const FOLLOW_DAY_REPORT_NO_FILTER: FollowDayReportFilter = { caller: 'all', call: 'all' };

export type FollowDayReport = {
  ymd: string;
  rows: FollowDayReportRow[];
  people: number;
  /** สายที่ไม่ได้ยกเลิก */
  calls: number;
  ai: number;
  manual: number;
  cancelled: number;
  /** เลขสายที่มีจริงของวันนั้น (ก่อนกรอง) — ไว้สร้างตัวเลือก "สายที่" */
  callNos: number[];
  /** คำบอกขอบเขตเมื่อกรอง เช่น "เฉพาะคนโทร · สายที่ 2" — '' = ทั้งหมด */
  scope: string;
};

/** +66812345678 → 0812345678 (รายงานวางลง Excel/LINE ให้คนกดโทรต่อได้) · รูปอื่นคงเดิม */
export function localThaiPhone(raw: string): string {
  const t = (raw ?? '').trim();
  const m = /^\+66(\d{8,9})$/.exec(t.replace(/[\s-]/g, ''));
  return m ? `0${m[1]}` : t;
}

export function buildFollowDayReport(
  entries: FollowEntry[],
  ymd: string,
  now = new Date(),
  filter: FollowDayReportFilter = FOLLOW_DAY_REPORT_NO_FILTER,
): FollowDayReport {
  const planning = buildFollowPlanningRows(groupFollowEntries(entries, now));
  /**
   * 🔴 ชื่อเดียวกันต้องอยู่ติดกัน (เจ้าของสั่ง 4 ต.ค. 2569 — เดิมเรียงตามเวลาล้วน สายที่ 1 กับ 2 ของคนเดียวกันห่างกันครึ่งตาราง)
   * คนเรียงตามสายแรกของวัน → ในคนเดียวกันเรียงตามเวลา · จับกลุ่มด้วยชื่อ (คนเดียวมีสองเบอร์ก็ยังติดกัน)
   */
  const dayCallsRaw = buildFollowDayCalls(planning, ymd);
  const timeOf = (c: (typeof dayCallsRaw)[number]) => c.round.time ?? '99:99';
  const nameKey = (c: (typeof dayCallsRaw)[number]) => c.row.group.name.trim().replace(/\s+/g, ' ');
  const firstTime = new Map<string, string>();
  for (const c of dayCallsRaw) {
    const k = nameKey(c);
    const t = timeOf(c);
    if (!firstTime.has(k) || t < (firstTime.get(k) as string)) firstTime.set(k, t);
  }
  const allCalls = dayCallsRaw.sort(
    (a, b) =>
      (firstTime.get(nameKey(a)) as string).localeCompare(firstTime.get(nameKey(b)) as string) ||
      nameKey(a).localeCompare(nameKey(b), 'th') ||
      timeOf(a).localeCompare(timeOf(b)) ||
      a.row.group.phone.localeCompare(b.row.group.phone),
  );
  /** เลขสายของรายการ — ตัวเดียวกับที่ป้าย "สายที่ N" ใช้ (call_of_day ก่อนเสมอ) */
  const callNoOf = (e: FollowEntry, slot: number | null) => e.call_of_day ?? e.call_round ?? slot;
  const callNos = [...new Set(allCalls.map((c) => callNoOf(c.round.entry, c.slot)).filter((n): n is number => n != null))].sort(
    (a, b) => a - b,
  );
  const dayCalls = allCalls.filter(({ round, slot }) => {
    const e = round.entry;
    if (filter.caller !== 'all' && followCallerOf(e) !== filter.caller) return false;
    if (filter.call !== 'all' && callNoOf(e, slot) !== filter.call) return false;
    return true;
  });
  const scope = [
    filter.caller === 'all' ? null : filter.caller === 'ai' ? 'เฉพาะ AI โทร' : 'เฉพาะคนโทร',
    filter.call === 'all' ? null : `สายที่ ${filter.call}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const rows: FollowDayReportRow[] = dayCalls.map(({ row, round, slot }) => {
    const e = round.entry;
    const cancelled = round.state === 'cancelled';
    return {
      id: e.id,
      // สาย "ยังไม่ชัวร์เวลา" (134) — เวลาใน scheduled_at เป็นค่าแทน ห้ามโชว์เป็นเวลาจริง
      time: e.time_tbd === true ? 'ยังไม่ระบุเวลา' : (round.time ?? '—'),
      name: row.group.name,
      phone: localThaiPhone(row.group.phone),
      unit: e.unit_name?.trim() || row.group.unitName || '—',
      call:
        followDayCallLabel({ day: e.call_day ?? null, call: e.call_of_day ?? e.call_round ?? null }) ??
        (slot ? `สายที่ ${slot}` : '—'),
      caller: FOLLOW_CALLER_LABEL[followCallerOf(e)],
      result: roundResultLabel(round),
      cancelled,
    };
  });
  const live = rows.filter((r) => !r.cancelled);
  return {
    ymd,
    rows,
    people: new Set(dayCalls.filter((c) => c.round.state !== 'cancelled').map((c) => c.row.group.key)).size,
    calls: live.length,
    ai: live.filter((r) => r.caller === FOLLOW_CALLER_LABEL.ai).length,
    manual: live.filter((r) => r.caller === FOLLOW_CALLER_LABEL.manual).length,
    cancelled: rows.length - live.length,
    callNos,
    scope,
  };
}

export const FOLLOW_DAY_REPORT_HEADERS = ['เวลา', 'ชื่อ', 'เบอร์', 'หน่วยงาน', 'สาย', 'ใครโทร', 'ผล'] as const;

/** คั่นแท็บ — วางลง Excel ได้เป็นคอลัมน์ · แท็บ/ขึ้นบรรทัดในค่าแปลงเป็นเว้นวรรค */
export function followDayReportTsv(report: FollowDayReport): string {
  const cell = (v: string) => v.replace(/[\t\r\n]+/g, ' ').trim();
  const lines = [FOLLOW_DAY_REPORT_HEADERS.join('\t')];
  for (const r of report.rows) {
    lines.push([r.time, r.name, r.phone, r.unit, r.call, r.caller, r.result].map(cell).join('\t'));
  }
  return lines.join('\n');
}
