import type { JobRequest } from '@/types';
import { isReplacementRequest, isResignationRequest } from '@/lib/dashboard/buildDashboardData';
import { jobsToThroughputRecords, type ThroughputRecord } from '@/lib/dashboard/throughput';

export type LifecycleKind =
  | 'resignation'
  | 'replacement'
  | 'increase_headcount'
  | 'new_site'
  | 'other';

export const LIFECYCLE_KIND_LABELS: Record<LifecycleKind, string> = {
  resignation: 'ลาออก',
  replacement: 'เปลี่ยนตัว',
  increase_headcount: 'เพิ่มอัตรา',
  new_site: 'เปิดไซต์',
  other: 'อื่นๆ',
};

export const LIFECYCLE_BOARD_KINDS: Exclude<LifecycleKind, 'other'>[] = [
  'resignation',
  'replacement',
  'increase_headcount',
  'new_site',
];

export function classifyLifecycleKindFromAction(
  actionName?: string | null,
  actionCode?: string | null,
): LifecycleKind {
  const action = (actionName || '').trim();
  const code = (actionCode || '').trim().toUpperCase();
  if (/ลาออก|resign/i.test(action) || code === 'RESIGN') return 'resignation';
  if (/เปลี่ยนตัว|replacement|ทดแทน/i.test(action) || code === 'REPLACE') return 'replacement';
  if (/เพิ่มอัตรา|เพิ่มคน/i.test(action) || code === 'ADD' || code === 'INCREASE') return 'increase_headcount';
  if (/เปิดไซต์|เปิดไซท์|newsites?/i.test(action) || code === 'SITE' || code === 'NEWSITE') return 'new_site';
  return 'other';
}

function actionText(job: JobRequest): string {
  return (job.request_action_name || '').trim();
}

/** จำแนกประเภทใบขอตาม request_action_name */
export function classifyLifecycleKind(job: JobRequest): LifecycleKind {
  const fromAction = classifyLifecycleKindFromAction(job.request_action_name, job.request_action_code);
  if (fromAction !== 'other') return fromAction;
  if (isResignationRequest(job)) return 'resignation';
  if (isReplacementRequest(job)) return 'replacement';
  return classifyLifecycleKindFromAction(actionText(job), job.request_action_code);
}

export function lifecycleKindLabel(kind: LifecycleKind, requestActionName?: string): string {
  if (kind === 'other' && requestActionName?.trim()) return requestActionName.trim();
  return LIFECYCLE_KIND_LABELS[kind];
}

export type LifecycleMetricBucket = {
  positions: number;
  requests: number;
};

export type LifecycleBoardRow = {
  id: 'requested' | 'filled' | 'cancelled' | 'remaining';
  label: string;
  total: LifecycleMetricBucket;
  resignation: LifecycleMetricBucket;
  replacement: LifecycleMetricBucket;
  increaseHeadcount: LifecycleMetricBucket;
  newSite: LifecycleMetricBucket;
  other: LifecycleMetricBucket;
};

export type LifecycleBoardSummary = {
  rows: LifecycleBoardRow[];
  /** % ปิดได้ต่ออัตราที่ขอในแต่ละประเภท */
  fillRateByKind: Record<LifecycleKind, number | null>;
};

type KindBuckets = Record<LifecycleKind, LifecycleMetricBucket>;
type KindRequestSets = Record<LifecycleKind, Set<string>>;

function emptyBucket(): LifecycleMetricBucket {
  return { positions: 0, requests: 0 };
}

function emptyKindBuckets(): KindBuckets {
  return {
    resignation: emptyBucket(),
    replacement: emptyBucket(),
    increase_headcount: emptyBucket(),
    new_site: emptyBucket(),
    other: emptyBucket(),
  };
}

function emptyKindSets(): KindRequestSets {
  return {
    resignation: new Set(),
    replacement: new Set(),
    increase_headcount: new Set(),
    new_site: new Set(),
    other: new Set(),
  };
}

function addPositions(target: LifecycleMetricBucket, positions: number) {
  if (positions <= 0) return;
  target.positions += positions;
}

function markRequest(sets: KindRequestSets, kind: LifecycleKind, requestNo?: string) {
  const no = (requestNo || '').trim();
  if (!no) return;
  sets[kind].add(no);
}

function finalizeRequests(buckets: KindBuckets, sets: KindRequestSets) {
  (Object.keys(buckets) as LifecycleKind[]).forEach((kind) => {
    buckets[kind].requests = sets[kind].size;
  });
}

function rowFromKinds(
  id: LifecycleBoardRow['id'],
  label: string,
  kinds: KindBuckets,
): LifecycleBoardRow {
  const total: LifecycleMetricBucket = {
    positions:
      kinds.resignation.positions +
      kinds.replacement.positions +
      kinds.increase_headcount.positions +
      kinds.new_site.positions +
      kinds.other.positions,
    requests:
      kinds.resignation.requests +
      kinds.replacement.requests +
      kinds.increase_headcount.requests +
      kinds.new_site.requests +
      kinds.other.requests,
  };
  return {
    id,
    label,
    total,
    resignation: kinds.resignation,
    replacement: kinds.replacement,
    increaseHeadcount: kinds.increase_headcount,
    newSite: kinds.new_site,
    other: kinds.other,
  };
}

