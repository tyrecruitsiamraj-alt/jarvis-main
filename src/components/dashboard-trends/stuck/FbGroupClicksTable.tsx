/**
 * กลุ่ม Facebook: คนคลิกลิงก์แล้วกรอกเท่าไหร่ — ยอดทั้งหมดตั้งแต่สร้างลิงก์ (เจ้าของ 10 พ.ย. 2569 Choice "แบบ 1 ยอดทั้งหมด")
 * ตัวคำนวณ `buildFbGroupClickRows` · กดเลขกรอก = รายชื่อ (ป๊อปเดียวกับตารางช่องทาง) · คลิกเป็นยอดรวม ไม่มีรายชื่อ
 * ว่างแล้วตารางไม่หาย (แถว "ยังไม่มี…")
 * กดสมัคร · สมัครซ้ำโดนกัน = นับตั้งแต่ 10 พ.ย. 2569 (เจ้าของ Choice "เพิ่มช่องในตาราง") — หัวการ์ดบอกวันเริ่มนับ
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import type { FbGroupClickRow } from '@/lib/fbGroupClicks';

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
            <TableHead className="text-right">กดสมัคร</TableHead>
            <TableHead className="text-right">กรอก</TableHead>
            <TableHead className="text-right">สมัครซ้ำโดนกัน</TableHead>
            <TableHead className="text-right">กรอกต่อคลิก</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                ยังไม่มีลิงก์กลุ่ม Facebook
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.group}>
                <TableCell className="text-sm">{r.group}</TableCell>
                <TableCell className={cn('text-right text-sm tabular-nums', !r.clicks && 'text-muted-foreground')}>{fmt(r.clicks)}</TableCell>
                <TableCell className={cn('text-right text-sm tabular-nums', !r.applyPresses && 'text-muted-foreground')}>{fmt(r.applyPresses)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {r.appIds.length > 0 ? (
                    <Button type="button" variant="ghost" size="xs" className="-mr-2 px-2 text-sm font-normal tabular-nums" onClick={() => onOpen(`${r.group} · กรอก`, r.appIds)}>
                      {fmt(r.appIds.length)}
                    </Button>
                  ) : (
                    <span className="inline-flex h-7 items-center text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className={cn('text-right text-sm tabular-nums', !r.repeatBlocked && 'text-muted-foreground')}>{fmt(r.repeatBlocked)}</TableCell>
                <TableCell className={cn('text-right text-sm tabular-nums', r.ratePct === null && 'text-muted-foreground')}>{r.ratePct === null ? '—' : `${r.ratePct}%`}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
