/**
 * ตาราง SLA **แยกตามชนิดใบขอ** (ฉุกเฉิน/ย้อนหลัง · ฉุกเฉิน · ล่วงหน้า)
 *
 * เจ้าของสั่ง: *"หน้า Dashboard ข้อมูลต้องเปลี่ยนตาม Filter เพิ่มนี่ด้วยพวกฉุกเฉิน ล่วงหน้า ฯลฯ
 * พวกนั้นอะอยากให้มีบอกด้วยว่าปิดทัน / ไม่ทัน อย่างละกี่ใบ"*
 *
 * ทำไมต้องมีไฟล์นี้ ทั้งที่ระบบมี `buildSlaSummary` อยู่แล้ว:
 * ของเดิมเป็นยอดรวม 5 ถังแบนราบ ตอบได้แค่ "ทั้งระบบเกิน SLA กี่ใบ" — ไม่ได้ตอบว่า
 * **ใบชนิดไหน** ที่ปิดไม่ทัน ซึ่งเป็นคำถามที่เจ้าของถาม (ใบฉุกเฉิน 7 วัน กับใบล่วงหน้า 15 วัน
 * คนละเกณฑ์กัน รวมกันแล้วอ่านไม่ได้ความ)
 *
 * 🔴 กติกาที่ล็อกไว้ด้วยเทสต์:
 * 1. **แถวต้องบวกได้เท่ายอดของแถวนั้นเสมอ** (5 ถัง + ไม่ระบุ = total) — โปรเจกต์นี้เจ็บมาแล้ว
 *    กับเลขที่ "ถูกแต่ตอบผิดคำถาม" จึงต้องมี sum-check
 * 2. **ชนิดใบขอมาจาก `computeJobUrgency()` ที่เดียว** — ห้ามคิดเส้นแบ่ง 7 วันเองซ้ำ
 *    (กติกาเดิมของ `requestLeadKind.ts`)
 * 3. **นับเป็น "ใบ" ไม่ใช่อัตรา** — คำถามคือ "อย่างละกี่ใบ" · 1 record = 1 ใบขอ
 * 4. **ใบที่ยังคิด SLA ไม่ได้ต้องไม่หายเงียบ** → ถัง `unknown` (โชว์เฉพาะเมื่อมีจริง)
 */

import { computeJobUrgency } from '@/lib/jobUrgency';
import type { RequestControlRecord } from '@/lib/requestControl';
import {
  REQUEST_LEAD_KIND_LABEL,
  REQUEST_LEAD_KIND_TONE,
  type RequestLeadKind,
} from '@/lib/requestLeadKind';
import type { ToneKey } from '@/lib/designTokens';
import type { SlaStatus } from '@/lib/jobSla';

/**
 * ช่องในตาราง — คีย์ตรงกับ `slaStatus` ของ record บวกสองถังพิเศษ
 *
 * 🔴 `cancelled` **ต้องแยกออกมาเอง** ไม่ใช้ `slaStatus` ตรง ๆ:
 * `computeJobSla()` ตอบ `closed_*` เฉพาะเมื่อ `controlStatus === 'fully_closed'`
 * ใบที่ **ยกเลิก** จึงตกไปกิ่งเดียวกับใบที่ยังเปิด แล้วกลายเป็น `breached` ถ้าเลยกำหนด
 * → บนจอจะอ่านว่า "ยังไม่ปิด · เกินแล้ว" ทั้งที่ใบถูกยกเลิกไปแล้ว (เจอจริงตอนตรวจงาน
 * 22 ส.ค. 2569: ดึงชุดใบปิดเข้ามาแล้วช่อง "เกินแล้ว" กระโดดจาก 200 → 1,582)
 * และมันชนกติกาแม่ของโปรเจกต์: **ห้ามปนยกเลิกกับหาได้/ค้าง**
 */
export type SlaCellKey = SlaStatus | 'cancelled' | 'unknown';

export const SLA_CELL_ORDER: readonly SlaCellKey[] = [
  'closed_on_time',
  'closed_late',
  'cancelled',
  'breached',
  'at_risk',
  'on_track',
  'unknown',
];

/** คำบนหัวตาราง — ต้องบอก "ปิดแล้ว" กับ "ยังไม่ปิด" ให้ชัด ไม่งั้นอ่านรวมกันเป็นกองเดียว */
export const SLA_CELL_LABEL: Record<SlaCellKey, string> = {
  closed_on_time: 'ปิดทัน',
  closed_late: 'ปิดไม่ทัน',
  cancelled: 'ยกเลิก',
  breached: 'ยังไม่ปิด · เกินแล้ว',
  at_risk: 'ยังไม่ปิด · เสี่ยง',
  on_track: 'ยังไม่ปิด · ยังทัน',
  unknown: 'คิด SLA ไม่ได้',
};

export const SLA_CELL_TONE: Record<SlaCellKey, ToneKey> = {
  closed_on_time: 'success',
  closed_late: 'orange',
  cancelled: 'neutral',
  breached: 'danger',
  at_risk: 'warn',
  on_track: 'info',
  unknown: 'neutral',
};

