import type { DashboardWorkItem } from './types';
import { formatYmdTh } from '@/lib/dateTh';

/** วันที่ในไฟล์ = "12 ต.ค. 2569" รูปเดียวกับบนจอ (เจ้าของ 12 ต.ค. 2569) · ว่าง = ช่องว่าง */
const day = (ymd: string | null | undefined): string => (ymd ? formatYmdTh(ymd) : '');

function csvCell(value: string | number | boolean | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** ตัวไฟล์ CSV (มี BOM) — แยกจากการดาวน์โหลดให้เทสต์ได้ */
export function workQueueCsvText(items: DashboardWorkItem[]): string {
  const headers = [
    'requestNo',
    'unitName',
    'destination',
    'ownerName',
    'screenerName',
    'status',
    'controlStatus',
    // 🔴 เดิมไม่มีหัวนี้ ทั้งที่แถวส่ง slaStatus ⇒ คอลัมน์ตั้งแต่ช่องนี้เลื่อนไปหนึ่งช่องทั้งไฟล์ (หัว 25 · ค่า 26) — แก้ 12 ต.ค. 2569
    'slaStatus',
    'fullClosureSlaStatus',
    'dataQuality',
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
      item.fullClosureSlaStatus ?? item.slaStatus,
      item.dataQuality ?? '',
      item.requestPositions,
      item.filledPositions,
      item.cancelledPositions,
      item.remainingPositions,
      day(item.effectiveRequestDate),
      day(item.slaDueDate),
      item.daysOverdue,
      item.lifecycleKind,
      item.requestKind,
      item.requestAction,
      day(item.requestDate),
      day(item.requiredDate),
      day(item.updatedAt),
      item.nextAction,
      item.sendReplacement == null ? '' : item.sendReplacement ? 'yes' : 'no',
      item.resignedName,
    ]
      .map(csvCell)
      .join(','),
  );

  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

export function exportWorkQueueCsv(items: DashboardWorkItem[], filename = 'work-queue.csv'): void {
  const blob = new Blob([workQueueCsvText(items)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
