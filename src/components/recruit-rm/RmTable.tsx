import React from 'react';
import { BookmarkPlus, Phone, PhoneCall, Eye, ClipboardCheck, UserMinus, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
// ⚠️ DASH = token พื้นผิว dashboard · ขีดกลางคือ EM_DASH คนละตัว อย่าสับสน
import { DASH, TONE } from '@/lib/designTokens';
import { EM_DASH, dashIfEmpty } from '@/lib/displayFallback';
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_RESULTS,
  ATTENDANCE_TONE,
  canRecordAttendance,
  type AttendanceResult,
} from '@/lib/appointmentAttendance';
import { formatDateTimeTh, formatYmdDmyBe, toYmdBangkok } from '@/lib/dateTh';
import {
  GENDER_LABEL,
  REFERRAL_SOURCE_LABEL,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import {
  RM_ROW_ACTIONS,
  RM_ROW_ACTION_LABEL,
  applicationAddressLabel,
  applicationJobLabel,
  applicationUnitLabel,
  canHoldApplication,
  daysSinceApplied,
  splitApplicantName,
  type RmRowAction,
  type RmTab,
} from '@/lib/recruitRm';
import type { CallHold } from '@/lib/callHoldsApi';

/**
 * ตารางใบสมัครของหน้างานสรรหา (RM) — แถวคือ **ใบสมัครจริงจากหน้า /apply**
 *
 * คอลัมน์ "หน่วยงาน" คือหัวใจของหน้านี้ (เจ้าของย้ำ: ต้องรู้ว่าใครสมัครมาที่ไหน)
 * — มาจาก `unit_name` ที่ตารางใบสมัครเก็บไว้แล้วต่อใบ (ถอยไป `job_title` เมื่อไม่มี)
 *
 * ⚠️ **ปุ่ม action ต่อแถวต่างกันตามแท็บ** (จุดเดียวที่ระบบเดิมให้ต่างกัน):
 *   ข้อมูลผู้สมัคร / การติดต่อ → bookmark_add · call · visibility
 *   ติดตามนัดหมาย            → call · rule · person_remove
 * ไอคอน Material เดิมจับคู่กับ lucide ที่ใช้ทั้งแอป — ไม่ลากชุดฟอนต์ใหม่เข้ามา
 *
 * ⚠️ คอลัมน์ "จำนวน" ของระบบเดิมไม่มีข้อมูลฝั่งเรา (ไม่รู้ว่าเขานับอะไร) —
 * **ตัดออกดีกว่าโชว์ 0 ปลอมทุกแถว**
 * ที่ประกาศใน lib อยู่แล้ว (กติกา: ห้ามทำ map สีในไฟล์หน้า)
 */

const ACTION_ICON: Record<RmRowAction, typeof Phone> = {
  bookmark: BookmarkPlus,
  call: Phone,
  dial: PhoneCall,
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
  /** บันทึกผลติดตามนัด มา/ไม่มา (แท็บนัดหมาย · migration 089) */
  onAttendance?: (row: PublicApplication, result: AttendanceResult) => void;
}> = ({ tab, rows, selectedIds, onToggleRow, onToggleAll, onAction, holdByRef = {}, onAttendance }) => {
  const actions = RM_ROW_ACTIONS[tab];
  /** จับเวลาครั้งเดียวต่อการ render — ทุกแถวจึงนับ "ผ่านมาแล้วกี่วัน" จากหมุดเดียวกัน */
  const now = new Date();
  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  if (rows.length === 0) {
    return (
      <p className={cn('rounded-xl border px-3 py-6 text-center text-sm', DASH.card, DASH.muted)}>
        ไม่พบใบสมัครตามเงื่อนไขที่เลือก — ลองล้างคำค้นหรือเปลี่ยนแท็บ
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
              {/* ชุดคอลัมน์ที่เจ้าของสั่งไว้ 17 ส.ค. 2569:
                  ชื่อ · นามสกุล · เบอร์โทร · อายุ · เพศ · ที่อยู่ · หน่วยงาน · ช่องทาง ·
                  วันที่สมัคร · ผ่านมาแล้วกี่วัน (คอลัมน์ "สถานะ" ถูกถอดออกตามลิสต์) */}
              <th className="px-3 py-2 text-right font-semibold">อายุ</th>
              <th className="px-3 py-2 font-semibold">เพศ</th>
              <th className="px-3 py-2 font-semibold">ที่อยู่</th>
              {/* กว้างคงที่ — ชื่อหน่วยงานยาวมาก ถ้าปล่อยให้ auto-layout จัดเอง
                  แถวนั้นจะสูง 2–3 บรรทัดขณะที่แถวข้าง ๆ สูงบรรทัดเดียว */}
              <th className="w-[20rem] px-3 py-2 font-semibold">หน่วยงาน</th>
              <th className="px-3 py-2 font-semibold">ช่องทาง</th>
              <th className="px-3 py-2 font-semibold">วันที่สมัคร</th>
              <th className="px-3 py-2 text-right font-semibold">ผ่านมาแล้ว</th>
              {/* วันนัดโผล่เฉพาะแท็บติดตามนัดหมาย — แท็บอื่นไม่มีใครถามคำถามนี้
                  (คอลัมน์ที่ว่างทั้งแถวทุกแท็บทำให้ตารางกว้างขึ้นโดยไม่ได้อะไร) */}
              {tab === 'appointments' ? (
                <>
                  <th className="px-3 py-2 font-semibold">วันนัด</th>
                  {/* "นัดที่ไหน + ลงใบไหน" (ลิสต์ข้อ 9) — มีเฉพาะนัดจากบันทึกผลติดต่อ */}
                  <th className="px-3 py-2 font-semibold">นัดที่ไหน</th>
                  {/* ผลติดตามนัด มา/ไม่มา (migration 089) — ปุ่มโผล่ตั้งแต่วันนัดเป็นต้นไป */}
                  <th className="px-3 py-2 font-semibold">มาตามนัด</th>
                </>
              ) : null}
              {/* stamp "โทรตอนไหน" — เฉพาะแท็บการติดต่อ (เจ้าของสั่ง 14 ส.ค. 2569:
                  "ปุ่มโทร เพื่อ Stamp ว่าโทรตอนไหน") · กดปุ่มโทร = จับ hold (heldAt =
                  เวลาที่กด) · มีผลแล้ว = last_call_at (เวลาบันทึกผลล่าสุด) */}
              {tab === 'contact' ? (
                <th className="px-3 py-2 font-semibold">โทรล่าสุด</th>
              ) : null}
              <th className="px-3 py-2 text-right font-semibold">ตัวเลือก</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const checked = selectedIds.includes(r.id);
              const { firstName, lastName } = splitApplicantName(r);
              // align-middle ที่ tr คุมทุกคอลัมน์ในจุดเดียว — default ของ td คือ
              // baseline ซึ่งทำให้แถวที่มีสองบรรทัดดูเหลื่อมกับแถวข้าง ๆ
              return (
                <tr key={r.id} className={cn('border-t [&>td]:align-middle', DASH.tableRow)}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleRow(r.id)}
                      aria-label={`เลือก ${r.full_name}`}
                      className="h-3.5 w-3.5 cursor-pointer accent-sky-600"
                    />
                  </td>
                  <td className={cn('px-3 py-2', DASH.cellStrong)}>{dashIfEmpty(firstName)}</td>
                  <td className={cn('px-3 py-2', DASH.cellStrong)}>{dashIfEmpty(lastName)}</td>
                  <td className={cn('px-3 py-2 font-mono text-[12px] whitespace-nowrap', DASH.cell)}>
                    <span className="inline-flex items-center gap-1.5">
                      {dashIfEmpty(r.phone)}
                      {/* เบอร์แปลง E.164 ไม่ได้ (087) — ส่ง AI/เก็บไปโทร/จับผลโทรไม่ได้
                          แก้ได้ที่ปุ่มดูรายละเอียด · เช็ค === false เพราะ server เก่าไม่ส่ง field */}
                      {r.phone_callable === false ? (
                        <span
                          className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', TONE.danger.soft, TONE.danger.value)}
                          title="เบอร์นี้ใช้กับระบบโทรไม่ได้ (ไม่ใช่มือถือ 10 หลัก) — กดดูรายละเอียดเพื่อแก้เบอร์"
                        >
                          เบอร์ใช้โทรไม่ได้
                        </span>
                      ) : null}
                    </span>
                  </td>
                  {/* อายุ/เพศ — ไม่ได้กรอกมา = ขีด (ห้ามเดาหรือใส่ 0) */}
                  <td className={cn('px-3 py-2 text-right tabular-nums whitespace-nowrap', DASH.cell)}>
                    {typeof r.age === 'number' ? r.age : EM_DASH}
                  </td>
                  <td className={cn('px-3 py-2 whitespace-nowrap', DASH.cell)}>
                    {r.gender ? (GENDER_LABEL[r.gender] ?? EM_DASH) : EM_DASH}
                  </td>
                  <td className={cn('px-3 py-2', DASH.cell)} title={applicationAddressLabel(r) || undefined}>
                    <span className="block max-w-[14rem] truncate">
                      {dashIfEmpty(applicationAddressLabel(r))}
                    </span>
                  </td>
                  {/* ⚠️ truncate ต้องการกล่องที่มีความกว้างแน่นอน — inline-flex เดิมใช้ไม่ได้
                      ใส่ title ไว้ให้อ่านเต็มตอน hover ข้อมูลจึงไม่หายไปกับการตัด */}
                  <td className={cn('px-3 py-2', DASH.cell)} title={applicationJobLabel(r)}>
                    <span className="flex max-w-[20rem] items-center gap-1.5">
                      <span className="truncate">{dashIfEmpty(applicationUnitLabel(r))}</span>
                      {r.has_document ? (
                        <FileText
                          className={cn('h-3.5 w-3.5 shrink-0', DASH.muted)}
                          aria-label="มีเอกสารแนบ"
                        />
                      ) : null}
                    </span>
                  </td>
                  <td className={cn('px-3 py-2 whitespace-nowrap', DASH.cellMuted)}>
                    {r.referral_source ? REFERRAL_SOURCE_LABEL[r.referral_source] : EM_DASH}
                  </td>
                  {/* created_at ที่หายไปทำให้ .slice พังทั้งหน้า — gate ก่อนเสมอ
                      ⚠️ ห้าม .slice(0,10) ตรง ๆ = วันที่ฝั่ง UTC · ใบกรอกเที่ยงคืน–07:00 น.
                      ไทยจะถอยไป 1 วัน — ต้องตัดตามปฏิทินกรุงเทพ (แบบเดียวกับคอลัมน์วันนัด) */}
                  <td className={cn('px-3 py-2 whitespace-nowrap', DASH.cell)}>
                    {r.created_at ? formatYmdDmyBe(toYmdBangkok(new Date(r.created_at))) : EM_DASH}
                  </td>
                  {/* ผ่านมาแล้วกี่วัน — นับตามปฏิทินกรุงเทพ ใบเมื่อวานตอนสามทุ่มต้องอ่านว่า
                      "1 วัน" ตั้งแต่เช้าวันนี้ ไม่ใช่รอครบ 24 ชม. */}
                  <td className={cn('px-3 py-2 text-right tabular-nums whitespace-nowrap', DASH.cell)}>
                    {(() => {
                      const d = daysSinceApplied(r.created_at, now);
                      if (d === null) return EM_DASH;
                      return d === 0 ? 'วันนี้' : `${d.toLocaleString('th-TH')} วัน`;
                    })()}
                  </td>
                  {tab === 'appointments' ? (
                    <td className={cn('px-3 py-2 whitespace-nowrap', DASH.cell)}>
                      {/* วันนัดเก็บเป็น ISO เต็ม (เที่ยงวันไทย) — ตัดเอาเฉพาะวันที่ฝั่งไทย
                          ห้าม .slice(0,10) ตรง ๆ เพราะนั่นคือวันที่ฝั่ง UTC */}
                      {r.appointment_at
                        ? formatYmdDmyBe(
                            new Date(r.appointment_at).toLocaleDateString('en-CA', {
                              timeZone: 'Asia/Bangkok',
                            }),
                          )
                        : EM_DASH}
                    </td>
                  ) : null}
                  {tab === 'appointments' ? (
                    <td className={cn('px-3 py-2 text-[11px]', DASH.cellMuted)} title={r.appointment_job || undefined}>
                      {r.appointment_place || r.appointment_job
                        ? `${r.appointment_place ?? ''}${r.appointment_place && r.appointment_job ? ' · ' : ''}${r.appointment_job ?? ''}`
                        : EM_DASH}
                    </td>
                  ) : null}
                  {tab === 'appointments' ? (
                    <td className="px-3 py-2 whitespace-nowrap">
                      {/* ผลติดตามนัด (089): ปุ่มคู่โผล่ตั้งแต่วันนัด (เวลาไทย) เป็นต้นไป
                          กดซ้ำเพื่อแก้ได้ (append-only ล่าสุดชนะ) — ปุ่มที่เลือกอยู่ติดสีเต็ม */}
                      {r.appointment_at && canRecordAttendance(r.appointment_at, new Date()) ? (
                        <span className="inline-flex items-center gap-1">
                          {ATTENDANCE_RESULTS.filter((k) => k !== 'rescheduled').map((k) => {
                            const tone = TONE[ATTENDANCE_TONE[k]];
                            const active = r.attendance_result === k;
                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() => onAttendance?.(r, k)}
                                title={`บันทึกว่า${ATTENDANCE_LABEL[k]} — กดซ้ำอันอื่นเพื่อแก้ได้`}
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                                  tone.soft,
                                  tone.value,
                                  active ? 'ring-2 ring-ring' : 'opacity-75 hover:opacity-100',
                                )}
                              >
                                {k === 'showed' ? '✓ มาแล้ว' : '✗ ไม่มา'}
                              </button>
                            );
                          })}
                        </span>
                      ) : (
                        <span className={DASH.muted} title="บันทึกผลได้ตั้งแต่วันนัดเป็นต้นไป">
                          {EM_DASH}
                        </span>
                      )}
                    </td>
                  ) : null}
                  {tab === 'contact' ? (
                    <td className={cn('px-3 py-2 whitespace-nowrap text-[11px]', DASH.cellMuted)}>
                      {/**
                        * ลำดับความจริง: เวลาที่ **กดโทรจริง** (095) > เวลาที่ถือไว้ >
                        * เวลาที่ได้ผลโทร · อันแรกคือสิ่งที่เจ้าหน้าที่ทำเองกับมือ
                        * จึงตรงกับคำถาม "โทรกี่โมง โทรวันไหน" มากที่สุด
                        */}
                      {r.dialed_last_at ? (
                        <span className="inline-flex flex-col leading-tight">
                          <span>📞 {formatDateTimeTh(r.dialed_last_at)}</span>
                          {(r.dial_count ?? 0) > 1 ? (
                            <span className="text-[11px] text-muted-foreground">
                              โทรไปแล้ว {r.dial_count} ครั้ง
                            </span>
                          ) : null}
                        </span>
                      ) : holdByRef[r.id] ? (
                        `ถือไว้ ${formatDateTimeTh(holdByRef[r.id].heldAt)}`
                      ) : r.last_call_at ? (
                        formatDateTimeTh(r.last_call_at)
                      ) : (
                        EM_DASH
                      )}
                    </td>
                  ) : null}
                  {/* คอลัมน์ "สถานะ" (ชิปสถานะใบ + ชิปที่มา) ถูกถอดออกตามชุดคอลัมน์ที่
                      เจ้าของสั่ง 17 ส.ค. 2569 — ⚠️ ถอด <th> แล้วต้องถอด <td> ด้วยเสมอ
                      ไม่งั้นทุกแถวเลื่อนไปหนึ่งช่อง (ข้อมูลไปโผล่ใต้หัวคอลัมน์ผิด) */}
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
