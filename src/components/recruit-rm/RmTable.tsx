import React from 'react';
import { BookmarkPlus, Phone, Eye, ClipboardCheck, UserMinus, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { formatYmdDmyBe } from '@/lib/dateTh';
import {
  APPLICATION_STATUS_CLASS,
  APPLICATION_STATUS_LABEL,
  REFERRAL_SOURCE_LABEL,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import {
  RM_ROW_ACTIONS,
  RM_ROW_ACTION_LABEL,
  applicationJobLabel,
  canHoldApplication,
  splitApplicantName,
  type RmRowAction,
  type RmTab,
} from '@/lib/recruitRm';
import type { CallHold } from '@/lib/callHoldsApi';
import { TONE } from '@/lib/designTokens';

/**
 * ตารางใบสมัครของหน้างานสรรหา (RM) — แถวคือ **ใบสมัครจริงจากหน้า /apply**
 *
 * คอลัมน์ "สมัครงาน" คือหัวใจของหน้านี้ (เจ้าของย้ำ: ต้องรู้ว่าใครสมัครมางานไหน)
 * — มาจาก `job_title` + `unit_name` ที่ตารางใบสมัครเก็บไว้แล้วต่อใบ
 *
 * ⚠️ **ปุ่ม action ต่อแถวต่างกันตามแท็บ** (จุดเดียวที่ระบบเดิมให้ต่างกัน):
 *   ข้อมูลผู้สมัคร / การติดต่อ → bookmark_add · call · visibility
 *   ติดตามนัดหมาย            → call · rule · person_remove
 * ไอคอน Material เดิมจับคู่กับ lucide ที่ใช้ทั้งแอป — ไม่ลากชุดฟอนต์ใหม่เข้ามา
 *
 * ⚠️ คอลัมน์ "จำนวน" ของระบบเดิมไม่มีข้อมูลฝั่งเรา (ไม่รู้ว่าเขานับอะไร) —
 * **ตัดออกดีกว่าโชว์ 0 ปลอมทุกแถว** · สีสถานะใช้ APPLICATION_STATUS_CLASS
 * ที่ประกาศใน lib อยู่แล้ว (กติกา: ห้ามทำ map สีในไฟล์หน้า)
 */

const ACTION_ICON: Record<RmRowAction, typeof Phone> = {
  bookmark: BookmarkPlus,
  call: Phone,
  view: Eye,
  rule: ClipboardCheck,
  remove: UserMinus,
};

const RmTable: React.FC<{
  tab: RmTab;
  rows: PublicApplication[];
  selectedIds: string[];
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onAction: (action: RmRowAction, row: PublicApplication) => void;
  /** ล็อกโทรที่มีอยู่ (คีย์ = application id) — ไว้โชว์ 🔒 และกันกด "โทร" ซ้ำ */
  holdByRef?: Record<string, CallHold>;
}> = ({ tab, rows, selectedIds, onToggleRow, onToggleAll, onAction, holdByRef = {} }) => {
  const actions = RM_ROW_ACTIONS[tab];
  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  if (rows.length === 0) {
    return (
      <p className={cn('rounded-xl border px-3 py-6 text-center text-sm', DASH.card, DASH.muted)}>
        ไม่พบใบสมัครตามเงื่อนไขที่เลือก — ลองล้างตัวกรองด้านซ้าย
      </p>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border', DASH.card)}>
      {/* ตารางกว้างกว่าจอเล็กเป็นปกติ — เลื่อนในกล่องของตัวเอง ไม่ให้ทั้งหน้าเลื่อน */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[62rem] text-left text-sm">
          <thead className={cn('text-[11px] uppercase tracking-wide', DASH.tableHead)}>
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={onToggleAll}
                  aria-label="เลือกทั้งหมดในหน้านี้"
                  className="h-3.5 w-3.5 cursor-pointer accent-sky-600"
                />
              </th>
              <th className="px-3 py-2 font-semibold">ชื่อ</th>
              <th className="px-3 py-2 font-semibold">นามสกุล</th>
              <th className="px-3 py-2 font-semibold">เบอร์โทร</th>
              <th className="px-3 py-2 font-semibold">สมัครงาน</th>
              <th className="px-3 py-2 font-semibold">จังหวัด</th>
              <th className="px-3 py-2 font-semibold">ช่องทาง</th>
              <th className="px-3 py-2 font-semibold">วันที่สมัคร</th>
              <th className="px-3 py-2 font-semibold">สถานะ</th>
              <th className="px-3 py-2 text-right font-semibold">ตัวเลือก</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const checked = selectedIds.includes(r.id);
              const { firstName, lastName } = splitApplicantName(r);
              return (
                <tr key={r.id} className={cn('border-t', DASH.tableRow)}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleRow(r.id)}
                      aria-label={`เลือก ${r.full_name}`}
                      className="h-3.5 w-3.5 cursor-pointer accent-sky-600"
                    />
                  </td>
                  <td className={cn('px-3 py-2', DASH.cellStrong)}>{firstName || '—'}</td>
                  <td className={cn('px-3 py-2', DASH.cellStrong)}>{lastName || '—'}</td>
                  <td className={cn('px-3 py-2 font-mono text-[12px] whitespace-nowrap', DASH.cell)}>
                    {r.phone}
                  </td>
                  <td className={cn('px-3 py-2', DASH.cell)}>
                    <span className="inline-flex items-center gap-1.5">
                      {applicationJobLabel(r)}
                      {r.has_document ? (
                        <FileText
                          className={cn('h-3.5 w-3.5 shrink-0', DASH.muted)}
                          aria-label="มีเอกสารแนบ"
                        />
                      ) : null}
                    </span>
                  </td>
                  <td className={cn('px-3 py-2 whitespace-nowrap', DASH.cell)}>{r.province || '—'}</td>
                  <td className={cn('px-3 py-2 whitespace-nowrap', DASH.cellMuted)}>
                    {r.referral_source ? REFERRAL_SOURCE_LABEL[r.referral_source] : '—'}
                  </td>
                  <td className={cn('px-3 py-2 whitespace-nowrap', DASH.cell)}>
                    {formatYmdDmyBe(r.created_at.slice(0, 10))}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        APPLICATION_STATUS_CLASS[r.status],
                      )}
                    >
                      {APPLICATION_STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {actions.map((a) => {
                        const Icon = ACTION_ICON[a];
                        let label: string = RM_ROW_ACTION_LABEL[a];
                        let disabled = false;
                        // "โทร" = ดึงเข้าถังโทรของตัวเอง (call hold) — ใบที่จับไม่ได้
                        // ปุ่มต้อง disable พร้อมบอกเหตุผล ไม่ใช่กดแล้วค่อยไปพังที่ API
                        if (a === 'call') {
                          const held = holdByRef[r.id];
                          const can = canHoldApplication(r);
                          if (held) {
                            disabled = true;
                            label = `${held.heldByName || 'มีคน'} รับไปตามอยู่ · AI จะไม่โทรทับ`;
                          } else if (can.ok === false) {
                            disabled = true;
                            label = can.reason;
                          } else {
                            label = 'ดึงเข้าถังโทรของฉัน (AI จะไม่โทรทับ)';
                          }
                        }
                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => onAction(a, r)}
                            disabled={disabled}
                            title={label}
                            aria-label={`${label} — ${r.full_name}`}
                            className={cn(
                              'rounded-full border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                              TONE.primary.outline,
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RmTable;
