/**
 * กลุ่ม Facebook: คลิก → กรอก → AI สนใจ → นัดได้ → มา (เจ้าของ 10 พ.ย. 2569 · Choice "ตอนเลือกกลุ่ม Autopost + ตารางในภาพรวม")
 * ตัวคำนวณ `buildFbGroupClickRows` · กดเลขคน = รายชื่อ (ป๊อปเดียวกับตารางช่องทาง) · คลิกเป็นยอดรวม ไม่มีรายชื่อ
 * ว่างแล้วตารางไม่หาย (แถว "ยังไม่มี…")
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import type { FunnelCellKey } from '@/lib/channelFunnel';
import type { FbGroupClickRow } from '@/lib/fbGroupClicks';

const STEPS: ReadonlyArray<{ key: FunnelCellKey; label: string }> = [
  { key: 'names', label: 'กรอก' },
  { key: 'aiYes', label: 'AI สนใจ' },
  { key: 'booked', label: 'นัดได้' },
  { key: 'showed', label: 'มา' },
];

export default function FbGroupClicksTable({
  rows,
  onOpen,
}: {
  rows: readonly FbGroupClickRow[];
  onOpen: (title: string, ids: readonly string[]) => void;
}) {
  return (
    <div className="max-w-full overflow-x-auto">
      <Table data-testid="fb-group-clicks">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-48">กลุ่ม</TableHead>
            <TableHead className="text-right">คลิก</TableHead>
            {STEPS.map((s) => (
              <TableHead key={s.key} className="text-right">
                {s.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={STEPS.length + 2} className="text-center text-sm text-muted-foreground">
                ยังไม่มีคนคลิกหรือกรอกจากลิงก์กลุ่ม Facebook ในช่วงนี้
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.channel}>
                <TableCell className="text-sm">{r.channel}</TableCell>
                <TableCell className={cn('text-right text-sm tabular-nums', !r.clicks && 'text-muted-foreground')}>{r.clicks === null ? '—' : fmt(r.clicks)}</TableCell>
                {STEPS.map((s) => {
                  const cell = r[s.key];
                  const canOpen = cell.value !== null && cell.value > 0 && cell.ids.length > 0;
                  const text = cell.value === null ? '—' : fmt(cell.value);
                  return (
                    <TableCell key={s.key} className="text-right text-sm tabular-nums">
                      {canOpen ? (
                        <Button type="button" variant="ghost" size="xs" className="-mr-2 px-2 text-sm font-normal tabular-nums" onClick={() => onOpen(`${r.channel} · ${s.label}`, cell.ids)}>
                          {text}
                        </Button>
                      ) : (
                        <span className={cn('inline-flex h-7 items-center', !cell.value && 'text-muted-foreground')}>{text}</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
