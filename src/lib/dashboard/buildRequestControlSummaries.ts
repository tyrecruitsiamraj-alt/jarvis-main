import type {
  DashboardCohortRow,
  DashboardExecutiveInsights,
  DashboardFlowView,
  DashboardFulfillmentCohortSummary,
  DashboardFullyClosedCohortSummary,
  DashboardLifecycleTrendPoint,
  DashboardRequestCohortSummary,
  DashboardRequestControlSummary,
  DashboardSlaSummary,
  DashboardFulfillmentBreakdown,
  DashboardSlaHighlight,
} from './types';
import type { RequestControlRecord } from '@/lib/requestControl';
import {
  countRequests,
  filterRecordsByEffectiveDate,
  filterRecordsCancelledInPeriod,
  filterRecordsCarriedOver,
  filterRecordsFilledInPeriod,
  filterRecordsFullyClosedInPeriod,
  sumPositions,
} from '@/lib/requestControl';
import type { LifecycleKind } from '@/lib/dashboard/lifecycle';
import type { ThroughputRecord } from './throughput';

function inYmdRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
}

function cohortRow(
  id: DashboardCohortRow['id'],
  label: string,
  records: RequestControlRecord[],
): DashboardCohortRow {
  return {
    id,
    label,
    requestPositions: sumPositions(records, (r) => r.requestPositions),
    requestCount: records.length,
    filledPositions: sumPositions(records, (r) => r.filledPositions),
    remainingPositions: sumPositions(records, (r) => r.remainingPositions),
    fullyClosedRequests: countRequests(records, (r) => r.isFullyClosed),
    partialRequests: countRequests(records, (r) => r.isPartial),
    cancelledRequests: countRequests(records, (r) => r.isCancelled),
  };
}

export function buildRequestControlSummary(
  records: RequestControlRecord[],
  from: string,
  to: string,
  throughputRecords: ThroughputRecord[] = [],
): DashboardRequestControlSummary {
  const newRecords = filterRecordsByEffectiveDate(records, from, to);
  const carriedRecords = filterRecordsCarriedOver(records, from);

  const carriedOverPositions = sumPositions(carriedRecords, (r) => r.remainingPositions);
  const carriedOverRequests = carriedRecords.length;
  const newRequestPositions = sumPositions(newRecords, (r) => r.requestPositions);
  const newRequestRequests = newRecords.length;
  const totalWorkloadPositions = carriedOverPositions + newRequestPositions;
  const totalWorkloadRequests = carriedOverRequests + newRequestRequests;

  const filledFromThroughput = throughputRecords
    .filter((r) => r.kind === 'filled' && r.closureDate && inYmdRange(r.closureDate, from, to))
    .reduce((s, r) => s + r.positionUnits, 0);

  const filledRecords = filterRecordsFilledInPeriod(records, from, to);
  const filledPositionsThisPeriod =
    filledFromThroughput > 0
      ? filledFromThroughput
      : sumPositions(filledRecords, (r) => r.filledPositions);

  const fullyClosedRecords = filterRecordsFullyClosedInPeriod(records, from, to);
  const fullyClosedRequestsThisPeriod = fullyClosedRecords.length;
  const fullyClosedPositionsThisPeriod = sumPositions(fullyClosedRecords, (r) => r.requestPositions);

  const partialRecords = records.filter((r) => r.isPartial);
  const partialRequests = partialRecords.length;
  const partialPositions = sumPositions(partialRecords, (r) => r.remainingPositions);

  const cancelledFromThroughput = throughputRecords
    .filter((r) => r.kind === 'cancelled' && r.closureDate && inYmdRange(r.closureDate, from, to))
    .reduce((s, r) => s + r.positionUnits, 0);

  const cancelledRecords = filterRecordsCancelledInPeriod(records, from, to);
  const cancelledPositionsThisPeriod =
    cancelledFromThroughput > 0
      ? cancelledFromThroughput
      : sumPositions(cancelledRecords, (r) => r.cancelledPositions);
  const cancelledRequestsThisPeriod = cancelledRecords.length;

  const remainingRecords = records.filter((r) => r.remainingPositions > 0);
  const remainingPositions = sumPositions(remainingRecords, (r) => r.remainingPositions);
  const remainingRequests = remainingRecords.length;

  const fulfillment = buildFulfillmentCohortSummary(records, from, to, throughputRecords);
  const filledFromOld =
    fulfillment.rows.find((r) => r.id === 'requested_before_period_filled_this_period')?.filledPositions ?? 0;
  const filledFromNew =
    fulfillment.rows.find((r) => r.id === 'requested_this_period_filled_this_period')?.filledPositions ?? 0;

  const startingBacklogPositions = carriedOverPositions;
  const endingBacklogPositions = Math.max(
    startingBacklogPositions + newRequestPositions - filledPositionsThisPeriod - cancelledPositionsThisPeriod,
    0,
  );
  const netBacklogChange = endingBacklogPositions - startingBacklogPositions;

  const workloadRecords = [...carriedRecords, ...newRecords];
  const resignationRequestPositions = sumPositions(
    workloadRecords.filter((r) => r.lifecycleKind === 'resignation'),
    (r) => r.requestPositions,
  );

  const fullClosureRatePercent = pct(fullyClosedRequestsThisPeriod, totalWorkloadRequests);

  return {
    carriedOverPositions,
    carriedOverRequests,
    newRequestPositions,
    newRequestRequests,
    totalWorkloadPositions,
    totalWorkloadRequests,
    filledPositionsThisPeriod,
    filledPositionsFromOldRequests: filledFromOld,
    filledPositionsFromCurrentMonthRequests: filledFromNew,
    fullyClosedPositionsThisPeriod,
    fullyClosedRequestsThisPeriod,
    partialRequests,
    partialPositions,
    cancelledPositionsThisPeriod,
    cancelledRequestsThisPeriod,
    remainingPositions,
    remainingRequests,
    startingBacklogPositions,
    endingBacklogPositions,
    netBacklogChange,
    resignationRequestPositions,
    fillRatePercent: pct(filledPositionsThisPeriod, totalWorkloadPositions),
    fullCloseRatePercent: fullClosureRatePercent,
    fullClosureRatePercent,
    backlogBurnRatePercent: pct(filledFromOld, carriedOverPositions),
    newDemandAbsorptionRatePercent: pct(filledFromNew, newRequestPositions),
    resignationPressureRatio: pct(resignationRequestPositions, totalWorkloadPositions),
    cancellationRatePercent: pct(cancelledPositionsThisPeriod, totalWorkloadPositions),
  };
}

