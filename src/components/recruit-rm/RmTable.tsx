import React from 'react';
import { BookmarkPlus, Bot, Phone, PhoneCall, Eye, ClipboardCheck, ListChecks, UserMinus, Undo2, FileText, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  rmRowActionLabel,
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
import { choiceCountdown } from '@/lib/callChoiceGuard';
import { callResultLabel } from '@/lib/homeCallResults';
import { INTEREST_MICRO_TONE } from '@/lib/trends/lumosPipeline';
import { FOLLOW_STATUS_LABEL, FOLLOW_STATUS_TONE, isFollowCallStatus } from '@/lib/followApi';
import { PROCESS_STATE_LABEL, PROCESS_STATE_TONE, PROCESS_STEP_LABEL, applicantProcessOf } from '@/lib/applicantProcess';

/** สถานะแบบ iRecruit (เจ้าของ 4 ต.ค. 2569 "เอาสถานะมาเพิ่มพอ") — ชิปสถานะ + ขั้นที่อยู่ */
function ProcessCell({ r }: { r: PublicApplication }) {
  const p = applicantProcessOf(r);
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span className={cn('whitespace-nowrap', TONE[PROCESS_STATE_TONE[p.state]].chip)}>{PROCESS_STATE_LABEL[p.state]}</span>
      <span className={cn('whitespace-nowrap text-xs', DASH.cellMuted)}>{PROCESS_STEP_LABEL[p.step]}</span>
    </span>
  );
}

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

/**
 * 🔴 ชื่อติดซ้ายตอนเลื่อนตารางแนวนอน (เจ้าของ 30 ก.ย. 2569: *"กดแล้วกางออก แต่ชื่อก็ยังดูได้"*) — จอแคบ/กางแถบกรอง
 * ตารางเลื่อนข้างในกล่อง ชื่อต้องไม่เลื่อนหายตามไป · พื้นทึบจาก `DASH.stickyHead` / `DASH.stickyCell`
 */
const STICKY_NAME = 'sticky left-0 z-10';

/** ป้ายนับถอยหลังของใบที่รออยู่ในกอง "เลือกวิธีโทร" (Phase 5.9)
 *  ⚠️ เวลาต้องคิดจาก choiceCountdown() ที่เดียว — ป้ายบนจอกับนาทีที่ worker ลงมือต้องเป็นชุดเดียวกัน */
function ChoiceCountdownChip({ r, now }: { r: PublicApplication; now: Date }) {
  if (!r.unclaimed_at || r.call_choice || r.claimed) return null;
  const cd = choiceCountdown(r.unclaimed_at, now);
  if (!cd) return null;
  const tone = cd.overdue ? TONE.danger : TONE.warn;
  return (
    <span
      title={`ถูกถอดจาก ${r.unclaimed_from_name || 'คนที่เก็บไว้'} เพราะเก็บไว้เกิน 1 วันแล้วยังไม่โทร — ${cd.label}`}
      className={cn('w-fit rounded-full border px-1.5 py-0.5 text-xs font-medium', tone.soft, tone.value)}
    >
      {cd.overdue ? 'ครบกำหนด — AI จะรับไป' : `รอเลือกวิธีโทร · ${cd.hoursLeft} ชม.`}
    </span>
  );
}

/** "ผ่านมาแล้วกี่วัน" — ครบ 24 ชม. = 1 วัน (`daysSinceApplied` · เจ้าของเคาะ 30 ก.ย. 2569) · ไม่มีวันที่ = ขีด */
function daysAppliedText(createdAt: string | null | undefined, now: Date): string {
  const d = daysSinceApplied(createdAt, now);
  if (d === null) return EM_DASH;
  return d === 0 ? 'วันนี้' : `${d.toLocaleString('th-TH')} วัน`;
}

/**
 * ═══ คำตอบกับ AI (เจ้าของสั่ง 30 ก.ย. 2569 · Choice "ผลสั้น ๆ + วันที่โทร") ═══
 * ถังผลชุดเดียวกับแผงผลโทรหน้าหลัก (server จัดถัง · `ai_answer`) · สีจาก `INTEREST_MICRO_TONE` ชุดเดียวกับ Dashboard ·
 * ยังไม่มีผล = บอกสถานะคิวแบบเดียวกับป๊อปรายชื่อ (รอคิว/กำลังโทร) · เบอร์ใช้ไม่ได้ = บอกตรง ๆ
 */