function resolveRecordKind(r: ThroughputRecord): LifecycleKind {
  if (r.lifecycleKind) return r.lifecycleKind;
  return classifyLifecycleKindFromAction(r.requestActionName, r.requestActionCode);
}

function resolveRecordFlow(r: ThroughputRecord): 'filled' | 'cancelled' | 'remaining' {
  if (r.kind === 'filled' || r.kind === 'cancelled' || r.kind === 'remaining') return r.kind;
  return r.isOpen ? 'remaining' : 'filled';
}

/**
 * Life Cycle ให้ยึดชุดเดียวกับสรุปอัตรา:
 * - เข้ามา / ปิดแล้ว / ยกเลิก จาก throughput cohort (ช่วง request_date)
 * - คงเหลือ จากคิวเปิดที่ต้องหา (เท่าการ์ดคงเหลือ)
 */
export function buildLifecycleBoardFromStockSources(input: {
  throughputRecords: ThroughputRecord[];
  from: string;
  to: string;
  remainingJobs: JobRequest[];
}): LifecycleBoardSummary {
  const requested = emptyKindBuckets();
  const filled = emptyKindBuckets();
  const cancelled = emptyKindBuckets();
  const remaining = emptyKindBuckets();
  const requestedSets = emptyKindSets();
  const filledSets = emptyKindSets();
  const cancelledSets = emptyKindSets();
  const remainingSets = emptyKindSets();

  for (const r of input.throughputRecords) {
    if (r.requestDate < input.from || r.requestDate > input.to) continue;
    if (r.positionUnits <= 0) continue;
    const life = resolveRecordKind(r);
    const flow = resolveRecordFlow(r);
    addPositions(requested[life], r.positionUnits);
    markRequest(requestedSets, life, r.requestNo);
    if (flow === 'filled') {
      addPositions(filled[life], r.positionUnits);
      markRequest(filledSets, life, r.requestNo);
    } else if (flow === 'cancelled') {
      addPositions(cancelled[life], r.positionUnits);
      markRequest(cancelledSets, life, r.requestNo);
    }
  }
  finalizeRequests(requested, requestedSets);
  finalizeRequests(filled, filledSets);
  finalizeRequests(cancelled, cancelledSets);

  for (const job of input.remainingJobs) {
    if (job.status === 'closed' || job.status === 'cancelled') continue;
    const life = classifyLifecycleKind(job);
    const rem =
      job.request_positions != null &&
      job.request_positions > 0 &&
      (job.filled_positions != null || job.cancelled_positions != null)
        ? Math.max(
            Math.round(job.request_positions) -
              Math.min(Math.round(job.filled_positions ?? 0), Math.round(job.request_positions)) -
              Math.min(
                Math.round(job.cancelled_positions ?? 0),
                Math.max(
                  Math.round(job.request_positions) -
                    Math.min(Math.round(job.filled_positions ?? 0), Math.round(job.request_positions)),
                  0,
                ),
              ),
            0,
          )
        : typeof job.position_units === 'number' && job.position_units > 0
          ? Math.round(job.position_units)
          : 1;
    if (rem <= 0) continue;
    addPositions(remaining[life], rem);
    markRequest(remainingSets, life, job.request_no || job.externalId || job.id);
  }
  finalizeRequests(remaining, remainingSets);

  const rows: LifecycleBoardRow[] = [
    rowFromKinds('requested', 'เข้ามา', requested),
    rowFromKinds('filled', 'ปิดแล้ว', filled),
    rowFromKinds('cancelled', 'ยกเลิก', cancelled),
    rowFromKinds('remaining', 'คงเหลือ', remaining),
  ];

  const rate = (kind: LifecycleKind): number | null => {
    const req = requested[kind].positions;
    if (req <= 0) return null;
    return Math.round((filled[kind].positions / req) * 1000) / 10;
  };

  return {
    rows,
    fillRateByKind: {
      resignation: rate('resignation'),
      replacement: rate('replacement'),
      increase_headcount: rate('increase_headcount'),
      new_site: rate('new_site'),
      other: rate('other'),
    },
  };
}

/** สำรองเมื่อไม่มี throughput — สร้าง records จากใบแล้วสรุปแบบชุดเดียวกับ stock */
export function buildLifecycleBoardSummary(
  cohortJobs: JobRequest[],
  remainingJobs: JobRequest[],
): LifecycleBoardSummary {
  const records = jobsToThroughputRecords(cohortJobs);
  let from = '9999-12-31';
  let to = '0001-01-01';
  for (const r of records) {
    if (r.requestDate < from) from = r.requestDate;
    if (r.requestDate > to) to = r.requestDate;
  }
  if (records.length === 0) {
    from = '1970-01-01';
    to = '9999-12-31';
  }
  return buildLifecycleBoardFromStockSources({
    throughputRecords: records,
    from,
    to,
    remainingJobs,
  });
}