export function buildRequestCohortSummary(
  records: RequestControlRecord[],
  from: string,
  to: string,
): DashboardRequestCohortSummary {
  const backlog = filterRecordsCarriedOver(records, from);
  const fresh = filterRecordsByEffectiveDate(records, from, to);
  const rows = [
    cohortRow('backlog_from_previous_period', 'ใบขอเก่าค้างมา', backlog),
    cohortRow('new_this_period', 'ใบขอใหม่เดือนนี้', fresh),
    cohortRow('total', 'รวมภาระงาน', [...backlog, ...fresh]),
  ];
  return { rows };
}

export function buildFulfillmentCohortSummary(
  records: RequestControlRecord[],
  from: string,
  to: string,
  throughputRecords: ThroughputRecord[] = [],
): DashboardFulfillmentCohortSummary {
  const filledInPeriod = (r: RequestControlRecord) => {
    if (r.filledPositions <= 0) return false;
    const d = r.closureDate || r.effectiveRequestDate;
    return d ? inYmdRange(d, from, to) : false;
  };

  const samePeriod = records.filter(
    (r) => inYmdRange(r.effectiveRequestDate, from, to) && filledInPeriod(r),
  );
  const backlogFilled = records.filter(
    (r) => r.effectiveRequestDate < from && filledInPeriod(r),
  );
  const totalFilled = records.filter(filledInPeriod);

  const rows = [
    {
      id: 'requested_this_period_filled_this_period' as const,
      label: 'ขอเดือนนี้ หาได้เดือนนี้',
      filledPositions: sumPositions(samePeriod, (r) => r.filledPositions),
      requestCount: samePeriod.length,
    },
    {
      id: 'requested_before_period_filled_this_period' as const,
      label: 'ขอเดือนเก่า หาได้เดือนนี้',
      filledPositions: sumPositions(backlogFilled, (r) => r.filledPositions),
      requestCount: backlogFilled.length,
    },
    {
      id: 'total_filled_this_period' as const,
      label: 'รวมหาได้แล้วเดือนนี้',
      filledPositions:
        throughputRecords
          .filter((r) => r.kind === 'filled' && r.closureDate && inYmdRange(r.closureDate, from, to))
          .reduce((s, r) => s + r.positionUnits, 0) ||
        sumPositions(totalFilled, (r) => r.filledPositions),
      requestCount: totalFilled.length,
    },
  ];
  return { rows };
}

