import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { FUNNEL_COLUMNS, type ChannelFunnelRow, type FunnelNode } from '@/lib/channelFunnel';

/**
 * ═══ ตาราง "ช่องทาง → แจ้งเข้า" (เจ้าของ 19 ต.ค. 2569 · ทีม Online) ═══
 * แถว = ช่องทาง · คอลัมน์ = รายชื่อ → AI สนใจ → คนโทรต่อสำเร็จ → นัดได้ → มา → แจ้งเข้า
 * เลขทุกตัวมาจาก `buildChannelFunnelTree` · กดเลขเปิดรายชื่อ (แพตเทิร์นเดียวกับการ์ดรายชื่อที่กรอกมา)
 * 25 ต.ค. 2569: กดลงทีละชั้น 4 กลุ่ม → ช่องทาง → ชื่อกลุ่ม/เพจ · ทุกช่องมี % เทียบรายชื่อของแถว
 *   (เจ้าของ "ช่องทางที่น้อยอาจติดต่อสำเร็จมากกว่า") · ช่องรายชื่อบอก % ของยอดชั้นนั้น
 * 🔴 ไม่มีรายชื่อ = ตารางยังอยู่ (แถวรวม 0) · อ่าน ERP ไม่ได้ = แจ้งเข้า "—"
 */
const pct = (n: number | null, of: number | null) => (n === null || !of ? null : Math.round((n / of) * 100));

const ChannelFunnelTable: React.FC<{
  groups: readonly FunnelNode[];
  total: ChannelFunnelRow;
  onOpen?: (title: string, ids: readonly string[]) => void;
}> = ({ groups, total, onOpen }) => {
  /** ชั้นที่กดลงไป (ว่าง = 4 กลุ่ม) — เก็บเป็นคีย์ เลขเปลี่ยนตามช่วงแล้วชั้นเดิมยังอยู่ */
  const [path, setPath] = useState<string[]>([]);
  const trail: FunnelNode[] = [];
  let level: readonly FunnelNode[] = groups;
  for (const k of path) {
    const n = level.find((x) => x.key === k);
    if (!n?.children) break;
    trail.push(n);
    level = n.children;
  }
  const parent: ChannelFunnelRow = trail[trail.length - 1] ?? total;
  const levelTotal = parent.names.value;

  const line = (r: ChannelFunnelRow, strong: boolean, node?: FunnelNode) => (
    <TableRow key={node?.key ?? r.channel} data-testid={`channel-funnel-${r.channel}`}>
      <TableCell className={cn('text-sm', strong && 'font-medium')}>
        {node?.children ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto gap-1 whitespace-normal p-0 text-left text-sm"
            onClick={() => setPath([...trail.map((t) => t.key), node.key])}
            data-testid="channel-funnel-drill"
          >
            {r.channel}
            <ChevronRight aria-hidden />
          </Button>
        ) : (
          r.channel
        )}
      </TableCell>
      {FUNNEL_COLUMNS.map((c) => {
        const cell = r[c.key];
        const canOpen = !!onOpen && cell.value !== null && cell.value > 0 && cell.ids.length > 0;
        const text = cell.value === null ? '—' : fmt(cell.value);
        // รายชื่อ = % ของยอดชั้นนี้ · ขั้นอื่น = % ของรายชื่อแถวนี้
        const p = c.key === 'names' ? (strong ? null : pct(cell.value, levelTotal)) : pct(cell.value, r.names.value);
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
            <span className="block text-xs font-normal text-muted-foreground">{p === null ? '' : `${p}%`}</span>
          </TableCell>
        );
      })}
    </TableRow>
  );
  return (
    <div className="space-y-2">
      <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="ชั้นช่องทาง" data-testid="channel-funnel-path">
        <Button type="button" variant="link" size="sm" className="h-auto p-0" disabled={trail.length === 0} onClick={() => setPath([])}>
          ทุกช่องทาง
        </Button>
        {trail.map((t, i) => (
          <React.Fragment key={t.key}>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={i === trail.length - 1}
              onClick={() => setPath(trail.slice(0, i + 1).map((x) => x.key))}
            >
              {t.channel}
            </Button>
          </React.Fragment>
        ))}
      </nav>
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
            {level.map((n) => line(n, false, n))}
            {line({ ...parent, channel: trail.length === 0 ? 'รวม' : `รวม ${parent.channel}` }, true)}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ChannelFunnelTable;