export type SlaLeadKindRow = {
  kind: RequestLeadKind;
  label: string;
  tone: ToneKey;
  /** จำนวนใบต่อช่อง — คีย์ครบทุกช่องเสมอ (0 ได้) */
  cells: Record<SlaCellKey, number>;
  /** รวมทั้งแถว = ผลบวกของ cells */
  total: number;
  /** ปิดไปแล้วทั้งหมดในแถวนี้ (ทัน + ไม่ทัน) — ตัวหารของ onTimeRate */
  closed: number;
  /** ปิดทันคิดเป็น % ของที่ปิดแล้ว (ไม่มีใบปิด = null ไม่ใช่ 0) */
  onTimeRatePercent: number | null;
};

export type SlaByLeadKind = {
  rows: SlaLeadKindRow[];
  /** แถวรวมทุกชนิด */
  totalRow: SlaLeadKindRow;
  /** ช่องที่มีของจริงอย่างน้อย 1 ใบ — ใช้ตัดคอลัมน์ที่ว่างทั้งตารางออก (กันตารางโล่ง) */
  visibleCells: SlaCellKey[];
};

const LEAD_KIND_ORDER: readonly RequestLeadKind[] = ['retroactive', 'urgent', 'advance'];

/**
 * ใบนี้อยู่ช่องไหน — **ที่เดียว** ใช้ทั้งตัวนับและ drill-down
 * (กติกา bucket-parity ของโปรเจกต์: กล่องกับรายการต้องใช้เงื่อนไขตัวเดียวกัน)
 *
 * ลำดับตัดสิน: ยกเลิก → สถานะ SLA → ไม่รู้
 */
export function slaCellOf(record: RequestControlRecord): SlaCellKey {
  if (record.controlStatus === 'cancelled_full') return 'cancelled';
  return record.slaStatus ?? 'unknown';
}

const emptyCells = (): Record<SlaCellKey, number> => ({
  closed_on_time: 0,
  closed_late: 0,
  cancelled: 0,
  breached: 0,
  at_risk: 0,
  on_track: 0,
  unknown: 0,
});

function makeRow(kind: RequestLeadKind, cells: Record<SlaCellKey, number>): SlaLeadKindRow {
  const total = SLA_CELL_ORDER.reduce((sum, k) => sum + cells[k], 0);
  const closed = cells.closed_on_time + cells.closed_late;
  return {
    kind,
    label: REQUEST_LEAD_KIND_LABEL[kind],
    tone: REQUEST_LEAD_KIND_TONE[kind],
    cells,
    total,
    closed,
    onTimeRatePercent: closed > 0 ? Math.round((cells.closed_on_time / closed) * 1000) / 10 : null,
  };
}

/**
 * @param records ใบขอที่ผ่านตัวกรองของหน้ามาแล้ว — **ผู้เรียกต้องส่งชุดเดียวกับที่การ์ดอื่นใช้**
 *                ไม่งั้นตารางนี้จะไม่ขยับตามตัวกรอง หรือขยับแต่ได้เลขคนละชุด
 * @param today   วันอ้างอิง (ทดสอบส่งเข้ามาได้)
 */
export function buildSlaByLeadKind(
  records: RequestControlRecord[],
  today = new Date(),
): SlaByLeadKind {
  const byKind = new Map<RequestLeadKind, Record<SlaCellKey, number>>();
  for (const k of LEAD_KIND_ORDER) byKind.set(k, emptyCells());

  for (const r of records) {
    // ชนิดใบขอ: เส้นแบ่งเดียวของระบบ (ห้ามคิด 7 วันเองซ้ำที่นี่)
    const kind = computeJobUrgency(r.job, today).kind;
    const cells = byKind.get(kind);
    if (!cells) continue;
    const cell = slaCellOf(r);
    cells[cell] += 1;
  }

  const rows = LEAD_KIND_ORDER.map((k) => makeRow(k, byKind.get(k) ?? emptyCells()));

  const totalCells = emptyCells();
  for (const row of rows) {
    for (const k of SLA_CELL_ORDER) totalCells[k] += row.cells[k];
  }
  // แถวรวมยืม kind ของแถวแรกเพื่อไม่ต้องแตก type — ผู้เรียกใช้ label ของตัวเองอยู่แล้ว
  const totalRow = { ...makeRow('advance', totalCells), label: 'รวมทุกชนิด', tone: 'neutral' as ToneKey };

  return {
    rows,
    totalRow,
    visibleCells: SLA_CELL_ORDER.filter((k) => totalCells[k] > 0),
  };
}

/** กรองรายการสำหรับ drill-down ของ 1 ช่อง (ชนิดใบขอ × ถัง SLA) */
export function filterRecordsForSlaCell(
  records: RequestControlRecord[],
  kind: RequestLeadKind,
  cell: SlaCellKey,
  today = new Date(),
): RequestControlRecord[] {
  return records.filter(
    (r) => computeJobUrgency(r.job, today).kind === kind && slaCellOf(r) === cell,
  );
}

/** กรองทั้งแถว (ชนิดใบขอเดียว ทุกถัง) — ใช้เมื่อกดที่ชื่อแถว */
export function filterRecordsForLeadKind(
  records: RequestControlRecord[],
  kind: RequestLeadKind,
  today = new Date(),
): RequestControlRecord[] {
  return records.filter((r) => computeJobUrgency(r.job, today).kind === kind);
}