export function buildFullyClosedCohortSummary(
  records: RequestControlRecord[],
  from: string,
  to: string,
): DashboardFullyClosedCohortSummary {
  const closedInPeriod = filterRecordsFullyClosedInPeriod(records, from, to);
  const samePeriod = closedInPeriod.filter((r) => inYmdRange(r.effectiveRequestDate, from, to));
  const backlogClosed = closedInPeriod.filter((r) => r.effectiveRequestDate < from);

  const rows = [
    {
      id: 'requested_this_period_fully_closed_this_period' as const,
      label: 'ขอเดือนนี้ ปิดครบเดือนนี้',
      requestCount: samePeriod.length,
      positionCount: sumPositions(samePeriod, (r) => r.requestPositions),
    },
    {
      id: 'requested_before_period_fully_closed_this_period' as const,
      label: 'ขอเดือนเก่า ปิดครบเดือนนี้',
      requestCount: backlogClosed.length,
      positionCount: sumPositions(backlogClosed, (r) => r.requestPositions),
    },
    {
      id: 'total_fully_closed_this_period' as const,
      label: 'รวมปิดครบใบขอเดือนนี้',
      requestCount: closedInPeriod.length,
      positionCount: sumPositions(closedInPeriod, (r) => r.requestPositions),
    },
  ];
  return { rows };
}

export function buildFulfillmentBreakdown(
  records: RequestControlRecord[],
  from: string,
  to: string,
  throughputRecords: ThroughputRecord[] = [],
): DashboardFulfillmentBreakdown {
  const fulfillment = buildFulfillmentCohortSummary(records, from, to, throughputRecords);
  const fullyClosed = buildFullyClosedCohortSummary(records, from, to);
  const filledSame = fulfillment.rows.find((r) => r.id === 'requested_this_period_filled_this_period');
  const filledBacklog = fulfillment.rows.find((r) => r.id === 'requested_before_period_filled_this_period');
  const closedSame = fullyClosed.rows.find((r) => r.id === 'requested_this_period_fully_closed_this_period');
  const closedBacklog = fullyClosed.rows.find((r) => r.id === 'requested_before_period_fully_closed_this_period');

  return {
    filledSamePeriod: filledSame?.filledPositions ?? 0,
    filledBacklog: filledBacklog?.filledPositions ?? 0,
    fullyClosedSamePeriod: closedSame?.requestCount ?? 0,
    fullyClosedBacklog: closedBacklog?.requestCount ?? 0,
  };
}

export function buildSlaSummary(records: RequestControlRecord[]): DashboardSlaSummary {
  const openish = records.filter((r) => !r.isFullyClosed);
  const closed = records.filter((r) => r.isFullyClosed);
  const onTrack = openish.filter((r) => r.slaStatus === 'on_track').length;
  const atRisk = openish.filter((r) => r.slaStatus === 'at_risk').length;
  const breached = openish.filter((r) => r.slaStatus === 'breached').length;
  const closedOnTime = closed.filter((r) => r.slaStatus === 'closed_on_time').length;
  const closedLate = closed.filter((r) => r.slaStatus === 'closed_late').length;
  const breachRatePercent = pct(breached, openish.length);

  return { onTrack, atRisk, breached, closedOnTime, closedLate, breachRatePercent };
}

const LIFECYCLE_KEYS: LifecycleKind[] = [
  'resignation',
  'replacement',
  'increase_headcount',
  'new_site',
];

