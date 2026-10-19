import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { ERP_SUB, UNKNOWN_CHANNEL, type ChannelPlacement } from '@/lib/channelPlacement';

/**
 * ═══ ตาราง "ช่องทางที่ได้คนลงงาน" (เจ้าของ 19 ต.ค. 2569 · Choice "ช่องทางหลัก กดดูย่อยได้") ═══
 * แถวหลัก = ช่องทาง · กดแถวเปิดกลุ่ม/เพจย่อย · ลงงานทุกแถวรวมกัน = แจ้งเข้าทั้งหมด (ไม่รู้ช่องทางอยู่แถวท้าย)
 */
const pct = (placed: number, registered: number) =>
  registered > 0 ? `${((placed / registered) * 100).toFixed(placed / registered < 0.1 ? 1 : 0)}%` : '—';

const ChannelPlacementTable: React.FC<{ data: ChannelPlacement }> = ({ data }) => {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-xs tabular-nums text-muted-foreground" data-testid="channel-placement-sum">
        แจ้งเข้า {fmt(data.informed)} คน · รู้ช่องทาง {fmt(data.matched)} คน
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">ช่องทาง</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs">ลงทะเบียน</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs">แจ้งเข้า</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs">% แจ้งเข้า</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => {
              const expandable = r.subs.length > 1 || (r.subs.length === 1 && r.subs[0].name !== r.channel);
              const isOpen = open === r.channel;
              const unknown = r.channel === UNKNOWN_CHANNEL;
              // % แจ้งเข้า = เฉพาะคนที่มาจากการลงทะเบียน (คนที่ได้ช่องทางจาก ERP ไม่ได้ลงทะเบียน · เคยขึ้น 167%)
              const fromReg = r.placed - (r.subs.find((s) => s.name === ERP_SUB)?.placed ?? 0);
              return (
                <React.Fragment key={r.channel}>
                  <TableRow data-testid={`channel-row-${r.channel}`}>
                    <TableCell className="text-sm">
                      {expandable ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="-ml-2.5 gap-1 px-2.5 text-sm font-normal"
                          aria-expanded={isOpen}
                          onClick={() => setOpen(isOpen ? null : r.channel)}
                        >
                          {isOpen ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                          {r.channel}
                        </Button>
                      ) : (
                        <span className={cn('pl-5', unknown && 'text-muted-foreground')}>{r.channel}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{unknown ? '—' : fmt(r.registered)}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">{fmt(r.placed)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {unknown ? '—' : pct(fromReg, r.registered)}
                    </TableCell>
                  </TableRow>
                  {isOpen
                    ? r.subs.map((s) => (
                        <TableRow key={`${r.channel}|${s.name}`} className="bg-muted/40">
                          <TableCell className="pl-8 text-xs text-muted-foreground">{s.name}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{fmt(s.registered)}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{fmt(s.placed)}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{pct(s.placed, s.registered)}</TableCell>
                        </TableRow>
                      ))
                    : null}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ChannelPlacementTable;
