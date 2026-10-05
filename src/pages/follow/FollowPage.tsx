import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import SectionErrorBoundary from '@/components/shared/SectionErrorBoundary';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { friendlyErrorText } from '@/lib/friendlyError';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import FollowCallRoundsPanel from '@/components/follow/FollowCallRoundsPanel';
import FollowFilterGroup from '@/components/follow/FollowFilterGroup';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { followScheduleCounts } from '@/lib/followSchedule';
import { roundTabLabel } from '@/lib/followRoundVisual';
import { conveyorLabel } from '@/lib/soRecruitNav';
import { ArrowLeft, Settings2, Plus, X, LoaderCircle, PhoneForwarded, Users, UserCog, Building2, ChevronLeft, ChevronRight, RefreshCw, ClipboardList } from 'lucide-react';
import {
  listFollowEntries,
  createFollowRounds,
  cancelFollowEntry,
  purgeFollowEntry,
  completeFollowEntry,
  reopenFollowEntry,
  recordFollowStaffCall,
  clearFollowStaffCall,
  type FollowEntry,
  type FollowStopScope,
  updateFollowEntry,
} from '@/lib/followApi';
import type { FollowStaffCallOutcome } from '@/lib/followStaffCall';
import { summarizeDispatchResults } from '@/lib/followDispatchState';
import BoardPersonPicker from '@/components/follow/BoardPersonPicker';
import BoardUnitPicker from '@/components/follow/BoardUnitPicker';
import { splitPickerName, type BoardPickerPerson } from '@/lib/boardPickerApi';
import { buildBoardUnitOptions, mergeBoardUnitOptions, type BoardUnitOption } from '@/lib/boardUnitPicker';
import { findScheduleDuplicates, type DuplicateRound } from '@/lib/followDuplicateGuard';
import { followGroupKey, followPersonKey, groupFollowEntries } from '@/lib/followGrouping';
import { followScopeEntries, followTeamForScope } from '@/lib/followReplacement';
import { followRoundSlot } from '@/lib/followRoundBuckets';
import { followMatrixColOfCategory, type FollowMatrixCol } from '@/lib/followCallMatrix';
import {
  filterFollowEntries,
  matchesFollowSearch,
  followPlanDayOf,
  followPlanDayOptions,
  FOLLOW_ADDER_NONE,
  followAdderOptions,
  matchesFollowAdder,
  countFollowCallers,
  followCallerOf,
  FOLLOW_CALLERS,
  FOLLOW_CALLER_LABEL,
  type FollowCaller,
  FOLLOW_TABS,
  FOLLOW_TAB_LABEL,
  TIME_BAND_LABEL,
  type TimeBand,
} from '@/lib/followListFilter';
import {
  firstIncompleteStep,
  followStepError,
  followStepSummary,
  FOLLOW_WIZARD_STEPS,
  isSubmitTooSoonAfterStep3,
  nextFollowStep,
  prevFollowStep,
  scheduleDayStaffPhone,
  buildScheduleCalls,
  SCHEDULE_TBD,
  scheduleCallsByDay,
  type FollowWizardStep,
  type ScheduleCall,
  type ScheduleDayMode,
} from '@/lib/followWizard';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hasFollowPrefill, readFollowPrefill, splitPrefillName } from '@/lib/followPrefill';
import { fetchSiamrajUnitRequests, fetchAllUnitOptions } from '@/lib/siamrajUnitRequestsApi';
import type { JobRequest } from '@/types';
import FollowEditDialog from '@/components/follow/FollowEditDialog';
import RoundScriptNote from '@/components/follow/RoundScriptNote';
import StaffContactField from '@/components/follow/StaffContactField';
import { STAFF_PHONE_SAME_WARNING, staffPhoneAckKey, staffPhoneMatchesApplicant } from '@/lib/followPhoneGuard';
import TopicField from '@/components/follow/TopicField';
import FollowMasterManagerDialog from '@/components/follow/FollowMasterManagerDialog';
import FollowRoundsDialog from '@/components/follow/FollowRoundsDialog';
import IrecruitReplaceSyncBar from '@/components/follow/IrecruitReplaceSyncBar';
import FollowDayReportDialog from '@/components/follow/FollowDayReportDialog';
import FollowPlanningCalendar from '@/components/follow/FollowPlanningCalendar';
import FollowCompletedCard from '@/components/follow/FollowCompletedCard';
import DayCalendarPicker from '@/components/shared/DayCalendarPicker';
import TimeSelect24 from '@/components/shared/TimeSelect24';
import DateTimeField24 from '@/components/shared/DateTimeField24';
import { type FollowOutcome } from '@/lib/followOutcome';
import { buildFollowPlanningRows, callCategory, type FollowPlanningRound, type FollowRoundFilter } from '@/lib/followPlanning';
import { toYmdBangkok, formatYmdDmyBe } from '@/lib/dateTh';
import { tbdPlaceholderAts } from '@/lib/followTbd';
import { useHeaderSearch } from '@/hooks/useHeaderSearch';
import { listFollowTopics, createFollowTopic, type FollowTopic } from '@/lib/followTopicsApi';
import {
  listStaffContacts,
  createStaffContact,
  type FollowStaffContact,
} from '@/lib/followStaffContactsApi';
import { useAuth } from '@/contexts/AuthContext';

/** ค่าเริ่มต้นช่องวันเวลา = ตอนนี้ (รูปแบบ datetime-local ตามเวลาเครื่อง) */
function nowForInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * คำนำหน้าที่ให้เลือก — เก็บเป็นข้อความติดหน้าชื่อตามธรรมเนียมไทย ("นายสมชาย ใจดี")
 * ค่าว่าง = ไม่ระบุ (บางเคสมีแค่ชื่อเล่น/ชื่อที่คนแนะนำมา)
 */
const NAME_PREFIXES = ['', 'นาย', 'นาง', 'นางสาว'] as const;

/** ป้ายวันแบบสั้น (พฤ. 2 ต.ค.) ของตารางหลายวัน — ประกาศระดับโมดูล (กติกา `new Intl.*`) */
const SCHEDULE_DAY_FMT = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const scheduleDayLabel = (ymd: string): string => SCHEDULE_DAY_FMT.format(new Date(`${ymd}T00:00:00+07:00`));

/** ประกอบชื่อที่จะส่งให้ API — API รับ `recipient_name` ก้อนเดียว */
function composeRecipientName(prefix: string, first: string, last: string): string {
  return `${prefix}${first.trim()} ${last.trim()}`.trim().replace(/\s+/g, ' ');
}

/**
 * แท็บ Dashboard ของหน้าติดตาม (เจ้าของสั่ง 28 ก.ย. 2569 — "ขอคำว่า dashboard") · โหลดเมื่อกดเท่านั้น
 * (กราฟ + ข้อมูลย้อนหลังไม่ควรถ่วงหน้ารายการที่เปิดทั้งวันและรีเฟรชทุก 25 วิ)
 */
const FollowDashboard = lazy(() => import('@/components/dashboard-trends/FollowDashboard'));