export function buildLifecycleTrend(
  records: RequestControlRecord[],
  from: string,
  to: string,
  throughputRecords: ThroughputRecord[] = [],
): DashboardLifecycleTrendPoint[] {
  const monthMap = new Map<string, DashboardLifecycleTrendPoint>();

  const ensure = (month: string, label: string): DashboardLifecycleTrendPoint => {
    const key = `${month}-01`;
    const row =
      monthMap.get(month) ??
      ({
        date: key,
        label,
        resignation: 0,
        replacement: 0,
        increaseHeadcount: 0,
        newSite: 0,
        other: 0,
        requestedPositions: 0,
        filledPositions: 0,
        fullyClosedRequests: 0,
        cancelledPositions: 0,
        remainingPositions: 0,
      } satisfies DashboardLifecycleTrendPoint);
    monthMap.set(month, row);
    return row;
  };

  for (const r of records) {
    if (!inYmdRange(r.effectiveRequestDate, from, to)) continue;
    const month = r.effectiveRequestDate.slice(0, 7);
    const row = ensure(month, month);
    row.requestedPositions += r.requestPositions;
    row.remainingPositions += r.remainingPositions;
    switch (r.lifecycleKind) {
      case 'resignation':
        row.resignation += r.requestPositions;
        break;
      case 'replacement':
        row.replacement += r.requestPositions;
        break;
      case 'increase_headcount':
        row.increaseHeadcount += r.requestPositions;
        break;
      case 'new_site':
        row.newSite += r.requestPositions;
        break;
      default:
        row.other += r.requestPositions;
    }
  }

  for (const tr of throughputRecords) {
    if (!tr.closureDate || !inYmdRange(tr.closureDate, from, to)) continue;
    const month = tr.closureDate.slice(0, 7);
    const row = ensure(month, month);
    if (tr.kind === 'filled') row.filledPositions += tr.positionUnits;
    if (tr.kind === 'cancelled') row.cancelledPositions += tr.positionUnits;
  }

  for (const r of records) {
    if (!r.isFullyClosed || !r.closureDate || !inYmdRange(r.closureDate, from, to)) continue;
    const month = r.closureDate.slice(0, 7);
    const row = ensure(month, month);
    row.fullyClosedRequests += 1;
  }

  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row);
}

export function buildLifecycleInsights(
  trend: DashboardLifecycleTrendPoint[],
): string[] {
  if (trend.length === 0) return [];
  const insights: string[] = [];
  const totals = trend.reduce(
    (acc, p) => ({
      requested: acc.requested + p.requestedPositions,
      resignation: acc.resignation + p.resignation,
      filled: acc.filled + p.filledPositions,
      fullyClosed: acc.fullyClosed + p.fullyClosedRequests,
    }),
    { requested: 0, resignation: 0, filled: 0, fullyClosed: 0 },
  );

  if (totals.requested > 0) {
    insights.push(
      `% ลาออกต่อใบขอรวม ${Math.round((totals.resignation / totals.requested) * 1000) / 10}%`,
    );
  }

  const peak = [...trend].sort((a, b) => b.resignation - a.resignation)[0];
  if (peak && peak.resignation > 0) {
    insights.push(`เดือนที่ลาออกสูงสุด: ${peak.label} (${peak.resignation} ตำแหน่ง)`);
  }

  if (trend.length >= 2) {
    const prev = trend[trend.length - 2]!;
    const cur = trend[trend.length - 1]!;
    const delta = cur.resignation - prev.resignation;
    insights.push(
      delta >= 0
        ? `แนวโน้มลาออกเพิ่มจากเดือนก่อน (+${delta} ตำแหน่ง)`
        : `แนวโน้มลาออกลดจากเดือนก่อน (${delta} ตำแหน่ง)`,
    );
  }

  if (totals.filled > 0 && totals.fullyClosed < totals.filled) {
    insights.push('ปิดได้เยอะ แต่ปิดครบใบขอยังน้อย — มี Partial ค้าง');
  }

  if (totals.filled > totals.requested && totals.requested > 0) {
    insights.push('ปิดได้เยอะจาก backlog เดือนเก่า');
  }

  let streak = 0;
  for (let i = trend.length - 1; i >= 0; i--) {
    if (trend[i]!.resignation > 0) streak++;
    else break;
  }
  if (streak >= 2) insights.push(`ลาออกสูงต่อเนื่อง ${streak} เดือน`);

  return insights;
}

