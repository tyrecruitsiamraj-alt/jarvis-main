/**
 * ═══ หน้าหลักโฉมใหม่ (แบบ Codex · เจ้าของ 8 ต.ค. 2569) — ตัวรวมเลขของแท่งแยก AI/คน ═══
 * เจ้าของ: *"ยังคง Concept ต้องตอบได้หมดนะ ไม่เอาแค่ไปเท่าไหร่ แต่ต้องบอกได้ว่า ไปเนี่ย Ai โทร คนโทรเท่าไหร่ Bu ไหนใช้เยอะ"*
 * ทุกแท่ง = หนึ่งผล (หรือหนึ่ง BU) แบ่งชิ้นตามใครโทร · ชิ้นรวมกัน = เลขของแท่ง · ทุกแท่งรวมกัน = ทั้งหมดของหัวข้อ
 * แหล่งเดียวกับตารางราย BU (`followBuBlocks` · `reportBuBlocks`) — ไม่มีนิยามใหม่ · pure · เทสต์ `tests/api/homeSplit.test.ts`
 */
import type { AiShareSegment } from '@/lib/homeAiShare';
import { followBuTable, type FollowBuCell, type FollowBucketKey, type FollowPersonCell } from '@/lib/homeLumosSummary';
import { REPORT_SEGS, reportBuBlocks, type TopicReport } from '@/lib/homeTopicReport';

/** `note` = คำขยายใต้ชื่อแถว (เช่น ล้มเหลวคืออะไร) */
export type SplitRow = {
  key: string;
  label: string;
  total: number;
  parts: Partial<Record<AiShareSegment, number>>;
  note?: string;
  /** ผลย่อยของ "โทรแล้ว" — จอย่อหน้า + เส้นนำ (เจ้าของ 8 ต.ค. 2569 "รอโทรกับยกเลิกและโทรไปแยกก้อนให้ดูแล้วรู้") */
  child?: boolean;
  /** เส้นคั่นก้อนก่อนแถวนี้ */
  divider?: boolean;
};

const sumParts = (p: Partial<Record<AiShareSegment, number>>) => Object.values(p).reduce((n, v) => n + (v ?? 0), 0);

/** ติดตาม: แต่ละผล แบ่ง AI โทร / คนโทร (`caller` ของแผน) */
export function followResultSplit(
  cells: readonly FollowBuCell[],
  cols: ReadonlyArray<{ key: FollowBucketKey; label: string; note?: string }>,
): SplitRow[] {
  return cols.map((c) => {
    const parts = { ai: 0, staff: 0 };
    for (const x of cells) {
      if (x.bucket !== c.key) continue;
      if (x.caller === 'ai') parts.ai += x.n;
      else parts.staff += x.n;
    }
    return { key: c.key, label: c.label, note: c.note, total: sumParts(parts), parts };
  });
}

/** ติดตาม: แต่ละ BU แบ่ง AI โทร / คนโทร · มากไปน้อย · BU ไม่มีงานไม่ขึ้น */
export function followBuSplit(cells: readonly FollowBuCell[]): SplitRow[] {
  return followBuTable(cells, 'all', 'all')
    .rows.filter((r) => r.total > 0)
    .map((r) => ({ key: r.bu ?? 'none', label: r.bu ?? 'ไม่ระบุ BU', total: r.total, parts: { ai: r.ai, staff: r.staff } }));
}

/**
 * ติดตามแบบคน + สาย (เจ้าของ 29 ต.ค. 2569 *"กี่คน กี่สาย ไปกี่คน ไม่ไปกี่คน"*)
 * แต่ละผล = คน (`followPeople`) คู่กับสาย (`followByBu`) · ไป/ไม่ไป ขึ้นเสมอ (0 ก็ขึ้น) · ผลอื่นขึ้นเมื่อมีคนหรือสาย
 */
export type FollowPersonRow = { key: FollowBucketKey; label: string; people: number; calls: number };

export function followPersonResults(
  people: readonly FollowPersonCell[],
  cells: readonly FollowBuCell[],
  cols: ReadonlyArray<{ key: FollowBucketKey; label: string }>,
): FollowPersonRow[] {
  return cols
    .map((c) => ({
      key: c.key,
      label: c.label,
      people: people.reduce((n, x) => n + (x.bucket === c.key ? x.n : 0), 0),
      calls: cells.reduce((n, x) => n + (x.bucket === c.key ? x.n : 0), 0),
    }))
    .filter((r) => r.people > 0 || r.calls > 0 || r.key === 'went' || r.key === 'notWent');
}

/** สายที่โทรแล้วจริง vs ยังรอ แยก AI / คน — "AI โทร" ห้ามนับสายที่ยังรอ (เคยขึ้น 264 ทั้งที่รอ 84) */
export function followCallsMade(cells: readonly FollowBuCell[]): { aiDone: number; aiWaiting: number; staffDone: number; staffWaiting: number } {
  const out = { aiDone: 0, aiWaiting: 0, staffDone: 0, staffWaiting: 0 };
  for (const c of cells) {
    if (c.bucket === 'cancelled') continue;
    const waiting = c.bucket === 'waiting';
    if (c.caller === 'ai') out[waiting ? 'aiWaiting' : 'aiDone'] += c.n;
    else out[waiting ? 'staffWaiting' : 'staffDone'] += c.n;
  }
  return out;
}

