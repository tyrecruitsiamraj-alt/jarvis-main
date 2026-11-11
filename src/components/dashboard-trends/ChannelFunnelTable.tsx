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
 * 🔴 11 พ.ย. 2569 กางในที่ (เจ้าของ "กด facebook ก็ขยายช่องทางรองออกมา แล้วพวก tiktok ก็ยังอยู่ … ไม่ใช่กดแล้วเด้ง
 *   … กด facebook Group ก็เรียงกลุ่มลงมาเลย แล้วบอกว่ากลุ่มไหนกรอกเยอะ ไปน้อยสุด") — เดิมกดแล้วตารางเปลี่ยนเป็นชั้นลูก
 *   ⇒ ตอนนี้กดแถว = ชั้นลูกกางใต้แถวนั้น แถวอื่นอยู่ที่เดิม · กดซ้ำ = หุบ · ชั้นลูกเรียงรายชื่อ (กรอก) มากไปน้อย
 */
const pct = (n: number | null, of: number | null) => (n === null || !of ? null : Math.round((n / of) * 100));

const INDENT = ['', 'pl-6', 'pl-10', 'pl-14'] as const;

const ChannelFunnelTable: React.FC<{
  groups: readonly FunnelNode[];
  total: ChannelFunnelRow;
  onOpen?: (title: string, ids: readonly string[]) => void;
  /** หัวคอลัมน์แรก + ชั้นบนสุด — ตาราง "ใครหารายชื่อเข้ามา" ใช้ "คน" (9 พ.ย. 2569) */
  firstLabel?: string;
}> = ({ groups, total, onOpen, firstLabel = 'ช่องทาง' }) => {
  /** แถวที่กางอยู่ (คีย์เต็มตามชั้น) — เก็บเป็นคีย์ เลขเปลี่ยนตามช่วงแล้วแถวที่กางไว้ยังกางอยู่ */
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const line = (r: ChannelFunnelRow, opts: { strong?: boolean; node?: FunnelNode; id?: string; depth?: number; parentNames: number | null }) => {
    const { strong = false, node, id, depth = 0, parentNames } = opts;
    const expanded = id ? open.has(id) : false;
    return (
      <TableRow key={id ?? r.channel} data-testid={`channel-funnel-${r.channel}`}>
        <TableCell className={cn('text-sm', strong && 'font-medium', INDENT[Math.min(depth, INDENT.length - 1)])}>
          {node?.children && id ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto gap-1 whitespace-normal p-0 text-left text-sm"
              onClick={() => toggle(id)}
              aria-expanded={expanded}
              data-testid="channel-funnel-drill"
            >
              <ChevronRight className={cn('transition-transform', expanded && 'rotate-90')} aria-hidden />
              {r.channel}
            </Button>
          ) : (
            r.channel
          )}
        </TableCell>
        {FUNNEL_COLUMNS.map((c) => {
          const cell = r[c.key];
          const canOpen = !!onOpen && cell.value !== null && cell.value > 0 && cell.ids.length > 0;
          const text = cell.value === null ? '—' : fmt(cell.value);
          // รายชื่อ = % ของชั้นแม่ · ขั้นอื่น = % ของรายชื่อแถวนี้
          const p = c.key === 'names' ? (strong ? null : pct(cell.value, parentNames)) : pct(cell.value, r.names.value);
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
  };

  /** แถวของชั้นหนึ่ง + ชั้นลูกที่กางอยู่ใต้แถวนั้น · ชั้นลูกเรียงรายชื่อมากไปน้อย */
  const rows = (nodes: readonly FunnelNode[], depth: number, prefix: string, parentNames: number | null): React.ReactNode[] =>
    nodes.flatMap((n) => {
      const id = `${prefix}/${n.key}`;
      const out: React.ReactNode[] = [line(n, { node: n, id, depth, parentNames })];
      if (n.children && open.has(id)) {
        const kids = [...n.children].sort((a, b) => (b.names.value ?? 0) - (a.names.value ?? 0));
        out.push(...rows(kids, depth + 1, id, n.names.value));
      }
      return out;
    });

  return (
    <div className="overflow-x-auto" data-testid="channel-funnel">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">{firstLabel}</TableHead>
            {FUNNEL_COLUMNS.map((c) => (
              <TableHead key={c.key} className="whitespace-nowrap text-right text-xs">
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows(groups, 0, '', total.names.value)}
          {line({ ...total, channel: 'รวม' }, { strong: true, parentNames: null })}
        </TableBody>
      </Table>
    </div>
  );
};

export default ChannelFunnelTable;
