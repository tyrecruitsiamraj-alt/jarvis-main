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

export type FollowDayReport = {
  ymd: string;
  rows: FollowDayReportRow[];
  people: number;
  /** สายที่ไม่ได้ยกเลิก */
  calls: number;
  ai: number;
  manual: number;
  cancelled: number;
};

/** +66812345678 → 0812345678 (รายงานวางลง Excel/LINE ให้คนกดโทรต่อได้) · รูปอื่นคงเดิม */
export function localThaiPhone(raw: string): string {
  const t = (raw ?? '').trim();
  const m = /^\+66(\d{8,9})$/.exec(t.replace(/[\s-]/g, ''));
  return m ? `0${m[1]}` : t;
}

export function buildFollowDayReport(entries: FollowEntry[], ymd: string, now = new Date()): FollowDayReport {
  const planning = buildFollowPlanningRows(groupFollowEntries(entries, now));
  const dayCalls = buildFollowDayCalls(planning, ymd).sort(
    (a, b) =>
      (a.round.time ?? '99:99').localeCompare(b.round.time ?? '99:99') ||
      a.row.group.name.localeCompare(b.row.group.name, 'th'),
  );
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