function AiAnswerCell({ r }: { r: PublicApplication }) {
  if (r.ai_answer) {
    return (
      <span className="flex flex-col gap-0.5">
        <span className={cn('whitespace-nowrap font-medium', TONE[INTEREST_MICRO_TONE[r.ai_answer.micro]].value)}>
          {callResultLabel('interest', r.ai_answer.micro)}
        </span>
        {r.ai_answer.at ? (
          <span className={cn('whitespace-nowrap text-xs tabular-nums', DASH.cellMuted)}>
            {formatYmdDmyBe(toYmdBangkok(new Date(r.ai_answer.at)))}
          </span>
        ) : null}
      </span>
    );
  }
  if (r.phone_callable === false) {
    return (
      <span
        className={cn('whitespace-nowrap text-xs font-medium', TONE.danger.value)}
        title="เบอร์นี้ใช้กับระบบโทรไม่ได้ (ไม่ใช่มือถือ 10 หลัก) — กดดูรายละเอียดเพื่อแก้เบอร์"
      >
        เบอร์ใช้โทรไม่ได้
      </span>
    );
  }
  if (isFollowCallStatus(r.last_call_status)) {
    return (
      <span className={cn('whitespace-nowrap text-xs font-medium', TONE[FOLLOW_STATUS_TONE[r.last_call_status]].value)}>
        {FOLLOW_STATUS_LABEL[r.last_call_status]}
      </span>
    );
  }
  return <span className={cn('whitespace-nowrap text-xs', DASH.cellMuted)}>ยังไม่ได้ส่งให้ AI</span>;
}

const ACTION_ICON: Record<RmRowAction, typeof Phone> = {
  bookmark: BookmarkPlus,
  call: Phone,
  ai: Bot,
  dial: PhoneCall,
  view: Eye,
  rule: ClipboardCheck,
  remove: UserMinus,
  release: Undo2,
  restore: RotateCcw,
};

