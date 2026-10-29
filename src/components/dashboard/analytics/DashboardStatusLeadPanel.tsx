import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { REQUEST_LEAD_KIND_HINT, REQUEST_LEAD_KIND_LABEL, REQUEST_LEAD_KIND_TONE, type RequestLeadKind } from '@/lib/requestLeadKind';
import { NO_KEYER, STATUS_LEAD_ORDER, buildKeyerRows, type StatusLeadPanel } from '@/lib/dashboard/statusLeadPanel';
import type { JobRequest } from '@/types';

/**
 * การ์ด "ใบขอเร่งด่วนแค่ไหน" ตอนกดกล่องบน Dashboard (เจ้าของ 29 ต.ค. 2569 แบบร่างที่เคาะ "ทำเลย" · ร่าง 2 "อันนั้นแก้เลย")
 * แถบ 3 ชนิด (กดกรองรายการได้ · ไม่มี % ตามเจ้าของ "เอา % ออก") + ตาราง "ใครคีย์" (กดชื่อกรองรายการ)
 * + รายการทีละใบ เลื่อนดูในกล่อง · ตัวคิด `statusLeadPanel.ts`
 */
const NUM = new Intl.NumberFormat('th-TH');
/** วาดรายการทีละก้อน — กล่อง "เข้ามา" ทั้งหมดมีหลายพันใบ วาดทีเดียวแล้วจอหน่วง */
const PAGE = 200;

