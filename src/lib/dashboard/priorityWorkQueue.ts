import type { DashboardWorkItem } from './types';
import type { RequestControlRecord } from '@/lib/requestControl';

/** คะแนนต่ำ = ความสำคัญสูงกว่า */
export function computePriorityTier(
  item: DashboardWorkItem,
  periodFrom: string | null,
  highlightedUnits: Set<string>,
): number {
  if (item.remainingPositions <= 0) return 900;

  let tier = 500;

  if (item.slaStatus === 'breached') tier = 0;
  else if (item.slaStatus === 'at_risk') tier = 100;
  else if (item.requestKind === 'ฉุกเฉิน/ย้อนหลัง' || item.requestKind.includes('ย้อนหลัง')) tier = 200;
  else if (item.requestKind === 'ฉุกเฉิน') tier = 250;
  else if (periodFrom && item.effectiveRequestDate < periodFrom) tier = 350;
  else tier = 400;

  if (highlightedUnits.has(item.unitName)) tier -= 15;

  return tier;
}

export function sortPriorityWorkQueue(
  items: DashboardWorkItem[],
  periodFrom: string | null,
  highlightedUnits: Set<string> = new Set(),
): DashboardWorkItem[] {
  return [...items]
    .filter((item) => item.remainingPositions > 0 && item.status !== 'completed' && item.status !== 'cancelled')
    .sort((a, b) => {
      const tierA = computePriorityTier(a, periodFrom, highlightedUnits);
      const tierB = computePriorityTier(b, periodFrom, highlightedUnits);
      if (tierA !== tierB) return tierA - tierB;
      if (b.remainingPositions !== a.remainingPositions) {
        return b.remainingPositions - a.remainingPositions;
      }
      if (a.effectiveRequestDate !== b.effectiveRequestDate) {
        return a.effectiveRequestDate.localeCompare(b.effectiveRequestDate);
      }
      return a.requestNo.localeCompare(b.requestNo, 'th');
    });
}

export function buildPriorityWorkQueue(
  workQueue: DashboardWorkItem[],
  records: RequestControlRecord[],
  periodFrom: string | null,
  limit = 12,
): DashboardWorkItem[] {
  const highlightedUnits = new Set<string>();
  const breachByUnit = new Map<string, number>();
  for (const r of records) {
    if (r.slaStatus !== 'breached' || r.remainingPositions <= 0 || !r.unitName) continue;
    breachByUnit.set(r.unitName, (breachByUnit.get(r.unitName) ?? 0) + 1);
  }
  let topUnit = '';
  let topCount = 0;
  for (const [unit, count] of breachByUnit) {
    if (count > topCount) {
      topCount = count;
      topUnit = unit;
    }
  }
  if (topUnit) highlightedUnits.add(topUnit);

  return sortPriorityWorkQueue(workQueue, periodFrom, highlightedUnits).slice(0, limit);
}
