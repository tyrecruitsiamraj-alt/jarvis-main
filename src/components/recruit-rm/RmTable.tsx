import React from 'react';
import { SCREENING_LABEL, SCREENING_RESULTS, SCREENING_TONE, canRecordScreening, type ScreeningResult } from '@/lib/appointmentScreening';
import { BookmarkPlus, Bot, Phone, PhoneCall, PhoneOff, Eye, ClipboardCheck, ListChecks, UserMinus, Undo2, FileText, RotateCcw, Send, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appointmentTimeOf } from '@/lib/appointmentTime';
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
import { formatDateTimeTh, formatYmdTh, toYmdBangkok } from '@/lib/dateTh';
import {
  GENDER_LABEL,
  REFERRAL_SOURCE_LABEL,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import {
  RM_ROW_ACTIONS,
  rmRowActionLabel,
  RM_ROW_ACTION_LABEL,
  DOCS_DISABLED_REASON,
  IRECRUIT_ADD_PENDING_REASON,
  aiSendBlockedReasonOf,
  applicationAddressLabel,
  applicationJobLabel,
  applicationUnitLabel,
  canHoldApplication,
  claimerOf,
  daysSinceApplied,
  rmKeptLine,
  splitApplicantName,
  type RmRowAction,
  type RmTab,
} from '@/lib/recruitRm';
import type { CallHold } from '@/lib/callHoldsApi';
import { choiceCountdown } from '@/lib/callChoiceGuard';
import { greetingHeardText } from '@/lib/greetingCall';
import { APPLICANT_AREA_LABEL, type ApplicantArea } from '@/lib/applicantArea';
import { aiQueueStatusOf } from '@/lib/applicantAiQueueStatus';
import { rmRowStatusOf } from '@/lib/applicantAiAnswerText';
import { PROCESS_STATE_LABEL, PROCESS_STATE_TONE, PROCESS_STEP_LABEL, applicantProcessOf } from '@/lib/applicantProcess';
import { irecruitLateHours, lateText } from '@/lib/irecruitPullStatus';
import {
  SCRAP_RESULT_LABEL,
  SCRAP_RESULT_TONE,
  scrapInJarvisLabel,
  scrapPlatformLabel,
  scrapReasonLabel,
} from '@/lib/scrapCandidates';
import { scrapVirtualStatus, type ScrapWorkRow } from '@/lib/scrapApplicants';

/**
 * ผลประเมินของ So Scraping บนแท็บ Scrap (25 พ.ย. 2569) — ป้ายผล (คำ ไม่ใช่สีอย่างเดียว) · เหตุผล · เว็บ ·
 * คนที่อยู่ในการติดต่อของคนอื่น/ในผู้สมัครแล้ว บอกไว้บรรทัดล่าง
 */
function ScrapResultCell({ w }: { w: ScrapWorkRow | null }) {
  const result = w?.scrap?.result ?? 'unscored';
  const reasons = (w?.scrap?.reasons ?? []).map(scrapReasonLabel).join(' · ');
  const inj = w?.virtual ? w.scrap?.in_jarvis : null;
  const where = inj ? scrapInJarvisLabel(inj) : null;
  const web = w?.scrap ? scrapPlatformLabel(w.scrap.platform) : (w?.app.channel_label ?? '').replace(/^Scrap · /, '');
  return (
    <td className="px-1.5 py-2">
      <span className="flex flex-col items-start gap-0.5">
        <span className={cn('whitespace-nowrap', TONE[SCRAP_RESULT_TONE[result]].chip)}>{SCRAP_RESULT_LABEL[result]}</span>
        <span className={cn('line-clamp-2 min-w-32 break-words text-xs', DASH.cellMuted)} title={reasons || undefined}>
          {[web, reasons, where].filter(Boolean).join(' · ') || EM_DASH}
        </span>
      </span>
    </td>
  );
}

/** สถานะแบบ iRecruit (เจ้าของ 4 ต.ค. 2569 "เอาสถานะมาเพิ่มพอ") — ชิปสถานะ + ขั้นที่อยู่ */
/** บรรทัดล่าง: ไม่สำเร็จ = เหตุผล · นัดได้/เลื่อนนัด = วันนัด · อื่น ๆ = ขั้นที่อยู่ (เจ้าของ 18 พ.ย. 2569 "นัดไม่ได้ก็บอกเลยว่าเพราะอะไร") */
function ProcessCell({ r }: { r: PublicApplication }) {
  const p = applicantProcessOf(r);
  const sub =
    p.reason ??
    ((p.state === 'booked' || p.state === 'rescheduled') && r.appointment_at ? formatDateTimeTh(r.appointment_at) : PROCESS_STEP_LABEL[p.step]);
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span className={cn('whitespace-nowrap', TONE[PROCESS_STATE_TONE[p.state]].chip)}>{PROCESS_STATE_LABEL[p.state]}</span>
      <span className={cn('whitespace-nowrap text-xs', DASH.cellMuted)}>{sub}</span>
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

/**
 * ป้ายของใบที่ถูกปล่อยกลับกอง "เลือกวิธีโทร" (Phase 5.9)
 * 🔴 17 พ.ย. 2569 เจ้าของ Choice "กลับกองกลาง ไม่ส่ง AI เอง" — ถอดป้ายนับถอยหลังให้ AI (AI ไม่โทรเองแล้ว)
 * บอกแค่ว่าปล่อยมาจากใคร · คนออกแล้วชื่อลงท้าย "(ปิดบัญชีแล้ว)" จาก worker
 */
function ChoiceCountdownChip({ r }: { r: PublicApplication; now: Date }) {
  if (!r.unclaimed_at || r.call_choice || r.claimed) return null;
  return (
    <span className={cn('w-fit rounded-full border px-1.5 py-0.5 text-xs font-medium', TONE.warn.soft, TONE.warn.value)}>
      ปล่อยจาก {r.unclaimed_from_name || 'คนที่เก็บไว้'}
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
/**
 * คอลัมน์ "คำตอบกับ AI" = ชิปที่แถวนั้นอยู่ (เจ้าของ 3 พ.ย. 2569 "อ่านแล้วต้องเคลียร์ว่าโทรแล้วเป็นไง ไม่โทรเพราะไร … แก้ให้ตรง Slot มัน")
 * บรรทัดบน = ชื่อชิปเป๊ะ · บรรทัดล่าง = ข้อเท็จจริง (โทรกี่ครั้ง ผลล่าสุด เวลา / เหตุที่ไม่ได้โทร) — ตัวตัดสินเดียว `rmRowStatusOf`
 */
function AiAnswerCell({ r, scrap }: { r: PublicApplication; scrap?: ScrapWorkRow | null }) {
  // แท็บ Scrap: คนที่ยังไม่มีใบ ยังไม่มีผลโทร — บอกว่าอยู่ชิปไหน (ไม่มีเบอร์ / อยู่ในการติดต่อ / อยู่ในผู้สมัคร / ยังไม่ส่ง)
  if (scrap?.virtual) {
    const v = scrapVirtualStatus(scrap);
    return (
      <span className="flex flex-col gap-0.5" data-testid="ai-row-status" data-view={scrap.view}>
        <span className={cn('whitespace-nowrap text-xs font-medium', TONE[v.tone].value)}>{v.title}</span>
        {v.detail ? <span className={cn('text-xs', DASH.cellMuted)}>{v.detail}</span> : null}
      </span>
    );
  }
  const st = rmRowStatusOf(r);
  // iRecruit ค้างเกินเวลา = บอกชั่วโมงที่ค้าง (21 ต.ค. 2569)
  const late = st.view === 'irecruit_pull' ? irecruitLateHours(r.irecruit_status, r.created_at) : null;
  return (
    <span className="flex flex-col gap-0.5" data-testid="ai-row-status" data-view={st.view}>
      <span className={cn('whitespace-nowrap text-xs font-medium', TONE[st.tone].value)}>{st.title}</span>
      {st.detail ? (
        <span className={cn('text-xs tabular-nums', st.tone === 'danger' ? TONE.danger.value : DASH.cellMuted)}>{st.detail}</span>
      ) : null}
      {late ? (
        <span className={cn('whitespace-nowrap text-xs tabular-nums', TONE.danger.value)} data-testid="irecruit-pull-status">
          {lateText(late)}
        </span>
      ) : null}
    </span>
  );
}

/** บรรทัดใต้หน่วยงาน: ตำแหน่ง · เลขใบขอ (ใบขอ ERP / ใบขอชั่วคราว) — ไม่มีทั้งคู่ = null */
function jobLine(r: PublicApplication): string | null {
  const position = (r.job_title || r.position_interest || '').replace(/\p{Extended_Pictographic}/gu, '').trim();
  const unit = (r.unit_name ?? '').trim();
  const m = /^siamraj-(?:sql|pre):(.+)$/.exec(r.job_id ?? '');
  const parts = [position && position !== unit ? position : '', m ? m[1] : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

const ACTION_ICON: Record<RmRowAction, typeof Phone> = {
  bookmark: BookmarkPlus,
  call: Phone,
  nocall: PhoneOff,
  ai: Bot,
  dial: PhoneCall,
  view: Eye,
  rule: ClipboardCheck,
  remove: UserMinus,
  release: Undo2,
  restore: RotateCcw,
  docs: Send,
  irecruit: UserPlus,
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
  /** ระบบส่งเอกสารเปิดอยู่ไหม — ปิด = ปุ่มส่งเอกสารกดไม่ได้พร้อมบอกเหตุ */
  docsEnabled?: boolean;
  /** ล็อกโทรที่มีอยู่ (คีย์ = application id) — ไว้โชว์ 🔒 และกันกด "โทร" ซ้ำ */
  holdByRef?: Record<string, CallHold>;
  /** บันทึกผลติดตามนัด มา/ไม่มา (แท็บนัดหมาย · migration 089) */
  onAttendance?: (row: PublicApplication, result: AttendanceResult | ScreeningResult) => void;
  /** หน่วยงานจากใบขอ (ใช้เมื่อใบสมัครไม่มี unit_name) */
  unitOf?: (r: PublicApplication) => string | null;
  /** เจ้าของงาน = เจ้าหน้าที่สรรหาของใบขอที่สมัคร (ตัวเดียวกับหัวข้อกรอง "เจ้าหน้าที่สรรหา") */
  recruiterOf?: (r: PublicApplication) => string | null;
  /** ใกล้งานแค่ไหน (`applicantArea.ts` · 24 พ.ย. 2569) — บรรทัดใต้ที่อยู่ · ไม่ส่ง = ไม่มีบรรทัดนี้ */
  areaOf?: (r: PublicApplication) => ApplicantArea;
  /** ปุ่มต่อแถวแทนชุดของแท็บ — มุมมอง "ดูที่ยกเลิก" ใช้ ดูรายละเอียด + กู้คืน (4 ต.ค. 2569) */
  actionsOverride?: RmRowAction[];
  /**
   * แถวที่ไม่ใช่ใบสมัคร วางบนสุดของตาราง — แท็บการติดต่อใช้กับคนที่เก็บจากจับคู่งาน (เจ้าของ 11 พ.ย. 2569 รวมตารางเดียว)
   * คอลัมน์ต้องตรงกับหัวของแท็บนั้น · `extraRowCount` > 0 = ไม่ขึ้นแถว "ไม่พบใบสมัคร"
   */
  extraRows?: React.ReactNode;
  extraRowCount?: number;
  /** แท็บ Scrap (25 พ.ย. 2569) — มี = คอลัมน์ "ผลประเมิน" ของ So Scraping (ผล · เหตุผล · เว็บ) ต่อจากอายุ */
  scrapOf?: (r: PublicApplication) => ScrapWorkRow | null;
}> = ({ tab, rows, selectedIds, onToggleRow, onToggleAll, onAction, docsEnabled = false, holdByRef = {}, onAttendance, recruiterOf, areaOf, actionsOverride, unitOf, extraRows, extraRowCount = 0, scrapOf }) => {
  const actions = actionsOverride ?? RM_ROW_ACTIONS[tab];
  /**
   * 🔴 แท็บผู้สมัครใช้ชุดคอลัมน์ที่เจ้าของสั่งเอง (30 ก.ย. 2569 · Choice "เอาตามที่ฉันสั่ง"):
   * *"ตรงรายชื่อ โชว์ ชื่อ นามสกุล ที่อยู่ หน่วยงาน ชื่อเจ้าของงาน(แบงค์ คิว เล็ก ฯลฯ) เพศ อายุ สมัครมาแล้วกี่วัน
   *  คำตอบที่ตอบกับ Ai มา"* — ไม่มีเบอร์/ช่องทาง/วันที่สมัครบนตาราง (ดูได้ในรายละเอียด)
   * แท็บการติดตาม/ติดตามนัดหมายยังชุดเดิม (ต้องเห็นเบอร์ตอนโทร)
   */
  const ownerColumns = tab === 'candidates';
  /** ช่อง "นัด" = วันเวลานัด (เลยวันนัดสีเตือน) · สถานที่ · ลงงาน · นัดโดย */
  const appointmentCell = (r: PublicApplication) => {
    const ymd = r.appointment_at ? toYmdBangkok(new Date(r.appointment_at)) : null;
    // เลยวันนัดแล้วยังไม่ลงผล = สีเตือน + "เลยวันนัด" (QA รอบ 3 ข้อ 23)
    const overdue = Boolean(ymd && ymd < toYmdBangkok(new Date()) && !r.attendance_result);
    const time = appointmentTimeOf(r.appointment_at);
    return (
      <td className="px-1.5 py-2" title={r.appointment_job || undefined}>
        <span className="flex flex-col gap-0.5">
          <span className={cn('whitespace-nowrap tabular-nums', overdue ? TONE.orange.value : DASH.cell)}>
            {ymd ? formatYmdTh(ymd) : EM_DASH}
            {time ? ` ${time} น.` : ''}
            {overdue ? ' · เลยวันนัด' : ''}
          </span>
          <span className={cn('line-clamp-2 min-w-32 break-words text-xs', DASH.cellMuted)}>
            {[r.appointment_place, r.appointment_job ? `ลงงาน ${r.appointment_job}` : '', r.appointment_at ? `นัดโดย ${r.appointment_by || EM_DASH}` : '']
              .filter(Boolean)
              .join(' · ') || EM_DASH}
          </span>
        </span>
      </td>
    );
  };
  /** ปุ่มบันทึกผลนัด มาแล้ว/ไม่มา — ตั้งแต่วันนัด (เวลาไทย) เป็นต้นไป · กดซ้ำเพื่อแก้ได้ (append-only ล่าสุดชนะ) */
  const attendanceButtons = (r: PublicApplication, stacked = false) =>
    r.appointment_at && canRecordAttendance(r.appointment_at, new Date()) ? (
      <span className={cn('inline-flex flex-wrap items-center gap-1 pt-0.5', stacked && 'flex-col flex-nowrap items-stretch')}>
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
                // มือถือสูง 36px (เดิม 25px)
                'whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium max-sm:min-h-9 max-sm:px-3',
                tone.soft,
                tone.value,
                active ? 'ring-2 ring-ring' : 'opacity-75 hover:opacity-100',
              )}
            >
              {ATTENDANCE_LABEL[k]}
            </button>
          );
        })}
        {/* มาแล้ว → ผ่าน / ไม่ผ่าน (151 · เจ้าของสั่ง 18 ต.ค. 2569 "มาแล้วผ่านเท่าไหร่ ไม่ผ่านเท่าไหร่") */}
        {canRecordScreening(r.attendance_result)
          ? SCREENING_RESULTS.map((k) => {
              const tone = TONE[SCREENING_TONE[k]];
              const active = r.screening_result === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onAttendance?.(r, k)}
                  title={`บันทึกว่า${SCREENING_LABEL[k]} — กดซ้ำอันอื่นเพื่อแก้ได้`}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium max-sm:min-h-9 max-sm:px-3',
                    tone.soft,
                    tone.value,
                    active ? 'ring-2 ring-ring' : 'opacity-75 hover:opacity-100',
                  )}
                >
                  {SCREENING_LABEL[k]}
                </button>
              );
            })
          : null}
      </span>
    ) : null;

  /** จับเวลาครั้งเดียวต่อการ render — ทุกแถวจึงนับ "ผ่านมาแล้วกี่วัน" จากหมุดเดียวกัน */
  const now = new Date();
  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  /**
   * 🔴 ว่างแล้วตารางห้ามหาย (กติกา 1 ต.ค. 2569 · QA 5 ต.ค. 2569 เจอว่าตารางหายเหลือย่อหน้า)
   * ⇒ หัวตารางอยู่เสมอ + แถวเดียว "ไม่พบใบสมัคร" · จำนวนคอลัมน์ต้องตรงกับหัวข้างล่าง
   */
  /** แท็บติดตามนัดหมาย (แบบร่างรอบ 4 · เจ้าของ "ทำเลย" 23 พ.ย. 2569): ผู้สมัคร · หน่วยงาน·ใบขอ · นัด · สถานะ · ผลนัด · ทำงาน (ไม่มีที่อยู่/สมัคร) */
  const apptColumns = tab === 'appointments';
  const scrapColumn = ownerColumns && Boolean(scrapOf);
  const colCount = 1 + (ownerColumns ? 11 : apptColumns ? 3 : 5) + (apptColumns ? 2 : 0) + (tab === 'contact' ? 1 : 0) + (scrapColumn ? 1 : 0) + 1;

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
                  <th className="px-1.5 py-2 font-medium">เบอร์โทร</th>
                  <th className="px-1.5 py-2 font-medium">ที่อยู่</th>
                  <th className="px-1.5 py-2 font-medium">หน่วยงาน</th>
                  <th className="px-1.5 py-2 font-medium">เจ้าของงาน</th>
                  <th className="px-1.5 py-2 font-medium">เพศ</th>
                  <th className="px-1.5 py-2 text-right font-medium">อายุ</th>
                  {scrapColumn ? <th className="min-w-36 px-1.5 py-2 font-medium">ผลประเมิน</th> : null}
                  <th className="px-1.5 py-2 font-medium">วันที่สมัคร</th>
                  {/* กว้างขั้นต่ำ — เดิมถูกบีบจนคำตกบรรทัดทีละคำ (เจ้าของ 25 พ.ย. 2569 "เรียงไม่สวยเลย") */}
                  <th className="min-w-40 px-1.5 py-2 font-medium">คำตอบกับ AI</th>
                  <th className="px-1.5 py-2 font-medium">สถานะ</th>
                </>
              ) : (
                <>
                  <th className={cn(STICKY_NAME, 'px-1.5 py-2 font-medium', DASH.stickyHead)}>ผู้สมัคร</th>
                  {apptColumns ? null : <th className="px-1.5 py-2 font-medium">ที่อยู่</th>}
                  <th className="px-1.5 py-2 font-medium">หน่วยงาน · ใบขอ</th>
                  {apptColumns ? <th className="px-1.5 py-2 font-medium">นัด</th> : <th className="px-1.5 py-2 font-medium">สมัคร · ช่องทาง</th>}
                  {/* สถานะ 5 คำ ทั้งแท็บการติดต่อ + ติดตามนัดหมาย (เจ้าของ Choice 18 พ.ย. 2569) */}
                  <th className="px-1.5 py-2 font-medium">สถานะ</th>
                </>
              )}
              {/* วันนัดโผล่เฉพาะแท็บติดตามนัดหมาย — แท็บอื่นไม่มีใครถามคำถามนี้
                  (คอลัมน์ที่ว่างทั้งแถวทุกแท็บทำให้ตารางกว้างขึ้นโดยไม่ได้อะไร)
                  "นัด" = วันนัด + นัดที่ไหน/ลงใบไหน (ลิสต์ข้อ 9) ในช่องเดียว */}
              {/* ผลติดตามนัด มา/ไม่มา (migration 089) อยู่บรรทัดล่างของช่องเดียวกัน — เดิมเป็นคอลัมน์แยก
                  (แท็บนี้กว้างเกินช่องข้างแถบกรอง ~180px ที่จอ 1280 · 28 ก.ย. 2569) */}
              {apptColumns ? <th className="px-1.5 py-2 font-medium">ผลนัด</th> : null}
              {/* stamp "โทรตอนไหน" — เฉพาะแท็บการติดต่อ (เจ้าของสั่ง 14 ส.ค. 2569:
                  "ปุ่มโทร เพื่อ Stamp ว่าโทรตอนไหน") · กดปุ่มโทร = จับ hold (heldAt =
                  เวลาที่กด) · มีผลแล้ว = last_call_at (เวลาบันทึกผลล่าสุด) */}
              {tab === 'contact' ? (
                <th className="px-1.5 py-2 font-medium">โทรล่าสุด</th>
              ) : null}
              {/* มือถือ: คอลัมน์ปุ่มติดขวา ไม่ต้องปัดหา (QA รอบ 2 ข้อ 30) */}
              <th className="px-1.5 py-2 text-right font-medium max-lg:sticky max-lg:right-0 max-lg:bg-card">{ownerColumns ? 'ตัวเลือก' : 'ทำงาน'}</th>
            </tr>
          </thead>
          <tbody>
            {extraRows}
            {rows.length === 0 && extraRowCount === 0 ? (
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
              // สิ่งที่บอก AI ในสายทักทายทั่วไป (15 ต.ค. 2569) — ป้ายอย่างเดียว ไม่แก้ช่องในใบ (เจ้าของ "ไม่แก้เอง ไม่ยืนยัน")
              const heard = greetingHeardText(r.ai_heard);
              const addressCell = (
                <td className={cn('px-1.5 py-2', DASH.cell)} title={address || undefined}>
                  <span className="line-clamp-3 min-w-28 break-words">{dashIfEmpty(address)}</span>
                  {areaOf ? (
                    <span
                      className={cn('mt-0.5 block text-xs', areaOf(r) === 'far' ? TONE.warn.value : DASH.cellMuted)}
                      data-testid="applicant-area"
                    >
                      {APPLICANT_AREA_LABEL[areaOf(r)]}
                    </span>
                  ) : null}
                  {heard ? (
                    <span
                      className={cn('mt-1 block w-fit rounded-md px-1.5 py-0.5 text-xs', TONE.info.chip)}
                      data-testid="ai-heard"
                    >
                      บอก AI: {heard}
                    </span>
                  ) : null}
                </td>
              );
              // ใส่ title ไว้ให้อ่านเต็มตอน hover — ข้อความยาวเกิน 2 บรรทัดถูกตัด แต่ข้อมูลไม่หาย
              const unitCell = (
                <td className={cn('px-1.5 py-2', DASH.cell)} title={applicationJobLabel(r)}>
                  <span className="flex min-w-32 items-start gap-1.5">
                    <span className="flex flex-col gap-0.5">
                      <span className="line-clamp-3 break-words">
                        {dashIfEmpty((r.unit_name ?? '').trim() ? applicationUnitLabel(r) : (unitOf?.(r) ?? applicationUnitLabel(r)))}
                      </span>
                      {/* ตำแหน่ง · เลขใบขอ (แบบร่างรอบ 4) — ไม่มีทั้งคู่ไม่ขึ้นบรรทัดนี้ */}
                      {ownerColumns ? null : jobLine(r) ? <span className={cn('line-clamp-2 break-words text-xs', DASH.cellMuted)}>{jobLine(r)}</span> : null}
                    </span>
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
                          {/* กดชื่อ = เปิดรายละเอียด (QA 17 ต.ค. 2569: เดิมกดชื่อแล้วไม่เปิด ต้องหาไอคอนตา) */}
                          <Button
                            type="button"
                            variant="link"
                            className={cn('h-auto justify-start whitespace-normal p-0 text-left', DASH.cellStrong)}
                            title={r.full_name || undefined}
                            onClick={() => onAction('view', r)}
                          >
                            <span className="line-clamp-2 min-w-14 break-words font-medium">{dashIfEmpty(firstName)}</span>
                          </Button>
                          {(() => {
                            // เก็บไปโทรแล้วหรือยัง — ทุกแถวมีเสมอ (17 พ.ย. 2569)
                            const kept = rmKeptLine(r, holdByRef[r.id]);
                            return (
                              <span className={cn('text-xs', kept.kept ? 'font-medium text-foreground' : 'text-muted-foreground')} data-testid="rm-kept">
                                {kept.text}
                              </span>
                            );
                          })()}
                          <ChoiceCountdownChip r={r} now={now} />
                        </span>
                      </td>
                      <td className="px-1.5 py-2">
                        <span className={cn('line-clamp-2 min-w-14 break-words font-medium', DASH.cellStrong)}>{dashIfEmpty(lastName)}</span>
                      </td>
                      {/* เบอร์โทร (เจ้าของ 16 ต.ค. 2569 "เอาเบอร์โทรมาโชว์ด้วย") · เบอร์แปลง E.164 ไม่ได้ = ป้ายเตือนแบบตารางอีกโฉม */}
                      <td className="px-1.5 py-2">
                        <span className="flex flex-col items-start gap-0.5">
                          <span className={cn('whitespace-nowrap tabular-nums', DASH.cell)}>{dashIfEmpty(r.phone)}</span>
                          {/* เคยสมัครมากี่ครั้ง (เบอร์เดียวกัน · 21 ต.ค. 2569) */}
                          {(r.apply_count ?? 0) > 1 ? (
                            <span
                              className={cn('w-fit whitespace-nowrap rounded-full border px-1.5 py-0.5 text-xs font-medium', TONE.info.soft, TONE.info.value)}
                              data-testid="apply-count"
                            >
                              สมัคร {r.apply_count} ครั้ง
                            </span>
                          ) : null}
                          {r.phone_callable === false ? (
                            <span
                              className={cn('w-fit whitespace-nowrap rounded-full border px-1.5 py-0.5 text-xs font-medium', TONE.danger.soft, TONE.danger.value)}
                              title="เบอร์นี้ใช้กับระบบโทรไม่ได้ (ไม่ใช่มือถือ 10 หลัก) — กดดูรายละเอียดเพื่อแก้เบอร์"
                            >
                              เบอร์ใช้โทรไม่ได้
                            </span>
                          ) : null}
                        </span>
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
                      {scrapColumn ? <ScrapResultCell w={scrapOf?.(r) ?? null} /> : null}
                      {/* วันที่สมัคร + ผ่านมาแล้วกี่วัน (เจ้าของ 16 ต.ค. 2569 "เอาวันที่สมัครมาด้วย") · วันที่ตามปฏิทินกรุงเทพ ห้าม .slice ตรง ๆ */}
                      <td className="px-1.5 py-2 whitespace-nowrap">
                        <span className="flex flex-col gap-0.5">
                          <span className={cn('tabular-nums', DASH.cell)}>
                            {r.created_at ? formatYmdTh(toYmdBangkok(new Date(r.created_at))) : EM_DASH}
                          </span>
                          <span className={cn('text-xs tabular-nums', DASH.cellMuted)}>{daysAppliedText(r.created_at, now)}</span>
                        </span>
                      </td>
                      <td className="px-1.5 py-2">
                        <AiAnswerCell r={r} scrap={scrapOf?.(r)} />
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
                          <Button
                            type="button"
                            variant="link"
                            className={cn('h-auto justify-start whitespace-normal p-0 text-left', DASH.cellStrong)}
                            title={r.full_name || undefined}
                            onClick={() => onAction('view', r)}
                          >
                            <span className="line-clamp-2 min-w-32 break-words font-medium">{dashIfEmpty(name)}</span>
                          </Button>
                          <span className={cn('whitespace-nowrap text-xs tabular-nums', DASH.cellMuted)}>
                            {dashIfEmpty(r.phone)} · {typeof r.age === 'number' ? `${r.age} ปี` : `อายุ ${EM_DASH}`} ·{' '}
                            {r.gender ? (GENDER_LABEL[r.gender] ?? EM_DASH) : `เพศ ${EM_DASH}`}
                          </span>
                          {/* เคยสมัครมากี่ครั้ง (เบอร์เดียวกัน · 21 ต.ค. 2569) */}
                          {(r.apply_count ?? 0) > 1 ? (
                            <span
                              className={cn('w-fit whitespace-nowrap rounded-full border px-1.5 py-0.5 text-xs font-medium', TONE.info.soft, TONE.info.value)}
                              data-testid="apply-count"
                            >
                              สมัคร {r.apply_count} ครั้ง
                            </span>
                          ) : null}
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
                      {apptColumns ? null : addressCell}
                      {unitCell}
                      {apptColumns ? appointmentCell(r) : null}
                      {/* สมัคร = วันที่สมัคร / ผ่านมาแล้วกี่วัน · ช่องทาง
                          ⚠️ created_at ที่หายไปทำให้ .slice พังทั้งหน้า — gate ก่อนเสมอ
                          ห้าม .slice(0,10) ตรง ๆ = วันที่ฝั่ง UTC · ใบกรอกเที่ยงคืน–07:00 น. ไทยจะถอยไป 1 วัน
                          · ผ่านมาแล้วกี่วันนับตามปฏิทินกรุงเทพ (ใบเมื่อวานสามทุ่ม = "1 วัน" ตั้งแต่เช้านี้) */}
                      {apptColumns ? null : (
                      <td className="px-1.5 py-2 whitespace-nowrap">
                        <span className="flex flex-col gap-0.5">
                          {/* วันที่ + เวลาสมัคร (เจ้าของ 23 พ.ย. 2569 "บอกแต่วันที่สมัครไม่บอกเวลาสมัครหรอ") */}
                          <span className={cn('tabular-nums', DASH.cell)} data-testid="rm-applied-at">
                            {r.created_at ? formatDateTimeTh(r.created_at) : EM_DASH}
                          </span>
                          <span className={cn('text-xs tabular-nums', DASH.cellMuted)}>
                            {daysAppliedText(r.created_at, now)}
                            {' · '}
                            {/* ช่องทางอ่านแบบเดียวกับตัวกรอง "ช่องทาง" — ตารางช่องทางของลิงก์ก่อน · ไม่มีค่อยใช้ที่ผู้สมัครเลือกเอง */}
                            {r.channel_label?.trim() || (r.referral_source ? REFERRAL_SOURCE_LABEL[r.referral_source] : EM_DASH)}
                          </span>
                        </span>
                      </td>
                      )}
                      <td className="px-1.5 py-2">
                        <ProcessCell r={r} />
                      </td>
                    </>
                  )}
                  {apptColumns ? (
                    <td className="px-1.5 py-2">
                      {/* ผลนัด: มาแล้ว/ไม่มา → ผ่าน/ไม่ผ่าน โผล่ตั้งแต่วันนัด · ยังไม่ถึงวันนัดบอกว่าลงได้เมื่อไหร่ · มือถือย้ายไปช่องทำงาน */}
                      <span className="max-sm:hidden">
                        {attendanceButtons(r) ?? (r.appointment_at ? <span className={cn('text-xs', DASH.cellMuted)}>ลงผลได้ตั้งแต่วันนัด</span> : EM_DASH)}
                      </span>
                    </td>
                  ) : null}
                  {tab === 'contact' ? (
                    <td className={cn('px-1.5 py-2 text-xs', DASH.cellMuted)}>
                      {/* ปุ่ม "ทุกคน" (10 พ.ย. 2569) — บอกว่าใครเก็บ · ของฉันไม่ขึ้น */}
                      {claimerOf(r) ? <span className="block font-medium text-foreground" data-testid="rm-claimer">เก็บโดย {claimerOf(r)}</span> : null}
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
                  <td className="px-1.5 py-2 max-lg:sticky max-lg:right-0 max-lg:bg-card">
                    {tab === 'appointments' ? <div className="mb-1 flex justify-end sm:hidden">{attendanceButtons(r, true)}</div> : null}
                    {/* มือถือ: ปุ่ม 2×2 ให้คอลัมน์ที่ติดขวาแคบลง ไม่บังข้อมูลทั้งแถว (QA 19 ต.ค. 2569: เดิมกว้าง 207px บังหมด)
                        w-max: ตารางบีบช่องนี้เหลือ 42px ⇒ ปุ่ม 40px ซ้อนกันจนกดยาก (เจ้าของ 20 ต.ค. 2569 แท็บการติดต่อ) */}
                    <div className="flex items-center justify-end gap-0.5 max-sm:grid max-sm:w-max max-sm:grid-cols-2 max-sm:gap-1">
                      {actions.map((a) => {
                        const silentAi = aiQueueStatusOf(r)?.kind === 'silent';
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
                        // แท็บ Scrap: ไม่มีเบอร์ / อยู่ในการติดต่อ / อยู่ในผู้สมัครแล้ว = กดเก็บ/ส่งไม่ได้ บอกเหตุ (ดูรายละเอียดยังกดได้)
                        const sw = scrapOf?.(r);
                        if (sw?.virtual && sw.view !== 'ready' && a !== 'view') {
                          disabled = true;
                          label = scrapVirtualStatus(sw).title;
                        }
                        // ส่ง AI โทร — เบอร์ใช้ไม่ได้/มีคนถืออยู่ = กดไม่ได้ พร้อมบอกเหตุผล (ยิงจริงต้องผ่านป๊อปยืนยัน)
                        if (a === 'ai' && !disabled) {
                          const held = holdByRef[r.id];
                          if (r.phone_callable === false) {
                            disabled = true;
                            label = 'เบอร์นี้ใช้กับระบบโทรไม่ได้ — แก้เบอร์ที่ดูรายละเอียดก่อน';
                          } else if (held || r.claimed) {
                            disabled = true;
                            label = 'มีคนเก็บไปโทรอยู่ · AI จะไม่โทรทับ';
                          } else if (aiSendBlockedReasonOf(r)) {
                            // กล่องที่ส่งไม่ได้ (26 พ.ย. 2569 · ใบขอยังไม่ตั้งรายได้ · เบอร์ถูกพัก · เคยปฏิเสธงานนี้ …)
                            disabled = true;
                            label = aiSendBlockedReasonOf(r) ?? label;
                          } else if (silentAi) {
                            label = 'ส่ง AI ใหม่';
                          }
                        }
                        // ไม่โทร (26 พ.ย. 2569) — ใบที่กดไว้แล้ว = ยกเลิกไม่โทร · คนจาก Scrap ที่ยังไม่มีใบ = กดไม่ได้
                        if (a === 'nocall') {
                          if (sw?.virtual) {
                            disabled = true;
                            label = 'ยังไม่มีใบสมัคร — กดส่ง AI โทรหรือเก็บไปโทรเองก่อน';
                          } else if (r.no_call_reason_id != null) {
                            label = 'ยกเลิกไม่โทร';
                          }
                        }
                        // ส่งเอกสาร (23 พ.ย. 2569) — ระบบปิด = กดไม่ได้พร้อมบอกเหตุ · เพิ่มผู้สมัครเข้า iRecruit = รอ API กดไม่ได้เสมอ
                        if (a === 'docs' && !docsEnabled) {
                          disabled = true;
                          label = DOCS_DISABLED_REASON;
                        }
                        if (a === 'irecruit') {
                          disabled = true;
                          label = IRECRUIT_ADD_PENDING_REASON;
                        }
                        // แท็บนัดหมาย: ปุ่มเปิดบันทึกผลมีคำ (QA 18 ต.ค. 2569 — กฎปุ่มต้องมีคำ)
                        // ส่ง AI ใหม่ (19 ต.ค. 2569) — สายเดิมเงียบเกิน 24 ชม. ปุ่มมีคำให้เห็นชัด
                        const resend = a === 'ai' && silentAi && !disabled;
                        // ปุ่มส่ง AI โทรมีคำเสมอ (QA 15 พ.ย. 2569) — เดิมเป็นไอคอนเปล่าวางติดปุ่มเก็บ Lead/ดูรายละเอียด กดสั่งโทรจริงพลาดได้
                        // แท็บการติดต่อ: ปุ่มมีคำทุกปุ่ม (แบบร่างรอบ 4 · 23 พ.ย. 2569) — โทร · ดำเนินการ · ส่งเอกสาร · ถอย Lead
                        const worded = tab === 'contact' || (tab === 'appointments' && a === 'rule') || a === 'ai' || a === 'nocall' || a === 'docs' || a === 'irecruit';
                        // ปุ่มกลมไม่มีกรอบ สีเทา แบบ iRecruit (rm-action-btn) — ใช้ Button ของ shadcn
                        return (
                          <Button
                            key={a}
                            type="button"
                            variant={worded ? 'outline' : 'ghost'}
                            size={worded ? 'xs' : 'iconXs'}
                            onClick={() => onAction(a, r)}
                            disabled={disabled}
                            title={label}
                            aria-label={`${label} — ${r.full_name}`}
                            // มือถือปุ่ม 40px (เดิม 32px ติดกัน กด "ส่ง AI โทร" พลาดโดน "ดูรายละเอียด")
                            className={
                              worded
                                ? // มือถือ: ปุ่มมีคำกินแถวของตัวเองในตาราง 2×2 — ไม่งั้นคอลัมน์กว้างจนมุดใต้ชื่อที่ติดซ้าย (15 พ.ย. 2569 รูปมือถือ)
                                  cn('rounded-full max-sm:min-h-9', a === 'ai' && 'max-sm:col-span-2')
                                : 'rounded-full text-muted-foreground hover:text-foreground max-sm:h-10 max-sm:w-10'
                            }
                          >
                            <Icon aria-hidden />
                            {worded ? (resend ? 'ส่ง AI ใหม่' : a === 'ai' ? 'ส่ง AI โทร' : a === 'nocall' ? (r.no_call_reason_id != null ? 'ยกเลิกไม่โทร' : 'ไม่โทร') : a === 'rule' ? 'ลงผล' : tab === 'contact' ? rmRowActionLabel(tab, a) : RM_ROW_ACTION_LABEL[a]) : null}
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
