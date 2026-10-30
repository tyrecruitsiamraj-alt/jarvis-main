/**
 * ═══ กดกล่องบน Dashboard → ใบขอขึ้นในการ์ด "ใบขอเร่งด่วนแค่ไหน" (เจ้าของ 29 ต.ค. 2569 "ทำเลย" · ร่าง 2 "อันนั้นแก้เลย") ═══
 * เดิมกดแล้วเด้งป๊อปรายการ · ตอนนี้การ์ดเร่งด่วนเปลี่ยนเป็นใบของกล่องนั้น แยก ฉุกเฉิน/ย้อนหลัง · ฉุกเฉิน · ล่วงหน้า
 * + ตาราง "ใครคีย์" (นับใบต่อคนกรอก แยกความเร่ง) + รายการทีละใบ (เลขที่ วันที่กรอก คนกรอก หน่วยงาน สถานะ เร่งด่วน วันที่ต้องการ จำนวน)
 *
 * สองแหล่ง — นับเหมือนกล่องที่กดเป๊ะ (การนับของหน้าไม่เปลี่ยน · เจ้าของ "การนับคงเดิมไว้ก่อน"):
 *  - กล่องสถานะทำงาน / ใบขอชั่วคราว → `buildStatusLeadPanel` จากใบใน feed (`buildWorkStatusKpis`):
 *    เฉพาะใบที่ยังต้องหา · จำนวน = ที่ยังต้องหา · ความเร่ง = `computeJobUrgency`
 *  - กล่อง เข้ามา / หาได้แล้ว / ยกเลิก / คงเหลือ → `buildCohortLeadPanel` จาก `buildCohortDrillDown`
 *    (throughput ชุดเดียวกับเลขบนการ์ด) · จำนวน = อัตราของถังนั้น · ความเร่ง = `leadKind` ของแถว
 * ไฟล์นี้ pure — เทสต์ `tests/api/dashboardStatusLead2569-10-29.test.ts`
 */
import { positionBreakdownFromJob } from '@/lib/requestControl';
import { computeJobUrgency } from '@/lib/jobUrgency';
import { resolveUnitRequestWorkStatus, UNIT_REQUEST_WORK_STATUS_LABELS } from '@/lib/unitRequestWorkStatus';
import type { CohortDrillKpi, CohortDrillRow } from '@/lib/dashboard/cohortDrillDown';
import type { RequestLeadKind } from '@/lib/requestLeadKind';
import type { JobRequest } from '@/types';

export const STATUS_LEAD_ORDER: readonly RequestLeadKind[] = ['retroactive', 'urgent', 'advance'];

export type StatusLeadRow = {
  /** คีย์แถว — id ของใบ (เลขที่ใบซ้ำได้: ใบขอชั่วคราวใช้เลขเดียวกับใบจริง) */
  key: string;
  /** ใบที่เปิดได้ · null = เปิดไม่ได้ */
  job: JobRequest | null;
  requestNo: string;
  submitted: string | null;
  submittedBy: string | null;
  unit: string;
  status: string;
  kind: RequestLeadKind;
  required: string | null;
  /** อัตราของกล่องที่กด (สถานะ/คงเหลือ = ที่ยังต้องหา · เข้ามา = ที่ขอ · หาได้ · ยกเลิก) */
  amount: number;
};

export type StatusLeadPanel = {
  total: { requests: number; positions: number };
  kinds: Record<RequestLeadKind, { requests: number; positions: number }>;
  rows: StatusLeadRow[];
};

export type KeyerRow = { name: string; total: number } & Record<RequestLeadKind, number>;

/** ชื่อหัวคอลัมน์จำนวนของรายการ ตามกล่องที่กด */
export const LEAD_AMOUNT_LABEL: Record<CohortDrillKpi, string> = {
  total_requests: 'ขอ',
  closed: 'หาได้',
  cancelled: 'ยกเลิก',
  remaining: 'เหลือหา',
};

/** คนกรอกที่ไม่มีชื่อ — ยังนับในตาราง "ใครคีย์" ห้ามหาย */
export const NO_KEYER = 'ไม่มีชื่อคนกรอก';

const ymd = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null);
/** ชื่อเดียวกับกล่องสถานะ (`buildWorkStatusKpis` ใช้ "กำลังดำเนินการสรรหา" แทน "ดำเนินการ") */
export const statusLabelOf = (s: keyof typeof UNIT_REQUEST_WORK_STATUS_LABELS) => (s === 'in_progress' ? 'กำลังดำเนินการสรรหา' : UNIT_REQUEST_WORK_STATUS_LABELS[s]);

