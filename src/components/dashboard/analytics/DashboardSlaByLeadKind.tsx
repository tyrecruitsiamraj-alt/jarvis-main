/**
 * ตาราง SLA แยกชนิดใบขอ — "ปิดทัน / ปิดไม่ทัน อย่างละกี่ใบ" (เจ้าของสั่ง 22 ส.ค. 2569)
 *
 * ทำเป็น **ตาราง** ไม่ใช่แถวชิป เพราะคำถามคือการเทียบสองแกน (ชนิดใบขอ × สถานะ SLA)
 * ชิปเรียงกันตอบแกนเดียว คนต้องมานั่งจับคู่เอง (บทเรียน "เลขถูกแต่ตอบผิดคำถาม")
 *
 * 🔴 กติกาบนจอ:
 * 1. ทุกช่องที่มีของ **กดได้** → เปิดรายการใบขอของช่องนั้น (แพตเทิร์น DetailListDialog เดิม)
 * 2. **คอลัมน์ที่ว่างทั้งตารางถูกตัดออก** — ตารางที่มีแต่ 0 คือพื้นหลัง ไม่ใช่ข้อมูล
 * 3. ช่อง 0 ไม่ทาสี ไม่กดได้ — ของน้อยคือสัญญาณ ของเยอะคือพื้นหลัง
 * 4. เกณฑ์ต่างกันต่อชนิด (ย้อนหลัง 7 วัน · ฉุกเฉิน/ล่วงหน้า 15 วัน) เขียนบอกท้ายตาราง
 *    ไม่งั้นคนอ่านเทียบ % ข้ามแถวแล้วสรุปผิด
 */
import React from 'react';

import { DASH, TONE } from '@/lib/designTokens';
import {
  SLA_CELL_LABEL,
  SLA_CELL_TONE,
  type SlaByLeadKind,
  type SlaCellKey,
  type SlaLeadKindRow,
} from '@/lib/dashboard/slaByLeadKind';
import type { RequestLeadKind } from '@/lib/requestLeadKind';
import { cn } from '@/lib/utils';

type Props = {
  table: SlaByLeadKind;
  /** กดช่อง (ชนิด × ถัง) */
  onCellClick?: (kind: RequestLeadKind, cell: SlaCellKey, label: string) => void;
  /** กดชื่อแถว = ดูทั้งชนิดนั้น */
  onRowClick?: (kind: RequestLeadKind, label: string) => void;
  /**
   * ชุด "ใบที่ปิดแล้ว" ถูกดึงมาแล้วหรือยัง
   *
   * 🔴 สำคัญ: หน้านี้ดึงใบปิด**เฉพาะเมื่อเลือกช่วงเวลา** (โหมด "ทั้งหมด" ดึงแบบ on-demand)
   * ถ้ายังไม่ดึง คอลัมน์ ปิดทัน/ปิดไม่ทัน จะว่างเพราะ **ไม่มีข้อมูล** ไม่ใช่เพราะ "ไม่มีใบปิด"
   * — ต้องเขียนบอกตรง ๆ ไม่งั้นหัวตารางสัญญาว่า "ปิดทัน/ไม่ทัน" แต่เนื้อไม่มีให้ดู
   * (anti-pattern ข้อ 16: ป้ายขัดกับเนื้อ)
   */
  closedLoaded?: boolean;
  /** ปุ่มดึงชุดใบปิดของช่วงที่กำลังดู (โหมด "ทั้งหมด") — ไม่ส่ง = ไม่มีปุ่ม */
  onLoadClosed?: () => void;
  loadingClosed?: boolean;
};

const num = (n: number) => n.toLocaleString('th-TH');