export default function DashboardStatusLeadPanel({
  label,
  panel,
  amountLabel = 'ต้องหา',
  note,
  onClear,
  onOpenJob,
}: {
  /** ชื่อกล่องที่กด */
  label: string;
  panel: StatusLeadPanel;
  /** หัวคอลัมน์จำนวน (ขอ / หาได้ / ยกเลิก / ต้องหา) */
  amountLabel?: string;
  /** อัตราที่นับในกล่องแต่ลิสต์เป็นรายใบไม่ได้ */
  note?: string | null;
  onClear: () => void;
  onOpenJob?: (job: JobRequest) => void;
}) {
  const [kind, setKind] = useState<RequestLeadKind | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const keyers = useMemo(() => buildKeyerRows(panel.rows), [panel.rows]);
  const rows = panel.rows.filter((r) => (!kind || r.kind === kind) && (!person || (r.submittedBy || NO_KEYER) === person));
  const visible = rows.slice(0, shown);
  const max = Math.max(1, ...STATUS_LEAD_ORDER.map((k) => panel.kinds[k].positions));

  return (
    <div className={cn('space-y-3 rounded-2xl border p-4', DASH.card)} data-testid="dashboard-status-lead">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <p className={cn('text-sm font-medium', DASH.cellStrong)}>ใบขอเร่งด่วนแค่ไหน</p>
          <p className={cn('text-[11px]', DASH.muted)}>{label}</p>
          {note ? <p className={cn('text-[11px]', DASH.muted)}>{note}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <p className={cn('text-[11px]', DASH.muted)}>
            ทั้งหมด <span className={cn('text-base font-medium tabular-nums', DASH.cellStrong)}>{NUM.format(panel.total.positions)}</span> อัตรา ·{' '}
            <span className="font-medium tabular-nums">{NUM.format(panel.total.requests)}</span> ใบขอ
          </p>
          <Button type="button" variant="outline" size="xs" onClick={onClear} data-testid="dashboard-status-lead-clear">
            <X aria-hidden />
            ดูแบบเดิม
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {STATUS_LEAD_ORDER.map((k) => {
          const tone = TONE[REQUEST_LEAD_KIND_TONE[k]];
          const v = panel.kinds[k];
          return (
            <li key={k}>
              <Button
                type="button"
                variant="ghost"
                title={REQUEST_LEAD_KIND_HINT[k]}
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(kind === k ? null : k);
                  setShown(PAGE);
                }}
                className={cn('h-auto w-full flex-col items-stretch gap-1.5 whitespace-normal rounded-xl border px-3 py-2 text-left font-normal', tone.soft, tone.softHover, kind === k && 'ring-2 ring-ring')}
                data-testid={`dashboard-status-lead-${k}`}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
                    <span className={cn('text-xs font-medium', tone.value)}>{REQUEST_LEAD_KIND_LABEL[k]}</span>
                  </span>
                  <span className={cn('text-[11px]', DASH.muted)}>
                    <span className={cn('text-base font-medium tabular-nums', tone.num)}>{NUM.format(v.positions)}</span> อัตรา · {NUM.format(v.requests)} ใบ
                  </span>
                </span>
                <span className="block h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className={cn('block h-full rounded-full', tone.dot)} style={{ width: `${(v.positions / max) * 100}%` }} />
                </span>
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <p className="text-sm font-medium">ใครคีย์ใบขอพวกนี้</p>
        <div className="max-h-72 overflow-auto rounded-xl border border-border" data-testid="dashboard-status-lead-keyers">
          <Table className="min-w-[36rem]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className={DASH.tableHead}>
                <TableHead className="text-xs">คนกรอก</TableHead>
                <TableHead className="text-right text-xs">รวม (ใบ)</TableHead>
                {STATUS_LEAD_ORDER.map((k) => (
                  <TableHead key={k} className={cn('text-right text-xs', TONE[REQUEST_LEAD_KIND_TONE[k]].value)}>
                    {REQUEST_LEAD_KIND_LABEL[k]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {keyers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className={cn('py-4 text-center text-sm', DASH.muted)}>
                    ไม่มีใบขอ
                  </TableCell>
                </TableRow>
              ) : null}
              {keyers.map((k) => (
                <TableRow key={k.name} className={cn(person === k.name && 'bg-muted')} data-testid="dashboard-status-lead-keyer">
                  <TableCell className="text-sm">
                    <Button type="button" variant="link" size="xs" aria-pressed={person === k.name} className="h-auto p-0 text-left" onClick={() => {
                        setPerson(person === k.name ? null : k.name);
                        setShown(PAGE);
                      }}>
                      {k.name}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">{NUM.format(k.total)}</TableCell>
                  {STATUS_LEAD_ORDER.map((kk) => (
                    <TableCell key={kk} className="text-right text-sm tabular-nums">
                      {NUM.format(k[kk])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {[kind ? REQUEST_LEAD_KIND_LABEL[kind] : 'ทุกความเร่ง', person].filter(Boolean).join(' · ')} · {NUM.format(rows.length)} ใบ
        </p>
        {kind || person ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => {
              setKind(null);
              setPerson(null);
              setShown(PAGE);
            }}
          >
            ล้างตัวกรอง
          </Button>
        ) : null}
      </div>
      {/* เลื่อนดูในกล่อง (เจ้าของ "ทำเป็น pagination ไม่ก็ให้เลื่อนลงได้ แบบนี้ยาวไป") */}
      <div className="max-h-96 overflow-auto rounded-xl border border-border" data-testid="dashboard-status-lead-list">
        <Table className="min-w-[56rem]">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className={DASH.tableHead}>
              <TableHead className="text-xs">ใบขอ</TableHead>
              <TableHead className="text-xs">วันที่กรอก</TableHead>
              <TableHead className="text-xs">คนกรอก</TableHead>
              <TableHead className="text-xs">หน่วยงาน</TableHead>
              <TableHead className="text-xs">สถานะ</TableHead>
              <TableHead className="text-xs">เร่งด่วน</TableHead>
              <TableHead className="text-xs">ต้องการคน</TableHead>
              <TableHead className="text-right text-xs">{amountLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className={cn('py-4 text-center text-sm', DASH.muted)}>
                  ไม่มีใบขอ
                </TableCell>
              </TableRow>
            ) : null}
            {visible.map((r) => {
              const tone = TONE[REQUEST_LEAD_KIND_TONE[r.kind]];
              return (
                // คีย์ = id ของใบ (ใบขอล่วงหน้าเลขซ้ำใบจริงได้ — คีย์ซ้ำแล้วแถวค้างตอนสลับกล่อง)
                <TableRow key={r.key} data-testid="dashboard-status-lead-row">
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {onOpenJob && r.job ? (
                      <Button type="button" variant="link" size="xs" className="h-auto p-0 tabular-nums" onClick={() => r.job && onOpenJob(r.job)}>
                        {r.requestNo}
                      </Button>
                    ) : (
                      r.requestNo
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">{formatYmdDmyBe(r.submitted)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{r.submittedBy ?? '—'}</TableCell>
                  <TableCell className="min-w-48 text-sm">{r.unit}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{r.status}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    <span className={cn('inline-flex items-center gap-1.5', tone.value)}>
                      <span className={cn('h-2 w-2 rounded-full', tone.dot)} aria-hidden />
                      {REQUEST_LEAD_KIND_LABEL[r.kind]}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">{formatYmdDmyBe(r.required)}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">{NUM.format(r.amount)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {rows.length > visible.length ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)} data-testid="dashboard-status-lead-more">
            แสดงเพิ่ม · เหลืออีก {NUM.format(rows.length - visible.length)} ใบ
          </Button>
        </div>
      ) : null}
    </div>
  );
}
