import type { DashboardWorkItem } from './types';

function csvCell(value: string | number | boolean | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportWorkQueueCsv(items: DashboardWorkItem[], filename = 'work-queue.csv'): void {
  const headers = [
    'requestNo',
    'unitName',
    'destination',
    'ownerName',
    'screenerName',
    'status',
    'controlStatus',
    'slaStatus',
    'requestPositions',
    'filledPositions',
    'cancelledPositions',
    'remainingPositions',
    'effectiveRequestDate',
    'slaDueDate',
    'daysOverdue',
    'lifecycleKind',
    'requestKind',
    'requestAction',
    'requestDate',
    'requiredDate',
    'updatedAt',
    'nextAction',
    'sendReplacement',
    'resignedName',
  ];

  const rows = items.map((item) =>
    [
      item.requestNo,
      item.unitName,
      item.destination,
      item.ownerName,
      item.screenerName,
      item.status,
      item.controlStatus,
      item.slaStatus,
      item.requestPositions,
      item.filledPositions,
      item.cancelledPositions,
      item.remainingPositions,
      item.effectiveRequestDate,
      item.slaDueDate,
      item.daysOverdue,
      item.lifecycleKind,
      item.requestKind,
      item.requestAction,
      item.requestDate,
      item.requiredDate,
      item.updatedAt,
      item.nextAction,
      item.sendReplacement == null ? '' : item.sendReplacement ? 'yes' : 'no',
      item.resignedName,
    ]
      .map(csvCell)
      .join(','),
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