const DashboardSlaByLeadKind: React.FC<Props> = ({
  table,
  onCellClick,
  onRowClick,
  closedLoaded = true,
  onLoadClosed,
  loadingClosed = false,
}) => {
  const cells = table.visibleCells;

  if (table.totalRow.total === 0) {
    return (
      <div className={cn(DASH.card, 'px-4 py-3')}>
        <p className={DASH.label}>ปิดทัน / ไม่ทัน ตามชนิดใบขอ</p>
        <p className={cn('mt-1', DASH.sub)}>ไม่มีใบขอในช่วงที่กรองอยู่</p>
      </div>
    );
  }

  const renderRow = (row: SlaLeadKindRow, isTotal: boolean) => (
    <tr key={row.label} className={cn('border-t', DASH.divider, isTotal && 'font-medium')}>
      <th scope="row" className="py-2 pr-3 text-left align-middle">
        {isTotal || !onRowClick ? (
          <span className={cn('text-xs', DASH.cellStrong)}>{row.label}</span>
        ) : (
          <button
            type="button"
            onClick={() => onRowClick(row.kind, row.label)}
            className="inline-flex items-center gap-1.5 text-xs hover:underline"
            title={`ดูใบขอชนิด "${row.label}" ทั้งหมด ${num(row.total)} ใบ`}
          >
            <span className={cn('inline-block h-2 w-2 rounded-full', TONE[row.tone].dot)} aria-hidden />
            <span className={DASH.cellStrong}>{row.label}</span>
          </button>
        )}
      </th>

      {cells.map((c) => {
        const v = row.cells[c];
        const clickable = v > 0 && !isTotal && Boolean(onCellClick);
        const label = `${row.label} · ${SLA_CELL_LABEL[c]}`;
        return (
          <td key={c} className="py-1.5 text-center">
            {v === 0 ? (
              // ช่องว่างไม่ทาสี — ไม่งั้น 0 หลายสิบช่องกลายเป็นลายพราง
              <span className={cn('text-xs tabular-nums', DASH.cellMuted)}>—</span>
            ) : clickable ? (
              <button
                type="button"
                onClick={() => onCellClick?.(row.kind, c, label)}
                title={`ดูรายการ: ${label} (${num(v)} ใบ)`}
                className={cn(
                  'min-w-[3rem] rounded-lg px-2 py-1 text-sm font-semibold tabular-nums transition-colors',
                  TONE[SLA_CELL_TONE[c]].tile,
                  TONE[SLA_CELL_TONE[c]].num,
                )}
              >
                {num(v)}
              </button>
            ) : (
              <span className={cn('text-sm font-semibold tabular-nums', TONE[SLA_CELL_TONE[c]].value)}>
                {num(v)}
              </span>
            )}
          </td>
        );
      })}

      <td className="py-1.5 pl-3 text-right">
        <span className={cn('text-xs tabular-nums', DASH.cell)}>{num(row.total)}</span>
      </td>
      <td className="py-1.5 pl-3 text-right">
        {row.onTimeRatePercent === null ? (
          <span className={cn('text-xs', DASH.cellMuted)} title="ยังไม่มีใบที่ปิดในกลุ่มนี้">
            —
          </span>
        ) : (
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              row.onTimeRatePercent >= 80
                ? TONE.success.value
                : row.onTimeRatePercent >= 50
                  ? TONE.warn.value
                  : TONE.danger.value,
            )}
            title={`ปิดทัน ${num(row.cells.closed_on_time)} จากที่ปิดแล้ว ${num(row.closed)} ใบ`}
          >
            {row.onTimeRatePercent}%
          </span>
        )}
      </td>
    </tr>
  );

  return (
    <div className={cn(DASH.card, 'px-4 py-3')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={DASH.label}>ปิดทัน / ไม่ทัน ตามชนิดใบขอ</p>
        <p className={DASH.sub}>นับเป็น “ใบขอ” · เปลี่ยนตามตัวกรองด้านบน</p>
      </div>

      {/* ตารางกว้างเกินจอเล็กได้ → เลื่อนในกล่องตัวเอง ไม่ดันหน้าให้เลื่อนทั้งหน้า */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[38rem] border-collapse text-left">
          <thead>
            <tr className={cn('text-[11px]', DASH.tableHead)}>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                ชนิดใบขอ
              </th>
              {cells.map((c) => (
                <th key={c} scope="col" className="py-1.5 text-center font-medium">
                  {SLA_CELL_LABEL[c]}
                </th>
              ))}
              <th scope="col" className="py-1.5 pl-3 text-right font-medium">
                รวม
              </th>
              <th scope="col" className="py-1.5 pl-3 text-right font-medium">
                ปิดทัน %
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => renderRow(r, false))}
            {renderRow(table.totalRow, true)}
          </tbody>
        </table>
      </div>

      {!closedLoaded ? (
        <p className={cn('mt-2', DASH.sub)}>
          ⚠️ ตารางนี้ยังนับแต่ <b>ใบที่ยังไม่ปิด</b> — ชุดใบที่ปิดแล้วของช่วงนี้ยังไม่ได้ดึง
          จึงยังบอก “ปิดทัน / ปิดไม่ทัน” ไม่ได้
          {onLoadClosed ? (
            <>
              {' '}
              <button
                type="button"
                onClick={onLoadClosed}
                disabled={loadingClosed}
                className="font-medium underline underline-offset-2 disabled:opacity-50"
              >
                {loadingClosed ? 'กำลังดึงใบที่ปิดแล้ว…' : 'ดึงชุดใบที่ปิดแล้ว'}
              </button>
            </>
          ) : (
            ' — เลือกเดือน/ช่วงวันที่ด้านบนเพื่อดู'
          )}
        </p>
      ) : null}

      <p className={cn('mt-2', DASH.sub)}>
        เกณฑ์ SLA ต่างกันตามชนิดใบขอ — ฉุกเฉิน/ย้อนหลัง 7 วันจากวันที่ยื่น · ฉุกเฉิน &amp; ล่วงหน้า
        15 วันจากวันที่ต้องการ · “ปิดทัน %” คิดจากใบที่ปิดแล้วเท่านั้น
      </p>
    </div>
  );
};

export default DashboardSlaByLeadKind;