function finish(rows: StatusLeadRow[]): StatusLeadPanel {
  const kinds = Object.fromEntries(STATUS_LEAD_ORDER.map((k) => [k, { requests: 0, positions: 0 }])) as StatusLeadPanel['kinds'];
  for (const r of rows) {
    kinds[r.kind].requests += 1;
    kinds[r.kind].positions += r.amount;
  }
  // ย้อนหลังก่อน · ในชนิดเดียวกันวันที่ต้องการเก่าสุดขึ้นก่อน (ค้างนานสุด)
  rows.sort((a, b) => STATUS_LEAD_ORDER.indexOf(a.kind) - STATUS_LEAD_ORDER.indexOf(b.kind) || (a.required ?? '').localeCompare(b.required ?? '') || a.requestNo.localeCompare(b.requestNo));
  return {
    total: { requests: rows.length, positions: rows.reduce((n, r) => n + r.amount, 0) },
    kinds,
    rows,
  };
}

export function buildStatusLeadPanel(jobs: readonly JobRequest[], today = new Date()): StatusLeadPanel {
  const rows: StatusLeadRow[] = [];
  for (const j of jobs) {
    const remaining = positionBreakdownFromJob(j).remainingPositions;
    if (remaining <= 0) continue;
    rows.push({
      key: String(j.id),
      job: j,
      requestNo: j.request_no ?? String(j.id),
      submitted: ymd(j.request_date),
      submittedBy: j.submittedByName?.trim() || null,
      unit: j.unit_name?.trim() || '—',
      status: statusLabelOf(resolveUnitRequestWorkStatus(j.work_status)),
      kind: computeJobUrgency(j, today).kind,
      required: ymd(j.required_date),
      amount: remaining,
    });
  }
  return finish(rows);
}

/** ใบที่ยังต้องหาแต่ไม่อยู่ใน feed (ไม่มีสถานะทำงาน) — ชื่อเดียวกับกล่อง `work_status_none` */
export const NO_STATUS_LABEL = 'ไม่มีสถานะ';

/**
 * แถว drill-down ของกล่อง เข้ามา/หาได้แล้ว/ยกเลิก/คงเหลือ → แผง
 * `jobOf` คืน `job` ไว้เปิดใบ (ใบใน feed หรือใบเปล่าที่รู้แค่ id) + `inFeed` = อยู่ใน feed (อ่านสถานะทำงานได้)
 * ใบที่ยังต้องหาแต่ไม่อยู่ใน feed = "ไม่มีสถานะ" (ตรงกับกล่อง `work_status_none`)
 */
export function buildCohortLeadPanel(
  drillRows: readonly CohortDrillRow[],
  jobOf: (row: CohortDrillRow) => { job: JobRequest | null; inFeed: boolean },
): StatusLeadPanel {
  const rows: StatusLeadRow[] = drillRows.map((r) => {
    const { job, inFeed } = jobOf(r);
    const status =
      r.remainingPositions > 0
        ? inFeed && job
          ? statusLabelOf(resolveUnitRequestWorkStatus(job.work_status))
          : NO_STATUS_LABEL
        : r.filledPositions > 0
          ? 'ปิดแล้ว'
          : 'ยกเลิก';
    return {
      key: r.jobId ?? r.requestNo,
      job,
      requestNo: r.requestNoDisplay,
      submitted: r.submittedDate,
      submittedBy: r.requesterName ?? (inFeed ? job?.submittedByName?.trim() : null) ?? null,
      unit: r.unitName ?? '—',
      status,
      kind: r.leadKind,
      required: r.requiredDate,
      amount: r.positions,
    };
  });
  return finish(rows);
}

/** กรองแผงเหลือแถวที่ตรงเงื่อนไข — ยอดรวม/ชนิดคิดใหม่จากแถวที่เหลือ */
export function filterLeadPanel(panel: StatusLeadPanel, keep: (row: StatusLeadRow) => boolean): StatusLeadPanel {
  return finish(panel.rows.filter(keep));
}

/** ตาราง "ใครคีย์ใบขอพวกนี้" — นับใบต่อคนกรอก แยกความเร่ง · มากสุดขึ้นก่อน */
export function buildKeyerRows(rows: readonly StatusLeadRow[]): KeyerRow[] {
  const byName = new Map<string, KeyerRow>();
  for (const r of rows) {
    const name = r.submittedBy || NO_KEYER;
    let k = byName.get(name);
    if (!k) {
      k = { name, total: 0, retroactive: 0, urgent: 0, advance: 0 };
      byName.set(name, k);
    }
    k.total += 1;
    k[r.kind] += 1;
  }
  return [...byName.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'th'));
}