/** ติดตามนับคน: คนเริ่มงาน / ส่งคนแทน */
export function followPersonTeams(people: readonly FollowPersonCell[]): { main: number; replacement: number } {
  const out = { main: 0, replacement: 0 };
  for (const c of people) if (c.bucket !== 'cancelled') out[c.team] += c.n;
  return out;
}

/** ติดตาม: คนเริ่มงาน / ส่งคนแทน */
export function followTeamTotals(cells: readonly FollowBuCell[]): { main: number; replacement: number } {
  const out = { main: 0, replacement: 0 };
  for (const c of cells) out[c.team] += c.n;
  return out;
}

/** หัวข้ออื่น: แต่ละผล แบ่งก้อน AI โทร / คนโทร / ทั้งสองทาง / ยังไม่โทร (กติกาเดียวกับกล่อง) */
export function reportResultSplit(report: TopicReport): SplitRow[] {
  return report.cols.map((c) => {
    const parts: Partial<Record<AiShareSegment, number>> = Object.fromEntries(REPORT_SEGS.map((s) => [s.key, 0]));
    for (const x of report.cells) if (x.col === c.key) parts[x.seg] = (parts[x.seg] ?? 0) + x.n;
    return { key: c.key, label: c.label, total: sumParts(parts), parts };
  });
}

/** หัวข้ออื่น: แต่ละ BU แบ่งก้อน */
export function reportBuSplit(report: TopicReport): SplitRow[] {
  return reportBuBlocks(report).map((b) => ({
    key: b.bu ?? 'none',
    label: b.bu ?? 'ไม่ระบุ BU',
    total: b.total,
    parts: Object.fromEntries(REPORT_SEGS.map((s) => [s.key, b.bySeg[s.key].total])),
  }));
}

/** แถว "ทั้งหมด" บนสุดของแท่งผล (เจ้าของ 8 ต.ค. 2569 "ผลโทรต้องไล่เป็น โทรทั้งหมด ไป ไม่ไป …") — ชิ้นรวมทุกแถว */
export function splitTotalRow(rows: readonly SplitRow[], label: string): SplitRow {
  const parts: Partial<Record<AiShareSegment, number>> = {};
  for (const r of rows)
    for (const [k, v] of Object.entries(r.parts)) parts[k as AiShareSegment] = (parts[k as AiShareSegment] ?? 0) + (v ?? 0);
  return { key: 'all', label, total: sumParts(parts), parts };
}

/**
 * แถว "โทรแล้ว" ต่อจากทั้งหมด (เจ้าของ 8 ต.ค. 2569 "ผลโทร โทรทั้งหมด แล้วไหนอะที่บอกว่าโทรไปแล้วเท่าไหร่")
 * - `keys` = รวมเฉพาะผลที่โทรไปแล้ว (ติดตาม: ไป · ไม่ไป · ขอเลื่อน · สรุปไม่ได้ · ล้มเหลว — ไม่นับยกเลิก/รอ ⇒ เท่าบรรทัด "โทรแล้ว" ในกล่อง)
 * - `dropSeg` = ตัดก้อนที่ยังไม่โทรออก (งานสรรหา/จับคู่งาน นับก้อนตามหลักฐานโทร ⇒ เท่ากล่อง AI + คน + ทั้งสองทาง)
 */
export function splitCalledRow(
  rows: readonly SplitRow[],
  label: string,
  opts: { keys?: readonly string[]; dropSeg?: AiShareSegment },
): SplitRow {
  const picked = opts.keys ? rows.filter((r) => opts.keys!.includes(r.key)) : rows;
  const base = splitTotalRow(picked, label);
  if (opts.dropSeg) delete base.parts[opts.dropSeg];
  return { ...base, key: 'called', total: sumParts(base.parts) };
}

/**
 * จัดแท่งผลเป็นก้อน: ทั้งหมด │ โทรแล้ว + ผลย่อย (ย่อหน้า) │ ที่ยังไม่ได้โทร (ยกเลิก · รอ)
 * `calledKeys` = ผลที่นับเป็นโทรแล้ว · ที่เหลือไปก้อนท้ายตามลำดับเดิม
 */
export function groupResultRows(total: SplitRow, called: SplitRow, cols: readonly SplitRow[], calledKeys: readonly string[]): SplitRow[] {
  // ลำดับตาม calledKeys (ติดตาม: วันหยุด/ลางานต่อท้ายล้มเหลว — เจ้าของ 14 ต.ค. 2569) · หัวข้ออื่นส่งตามลำดับช่องอยู่แล้ว
  const inCalled = calledKeys
    .map((k) => cols.find((r) => r.key === k))
    .filter((r): r is SplitRow => Boolean(r))
    .map((r) => ({ ...r, child: true }));
  const rest = cols.filter((r) => !calledKeys.includes(r.key)).map((r, i) => (i === 0 ? { ...r, divider: true } : r));
  return [total, { ...called, divider: true }, ...inCalled, ...rest];
}

export const splitRowsTotal = (rows: readonly SplitRow[]) => rows.reduce((n, r) => n + r.total, 0);