/** แท็บการติดต่อใช้ไอคอนชุด iRecruit (call · rule · person_remove) — 4 ต.ค. 2569 */
const CONTACT_ACTION_ICON: Partial<Record<RmRowAction, typeof Phone>> = {
  dial: Phone,
  view: ListChecks,
  release: UserMinus,
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
  /** เจ้าของงาน = เจ้าหน้าที่สรรหาของใบขอที่สมัคร (ตัวเดียวกับหัวข้อกรอง "เจ้าหน้าที่สรรหา") */
  recruiterOf?: (r: PublicApplication) => string | null;
  /** ปุ่มต่อแถวแทนชุดของแท็บ — มุมมอง "ดูที่ยกเลิก" ใช้ ดูรายละเอียด + กู้คืน (4 ต.ค. 2569) */
  actionsOverride?: RmRowAction[];
}> = ({ tab, rows, selectedIds, onToggleRow, onToggleAll, onAction, holdByRef = {}, onAttendance, recruiterOf, actionsOverride }) => {
  const actions = actionsOverride ?? RM_ROW_ACTIONS[tab];
  /**
   * 🔴 แท็บผู้สมัครใช้ชุดคอลัมน์ที่เจ้าของสั่งเอง (30 ก.ย. 2569 · Choice "เอาตามที่ฉันสั่ง"):
   * *"ตรงรายชื่อ โชว์ ชื่อ นามสกุล ที่อยู่ หน่วยงาน ชื่อเจ้าของงาน(แบงค์ คิว เล็ก ฯลฯ) เพศ อายุ สมัครมาแล้วกี่วัน
   *  คำตอบที่ตอบกับ Ai มา"* — ไม่มีเบอร์/ช่องทาง/วันที่สมัครบนตาราง (ดูได้ในรายละเอียด)
   * แท็บการติดตาม/ติดตามนัดหมายยังชุดเดิม (ต้องเห็นเบอร์ตอนโทร)
   */
  const ownerColumns = tab === 'candidates';
  /** จับเวลาครั้งเดียวต่อการ render — ทุกแถวจึงนับ "ผ่านมาแล้วกี่วัน" จากหมุดเดียวกัน */
  const now = new Date();
  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  /**
   * 🔴 ว่างแล้วตารางห้ามหาย (กติกา 1 ต.ค. 2569 · QA 5 ต.ค. 2569 เจอว่าตารางหายเหลือย่อหน้า)
   * ⇒ หัวตารางอยู่เสมอ + แถวเดียว "ไม่พบใบสมัคร" · จำนวนคอลัมน์ต้องตรงกับหัวข้างล่าง
   */
  const colCount = 1 + (ownerColumns ? 10 : 4) + (tab === 'appointments' ? 1 : 0) + (tab === 'contact' ? 1 : 0) + 1;

  return (
    <div className={cn('overflow-hidden rounded-xl border', DASH.card)}>
      {/* 🔴 **ตารางต้องพอดีช่องข้างแถบกรองซ้าย** (เจ้าของสั่ง 28 ก.ย. 2569: "ย่อคอลัมน์ตารางให้พอดีจอเลย")
          เดิม min-w 62rem + หน่วยงานกว้างคงที่ 20rem ⇒ กว้าง ~1,434px ที่จอ 1280 ต้องเลื่อนขวาหาปุ่ม "ตัวเลือก"
          ⇒ คอลัมน์ที่เป็นคู่กันรวมเป็นช่องเดียวสองบรรทัด — **ข้อมูลครบชุดเดิมที่เจ้าของสั่ง 17 ส.ค. 2569**
          (ชื่อ · นามสกุล · เบอร์โทร · อายุ · เพศ · ที่อยู่ · หน่วยงาน · ช่องทาง · วันที่สมัคร · ผ่านมาแล้วกี่วัน)
          ห้ามถอดข้อมูลตัวไหนออกเพื่อให้แคบลง · จอเล็ก (ไม่มีแถบซ้าย) ยังเลื่อนในกล่องของตัวเองได้ ไม่ให้ทั้งหน้าเลื่อน
          🔴 **30 ก.ย. 2569 เลิกตัดข้อความเป็น … บรรทัดเดียว** (เจ้าของ: *"ตรงรายชื่อก็ขาดๆหายๆ"*) — ชื่อ/ที่อยู่/หน่วยงาน
          ขึ้นได้ 2 บรรทัด มีความกว้างขั้นต่ำกันช่องแคบ · แถบกรองซ้ายพับเป็นค่าตั้งต้นแล้ว ตารางจึงมีที่พอ ·
          เกิน 2 บรรทัดค่อยตัด (ชี้แล้วเห็นเต็มจาก title) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className={cn('text-xs', DASH.tableHead)}>
            <tr>
              <th className="w-8 px-1.5 py-2">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={onToggleAll}
                  disabled={rows.length === 0}
                  aria-label="เลือกทั้งหมดในหน้านี้"
                  className="h-3.5 w-3.5 cursor-pointer accent-sky-600"
                />
              </th>
              {ownerColumns ? (
                <>
                  <th className={cn(STICKY_NAME, 'px-1.5 py-2 font-medium', DASH.stickyHead)}>ชื่อ</th>
                  <th className="px-1.5 py-2 font-medium">นามสกุล</th>
                  <th className="px-1.5 py-2 font-medium">ที่อยู่</th>
                  <th className="px-1.5 py-2 font-medium">หน่วยงาน</th>
                  <th className="px-1.5 py-2 font-medium">เจ้าของงาน</th>
                  <th className="px-1.5 py-2 font-medium">เพศ</th>
                  <th className="px-1.5 py-2 text-right font-medium">อายุ</th>
                  <th className="px-1.5 py-2 font-medium">สมัครมาแล้ว</th>
                  <th className="px-1.5 py-2 font-medium">คำตอบกับ AI</th>
                  <th className="px-1.5 py-2 font-medium">สถานะ</th>
                </>
              ) : (
                <>
                  <th className={cn(STICKY_NAME, 'px-1.5 py-2 font-medium', DASH.stickyHead)}>ผู้สมัคร</th>
                  <th className="px-1.5 py-2 font-medium">ที่อยู่</th>
                  <th className="px-1.5 py-2 font-medium">หน่วยงาน</th>
                  <th className="px-1.5 py-2 font-medium">สมัคร</th>
                </>
              )}
              {/* วันนัดโผล่เฉพาะแท็บติดตามนัดหมาย — แท็บอื่นไม่มีใครถามคำถามนี้
                  (คอลัมน์ที่ว่างทั้งแถวทุกแท็บทำให้ตารางกว้างขึ้นโดยไม่ได้อะไร)
                  "นัด" = วันนัด + นัดที่ไหน/ลงใบไหน (ลิสต์ข้อ 9) ในช่องเดียว */}
              {/* ผลติดตามนัด มา/ไม่มา (migration 089) อยู่บรรทัดล่างของช่องเดียวกัน — เดิมเป็นคอลัมน์แยก
                  (แท็บนี้กว้างเกินช่องข้างแถบกรอง ~180px ที่จอ 1280 · 28 ก.ย. 2569) */}
              {tab === 'appointments' ? <th className="px-1.5 py-2 font-medium">นัด · มาตามนัด</th> : null}
              {/* stamp "โทรตอนไหน" — เฉพาะแท็บการติดต่อ (เจ้าของสั่ง 14 ส.ค. 2569:
                  "ปุ่มโทร เพื่อ Stamp ว่าโทรตอนไหน") · กดปุ่มโทร = จับ hold (heldAt =
                  เวลาที่กด) · มีผลแล้ว = last_call_at (เวลาบันทึกผลล่าสุด) */}
              {tab === 'contact' ? (
                <th className="px-1.5 py-2 font-medium">โทรล่าสุด</th>
              ) : null}
              <th className="px-1.5 py-2 text-right font-medium">ตัวเลือก</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className={cn('px-3 py-6 text-center text-sm', DASH.muted)} data-testid="rm-empty-row">
                  ไม่พบใบสมัครตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const checked = selectedIds.includes(r.id);
              const { firstName, lastName } = splitApplicantName(r);
              const name = [firstName, lastName].map((s) => (s || '').trim()).filter(Boolean).join(' ');
              const address = applicationAddressLabel(r);
              const addressCell = (
                <td className={cn('px-1.5 py-2', DASH.cell)} title={address || undefined}>
                  <span className="line-clamp-3 min-w-28 break-words">{dashIfEmpty(address)}</span>
                </td>
              );
              // ใส่ title ไว้ให้อ่านเต็มตอน hover — ข้อความยาวเกิน 2 บรรทัดถูกตัด แต่ข้อมูลไม่หาย
              const unitCell = (
                <td className={cn('px-1.5 py-2', DASH.cell)} title={applicationJobLabel(r)}>
                  <span className="flex min-w-32 items-start gap-1.5">
                    <span className="line-clamp-3 break-words">{dashIfEmpty(applicationUnitLabel(r))}</span>
                    {r.has_document ? (
                      <FileText className={cn('h-3.5 w-3.5 shrink-0', DASH.muted)} aria-label="มีเอกสารแนบ" />
                    ) : null}
                  </span>
                </td>
              );
              // align-middle ที่ tr คุมทุกคอลัมน์ในจุดเดียว — default ของ td คือ
              // baseline ซึ่งทำให้แถวที่มีสองบรรทัดดูเหลื่อมกับแถวข้าง ๆ
              return (
                <tr key={r.id} className={cn('border-t [&>td]:align-middle', DASH.tableRow)}>
                  <td className="px-1.5 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleRow(r.id)}
                      aria-label={`เลือก ${r.full_name}`}
                      className="h-3.5 w-3.5 cursor-pointer accent-sky-600"
                    />
                  </td>
                  {ownerColumns ? (
                    <>
                      <td className={cn(STICKY_NAME, 'px-1.5 py-2', DASH.stickyCell)}>
                        <span className="flex flex-col gap-0.5">
                          <span className={cn('line-clamp-2 min-w-14 break-words font-medium', DASH.cellStrong)} title={r.full_name || undefined}>
                            {dashIfEmpty(firstName)}
                          </span>
                          <ChoiceCountdownChip r={r} now={now} />
                        </span>
                      </td>
                      <td className="px-1.5 py-2">
                        <span className={cn('line-clamp-2 min-w-14 break-words font-medium', DASH.cellStrong)}>{dashIfEmpty(lastName)}</span>
                      </td>
                      {addressCell}
                      {unitCell}
                      <td className={cn('px-1.5 py-2 whitespace-nowrap', DASH.cell)}>{dashIfEmpty(recruiterOf?.(r) ?? '')}</td>
                      {/* อายุ/เพศ ไม่ได้กรอกมา = ขีด (ห้ามเดาหรือใส่ 0) */}
                      <td className={cn('px-1.5 py-2 whitespace-nowrap', DASH.cell)}>
                        {r.gender ? (GENDER_LABEL[r.gender] ?? EM_DASH) : EM_DASH}
                      </td>
                      <td className={cn('px-1.5 py-2 text-right tabular-nums', DASH.cell)}>
                        {typeof r.age === 'number' ? r.age : EM_DASH}
                      </td>
                      <td className={cn('px-1.5 py-2 whitespace-nowrap tabular-nums', DASH.cell)}>{daysAppliedText(r.created_at, now)}</td>
                      <td className="px-1.5 py-2">
                        <AiAnswerCell r={r} />
                      </td>
                      <td className="px-1.5 py-2">
                        <ProcessCell r={r} />
                      </td>
                    </>
                  ) : (
                    <>
                      {/* ผู้สมัคร = ชื่อ นามสกุล / เบอร์โทร · อายุ · เพศ
                          อายุ/เพศ ไม่ได้กรอกมา = ขีด (ห้ามเดาหรือใส่ 0) */}
                      <td className={cn(STICKY_NAME, 'px-1.5 py-2', DASH.stickyCell)}>
                        <span className="flex flex-col gap-0.5">
                          <span className={cn('line-clamp-2 min-w-32 break-words font-medium', DASH.cellStrong)} title={r.full_name || undefined}>
                            {dashIfEmpty(name)}
                          </span>
                          <span className={cn('whitespace-nowrap text-xs tabular-nums', DASH.cellMuted)}>
                            {dashIfEmpty(r.phone)} · {typeof r.age === 'number' ? `${r.age} ปี` : `อายุ ${EM_DASH}`} ·{' '}
                            {r.gender ? (GENDER_LABEL[r.gender] ?? EM_DASH) : `เพศ ${EM_DASH}`}
                          </span>
                          {/* เบอร์แปลง E.164 ไม่ได้ (087) — ส่ง AI/เก็บไปโทร/จับผลโทรไม่ได้
                              แก้ได้ที่ปุ่มดูรายละเอียด · เช็ค === false เพราะ server เก่าไม่ส่ง field */}
                          {r.phone_callable === false ? (
                            <span
                              className={cn('w-fit rounded-full border px-1.5 py-0.5 text-xs font-medium', TONE.danger.soft, TONE.danger.value)}
                              title="เบอร์นี้ใช้กับระบบโทรไม่ได้ (ไม่ใช่มือถือ 10 หลัก) — กดดูรายละเอียดเพื่อแก้เบอร์"
                            >
                              เบอร์ใช้โทรไม่ได้
                            </span>
                          ) : null}
                          <ChoiceCountdownChip r={r} now={now} />
                        </span>
                      </td>
                      {addressCell}
                      {unitCell}
                      {/* สมัคร = วันที่สมัคร / ผ่านมาแล้วกี่วัน · ช่องทาง
                          ⚠️ created_at ที่หายไปทำให้ .slice พังทั้งหน้า — gate ก่อนเสมอ
                          ห้าม .slice(0,10) ตรง ๆ = วันที่ฝั่ง UTC · ใบกรอกเที่ยงคืน–07:00 น. ไทยจะถอยไป 1 วัน
                          · ผ่านมาแล้วกี่วันนับตามปฏิทินกรุงเทพ (ใบเมื่อวานสามทุ่ม = "1 วัน" ตั้งแต่เช้านี้) */}
                      <td className="px-1.5 py-2 whitespace-nowrap">
                        <span className="flex flex-col gap-0.5">
                          <span className={cn('tabular-nums', DASH.cell)}>
                            {r.created_at ? formatYmdDmyBe(toYmdBangkok(new Date(r.created_at))) : EM_DASH}
                          </span>
                          <span className={cn('text-xs tabular-nums', DASH.cellMuted)}>
                            {daysAppliedText(r.created_at, now)}
                            {' · '}
                            {/* ช่องทางอ่านแบบเดียวกับตัวกรอง "ช่องทาง" — ตารางช่องทางของลิงก์ก่อน · ไม่มีค่อยใช้ที่ผู้สมัครเลือกเอง */}
                            {r.channel_label?.trim() || (r.referral_source ? REFERRAL_SOURCE_LABEL[r.referral_source] : EM_DASH)}
                          </span>
                        </span>
                      </td>
                    </>
                  )}
                  {tab === 'appointments' ? (
                    <td className="px-1.5 py-2" title={r.appointment_job || undefined}>
                      {/* วันนัดเก็บเป็น ISO เต็ม (เที่ยงวันไทย) — ตัดเอาเฉพาะวันที่ฝั่งไทย
                          ห้าม .slice(0,10) ตรง ๆ เพราะนั่นคือวันที่ฝั่ง UTC */}
                      <span className="flex flex-col gap-0.5">
                        <span className={cn('whitespace-nowrap tabular-nums', DASH.cell)}>
                          {r.appointment_at
                            ? formatYmdDmyBe(
                                new Date(r.appointment_at).toLocaleDateString('en-CA', {
                                  timeZone: 'Asia/Bangkok',
                                }),
                              )
                            : EM_DASH}
                        </span>
                        <span className={cn('line-clamp-2 min-w-32 break-words text-xs', DASH.cellMuted)}>
                          {r.appointment_place || r.appointment_job
                            ? `${r.appointment_place ?? ''}${r.appointment_place && r.appointment_job ? ' · ' : ''}${r.appointment_job ?? ''}`
                            : EM_DASH}
                        </span>
                        {/* ผลติดตามนัด (089): ปุ่มคู่โผล่ตั้งแต่วันนัด (เวลาไทย) เป็นต้นไป
                            กดซ้ำเพื่อแก้ได้ (append-only ล่าสุดชนะ) — ปุ่มที่เลือกอยู่ติดสีเต็ม
                            ยังไม่ถึงวันนัด = ไม่มีบรรทัดนี้ */}
                        {r.appointment_at && canRecordAttendance(r.appointment_at, new Date()) ? (
                          <span className="inline-flex items-center gap-1 pt-0.5">
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
                                    'whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
                                    tone.soft,
                                    tone.value,
                                    active ? 'ring-2 ring-ring' : 'opacity-75 hover:opacity-100',
                                  )}
                                >
                                  {k === 'showed' ? 'มาแล้ว' : 'ไม่มา'}
                                </button>
                              );
                            })}
                          </span>
                        ) : null}
                      </span>
                    </td>
                  ) : null}
                  {tab === 'contact' ? (
                    <td className={cn('px-1.5 py-2 text-xs', DASH.cellMuted)}>
                      {/**
                        * ลำดับความจริง: เวลาที่ **กดโทรจริง** (095) > เวลาที่ถือไว้ >
                        * เวลาที่ได้ผลโทร · อันแรกคือสิ่งที่เจ้าหน้าที่ทำเองกับมือ
                        * จึงตรงกับคำถาม "โทรกี่โมง โทรวันไหน" มากที่สุด
                        */}
                      {r.dialed_last_at ? (
                        <span className="inline-flex flex-col gap-0.5">
                          <span>{formatDateTimeTh(r.dialed_last_at)}</span>
                          {(r.dial_count ?? 0) > 1 ? (
                            <span className="text-xs text-muted-foreground">
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
                  <td className="px-1.5 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      {actions.map((a) => {
                        const Icon = (tab === 'contact' ? CONTACT_ACTION_ICON[a] : undefined) ?? ACTION_ICON[a];
                        let label: string = rmRowActionLabel(tab, a);
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
                            label = 'เก็บไปโทรเอง';
                          }
                        }
                        // ส่ง AI โทร — เบอร์ใช้ไม่ได้/มีคนถืออยู่ = กดไม่ได้ พร้อมบอกเหตุผล (ยิงจริงต้องผ่านป๊อปยืนยัน)
                        if (a === 'ai') {
                          const held = holdByRef[r.id];
                          if (r.phone_callable === false) {
                            disabled = true;
                            label = 'เบอร์นี้ใช้กับระบบโทรไม่ได้ — แก้เบอร์ที่ดูรายละเอียดก่อน';
                          } else if (held || r.claimed) {
                            disabled = true;
                            label = 'มีคนเก็บไปโทรอยู่ · AI จะไม่โทรทับ';
                          }
                        }
                        // ปุ่มกลมไม่มีกรอบ สีเทา แบบ iRecruit (rm-action-btn) — ใช้ Button ของ shadcn
                        return (
                          <Button
                            key={a}
                            type="button"
                            variant="ghost"
                            size="iconXs"
                            onClick={() => onAction(a, r)}
                            disabled={disabled}
                            title={label}
                            aria-label={`${label} — ${r.full_name}`}
                            className="rounded-full text-muted-foreground hover:text-foreground"
                          >
                            <Icon aria-hidden />
                          </Button>
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
