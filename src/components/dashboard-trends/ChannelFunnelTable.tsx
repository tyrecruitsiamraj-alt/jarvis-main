import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { FUNNEL_COLUMNS, type ChannelFunnelRow } from '@/lib/channelFunnel';

/**
 * ═══ ตาราง "ช่องทาง → แจ้งเข้า" (เจ้าของ 19 ต.ค. 2569 · ทีม Online) ═══
 * แถว = ช่องทาง · คอลัมน์ = รายชื่อ → AI สนใจ → คนโทรต่อสำเร็จ → นัดได้ → มา → แจ้งเข้า
 * เลขทุกตัวมาจาก `buildChannelFunnel` · กดเลขเปิดรายชื่อ (แพตเทิร์นเดียวกับการ์ดรายชื่อที่กรอกมา)
 * 🔴 ไม่มีรายชื่อ = ตารางยังอยู่ (แถวรวม 0) · อ่าน ERP ไม่ได้ = แจ้งเข้า "—"
 */
const ChannelFunnelTable: React.FC<{
  rows: readonly ChannelFunnelRow[];
  total: ChannelFunnelRow;
  onOpen?: (title: string, ids: readonly string[]) => void;
}> = ({ rows, total, onOpen }) => {
  const line = (r: ChannelFunnelRow, strong: boolean) => (
    <TableRow key={r.channel} data-testid={`channel-funnel-${r.channel}`}>
      <TableCell className={cn('text-sm', strong && 'font-medium')}>{r.channel}</TableCell>
      {FUNNEL_COLUMNS.map((c) => {
        const cell = r[c.key];
        const canOpen = !!onOpen && cell.value !== null && cell.value > 0 && cell.ids.length > 0;
        const text = cell.value === null ? '—' : fmt(cell.value);
        return (
          <TableCell key={c.key} className={cn('text-right text-sm tabular-nums', strong && 'font-medium')}>
            {canOpen ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className={cn('-mr-2 px-2 text-sm tabular-nums', strong ? 'font-medium' : 'font-normal')}
                onClick={() => onOpen?.(`${r.channel} · ${c.label}`, cell.ids)}
              >
                {text}
              </Button>
            ) : (
              <span className={cn('inline-flex h-7 items-center', (cell.value === 0 || cell.value === null) && 'text-muted-foreground')}>{text}</span>
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
  return (
    <div className="overflow-x-auto" data-testid="channel-funnel">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">ช่องทาง</TableHead>
            {FUNNEL_COLUMNS.map((c) => (
              <TableHead key={c.key} className="whitespace-nowrap text-right text-xs">
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => line(r, false))}
          {line(total, true)}
        </TableBody>
      </Table>
    </div>
  );
};

export default ChannelFunnelTable;