export function buildFlowView(summary: DashboardRequestControlSummary): DashboardFlowView {
  return {
    startingBacklogPositions: summary.startingBacklogPositions,
    newRequestPositions: summary.newRequestPositions,
    totalWorkloadPositions: summary.totalWorkloadPositions,
    filledPositions: summary.filledPositionsThisPeriod,
    cancelledPositions: summary.cancelledPositionsThisPeriod,
    endingBacklogPositions: summary.endingBacklogPositions,
    netBacklogChange: summary.netBacklogChange,
  };
}

function topSlaBreachHighlight(
  records: RequestControlRecord[],
  kind: DashboardSlaHighlight['kind'],
  pickName: (r: RequestControlRecord) => string | undefined,
): DashboardSlaHighlight | null {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.slaStatus !== 'breached' || r.remainingPositions <= 0) continue;
    const name = pickName(r)?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best: DashboardSlaHighlight | null = null;
  for (const [name, breachCount] of counts) {
    if (!best || breachCount > best.breachCount) {
      best = { kind, name, breachCount };
    }
  }
  return best;
}

export function buildExecutiveInsights(
  summary: DashboardRequestControlSummary,
  records: RequestControlRecord[],
  lifecycleInsights: string[] = [],
): DashboardExecutiveInsights {
  const sentences: string[] = [];

  if (summary.netBacklogChange > 0) {
    sentences.push(
      `Backlog เพิ่มขึ้น ${summary.netBacklogChange.toLocaleString('th-TH')} ตำแหน่ง เทียบต้นเดือน`,
    );
  } else if (summary.netBacklogChange < 0) {
    sentences.push(
      `Backlog ลดลง ${Math.abs(summary.netBacklogChange).toLocaleString('th-TH')} ตำแหน่ง เทียบต้นเดือน`,
    );
  } else if (summary.totalWorkloadPositions > 0) {
    sentences.push('Backlog คงที่เทียบต้นเดือน');
  }

  if (summary.totalWorkloadPositions > 0) {
    sentences.push(
      `ใบขอลาออกคิดเป็น ${summary.resignationPressureRatio}% ของความต้องการรวมเดือนนี้`,
    );
  }

  if (summary.filledPositionsThisPeriod > 0) {
    sentences.push(
      `ทีมหาได้แล้ว ${summary.filledPositionsThisPeriod.toLocaleString('th-TH')} ตำแหน่ง แต่ปิดครบใบขอได้เพียง ${summary.fullyClosedRequestsThisPeriod.toLocaleString('th-TH')} ใบ`,
    );
  }

  if (summary.filledPositionsFromOldRequests > 0 && summary.filledPositionsThisPeriod > 0) {
    const share = pct(summary.filledPositionsFromOldRequests, summary.filledPositionsThisPeriod);
    sentences.push(`การปิด backlog เก่าช่วย ${share}% ของการปิดได้เดือนนี้`);
  }

  if (summary.fillRatePercent > 40 && summary.fullClosureRatePercent < 30) {
    sentences.push('ปิดได้เยอะ แต่ปิดครบใบขอยังน้อย — มี Partial ค้าง');
  }

  if (summary.netBacklogChange > 0 && summary.filledPositionsThisPeriod > summary.newRequestPositions) {
    sentences.push('ปิดได้เยอะ แต่ backlog ยังเพิ่มจากความต้องการใหม่');
  }

  const unitHighlight = topSlaBreachHighlight(records, 'unit', (r) => r.unitName);
  const ownerHighlight = topSlaBreachHighlight(records, 'owner', (r) => r.ownerName);
  const slaHighlights: DashboardSlaHighlight[] = [];
  if (unitHighlight) {
    sentences.push(`หน่วยงานที่เกิน SLA มากที่สุด: ${unitHighlight.name} (${unitHighlight.breachCount} ใบ)`);
    slaHighlights.push(unitHighlight);
  }
  if (ownerHighlight && ownerHighlight.name !== unitHighlight?.name) {
    sentences.push(`ผู้รับผิดชอบที่เกิน SLA มากที่สุด: ${ownerHighlight.name} (${ownerHighlight.breachCount} ใบ)`);
    slaHighlights.push(ownerHighlight);
  }

  for (const line of lifecycleInsights) {
    if (!sentences.includes(line)) sentences.push(line);
  }

  return { sentences, slaHighlights };
}
