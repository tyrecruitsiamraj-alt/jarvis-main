import type { JobRequest } from '@/types';
import { isReplacementRequest, isResignationRequest } from '@/lib/dashboard/buildDashboardData';

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

function actionText(job: JobRequest): string {
  return (job.request_action_name || '').trim();
}

/** จำแนกประเภทใบขอตาม request_action_name */
export function classifyLifecycleKind(job: JobRequest): LifecycleKind {
  const action = actionText(job);
  if (/ลาออก|resign/i.test(action) || isResignationRequest(job)) return 'resignation';
  if (/เปลี่ยนตัว|replacement/i.test(action) || isReplacementRequest(job)) return 'replacement';
  if (/เพิ่มอัตรา/i.test(action)) return 'increase_headcount';
  if (/เปิดไซต์/i.test(action)) return 'new_site';
  return 'other';
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

type Breakdown = {
  requestPositions: number;
  filledPositions: number;
  cancelledPositions: number;
  remainingPositions: number;
};

function emptyBucket(): LifecycleMetricBucket {
  return { positions: 0, requests: 0 };
}

function emptyKindBuckets(): Record<LifecycleKind, LifecycleMetricBucket> {
  return {
    resignation: emptyBucket(),
    replacement: emptyBucket(),
    increase_headcount: emptyBucket(),
    new_site: emptyBucket(),
    other: emptyBucket(),
  };
}

function addBucket(target: LifecycleMetricBucket, positions: number, asRequest: boolean) {
  if (positions <= 0) return;
  target.positions += positions;
  if (asRequest) target.requests += 1;
}

function unitsFallback(job: JobRequest): number {
  if (typeof job.position_units === 'number' && Number.isFinite(job.position_units) && job.position_units > 0) {
    return Math.round(job.position_units);
  }
  return 1;
}

/** แยกตำแหน่งแบบเดียวกับหน้ารายการ — หลีกเลี่ยง circular import กับ requestControl */
export function lifecyclePositionBreakdown(job: JobRequest): Breakdown {
  if (
    job.request_positions != null &&
    job.request_positions > 0 &&
    (job.filled_positions != null || job.cancelled_positions != null)
  ) {
    const requestPositions = Math.round(job.request_positions);
    const filledPositions = Math.min(Math.round(job.filled_positions ?? 0), requestPositions);
    const cancelledPositions = Math.min(
      Math.round(job.cancelled_positions ?? 0),
      Math.max(requestPositions - filledPositions, 0),
    );
    return {
      requestPositions,
      filledPositions,
      cancelledPositions,
      remainingPositions: Math.max(requestPositions - filledPositions - cancelledPositions, 0),
    };
  }

  const units = unitsFallback(job);
  if (job.status === 'cancelled') {
    return {
      requestPositions: units,
      filledPositions: 0,
      cancelledPositions: units,
      remainingPositions: 0,
    };
  }
  if (job.status === 'closed') {
    return {
      requestPositions: units,
      filledPositions: units,
      cancelledPositions: 0,
      remainingPositions: 0,
    };
  }
  return {
    requestPositions: units,
    filledPositions: 0,
    cancelledPositions: 0,
    remainingPositions: units,
  };
}

function rowFromKinds(
  id: LifecycleBoardRow['id'],
  label: string,
  kinds: Record<LifecycleKind, LifecycleMetricBucket>,
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

/**
 * สรุป Life Cycle เป็นตาราง: เข้ามา / ปิดได้ / ยกเลิก / คงเหลือ
 * แยกตามประเภทใบขอ (ลาออก · เปลี่ยนตัว · เพิ่มอัตรา · เปิดไซต์ · อื่นๆ)
 */
export function buildLifecycleBoardSummary(
  cohortJobs: JobRequest[],
  remainingJobs: JobRequest[],
): LifecycleBoardSummary {
  const requested = emptyKindBuckets();
  const filled = emptyKindBuckets();
  const cancelled = emptyKindBuckets();
  const remaining = emptyKindBuckets();

  for (const job of cohortJobs) {
    const kind = classifyLifecycleKind(job);
    const b = lifecyclePositionBreakdown(job);
    addBucket(requested[kind], b.requestPositions, true);
    addBucket(filled[kind], b.filledPositions, b.filledPositions > 0);
    addBucket(cancelled[kind], b.cancelledPositions, b.cancelledPositions > 0);
  }

  for (const job of remainingJobs) {
    if (job.status === 'closed' || job.status === 'cancelled') continue;
    const kind = classifyLifecycleKind(job);
    const rem = lifecyclePositionBreakdown(job).remainingPositions;
    addBucket(remaining[kind], rem, rem > 0);
  }

  const rows: LifecycleBoardRow[] = [
    rowFromKinds('requested', 'เข้ามา', requested),
    rowFromKinds('filled', 'ปิดได้ (หาได้แล้ว)', filled),
    rowFromKinds('cancelled', 'ยกเลิก', cancelled),
    rowFromKinds('remaining', 'คงเหลือ (ที่ต้องหา)', remaining),
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