const FollowPage: React.FC = () => {
  const [items, setItems] = useState<FollowEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * แท็บสถานะ (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-6: แยกหน้า กำลังตาม/สำเร็จ/สิ้นสุด/ยกเลิก)
   * + filter ประจำวัน (วันที่/ช่วงเวลา/เจ้าของงาน) · ตรรกะที่ followListFilter.ts
   */
  /**
   * "งานจบหรือยัง" ถูกถอดออกจากหัวแผง (เจ้าของสั่ง 3 ต.ค. 2569 "เอาออก" — กลับคำสั่ง 1 ต.ค.)
   * 🔴 ถอดแล้ว = **ตารางเห็นทุกสถานะ** ไม่ใช่ล็อกไว้ที่ "กำลังตาม" (แก้ค่ำ 3 ต.ค. 2569 — รอบแรกล็อกไว้
   * พอสายของวันปิดงานหมด ตารางเหลือ "ไม่มีสายที่ต้องตาม" ทั้งที่วันนั้นมี 49 สาย เจ้าของถามว่าหายไปไหน)
   */
  /** ใครโทร (เจ้าของสั่ง 2 ต.ค. 2569) — 'manual' = เหลือเฉพาะสายที่เจ้าหน้าที่ต้องโทรเอง */
  const [caller, setCaller] = useState<FollowCaller>('all');
  /**
   * 🔴 เจ้าของงาน = **อีเมลคนเพิ่ม** (created_by_name) — เจ้าของสั่ง 5 ต.ค. 2569: *"เจ้าของงานก็ตามเมล์อะ พวก
   * duangthida.p@siamraj.com"* + *"คำว่า ใครเพิ่มก็เอาออกไปจาก Filter"* ⇒ ตัวกรองเดิมสองตัว (เจ้าของงาน = ชื่อเจ้าหน้าที่ติดตาม ·
   * ใครเพิ่ม) ยุบเหลือตัวนี้ตัวเดียว · 'all' = ทุกคน · 'me' = ของฉัน (อีเมลที่ล็อกอิน · "คนเพิ่มอยากดูแค่งานตัวเอง")
   */
  const [adderFilter, setAdderFilter] = useState('all');
  /** ป๊อปสรุปแผนทั้งวัน (เจ้าของสั่ง 2 ต.ค. 2569) — วัน = วันที่เลือกดูอยู่ (ไม่เลือก = วันนี้) */
  const [reportOpen, setReportOpen] = useState(false);
  const [fDate, setFDate] = useState('');
  const [fBand, setFBand] = useState<TimeBand>('');
  /** เดือนที่ปฏิทิน Planning กางอยู่ (YYYY-MM) — เริ่มที่เดือนนี้ตามปฏิทินไทย */
  const [calMonth, setCalMonth] = useState(() => toYmdBangkok(new Date()).slice(0, 7));
  /**
   * ช่องในปฏิทินที่กดเปิดอยู่ (คน + วัน) — null = ไม่ได้เปิด
   * เก็บเป็น **คีย์** ไม่ใช่ก้อนข้อมูล เพื่อให้ป๊อปอ่านของสดหลังโหลดใหม่เสมอ
   * (ปิดงาน/ยกเลิกแล้วป้ายในป๊อปต้องเปลี่ยนตาม ไม่ใช่ค้างของเก่า)
   */
  const [openCell, setOpenCell] = useState<{ key: string; ymd: string } | null>(null);
  /**
   * ช่องที่กำลังพักไว้ระหว่างเปิดกล่องแก้ไข (เจ้าของสั่ง 1 ก.ย. 2569 ข้อ 10:
   * *"กรณีแก้ไขสถานะเสร็จแล้ว อยากให้ทำได้ต่อเนื่อง (ย้อนกลับ) ไม่ต้องเริ่มใหม่ทุกครั้ง"*)
   *
   * 🔴 กติกา "ห้ามซ้อน Dialog" บังคับให้ปิดป๊อปก่อนเปิดกล่องแก้ไข ⇒ เดิมแก้เสร็จแล้ว
   * ต้องไล่หาช่องเดิมในปฏิทินใหม่ทุกครั้ง · จำไว้แล้วเปิดกลับให้เองเมื่อกล่องแก้ไขปิด
   */
  const [cellToReopen, setCellToReopen] = useState<{ key: string; ymd: string } | null>(null);
  /**
   * "การโทรครั้งที่" ที่แผงข้างบนเลือกอยู่ (เจ้าของสั่ง 1 ก.ย. 2569:
   * *"ถ้าเลือกการโทรครั้งที่ 1 ตารางปฏิทินก็โชว์ข้อมูลแค่ของครั้งที่ 1 สิ"*)
   * 🔴 นิยาม "อยู่รอบไหน" ใช้ `followRoundSlot` ตัวเดียวกับที่แผงนับ — ห้ามเขียนซ้ำ
   */
  /**
   * รอบที่กำลังดู — **ที่เดียวทั้งหน้า** (รวมแผงการโทรกับปฏิทินเป็นการ์ดเดียว 8 ก.ย. 2569)
   * เดิมแผงบนถือ state ของตัวเอง + ปฏิทินมีชิปกรองอีกชุด ⇒ ผู้ทดสอบตาใหม่ถามว่า
   * *"ทำไมมีสองที่พูดเรื่องเดียวกัน"* · ค่าเริ่มต้น "ทุกสาย" = เปิดมาเห็นงานครบก่อน
   */
  const [activeRound, setActiveRound] = useState<FollowRoundFilter>('all');
  /**
   * กล่องผลที่เลือกบนแผงขั้นตอนของสาย — ตารางเหลือคนในกล่องนั้น ("ชื่อย้ายไปตามกล่อง" · เจ้าของสั่ง 5 ต.ค. 2569)
   * null = ทุกคน · นิยามกล่อง = `followMatrixColOfCategory(callCategory(...))` ตัวเดียวกับเลขบนกล่อง
   */
  const [resultBox, setResultBox] = useState<FollowMatrixCol | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  /**
   * เบอร์เจ้าหน้าที่ผู้ติดตาม — AI พูดให้ผู้สมัครโทรกลับ (เจ้าของสั่ง 13 ส.ค. 2569)
   *
   * 18 ส.ค. 2569 (ค่ำ-2) เจ้าของสั่งให้ **ระบุได้ทีละวัน**:
   * *"ต้องอยู่หน้ากรอกวันที่เวลา เพื่อจะได้ระบุเจ้าของแผนแต่ละวันได้"*
   * → เก็บแยกตามรอบ/ตามวัน ไม่ใช่ค่าเดียวทั้งชุด
   *   · โหมดเวลาเอง: `staffPhones[i]` คู่กับ `scheduledAts[i]`
   *   · โหมดตาราง: `staffPhoneByDay['YYYY-MM-DD']`
   * ⚠️ ไม่ต้องแตะ schema — แถวจริงเป็น **1 แถว/วัน (หรือ 1 แถว/รอบ)** อยู่แล้ว
   *   แต่ละแถวจึงถือ `staff_phone` ของตัวเองได้เลย
   */
  const [staffPhones, setStaffPhones] = useState<string[]>(() => ['']);
  const [staffPhoneByDay, setStaffPhoneByDay] = useState<Record<string, string>>({});
  /**
   * 🔴 **โหมดตารางใช้เบอร์เดียวทั้งชุดเป็นค่าตั้งต้น** (เจ้าของทัก 23 ก.ย. 2569:
   * *"ลงหลายวันแล้วรวน"*)
   *
   * ของเดิมกาง `StaffContactField` (ชื่อ+เบอร์+คำอธิบาย) **ทุกวัน** — วัดจริงบนจอ
   * 5 วัน = เนื้อหา 1,462px ในกรอบ 674px · 31 วัน = 5,135px (~7.6 จอ) ช่องซ้ำ 31 ชุด
   * ⇒ ตั้งตารางยาว ๆ แล้วเลื่อนหาปุ่มบันทึกไม่เจอ ซึ่งคือ "รวน" ที่เจอ
   *
   * ⚠️ คำสั่งเดิม 18 ส.ค. 2569 (*"ระบุเจ้าของแผนแต่ละวันได้"*) **ยังอยู่ครบ** —
   * ย้ายไปอยู่หลังสวิตช์ `perDayStaff` ไม่ได้ถอดทิ้ง · ปิดอยู่ = ทุกวันใช้ `staffPhoneAll`
   */
  const [staffPhoneAll, setStaffPhoneAll] = useState('');
  const [perDayStaff, setPerDayStaff] = useState(false);
  /** ให้โทรเมื่อไหร่ — หลายรอบได้ เพราะบางเคสต้องโทรมากกว่า 1 ครั้ง (เจ้าของสั่ง 10 ส.ค. 2569) */
  const [scheduledAts, setScheduledAts] = useState<string[]>(() => [nowForInput()]);
  /**
   * รอบนี้คือ **"สายที่เท่าไหร่"** (เจ้าของสั่ง 1 ก.ย. 2569:
   * *"เลือกวันเวลาเสร็จของรอบแรก ก็มี Dropdown ให้เลือกเลยว่านี่คือ สาย 1 2 3"*)
   *
   * 🔴 **อาร์เรย์นี้ต้องขยับคู่กับ `scheduledAts` เสมอ** (กับดักเดียวกับอาร์เรย์เบอร์)
   * หลุดคู่เมื่อไหร่ = รอบที่ 2 ไปใช้บทของรอบที่ 3 โดยไม่มีอะไรบนจอบอก
   * ค่านี้ถูกส่งขึ้นไปจริง (`call_round`) และเป็นตัวตัดสินว่า AI พูดบทไหน
   */
  const [callRounds, setCallRounds] = useState<number[]>(() => [1]);
  /**
   * ใครโทรรอบนี้ — โหมด "ระบุเวลาเอง" (เจ้าของสั่ง 2 ต.ค. 2569: *"เพิ่มปุ่มเลือก คนโทร / AI โทร ในระบุเวลาเอง"*)
   * 🔴 ขยับคู่กับ `scheduledAts` เสมอ (กับดักเดียวกับอาร์เรย์เบอร์/เลขสาย) · ค่าเริ่ม = AI โทร (พฤติกรรมเดิม)
   */
  const [callModes, setCallModes] = useState<Array<'ai' | 'manual' | 'tbd'>>(() => ['ai']);
  /**
   * บันทึกเสร็จแล้ว = ป๊อปเปลี่ยนเป็นหน้า "เสร็จสิ้น" (เจ้าของสั่ง 2 ต.ค. 2569: *"บันทึกแล้วไม่เด้งเสร็จสิ้น"*)
   * 🔴 เดิมปิดป๊อปทันทีแล้วบอกผลที่แถบบนหน้า (เลื่อนจอแล้วมองไม่เห็น) · ถ้ามีสายที่ไม่ได้ส่ง AI
   *    ข้อความไปลงช่อง error **ในป๊อปที่ปิดไปแล้ว** = ไม่มีใครเห็นเลย
   */
  /** มาจากหน้าอื่นด้วยลิงก์ตั้งรอบโทร — ปุ่ม "กลับหน้า…" ในฟอร์มและหน้าเสร็จสิ้น (null = เปิดเองจากหน้านี้) */
  const [returnTo, setReturnTo] = useState<{ path: string; label: string } | null>(null);
  const [doneInfo, setDoneInfo] = useState<{
    lines: string[];
    warn: string | null;
    firstDay: string | null;
    /** วันที่บันทึกไม่สำเร็จ — กดลองใหม่เฉพาะชุดนี้ (ตารางหลายวันล้มกลางทาง · 3 ต.ค. 2569) */
    retry?: { label: string; run: () => Promise<void> };
  } | null>(null);
  /** ความคืบของการบันทึกตารางหลายวัน เช่น "วันที่ 2/5" — ชุดใหญ่ใช้เวลานาน จอต้องบอกว่าไม่ได้ค้าง */
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);
  /**
   * โหมดตารางโทร (16 ส.ค. · migration 092): ช่วงวัน × รอบเวลา/วัน
   * เช่น 1-7 ส.ค. วันละ 2 รอบ 07:00/08:00 → **หนึ่งสาย = หนึ่งแถว** ผูก group เดียว (1 ต.ค. 2569 · เดิม 1 แถว/วัน)
   * ⚠️ ของจริง Lumos โทรครบทุกสายในแผน แม้รอบก่อนรับสายยืนยันแล้ว (วัด 1 ต.ค.: 51 จาก 51) — ที่เคยเขียนว่า
   *    "ยืนยันแล้ววันนั้นหยุด (stop_early)" ไม่ตรงของจริง · หยุดก่อนได้ทางเดียวคือตอบว่าไม่ไป/กดยกเลิก
   */
  const [scheduleMode, setScheduleMode] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [roundTimes, setRoundTimes] = useState<string[]>(() => ['07:00']);
  /**
   * วันที่ **จะส่งให้ Lumos จริง** (เจ้าของสั่ง 17 ส.ค. 2569: *"ลงหน้า Follow ตั้งแต่ 1-7 วัน
   * แต่เลือกได้ว่าจะส่งให้ lumos วันไหนบ้าง"*)
   *
   * เดิมช่วงวันคือ "ส่งทุกวันในช่วง" ไม่มีทางข้ามวัน — เสาร์อาทิตย์/วันหยุดก็ยิงหมด
   * ตอนนี้ช่วงวันเป็นแค่ **ตัวกางปฏิทิน** ส่วนวันที่ติ๊กไว้เท่านั้นที่กลายเป็นสายจริง
   * ⚠️ ติ๊กไม่ครบ = ไม่ใช่ error — ตั้งใจข้ามวันได้
   *
   * 23 ก.ย. 2569 จอเคยเหลือแค่ AI โทร/คนโทร (เจ้าของสั่ง: *"ทำเป็น Checkbox เลือกว่า Ai โทรหรือคนโทร"*)
   * 🔴 **1 ต.ค. 2569 เจ้าของสั่งเติม "ไม่โทร" กลับ** (Choice "ข้ามวันไม่ได้ → แก้") — ช่องที่สามต่อวัน
   *    ติ๊กแล้ววันนั้นไม่มีสาย (ข้ามเสาร์-อาทิตย์/วันหยุดได้โดยไม่ต้องย่นช่วงวัน)
   */
  const [skippedDays, setSkippedDays] = useState<Set<string>>(() => new Set());
  /**
   * วันที่ **เจ้าหน้าที่จะโทรเอง** (121 · เจ้าของสั่ง 20 ก.ย. 2569:
   * *"วันที่ 1-3 กำหนดเองอะนะว่าจะโทรเองหรือส่ง lumos โทร"*)
   *
   * ⚠️ เป็นคนละชุดกับ `skippedDays` โดยตั้งใจ — สามสถานะต่อวัน:
   * อยู่ใน `skippedDays` = **ไม่โทรเลย** · อยู่ใน `manualDays` = **คนโทรเอง**
   * ไม่อยู่ที่ไหนเลย = **ส่งให้ AI** (ค่าเดิม ⇒ ของเก่าไม่เปลี่ยนพฤติกรรม)
   */
  const [manualDays, setManualDays] = useState<Set<string>>(() => new Set());
  /**
   * 🔴 **ตั้งเวลารายวัน** (เจ้าของ Choice 1 ต.ค. 2569 "ทุกวันต้องใช้เวลาเดียวกัน → แก้")
   * ปิดอยู่ = ทุกวันใช้ `roundTimes` เหมือนเดิม · เปิด = แต่ละวันมีเวลาของตัวเอง (`roundTimesByDay`)
   * เปิดครั้งแรกลอกเวลาชุดเดียวลงทุกวันให้ก่อน แล้วค่อยแก้เฉพาะวันที่ต่าง (แพตเทิร์นเดียวกับเบอร์รายวัน)
   */
  const [perDayTimes, setPerDayTimes] = useState(false);
  const [roundTimesByDay, setRoundTimesByDay] = useState<Record<string, string[]>>({});
  /**
   * หน่วยงานที่ตามเรื่องให้ + รหัสไซต์ (096) — เลือกจากใบขอแล้วเติมให้ทั้งคู่
   * (เจ้าของสั่ง: *"เพิ่มชื่อหน่วยงาน โดยเลือกจากใบงานได้เลย · Code site ถ้าเลือกหน่วยงานก็ให้ขึ้นมาเลย"*)
   */
  const [unitName, setUnitName] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [openJobs, setOpenJobs] = useState<JobRequest[]>([]);
  /** รายการที่กำลังแก้ไข (096) — null = ไม่ได้เปิดกล่องแก้ */
  const [editing, setEditing] = useState<FollowEntry | null>(null);
  /**
   * bump เมื่อ dialog จัดการ (ข้างไอคอนปฏิทิน) เพิ่มค่าใหม่ — dropdown ที่ mount อยู่
   * โหลดลิสต์ใหม่ทันที ไม่ต้องรีเฟรชหน้า (เรื่อง กับ เจ้าหน้าที่ แยกตัวนับกัน)
   */
  const [topicsRev, setTopicsRev] = useState(0);
  /** รีเฟรชแท็บ Dashboard = เปิดแผงใหม่ (ปุ่มรีเฟรชอยู่แถวแท็บ · 4 ต.ค. 2569) */
  const [dashRev, setDashRev] = useState(0);
  const [contactsRev, setContactsRev] = useState(0);
  /** dialog จัดการเรื่อง / เจ้าหน้าที่ — เปิดจากปุ่มข้างปฏิทิน (supervisor+ เท่านั้น) */
  const [topicManagerOpen, setTopicManagerOpen] = useState(false);
  const [staffManagerOpen, setStaffManagerOpen] = useState(false);
  const { user } = useAuth();
  const adderKey = adderFilter === 'all' ? '' : adderFilter === 'me' ? (user?.email ?? '') : adderFilter;
  const navigate = useNavigate();
  /** เพิ่มเรื่อง/เจ้าหน้าที่ได้เฉพาะ supervisor ขึ้นไป (เจ้าของสั่ง ค่ำ-5) */
  const canManageMasters = user?.role === 'supervisor' || user?.role === 'admin';
  /** ลบทิ้งจริงได้เฉพาะ admin — ตอนนี้เปิดไว้ให้เจ้าของล้างข้อมูลช่วงทดลอง */
  const canPurge = user?.role === 'admin';
  /** ตั้งเบอร์ที่หน้าผู้ใช้งานได้ไหม — `/api/app-users` เปิดให้ admin เท่านั้น */
  const canEditUsers = user?.role === 'admin';
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  /** เวลาที่ดึงรายการสำเร็จล่าสุด — `null` = ยังไม่เคยโหลดจบ */
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * เลือกชื่อจากบอร์ด ERP (F5b · 16 ส.ค. 2569) — เดิมต้องคีย์ชื่อ+เบอร์เอง พิมพ์ผิด = โทรผิดคน
   * เลือกแล้วเติมช่องชื่อ/เบอร์ให้ · ช่อง "เรื่องที่จะให้โทร" ยังต้องพิมพ์เอง (คนละเรื่องกันทุกครั้ง)
   */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedFrom, setPickedFrom] = useState<string | null>(null);
  /** ตัวเลือกหน่วยงานจากบอร์ด (18 ส.ค. 2569) — คู่แฝดของ picker ชื่อคน */
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  /**
   * ฟอร์มเพิ่มเป็น 3 ขั้น (เจ้าของสั่ง 18 ส.ค. 2569) — คน → หน่วยงาน → เวลา
   * ด่านตรวจอยู่ที่ `followWizard.ts` ที่เดียว ทั้งปุ่มถัดไปและตอนกดบันทึก
   */
  const [step, setStep] = useState<FollowWizardStep>(1);
  /**
   * เวลาที่เพิ่งเข้าขั้นตั้งเวลา — กันคลิกเร็วซ้อน: กด "ถัดไป" แล้วปุ่ม "บันทึก"
   * มาเรนเดอร์แถวเดียวกันทันที คลิกที่สองของคนกดเร็วตกลงบนบันทึกพอดี (โดนจริง 18 ส.ค.)
   */
  const step3EnteredAtRef = useRef(0);
  /**
   * popup เตือนลงซ้ำ (เจ้าของสั่ง 18 ส.ค. 2569) — เก็บทั้งกองซ้ำและกองที่ไม่ซ้ำ
   * `null` = ไม่มีเตือนค้าง · ตรรกะเทียบอยู่ที่ `followDuplicateGuard.ts` (pure + เทสต์)
   */
  const [dupWarning, setDupWarning] = useState<{
    duplicates: DuplicateRound[];
    freshIso: string[];
    /** โหมดตาราง: ยิงตามชุดวันเดิม · โหมดเวลา: ยิงตาม freshIso */
    proceed: () => Promise<void>;
  } | null>(null);

  /**
   * หน่วยงานทั้งชุดตั้งแต่ปี 2567 (~1,054) — เจ้าของแจ้ง 18 ส.ค. 2569 ว่ากล่องเลือก
   * "ขึ้นไม่ครบ" เพราะเดิมยุบจากใบขอที่ยังเปิดเท่านั้น (152)
   * โหลดพัง = [] แล้ว merge จะเหลือชุดใบขอเปิดเหมือนเดิม (ห้ามบล็อกงาน)
   */
  const [allUnits, setAllUnits] = useState<BoardUnitOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetchAllUnitOptions()
      .then((v) => {
        if (!cancelled) setAllUnits(v);
      })
      .catch(() => {
        if (!cancelled) setAllUnits([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** ใบขอที่ยังเปิด — ใช้เป็นตัวเลือกหน่วยงาน · โหลดไม่ได้ = พิมพ์ชื่อเองได้เหมือนเดิม */
  useEffect(() => {
    let cancelled = false;
    void fetchSiamrajUnitRequests(500)
      .then((v) => {
        if (!cancelled) setOpenJobs(v);
      })
      .catch(() => {
        if (!cancelled) setOpenJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * ค่าที่ส่งมาจากปุ่ม "ลงแผนแจ้งเข้า" ในหน้าคัดสรร (ข้อ 7) — กรอกชื่อ/เบอร์/เรื่องให้เลย
   * เหลือแค่เลือกวัน–เวลา · อ่านครั้งเดียวตอนเข้าหน้า แล้วล้าง query ทิ้ง
   * (ไม่ล้าง = กดรีเฟรชแล้วฟอร์มเด้งเปิดใหม่ทุกครั้ง)
   */
  const [searchParams, setSearchParams] = useSearchParams();
  /**
   * แท็บของหน้า — รายชื่อติดตาม (ค่าตั้งต้น) · **ติดตามส่งคนแทน** (`?view=replace` · เจ้าของสั่ง 1 ต.ค. 2569) · Dashboard
   * 🔴 สองแท็บแรก **เหมือนกันทุกอย่าง** (*"ทำงานเหมือนกันแค่คนละทีม"*) — แยกกองด้วยทีม `follow_team` (`lib/followReplacement`)
   */
  const viewParam = searchParams.get('view');
  const followView: 'list' | 'replace' | 'dashboard' =
    viewParam === 'dashboard' ? 'dashboard' : viewParam === 'replace' ? 'replace' : 'list';
  const setFollowView = (next: 'list' | 'replace' | 'dashboard') => {
    const params = new URLSearchParams(searchParams);
    if (next === 'list') params.delete('view');
    else params.set('view', next);
    setSearchParams(params);
  };
  const replaceView = followView === 'replace';
  /** ทีมที่บันทึกตอนกดเพิ่มจากแท็บนี้ — รายชื่อติดตามไม่ส่งคีย์ (เหมือนเดิมทุกตัวอักษร) */
  const followTeam = followTeamForScope(replaceView ? 'replacement' : 'main');
  /**
   * สลับแท็บรายชื่อติดตาม ↔ ติดตามส่งคนแทน = ตัวกรองกลับค่าเริ่มต้น (ทุกสาย · กำลังตาม)
   * 🔴 กันตัวกรองค้างที่มองไม่เห็น — แท็บที่ยังไม่มีสายหุบหัวการ์ด "ดูเฉพาะ" ทิ้ง แต่ค่าที่เลือกไว้จากอีกแท็บยังกรองอยู่
   *    (ตรวจในเบราว์เซอร์ 1 ต.ค. 2569: เลือกรอบโทรที่ 1 แล้วสลับแท็บ ⇒ ปฏิทินบอก "ไม่มีสายในรอบโทรที่ 1" ทั้งที่ไม่มีที่ให้กดคืน)
   */
  const [filterScope, setFilterScope] = useState(replaceView);
  if (filterScope !== replaceView) {
    setFilterScope(replaceView);
    setActiveRound('all');
    setResultBox(null);
    setCaller('all');
    // เจ้าของงาน: "ของฉัน" ติดข้ามแท็บได้ (ความหมายเดิม) · เลือกอีเมลคนอื่นไว้ = กลับทุกคน (อีกแท็บอาจไม่มีชื่อนั้น)
    if (adderFilter !== 'me') setAdderFilter('all');
  }
  useEffect(() => {
    const prefill = readFollowPrefill(searchParams);
    if (!hasFollowPrefill(prefill)) return;
    if (prefill.name) {
      const { prefix: pre, first, last } = splitPrefillName(prefill.name);
      setPrefix(pre);
      setFirstName(first);
      setLastName(last);
    }
    if (prefill.phone) setPhone(prefill.phone);
    if (prefill.topic) setTopic(prefill.topic);
    // หน่วยงานที่เลือกไว้แล้วตอนตั้งขั้น (Phase 6.6/6.9) — เติมให้ ไม่ต้องเลือกซ้ำ
    // ⚠️ เติมแค่ชื่อ · รหัสไซต์ให้คนยืนยันจาก picker เอง (ชื่ออาจซ้ำข้ามไซต์)
    if (prefill.unitName) setUnitName(prefill.unitName);
    // ทางกลับหน้าเดิม (4 ต.ค. 2569 "ต้องมีทางเข้า และทางเอากลับ")
    setReturnTo(prefill.back ? { path: prefill.back, label: prefill.backLabel || 'หน้าเดิม' } : null);
    setPickedFrom(prefill.backLabel ? `มาจากหน้า${prefill.backLabel} — เหลือเลือกวันและเวลา` : 'มาจากหน้าคัดสรร — เหลือเลือกวันและเวลา');
    setFormOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);
  const pickPerson = (p: BoardPickerPerson) => {
    const { prefix: pre, first, last } = splitPickerName(p);
    setPrefix(pre);
    setFirstName(first);
    setLastName(last);
    setPhone((p.mobile || '').trim());
    setPickedFrom(p.column_label ? `เลือกจากบอร์ด · ถัง ${p.column_label}` : 'เลือกจากบอร์ด');
    setPickerOpen(false);
    setFormError(null);
  };

  /** เลือกหน่วยงานจากบอร์ด — เติมทั้งชื่อและรหัสไซต์ (เหมือน dropdown เดิมทุกอย่าง) */
  const pickUnit = (u: BoardUnitOption) => {
    setUnitName(u.unitName);
    setSiteCode(u.siteCode);
    setUnitPickerOpen(false);
    setFormError(null);
  };

  /**
   * @param silent `true` = รีเฟรชเบื้องหลัง **ห้ามขึ้นสถานะกำลังโหลด**
   * (ไม่งั้นทุก 25 วิ จอจะกะพริบเป็นโครงกระดูกทั้งที่คนกำลังอ่านอยู่)
   */
  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setItems(await listFollowEntries());
      // จดเวลาที่ **ดึงสำเร็จ** — ท้ายตารางเอาไปบอกคนว่าหน้าไม่ได้ค้าง (12 ก.ย. 2569)
      setLastLoadedAt(new Date());
      // 🔴 สำเร็จเมื่อไหร่ (รวมรอบเงียบ) ล้างแถบล้มทิ้ง — QA 5 ต.ค. 2569: แถบ "Failed to fetch" ค้างทั้งที่เลขกลับมาแล้ว
      setError(null);
    } catch (e) {
      // รีเฟรชเงียบล้ม = เงียบต่อ ของบนจอยังเป็นของเดิมที่ยังใช้ได้
      if (!silent) setError(friendlyErrorText(e, 'โหลดรายชื่อติดตามไม่ได้'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * ═══ 🔴 ผลโทรต้องขึ้นเองโดยไม่ต้องกดรีเฟรช (เจ้าของแจ้ง 5 ก.ย. 2569:
   * *"หน้าการติดตาม ข้อมูลมันมาช้า เวลาได้รับผลโทรมา มันดีเลย์มาก"*) ═══
   *
   * ต้นเหตุ: หน้านี้โหลดข้อมูล **ครั้งเดียวตอนเปิด** แล้วโหลดใหม่เฉพาะตอนที่คนกดทำอะไร
   * ⇒ AI โทรจบแล้วบันทึกผลลงฐาน แต่คนที่เปิดจอค้างไว้ไม่เห็นอะไรเลยจนกว่าจะกดรีเฟรชเอง
   *
   * กติกาของการรีเฟรชอัตโนมัติ:
   * 1. **เฉพาะตอนแท็บนี้เปิดอยู่จริง** — อยู่แท็บอื่นไม่ต้องยิง (เปลืองทั้งเครื่องและ ERP)
   * 2. **กลับมาที่แท็บ = รีเฟรชทันที** ไม่ต้องรอครบรอบ (คนสลับกลับมาเพื่อดูผลพอดี)
   * 3. 🔴 **กำลังพิมพ์อยู่ = ข้ามรอบนั้น** ห้ามแย่งของที่คนกำลังกรอก
   * 4. เงียบเสมอ — ไม่ขึ้นโครงกระดูก ไม่เด้ง error (ดู `silent` ข้างบน)
   */
  useEffect(() => {
    const REFRESH_MS = 25_000;
    const typing = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    };
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      if (typing()) return;
      void reload(true);
    };
    const id = window.setInterval(tick, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  const resetForm = () => {
    setPrefix('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setTopic('');
    setNote('');
    setStaffPhones(['']);
    setStaffPhoneByDay({});
    setStaffPhoneAll('');
    setPerDayStaff(false);
    setPickedFrom(null);
    setScheduledAts([nowForInput()]);
    setCallRounds([1]);
    setCallModes(['ai']);
    setDateFrom('');
    setDateTo('');
    setRoundTimes(['07:00']);
    setSkippedDays(new Set());
    setManualDays(new Set());
    setPerDayTimes(false);
    setRoundTimesByDay({});
    setUnitName('');
    setSiteCode('');
    setFormError(null);
    setStep(1);
  };

  const setScheduledAtAt = (i: number, v: string) =>
    setScheduledAts((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  /**
   * เพิ่ม/ลบรอบต้องขยับ **อาร์เรย์เบอร์ให้คู่กันเสมอ** — หลุดคู่เมื่อไหร่ เบอร์เลื่อนไปอยู่ผิดรอบ
   * (รอบที่ 2 ได้เบอร์ของรอบที่ 3) ซึ่งไม่มีอะไรบนจอบอก จนกว่าสายจะออกไปแล้ว
   * รอบใหม่ลอกเบอร์ของรอบสุดท้ายมาเป็นค่าตั้งต้น — ปกติทั้งชุดเป็นเจ้าของคนเดียวกัน
   */
  const addScheduledAt = () => {
    setScheduledAts((prev) => [...prev, nowForInput()]);
    setStaffPhones((prev) => [...prev, prev[prev.length - 1] ?? '']);
    // รอบใหม่เดาให้ว่าเป็นสายถัดไป — เปลี่ยนเองได้จาก dropdown
    setCallRounds((prev) => [...prev, (prev[prev.length - 1] ?? prev.length) + 1]);
    // ใครโทร: ลอกจากรอบสุดท้าย (ปกติทั้งชุดคนเดียวกันโทร)
    setCallModes((prev) => [...prev, prev[prev.length - 1] ?? 'ai']);
  };
  const removeScheduledAt = (i: number) => {
    setScheduledAts((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
    setStaffPhones((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
    setCallRounds((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
    setCallModes((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  };
  const setCallModeAt = (i: number, v: 'ai' | 'manual' | 'tbd') =>
    setCallModes((prev) => {
      const next = prev.length >= i + 1 ? [...prev] : [...prev, ...Array<'ai' | 'manual' | 'tbd'>(i + 1 - prev.length).fill('ai')];
      next[i] = v;
      return next;
    });
  const setCallRoundAt = (i: number, v: number) =>
    setCallRounds((prev) => {
      const next = prev.length >= i + 1 ? [...prev] : [...prev, ...Array(i + 1 - prev.length).fill(1)];
      next[i] = v;
      return next;
    });
  const setStaffPhoneAt = (i: number, v: string) =>
    setStaffPhones((prev) => {
      const next = prev.length >= i + 1 ? [...prev] : [...prev, ...Array(i + 1 - prev.length).fill('')];
      next[i] = v;
      return next;
    });

  const setRoundAt = (i: number, v: string) =>
    setRoundTimes((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  const addRound = () => setRoundTimes((prev) => (prev.length >= 5 ? prev : [...prev, '08:00']));
  const removeRound = (i: number) =>
    setRoundTimes((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  /** วันในช่วง [from, to] เป็น YYYY-MM-DD (สูงสุด 31 วัน) — คืน [] ถ้าช่วงผิด */
  const daysInRange = (from: string, to: string): string[] => {
    if (!from || !to) return [];
    const start = new Date(`${from}T00:00:00+07:00`);
    const end = new Date(`${to}T00:00:00+07:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
    const out: string[] = [];
    for (let d = new Date(start); d <= end && out.length < 31; d.setDate(d.getDate() + 1)) {
      out.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }));
    }
    return out;
  };

  /**
   * เบอร์เจ้าหน้าที่ของวันนั้นในโหมดตาราง — **ที่เดียวที่ตัดสิน** ว่าจะใช้เบอร์ชุดเดียว
   * หรือเบอร์รายวัน · จอสรุปกับตอนส่งจริงต้องอ่านจากฟังก์ชันนี้เหมือนกัน ไม่งั้น
   * สิ่งที่ทวนกับสิ่งที่ส่งจะคนละเบอร์
   */
  const staffPhoneForDay = (day: string): string =>
    scheduleDayStaffPhone(day, {
      perDay: perDayStaff,
      byDay: staffPhoneByDay,
      shared: staffPhoneAll,
    });
  /** วันนี้ใครโทร (AI · คนโทร · ไม่โทร) — ตัวเดียวที่ตัดสินทั้งจอและตอนส่ง */
  const modeOfScheduleDay = (day: string): ScheduleDayMode =>
    skippedDays.has(day) ? 'off' : manualDays.has(day) ? 'manual' : 'ai';
  /** เวลาของวันนั้น — ตัวเดียวที่ตัดสิน (สรุปบนจอกับตอนส่งอ่านจากที่นี่ ไม่งั้นทวนกับส่งคนละเวลา) */
  const timesOfScheduleDay = (day: string): string[] =>
    perDayTimes ? (roundTimesByDay[day] ?? roundTimes) : roundTimes;
  /** สายทั้งชุดของโหมดตาราง (หนึ่งสาย = หนึ่งแถว) — สรุปบนจอกับตอนส่งใช้ตัวเดียวกัน */
  const scheduleCalls = (): ScheduleCall[] =>
    buildScheduleCalls({
      days: daysInRange(dateFrom, dateTo),
      modeOfDay: modeOfScheduleDay,
      timesOfDay: timesOfScheduleDay,
      staffPhoneOfDay: staffPhoneForDay,
    });
  const setDayTimeAt = (day: string, i: number, v: string) =>
    setRoundTimesByDay((prev) => {
      const list = [...(prev[day] ?? roundTimes)];
      list[i] = v;
      return { ...prev, [day]: list };
    });
  const addDayTime = (day: string) =>
    setRoundTimesByDay((prev) => {
      const list = prev[day] ?? roundTimes;
      return list.length >= 5 ? prev : { ...prev, [day]: [...list, '08:00'] };
    });
  const removeDayTime = (day: string, i: number) =>
    setRoundTimesByDay((prev) => {
      const list = prev[day] ?? roundTimes;
      return list.length <= 1 ? prev : { ...prev, [day]: list.filter((_, idx) => idx !== i) };
    });

  /**
   * ตัวเลขสำหรับกล่อง "ทวนก่อนส่ง" — **ใช้สูตรเดียวกับตอนส่งจริง**
   * (วันที่ติ๊กไว้ × รอบเวลาที่อ่านออก) ไม่งั้นสิ่งที่ทวนกับสิ่งที่ส่งจะคนละเลข
   *
   * 🔴 **ต้องอยู่ใต้ `daysInRange`** — มันเป็น `const` ในคอมโพเนนต์ ไม่ใช่ฟังก์ชันที่ hoist
   * วางไว้ข้างบนแล้วจอขาวทั้งหน้า `Cannot access 'daysInRange' before initialization`
   * (พลาดมาแล้ว 13 ก.ย. 2569 — เทสต์ไม่จับเพราะไม่มีเทสต์ที่ render FollowPage ทั้งหน้า)
   */
  const sendDaysPreview = useMemo(
    () => daysInRange(dateFrom, dateTo).filter((d) => !skippedDays.has(d)).length,
    [dateFrom, dateTo, skippedDays],
  );
  /** จำนวนสายของโหมดตาราง — สูตรเดียวกับตอนส่ง (`scheduleCalls`) */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleCalls อ่านจาก state ชุดนี้ทั้งหมด
  const scheduleCallsPreview = useMemo(() => scheduleCalls().length, [dateFrom, dateTo, skippedDays, manualDays, roundTimes, perDayTimes, roundTimesByDay]);
  const scheduledAtsPreview = useMemo(
    () => scheduledAts.filter((t) => t.trim()).length,
    [scheduledAts],
  );
  /** รอบที่ตั้งให้คนโทร (โหมดระบุเวลาเอง · รวม "ยังไม่ชัวร์เวลา") — ทวนก่อนส่ง/ปุ่มบันทึกพูดตามจริง */
  const manualTimesPreview = useMemo(
    () => scheduledAts.filter((t, i) => t.trim() && (callModes[i] ?? 'ai') !== 'ai').length,
    [scheduledAts, callModes],
  );

  /**
   * หนึ่งเวลา = หนึ่งรายการ — API รับเวลาเดียวต่อรายการ และคิวโทรก็ผูกกับรายการ 1:1
   * จึงยิงทีละรอบ ไม่ใช่ยัดหลายเวลาลงรายการเดียว (แต่ละรอบมีสถานะ/ผลของตัวเอง ตามงานจริงได้)
   *
   * ⚠️ ยิงหลายรอบแล้วรอบท้าย ๆ ล้มได้ — ต้องบอกผู้ใช้ว่า **อะไรสำเร็จไปแล้ว**
   * ไม่งั้นเขากดซ้ำทั้งชุดแล้วได้รายการซ้อน (บทเรียนเดียวกับตอนสร้างชุดส่งจากหน้า Matching)
   */
  /** ค่าที่ตัวตรวจของ wizard ใช้ — ประกอบที่เดียว ปุ่มถัดไปกับตอนบันทึกจึงตรวจชุดเดียวกัน */
  const wizardValues = useMemo(
    () => ({
      firstName,
      phone,
      topic,
      scheduleMode,
      scheduledAts,
      scheduleDays: daysInRange(dateFrom, dateTo).filter((d) => !skippedDays.has(d)),
      roundTimes,
      timesByDay: perDayTimes
        ? Object.fromEntries(
            daysInRange(dateFrom, dateTo)
              .filter((d) => !skippedDays.has(d))
              .map((d) => [d, roundTimesByDay[d] ?? roundTimes]),
          )
        : null,
    }),
    [firstName, phone, topic, scheduleMode, scheduledAts, dateFrom, dateTo, skippedDays, roundTimes, perDayTimes, roundTimesByDay],
  );

  const stepError = followStepError(step, wizardValues);

  /**
   * เปลี่ยนขั้นผ่านตัวนี้เสมอ — จับเวลาเข้าขั้น 3 **ตอนคลิก ไม่ใช่หลัง render**
   * (useEffect ตั้งหลัง paint — คลิกซ้อนที่เร็วกว่าเฟรมแรกจะเห็น ref เป็นค่าเก่าแล้วหลุดด่าน)
   */
  const goToStep = (target: FollowWizardStep) => {
    if (target === 3 && step !== 3) step3EnteredAtRef.current = Date.now();
    setStep(target);
  };

  // backstop เผื่อมีทางเปลี่ยนขั้นที่ไม่ผ่าน goToStep
  useEffect(() => {
    if (step === 3 && step3EnteredAtRef.current === 0) step3EnteredAtRef.current = Date.now();
  }, [step]);

  /** กดถัดไป — ไม่ผ่านด่านของขั้นนี้ก็ไม่ให้ไป และบอกว่าติดตรงไหน */
  const goNext = () => {
    if (stepError) {
      setFormError(stepError);
      return;
    }
    setFormError(null);
    goToStep(nextFollowStep(step));
  };

  /** ยืนยันแล้วว่าเบอร์ผู้สมัครเท่ากับเบอร์เจ้าหน้าที่จริง (กดบันทึกซ้ำ) — ดู followPhoneGuard */
  const staffPhoneAckRef = useRef('');
  const submit = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    setFormError(null);
    /**
     * 🔴 **ยังไม่ถึงขั้นตั้งเวลา = ห้ามบันทึกเด็ดขาด** (เจ้าของแจ้ง 18 ส.ค. 2569:
     * *"พอเลือกหน่วยงานแล้วจะกดไปตั้งเวลามันบันทึกเองเลย"*)
     *
     * เหตุ: ฟอร์ม HTML ยิง submit เองเมื่อกด Enter ในช่องใด ๆ (รวมตอนเลือก dropdown
     * ด้วยคีย์บอร์ด) — และขั้น 3 **ผ่านด่านตั้งแต่ยังไม่แตะ** เพราะเวลาเริ่มต้นเป็น "ตอนนี้"
     * ด่าน `firstIncompleteStep` จึงไม่ช่วยเลย บันทึกทันทีตั้งแต่ยืนอยู่ขั้น 2
     * → ต้องกันด้วย "อยู่ขั้นไหน" ไม่ใช่ "ข้อมูลครบหรือยัง" · Enter กลายเป็นปุ่มถัดไปแทน
     */
    if (step !== 3) {
      const err = followStepError(step, wizardValues);
      if (err) setFormError(err);
      else goToStep(nextFollowStep(step));
      return;
    }
    /**
     * 🔴 เพิ่งเข้าขั้นตั้งเวลามาไม่ถึงช่วงกัน = คลิกซ้อนจากปุ่มถัดไป ไม่ใช่เจตนาบันทึก
     * กลืนเงียบ ๆ (เหมือนกดไม่ติด) — คนที่ตั้งใจจริงจะกดอีกครั้งหลังอ่านหน้าจอ
     */
    if (isSubmitTooSoonAfterStep3(step3EnteredAtRef.current, Date.now())) return;
    /**
     * 🔴 กันข้ามขั้น — ต่อให้กด Enter จากขั้นไหนก็ต้องผ่านทุกขั้นก่อนถึงจะยิงจริง
     * ไม่ผ่านตรงไหนให้เด้งกลับไป**ขั้นนั้น** ไม่ใช่ขึ้น error ลอย ๆ ที่คนหาไม่เจอ
     */
    const incomplete = firstIncompleteStep(wizardValues);
    if (incomplete) {
      setStep(incomplete);
      setFormError(followStepError(incomplete, wizardValues));
      return;
    }
    const recipientName = composeRecipientName(prefix, firstName, lastName);

    /**
     * 🔴 เบอร์ผู้สมัครตรงกับเบอร์เจ้าหน้าที่ (4 ต.ค. 2569 — เคยลง 10 สายแล้ว AI จะโทรหาเจ้าหน้าที่เอง)
     * เตือนครั้งแรก · กดบันทึกซ้ำโดยไม่แก้เบอร์ = ยืนยันว่าตั้งใจ
     */
    const usedStaffPhones = scheduleMode ? scheduleCalls().map((c) => c.staffPhone) : staffPhones;
    if (staffPhoneMatchesApplicant(phone, usedStaffPhones)) {
      const key = staffPhoneAckKey(phone, usedStaffPhones);
      if (staffPhoneAckRef.current !== key) {
        staffPhoneAckRef.current = key;
        setFormError(STAFF_PHONE_SAME_WARNING);
        return;
      }
    }

    /**
     * โหมดตาราง: ช่วงวัน × เวลา → **หนึ่งสาย = หนึ่งแถว** ผูก group เดียว (เจ้าของ Choice 1 ต.ค. 2569)
     * เวลารายวันได้ · วันที่ "ไม่โทร" ข้าม · เลขรอบนับต่อทั้งชุด (`buildScheduleCalls`) · ตอบไม่ไป = หยุดทั้งชุด (server)
     */
    if (scheduleMode) {
      if (daysInRange(dateFrom, dateTo).length === 0) {
        setFormError('เลือกช่วงวันให้ถูกต้อง (ไม่เกิน 31 วัน · วันเริ่มต้องไม่หลังวันจบ)');
        return;
      }
      const calls = scheduleCalls();
      if (calls.length === 0) {
        setFormError('ยังไม่มีสายให้โทร — เลือกวันที่จะโทร แล้วตั้งเวลาอย่างน้อย 1 สาย');
        return;
      }
      /** 🔴 เวลาที่ผ่านไปแล้วจับก่อนส่ง (QA 5 ต.ค. 2569: ค่าเริ่ม = วันนี้ 07:00 · เปิดตอนเย็นกดบันทึก ⇒ server ปฏิเสธวันแรกทีหลัง) */
      const pastCall = calls.find((c) => !c.timeTbd && new Date(c.scheduledAt).getTime() <= Date.now());
      if (pastCall) {
        setFormError(`${formatYmdDmyBe(pastCall.day)} ${pastCall.time} ผ่านมาแล้ว · เปลี่ยนเวลา หรือเริ่มวันพรุ่งนี้`);
        return;
      }
      const groupId = crypto.randomUUID();
      const dupCheck = findScheduleDuplicates(
        phone,
        calls.map((c) => c.scheduledAt),
        items,
      );
      const runSchedule = async (sendCalls: ScheduleCall[]) => {
        setSubmitting(true);
        let done = 0;
        // เก็บผล "ส่งให้ AI ได้ไหม" ของทุกรายการ แล้วสรุปทีเดียวตอนจบ
        const dispatchStates: Array<string | null> = [];
        /**
         * 🔴 **วันที่ล้มห้ามพาทั้งชุดล้ม** (3 ต.ค. 2569 — เจ้าของแจ้ง "บันทึกแล้วคาหน้าเดิม" +
         * "ลงแผนเป็นเดือนแล้วแผนหาย" · วัดจากฐานเช้า 3 ต.ค.: ชุด 5 วันของจริงหลุดเหลือ
         * วันแรกวันเดียว แล้วคนต้องมานั่งคีย์ 4 วันที่เหลือใหม่เองทั้งชุด)
         * เดิม throw วันไหน = วันหลังจากนั้นไม่ถูกสร้างเลย ⇒ เปลี่ยนเป็นทำต่อให้ครบ
         * แล้วรวบวันที่ล้มมาบอกพร้อมปุ่ม "ลองใหม่เฉพาะวันนั้น"
         */
        const failedDays: string[] = [];
        const failedCalls: ScheduleCall[] = [];
        let lastErr = '';
        const byDay = scheduleCallsByDay(sendCalls);
        try {
          /**
           * 🔴 ส่ง AI **แผนละวัน** — หนึ่งคำขอต่อวัน มีทุกสายของวันนั้น (รอบในวันเดียวกัน = แผนเดียว ตามคำสั่ง 11 ก.ย.)
           * ไม่รวมทั้งชุดเป็นแผนเดียว: แผนที่ Lumos รับจริงมาตลอดยาวสุดวันเดียว ≤ 2 สาย (วัด 1 ต.ค. 2569)
           * และแผนแยกของเบอร์เดียวกันไม่ทับกันแล้ว (หลัง 12 ก.ย.: 35 จาก 35 สายได้โทร)
           */
          for (const [dayIdx, { day, calls: dayCalls }] of byDay.entries()) {
            // ชุดใหญ่ยิงทีละวัน ใช้เวลาหลายวินาที — บอกความคืบ ไม่ใช่ปล่อยให้จออ่านว่าค้าง
            setSubmitProgress(`วันที่ ${dayIdx + 1}/${byDay.length}`);
            const first = dayCalls[0];
            try {
              const createdEntries = await createFollowRounds({
                recipient_name: recipientName,
                recipient_phone: phone,
                topic,
                follow_team: followTeam,
                note: note || undefined,
                // ค่าบนสุด = สายแรกของวัน (วันที่มีสายเดียว เส้น API อ่านจากตรงนี้)
                staff_phone: first.staffPhone || undefined,
                scheduled_at: first.scheduledAt,
                call_round: first.callRound,
                // วันที่เลือกว่า "คนโทร" → ไม่ส่งเข้าคิว AI (121) แต่ยังเป็นแถวจริงในระบบ
                call_mode: first.callMode,
                time_tbd: first.timeTbd || undefined,
                group_id: groupId,
                unit_name: unitName.trim() || undefined,
                site_code: siteCode.trim() || undefined,
                rounds: dayCalls.map((c) => ({
                  scheduled_at: c.scheduledAt,
                  staff_phone: c.staffPhone || undefined,
                  call_round: c.callRound,
                  call_mode: c.callMode,
                  time_tbd: c.timeTbd || undefined,
                })),
              });
              for (const createdEntry of createdEntries) {
                dispatchStates.push(createdEntry.dispatch_state ?? null);
                done += 1;
              }
            } catch (err) {
              lastErr = err instanceof Error ? err.message : 'ตั้งตารางไม่สำเร็จ';
              failedDays.push(day);
              failedCalls.push(...dayCalls);
            }
          }
          // ล้มทุกวัน = ไม่ใช่ "เสร็จสิ้น" — อยู่หน้าฟอร์มเดิมพร้อมเหตุผล ข้อมูลที่กรอกยังอยู่ครบ
          if (done === 0) {
            setFormError(lastErr || 'ตั้งตารางไม่สำเร็จ');
            // ถ้ามาจากปุ่ม "ลองใหม่" บนหน้าเสร็จสิ้น — ผลต้องขึ้นบนหน้านั้นด้วย ไม่ใช่เงียบ
            setDoneInfo((prev) => (prev ? { ...prev, warn: `ยังไม่สำเร็จ — ${lastErr || 'ตั้งตารางไม่สำเร็จ'}` } : prev));
            return;
          }
          resetForm();
          /* 🔴 บอกทันทีถ้ามีรายการที่ "ไม่ได้ส่งให้ AI" — เดิมขึ้นว่าสำเร็จอย่างเดียว
             คนนั่งรอสายที่ไม่มีวันออก (เกิดจริง 24 ส.ค. 2569) */
          const warn = summarizeDispatchResults(dispatchStates.filter((st) => st !== 'manual'));
          /* 🔴 ข้อความต้องแยกสองฝั่ง — พอมีวันที่คนโทรเองแล้ว "AI จะโทรเองทั้งหมด" กลายเป็นคำโกหก */
          const okCalls = sendCalls.filter((c) => !failedDays.includes(c.day));
          const dayCount = new Set(okCalls.map((c) => c.day)).size;
          const aiCalls = okCalls.filter((c) => c.callMode === 'ai').length;
          const manualCalls = okCalls.length - aiCalls;
          const lines = [`${recipientName} · ${dayCount} วัน รวม ${okCalls.length} สาย`];
          if (aiCalls > 0) lines.push(`AI โทร ${aiCalls} สาย`);
          if (manualCalls > 0) lines.push(`คนโทร ${manualCalls} สาย`);
          const warnParts = [
            failedDays.length > 0
              ? `บันทึกไม่สำเร็จ ${failedDays.length} วัน (${failedDays.map((d) => formatYmdDmyBe(d)).join(' · ')})${lastErr ? ` — ${lastErr}` : ''}`
              : null,
            warn?.text ?? null,
          ].filter(Boolean);
          setDoneInfo({
            lines,
            warn: warnParts.length > 0 ? warnParts.join(' · ') : null,
            firstDay: [...new Set(okCalls.map((c) => c.day))].sort()[0] ?? null,
            retry:
              failedCalls.length > 0
                ? {
                    label: `ลองใหม่เฉพาะวันที่ไม่สำเร็จ (${failedDays.length.toLocaleString('th-TH')} วัน)`,
                    run: () => runSchedule(failedCalls),
                  }
                : undefined,
          });
          await reload();
        } finally {
          setSubmitProgress(null);
          setSubmitting(false);
        }
      };
      if (dupCheck.duplicates.length > 0) {
        // สายที่ไม่ซ้ำ = เวลาที่อยู่ในกอง fresh (คีย์ระดับนาทีรูปเดียวกับ `scheduledAt`)
        const fresh = new Set(dupCheck.freshIso);
        setDupWarning({
          duplicates: dupCheck.duplicates,
          freshIso: dupCheck.freshIso,
          proceed: () => runSchedule(calls.filter((c) => fresh.has(c.scheduledAt))),
        });
        return;
      }
      await runSchedule(calls);
      return;
    }

    /**
     * 🔴 "ยังไม่ชัวร์เวลา" เก็บแค่วัน (YYYY-MM-DD) — สองสายวันเดียวกันได้ค่าเหมือนกันเป๊ะ ⇒ ตัวตัดเวลาซ้ำรวมเป็นสายเดียว
     * และเลขสายชนกัน (เจ้าของเจอ 5 ต.ค. 2569: *"ขึ้นสายโทรครั้งที่ 1 ทั้ง2สายเลย ทั้งที่ตอนเพิ่มเลือก สาย1 สาย2"*)
     * ⇒ ให้แต่ละสายมีเวลาแทนของตัวเอง (เที่ยงคืน + ลำดับช่องเป็นนาที) — จอโชว์ "ยังไม่ระบุเวลา" อยู่แล้ว (ธง time_tbd)
     */
    const effectiveAts = tbdPlaceholderAts(scheduledAts, callModes);
    // เรียงเวลาจากก่อนไปหลัง + ตัดเวลาซ้ำทิ้ง (กดเพิ่มแล้วลืมแก้ = ได้สองสายเวลาเดียวกัน)
    const times = [...new Set(effectiveAts.filter(Boolean))].sort();
    /** ค่าวันล้วนของ "ยังไม่ชัวร์เวลา" (YYYY-MM-DD) → เที่ยงคืนไทย (ห้ามให้ new Date ตีเป็น UTC) */
    const localToDate = (t: string) => (/^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00+07:00`) : new Date(t));
    if (times.length === 0) {
      setFormError('กรุณาระบุเวลาที่ให้โทรอย่างน้อย 1 สาย');
      return;
    }

    /**
     * 🔴 เตือนลงซ้ำก่อนยิง (เจ้าของสั่ง 18 ส.ค. 2569: *"นายคนนี้ลงวันเวลาเดิม
     * ก็เด้งเตือนเลยว่าซ้ำ"*) — เบอร์เดิม+เวลาเดิม (ระดับนาที) กับรายการที่ยังไม่ยกเลิก
     */
    const isoTimes = times.map((t) => localToDate(t).toISOString());
    /**
     * 🔴 แมป **เวลา → เบอร์** ก่อนใช้ — `times` ถูก dedup + sort แล้ว index จึง**ไม่ตรง**
     * กับ `scheduledAts`/`staffPhones` อีก ใช้ index ตรง ๆ = เบอร์ไปโผล่ผิดรอบเงียบ ๆ
     * เวลาซ้ำกันเก็บเบอร์ของช่องแรกที่เจอ (ช่องที่ซ้ำถูกตัดทิ้งอยู่แล้ว)
     */
    const phoneByLocal = new Map<string, string>();
    effectiveAts.forEach((v, i) => {
      if (v && !phoneByLocal.has(v)) phoneByLocal.set(v, (staffPhones[i] || '').trim());
    });
    const phoneByIso = new Map<string, string>();
    times.forEach((t, i) => phoneByIso.set(isoTimes[i], phoneByLocal.get(t) ?? ''));
    /**
     * 🔴 แมป **เวลา → สายที่เท่าไหร่** ด้วยวิธีเดียวกับเบอร์ — ห้ามใช้ index ของ `times`
     * เพราะถูก dedup + sort มาแล้ว (ใช้ index ตรง ๆ = บทไปโผล่ผิดรอบเงียบ ๆ)
     */
    const roundByLocal = new Map<string, number>();
    effectiveAts.forEach((v, i) => {
      if (v && !roundByLocal.has(v)) roundByLocal.set(v, callRounds[i] ?? i + 1);
    });
    const roundByIso = new Map<string, number>();
    times.forEach((t, i) => roundByIso.set(isoTimes[i], roundByLocal.get(t) ?? 1));
    /** แมป **เวลา → ใครโทร** แบบเดียวกับเบอร์/เลขสาย (ห้ามใช้ index ของ `times`) */
    const modeByLocal = new Map<string, 'ai' | 'manual' | 'tbd'>();
    effectiveAts.forEach((v, i) => {
      if (v && !modeByLocal.has(v)) modeByLocal.set(v, callModes[i] ?? 'ai');
    });
    const modeByIso = new Map<string, 'ai' | 'manual' | 'tbd'>();
    times.forEach((t, i) => modeByIso.set(isoTimes[i], modeByLocal.get(t) ?? 'ai'));
    /** ยังไม่ชัวร์เวลา = คนโทร + ติดธง time_tbd (เวลาในแถวเป็นค่าแทน — จอโชว์ "ยังไม่ระบุเวลา") */
    const sendModeOf = (t: string): 'ai' | 'manual' => (modeByIso.get(t) === 'ai' ? 'ai' : 'manual');
    const dupCheck = findScheduleDuplicates(phone, isoTimes, items);
    /**
     * 🔴 **ทุกรอบของคนเดียวกันต้องอยู่ `group_id` เดียวกัน** (21 ก.ย. 2569)
     *
     * เส้นนี้เคย **ไม่ส่ง `group_id` เลย** ⇒ แถวทั้งหมดที่คนใช้สร้างจริงได้ค่า `null`
     * (วัดจากฐาน 21 ก.ย.: 287 จาก 295 แถวของ 14 วันล่าสุดไม่มี `group_id`)
     *
     * ผลต่อเนื่อง: `applyCallFollowupToQueueRow` ใช้ `group_id` เป็นตัวบอกว่า
     * "แถวนี้เป็นสายตั้งตาราง ห้ามโทรซ้ำนอกตาราง" พอเป็น null มันจึงเห็นเป็นสายเดี่ยว
     * แล้วตั้ง retry เอง ⇒ แถวถูกดีดกลับเป็น `pending` โดยไม่มีใครดันแผนใหม่ไป Lumos
     * = สายที่ระบบสัญญาว่าจะโทรซ้ำแต่ไม่มีวันโทร (ค้างจริง 46 แถวตอนที่เจอ)
     */
    const groupId = crypto.randomUUID();
    const runTimes = async (sendIso: string[]) => {
      setSubmitting(true);
      let done = 0;
      const dispatchStates: Array<string | null> = [];
      try {
        /**
         * 🔴 **ยิงครั้งเดียวทุกรอบ** (เจ้าของสั่ง 11 ก.ย. 2569) — เดิมวนยิงทีละรอบ
         * ฝั่งเราเลยสร้าง **แผนแยกกันรอบละแผน** ไปที่เบอร์เดียวกัน แผนหลังทับแผนแรก
         * สายแรกจึงไม่ได้โทรและไม่มีผลกลับ (วัดจริง: สายที่นัดก่อนได้ผล 1 จาก 16)
         * ⚠️ ห้ามกลับไปวน `for` ยิงทีละรอบเด็ดขาด
         */
        const createdEntries = await createFollowRounds({
          recipient_name: recipientName,
          recipient_phone: phone,
          topic,
          follow_team: followTeam,
          note: note || undefined,
          staff_phone: phoneByIso.get(sendIso[0]) || undefined,
          scheduled_at: sendIso[0],
          call_round: roundByIso.get(sendIso[0]) ?? 1,
          // ใครโทร (121) — ค่าบนสุด = ของสายแรก (สายเดียวเส้น API อ่านจากตรงนี้) · หลายสายอ่านจาก rounds[]
          call_mode: sendModeOf(sendIso[0]),
          time_tbd: modeByIso.get(sendIso[0]) === 'tbd' || undefined,
          group_id: groupId,
          unit_name: unitName.trim() || undefined,
          site_code: siteCode.trim() || undefined,
          rounds: sendIso.map((t) => ({
            scheduled_at: t,
            staff_phone: phoneByIso.get(t) || undefined,
            call_round: roundByIso.get(t) ?? 1,
            call_mode: sendModeOf(t),
            time_tbd: modeByIso.get(t) === 'tbd' || undefined,
          })),
        });
        for (const createdEntry of createdEntries) {
          dispatchStates.push(createdEntry.dispatch_state ?? null);
          done += 1;
        }
        resetForm();
        // สายที่ตั้งให้คนโทร = ตั้งใจไม่ส่ง AI ⇒ ไม่นับเป็นปัญหา
        const warn = summarizeDispatchResults(dispatchStates.filter((st) => st !== 'manual'));
        const aiCalls = sendIso.filter((t) => modeByIso.get(t) === 'ai' || !modeByIso.get(t)).length;
        const tbdCalls = sendIso.filter((t) => modeByIso.get(t) === 'tbd').length;
        const manualCalls = sendIso.length - aiCalls - tbdCalls;
        const lines = [`${recipientName} · ${sendIso.length} สาย`];
        if (aiCalls > 0) lines.push(`AI โทร ${aiCalls} สาย`);
        if (manualCalls > 0) lines.push(`คนโทร ${manualCalls} สาย`);
        if (tbdCalls > 0) lines.push(`ยังไม่ระบุเวลา ${tbdCalls} สาย — เติมเวลาได้ที่ปุ่มแก้ไขบนแถว`);
        setDoneInfo({ lines, warn: warn?.text ?? null, firstDay: sendIso.map((t) => toYmdBangkok(new Date(t))).sort()[0] ?? null });
        await reload();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'เพิ่มรายชื่อไม่สำเร็จ';
        setFormError(
          done > 0
            ? `${msg} — แต่บันทึกไปแล้ว ${done} จาก ${sendIso.length} สาย กรุณาเพิ่มเฉพาะสายที่ยังขาด อย่ากดซ้ำทั้งชุด`
            : msg,
        );
        if (done > 0) await reload();
      } finally {
        setSubmitting(false);
      }
    };
    if (dupCheck.duplicates.length > 0) {
      setDupWarning({
        duplicates: dupCheck.duplicates,
        freshIso: dupCheck.freshIso,
        proceed: () => runTimes(dupCheck.freshIso),
      });
      return;
    }
    await runTimes(isoTimes);
  };

  const doCancel = async (id: string) => {
    setBusyId(id);
    try {
      await cancelFollowEntry(id);
      setCancellingId(null);
      await reload();
    } catch (err) {
      toast.error(friendlyErrorText(err, 'ยกเลิกไม่สำเร็จ'));
    } finally {
      setBusyId(null);
    }
  };

  /**
   * ลบทิ้งจริง — **admin เท่านั้น** (เจ้าของสั่ง 3 ก.ย. 2569: *"ทำให้ฉันลบได้หน่อย
   * เฉพาะฉันนะ เพราะตอนนี้ทดสอบอยู่"*) · server เป็นด่านตัดสินอีกชั้น
   *
   * ⚠️ ปิดป๊อปหลังลบเสมอ — รอบที่เพิ่งลบหายไปจากข้อมูลแล้ว ถ้าเปิดค้างไว้
   * ป๊อปจะโชว์รอบที่ไม่มีอยู่จริง
   */
  const doPurge = async (id: string) => {
    setBusyId(id);
    try {
      const { queueRowsDeleted } = await purgeFollowEntry(id);
      setPurgingId(null);
      setOpenCell(null);
      await reload();
      toast.success(
        queueRowsDeleted > 0
          ? `ลบแล้ว · ยกสายที่จ่อโทรออกจากคิวไป ${queueRowsDeleted} สาย`
          : 'ลบแล้ว',
      );
    } catch (err) {
      toast.error(friendlyErrorText(err, 'ลบไม่สำเร็จ'));
    } finally {
      setBusyId(null);
    }
  };

  /**
   * ปิดงาน (095) — บันทึกว่าจบแบบไหน แล้วโหลดใหม่ให้ป้ายบนแถวขึ้นทันที
   * 🔴 server หยุดสายที่เหลือให้ด้วย (เจ้าของสั่ง 5 ต.ค. 2569 — เดิมปิดแล้ว AI ยังโทรต่อ): ทุกผล = วันนั้น ·
   * "ยกเลิก" เลือก วันนั้น/ทั้งชุด · หยุดไม่สำเร็จต้องบอก (ไม่งั้นคนเชื่อว่าไม่โทรแล้ว)
   */
  const doComplete = async (id: string, outcome: FollowOutcome, note?: string, stopScope?: FollowStopScope) => {
    setBusyId(id);
    try {
      const out = await completeFollowEntry(id, outcome, note, stopScope);
      if (out.stopped_error) toast.error('ปิดงานแล้ว แต่หยุดสายที่เหลือไม่ได้ · กดยกเลิกสายที่เหลือเองที่ปุ่มจัดการ');
      await reload();
    } catch (err) {
      toast.error(friendlyErrorText(err, 'ปิดงานไม่สำเร็จ'));
    } finally {
      setBusyId(null);
    }
  };

  /**
   * ย้อนสถานะปิดงาน (feedback 2 ก.ย. 2569) — ล้างผลปิดงานแล้วโหลดใหม่ให้ปุ่มกลับมา
   * ⚠️ ไม่แตะคิวโทร (เหมือนตอนปิดงาน) — สายที่โทรไปแล้วเป็นเหตุการณ์จริง ย้อนไม่ได้
   */
  const doReopen = async (id: string) => {
    setBusyId(id);
    try {
      await reopenFollowEntry(id);
      await reload();
    } catch (err) {
      toast.error(friendlyErrorText(err, 'ย้อนสถานะไม่สำเร็จ'));
    } finally {
      setBusyId(null);
    }
  };

  /**
   * ลง/ล้างผลโทรของรอบคนโทร (130 · เจ้าของเคาะ 30 ก.ย. 2569) — โหลดใหม่ให้ช่องปฏิทินเปลี่ยนสีทันที
   * ⚠️ ไม่แตะคิวโทร ไม่แตะการปิดงาน
   */
  const doStaffCall = async (id: string, outcome: FollowStaffCallOutcome, note?: string): Promise<boolean> => {
    setBusyId(id);
    try {
      await recordFollowStaffCall(id, outcome, note);
      await reload();
      return true;
    } catch (err) {
      toast.error(friendlyErrorText(err, 'ลงผลโทรไม่สำเร็จ'));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const doStaffCallClear = async (id: string) => {
    setBusyId(id);
    try {
      await clearFollowStaffCall(id);
      await reload();
    } catch (err) {
      toast.error(friendlyErrorText(err, 'ล้างผลโทรไม่สำเร็จ'));
    } finally {
      setBusyId(null);
    }
  };

  /** ตัวเลือกหน่วยงานที่กล่อง picker ใช้ — ละเอียดจากใบขอเปิด + ครบจากชุดทั้งหมด */
  const unitOptions = useMemo(
    () => mergeBoardUnitOptions(buildBoardUnitOptions(openJobs), allUnits),
    [openJobs, allUnits],
  );

  /**
   * รายการของแท็บที่เปิดอยู่ — รายชื่อติดตาม = ไม่มีของส่งคนแทน · ติดตามส่งคนแทน = เฉพาะของส่งคนแทน (1 ต.ค. 2569)
   * 🔴 ทุกอย่างบนจอ (ปฏิทิน · แผงรอบ · เลขงานจบหรือยัง · ป๊อป) อ่านจากชุดนี้ · ตัวกันนัดซ้ำยังเทียบกับ `items` ทั้งก้อน
   */
  const scopeItems = useMemo(
    () => followScopeEntries(items, replaceView ? 'replacement' : 'main'),
    [items, replaceView],
  );
  /**
   * ค้นหา + วันที่ของแผน (เจ้าของ 5 ต.ค. 2569: *"เพิ่ม filter ค้นหา ชื่อหน่วยงาน / ชื่อพนักงาน · ครั้งที่ติดตาม"*
   * → Choice ครั้งที่ติดตาม = วันที่ของแผน) — กรองก่อนทุกอย่าง ⇒ แผงขั้นตอนของสาย ตัวเลขบนตัวกรอง และตาราง ใช้ชุดเดียวกัน
   * ช่องค้นหาอยู่แถบบนตามกติกาทั้งระบบ (`useHeaderSearch`)
   */
  const [followSearch, setFollowSearch] = useState('');
  const [planDay, setPlanDay] = useState<string>('all');
  useHeaderSearch({ value: followSearch, onChange: setFollowSearch, placeholder: 'ค้นหาชื่อ หน่วยงาน เบอร์' });
  const searchedItems = useMemo(
    () => (followSearch.trim() ? scopeItems.filter((e) => matchesFollowSearch(e, followSearch)) : scopeItems),
    [scopeItems, followSearch],
  );
  const planScopedItems = useMemo(
    () => (planDay === 'all' ? searchedItems : searchedItems.filter((e) => followPlanDayOf(e) === Number(planDay))),
    [searchedItems, planDay],
  );
  const filtered = useMemo(
    () => filterFollowEntries(planScopedItems, { date: fDate, band: fBand, caller, owner: adderKey }),
    [planScopedItems, fDate, fBand, caller, adderKey],
  );
  /**
   * แผงรอบโทรนับตาม **วันที่เลือก** และสลับดู **ทั้งเดือน** ได้ (เจ้าของเคาะ 3 ต.ค. 2569:
   * *"ทุกสาย = สายทุกสายบวกกัน · สายที่ 1 ก็ตามนั้น · ต้องเปลี่ยนตามวันที่เลือกด้วย"* +
   * *"Filter ก็ต้องดูแบบทั้งเดือนได้ด้วย"*) — เลิกนับสะสมตลอดกาล (1,250 สายที่ไม่มีใครใช้)
   * ⚠️ dropdown "นับช่วง" ถูกถอด (เจ้าของสั่งเย็นวันเดียวกัน "เอาออก") — ช่วงเดินตาม
   * **แท็บ รายวัน/รายเดือน ของปฏิทิน** แทน: ดูรายวัน = นับวันที่เลือก · ดูรายเดือน = นับทั้งเดือน
   */
  const [panelRange, setPanelRange] = useState<'day' | 'month'>('day');
  const panelDay = fDate || toYmdBangkok(new Date());
  /** สายในช่วงที่แผงดูอยู่ (วันเดียว/ทั้งเดือน) — ก่อนตัวกรองใครโทร */
  const inPanelRange = useCallback(
    (e: FollowEntry) => {
      if (!e.scheduled_at) return false;
      const d = new Date(e.scheduled_at);
      if (Number.isNaN(d.getTime())) return false;
      const ymd = toYmdBangkok(d);
      return panelRange === 'month' ? ymd.slice(0, 7) === calMonth : ymd === panelDay;
    },
    [panelRange, panelDay, calMonth],
  );
  const panelScope = useMemo(() => planScopedItems.filter(inPanelRange), [planScopedItems, inPanelRange]);
  /** ตัวเลือก "วันที่ของแผน" นับในช่วงที่ดู (หลังค้นหา ก่อนเลือกวันที่ของแผน) */
  const planDayOptions = useMemo(
    () => followPlanDayOptions(searchedItems.filter((e) => inPanelRange(e) && followRoundSlot(e) !== null)),
    [searchedItems, inPanelRange],
  );
  /** สายในช่วงที่ดูอยู่ + เจ้าของงาน (ยังไม่กรองใครโทร) — ฐานของเลขบนตัวเลือก "ใครโทร" */
  const panelByOwner = useMemo(
    () => (adderKey ? panelScope.filter((e) => matchesFollowAdder(e, adderKey)) : panelScope),
    [panelScope, adderKey],
  );
  const panelEntries = useMemo(() => filterFollowEntries(panelByOwner, { date: '', band: '', caller }), [panelByOwner, caller]);
  /**
   * 🔴 เลขบนตัวเลือกนับชุดเดียวกับ "สายที่ · ทั้งหมด" (เจ้าของสั่ง 5 ต.ค. 2569: *"ใครโทร ทั้งหมดเป็นพันเลยคืออะไร
   * มันต้อง 251 แล้ว Ai เท่าไหร่ คนเท่าไหร่"*) — เดิมนับทั้งแท็บตลอดกาล (1,652) · ตอนนี้ = ช่วงที่ปฏิทินดูอยู่
   * (วัน/เดือน) และนับเฉพาะสายที่มีเลขสาย (นิยามเดียวกับแผง `buildFollowCallMatrix`) ⇒ ทั้งหมด = AI + คน = เลขสายที่
   * · ตัวเลือกแต่ละตัวนับหลังตัวกรองอีกตัว (เลือกเจ้าของงานแล้ว เลขใครโทรเหลือของคนนั้น)
   */
  const callerCounts = useMemo(
    () => countFollowCallers(panelByOwner.filter((e) => followRoundSlot(e) !== null)),
    [panelByOwner],
  );
  const ownerBase = useMemo(
    () => filterFollowEntries(panelScope, { date: '', band: '', caller }).filter((e) => followRoundSlot(e) !== null),
    [panelScope, caller],
  );
  const adderOptions = useMemo(() => followAdderOptions(ownerBase), [ownerBase]);
  const myAddedCount = useMemo(
    () => (user?.email ? ownerBase.filter((e) => matchesFollowAdder(e, user.email)).length : 0),
    [ownerBase, user?.email],
  );
  const hasActiveFilter = Boolean(fDate || fBand);

  /**
   * การ์ดเดียวต่อคน (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ: คนเดียวหลายรอบแตกหลายแถว "งงตาย")
   * จับกลุ่มเบอร์+เรื่อง — ตรรกะอยู่ที่ `followGrouping.ts` (pure + เทสต์) ที่เดียว
   */
  const groups = useMemo(() => groupFollowEntries(filtered), [filtered]);

  /**
   * 🔴 การ์ด "ติดตามครบ" กิน `scopePeople` (ชุดเต็มของแท็บ + คำค้น · ประกาศข้างล่าง) **ไม่ใช่ `groups`**
   * บทเรียน 3 ก.ย. 2569: แถบส่งต่อเดิมกินกลุ่มที่ผ่านตัวกรองแท็บ/วันที่แล้ว ⇒ เลือกวันอื่นแถบหายทั้งแถบ
   * ทั้งที่งานยังค้างจริง · กองนี้คือ **คิวงาน** ไม่ใช่มุมมองของตัวกรอง จึงนับจากชุดเต็มเสมอ
   */

  /**
   * ═══ แถวของตาราง Planning (F3 · เจ้าของสั่ง 1 ก.ย. 2569) ═══
   * **มาแทนรายการการ์ดเดิม** — หนึ่งแถวหนึ่งคน · ติดตามวันไหน · กี่รอบ · เวลาไหน · ไปถึงไหน
   *
   * 🔴 **เรียงก่อนแบ่งหน้าเสมอ** — "คนที่ต้องโทรก่อนอยู่บนสุด" จะจริงก็ต่อเมื่อเรียงทั้งชุด
   * ถ้าไปเรียงในตาราง (หลังแบ่งหน้า) ลำดับจะถูกแค่ภายในหน้านั้น หน้า 2 มีของด่วนกว่าซ่อนอยู่
   */
  const planningRowsAllRounds = useMemo(() => buildFollowPlanningRows(groups), [groups]);
  /**
   * ตารางหลังกดกล่องผล — เหลือคนที่มีสายในช่วงที่ดู (วัน/เดือน) อยู่ในกล่องนั้น
   * นับสายแบบเดียวกับแผง: มีเลขสาย · ตรงสายที่เลือก · หมวดผลรวมผลที่คนกดจัดการแล้ว (`dayVerdict`)
   */
  const calendarRows = useMemo(() => {
    if (!resultBox) return planningRowsAllRounds;
    const inBox = (r: FollowPlanningRound) => {
      if (!r.ymd || (panelRange === 'month' ? r.ymd.slice(0, 7) !== calMonth : r.ymd !== panelDay)) return false;
      const slot = followRoundSlot(r.entry);
      if (slot === null || (activeRound !== 'all' && slot !== activeRound)) return false;
      return followMatrixColOfCategory(callCategory(r)) === resultBox;
    };
    // แถวเหลือเฉพาะสายที่อยู่ในกล่อง ⇒ "N สาย" ใต้ตาราง = เลขบนกล่อง · ป๊อปรายละเอียดยังอ่านจาก allRows (เห็นครบทุกสาย)
    return planningRowsAllRounds
      .map((row) => ({ ...row, rounds: row.rounds.filter(inBox) }))
      .filter((row) => row.rounds.length > 0);
  }, [planningRowsAllRounds, resultBox, panelRange, calMonth, panelDay, activeRound]);

  /**
   * 🔴 ปฏิทินรับ **ชุดไม่กรองรอบ** (เปลี่ยน 7 ก.ย. 2569 · ฉบับที่ 2 ของปฏิทินสองหน้า)
   * การ์ดมีชิปกรอง "ทุกสาย / สายที่ 1-3" ของตัวเองแล้ว และยังตามแท็บ `activeRound` ข้างบน
   * เมื่อกดเปลี่ยน (พฤติกรรม 1 ก.ย. 2569) — ถ้ากรองที่นี่อีกชั้น หน้ารายเดือนจะขาดสายอื่นของคนเดิม
   * ป๊อปรายละเอียดยังอ่านจาก `allRows` ที่ไม่ผ่านตัวกรองใด ๆ เหมือนเดิม
   */

  /**
   * 🔴 **ชุดเต็มไม่ผ่านตัวกรองใด ๆ** — ใช้เฉพาะกับป๊อปรายละเอียด
   *
   * เจ้าของทัก 1 ก.ย. 2569: *"ทำไมขึ้นว่าเสร็จสิ้น เพราะในระบบ Lumos บอกยกเลิก
   * งี้จะเชื่อนายได้ไง"* — เคสจริงคือคนนั้นมี **3 สายในวันเดียว** (11:00 ที่ถูกยกเลิก ·
   * 11:00 ที่คุยจบ · 11:15) แต่แท็บ "กำลังตาม" กรองสายที่ยกเลิกออก ⇒ จอเราโชว์ 2
   * ส่วน Lumos โชว์ 3 · **ป๊อปคือที่ที่คนมาถามว่า "ตกลงเกิดอะไรขึ้น"** จึงต้องเล่าครบเสมอ
   * (ปฏิทิน/เลขบนแท็บยังเคารพตัวกรองเหมือนเดิม ไม่งั้นเลขกับจอจะเถียงกันเอง)
   */
  const scopeGroups = useMemo(() => groupFollowEntries(scopeItems), [scopeItems]);
  /**
   * การ์ดติดตามครบตัดสินทีละ **คน** (รวมทุกแผนของคนเดิม) — แถวตาราง/ป๊อปยังแยกทีละแผน
   * เคารพคำค้นแถบบน (QA 5 ต.ค. 2569: ค้น "พญาไท" แล้วการ์ดนี้ยังขึ้นคนหน่วยงานอื่น) แต่ไม่ตามตัวกรองวัน
   */
  const scopePeople = useMemo(
    () => groupFollowEntries(searchedItems, new Date(), followPersonKey),
    [searchedItems],
  );
  const allRows = useMemo(() => buildFollowPlanningRows(scopeGroups), [scopeGroups]);
  /**
   * ชุดที่ปุ่ม "วันถัดไปที่มีแผน" ใช้หา — ทุกวัน (ไม่กรองวัน) แต่กรองใครโทรเหมือนตาราง
   * ปุ่มกับตารางต้องนับชุดเดียวกัน (3 ต.ค. 2569 "แก้ให้สอดคล้องกัน")
   */
  const nextDayRows = useMemo(
    () =>
      buildFollowPlanningRows(
        groupFollowEntries(
          filterFollowEntries(scopeItems, { date: '', band: '', caller, owner: adderKey }),
        ),
      ),
    [scopeItems, caller, adderKey],
  );

  /**
   * รายละเอียดของช่องที่กดในปฏิทิน — **อ่านจากชุดเต็ม**
   * ไม่เจอแล้ว (ถูกลบ) = ส่ง null ให้ป๊อปว่างแทนที่จะค้างข้อมูลเก่า
   */
  const cellDetail = useMemo(() => {
    if (!openCell) return null;
    const row = allRows.find((r) => r.group.key === openCell.key);
    if (!row) return null;
    return {
      group: row.group,
      ymd: openCell.ymd,
      /* 🔴 รวมรอบที่ยกเลิกด้วย — Lumos โชว์ว่ายกเลิก จอเราต้องโชว์ด้วย ไม่งั้นสองระบบเล่าคนละเรื่อง
         ymd ว่าง = "แผนทั้งหมดของคนนี้" (กดจากชื่อ · 3 ต.ค. 2569) — ทุกวันเรียงตามเวลา */
      rounds: openCell.ymd ? row.rounds.filter((r) => r.ymd === openCell.ymd) : row.rounds,
    };
  }, [openCell, allRows]);


  /** เลือกวันจากปฏิทิน = ใช้ช่องกรองวันเดิม (`fDate`) — ห้ามมีตัวกรองวันสองตัวในหน้าเดียว */
  const pickCalendarDay = (ymd: string) => {
    setFDate(ymd);
    setCalMonth(ymd ? ymd.slice(0, 7) : calMonth);
  };

  const counts = useMemo(() => {
    // 🔴 นับเฉพาะที่อยู่ในคิวจริง — เดิม API เดา 'pending' ให้แถวที่ไม่เคยส่ง ตัวเลขจึงเกินจริง
    const pending = scopeItems.filter((i) => i.call_status === 'pending').length;
    const notSent = scopeItems.filter((i) => !i.call_status && !i.cancelled).length;
    const done = scopeItems.filter((i) => i.call_status === 'completed').length;
    return { total: scopeItems.length, pending, done, notSent };
  }, [scopeItems]);

  /**
   * 🔴 ถังตามเวลานัด — **นิยามเดียวกับหน้าแรก** (`followScheduleCounts`)
   * หน้าแรกส่งคนมาที่นี่ด้วยพาดหัว "เลยเวลานัดแล้ว N ราย" แต่เดิมหน้านี้ไม่มีเลขนั้น
   * อยู่เลย ⇒ คนกดมาแล้วหาไม่เจอว่าต้องโทรใคร (audit คนใหม่ 26 ส.ค. 2569)
   */
  const schedule = useMemo(() => followScheduleCounts(scopeItems), [scopeItems]);

  /**
   * ปุ่มทั้งหมดของหน้า — อยู่แถวบนสุดคู่กับแท็บ (เจ้าของสั่ง 3 ต.ค. 2569: *"ย้ายไปอยู่แถวเดียวกับ
   * ติดตามคนเริ่มงาน / ติดตามส่งคนแทน แล้วเอาคำนั้นออก"* + แท็บก็แถวเดียวกัน) · เดิมอยู่หัวปฏิทิน
   */
  const headerButtons = (
    <>
      {/* 🔴 ปุ่ม "เพิ่มคนที่ต้องการติดตาม" อยู่แถวเดียวกับ "เพิ่มเจ้าหน้าที่"
          (เจ้าของสั่ง 1 ก.ย. 2569) · ปุ่มนี้ **ทุกคนกดได้** ต่างจากอีกสองปุ่มที่เป็น
          supervisor+ จึงอยู่นอกเงื่อนไข canManageMasters */}
      <Button
        size="sm"
        type="button"
        onClick={() => {
          setFormOpen(true);
          setFormError(null);
          setReturnTo(null); // เปิดเองจากหน้านี้ = ไม่มีหน้าเดิมให้กลับ
        }}
        className="inline-flex h-8 items-center gap-1 px-2.5 text-[11px] touch-manipulation sm:px-3"
      >
        <Plus aria-hidden />
        {/* จอมือถือย่อคำ — ปุ่มชุดนี้ต้องอยู่บรรทัดเดียว (4 ต.ค. 2569) */}
        <span className="sm:hidden">เพิ่มคน</span>
        <span className="hidden sm:inline">เพิ่มคนที่ต้องการติดตาม</span>
      </Button>
      {/* สรุปแผนทั้งวันของวันที่ดูอยู่ (เจ้าของสั่ง 2 ต.ค. 2569 · Choice "หน้าสรุปบนจอ") */}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setReportOpen(true)}
        aria-label="สรุปแผน"
        title="สรุปแผน"
        className="inline-flex h-8 items-center gap-1 px-2.5 text-[11px] sm:px-3"
      >
        <ClipboardList aria-hidden />
        <span className="hidden sm:inline">สรุปแผน</span>
      </Button>
      {/* ═══ ตัวกรองทั้งหมดอยู่ในกล่องเดียว ข้าง ๆ ปุ่มเพิ่มคน (เจ้าของสั่ง 1 ก.ย. 2569) ═══
          *"ย้ายทุกช่วงเวลาเข้าไปไว้กับเลือกวัน · แล้วย้ายเลือกวันไปไว้ข้าง ๆ เพิ่มคน"*
          🔴 ยังเป็น `fDate`/`fBand` ชุดเดิม — และเป็น **ตัวเลือกวันตัวเดียวของหน้า**
          (ปฏิทินในการ์ดใช้ค่านี้ ไม่มีปุ่มเลือกวันของตัวเอง) */}
      <DayCalendarPicker
        className="h-8 min-h-0 px-2.5 py-1 text-[11px] sm:px-3"
        value={fDate}
        onChange={pickCalendarDay}
        /* 🔴 "เลือกวัน" ทำให้คนใหม่คิดว่าต้องกดก่อนเพิ่มคน (ตาใหม่ 12 ก.ย. 2569)
           — มันคือตัวเปลี่ยนวันที่ "ดู" ไม่ใช่ขั้นตอนของการสร้างงาน */
        emptyLabel="ดูวันอื่น"
        active={hasActiveFilter}
        suffix={fBand ? TIME_BAND_LABEL[fBand].replace(/\s*\(.*\)$/, '') : ''}
        onClearAll={() => {
          pickCalendarDay('');
          setFBand('');
        }}
        extra={
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">ช่วงเวลา</span>
            <select
              value={fBand}
              onChange={(e) => setFBand(e.target.value as TimeBand)}
              className="jarvis-soft-field min-h-[36px] w-full text-xs"
            >
              <option value="">ทุกช่วงเวลา</option>
              <option value="morning">{TIME_BAND_LABEL.morning}</option>
              <option value="afternoon">{TIME_BAND_LABEL.afternoon}</option>
              <option value="evening">{TIME_BAND_LABEL.evening}</option>
            </select>
          </label>
        }
      />
      {/**
       * 🔴 **ยุบเป็นเมนูรอง** (12 ก.ย. 2569) — "เพิ่มเรื่อง"/"เพิ่มเจ้าหน้าที่" เป็นงาน
       * ตั้งค่าครั้งแรก ไม่ใช่งานประจำวัน · ของเดิมยืนเรียงเท่ากับปุ่มหลัก ทำให้คนใหม่
       * ไม่รู้ว่าต้องกดอันไหนก่อน (ตาใหม่: *"ต้องกดก่อนหรือหลังเพิ่มคน"*)
       * ⇒ หัวหน้าเหลือปุ่มเด่นปุ่มเดียวคือ "เพิ่มคนที่ต้องการติดตาม"
       */}
      {canManageMasters ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="ตั้งค่าตัวเลือก"
              aria-label="ตั้งค่าตัวเลือก"
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium sm:px-3',
                TONE.neutral.outline,
              )}
            >
              <Settings2 className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">ตั้งค่าตัวเลือก</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuLabel className="text-[11px]">
              ตั้งค่ารายการตัวเลือก
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setTopicManagerOpen(true)}>
              <Plus aria-hidden /> เพิ่มเรื่องที่ให้โทรติดตาม
            </DropdownMenuItem>
            {/* 🔴 **ตัวจริงของเบอร์เจ้าหน้าที่ = หน้าผู้ใช้งาน** (เจ้าของเคาะ 23 ก.ย. 2569
                ย้ำคำสั่งเดิม 1 ก.ย.: *"กำหนดทั้ง Role คัดสรร ชื่อเล่น และเบอร์โทรทีเดียว"*)
                ⇒ พาไปที่นั่นเลย · ช่องนี้โผล่เฉพาะ admin เพราะ /api/app-users เป็น admin
                เท่านั้น — โชว์ให้ supervisor กดแล้วเจอหน้าโหลดไม่ขึ้นคือพาไปทางตัน */}
            {canEditUsers ? (
              <DropdownMenuItem onSelect={() => navigate('/settings?tab=users')}>
                <UserCog aria-hidden /> ตั้งชื่อเล่น + เบอร์เจ้าหน้าที่ (หน้าผู้ใช้งาน)
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => setStaffManagerOpen(true)}>
              <Plus aria-hidden /> เพิ่มเบอร์คนที่ไม่มีบัญชีผู้ใช้
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );

  /** แท็บขีดเส้นใต้ชุดเดียวกับหน้างานสรรหา · มือถือย่อคำ/ช่องไฟ (4 ต.ค. 2569) */
  const followTabClass = (value: typeof followView) =>
    cn(
      'shrink-0 rounded-none border-b-2 bg-transparent px-2 py-2 text-xs font-medium shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:px-3 sm:text-sm',
      followView === value
        ? cn(TONE.primary.value, 'border-current')
        : 'border-transparent text-muted-foreground hover:text-foreground',
    );

  return (
    <div className="relative">
      {/* 🔴 แบบหน้าผู้สมัคร (เจ้าของสั่ง 4 ต.ค. 2569 "หน้าการติดตามก็เหมือนกัน — แบบหน้าผู้สมัคร"):
          แถว 1 = ← แท็บ (ขีดเส้นใต้ ชุดเดียวกับหน้างานสรรหา) ··· รีเฟรชชิดขวา · แถว 2 = ปุ่มของหน้า (Dashboard ไม่มี)
          ชื่อหน้า "ติดตามคนเริ่มงาน / ติดตามส่งคนแทน" ถอดไว้ตั้งแต่ 3 ต.ค. — ยังอยู่สำหรับโปรแกรมอ่านจอ */}
      <div className="space-y-2 px-4 pt-4 md:px-6 md:pt-5">
        <h1 className="sr-only">{conveyorLabel('follow')}</h1>
        {/* จอคอม = ← แท็บ ↻ แถวเดียว · มือถือ = ← ··· ↻ แล้วแท็บลงแถวถัดไปเต็มกว้าง (ชุดเดียวกับ PageHeader) */}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <Button type="button" variant="ghost" size="icon" aria-label="ย้อนกลับ" onClick={() => navigate('/')} className="order-1 shrink-0">
            <ArrowLeft aria-hidden />
          </Button>
          {/* แท็บ "รายชื่อติดตาม | ส่งคนแทน | Dashboard" — ?view=… · กดเปลี่ยน = push (ย้อนกลับแล้วไม่หลุดหน้า) */}
          <Tabs
            value={followView}
            onValueChange={(v) => setFollowView(v === 'dashboard' ? 'dashboard' : v === 'replace' ? 'replace' : 'list')}
            className="order-3 min-w-0 basis-full md:order-2 md:basis-0 md:flex-1"
          >
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
              <TabsTrigger value="list" className={followTabClass('list')}>ติดตามคนเริ่มงาน</TabsTrigger>
              <TabsTrigger value="replace" className={followTabClass('replace')}>ติดตามส่งคนแทน</TabsTrigger>
              <TabsTrigger value="dashboard" className={followTabClass('dashboard')}>Dashboard</TabsTrigger>
            </TabsList>
          </Tabs>
          {/* รีเฟรช — ขึ้นมาแถวแท็บชิดขวาแบบหน้าผู้สมัคร (เดิมอยู่ท้ายแถวปุ่ม) · Dashboard = โหลดแผงใหม่ */}
          <Button
            type="button"
            variant="outline"
            size="iconXs"
            onClick={() => (followView === 'dashboard' ? setDashRev((n) => n + 1) : void reload())}
            disabled={loading}
            aria-label="รีเฟรชข้อมูล"
            title="รีเฟรชข้อมูล"
            className="order-2 shrink-0 md:order-3"
          >
            <RefreshCw className={cn(loading && 'animate-spin')} aria-hidden />
          </Button>
        </div>
        {followView !== 'dashboard' ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">{headerButtons}</div>
        ) : null}
      </div>

      {followView === 'dashboard' ? (
        <div className="px-4 md:px-6 py-4">
          <Suspense key={dashRev} fallback={<p className="py-6 text-sm text-muted-foreground">กำลังเปิด Dashboard…</p>}>
            <FollowDashboard />
          </Suspense>
        </div>
      ) : (
      <div className="px-4 md:px-6 py-4 space-y-4">
        {/* funnel การโทร "ของหน้านี้เท่านั้น" + ถัง "ต้องคนตาม"
            เจ้าของสั่ง 10 ส.ค. 2569: หน้านี้เอาแค่ของ Follow พอ ("ตอนนี้มีแค่ 1 พอ")
            ตัวที่กดสลับดูต้นทางอื่นได้ ย้ายไปอยู่หน้าการไหลของงานแล้ว */}
        {/* แผงการโทรแบบ 3 รอบ + ปฏิทิน (เจ้าของสั่ง 18 ส.ค. 2569 — แทน funnel 4 ช่องเดิม)
            CallFunnelPanel ใช้ที่หน้านี้ที่เดียว การเปลี่ยนจึงไม่กระทบหน้า Matching
            (หน้านั้นใช้ AiCallFlowPanel คนละตัว) */}
        {/* ปุ่ม "เพิ่มเรื่อง / เพิ่มเจ้าหน้าที่" อยู่ข้างไอคอนปฏิทิน (เจ้าของสั่ง 18 ส.ค.
            2569 ค่ำ-5 — แทนกล่อง TopicManager ของค่ำ-4 ที่ถูกถอดออก) · โผล่เฉพาะ
            supervisor+ เท่านั้น server กันอีกชั้นที่ rbac ไม่ใช่แค่ซ่อนปุ่ม */}
        {/* ═══ การ์ดเดียวจบ: การโทร + ปฏิทิน (รวมกัน 8 ก.ย. 2569) ═══
            เดิมเป็นสองการ์ดซ้อนกัน ทั้งคู่พูดเรื่อง "การโทร" และมีตัวเลือกรอบคนละชุด
            ผู้ทดสอบตาใหม่ถามว่า *"สองอันนี้บอกเรื่องเดียวกันหรือคนละเรื่อง งงว่าทำไมมีสองที่"*
            ⇒ ยุบเป็นผืนเดียว · ตัวเลือกรอบมีที่เดียว (`activeRound`) · ตัวเลือกวันมีที่เดียว (`fDate`)
            🔴 ของเดิมอยู่ครบทุกชิ้น: แท็บรอบ + 7 กล่องสถานะสาย + ป๊อปรายชื่อ + ปุ่มทุกปุ่ม */}
        {/* แถบดึงจาก iRecruit — แท็บส่งคนแทนอย่างเดียว (เจ้าของสั่ง 2 ต.ค. 2569 · ข้อยกเว้นเดียวของ "สองแท็บเหมือนกัน")
            ดึงเองทุกเช้า · ปุ่มดึงตอนนี้/แก้เวลาโทร หัวหน้างานขึ้นไป · ดึงได้สายใหม่ = โหลดรายการใหม่ */}
        {/* 🔴 แถบโหลดไม่ได้อยู่บนสุด + ปุ่มลองใหม่ (QA 5 ต.ค. 2569: เดิมอยู่ท้ายหน้าลึก 3 จอ เป็นอังกฤษดิบ) */}
        {error ? (
          <div
            role="alert"
            className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium', TONE.danger.soft, TONE.danger.value)}
          >
            <span>
              {error}
              {lastLoadedAt ? ` · ข้อมูลบนจอเป็นของเมื่อ ${lastLoadedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.` : ''}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => void reload()} disabled={loading}>
              ลองใหม่
            </Button>
          </div>
        ) : null}
        {replaceView ? (
          <SectionErrorBoundary label="แถบ iRecruit">
            <IrecruitReplaceSyncBar canManage={canManageMasters} onSynced={() => void reload(true)} />
          </SectionErrorBoundary>
        ) : null}
        {/* 🔴 ยังไม่เคยโหลดสำเร็จ = ยังไม่รู้เลข ⇒ ห้ามขึ้น 0 / "ตามครบแล้ว" (QA 5 ต.ค. 2569) · กำลังโหลดขึ้นโครงหน้า · ล้มเหลือแถบข้างบน */}
        {lastLoadedAt === null ? (
          loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="กำลังโหลด" data-testid="follow-first-load">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-72 w-full rounded-2xl" />
            </div>
          ) : null
        ) : (
        <FollowPlanningCalendar
          rows={calendarRows}
          allRows={nextDayRows}
          onViewChange={setPanelRange}
          month={calMonth}
          onMonthChange={setCalMonth}
          selectedYmd={fDate}
          onSelect={pickCalendarDay}
          onOpenCell={(row, ymd) => setOpenCell({ key: row.group.key, ymd })}
          /* ดินสอบนแถว = เปิดกล่องแก้ไขของสายนั้นตรง ๆ (เจ้าของทัก 10 ก.ย. 2569 ว่าหาไม่เจอ
             เพราะของเดิมซ่อนอยู่ในป๊อป "จัดการ" อีกชั้น) · ไม่ต้องจำ cellToReopen
             เพราะไม่ได้เปิดมาจากป๊อป จึงไม่มีป๊อปให้กลับไป */
          onEditRound={(round) => setEditing(round.entry)}
          /* 🔴 แถวตัวกรอง (สายที่ · ใครโทร · เจ้าของงาน · ใครเพิ่ม) อยู่แถวเดียวกับแท็บรายวัน/รายเดือน
             (เจ้าของสั่ง 5 ต.ค. 2569 — เดิมอยู่หัวการ์ดขั้นตอนของสาย) · "ใครโทร" เป็นตัวกรองเดียวของหัวแผงเดิม
             (3 ต.ค. 2569 ถอด นับช่วง · งานจบหรือยัง · บรรทัดแยก AI/คน) ห้ามเติมกลับโดยไม่ได้สั่งใหม่ */
          filtersSlot={
            <FollowFilterGroup entries={panelEntries} round={activeRound} onRoundChange={setActiveRound}>
              <>
                <span className="text-xs text-muted-foreground">ใครโทร</span>
                <ChoiceDropdown
                  value={caller}
                  options={FOLLOW_CALLERS.map((c) => ({
                    value: c,
                    label: `${FOLLOW_CALLER_LABEL[c]} · ${callerCounts[c].toLocaleString('th-TH')}`,
                  }))}
                  onChange={(v) => setCaller(v)}
                  ariaLabel="ใครโทร"
                  active={caller !== 'all'}
                />
                {/* เจ้าของงาน = อีเมลคนเพิ่ม (เจ้าของสั่ง 5 ต.ค. 2569) · "ใครเพิ่ม" ยุบเข้ามาแล้ว · "ของฉัน" มาก่อน */}
                <span className="text-xs text-muted-foreground">เจ้าของงาน</span>
                <ChoiceDropdown
                  value={adderFilter}
                  options={[
                    { value: 'all', label: `ทุกคน · ${ownerBase.length.toLocaleString('th-TH')}` },
                    ...(user?.email ? [{ value: 'me', label: `ของฉัน · ${myAddedCount.toLocaleString('th-TH')}` }] : []),
                    ...adderOptions.map((o) => ({
                      value: o.value,
                      label: `${o.value === FOLLOW_ADDER_NONE ? o.label : o.value} · ${o.count.toLocaleString('th-TH')}`,
                    })),
                  ]}
                  onChange={(v) => setAdderFilter(v)}
                  ariaLabel="เจ้าของงาน"
                  active={adderFilter !== 'all'}
                />
                {/* ครั้งที่ติดตาม = วันที่ของแผน (เจ้าของ Choice 5 ต.ค. 2569) */}
                <span className="text-xs text-muted-foreground">วันที่ของแผน</span>
                <ChoiceDropdown
                  value={planDay}
                  options={[
                    { value: 'all', label: `ทุกวัน · ${planDayOptions.reduce((n, o) => n + o.count, 0).toLocaleString('th-TH')}` },
                    ...planDayOptions.map((o) => ({
                      value: String(o.day),
                      label: `วันที่ ${o.day} · ${o.count.toLocaleString('th-TH')}`,
                    })),
                  ]}
                  onChange={(v) => setPlanDay(v)}
                  ariaLabel="วันที่ของแผน"
                  active={planDay !== 'all'}
                />
              </>
            </FollowFilterGroup>
          }
          /* ปุ่มบนแถวของสายที่คนโทร (เจ้าของ Choice 1 ต.ค. 2569 "ติดต่อสำเร็จ / ไม่สำเร็จ / ยกเลิก") —
             เส้นเดียวกับปุ่มลงผล/ยกเลิกในป๊อปจัดการ */
          onStaffResult={async (round, outcome, row) => {
            const ok = await doStaffCall(round.entry.id, outcome);
            /* "ติดต่อสำเร็จ" = คุยได้แล้ว รู้ผลแล้ว — เปิดป๊อปจัดการต่อให้เลย จะได้กดปิดงานจบ
               ในจังหวะเดียว (3 ต.ค. 2569: เดิมต้องกดสองที่) · ไม่สำเร็จ/ล้มเหลวไม่เด้ง */
            if (ok && outcome === 'acknowledged' && row) {
              setOpenCell({ key: row.group.key, ymd: round.ymd ?? '' });
            }
          }}
          onCancelRound={(round) => doCancel(round.entry.id)}
          busyId={busyId}
          lastLoadedAt={lastLoadedAt}
          roundFilter={activeRound}
          roundsSlot={
            <FollowCallRoundsPanel
              embedded
              /* 🔴 ส่งรายการก้อนเดียวกับที่หน้านี้ใช้ — แผงนี้ห้ามโหลดเอง
                 (เดิมโหลดแยก ⇒ จอเดียวมี "ทั้งหมด" สามค่าที่ไม่ตรงกัน)
                 ตัวกรอง "ใครโทร" มีผลกับแผงนี้ด้วย — เลขทุกกล่องแบ่งตามคนโทร/AI ได้ */
              entries={panelEntries}
              /* จากรายชื่อในป๊อปของเลข → เปิดป๊อปจัดการคนนั้นได้เลย (4 ต.ค. 2569 ทางไปต่อ) */
              onOpenPerson={(e) => {
                const ymd = e.scheduled_at ? toYmdBangkok(new Date(e.scheduled_at)) : '';
                setOpenCell({ key: followGroupKey(e), ymd });
              }}
              loading={loading}
              onReload={() => void reload()}
              round={activeRound}
              onRoundChange={setActiveRound}
              resultBox={resultBox}
              onResultBoxChange={setResultBox}
            />
          }
        />
        )}

        {/* 🔴 แถบสรุปเลข (ต้องโทรใครตอนนี้ / สถานะสาย) กับปุ่มรีเฟรช **ถูกถอดออก**
            (เจ้าของสั่ง 1 ก.ย. 2569) — เลขชุดเดียวกันกับปุ่มรีเฟรชอยู่บนแผง
            "การโทรของงาน Follow" ข้างบนอยู่แล้ว ไม่ต้องมีสองที่ */}

        {/* แท็บสถานะ + ปุ่ม Filter (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-6) — แยกหน้าตามสถานะ
            เพื่อดูง่าย · ปุ่ม Filter เช็คสถานะประจำวัน (วันที่/ช่วงเวลา/เจ้าของงาน) */}
        {/* แถวชิป "งานจบหรือยัง" ย้ายขึ้นไปเป็น dropdown ข้าง "ดูเฉพาะ" บนหัวการ์ดขั้นตอนของสาย (เจ้าของสั่ง 1 ต.ค. 2569) */}

        {okMessage ? (
          <p className={cn('rounded-xl border px-3.5 py-2.5 text-xs font-medium', TONE.success.soft, TONE.success.value)}>
            {okMessage}
          </p>
        ) : null}

        {/**
          * ═══ ฟอร์มเพิ่มคน = **ป๊อป** (เจ้าของสั่ง 1 ก.ย. 2569) ═══
          * > *"ปุ่ม เพิ่มคนที่ต้องการติดตาม เมื่อกดไปแล้ว เด้ง Popup ขึ้นมา
          * >  แล้วพาทำทีละขั้นตอน"*
          *
          * 🔴 **ยกเนื้อฟอร์มเดิมเข้ามาทั้งดุ้น ไม่เขียนใหม่** — ฟอร์มนี้มีกติกาที่แลกมา
          * ด้วยบั๊กหลายรอบ (อาร์เรย์เบอร์ต้องขยับคู่กับรอบเสมอ · ส่งเฉพาะวันที่ติ๊ก
          * ไม่ใช่ทั้งช่วง · กันเวลาซ้ำในวันเดียว · ฟอร์มไม่รับ submit เลย)
          * เขียนใหม่เมื่อไหร่คือรื้อกับดักพวกนี้ออกหมด
          *
          * ⚠️ ปิดป๊อปด้วยการกดนอกกล่อง/Esc = **ไม่ล้างของที่กรอกค้างไว้** ตั้งใจให้เปิดกลับมา
          * ทำต่อได้ (ฟอร์มสามขั้นกรอกยาว หลุดแล้วต้องเริ่มใหม่คือเจ็บ) · ล้างตอนบันทึกสำเร็จเท่านั้น
          */}
        <Dialog
          open={formOpen}
          onOpenChange={(o) => {
            if (o) return;
            setFormOpen(false);
            setDoneInfo(null);
          }}
        >
          <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto p-0">
            {doneInfo ? (
              /* ═══ เสร็จสิ้น (เจ้าของสั่ง 2 ต.ค. 2569) — ป๊อปเดิมเปลี่ยนหน้า ไม่ซ้อน Dialog ═══ */
              <div className="jarvis-frost space-y-4 p-4 sm:p-5" data-testid="follow-add-done">
                <DialogHeader className="space-y-2 text-left">
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', TONE.success.soft, TONE.success.value)} aria-hidden>
                    <PhoneForwarded className="h-5 w-5" />
                  </span>
                  <DialogTitle>เสร็จสิ้น</DialogTitle>
                  <DialogDescription className="space-y-0.5 text-sm text-foreground">
                    {doneInfo.lines.map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))}
                  </DialogDescription>
                </DialogHeader>
                {doneInfo.warn ? (
                  <p role="alert" className={cn('rounded-xl border px-3 py-2 text-xs font-medium', TONE.danger.soft, TONE.danger.value)}>
                    {doneInfo.warn}
                  </p>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  {/* ลงแผนแล้วต้องพาไปเห็นแผนเลย (เจ้าของ 3 ต.ค. 2569: "ลงแผนทั้งเดือนแล้วแผนหาย") —
                      แผนที่เริ่มวันหน้า ปฏิทินวันนี้ไม่โชว์ คนอ่านว่าแผนหาย */}
                  {doneInfo.firstDay ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const day = doneInfo.firstDay as string;
                        setFormOpen(false);
                        setDoneInfo(null);
                        setCalMonth(day.slice(0, 7));
                        pickCalendarDay(day);
                      }}
                    >
                      ดูแผนที่ลง ({formatYmdDmyBe(doneInfo.firstDay)})
                    </Button>
                  ) : null}
                  {/* วันที่ล้มลองใหม่ได้จากตรงนี้เลย — ไม่ต้องคีย์ทั้งชุดใหม่ (3 ต.ค. 2569) */}
                  {doneInfo.retry ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={submitting}
                      className={TONE.warn.value}
                      onClick={() => void doneInfo.retry?.run()}
                    >
                      {submitting ? `กำลังบันทึก…${submitProgress ? ` ${submitProgress}` : ''}` : doneInfo.retry.label}
                    </Button>
                  ) : null}
                  {returnTo ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const to = returnTo.path;
                        setFormOpen(false);
                        setDoneInfo(null);
                        setReturnTo(null);
                        navigate(to);
                      }}
                    >
                      <ArrowLeft aria-hidden /> กลับหน้า{returnTo.label}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" onClick={() => setDoneInfo(null)}>
                    <Plus aria-hidden /> เพิ่มคนต่อ
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setFormOpen(false);
                      setDoneInfo(null);
                    }}
                  >
                    ปิด
                  </Button>
                </div>
              </div>
            ) : (
            <>
            <DialogHeader className="px-4 pt-4 sm:px-5">
              {returnTo ? (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-auto w-fit p-0"
                  onClick={() => {
                    const to = returnTo.path;
                    setFormOpen(false);
                    setReturnTo(null);
                    navigate(to);
                  }}
                >
                  <ArrowLeft aria-hidden /> กลับหน้า{returnTo.label}
                </Button>
              ) : null}
              <DialogTitle>เพิ่มคนที่ต้องการติดตาม</DialogTitle>
              {/* QA 5 ต.ค. 2569: คำโปรยพูดซ้ำแถบขั้น 1·2·3 ⇒ เหลือไว้ให้โปรแกรมอ่านจอเท่านั้น */}
              <DialogDescription className="sr-only">เพิ่มคนที่ต้องการติดตาม 3 ขั้น</DialogDescription>
            </DialogHeader>
          <form
            /**
             * 🔴 **ฟอร์มนี้ไม่รับ submit เลย** (เจ้าของโดนบันทึกเองซ้ำ 18 ส.ค. 2569) —
             * ทุกเส้นทาง submit ของเบราว์เซอร์ (Enter · implicit submit · ปุ่มที่ลืมใส่ type)
             * ถูกตัดทิ้งที่นี่ การบันทึกผูกกับ onClick ของปุ่ม "บันทึก + ส่ง AI โทร"
             * **ที่เดียวเท่านั้น** — โครงสร้างนี้ทำให้ "บันทึกเอง" เป็นไปไม่ได้ ไม่ใช่แค่กันไว้
             */
            onSubmit={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                e.preventDefault();
              }
            }}
            className="jarvis-frost space-y-3 p-4 sm:p-5"
          >
            {/* บรรทัด "ขั้นที่ N จาก 3 · ① → ② → ③" ถอดแล้ว (QA 5 ต.ค. 2569) — แถบขั้นข้างล่างบอกทางทั้งเส้นอยู่แล้ว */}
            {/* แถบขั้น 1→2→3 (เจ้าของสั่ง 18 ส.ค. 2569) — กดย้อนกลับขั้นที่ทำแล้วได้
                ขั้นที่ยังไม่ถึงกดไม่ได้ ต้องผ่านด่านของขั้นก่อนหน้าเอง */}
            <ol className="flex items-stretch gap-1.5">
              {FOLLOW_WIZARD_STEPS.map((s) => {
                const done = s.step < step;
                const current = s.step === step;
                return (
                  <li key={s.step} className="min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={s.step > step}
                      onClick={() => goToStep(s.step)}
                      className={cn(
                        'flex w-full flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors',
                        current
                          ? 'border-primary bg-primary/10'
                          : done
                            ? cn(TONE.success.soft, 'hover:bg-secondary')
                            /* จางแต่ยัง "อ่านออก" — opacity-60 เดิมอ่านเป็น "ปุ่มเสีย" */
                            : 'border-border bg-background opacity-80',
                      )}
                    >
                      <span
                        className={cn(
                          'text-[10px] font-medium',
                          current ? 'text-primary' : done ? TONE.success.value : 'text-muted-foreground',
                        )}
                      >
                        {s.step} · {s.title}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {followStepSummary(s.step, { ...wizardValues, recipientName: composeRecipientName(prefix, firstName, lastName), unitName, siteCode }) ?? s.hint}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {step === 1 ? (
            <>
            {/* เลือกจากบอร์ด (F5b) — คีย์ชื่อเองก็ยังได้เหมือนเดิม ปุ่มนี้เป็นทางลัดกันพิมพ์ผิด */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className={cn(
                  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium',
                  TONE.info.outline,
                )}
              >
                <Users className="h-3.5 w-3.5" aria-hidden />
                เลือกชื่อจากบอร์ด
              </button>
              {pickedFrom ? (
                <span className="jarvis-chip jarvis-chip-info">{pickedFrom}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">หรือคีย์ชื่อเองด้านล่าง</span>
              )}
            </div>

            {/* คำนำหน้า + ชื่อ + นามสกุล — API รับ recipient_name ก้อนเดียว ประกอบตอนส่ง
                นามสกุลไม่บังคับ บางเคสมีแค่ชื่อที่คนแนะนำมา ไม่ควรบล็อกไม่ให้ลงรายชื่อ */}
            <div className="grid gap-3 sm:grid-cols-[7rem_1fr_1fr]">
              <div className="space-y-1.5">
                <label htmlFor="followPrefix" className="ml-1 text-xs font-medium text-muted-foreground">
                  คำนำหน้า
                </label>
                <select
                  id="followPrefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="jarvis-soft-field min-h-[46px]"
                >
                  {NAME_PREFIXES.map((p) => (
                    <option key={p || 'none'} value={p}>
                      {p || 'ไม่ระบุ'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                {/* 🔴 ช่องบังคับต้องรู้ตั้งแต่ก่อนกด (12 ก.ย. 2569) — ของเดิมรู้ตอนโดนเตือนแล้ว */}
                <label htmlFor="followFirst" className="ml-1 text-xs font-medium text-muted-foreground">
                  ชื่อ <span className={TONE.danger.value}>*</span>
                </label>
                <input
                  id="followFirst"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="สมชาย"
                  className="jarvis-soft-field min-h-[46px]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="followLast" className="ml-1 text-xs font-medium text-muted-foreground">
                  นามสกุล <span className="text-muted-foreground/70">(ถ้ามี)</span>
                </label>
                <input
                  id="followLast"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="ใจดี"
                  className="jarvis-soft-field min-h-[46px]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="followPhone" className="ml-1 text-xs font-medium text-muted-foreground">
                เบอร์โทร (มือถือ 10 หลัก) <span className={TONE.danger.value}>*</span>
              </label>
              <input
                id="followPhone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
                placeholder="0812345678"
                className="jarvis-soft-field min-h-[46px]"
              />
            </div>
            {/* เรื่องที่จะให้โทรติดตาม (100 · เจ้าของสั่ง 18 ส.ค. 2569) — dropdown จากลิสต์กลาง
                ที่ supervisor เพิ่มเองได้ · ยังพิมพ์เรื่องใหม่เองได้ถ้าไม่มีในลิสต์ */}
            <TopicField id="followTopic" value={topic} onChange={setTopic} reloadSignal={topicsRev} />
            </>
            ) : null}

            {step === 2 ? (
            <>
            {/* ปุ่มเลือกหน่วยงานจากบอร์ด (18 ส.ค. 2569) — คู่แฝดของปุ่มเลือกชื่อ
                dropdown เดิมยังอยู่ข้างล่าง สำหรับคนที่ชินกับของเก่า */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setUnitPickerOpen(true)}
                className={cn(
                  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium',
                  TONE.info.outline,
                )}
              >
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                เลือกหน่วยงานจากบอร์ด
              </button>
              {unitName ? (
                <span className="jarvis-chip jarvis-chip-info">{unitName}</span>
              ) : null}
            </div>

            {/* หน่วยงาน (096 · เจ้าของสั่ง 17 ส.ค. 2569) — เลือกจากใบขอแล้วรหัสไซต์ขึ้นเอง
                ⚠️ เก็บเป็น **ข้อความ ไม่ใช่ FK ไปใบขอ** — ใบขออยู่คนละฐาน (ERP) และเลขที่ใบ
                ยังซ้ำกันได้ (ใบขอปกติ vs ใบขอล่วงหน้า 23 ใบ · เลขท้ายชนข้าม BU อีก 234 ใบ)
                สิ่งที่งาน Follow ต้องการคือ "ตอนนั้นตามเรื่องของหน่วยงานไหน" = snapshot */}
            <div className="space-y-1.5">
              <label htmlFor="followUnit" className="ml-1 text-xs font-medium text-muted-foreground">
                หน่วยงาน (ถ้ามี)
              </label>
              {/* 🔴 **ไม่มี dropdown แล้ว** (เจ้าของสั่ง 18 ส.ค. 2569: *"พอเลือกหน่วยงานแล้ว
                  ให้ชื่อมาอยู่ในช่องหน่วยงาน เอา Dropdown ออก"*)
                  เหตุผลเสริม: การเลือก dropdown ด้วยคีย์บอร์ดกด Enter = ฟอร์มยิง submit เอง
                  ซึ่งทำให้บันทึกทั้งที่ยังไม่ได้ตั้งเวลา · ช่องข้อความไม่มีปัญหานั้น
                  พิมพ์เองได้สำหรับหน่วยงานที่ไม่มีใบขอเปิดบนบอร์ด */}
              <input
                id="followUnit"
                value={unitName}
                onChange={(e) => {
                  setUnitName(e.target.value);
                  // พิมพ์เองแล้วรหัสไซต์เดิมใช้ไม่ได้ — รหัสไซต์มาจากการ "เลือกจากบอร์ด" เท่านั้น
                  if (siteCode) setSiteCode('');
                }}
                placeholder="ชื่อหน่วยงาน"
                className="jarvis-soft-field min-h-[46px] w-full"
              />
              {siteCode ? (
                <p className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Building2 className="h-3 w-3" aria-hidden />
                  รหัสไซต์ <span className="font-mono font-medium text-foreground">{siteCode}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUnitName('');
                      setSiteCode('');
                    }}
                    className="ml-1 underline hover:text-foreground"
                  >
                    ล้าง
                  </button>
                </p>
              ) : null}
            </div>

            {/* 🔴 ช่องเบอร์เจ้าหน้าที่ **ย้ายไปขั้น 3 (หน้าตั้งวันเวลา)** แล้ว
                เจ้าของสั่ง 18 ส.ค. 2569 (ค่ำ-2): *"เบอร์โทร จนท ที่ติดตาม ต้องอยู่หน้ากรอก
                วันที่เวลา เพื่อจะได้ระบุเจ้าของแผนแต่ละวันได้"* — หนึ่งวันมีเจ้าของคนละคนได้ */}

            </>
            ) : null}

            {step === 3 ? (
            <>
            {/* สลับโหมด: รอบเดี่ยว/หลายรอบ (เวลาเจาะจง) vs ตารางหลายวัน (ช่วงวัน × รอบ/วัน) */}
            <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/40 p-1 text-xs dark:border-white/15 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setScheduleMode(false)}
                className={cn('flex-1 rounded-full px-3 py-1.5 font-medium', !scheduleMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
              >
                ระบุเวลาเอง
              </button>
              <button
                type="button"
                onClick={() => {
                  /* 🔴 สลับมาโหมดตารางแล้ว **ต้องมีวันตั้งต้น** (23 ก.ย. 2569) — ของเดิม
                     ช่องวันว่างทั้งคู่ ⇒ ปฏิทินรายวันไม่ขึ้น สรุปอ่านว่า "0 วัน" ทั้งที่ปุ่ม
                     "บันทึก + ส่ง AI โทร" ยังอยู่ กดแล้วได้แต่ error · เอาวันจากรอบแรกของ
                     โหมด "ระบุเวลาเอง" มาตั้งให้ ไม่ใช่ช่วงวันที่คิดขึ้นเอง */
                  const day = (scheduledAts[0] || '').slice(0, 10);
                  if (day) {
                    if (!dateFrom) setDateFrom(day);
                    if (!dateTo) setDateTo(dateFrom || day);
                  }
                  setScheduleMode(true);
                }}
                className={cn('flex-1 rounded-full px-3 py-1.5 font-medium', scheduleMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
              >
                ตารางหลายวัน
              </button>
            </div>

            {scheduleMode ? (
              /* ตารางโทร: ช่วงวัน × รอบเวลา/วัน (เจ้าของสั่ง 16 ส.ค. — เช่น 1-7 วันละ 2 รอบ) */
              <div className="space-y-2.5">
                {/* 🔴 **สองขั้น มีหัวข้อกำกับ** (เจ้าของสั่ง 23 ก.ย. 2569 · แก้รอบสอง:
                    *"เลือกช่วงวัน ไอตรงนี้แหละที่เอา แต่ละวันใครโทรอะมาไว้ข้างหลัง
                    แล้วทำเป็น Checkbox เลือกว่า Ai โทรหรือคนโทร แค่นี้เองทำไรให้มันซับซ้อนทำไม"*)

                    รอบแรกแยกเป็นสามขั้น (ช่วงวัน / รอบ / ใครโทร) — เจ้าของบอกว่ายังซับซ้อน
                    ⇒ **ยุบ "ใครโทร" เข้าไปอยู่ในขั้นเลือกช่วงวันเลย** เพราะมันคือเรื่องเดียวกัน
                    (กางช่วงวันเสร็จก็ติ๊กต่อได้ทันที ไม่ต้องเลื่อนไปอีกหัวข้อ) */}
                <p className="ml-1 text-xs font-medium text-foreground">1 · เลือกช่วงวัน</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor="followFrom" className="ml-1 text-xs font-medium text-muted-foreground">ตั้งแต่วันที่</label>
                    <input id="followFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="jarvis-soft-field min-h-[46px] w-full" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="followTo" className="ml-1 text-xs font-medium text-muted-foreground">ถึงวันที่</label>
                    <input id="followTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="jarvis-soft-field min-h-[46px] w-full" />
                  </div>
                </div>
                {/* เลือกได้ว่าจะส่งให้ Lumos วันไหนบ้าง (เจ้าของสั่ง 17 ส.ค. 2569)
                    ช่วงวันข้างบนเป็นแค่ตัวกางปฏิทิน · ติ๊กวันไหน วันนั้นถึงกลายเป็นสายจริง
                    เดิมส่งทุกวันในช่วง ข้ามเสาร์อาทิตย์/วันหยุดไม่ได้เลย */}
                {(() => {
                  const all = daysInRange(dateFrom, dateTo);
                  if (all.length === 0) return null;
                  const dayLabel = (ymd: string) => {
                    const d = new Date(`${ymd}T00:00:00+07:00`);
                    return d.toLocaleDateString('th-TH', {
                      timeZone: 'Asia/Bangkok',
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    });
                  };
                  /**
                   * 🔴 **สามสถานะต่อวัน** (121 · 20 ก.ย. 2569)
                   * AI โทร · เราโทรเอง · ไม่โทร
                   *
                   * ของเดิมมีแค่ ติ๊ก/ไม่ติ๊ก ⇒ วันที่ตั้งใจจะโทรเองไม่เหลือร่องรอยในระบบ
                   * ไม่มีใครรู้ว่าวันนั้นยังมีงานค้างอยู่ (เจ้าของสั่งให้เลือกเองรายวันได้)
                   *
                   * 🔴 **เลิกใช้ชิปกดวนทีละสถานะ** (เจ้าของสั่ง 23 ก.ย. 2569: *"ทำให้มัน
                   * เลือกง่ายกว่านี้หน่อย ตอนนี้มันเลือกยากไป … มีปุ่มติ๊กเลือกเอาว่าวันนี้
                   * ให้คนโทร AI โทร"*)
                   *
                   * ชิปวนบังคับให้คนเดาว่ากดอีกกี่ทีถึงจะได้อันที่ต้องการ (อยากได้ "ไม่โทร"
                   * ต้องกดสองที · เผลอกดเกินหนึ่งทีก็วนกลับไปต้นใหม่) และ**มองไม่เห็นเลยว่า
                   * มีทางเลือกอะไรบ้าง** จนกว่าจะกดไปเจอ
                   * ⇒ กางปุ่มทั้งสามให้เห็นพร้อมกันต่อวัน กดอันที่ต้องการตรง ๆ ทีเดียวจบ
                   */
                  const setDayMode = (d: string, mode: 'ai' | 'manual' | 'off') => {
                    const skipped = new Set(skippedDays);
                    const manual = new Set(manualDays);
                    skipped.delete(d);
                    manual.delete(d);
                    if (mode === 'off') skipped.add(d);
                    if (mode === 'manual') manual.add(d);
                    setSkippedDays(skipped);
                    setManualDays(manual);
                  };
                  const setAllDays = (mode: 'ai' | 'manual' | 'off') => {
                    setSkippedDays(mode === 'off' ? new Set(all) : new Set());
                    setManualDays(mode === 'manual' ? new Set(all) : new Set());
                  };
                  const modeOfDay = (d: string): 'ai' | 'manual' | 'off' =>
                    skippedDays.has(d) ? 'off' : manualDays.has(d) ? 'manual' : 'ai';
                  return (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="ml-1 text-xs font-medium text-muted-foreground">
                          เลือกว่าวันไหนให้ AI โทร วันไหนคนโทรเอง
                        </p>
                        <span className="flex items-center gap-2 text-[11px] font-medium">
                          <span className="text-muted-foreground">ทั้งหมด:</span>
                          <button type="button" onClick={() => setAllDays('ai')} className="text-primary underline">
                            AI โทร
                          </button>
                          <button type="button" onClick={() => setAllDays('manual')} className="text-amber-700 underline dark:text-amber-300">
                            คนโทร
                          </button>
                        </span>
                      </div>
                      {/**
                       * 🔴 **หนึ่งวัน = หนึ่งแถว · หลังวันมีสองช่องให้เลือก**
                       * (เจ้าของสั่ง 23 ก.ย. 2569 รอบสาม: *"ต้องการแบบเลือกว่า Ai โทร
                       * หรือคนโทร แบบ 2 ช่องให้เลือกอะ แล้วขอเป็นแถว ไม่ใช่ทำมาแบบนี้
                       * ดูแล้วงง เช่น เลือก 25-30 แบ่งแถว 25-30 มา แล้วหลังวันก็เลือก"*)
                       *
                       * ⚠️ **ห้ามกลับไปสองคอลัมน์** — เคยจัด `sm:grid-cols-2` ให้ 31 วันสั้นลง
                       * เจ้าของอ่านแล้วงงเพราะตาต้องกระโดดซ้าย-ขวา · แถวเดียวยาวกว่าแต่ไล่ตาลงได้
                       * ⚠️ **ห้ามยุบเหลือช่องติ๊กเดียว** — ติ๊ก/ไม่ติ๊ก บังคับให้คนแปลเองว่า
                       * "ไม่ติ๊ก" แปลว่าอะไร · สองช่องเขียนคำไว้ทั้งคู่ อ่านแล้วรู้เลย
                       */}
                      <div className="space-y-1">
                        {all.map((d) => {
                          const mode = modeOfDay(d);
                          /**
                           * 🔴 สามช่องต่อวัน: AI โทร · คนโทร · **ไม่โทร** (เจ้าของ Choice 1 ต.ค. 2569 "ข้ามวันไม่ได้ → แก้")
                           * เลือกได้ทีละช่อง · กดช่องที่ติ๊กอยู่แล้วไม่ทำอะไร (ทุกวันต้องมีสถานะเสมอ)
                           */
                          const choices: ReadonlyArray<{ value: ScheduleDayMode; label: string; on: string }> = [
                            { value: 'ai', label: 'AI โทร', on: 'text-primary' },
                            { value: 'manual', label: 'คนโทร', on: 'text-amber-700 dark:text-amber-300' },
                            { value: 'off', label: 'ไม่โทร', on: 'text-foreground' },
                          ];
                          return (
                            <div
                              key={d}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/70 bg-white/40 px-2.5 py-1.5 dark:border-white/15 dark:bg-white/5"
                            >
                              <span
                                className={cn(
                                  'flex-1 text-xs font-medium',
                                  mode === 'off' ? 'text-muted-foreground line-through' : 'text-foreground',
                                )}
                              >
                                {dayLabel(d)}
                              </span>
                              {choices.map((c) => (
                                <label key={c.value} className="flex cursor-pointer items-center gap-1.5">
                                  <Checkbox
                                    checked={mode === c.value}
                                    onCheckedChange={() => setDayMode(d, c.value)}
                                    aria-label={`${dayLabel(d)} — ${c.label}`}
                                  />
                                  <span
                                    className={cn(
                                      'text-xs font-medium',
                                      mode === c.value ? c.on : 'text-muted-foreground',
                                    )}
                                  >
                                    {c.label}
                                  </span>
                                </label>
                              ))}
                            </div>
                          );
                        })}
                      </div>

                      {/* เบอร์เจ้าหน้าที่ **ใต้วันที่ที่ติดตาม** (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-2)
                          โชว์เฉพาะวันที่ติ๊กไว้ — วันที่ไม่ส่งไม่มีเจ้าของแผน จะโชว์ก็รกเปล่า ๆ
                          ⚠️ ช่องนี้แชร์ลิสต์กันผ่านแคชระดับโมดูล (ไม่ยิงเส้นตัวละครั้ง)

                          🔴 **ค่าตั้งต้นคือชุดเดียว** (23 ก.ย. 2569) — กางทุกวันทำให้ฟอร์ม
                          ยาว 31 ชุดจนหาปุ่มบันทึกไม่เจอ · อยากระบุรายวันให้เปิดสวิตช์ */}
                      {(() => {
                        const sendDays = all.filter((d) => !skippedDays.has(d));
                        if (sendDays.length === 0) return null;
                        return (
                          <div className="mt-1.5 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                                เจ้าหน้าที่ที่ติดตาม {perDayStaff ? '· ระบุรายวัน' : `· ใช้เบอร์นี้ทั้ง ${sendDays.length} วัน`}
                              </span>
                              {sendDays.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // เปิดรายวัน = เติมเบอร์ชุดเดียวลงทุกวันให้ก่อน แล้วค่อยแก้เฉพาะวันที่ต่าง
                                    if (!perDayStaff && staffPhoneAll.trim()) {
                                      setStaffPhoneByDay((prev) => {
                                        const next = { ...prev };
                                        for (const d of sendDays) if (!next[d]) next[d] = staffPhoneAll.trim();
                                        return next;
                                      });
                                    }
                                    setPerDayStaff((v) => !v);
                                  }}
                                  className="text-[11px] font-medium text-primary underline"
                                >
                                  {perDayStaff ? 'ใช้เบอร์เดียวทุกวัน' : 'ระบุเจ้าของแผนรายวัน'}
                                </button>
                              ) : null}
                            </div>
                            {perDayStaff ? (
                              sendDays.map((d) => (
                                <div
                                  key={d}
                                  className="rounded-xl border border-white/70 bg-white/40 p-2.5 dark:border-white/15 dark:bg-white/5"
                                >
                                  <StaffContactField
                                    id={`followStaffPhoneDay${d}`}
                                    label={`เจ้าหน้าที่ที่ติดตาม · ${dayLabel(d)}`}
                                    value={staffPhoneByDay[d] ?? ''}
                                    onChange={(next) =>
                                      setStaffPhoneByDay((prev) => ({ ...prev, [d]: next }))
                                    }
                                    reloadSignal={contactsRev}
                                  />
                                </div>
                              ))
                            ) : (
                              <div className="rounded-xl border border-white/70 bg-white/40 p-2.5 dark:border-white/15 dark:bg-white/5">
                                <StaffContactField
                                  id="followStaffPhoneAll"
                                  label="เจ้าหน้าที่ที่ติดตาม (ถ้ามี)"
                                  value={staffPhoneAll}
                                  onChange={setStaffPhoneAll}
                                  reloadSignal={contactsRev}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
                <div className="space-y-1.5">
                  <p className="ml-1 text-xs font-medium text-foreground">2 · วันละกี่สาย</p>
                  {/* 🔴 ตั้งเวลารายวันได้ (เจ้าของ Choice 1 ต.ค. 2569 "ทุกวันต้องใช้เวลาเดียวกัน → แก้") —
                      ปิดอยู่ = ชุดเดียวทุกวันเหมือนเดิม · เปิดครั้งแรกลอกชุดเดียวลงทุกวันให้ก่อน */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="ml-1 text-xs font-medium text-muted-foreground">
                      {perDayTimes ? 'เวลารายวัน (วันละไม่เกิน 5 สาย)' : 'เวลาต่อวัน (สูงสุด 5 สาย)'}
                    </span>
                    {sendDaysPreview > 1 ? (
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        onClick={() => {
                          if (!perDayTimes) {
                            setRoundTimesByDay((prev) => {
                              const next = { ...prev };
                              for (const d of daysInRange(dateFrom, dateTo)) if (!next[d]) next[d] = [...roundTimes];
                              return next;
                            });
                          }
                          setPerDayTimes((v) => !v);
                        }}
                      >
                        {perDayTimes ? 'ใช้เวลาเดียวกันทุกวัน' : 'ตั้งเวลารายวัน'}
                      </Button>
                    ) : null}
                  </div>
                  {perDayTimes ? (
                    daysInRange(dateFrom, dateTo)
                      .filter((d) => modeOfScheduleDay(d) !== 'off')
                      .map((d) => {
                        const list = timesOfScheduleDay(d);
                        const label = scheduleDayLabel(d);
                        return (
                          <div key={d} className="space-y-1.5 rounded-xl border border-border/70 p-2.5">
                            <p className="text-xs font-medium text-foreground">{label}</p>
                            {list.map((v, i) => (
                              <div key={i} className="flex flex-wrap items-center gap-2">
                                {v === SCHEDULE_TBD ? (
                                  <span className={cn('min-h-[46px] flex-1 content-center text-sm', TONE.warn.value)}>
                                    สายที่ {i + 1} · ยังไม่ชัวร์เวลา
                                  </span>
                                ) : (
                                  <TimeSelect24
                                    value={v}
                                    onChange={(next) => setDayTimeAt(d, i, next)}
                                    label={`${label} สายที่ ${i + 1}`}
                                    className="min-h-[46px] flex-1"
                                  />
                                )}
                                <label className="flex cursor-pointer items-center gap-1.5">
                                  <Checkbox
                                    checked={v === SCHEDULE_TBD}
                                    onCheckedChange={(on) => setDayTimeAt(d, i, on ? SCHEDULE_TBD : '08:00')}
                                    aria-label={`${label} สายที่ ${i + 1} ยังไม่ชัวร์เวลา`}
                                  />
                                  <span className="text-xs text-muted-foreground">ยังไม่ชัวร์เวลา</span>
                                </label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => removeDayTime(d, i)}
                                  disabled={list.length <= 1}
                                  aria-label={`เอาสายที่ ${i + 1} ของ${label}ออก`}
                                >
                                  <X aria-hidden />
                                </Button>
                              </div>
                            ))}
                            {list.length < 5 ? (
                              <Button type="button" variant="outline" size="xs" onClick={() => addDayTime(d)}>
                                <Plus aria-hidden /> เพิ่มสายของวันนั้น
                              </Button>
                            ) : null}
                          </div>
                        );
                      })
                  ) : (
                    <>
                  {roundTimes.map((v, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      {/**
                       * 🔴 **ห้ามกลับไปใช้ `<input type="time">`** (เจ้าของทัก 20 ก.ย. 2569:
                       * *"หน้าการติดตาม บางคนยังขึ้น am pm อยู่เลย"*)
                       *
                       * ช่องเวลาของเบราว์เซอร์แสดงผลตาม **ภาษาของเครื่องคนใช้** ไม่ใช่ของหน้าเว็บ
                       * ⇒ เครื่องที่ตั้งเป็นอังกฤษ (สหรัฐ) เห็น `05:50 AM` เครื่องไทยเห็น `05:50`
                       * คนละหน้าจอกันทั้งที่เป็นข้อมูลชุดเดียวกัน · `lang` ของหน้าเว็บสั่งไม่ได้
                       * (ลองแล้ว Chrome ไม่สนใจ) ⇒ ต้องเลิกใช้ช่องของเบราว์เซอร์
                       */}
                      {v === SCHEDULE_TBD ? (
                        <span className={cn('min-h-[46px] flex-1 content-center text-sm', TONE.warn.value)}>
                          สายที่ {i + 1} · ยังไม่ชัวร์เวลา
                        </span>
                      ) : (
                        <TimeSelect24
                          value={v}
                          onChange={(next) => setRoundAt(i, next)}
                          label={`สายที่ ${i + 1}`}
                          className="min-h-[46px] flex-1"
                        />
                      )}
                      {/* ยังไม่ชัวร์เวลา (เจ้าของ 5 ต.ค. 2569 · Choice "เลือกได้ทีละสาย") — สายนี้ทุกวันเป็นคนโทร ไปเติมเวลาทีหลัง */}
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <Checkbox
                          checked={v === SCHEDULE_TBD}
                          onCheckedChange={(on) => setRoundAt(i, on ? SCHEDULE_TBD : '08:00')}
                          aria-label={`สายที่ ${i + 1} ยังไม่ชัวร์เวลา`}
                        />
                        <span className="text-xs text-muted-foreground">ยังไม่ชัวร์เวลา</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRound(i)}
                        disabled={roundTimes.length <= 1}
                        aria-label={`เอาสายที่ ${i + 1} ออก`}
                        className="inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/60 text-slate-600 hover:text-foreground disabled:opacity-40 dark:border-white/15 dark:bg-white/10 dark:text-slate-300"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                  {roundTimes.length < 5 ? (
                    <button
                      type="button"
                      onClick={addRound}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/70 bg-white/60 px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-foreground dark:border-white/15 dark:bg-white/10 dark:text-slate-300"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden /> เพิ่มสายต่อวัน
                    </button>
                  ) : null}
                    </>
                  )}
                </div>
                {(() => {
                  /* 🔴 แยกยอดสองฝั่งให้เห็นตั้งแต่ก่อนกดบันทึก — "กี่สาย" อย่างเดียวไม่พอ
                     เพราะสายที่เราโทรเองคือ **งานของคน** ไม่ใช่สายที่ระบบจะจัดการให้
                     · นับจาก `scheduleCalls` ตัวเดียวกับตอนส่ง (เวลารายวัน + วันที่ไม่โทร)
                     · ถอดท้ายประโยค "รับสายยืนยันแล้ววันนั้นหยุด พรุ่งนี้โทรต่อ" (1 ต.ค. 2569) — ของจริง AI โทรครบทุกสาย */
                  const calls = scheduleCalls();
                  const ai = calls.filter((c) => c.callMode === 'ai').length;
                  const days = new Set(calls.map((c) => c.day)).size;
                  return calls.length > 0 ? (
                    <p className="ml-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                      รวม {days} วัน {calls.length} สาย — AI โทร {ai} · เราโทรเอง {calls.length - ai}
                    </p>
                  ) : (
                    <p className="ml-1 text-[11px] text-muted-foreground">ยังไม่มีสาย</p>
                  );
                })()}
              </div>
            ) : (
            /* ให้โทรเมื่อไหร่ — เพิ่มได้หลายรอบ · หนึ่งรอบ = หนึ่งรายการในคิว มีสถานะ/ผลของตัวเอง */
            <div className="space-y-1.5">
              <label htmlFor="followWhen0" className="ml-1 text-xs font-medium text-muted-foreground">
                ให้โทรเมื่อไหร่
              </label>
              {/* หนึ่งรอบ = วันเวลา + **เบอร์เจ้าหน้าที่ของรอบนั้น** (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-2)
                  เบอร์อยู่ใต้วันที่เลย เพื่อระบุเจ้าของแผนของรอบนั้นได้ */}
              <div className="space-y-2.5">
                {scheduledAts.map((v, i) => (
                  <div
                    key={i}
                    className="space-y-1.5 rounded-xl border border-white/70 bg-white/40 p-2.5 dark:border-white/15 dark:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      {/* 🔴 ห้ามกลับไปใช้ `<input type=datetime-local>` — ขึ้น AM/PM
                          ตามภาษาของเครื่องคนใช้ (ดู `DateTimeField24`)
                          "ยังไม่ชัวร์เวลา" = เลือกแค่วัน (ค่าเป็น YYYY-MM-DD · เวลาไว้เติมทีหลัง) */}
                      {(callModes[i] ?? 'ai') === 'tbd' ? (
                        <span className="flex min-h-[46px] flex-1 items-center">
                          <DayCalendarPicker
                            value={/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''}
                            onChange={(ymd) => setScheduledAtAt(i, ymd)}
                            emptyLabel={`เลือกวันของสายที่ ${i + 1}`}
                          />
                        </span>
                      ) : (
                      <DateTimeField24
                        value={/^\d{4}-\d{2}-\d{2}$/.test(v) ? '' : v}
                        onChange={(next) => setScheduledAtAt(i, next)}
                        label={`สายที่ ${i + 1}`}
                        className="min-h-[46px] flex-1"
                      />
                      )}
                      <button
                        type="button"
                        onClick={() => removeScheduledAt(i)}
                        disabled={scheduledAts.length <= 1}
                        title={scheduledAts.length <= 1 ? 'ต้องมีอย่างน้อย 1 สาย' : 'เอาสายนี้ออก'}
                        aria-label={`เอาสายที่ ${i + 1} ออก`}
                        className={cn(
                          'inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border',
                          'border-white/70 bg-white/60 text-slate-600 hover:text-foreground',
                          'dark:border-white/15 dark:bg-white/10 dark:text-slate-300',
                          'disabled:cursor-not-allowed disabled:opacity-40',
                        )}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    {/* ใครโทรรอบนี้ (เจ้าของสั่ง 2 ต.ค. 2569) + "ยังไม่ชัวร์เวลา" (Journey ข้อ 5 · 3 ต.ค. 2569)
                        ยังไม่ชัวร์เวลา = เลือกแค่วัน แล้วมาเติมเวลาทีหลัง (เป็นคนโทรจนกว่าจะตั้งเวลา) */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1" role="group" aria-label={`ใครโทรสายที่ ${i + 1}`}>
                      {(
                        [
                          { value: 'ai', label: 'AI โทร', on: 'text-primary' },
                          { value: 'manual', label: 'คนโทร', on: TONE.warn.value },
                          { value: 'tbd', label: 'ยังไม่ชัวร์เวลา', on: TONE.warn.value },
                        ] as const
                      ).map((c) => (
                        <label key={c.value} className="flex cursor-pointer items-center gap-1.5">
                          <Checkbox
                            checked={(callModes[i] ?? 'ai') === c.value}
                            onCheckedChange={() => setCallModeAt(i, c.value)}
                            aria-label={`สายที่ ${i + 1} — ${c.label}`}
                          />
                          <span className={cn('text-xs font-medium', (callModes[i] ?? 'ai') === c.value ? c.on : 'text-muted-foreground')}>
                            {c.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <StaffContactField
                      id={`followStaffPhone${i}`}
                      label={`เจ้าหน้าที่ที่ติดตามสายที่ ${i + 1}`}
                      value={staffPhones[i] ?? ''}
                      onChange={(next) => setStaffPhoneAt(i, next)}
                      reloadSignal={contactsRev}
                    />
                    {/* ═══ นี่คือสายที่เท่าไหร่ (เจ้าของสั่ง 1 ก.ย. 2569) ═══
                        *"เลือกวันเวลาเสร็จของรอบแรก ก็มี Dropdown ให้เลือกเลยว่านี่คือ สาย 1 2 3
                         แล้วพอเพิ่มรอบก็เหมือนกัน พอเลือกแล้วบอกหน่อยว่า Scrip นั้น ๆ จะพูดอะไรบ้าง"*
                        🔴 ค่านี้ **ส่งขึ้นไปจริง** และเป็นตัวตัดสินว่า AI พูดบทไหน
                        (ก่อนหน้านี้ทุกรอบพูดบทสายแรกหมด ทั้งที่จอเขียนว่ารอบ 2 ใช้อีกบท) */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`followCallRound${i}`}
                        className="ml-1 text-xs font-medium text-muted-foreground"
                      >
                        สายนี้คือสายที่เท่าไหร่
                      </label>
                      <select
                        id={`followCallRound${i}`}
                        value={callRounds[i] ?? i + 1}
                        onChange={(e) => setCallRoundAt(i, Number(e.target.value))}
                        className="jarvis-soft-field min-h-[46px] w-full"
                      >
                        {Array.from(
                          /* อย่างน้อย 3 ตัวเลือกเสมอ · ตั้งรอบเกิน 3 ก็ต้องเลือกเลขที่สูงกว่าได้ */
                          { length: Math.max(3, scheduledAts.length) },
                          (_, n) => n + 1,
                        ).map((n) => (
                          <option key={n} value={n}>
                            {roundTabLabel(n)}
                            {n === 1 ? ' (สายแรก)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* บทที่รอบนี้จะพูด — กางให้เห็นเลย ไม่ต้องกดหา (เจ้าของสั่งให้ "บอกหน่อยว่า Scrip
                        นั้น ๆ จะพูดอะไรบ้าง") */}
                    <RoundScriptNote callRound={callRounds[i] ?? i + 1} defaultOpen />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addScheduledAt}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/70 bg-white/60 px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-foreground dark:border-white/15 dark:bg-white/10 dark:text-slate-300"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> เพิ่มสาย
              </button>
              {/* ประโยคอธิบาย "ใส่ได้หลายรอบ…" ถอดแล้ว (4 ต.ค. 2569 ไล่ Journey — คำว่ารอบค้าง + เจ้าของไม่เอาประโยคอธิบาย) */}
            </div>
            )}
            </>
            ) : null}

            {formError ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {formError}
              </p>
            ) : null}

            {/**
             * 🔴 **ทวนก่อนกดส่ง** (12 ก.ย. 2569) — ผู้ทดสอบตาใหม่บอกว่าไม่มี preview
             * เลยไม่กล้ากดบันทึก เพราะไม่รู้ว่าจะโทรหาใคร เรื่องอะไร กี่รอบ
             * ⚠️ ทวนจากค่าที่กรอกจริงในฟอร์ม **ห้ามคำนวณใหม่แยกทาง** ไม่งั้นสิ่งที่ทวน
             * กับสิ่งที่ส่งจะไม่ใช่ของเดียวกัน
             */}
            {step === 3 ? (
              <div className={cn('rounded-xl px-3 py-2.5 text-[12px] leading-snug', TONE.primary.soft)}>
                <span className="block font-medium text-foreground">ทวนก่อนส่ง</span>
                <span className="mt-0.5 block text-foreground/80">
                  โทรหา{' '}
                  <span className="font-medium">
                    {composeRecipientName(prefix, firstName, lastName) || '— ยังไม่ได้กรอกชื่อ —'}
                  </span>{' '}
                  เบอร์ <span className="tabular-nums">{phone || '—'}</span>
                  {topic ? <> · เรื่อง “{topic}”</> : null}
                  {unitName ? <> · หน่วยงาน {unitName}</> : null}
                </span>
                <span className="mt-0.5 block text-muted-foreground">
                  {scheduleMode
                    ? `ตารางหลายวัน — ${sendDaysPreview} วัน รวม ${scheduleCallsPreview} สาย`
                    : `ตั้งไว้ ${scheduledAtsPreview} สาย`}
                  {!scheduleMode && manualTimesPreview > 0
                    ? ` · คนโทร ${manualTimesPreview} สาย · AI โทร ${scheduledAtsPreview - manualTimesPreview} สาย`
                    : ''}
                </span>
              </div>
            ) : null}

            {/* ปุ่มเดินขั้น — ปุ่มบันทึกโผล่เฉพาะขั้นสุดท้าย กันกดส่งตั้งแต่ยังไม่ตั้งเวลา */}
            <div className="flex flex-wrap gap-2">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    goToStep(prevFollowStep(step));
                  }}
                  className={cn(
                    'inline-flex min-h-[46px] items-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-medium',
                    TONE.neutral.outline,
                  )}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden /> ย้อนกลับ
                </button>
              ) : null}

              {step < 3 ? (
                <Button size="sm"
                  type="button"
                  onClick={goNext}
                  className="inline-flex min-h-[46px] items-center gap-1.5 px-6 py-2.5 text-sm"
                >
                  ถัดไป <ChevronRight aria-hidden />
                </Button>
              ) : (
                <Button size="sm"
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting}
                  className="inline-flex min-h-[46px] items-center gap-1.5 px-6 py-2.5 text-sm"
                >
                  {submitting ? (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  ) : (
                    <PhoneForwarded aria-hidden />
                  )}
                  {submitting
                    ? `กำลังบันทึก…${submitProgress ? ` ${submitProgress}` : ''}`
                    : !scheduleMode && manualTimesPreview >= scheduledAtsPreview
                      ? 'บันทึก'
                      : 'บันทึก + ส่ง AI โทร'}
                </Button>
              )}
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                className={cn(
                  'inline-flex min-h-[46px] items-center rounded-full border px-5 py-2.5 text-sm font-medium',
                  TONE.neutral.outline,
                )}
              >
                ยกเลิก
              </button>
            </div>
          </form>
            </>
            )}
          </DialogContent>
        </Dialog>

        {/* ⚠️ ชิปกรอง "ทั้งหมด / รอโทร / กำลังโทร / โทรสำเร็จ / ไม่สำเร็จ" ถูกถอดออก
            (เจ้าของสั่ง 18 ส.ค. 2569 ให้เอาไปแทนด้วยแผง 3 รอบด้านบน)
            แผงใหม่ให้ข้อมูลมากกว่าเดิม: แยกตามรอบโทร + กดแล้วเห็นชื่อพร้อมรายละเอียด
            ทั้งที่ชิปเดิมบอกได้แค่ยอดรวมข้ามรอบ

            ⚠️ state `filter` ยังอยู่และยังกรองรายการข้างล่างตามเดิม — ตอนนี้ค้างที่
            'all' เสมอ · จะเอาชิปกลับมาก็แค่คืน block นี้ ไม่ต้องรื้ออย่างอื่น */}


        {/* 🔴 กล่อง "ยังไม่มีรายชื่อที่ต้องติดตาม" ท้ายหน้าถอดแล้ว (เจ้าของสั่ง 1 ต.ค. 2569) — ขึ้นเฉพาะแท็บที่ว่าง
            ⇒ สลับแท็บแล้วหน้ายืด/หด · ว่างก็ดูจากเลข 0 บนการ์ดและตารางที่อยู่ครบแล้ว */}

        {/* การ์ด "ติดตามครบ" (เจ้าของสั่ง 1 ต.ค. 2569 · Choice "การ์ดแยกบนหน้า") — ตามครบรอบแล้ว
            กองรอคนกดว่าจะย้ายไปดูแลหลังเริ่มงานไหม · รับชุดของแท็บที่เปิด (ไม่ผ่านตัวกรองงานจบหรือยัง/วันที่)
            ⚠️ กล่องเดิม "โทรได้คำตอบแล้ว…" (ถอด 20 ก.ย.) ห้ามคืน — การ์ดนี้นับเฉพาะคนที่ยังไม่มีใครตัดสิน
            จึงไม่ซ้ำกับเลขแท็บสำเร็จ (ย้าย/ไม่ย้าย = ปิดงานแล้ว ออกจากกองทันที) */}
        {lastLoadedAt === null ? null : (
          <FollowCompletedCard
            /* สลับแท็บ = การ์ดใหม่ ข้อความแจ้งผลของอีกแท็บไม่ตามมา (QA 5 ต.ค. 2569) */
            key={followTeam ?? "main"}
            groups={scopePeople}
            followTeam={followTeam}
            onChanged={() => void reload(true)}
          />
        )}
      </div>
      )}

      {/* ป๊อปรายละเอียดของช่องปฏิทิน — ปุ่มทำงานทั้งหมดอยู่ในนี้
          🔴 กด "แก้ไข" ต้องปิดป๊อปนี้ก่อน แล้วค่อยเปิดกล่องแก้ไข (ห้ามซ้อน Dialog) */}
      <FollowRoundsDialog
        open={Boolean(openCell)}
        onClose={() => setOpenCell(null)}
        group={cellDetail?.group ?? null}
        ymd={cellDetail?.ymd || null}
        rounds={cellDetail?.rounds ?? []}
        busyId={busyId}
        cancellingId={cancellingId}
        onAskCancel={setCancellingId}
        onCancel={(id) => void doCancel(id)}
        onEdit={(entry) => {
          setCellToReopen(openCell);
          setOpenCell(null);
          setEditing(entry);
        }}
        onComplete={doComplete}
        onReopen={(id) => void doReopen(id)}
        onStaffCall={(id, outcome, note) => void doStaffCall(id, outcome, note)}
        onStaffCallClear={doStaffCallClear}
        onPurge={canPurge ? (id) => void doPurge(id) : null}
        purgingId={purgingId}
        onAskPurge={setPurgingId}
      />

      <FollowDayReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        ymd={fDate || toYmdBangkok(new Date())}
        entries={scopeItems}
      />

      <BoardPersonPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={pickPerson}
      />

      <BoardUnitPicker
        open={unitPickerOpen}
        onClose={() => setUnitPickerOpen(false)}
        units={unitOptions}
        onPick={pickUnit}
      />

      {/* popup เตือนลงซ้ำ (เจ้าของสั่ง 18 ส.ค. 2569) — บอกชนกับใคร เวลาไหน
          เลือกได้: บันทึกเฉพาะรอบที่ไม่ซ้ำ หรือกลับไปแก้ · ไม่มีปุ่ม "บันทึกซ้ำทั้งหมด"
          (ตั้งซ้อนเวลาเดิม = AI โทรหาคนเดิมสองสายพร้อมกัน ไม่มีเคสที่ตั้งใจทำแบบนั้น) */}
      {dupWarning ? (
        /**
         * 🔴 **ใช้ AlertDialog ของ shadcn** (4 ก.ย. 2569 — เจ้าของสั่ง *"ห้ามหลุด Framework"*)
         * เดิมปั้นเอง (`fixed inset-0` + `role="alertdialog"`) ⇒ ไม่มี focus trap
         * และปิดด้วย Esc ไม่ได้ · กล่องเตือนแบบนี้ต้องบังคับให้เลือกทางใดทางหนึ่ง
         * จึงเป็น AlertDialog (ไม่ใช่ Dialog ธรรมดาที่กดข้างนอกแล้วปิดได้)
         */
        <AlertDialog open onOpenChange={(o) => (o ? undefined : setDupWarning(null))}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base">
                ลงซ้ำกับรายการที่มีอยู่แล้ว
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs">
                เบอร์นี้มีคิวโทรเวลาเดียวกันอยู่แล้ว — ตั้งซ้ำ = AI โทรซ้อนหาคนเดิม
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="space-y-1.5">
              {dupWarning.duplicates.map((d) => (
                <li
                  key={d.iso}
                  className={cn('rounded-lg border px-3 py-2 text-xs', TONE.warn.soft, TONE.warn.value)}
                >
                  <span className="font-medium">{d.existingName}</span>
                  {' · '}
                  {new Date(d.iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                </li>
              ))}
            </ul>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDupWarning(null)}>กลับไปแก้เวลา</AlertDialogCancel>
              {dupWarning.freshIso.length > 0 ? (
                <AlertDialogAction
                  onClick={() => {
                    const go = dupWarning.proceed;
                    setDupWarning(null);
                    void go();
                  }}
                >
                  บันทึกเฉพาะที่ไม่ซ้ำ ({dupWarning.freshIso.length.toLocaleString('th-TH')} สาย)
                </AlertDialogAction>
              ) : null}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {/* dialog จัดการเรื่อง / เจ้าหน้าที่ (เปิดจากปุ่มข้างปฏิทิน · supervisor+) */}
      <FollowMasterManagerDialog<FollowTopic>
        open={topicManagerOpen}
        onClose={() => setTopicManagerOpen(false)}
        title="เรื่องที่จะให้โทรติดตาม"
        description=""
        fields={[{ key: 'name', placeholder: 'เพิ่มเรื่องใหม่ เช่น ติดตามเบิกเบี้ยเลี้ยง' }]}
        load={listFollowTopics}
        create={(f) => createFollowTopic(f.name ?? '')}
        toChip={(t) => t.name}
        onChanged={() => setTopicsRev((r) => r + 1)}
      />
      <FollowMasterManagerDialog<FollowStaffContact>
        open={staffManagerOpen}
        onClose={() => setStaffManagerOpen(false)}
        title="เบอร์คนที่ไม่มีบัญชีผู้ใช้"
        description="ตัวจริงของชื่อ-เบอร์เจ้าหน้าที่อยู่ที่ ตั้งค่า → ผู้ใช้งาน (ชื่อเล่น + สายงาน + เบอร์) · ที่นี่ไว้สำหรับคนที่ไม่มีบัญชีในระบบเท่านั้น"
        fields={[
          { key: 'name', placeholder: 'ชื่อเจ้าหน้าที่ เช่น คุณคิว ทีมสรรหา' },
          { key: 'phone', placeholder: 'เบอร์โทร เช่น 021234567 ต่อ 101', inputMode: 'tel' },
        ]}
        load={listStaffContacts}
        create={(f) => createStaffContact(f.name ?? '', f.phone ?? '')}
        toChip={(c) => `${c.name} — ${c.phone}`}
        onChanged={() => setContactsRev((r) => r + 1)}
      />

      <FollowEditDialog
        entry={editing}
        unitOptions={unitOptions}
        topicsRev={topicsRev}
        contactsRev={contactsRev}
        /**
         * รอบอื่นของ "คนเดียวกัน" — จับคู่ด้วย **เบอร์ + เรื่อง** (ไม่มี group ผูกให้ทุกเคส
         * · เบอร์อย่างเดียวไม่พอ คนเดียวอาจถูกตามหลายเรื่องพร้อมกัน)
         */
        siblings={
          editing
            ? items.filter(
                (x) =>
                  x.recipient_phone === editing.recipient_phone &&
                  x.topic === editing.topic,
              )
            : []
        }
        /* ปิดกล่องแก้ไข = กลับเข้าป๊อปของช่องเดิมให้เอง — ทำงานต่อได้ไม่ต้องไล่หาใหม่ */
        onClose={() => {
          setEditing(null);
          if (cellToReopen) {
            setOpenCell(cellToReopen);
            setCellToReopen(null);
          }
        }}
        onSaved={(msg) => {
          setOkMessage(msg);
          window.setTimeout(() => setOkMessage(null), 7000);
          void reload();
        }}
      />
    </div>
  );
};

export default FollowPage;
