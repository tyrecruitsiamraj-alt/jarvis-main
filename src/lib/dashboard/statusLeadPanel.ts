/**
 * ═══ กดกล่องสถานะทำงานบน Dashboard → ใบขอขึ้นในการ์ด "ใบขอเร่งด่วนแค่ไหน" (เจ้าของ 29 ต.ค. 2569 "ทำเลย") ═══
 * เดิมกดแล้วเด้งป๊อปรายการ · ตอนนี้การ์ดเร่งด่วนเปลี่ยนเป็นใบของสถานะนั้น แยก ฉุกเฉิน/ย้อนหลัง · ฉุกเฉิน · ล่วงหน้า
 * แล้วมีรายการทีละใบ (เลขที่ วันที่กรอก คนกรอก หน่วยงาน สถานะ เร่งด่วน วันที่ต้องการ ต้องหา)
 * นับเหมือนกล่องสถานะ (`buildWorkStatusKpis`): เฉพาะใบที่ยังต้องหา (`remainingPositions > 0`) · อัตรา = ที่ยังต้องหา
 * ความเร่ง = `computeJobUrgency` (เกณฑ์ของใบ) ตัวเดียวกับหน้าใบขอ · ไม่ได้กดกล่อง = การ์ดเร่งด่วนเดิม (ใบที่เข้ามาในช่วง)
 * ไฟล์นี้ pure — เทสต์ `tests/api/dashboardStatusLead2569-10-29.test.ts`
 */
import { positionBreakdownFromJob } from '@/lib/requestControl';
import { computeJobUrgency } from '@/lib/jobUrgency';
import { resolveUnitRequestWorkStatus, UNIT_REQUEST_WORK_STATUS_LABELS } from '@/lib/unitRequestWorkStatus';
import type { RequestLeadKind } from '@/lib/requestLeadKind';
import type { JobRequest } from '@/types';

export const STATUS_LEAD_ORDER: readonly RequestLeadKind[] = ['retroactive', 'urgent', 'advance'];

export type StatusLeadRow = {
  job: JobRequest;
  requestNo: string;
  submitted: string | null;
  submittedBy: string | null;
  unit: string;
  status: string;
  kind: RequestLeadKind;
  required: string | null;
  remaining: number;
};

export type StatusLeadPanel = {
  total: { requests: number; positions: number };
  kinds: Record<RequestLeadKind, { requests: number; positions: number }>;
  rows: StatusLeadRow[];
};

const ymd = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null);
/** ชื่อเดียวกับกล่องสถานะ (`buildWorkStatusKpis` ใช้ "กำลังดำเนินการสรรหา" แทน "ดำเนินการ") */
const statusLabelOf = (s: keyof typeof UNIT_REQUEST_WORK_STATUS_LABELS) => (s === 'in_progress' ? 'กำลังดำเนินการสรรหา' : UNIT_REQUEST_WORK_STATUS_LABELS[s]);

export function buildStatusLeadPanel(jobs: readonly JobRequest[], today = new Date()): StatusLeadPanel {
  const kinds = Object.fromEntries(STATUS_LEAD_ORDER.map((k) => [k, { requests: 0, positions: 0 }])) as StatusLeadPanel['kinds'];
  const rows: StatusLeadRow[] = [];
  for (const j of jobs) {
    const remaining = positionBreakdownFromJob(j).remainingPositions;
    if (remaining <= 0) continue;
    const kind = computeJobUrgency(j, today).kind;
    kinds[kind].requests += 1;
    kinds[kind].positions += remaining;
    rows.push({
      job: j,
      requestNo: j.request_no ?? String(j.id),
      submitted: ymd(j.request_date),
      submittedBy: j.submittedByName?.trim() || null,
      unit: j.unit_name?.trim() || '—',
      status: statusLabelOf(resolveUnitRequestWorkStatus(j.work_status)),
      kind,
      required: ymd(j.required_date),
      remaining,
    });
  }
  // ย้อนหลังก่อน · ในชนิดเดียวกันวันที่ต้องการเก่าสุดขึ้นก่อน (ค้างนานสุด)
  rows.sort((a, b) => STATUS_LEAD_ORDER.indexOf(a.kind) - STATUS_LEAD_ORDER.indexOf(b.kind) || (a.required ?? '').localeCompare(b.required ?? '') || a.requestNo.localeCompare(b.requestNo));
  return {
    total: { requests: rows.length, positions: rows.reduce((n, r) => n + r.remaining, 0) },
    kinds,
    rows,
  };
}
