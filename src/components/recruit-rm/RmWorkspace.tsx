import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GlassTabIndicator, glassTabClass, glassTabsListClass } from '@/components/ui/tabs';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronRight, Download, FileSpreadsheet, RefreshCw, RotateCcw, X } from 'lucide-react';
import FilterChips from '@/components/shared/FilterChips';
import FilterChipsDropdown from '@/components/shared/FilterChipsDropdown';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { PagePager } from '@/components/shared/PagePager';
import { getTotalPages, PAGE_SIZE_OPTIONS, type PageSizeOption } from '@/lib/pagination';
import DateRangeCalendarPicker, { type DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import RmSearchBar, { RM_SEARCH_PLACEHOLDER } from '@/components/recruit-rm/RmSearchBar';
import { useHeaderSearch } from '@/hooks/useHeaderSearch';
import RmTable from '@/components/recruit-rm/RmTable';
import { MyCallsSection } from '@/pages/matching/MyCallsPage';
import AddApplicantDialog from '@/components/recruit-rm/AddApplicantDialog';
import ImportApplicantsDialog from '@/components/recruit-rm/ImportApplicantsDialog';
import ApplicantContactDialog from '@/components/recruit-rm/ApplicantContactDialog';
import {
  EMPTY_RM_FILTERS,
  RM_ROW_ACTION_LABEL,
  RM_TABS,
  RM_TAB_LABEL,
  filterApplications,
  isInRmTab,
  isInRmListView,
  isShownRmListView,
  RM_LIST_VIEWS,
  RM_LIST_VIEWS_SHOWN,
  RM_LIST_VIEW_DEFAULT,
  RM_LIST_VIEW_LABEL,
  type RmListView,
  telHref,
  type RmRowAction,
  type RmTab,
} from '@/lib/recruitRm';
import {
  chooseApplicationCall,
  fetchAllJobApplications,
  markApplicationDialed,
  recordAppointmentAttendance,
  setApplicationCancelled,
  setJobApplicationLead,
  type CallChoiceOutcome,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import { downloadApplicantExport } from '@/lib/applicantExport';
import { summarizeCallChoice } from '@/lib/callChoiceSummary';
import CallChoiceConfirmDialog from '@/components/recruit-rm/CallChoiceConfirmDialog';
import { ATTENDANCE_LABEL, type AttendanceResult } from '@/lib/appointmentAttendance';
import { SCREENING_LABEL, isScreeningResult, type ScreeningResult } from '@/lib/appointmentScreening';
import {
  APPOINTMENT_CHIPS,
  appointmentChipCount,
  buildAppointmentBoard,
  isInAppointmentChip,
  type AppointmentChip,
} from '@/lib/appointmentBoard';
import { CONTACT_CHIPS, isInContactChip, type ContactChip } from '@/lib/recruitRm';
import {
  RM_APPOINTMENT_SCOPES,
  RM_APPOINTMENT_SCOPE_LABEL,
  canSeeEveryoneAppointments,
  isRmAppointmentScope,
  type RmAppointmentScope,
} from '@/lib/recruitRm';
import { formatYmdTh, toYmdBangkok } from '@/lib/dateTh';
import { buildAppointmentPlaces, isInAppointmentPlace, placeKeyOf, shiftYmd } from '@/lib/appointmentPlaces';
import AppointmentPlacesCard from '@/components/recruit-rm/AppointmentPlacesCard';
import AppointmentPrintSheet, { type AppointmentPrintGroup } from '@/components/recruit-rm/AppointmentPrintSheet';
import { appointmentTimeOf } from '@/lib/appointmentTime';
import { RM_BUCKET_LABEL, isRmBucket } from '@/lib/recruitRmOverviewApi';
import RecruitDailyPanel from '@/components/recruit-rm/RecruitDailyPanel';
import { LEAD_VIEW_LABEL } from '@/lib/recruitLead';
import { fetchCallHoldsByPhones, type CallHold } from '@/lib/callHoldsApi';
import { canHoldApplication } from '@/lib/recruitRm';
import { choiceCountdown } from '@/lib/callChoiceGuard';
import { useAuth } from '@/contexts/AuthContext';
import {
  FilterSheetButton,
  FilterSidebar,
  FilterRail,
  type FilterExtraSection,
} from '@/components/jobs/BoardFilterPanel';
import { buildJobKeyIndex } from '@/lib/jobKeyIndex';
import type { JobRequest } from '@/types';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { bindJobOptions } from '@/lib/bindJobPicker';

/** ค่าในช่องเลือกใบขอ = ส่งบททักทายทั่วไปแทนการผูกใบขอ */
const GREET_OPTION = '__greet__';
import { publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import {
  APPLICANT_FACET_ATTACH,
  applicantPrimaryFacets,
  EMPTY_APPLICANT_FILTER_STATE,
  applyApplicantFilters,
  buildApplicantFacets,
  countSelectedApplicantValues,
  readApplicantFilterState,
  toggleApplicantFacetValue,
  writeApplicantFilterState,
  type ApplicantFacetFacts,
  type ApplicantFacetKey,
  type ApplicantFilterState,
} from '@/lib/applicantFilters';
import { friendlyErrorText } from '@/lib/friendlyError';

/** แท็บของพื้นที่นี้ → `?view=` ของบอร์ดรับสมัคร · ชื่อแท็บใช้ `RM_TAB_LABEL` ชุดเดียวกับแถบแท็บของบอร์ด */
const RM_TAB_BOARD_VIEW: Record<RmTab, string> = { candidates: 'list', contact: 'contact', appointments: 'appointments' };

/**
 * แถบกรองซ้ายพับ/กาง — จำต่อเครื่อง (เจ้าของสั่ง 30 ก.ย. 2569: *"Filter ทำแบบย่อ กางได้"* → Choice "แถบซ้ายพับได้")
 * ค่าตั้งต้น = พับ (ตารางได้เต็มความกว้าง) · เครื่องไม่ให้เก็บ = พับทุกครั้งที่เปิด ใช้ต่อได้ปกติ
 */
const FILTER_OPEN_KEY = 'jarvis:applicant-filter-open';
function readFilterOpen(): boolean {
  try {
    return window.localStorage.getItem(FILTER_OPEN_KEY) === '1';
  } catch {
    return false;
  }
}
function writeFilterOpen(open: boolean): void {
  try {
    window.localStorage.setItem(FILTER_OPEN_KEY, open ? '1' : '0');
  } catch {
    /* เครื่องไม่ให้เก็บ — ใช้ต่อได้ แค่ไม่จำ */
  }
}

/**
 * พื้นที่ทำงาน "รายชื่อผู้สมัคร" — เนื้อของหน้างานสรรหา (RM) เดิมทั้งก้อน
 *
 * เจ้าของเคาะ 11 ส.ค. 2569 รอบหก: รวมหน้า RM เข้ากับบอร์ดรับสมัครเป็นแท็บสลับมุมมอง
 * ("แยกกล่องงาน แต่ยังดึงเก็บไปแบบหน้า RM ได้") — component นี้คือมุมมองฝั่ง list
 * ถูก mount โดย `StaffJobBoardPage` (ไม่ใช่ใน JobBoardView — กันโค้ด RM รั่วเข้า
 * bundle หน้าสมัครสาธารณะ) · หน้า `/recruit/rm` เดิมเหลือเป็น redirect เข้าบอร์ด
 *
 * ⚠️ ไม่มี RecruitFunnelPanel ในนี้ — บอร์ดมีแผงภาพรวมของตัวเองอยู่แล้ว (โชว์ทั้งสองมุมมอง)
 * ⚠️ แท็บอยู่ใน `?tab=` เหมือนเดิม และต้อง **คง query param อื่นไว้** (`?view=` ของบอร์ด)
 *    — สร้าง URLSearchParams จากของเดิมเสมอ ห้ามเขียนทับทั้งก้อน
 *
 * ═══ ของที่ยังไม่ได้ต่อ (ขึ้นข้อความบอกตรง ๆ ไม่ปล่อยกดแล้วเงียบ) ═══
 * TODO(api) ระบบ Lead (เก็บ/ลบ Lead) — ยังไม่มีตารางฝั่งเรา
 * TODO(api) ปุ่ม "ช่องทาง"/"สร้างลิงก์" บนแถบนี้ — ของจริงอยู่ที่แถบบอร์ด (มุมมองกล่องงาน)
 */

const PAGE_SIZE_DEFAULT: PageSizeOption = 20;

/** แถวที่โชว์ในแถบ "เลือกวิธีโทร" ก่อนยุบ — เกินนี้ใช้ปุ่มทั้งหมด/กล่องบนแดชบอร์ด */
const AWAITING_ROWS_SHOWN = 5;

function isRmTab(v: string | null): v is RmTab {
  return !!v && (RM_TABS as readonly string[]).includes(v);
}

const RmWorkspace: React.FC<{
  /**
   * แท็บที่ถูกคุมจากข้างนอก (เจ้าของสั่ง 13 ส.ค. 2569: "การติดต่อ"/"ติดตามนัดหมาย"
   * เป็นแท็บระดับบอร์ดแล้ว) — ส่งมา = ล็อกแท็บนั้นและซ่อนแถบแท็บย่อยข้างใน
   * ไม่ส่ง = พฤติกรรมเดิม (อ่านจาก ?tab= · มีแถบแท็บของตัวเอง)
   */
  tab?: RmTab;
  /**
   * ใบขอที่หน้ากล่องงานโหลดไว้ (เปิดอยู่ + ปิดแล้ว) — ใช้บอก "เจ้าหน้าที่สรรหาของใบขอ" ให้หัวข้อกรองดูเป็นคน
   * (เจ้าของสั่ง 30 ก.ย. 2569) · ไม่ส่ง/ยังโหลดไม่ขึ้น = ไม่มีหัวข้อนี้
   */
  jobs?: readonly JobRequest[];
  /**
   * เพิ่มค่า = โหลดรายชื่อใหม่ — ปุ่มรีเฟรชย้ายขึ้นไปแถวหัวหน้า (เจ้าของสั่ง 4 ต.ค. 2569:
   * *"ปุ่มรีเฟรช ย้ายขึ้นไปแทนปุ่มสร้างลิงก์"*) · แถวรีเฟรชในนี้ถูกถอดตอนคุมจากข้างนอก
   */
  refreshKey?: number;
  /**
   * วันที่สมัคร คุมจากข้างนอก — ปุ่มปฏิทินอยู่ข้างรีเฟรชบนแถวหัวหน้า (เจ้าของสั่ง 5 ต.ค. 2569:
   * *"Filter วันที่ย้ายไปข้างๆปุ่ม Refresh ทั้งหน้า ผู้สมัคร การติดต่อ ติดตามการนัดหมาย"*)
   * ส่งมา = หัวข้อ "วันที่สมัคร" หายจากแถบกรองข้าง · ไม่ส่ง = ทางถอยแบบเดิม (อยู่ในแถบกรอง)
   */
  dateRange?: DateRangeYmd | null;
  onDateRangeChange?: (next: DateRangeYmd | null) => void;
  /**
   * ช่องบนแถวหัวข้างปุ่มวันที่ (เจ้าของสั่ง 14 ต.ค. 2569 "เอานำเข้า Excel กับ รายงาน ไปไว้แถวเดียวกับ [ปุ่มวันที่] เอาไว้ข้างๆกันเลย")
   * มี = แท็บผู้สมัครวาง 2 ปุ่มนี้ที่ช่องนี้แทนแถวปุ่มทำงาน · ไม่มี (หน้าเดี่ยว) = อยู่แถวปุ่มทำงานตามเดิม
   */
  headerActionsSlot?: HTMLElement | null;
}> = ({ tab: controlledTab, jobs, refreshKey = 0, dateRange: controlledDateRange, onDateRangeChange, headerActionsSlot = null }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: RmTab = controlledTab ?? (isRmTab(tabParam) ? tabParam : 'candidates');
  /**
   * มุมมองย่อยของแท็บ "รายชื่อผู้สมัคร" (เจ้าของสั่ง 13 ส.ค. 2569 ให้แบ่ง 3 อัน)
   * เก็บใน `?list=` เพื่อให้ refresh/แชร์ลิงก์แล้วยังอยู่มุมมองเดิม — แพตเทิร์นเดียวกับ ?tab=
   */
  const listParam = searchParams.get('list');
  // ค่าเริ่ม = รายชื่อคนที่สนใจ (เจ้าของสั่ง 14 ต.ค. 2569 "Default หน้า ผู้สมัครใน menu งานสรรหา ให้เป็น รายชื่อคนที่สนใจ")
  // "รายชื่อทั้งหมด" จึงต้องมี ?list=all ชัด ๆ · ลิงก์จากตัวเลขที่ต้องการทุกคน (ยังไม่ถูกโทร ฯลฯ) ส่ง list=all มาเอง
  const listView: RmListView = isShownRmListView(listParam) ? listParam : RM_LIST_VIEW_DEFAULT;

  const [rows, setRows] = useState<PublicApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  /**
   * 🔴 ช่องค้นหาของแท็บผู้สมัครอยู่บนแถบบน ซ้ายกระดิ่ง (เจ้าของสั่ง 27 ก.ย. 2569 "ทั้งระบบ")
   * ค้นเรื่องเดิม (ชื่อ/นามสกุล/เบอร์/ชื่องาน) · กด Enter = กลับหน้าแรกของตาราง เหมือนปุ่ม "ค้นหา" เดิม
   */
  const searchInHeader = useHeaderSearch({
    value: keyword,
    onChange: (v) => {
      setKeyword(v);
      setPage(1);
    },
    placeholder: RM_SEARCH_PLACEHOLDER,
    onSubmit: () => setPage(1),
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(PAGE_SIZE_DEFAULT);
  /** ข้อความบอกว่ายังไม่ได้ต่อของจริง — ดีกว่าปุ่มที่กดแล้วเงียบ */
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * ข้อความแจ้งหลังกด "เก็บไปโทรเอง" มีปุ่มพาไปแท็บการติดตาม (เจ้าของสั่ง 30 ก.ย. 2569: *"พอเก็บแล้วเข้าไปหน้า
   * การโทรของฉัน"* → Choice "อยู่หน้าเดิม มีปุ่มพาไป") · ข้อความอื่นไม่มีปุ่ม
   */
  const [noticeGoContact, setNoticeGoContact] = useState(false);
  /** ตั้งข้อความแจ้ง — ทุกทางผ่านตัวนี้ (ปุ่มพาไปการติดตามโผล่เฉพาะที่สั่งให้โผล่) */
  const say = (text: string | null, goContact = false) => {
    setNotice(text);
    setNoticeGoContact(goContact);
  };
  /** แถบกรองซ้าย (จอ xl) กางอยู่ไหม — ค่าตั้งต้นพับ */
  const [filterOpen, setFilterOpen] = useState<boolean>(readFilterOpen);
  const changeFilterOpen = (open: boolean) => {
    setFilterOpen(open);
    writeFilterOpen(open);
  };
  const [addOpen, setAddOpen] = useState(false);
  /** นำเข้าผู้สมัครจาก Excel (1 ต.ค. 2569) */
  const [importOpen, setImportOpen] = useState(false);
  /** dialog รายละเอียด+บันทึกผลติดต่อ (ลิสต์ข้อ 7) — เปิดจากปุ่ม "ดูรายละเอียด"/"บันทึกผลนัดหมาย" */
  const [contactApp, setContactApp] = useState<PublicApplication | null>(null);
  /** ใบประวัติ (แท็บผู้สมัคร) — คนละป๊อปกับ `contactApp` ของแท็บการติดตาม */
  const [profileApp, setProfileApp] = useState<PublicApplication | null>(null);
  const { user } = useAuth();
  /** ล็อกโทรของแถวในหน้า (คีย์ = application id) — โชว์ 🔒 + กันกดซ้ำ */
  const [holdByRef, setHoldByRef] = useState<Record<string, CallHold>>({});
  const [holdingSelected, setHoldingSelected] = useState(false);
  /**
   * มุมมอง "คลังสำรอง (Lead)" — ใบที่ถูกปัดออกจากรายชื่อทำงาน
   * เก็บใน `?lead=1` เพื่อให้ refresh/แชร์ลิงก์แล้วยังอยู่มุมมองเดิม (แพตเทิร์นเดียวกับ ?tab=)
   * ⚠️ การกรองอยู่ฝั่ง server — ลิสต์ปกติไม่เคยมีแถว Lead ติดมาให้ต้องกรองซ้ำ
   */
  const leadView = searchParams.get('lead') === '1';
  /** มุมมองใบที่ "ยกเลิกข้อมูลผู้สมัคร" (135 · 4 ต.ค. 2569) — เฉพาะแท็บผู้สมัคร · กู้คืนได้จากแถว */
  const cancelledView = searchParams.get('cancelled') === '1';
  /** กำลังยิง "ถอย Lead" ของแท็บการติดต่อ — ปิดปุ่มกันกดซ้อน */
  const [releasing, setReleasing] = useState(false);
  /**
   * ชิปกรองแบบ C (เจ้าของเคาะ 5 ต.ค. 2569 "การ์ดเดิมแต่กระชับ" ทุกแท็บ) — การติดต่อ: ทั้งหมด/ยังไม่โทร/โทรแล้ว ·
   * ติดตามนัดหมาย: นัดทั้งหมด/มา/ไม่มา/รอผล (แทนกล่องตัวเลข 4 ใบ) · ไม่ผูก URL (ของคนที่นั่งดู)
   */
  const [contactChip, setContactChip] = useState<ContactChip>('all');
  // ?appt=overdue = เปิดชิปเลยวันนัดเลย (ลิงก์ตรง · แถบแดงที่เคยส่งมาถอดแล้ว 22 ต.ค. 2569)
  const [appointmentChip, setAppointmentChip] = useState<AppointmentChip>(() =>
    searchParams.get('appt') === 'overdue' ? 'overdue' : 'all',
  );
  const apptParam = searchParams.get('appt');
  useEffect(() => {
    if (apptParam === 'overdue') setAppointmentChip('overdue');
  }, [apptParam]);
  // ย้ายแท็บ/กดกล่องอื่นแล้ว ข้อความแจ้งหายไปด้วย (เจ้าของ 20 ต.ค. 2569 "ไม่ต้องโชว์ทุกกล่อง" — เดิมค้างตามไปทุกกล่อง)
  useEffect(() => {
    say(null);
  }, [tab, listView, contactChip, appointmentChip]);
  const [showAppointmentDays, setShowAppointmentDays] = useState(false);
  /**
   * แท็บติดตามนัดหมาย: ของฉัน / ทุกคน (QA รอบ 2 ข้อ 4 · เจ้าของ Choice 10 ต.ค. 2569) — ค่าเริ่ม "ของฉัน" = ของใครของมันแบบเดิม
   * ปุ่มโผล่เฉพาะ supervisor ขึ้นไป · ไม่ผูก URL (ของคนที่นั่งดู) · ออกจากแท็บนี้ = กลับไปลิสต์เดิมเอง
   */
  // 21 ต.ค. 2569 เจ้าของ "ให้เห็นไปหมดเลยว่า นัดมาทั้งหมดเท่าไหร่ ใครนัดมา" · Choice "ทุกคนเห็นหมด ค่าเริ่ม = ทุกคน"
  const [appointmentScope, setAppointmentScope] = useState<RmAppointmentScope>('all');
  /** ตารางนัดของวันแยกสถานที่ (แบบ iRecruit · 21 ต.ค. 2569) — วันที่ดู + สถานที่ที่กด (null = ไม่กรองรายชื่อ) */
  const todayYmd = toYmdBangkok(new Date());
  const [placeDay, setPlaceDay] = useState<string>(todayYmd);
  const [placePick, setPlacePick] = useState<{ ymd: string; key: string | null } | null>(null);

  /**
   * drill-down จากกล่อง Dashboard (`?bucket=` — S6) · เงื่อนไขกรองอยู่ฝั่ง server
   * (นิยามเดียวกับตัวนับบนกล่อง — เลขบนกล่องจึงเท่ากับแถวที่เห็นเสมอ)
   * โหมดนี้ **ข้ามตัวแบ่งแท็บ** — ถังหนึ่งมีได้ทั้ง Lead/claim/แถวปกติ ถ้าปล่อยให้
   * isInRmTab หั่นต่อ เลขจะไม่ตรงกล่องแล้วเหมือนของหาย
   */
  const bucket = isRmBucket(searchParams.get('bucket')) ? searchParams.get('bucket') : null;
  const clearBucket = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('bucket');
    // 🔴 **push ไม่ใช่ replace** (5 ก.ย. 2569) — นี่คือ "คนกดเปลี่ยนมุมมองเอง"
    // ถ้า replace ประวัติจะถูกทับ ⇒ กดย้อนกลับแล้ว **หลุดออกจากหน้านี้ไปเลย**
    // (เจ้าของทดสอบเจอเอง: อยู่กล่องงาน → กดแท็บรายชื่อผู้สมัคร → ย้อนกลับ → เด้งไปหน้าแรก)
    setSearchParams(params);
    setSelectedIds([]);
    setPage(1);
  };

  /**
   * นัดหมายของทุกคน — เฉพาะแท็บนี้ + supervisor ขึ้นไป + ไม่ได้อยู่มุมมองพิเศษ (?bucket/?lead/?cancelled มีเงื่อนไขของตัวเอง)
   * 🔴 ชุดที่ได้มีแต่แถวนัด ⇒ ห้ามเอาไปนับให้แท็บอื่น (ดู `elsewhere` / `awaitingChoiceRows`)
   */
  const everyoneAppointments =
    tab === 'appointments' &&
    appointmentScope === 'all' &&
    canSeeEveryoneAppointments(user?.role) &&
    !bucket &&
    !leadView &&
    !cancelledView;

  /** ลำดับคำขอ — สลับของฉัน/ทุกคนเร็ว ๆ แล้วคำตอบเก่ามาทีหลัง ต้องไม่ทับรายชื่อที่เลือกอยู่ */
  const loadSeq = useRef(0);
  /** รายชื่อบนจอเป็นของชุดไหน (ของฉัน/ทุกคน) — สลับชุดแล้วเส้นล้ม ห้ามค้างรายชื่อชุดเก่าใต้ปุ่มชุดใหม่ (QA รอบ 3 ข้อ 23) */
  const rowsScopeRef = useRef<boolean | null>(null);
  const load = () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setLoadError(null);
    if (rowsScopeRef.current !== null && rowsScopeRef.current !== everyoneAppointments) setRows([]);
    fetchAllJobApplications(leadView, bucket, cancelledView, everyoneAppointments)
      .then((next) => {
        if (seq === loadSeq.current) {
          setRows(next);
          rowsScopeRef.current = everyoneAppointments;
        }
      })
      .catch((e) => {
        if (seq === loadSeq.current) setLoadError(friendlyErrorText(e, 'โหลดรายชื่อผู้สมัครไม่สำเร็จ'));
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoading(false);
      });
  };
  useEffect(load, [leadView, bucket, cancelledView, refreshKey, everyoneAppointments]);

  const setCancelledView = (on: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (on) next.set('cancelled', '1');
    else next.delete('cancelled');
    setSearchParams(next);
    setSelectedIds([]);
    setPage(1);
    say(null);
  };

  /** สลับมุมมอง — ต้องคง query param อื่นไว้ (`?view=` ของบอร์ด · `?tab=` · `?list=`) */
  const setLeadView = (on: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (on) next.set('lead', '1');
    else next.delete('lead');
    setSearchParams(next);
    setSelectedIds([]);
    setPage(1);
    say(null);
  };

  /**
   * "ถอย Lead" จากแถวที่ติ๊ก (แท็บการติดต่อ · เจ้าของสั่ง 5 ต.ค. 2569) — ย้ายกลับแท็บผู้สมัคร
   * 🔴 เส้นเดียวกับปุ่ม "ถอย Lead" บนแถว (`release`) · server ทำครบ (ปลดจอง + ถอด Lead + คืนล็อกเบอร์)
   */
  const releaseSelected = async () => {
    if (selectedIds.length === 0 || releasing) return;
    setReleasing(true);
    say(null);
    try {
      const outcome = await chooseApplicationCall(selectedIds, 'release');
      say(summarizeCallChoice(outcome));
      setSelectedIds([]);
      load();
    } catch (e) {
      say(friendlyErrorText(e, 'ถอย Lead ไม่สำเร็จ'));
    } finally {
      setReleasing(false);
    }
  };

  /**
   * บันทึกผลติดตามนัด มา/ไม่มา (แท็บนัดหมาย · migration 089) — append-only ล่าสุดชนะ
   * server เป็นด่านตัดสิน (ก่อนวันนัด = 400) · เสร็จแล้ว reload ให้ชิปบนแถวอัปเดต
   */
  const onAttendance = (row: PublicApplication, result: AttendanceResult | ScreeningResult) => {
    if (!row.appointment_at) return;
    say(null);
    void recordAppointmentAttendance({
      applicationId: row.id,
      appointmentAt: row.appointment_at,
      result,
    })
      .then(() => {
        say(`บันทึกผลนัดของ ${row.full_name}: ${isScreeningResult(result) ? SCREENING_LABEL[result] : ATTENDANCE_LABEL[result]} แล้ว`);
        load();
      })
      .catch((e) => say(friendlyErrorText(e, 'บันทึกผลนัดไม่สำเร็จ')));
  };

  /**
   * ตัวกรองวันที่สมัคร (เจ้าของสั่ง 22 ส.ค. 2569: *"หน้าผู้สมัครขอเป็นแบบ filter แบบ
   * calendar ที่กดแล้วข้อมูลเปลี่ยนตามวันที่เลือก"*)
   *
   * ⚠️ ไม่ผูกกับ URL — ต่างจากแท็บ/มุมมอง/bucket ที่คนแชร์ลิงก์กันจริง
   * ช่วงวันเป็นของ "คนที่กำลังนั่งดู" ไม่ใช่ของลิงก์ (และ bucket drill-down
   * มีความหมายของช่วงเวลาอยู่ในตัวแล้ว)
   */
  const [ownDateRange, setOwnDateRange] = useState<DateRangeYmd | null>(null);
  const dateInHeader = onDateRangeChange !== undefined;
  const dateRange = dateInHeader ? (controlledDateRange ?? null) : ownDateRange;
  /** เปลี่ยนช่วงวัน = กลับหน้า 1 + ล้างที่ติ๊กไว้ (ของที่ติ๊กอาจหลุดออกจากชุดที่เห็นแล้ว) */
  const changeDateRange = (next: DateRangeYmd | null) => {
    if (onDateRangeChange) onDateRangeChange(next);
    else setOwnDateRange(next);
    setPage(1);
    setSelectedIds([]);
  };
  /** ช่วงวันเปลี่ยนจากปุ่มบนหัวหน้า — กลับหน้า 1 + ล้างที่ติ๊ก เหมือนกดในแถบกรอง */
  useEffect(() => {
    if (!dateInHeader) return;
    setPage(1);
    setSelectedIds([]);
  }, [dateInHeader, controlledDateRange?.from, controlledDateRange?.to]);

  /** จำนวนต่อแท็บ — นิยามเดียวกับตัวกรอง (isInRmTab) เลขบนแท็บจึงตรงกับที่เห็นเสมอ */
  const tabCounts = useMemo(() => {
    const out = {} as Record<RmTab, number>;
    for (const t of RM_TABS) out[t] = rows.filter((r) => isInRmTab(r, t)).length;
    return out;
  }, [rows]);

  /** ตัวกรองที่หน้านี้ใช้จริง — สามกลุ่มเดิมไม่มี UI แล้ว (ถอด 17 ส.ค. 2569) เหลือช่วงวันที่ */
  const rmFilters = useMemo(
    () => ({ ...EMPTY_RM_FILTERS, dateFrom: dateRange?.from ?? null, dateTo: dateRange?.to ?? null }),
    [dateRange],
  );

  /**
   * ═══ แถบกรองด้านซ้ายแบบ iRecruit (เจ้าของเคาะแบบร่าง 27 ก.ย. 2569: "เอาตามร่างเลย") ═══
   * ตรรกะทั้งหมดอยู่ `lib/applicantFilters` + `lib/facetEngine` (ตัวเดียวกับกล่องงาน)
   * ค่าที่ติ๊กอยู่ใน URL (`a.*`) · 🔴 โหมด drill-down (`?bucket=`) ไม่มีแถบกรอง — เลขต้องเท่ากล่องที่กดมา
   */
  const applicantFilterState = useMemo<ApplicantFilterState>(
    () => (bucket ? EMPTY_APPLICANT_FILTER_STATE : readApplicantFilterState(searchParams)),
    [bucket, searchParams],
  );
  /**
   * เจ้าหน้าที่สรรหาของใบขอที่คนนี้สมัคร — จากช่องผู้รับผิดชอบของใบขอ (ชุดเดียวกับการ์ดกล่องงาน)
   * 🔴 จับใบด้วย `buildJobKeyIndex` (id ใบขอมี 3 รูป) · ใบที่ไม่อยู่ในชุดที่โหลด = ไม่ระบุ
   */
  const jobRecruiterOf = useMemo(() => {
    if (!jobs || jobs.length === 0) return undefined;
    const idx = buildJobKeyIndex(
      jobs.map((j) => [j.id, (j.recruiter_name ?? '').trim() || null] as const),
      (existing) => existing,
    );
    return (r: PublicApplication) => (r.job_id ? (idx.get(r.job_id) ?? null) : null);
  }, [jobs]);
  /**
   * ผู้สรรหาที่ใช้จริง = ที่แก้รายคน (154 · เจ้าของ 19 ต.ค. 2569 "ข้อมูลผู้สรรหา ทำให้แก้ไขได้") ก่อน ไม่มีค่อยใช้ของใบขอ
   * ใช้กับคอลัมน์เจ้าของงาน · ไฟล์รายงาน · ป๊อป
   */
  const recruiterOf = useMemo(
    () => (r: PublicApplication) => (r.recruiter_name ?? '').trim() || jobRecruiterOf?.(r) || null,
    [jobRecruiterOf],
  );
  /** หน่วยงานจากใบขอ — ใบสมัครที่ไม่มี unit_name เคยโชว์ชื่อประกาศ/ตำแหน่งในคอลัมน์หน่วยงาน (QA 18 ต.ค. 2569) */
  const unitOf = useMemo(() => {
    if (!jobs || jobs.length === 0) return undefined;
    const idx = buildJobKeyIndex(
      jobs.map((j) => [j.id, (j.unit_name ?? '').trim() || null] as const),
      (existing) => existing,
    );
    return (r: PublicApplication) => (r.job_id ? (idx.get(r.job_id) ?? null) : null);
  }, [jobs]);
  const applicantFacts = useMemo<ApplicantFacetFacts>(
    () => ({ tab, now: new Date(), recruiterOf }),
    [tab, recruiterOf],
  );
  const commitApplicantFilters = (next: ApplicantFilterState) => {
    setSearchParams((prev) => writeApplicantFilterState(prev, next), { replace: true });
    setPage(1);
    setSelectedIds([]);
  };
  const toggleApplicantFacet = (key: ApplicantFacetKey, value: string) =>
    commitApplicantFilters(toggleApplicantFacetValue(applicantFilterState, key, value));
  const clearApplicantFacets = () => commitApplicantFilters(EMPTY_APPLICANT_FILTER_STATE);
  const applicantFacetCount = countSelectedApplicantValues(applicantFilterState);
  /** จำนวนที่ติ๊กทั้งแถบ (รวมวันที่สมัครเมื่ออยู่ในแถบ) — เลขบนปุ่มกางแถบ */
  const panelSelected = applicantFacetCount + (!dateInHeader && dateRange ? 1 : 0);
  /** ปุ่ม "ล้าง" ของแถบซ้าย = ล้างทุกอย่างในแถบ รวมวันที่สมัคร (อยู่ในแถบเดียวกัน) */
  const clearApplicantPanel = () => {
    clearApplicantFacets();
    // วันที่อยู่หัวหน้า = ไม่ใช่ของแถบนี้ ล้างแถบไม่แตะวันที่
    if (!dateInHeader && dateRange) changeDateRange(null);
  };
  /** วันที่สมัครเป็นหัวข้อหนึ่งในแถบกรอง (ตามแบบร่าง: "ช่องทาง · วันที่สมัคร" อยู่ในแถบซ้าย) */
  const applicantPanelSections: FilterExtraSection[] = dateInHeader
    ? []
    : [
    {
      key: 'applied',
      label: 'วันที่สมัคร',
      selected: dateRange ? 1 : 0,
      content: <DateRangeCalendarPicker triggerVariant="filter" value={dateRange} onChange={changeDateRange} />,
    },
  ];

  /** ชุดก่อนแถบซ้าย (แท็บ + มุมมองย่อย + วันที่ + คำค้น) — ฐานของเลขต่อท้ายตัวเลือก */
  const baseFiltered = useMemo(() => {
    // โหมด drill-down: server กรองด้วยนิยามเดียวกับกล่องแล้ว — แสดงตามนั้นตรง ๆ
    // (หั่นต่อด้วยแท็บ/ตัวกรอง = เลขไม่ตรงกล่อง)
    if (bucket) return rows;
    const base = filterApplications(rows, tab, rmFilters, keyword);
    // มุมมองย่อยใช้เฉพาะแท็บรายชื่อผู้สมัคร — แท็บอื่นมีความหมายของตัวเองอยู่แล้ว
    if (tab !== 'candidates') return base;
    return base.filter((r) => isInRmListView(r, listView));
  }, [rows, tab, keyword, listView, bucket, rmFilters]);

  const filtered = useMemo(
    () => (bucket ? baseFiltered : applyApplicantFilters(baseFiltered, applicantFilterState, applicantFacts)),
    [bucket, baseFiltered, applicantFilterState, applicantFacts],
  );
  const applicantFacets = useMemo(
    () => (bucket ? [] : buildApplicantFacets(baseFiltered, applicantFilterState, applicantFacts)),
    [bucket, baseFiltered, applicantFilterState, applicantFacts],
  );
  /**
   * 🔴 ตัวกรองนี้ได้ 0 คนในแท็บนี้ แต่มีคนในแท็บอื่น — บอกพร้อมปุ่มพาไป (27 ก.ย. 2569)
   * เจอจริงตอนตรวจ: กด "ดูรายชื่อ" จากการ์ดกล่องงาน → ผู้สมัครคนเดียวของใบนั้นถูก "เก็บไปโทรเอง"
   * แล้ว จึงอยู่แท็บการโทรของฉัน · แท็บนี้เลยขึ้น 0 คนทั้งที่การ์ดบอก 1 คน (อ่านแล้วนึกว่าพัง)
   * นับด้วยนิยามแท็บชุดเดียวกับตาราง (`filterApplications` + ตัวกรองชุดเดียวกัน) · โผล่เฉพาะตอนว่าง
   */
  const elsewhere = useMemo(() => {
    // มุมมองนัดของทุกคนมีแต่แถวนัด — นับให้แท็บอื่นไม่ได้
    if (bucket || everyoneAppointments || applicantFacetCount === 0 || filtered.length > 0) return [];
    return RM_TABS.filter((t) => t !== tab)
      .map((t) => {
        const base = filterApplications(rows, t, rmFilters, keyword);
        const n = applyApplicantFilters(base, applicantFilterState, { ...applicantFacts, tab: t }).length;
        return { tab: t, n };
      })
      .filter((x) => x.n > 0);
  }, [bucket, everyoneAppointments, applicantFacetCount, filtered.length, tab, rows, rmFilters, keyword, applicantFilterState, applicantFacts]);
  const goToTab = (t: RmTab) =>
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      // บนบอร์ดรับสมัคร แท็บคุมด้วย ?view= · หน้าเดี่ยว (/recruit/rm) คุมด้วย ?tab=
      if (controlledTab) p.set('view', RM_TAB_BOARD_VIEW[t]);
      else p.set('tab', t);
      return p;
    });

  /** บอร์ดสรุปนัดต่อวัน (ข้อ 12 · 20 ส.ค. 2569) — คิดจากชุดเดียวกับตาราง เลขจึงตรงกันเสมอ */
  const appointmentBoard = useMemo(() => buildAppointmentBoard(filtered), [filtered]);
  /** ตารางนัดรายสถานที่ของวันที่ดู — ชุดเดียวกับตาราง (ไม่ผ่านชิป) */
  const appointmentPlaces = useMemo(() => buildAppointmentPlaces(filtered, placeDay), [filtered, placeDay]);
  /**
   * ใบพิมพ์ "โหลดเป็น PDF" แบบฟอร์ม iRecruit (21 ต.ค. 2569) — หน้าละสถานที่+เวลาของวันที่ดู · กดแถวไว้ = พิมพ์แถวนั้น
   * ทุกคนในวันนั้น ไม่ใช่แค่หน้าที่แบ่งไว้ (เดิมพิมพ์แค่หน้าปัจจุบันของตาราง)
   */
  const printGroups = useMemo<AppointmentPrintGroup[]>(() => {
    const pickKey = placePick && placePick.ymd === placeDay ? placePick.key : null;
    return appointmentPlaces.places
      .filter((p) => pickKey === null || p.key === pickKey)
      .map((p) => ({
        key: p.key,
        ymd: placeDay,
        place: p.place,
        time: p.times.length > 0 ? p.times.join(' · ') : null,
        rows: filtered
          .filter((r) => isInAppointmentPlace(r, placeDay, p.key) && placeKeyOf(r) === p.key)
          .sort((a, b) => (appointmentTimeOf(a.appointment_at) ?? '').localeCompare(appointmentTimeOf(b.appointment_at) ?? '') || a.full_name.localeCompare(b.full_name, 'th')),
      }));
  }, [appointmentPlaces, filtered, placeDay, placePick]);

  /**
   * ใบที่รออยู่ในกอง "เลือกวิธีโทร" (Phase 5.9) — คิดจาก **ชุดที่โหลดมาทั้งก้อน** ไม่ใช่
   * `filtered` เพราะแถบนี้เป็น "งานที่ต้องลงมือ" ระดับหน้า ไม่ใช่ผลของตัวกรอง/คำค้น
   * (กรองอยู่แล้วเห็นเลขน้อยลง = คนคิดว่างานหมดแล้ว)
   * ⚠️ ต้องเช็ค `!r.claimed` ด้วย — มีคนกดเก็บใหม่ระหว่างรอ = ไม่ต้องเลือกอีก
   */
  const awaitingChoiceRows = useMemo(
    // มุมมองนัดของทุกคนไม่ได้โหลดกองนี้มา (มีแต่แถวนัด) — กลับ "ของฉัน" แล้วแถบกลับมาเอง
    () => (everyoneAppointments ? [] : rows.filter((r) => r.unclaimed_at && !r.call_choice && !r.claimed)),
    [rows, everyoneAppointments],
  );
  /** หมุดเวลาเดียวต่อการ render — ทุกป้ายนับถอยหลังจึงนับจากจุดเดียวกัน
   *  (แพตเทิร์นเดียวกับ RmTable ที่จับเวลาครั้งเดียวต่อ render ไม่ต้อง memo) */
  const now = new Date();

  // ก้อน "นัด → มาไหม" (ยอดทั้งระบบจาก /api/recruit-rm-overview) ถอดแล้ว 4 ต.ค. 2569 — ไม่ต้องโหลดอีก

  /** เลขบนปุ่มมุมมองย่อย — นับหลังตัวกรอง/คำค้นเดียวกัน เลขจึงตรงกับที่เห็นเสมอ */
  const listViewCounts = useMemo(() => {
    // แถบซ้ายกรองก่อนนับด้วย — เลขบนปุ่มมุมมองย่อยต้องตรงกับที่เห็นเมื่อกดเข้าไป
    const base = applyApplicantFilters(
      filterApplications(rows, 'candidates', rmFilters, keyword),
      applicantFilterState,
      applicantFacts,
    );
    const out = {} as Record<RmListView, number>;
    for (const v of RM_LIST_VIEWS) out[v] = base.filter((r) => isInRmListView(r, v)).length;
    return out;
  }, [rows, keyword, rmFilters, applicantFilterState, applicantFacts]);

  const setListView = (next: RmListView) => {
    const params = new URLSearchParams(searchParams);
    if (next === RM_LIST_VIEW_DEFAULT) params.delete('list');
    else params.set('list', next);
    setSearchParams(params);
    setSelectedIds([]);
    setPage(1);
  };

  /** เลขบนชิปการติดต่อ — นับจากชุดเดียวกับตาราง (ก่อนกดชิป) */
  const contactChipCounts = useMemo(() => {
    const out = {} as Record<ContactChip, number>;
    for (const c of CONTACT_CHIPS) out[c.id] = filtered.filter((r) => isInContactChip(r, c.id)).length;
    return out;
  }, [filtered]);

  /** ชุดที่ตารางโชว์ = `filtered` + ชิปของแท็บ (ถัง drill-down ไม่กรองต่อ — เลขต้องเท่ากล่องที่กดมา) */
  const shown = useMemo(() => {
    if (bucket) return filtered;
    if (tab === 'contact') return filtered.filter((r) => isInContactChip(r, contactChip));
    if (tab === 'appointments') {
      const byChip = filtered.filter((r) => isInAppointmentChip(r, appointmentChip));
      return placePick ? byChip.filter((r) => isInAppointmentPlace(r, placePick.ymd, placePick.key)) : byChip;
    }
    return filtered;
  }, [bucket, filtered, tab, contactChip, appointmentChip, placePick]);

  const totalPages = getTotalPages(shown.length, pageSize);
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => shown.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [shown, currentPage, pageSize],
  );

  /**
   * โหลดสถานะล็อกของแถวในหน้านี้ — server จับคู่ด้วยเบอร์ E.164 แล้วคืน map คีย์ ref
   * อ่านไม่ได้ = ทุกแถวดูเป็น "ว่าง" ซึ่งยังปลอดภัย เพราะ server เป็นคนตัดสินตอนกดจริง
   */
  useEffect(() => {
    if (pageRows.length === 0) return;
    let cancelled = false;
    void fetchCallHoldsByPhones(pageRows.map((r) => r.phone)).then((map) => {
      if (cancelled) return;
      setHoldByRef((prev) => {
        // เขียนสถานะของ "แถวในหน้านี้" ใหม่ทั้งก้อน — มีล็อก = ตั้ง · ไม่มี = ลบคีย์ออก
        // ⚠️ ห้าม merge ทางเดียว: เดิมพอคืน/หมดอายุล็อก แถวยังโชว์ 📞 + ปุ่มโทร disabled
        // ค้างจนกว่าจะ reload ทั้งหน้า (กด "รีเฟรช" ก็ไม่ช่วยเพราะ load() ไม่แตะ holdByRef)
        // · map คีย์ด้วย candidateRef ของล็อก (= application id) → map.get(row.id)
        const next = { ...prev };
        for (const row of pageRows) {
          const hold = map.get(row.id);
          if (hold) next[row.id] = hold;
          else delete next[row.id];
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [pageRows]);

  const setTab = (next: RmTab) => {
    // ⚠️ ต่อยอดจาก params เดิมเสมอ — ?view= ของบอร์ดต้องรอด ไม่งั้นสลับแท็บแล้วเด้งกลับกล่องงาน
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params);
    // ล้างที่ติ๊กไว้ตอนสลับแท็บ — ปุ่ม action คนละชุด ติ๊กค้างข้ามแท็บแล้วสับสน
    setSelectedIds([]);
    say(null);
    setPage(1);
  };

  /** ปุ่มแถวที่ยังไม่ต่อของจริง — ขึ้นข้อความ ดีกว่ากดแล้วเงียบ */
  const todo = (what: string) => say(`${what} — ยังไม่ได้ต่อกับระบบจริง`);

  /**
   * "เก็บไปโทรเอง" — ปุ่มเดียวที่รวม claim + ล็อกเบอร์ (เจ้าของเคาะ 22 ส.ค. 2569)
   *
   * 🔴 ยิงเส้นเดียว `/api/application-call-choice` ให้ **server ทำทั้งสองอย่างในคำสั่งเดียว**
   * ห้ามให้หน้าเว็บยิงสองเส้นเอง: เดิมทำแบบนั้นแล้วมีสภาพครึ่ง ๆ (จองใบได้แต่เบอร์ไม่ถูกล็อก
   * = AI โทรทับ) โดยที่คนกดไม่รู้ · ตอนนี้ server รายงาน skipped กลับมาให้อ่านได้ทุกใบ
   */
  const keepForSelf = async (ids: string[]) => {
    if (ids.length === 0) return;
    say(null);
    try {
      const outcome = await chooseApplicationCall(ids, 'manual');
      say(summarizeCallChoice(outcome), tab !== 'contact');
      load(); // ใบย้ายแท็บ (claimed_by_me) + ป้ายล็อกเปลี่ยน ต้องเห็นทันที
    } catch (e) {
      say(friendlyErrorText(e, 'เก็บไปโทรเองไม่สำเร็จ'));
    }
  };

  /**
   * "ส่ง AI โทร" — ยิงสายจริง จึงต้องผ่าน popup ยืนยันรายชื่อทุกครั้ง (กติกาเจ้าของ)
   * เก็บ id ที่รอยืนยันไว้ก่อน แล้วยิงตอนกดยืนยันในป๊อป
   */
  const [aiConfirmIds, setAiConfirmIds] = useState<string[] | null>(null);
  const [aiSending, setAiSending] = useState(false);
  /**
   * ใบขอที่เลือกให้ใบที่ยังไม่ผูก (รายชื่อ iRecruit · นำเข้าไม่ผูกงาน — เจ้าของ 15 ต.ค. 2569)
   * AI โทรได้เฉพาะใบที่มีใบขอ ⇒ ต้องเลือกก่อนถึงกดส่งได้ · ใบที่ผูกอยู่แล้วไม่ถูกย้าย (server เช็คอีกชั้น)
   */
  const [bindJobId, setBindJobId] = useState('');
  const askSendAi = (ids: string[]) => {
    if (ids.length === 0) return;
    say(null);
    setBindJobId('');
    setAiConfirmIds(ids);
  };
  const confirmSendAi = async () => {
    if (!aiConfirmIds || aiSending) return;
    setAiSending(true);
    try {
      const bindJob = aiUnbound.length > 0 ? (jobs ?? []).find((j) => j.id === bindJobId) : undefined;
      const outcome: CallChoiceOutcome = await chooseApplicationCall(
        aiConfirmIds,
        'ai',
        aiUnbound.length > 0 && bindJobId === GREET_OPTION
          ? 'greet'
          : bindJob
            ? { id: bindJob.id, title: publicJobPositionLabel(bindJob), unitName: bindJob.unit_name }
            : null,
      );
      say(summarizeCallChoice(outcome));
      setAiConfirmIds(null);
      setSelectedIds([]);
      load();
    } catch (e) {
      say(friendlyErrorText(e, 'ส่ง AI โทรไม่สำเร็จ'));
      setAiConfirmIds(null);
    } finally {
      setAiSending(false);
    }
  };
  /** ชื่อของ id ที่รอยืนยัน — ป๊อปต้องโชว์ชื่อจริง ไม่ใช่แค่จำนวน */
  const aiConfirmNames = useMemo(
    () =>
      (aiConfirmIds ?? [])
        .map((id) => rows.find((r) => r.id === id)?.full_name)
        .filter((n): n is string => Boolean(n)),
    [aiConfirmIds, rows],
  );
  /**
   * ใบที่ต้องเลือกใบขอก่อนส่ง AI = ยังไม่ผูก หรือ **ใบขอปิดแล้ว** (19 ต.ค. 2569 · คนกรอกลิงก์ของใบที่ปิดไปเป็นเดือน)
   * ใบปิด = ไม่อยู่ในใบขอที่ยังเปิดของกล่องงาน (โหลดไม่ขึ้น = ไม่เดา) · server เช็กกับ ERP อีกชั้นก่อนย้ายใบ
   */
  const openJobIds = useMemo(
    () => (jobs && jobs.length > 0 ? new Set(jobs.filter((j) => j.status !== 'closed').map((j) => j.id)) : null),
    [jobs],
  );
  const aiUnbound = useMemo(
    () =>
      rows.filter(
        (r) =>
          (aiConfirmIds ?? []).includes(r.id) && (!r.job_id?.trim() || (openJobIds !== null && !openJobIds.has(r.job_id.trim()))),
      ),
    [aiConfirmIds, rows, openJobIds],
  );
  const bindGroups = useMemo(() => {
    if (aiUnbound.length === 0) return [];
    // จังหวัด/งานที่บอก AI ในสายทักทาย (ถ้ามี) ใช้เรียงก่อนค่าในใบ — ใบไม่ถูกแก้ แต่ของที่เพิ่งบอกใหม่กว่า
    const { both, province, others } = bindJobOptions(
      jobs ?? [],
      aiUnbound.map((r) => ({
        province: r.ai_heard?.province ?? r.province,
        position_interest: r.ai_heard?.job ?? r.position_interest,
      })),
    );
    return [
      // บททักทายทั่วไป (15 ต.ค. 2569) — ยังไม่รู้จะผูกใบขอไหน
      { heading: 'ยังไม่รู้ใบขอ', options: [{ value: GREET_OPTION, label: 'ให้ AI ทักทายถามก่อน ไม่ระบุงาน', keywords: 'ทักทาย' }] },
      { heading: 'ตรงจังหวัดและตำแหน่ง', options: both },
      { heading: 'ตรงจังหวัด', options: province },
      { heading: 'ใบขออื่น', options: others },
    ].filter((g) => g.options.length > 0);
  }, [aiUnbound, jobs]);

  const onRowAction = (action: RmRowAction, row: PublicApplication) => {
    // ส่ง AI โทรทีละแถว (4 ต.ค. 2569) — ผ่านป๊อปยืนยันรายชื่อเหมือนปุ่มรวม (ยิงสายจริง)
    if (action === 'ai') {
      askSendAi([row.id]);
      return;
    }
    // กู้คืนใบที่ยกเลิกข้อมูล (135) — กลับเข้ารายชื่อหลักตามเดิม
    if (action === 'restore') {
      say(null);
      void setApplicationCancelled(row.id, false)
        .then(() => {
          say(`กู้คืน ${row.full_name} เข้ารายชื่อหลักแล้ว`);
          load();
        })
        .catch((e: unknown) => say(friendlyErrorText(e, 'กู้คืนไม่สำเร็จ')));
      return;
    }
    /**
     * "เก็บเข้า Lead" บนแถวผู้สมัคร — 🔴 เดิมไม่เคยต่อ (ตกไปที่ todo "ยังไม่ได้ต่อกับระบบจริง") · QA 5 ต.ค. 2569
     * ปุ่มเก็บ Lead บนแถวเครื่องมือถูกถอดเช้าวันเดียวกัน ⇒ ไม่เหลือทางเก็บ Lead · ตอนนี้ยิงเส้นเดียวกับป๊อปรายชื่อของใบงาน
     * เก็บแล้วชื่อไปแท็บการติดต่อ (Lead ของฉัน) + ข้อความมีปุ่มพาไป
     */
    if (action === 'bookmark') {
      say(null);
      void setJobApplicationLead(row.id, true)
        .then(() => {
          say(`เก็บ ${row.full_name} เข้า Lead แล้ว`, true);
          load();
        })
        .catch((e: unknown) => say(friendlyErrorText(e, 'เก็บเข้า Lead ไม่สำเร็จ')));
      return;
    }
    if (action === 'call') {
      // ปุ่มถูก disable ไว้แล้วถ้าจับไม่ได้ — เช็คซ้ำกันหลุดจาก keyboard/สคริปต์
      if (!canHoldApplication(row).ok || holdByRef[row.id]) return;
      void keepForSelf([row.id]);
      return;
    }
    /**
     * "กดโทร" — จดเวลาที่ยกหูโทรออก (095 · เจ้าของสั่ง 17 ส.ค. 2569 ข้อ 5)
     * อัปเดตแถวในหน้าเลยไม่ต้อง reload ทั้งลิสต์ (คนกดรัว ๆ ทีละหลายคน)
     * ⚠️ ล้มแล้วต้องบอก — ถ้าเงียบ คนจะคิดว่าจดแล้วทั้งที่ไม่ได้จด
     */
    if (action === 'dial') {
      say(null);
      // แบบ iRecruit (4 ต.ค. 2569): ยิงจดเวลาก่อน แล้วค่อยเปิดหน้าโทรของเครื่อง —
      // เปิดผ่านการคลิกลิงก์ ไม่ใช่เปลี่ยน URL หน้า (เปลี่ยนหน้าก่อน = คำขอจดเวลาอาจถูกยกเลิกเงียบ ๆ)
      const dialing = markApplicationDialed(row.id);
      const href = telHref(row.phone);
      if (href) {
        const link = document.createElement('a');
        link.href = href;
        link.click();
      }
      void dialing
        .then((r) => {
          setRows((prev) =>
            prev.map((x) =>
              x.id === row.id
                ? {
                    ...x,
                    dialed_first_at: r.dialed_first_at ?? undefined,
                    dialed_last_at: r.dialed_last_at ?? undefined,
                    dial_count: r.dial_count,
                  }
                : x,
            ),
          );
          say(`จดเวลาโทรของ ${row.full_name} แล้ว`);
        })
        .catch((e: unknown) => {
          say(friendlyErrorText(e, 'จดเวลาโทรไม่สำเร็จ'));
        });
      return;
    }
    /**
     * ดูรายละเอียด — 🔴 แท็บผู้สมัครเปิด **ใบประวัติ** (เจ้าของ Choice 1 ต.ค. 2569 "ใบประวัติเต็มหน้า":
     * *"กดไปก็ต้องขึ้นประวัติเข้าเลย"*) · แท็บการติดตาม/ติดตามนัดหมายยังเป็นป๊อปติดต่อ-นัดหมายเดิม (ลิสต์ข้อ 7 · 14 ส.ค. 2569)
     */
    if (action === 'view' && tab === 'candidates') {
      setProfileApp(row);
      return;
    }
    if (action === 'view' || action === 'rule') {
      setContactApp(row);
      return;
    }
    /**
     * "ลบออก" ในแท็บการติดตาม (เจ้าของสั่ง 1 ต.ค. 2569) — ส่งกลับแท็บผู้สมัครเป็นใบว่าง
     * 🔴 ยิงเส้นเดียว server ทำครบ (ปลดจอง + ถอด Lead + คืนล็อกเบอร์) — ห้ามยิงหลายเส้นเอง
     */
    if (action === 'release') {
      say(null);
      void chooseApplicationCall([row.id], 'release')
        .then((outcome) => {
          say(summarizeCallChoice(outcome));
          load(); // ใบย้ายกลับแท็บผู้สมัคร + ป้ายล็อกหาย ต้องเห็นทันที
        })
        .catch((e: unknown) => say(friendlyErrorText(e, 'ลบออกไม่สำเร็จ')));
      return;
    }
    todo(`"${RM_ROW_ACTION_LABEL[action]}" ของ ${row.full_name}`);
  };

  /** "เก็บไปโทรเอง" จากแถวที่ติ๊ก — ทำงานได้ทุกแท็บ (ปุ่มรวมของเจ้าของ 22 ส.ค. 2569) */
  const keepSelectedForSelf = async () => {
    if (selectedIds.length === 0 || holdingSelected) return;
    setHoldingSelected(true);
    try {
      await keepForSelf(pageRows.filter((r) => selectedIds.includes(r.id)).map((r) => r.id));
      setSelectedIds([]);
    } finally {
      setHoldingSelected(false);
    }
  };

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () =>
    setSelectedIds((prev) =>
      pageRows.every((r) => prev.includes(r.id))
        ? prev.filter((id) => !pageRows.some((r) => r.id === id))
        : [...new Set([...prev, ...pageRows.map((r) => r.id)])],
    );

  return (
    <div>
      {/* แถบแท็บย่อย — โผล่เฉพาะโหมดไม่ถูกคุมจากข้างนอก (ตอนนี้บอร์ดคุมด้วย ?view= แล้ว
          แถบนี้จึงไม่ขึ้นบนบอร์ด — คงไว้เผื่อ RmWorkspace ถูกใช้เดี่ยว ๆ ที่อื่น) */}
      {/* ⚠️ ป้าย "ข้อมูลผู้สมัคร · N รายการ" ถูกเอาออก (เจ้าของสั่ง 14 ส.ค. 2569) —
          ซ้ำกับ tab bar ระดับบอร์ดที่มีชื่อแท็บ+จำนวนอยู่แล้ว · เหลือแค่ปุ่มรีเฟรช */}
      {/* คุมจากข้างนอก (บอร์ด) = ปุ่มรีเฟรชอยู่แถวหัวหน้าแล้ว (4 ต.ค. 2569) — ไม่มีแถวนี้ */}
      {controlledTab ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {/* แถบกระจก (เจ้าของ 19 ต.ค. 2569 "เปลี่ยนเป็นกระจกทั้งหมด") — เดิมขีดเส้นใต้ */}
          <div className={cn(glassTabsListClass, 'h-auto flex-wrap justify-start rounded-2xl')} role="tablist">
        <GlassTabIndicator />
          {RM_TABS.map((t) => {
            const active = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-current={active ? 'page' : undefined}
                className={glassTabClass(active)}
              >
                {RM_TAB_LABEL[t]}
                <span className={cn('ml-1.5 text-xs tabular-nums', active ? '' : DASH.muted)}>
                  {loading ? '…' : loadError ? '—' : tabCounts[t].toLocaleString('th-TH')}
                </span>
              </button>
            );
          })}
          </div>
          <Button variant="secondary" size="sm"
            type="button"
            onClick={load}
            disabled={loading}
            className="ml-auto"
          >
            <RefreshCw className={cn(loading && 'animate-spin')} aria-hidden /> รีเฟรช
          </Button>
        </div>
      )}

      {/* แท็บย่อย 3 อันของ "รายชื่อผู้สมัคร" (เจ้าของสั่ง 13 ส.ค. 2569)
          แบ่งด้วย **ผลโทร** ไม่ใช่สถานะใบสมัคร · เห็นครบทั้ง 3 เสมอแม้ยอดเป็น 0
          (0 คือคำตอบ ไม่ใช่ช่องว่าง) · โผล่เฉพาะแท็บนี้ — แท็บอื่นมีความหมายของตัวเอง */}
      {/* แบบ C (เจ้าของเคาะ 5 ต.ค. 2569 · ทุกแท็บ): หัวแต่ละแท็บ = แถวชิปกรองมีตัวเลข ไม่มีกล่องตัวเลขใหญ่
          · ผู้สมัคร = มุมมองย่อย 3 อัน (URL ?list=) · การติดต่อ = ยังไม่โทร/โทรแล้ว · ติดตามนัดหมาย = มา/ไม่มา/รอผล
          · โหมด drill-down (?bucket=) ไม่มีชิป — เลขต้องเท่ากล่องที่กดมา */}
      {/* ตัวเลขรายวัน พับได้ (เจ้าของสั่ง 15 ต.ค. 2569 · Choice "พับได้บนแท็บผู้สมัคร") — เหนือแถวชิปมุมมอง */}
      {!bucket && tab === 'candidates' ? <RecruitDailyPanel refreshKey={refreshKey} /> : null}
      {!bucket && tab === 'candidates' ? (
        <div className="mt-4">
          {/* 19 ต.ค. 2569 เจ้าของ "ทำเป็น Dropdown" — 11 ชิปล้น 2 แถว ⇒ ปุ่มเดียวกางดูครบพร้อมเลข */}
          <FilterChipsDropdown
            ariaLabel="มุมมองผู้สมัคร"
            value={listView}
            onChange={setListView}
            chips={RM_LIST_VIEWS_SHOWN.map((v) => ({
              id: v,
              label: RM_LIST_VIEW_LABEL[v],
              // โหลดล้ม = ยังไม่รู้เลข (null = "—") ไม่ใช่ 0 (QA 5 ต.ค. 2569)
              count: loading ? null : loadError ? 'unknown' : listViewCounts[v],
            }))}
          />
        </div>
      ) : null}
      {!bucket && tab === 'contact' ? (
        <div className="mt-4">
          <FilterChips
            ariaLabel="กรองการติดต่อ"
            value={contactChip}
            onChange={(next) => {
              setContactChip(next);
              setPage(1);
              setSelectedIds([]);
            }}
            chips={CONTACT_CHIPS.map((c) => ({ ...c, count: loading ? null : loadError ? 'unknown' : contactChipCounts[c.id] }))}
          />
        </div>
      ) : null}
      {!bucket && tab === 'appointments' ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* ของฉัน / ทุกคน (QA รอบ 2 ข้อ 4 · Choice 10 ต.ค. 2569) — supervisor ขึ้นไปเท่านั้น · ToggleGroup ของ shadcn
              ขนาด xs เท่าชิปข้าง ๆ · มุมมอง Lead/ยกเลิก มีเงื่อนไขของตัวเอง ไม่มีปุ่มนี้ */}
          {canSeeEveryoneAppointments(user?.role) && !leadView && !cancelledView ? (
            <ToggleGroup
              type="single"
              size="xs"
              variant="outline"
              value={appointmentScope}
              /* กดซ้ำตัวเดิม Radix ส่งค่าว่างมา — ถือว่าไม่เปลี่ยน */
              onValueChange={(v) => {
                if (!isRmAppointmentScope(v)) return;
                setAppointmentScope(v);
                setPage(1);
                setSelectedIds([]);
                say(null);
              }}
              aria-label="นัดของใคร"
            >
              {RM_APPOINTMENT_SCOPES.map((s) => (
                <ToggleGroupItem key={s} value={s}>
                  {RM_APPOINTMENT_SCOPE_LABEL[s]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
          <FilterChips
            ariaLabel="กรองผลนัด"
            value={appointmentChip}
            onChange={(next) => {
              setAppointmentChip(next);
              setPage(1);
              setSelectedIds([]);
            }}
            chips={APPOINTMENT_CHIPS.map((c) => ({
              id: c.id,
              label: c.label,
              // โหลดล้ม = "—" เหมือนแท็บอื่น (QA 17 ต.ค. 2569: เดิมขึ้น 0)
              count: loading ? null : loadError ? 'unknown' : appointmentChipCount(appointmentBoard, c.id),
            }))}
          />
          {/* ตารางรายวัน (ข้อ 12 · 20 ส.ค. 2569) ยังอยู่ — กางจากปุ่มนี้แทนการวางค้างไว้หัวแท็บ */}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setShowAppointmentDays((v) => !v)}
            aria-expanded={showAppointmentDays}
          >
            <CalendarDays aria-hidden /> รายวัน
            <ChevronDown className={cn('transition-transform', showAppointmentDays && 'rotate-180')} aria-hidden />
          </Button>
        </div>
      ) : null}

      {/* 🔴 แผงตัวกรองด้านข้าง — **กลับมาแล้วในหน้าตาแบบ iRecruit** (เจ้าของเคาะแบบร่าง 27 ก.ย. 2569:
          "เอาตามร่างเลย") · ของเดิมที่ถูกสั่งถอด 17 ส.ค. ("เอาออกจากทุกหน้าไปเลย") เป็นแถบซ้อนกันหลายชุด
          รอบนี้เป็นคำสั่งใหม่ (แจ้งเจ้าของแล้ว) · พับเก็บเปิดทีละหัวข้อ · หัวข้อไหนข้อมูลว่างซ่อนเอง */}

      {/* ตัวกรองวันที่สมัคร (เจ้าของสั่ง 22 ส.ค. 2569) — ใช้ปฏิทินตัวเดียวกับหน้า Dashboard
          ⚠️ ไม่โผล่ในโหมด drill-down (?bucket=) เพราะ server กรองมาแล้ว
          ถ้าให้กรองซ้ำที่นี่ เลขจะไม่ตรงกับกล่องที่กดมา */}
      {/* 🔴 **แถบกรองด้านซ้ายแบบ iRecruit** (เจ้าของสั่ง 28 ก.ย. 2569: *"หน้าอื่นๆพวก รายชื่อผู้สมัคร
          การโทรของฉัน ฯลฯ ทำแบบ Irecruit เลย"* → Choice "แถบกรองซ้ายตามแบบร่างที่เคาะไว้")
          · จอ sm (640px) ขึ้นไป = แถบซ้าย (`FilterSidebar`) · จอมือถือ = ปุ่มไอคอนเปิดแผง (แถวนี้)
          · 30 ก.ย. 2569 ย้ายจาก xl ลงมา sm — เจ้าของดูในจอกว้าง ~750px เลยไม่เคยเห็นแถบข้างรายชื่อ ·
            ค่าตั้งต้นพับ (ตารางได้เต็มกว้าง) · กางแล้วตารางเลื่อนข้างในได้ ชื่ออยู่คอลัมน์ซ้ายสุดจึงยังเห็น
          · แท็บกล่องงานยังเป็นปุ่มเดียว (แบบ A) — เจ้าของ: "หน้ากล่องงาน … เป็นช่องๆแบบเดิม"
          · วันที่สมัครเป็นหัวข้อหนึ่งในแถบ · โหมด drill-down (?bucket=) ไม่มีแถบกรอง (เลขต้องเท่ากล่องที่กดมา) */}
      {!bucket ? (
        /* จอมือถือ = ปุ่มไอคอนเปิดแผง · จอ sm ขึ้นไป = แถวนี้ซ่อน (ปุ่มไอคอนกางแถบอยู่ข้างรายชื่อ
           · หัวแถบมีปุ่มล้าง/ผลลัพธ์ของตัวเองแล้ว) */
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:hidden">
          <FilterSheetButton
            facets={applicantFacets}
            primary={applicantPrimaryFacets(tab)}
            attach={APPLICANT_FACET_ATTACH}
            onToggle={toggleApplicantFacet}
            sections={applicantPanelSections}
            onClear={clearApplicantPanel}
            resultText={`เหลือ ${filtered.length.toLocaleString('th-TH')} รายชื่อ`}
          />
          {panelSelected > 0 ? (
            <>
              <Button type="button" variant="outline" size="xs" onClick={clearApplicantPanel}>
                <RotateCcw aria-hidden /> ล้าง
              </Button>
              <span className={cn('text-xs', DASH.sub)}>
                เหลือ {filtered.length.toLocaleString('th-TH')} รายชื่อ
              </span>
            </>
          ) : null}
        </div>
      ) : null}
      {/* แถบ "กำลังดู: … — N คนข้างล่าง" ถูกถอด 27 ก.ย. 2569 (Clean — ไม่มีประโยคอธิบาย) */}
      {/* จอ sm ขึ้นไป: แถบกรองอยู่ข้างรายชื่อเสมอ — พับ = ปุ่มไอคอน (`FilterRail`) · กาง = แถบเต็ม ตารางยังเห็นข้าง ๆ */}
      <div className={cn('mt-5', !bucket && 'sm:flex sm:items-start sm:gap-3')}>
        {!bucket && !filterOpen ? <FilterRail selected={panelSelected} onExpand={() => changeFilterOpen(true)} /> : null}
        {!bucket && filterOpen ? (
          <FilterSidebar
            facets={applicantFacets}
            primary={applicantPrimaryFacets(tab)}
            attach={APPLICANT_FACET_ATTACH}
            onToggle={toggleApplicantFacet}
            sections={applicantPanelSections}
            onClear={clearApplicantPanel}
            resultText={`เหลือ ${filtered.length.toLocaleString('th-TH')} รายชื่อ`}
            onCollapse={() => changeFilterOpen(false)}
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-4">
          {/* ⚠️ RmToolbar (ช่องทาง/สร้างลิงก์/เหตุผล) ถูกเอาออก (เจ้าของสั่ง 14 ส.ค. 2569:
              "กล่องช่องทาง ฯลฯ มีแค่หน้ากล่องงาน") — เครื่องมือพวกนี้เหลือที่ RecruitBoardTools
              บนกล่องงาน (view=board) เท่านั้น · เหลือแค่ค้นหา + เพิ่มผู้สมัคร + Lead */}
          {/* แบบ C (5 ต.ค. 2569): แถวปุ่มลอย ไม่มีกล่องครอบ · ปุ่มต่อแท็บตามที่เจ้าของสั่ง (ดูหัวไฟล์ RmSearchBar) */}
          <RmSearchBar
            hideSearch={searchInHeader}
            keyword={keyword}
            onKeywordChange={(v) => {
              setKeyword(v);
              setPage(1);
            }}
            onSearch={() => setPage(1)}
            selectedCount={selectedIds.length}
            /* เพิ่มข้อมูลผู้สมัคร + นำเข้า Excel + รายงาน มีแค่แท็บผู้สมัคร (เจ้าของสั่ง 4–5 ต.ค. 2569) */
            onAddApplicant={tab === 'candidates' ? () => setAddOpen(true) : undefined}
            onImportApplicants={tab === 'candidates' && !headerActionsSlot ? () => setImportOpen(true) : undefined}
            /* "เก็บไปโทรเอง" เหลือแท็บผู้สมัครแท็บเดียว — การติดต่อ: *"ไม่ต้องมีคำว่าเก็บไปโทรเองแล้ว"* (5 ต.ค. 2569) */
            onHoldSelected={tab === 'candidates' ? () => void keepSelectedForSelf() : undefined}
            holdingSelected={holdingSelected}
            onSendAiSelected={() => askSendAi(selectedIds)}
            /* "ถอย Lead" — การติดต่อ ติ๊กแล้วโผล่ (5 ต.ค. 2569) · ย้ายกลับแท็บผู้สมัคร */
            onReleaseSelected={tab === 'contact' ? () => void releaseSelected() : undefined}
            releasing={releasing}
            onExport={tab === 'candidates' && !headerActionsSlot ? () => downloadApplicantExport(shown, { recruiterOf }) : undefined}
            exportCount={shown.length}
            /* แท็บติดตามนัดหมาย: "โหลดเป็น PDF" (4 ต.ค. 2569) · window.print + print CSS เฉพาะก้อน rm-print-area */
            onPrintPdf={tab === 'appointments' ? () => window.print() : undefined}
            printDisabled={Boolean(loadError) || loading || rows.length === 0}
          />
          {/* นำเข้า Excel + รายงาน ขึ้นแถวหัวข้างปุ่มวันที่ (14 ต.ค. 2569) — หน้าตาเดียวกับปุ่มเดิมใน `RmSearchBar` */}
          {tab === 'candidates' && headerActionsSlot
            ? createPortal(
                <>
                  <Button variant="secondary" size="xs" type="button" onClick={() => setImportOpen(true)} className="shrink-0">
                    <FileSpreadsheet aria-hidden /> นำเข้า Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => downloadApplicantExport(shown, { recruiterOf })}
                    disabled={shown.length === 0}
                    title={shown.length === 0 ? 'ไม่มีรายชื่อให้ส่งออก' : `ส่งออก ${shown.length} รายชื่อที่กรองอยู่ เป็นไฟล์ Excel (.csv)`}
                    className="shrink-0"
                  >
                    <Download aria-hidden /> รายงาน
                  </Button>
                </>,
                headerActionsSlot,
              )
            : null}

          {notice ? (
            <div
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs',
                TONE.warn.soft,
                TONE.warn.value,
              )}
            >
              <span>{notice}</span>
              {noticeGoContact ? (
                <Button type="button" size="xs" variant="outline" onClick={() => goToTab('contact')}>
                  ไป{RM_TAB_LABEL.contact}
                  <ChevronRight aria-hidden />
                </Button>
              ) : null}
            </div>
          ) : null}

          {/* ปุ่มเข้า "คลังสำรอง (Lead)" / "ดูที่ยกเลิก" ถอดจากแถวเครื่องมือแล้ว (เจ้าของสั่ง 5 ต.ค. 2569 — ผู้สมัครมี 5 ปุ่ม)
              ลิงก์เก่า ?lead=1 / ?cancelled=1 ยังเปิดได้ — ต้องมีทางกลับรายชื่อหลักเสมอ */}
          {leadView || cancelledView ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('whitespace-nowrap', TONE.violet.chip)}>
                {leadView ? 'คลังสำรอง (Lead)' : 'ใบที่ยกเลิกข้อมูล'}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => (leadView ? setLeadView(false) : setCancelledView(false))}
              >
                {LEAD_VIEW_LABEL.exit}
              </Button>
            </div>
          ) : null}

          {tab === 'appointments' ? (
            <div className="space-y-2 rm-appointments-head">
              {/* วันนี้ใครนัดไปที่ไหน (เจ้าของ 21 ต.ค. 2569 · แบบ iRecruit "ติดตามนัด") — กดแถวกรองรายชื่อข้างล่าง */}
              {!bucket ? (
                <AppointmentPlacesCard
                  ymd={placeDay}
                  isToday={placeDay === todayYmd}
                  total={appointmentPlaces.total}
                  places={appointmentPlaces.places}
                  picked={placePick && placePick.ymd === placeDay ? placePick.key : null}
                  loading={loading && rows.length === 0}
                  failed={Boolean(loadError)}
                  onShiftDay={(n) => {
                    setPlaceDay((d) => shiftYmd(d, n));
                    setPlacePick(null);
                    setPage(1);
                  }}
                  onToday={() => {
                    setPlaceDay(todayYmd);
                    setPlacePick(null);
                    setPage(1);
                  }}
                  onPick={(key) => {
                    setPlacePick(key === null ? null : { ymd: placeDay, key });
                    setPage(1);
                    setSelectedIds([]);
                  }}
                  onPrint={(key) => {
                    // ปุ่ม PDF บนแถว (แบบ iRecruit) — เลือกแถวนั้นก่อน แล้วพิมพ์หลังจอวาดใบพิมพ์ใหม่
                    setPlacePick({ ymd: placeDay, key });
                    window.setTimeout(() => window.print(), 300);
                  }}
                />
              ) : null}
              {/* 🔴 ประโยคสรุป "นัดสัมภาษณ์ N คน จากทั้งหมด…" ถอดออก · ปุ่ม "โหลดเป็น PDF" ย้ายไปแถวเครื่องมือ
                  คู่กับเพิ่มข้อมูลผู้สมัคร (RmSearchBar `onPrintPdf`) — เจ้าของสั่ง 4 ต.ค. 2569 */}

              {/* ก้อน "นัด → มาไหม (ยอดทั้งระบบ · ย้ายมาจากศูนย์คุมงานสรรหา)" ถอดทั้งก้อน (เจ้าของสั่ง 4 ต.ค. 2569)
                  เหลือบอร์ดสรุปนัดข้างล่าง (นับจากรายการในหน้า) · ถัง ?bucket=overdue_no_result ยังเปิดจากลิงก์เดิมได้ */}

              {/* บอร์ดสรุปนัด (เจ้าของสั่ง 20 ส.ค. 2569 ข้อ 12: *"มีบอร์ดแสดงว่านัดทั้งหมด
                  เท่าไหร่ มาเท่าไหร่ ไม่มาเท่าไหร่"* + รายวัน) — ตรรกะที่ appointmentBoard.ts
                  · สีจาก TONE ที่เดียว · "รอผล" ต้องเห็นเป็นเลข ไม่ใช่หาย */}
              {/* กล่องตัวเลข 4 ใบ → ชิปกรองหัวแท็บ (แบบ C · 5 ต.ค. 2569) · ตารางรายวันกางจากปุ่ม "รายวัน"
                  🔴 ว่าง = แถว "ไม่มีนัด" ไม่ใช่ตารางหาย */}
              {showAppointmentDays ? (
                <div className="space-y-2">
                  <div className="overflow-x-auto rounded-xl border border-border/70">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className={cn('text-left', DASH.tableHead)}>
                          <th className="px-3 py-2 font-medium">วันนัด</th>
                          <th className="px-3 py-2 text-center font-medium">นัดทั้งหมด</th>
                          {/* รอผลมาก่อน — มือถือเห็นโดยไม่ต้องปัด (QA 18 ต.ค. 2569) */}
                          <th className="px-3 py-2 text-center font-medium">รอผล</th>
                          <th className="px-3 py-2 text-center font-medium">มา</th>
                          <th className="px-3 py-2 text-center font-medium">ไม่มา</th>
                          <th className="px-3 py-2 text-center font-medium">เลื่อนนัด</th>
                          <th className="px-3 py-2 text-center font-medium">ผ่าน</th>
                          <th className="px-3 py-2 text-center font-medium">ไม่ผ่าน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* โหลดล้ม = ไม่โชว์เลขรอบก่อน (QA 18 ต.ค. 2569) */}
                        {loadError ? (
                          <tr className={cn('border-t', DASH.tableRow)}>
                            <td colSpan={8} className={cn('px-3 py-3 text-center', DASH.cellMuted)}>
                              โหลดไม่สำเร็จ
                            </td>
                          </tr>
                        ) : appointmentBoard.days.length === 0 ? (
                          <tr className={cn('border-t', DASH.tableRow)}>
                            <td colSpan={8} className={cn('px-3 py-3 text-center', DASH.cellMuted)}>
                              ไม่มีนัด
                            </td>
                          </tr>
                        ) : null}
                        {(loadError ? [] : appointmentBoard.days).map((d) => (
                          <tr key={d.date} className={cn('border-t', DASH.tableRow)}>
                            <td className={cn('px-3 py-2 whitespace-nowrap', DASH.cellStrong)}>
                              {formatYmdTh(d.date)}
                            </td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', DASH.cell)}>{d.total}</td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', DASH.cellMuted)}>{d.pending}</td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', TONE.success.value)}>{d.showed}</td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', TONE.danger.value)}>{d.noShow}</td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', TONE.warn.value)}>{d.rescheduled}</td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', TONE.success.value)}>{d.passed}</td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', TONE.danger.value)}>{d.notPassed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* แท็บ "การโทรของฉัน" มี 2 ส่วนที่ **ทำงานคนละแบบ** (เจ้าของสั่ง 14 ส.ค. 2569):
              1. เก็บไปโทรเอง (call hold ผูกเบอร์ · มาจากหน้า Matching + ปุ่มโทรในแท็บนี้) — MyCallsSection
                 เจ้าของ pain: "เก็บไปโทรเองแล้วไปอยู่ไหนหาไม่เจอ" → ให้มีที่ถาวรตรงนี้
              2. เก็บไปติดต่อ (claim บนใบสมัคร) — RmTable ด้านล่าง
              ⚠️ MyCallsSection ซ่อนตัวเองเมื่อไม่มีงานโทรค้าง (holds=0) — hint จึงบอกไว้เสมอ */}
          {tab === 'contact' ? (
            <>
              {/* ป้าย "2 ส่วนที่ทำงานคนละแบบ…" ถอดออก (เจ้าของสั่ง 4 ต.ค. 2569 — ห้ามประโยคอธิบายบนจอ) */}
              {/* บอร์ดรับสมัคร = พื้นที่ของทีมสรรหา → เห็นเฉพาะงานโทรเลนสรรหา
                  (คนยังไม่สมัคร) · งานเลนคัดสรรมีหน้าของตัวเองที่ /matching/contact
                  (เจ้าของสั่ง 16 ส.ค. 2569: "ไม่ปนกัน") */}
              {/* ใบสมัครที่เก็บไปโทรเองอยู่ในตารางแล้ว — ไม่แยกกล่องซ้ำ (เจ้าของ 8 ต.ค. 2569) */}
              <MyCallsSection lane="recruit" skipApplications />
            </>
          ) : null}

          {loadError ? (
            <p className={cn('rounded-xl border px-3 py-2 text-[12px]', TONE.danger.soft, TONE.danger.value)}>
              {loadError}{' '}
              <Button type="button" size="xs" variant="outline" onClick={load}>
                ลองใหม่
              </Button>
            </p>
          ) : loading ? (
            <p className={cn('rounded-xl border px-3 py-6 text-center text-sm', DASH.card, DASH.muted)}>
              กำลังโหลดใบสมัคร…
            </p>
          ) : (
            <>
              {/* แถบบอกโหมด drill-down จากกล่อง dashboard — เลขต้องเท่ากล่องที่กดมา */}
              {bucket ? (
                <div
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs',
                    TONE.primary.soft,
                  )}
                >
                  <span>
                    กำลังดูจากกล่อง: <b>{RM_BUCKET_LABEL[bucket]}</b> ({filtered.length} ใบ) —
                    มุมมองนี้รวมทุกแท็บ/ทุกสถานะ
                  </span>
                  <Button variant="ghost" size="sm" type="button" onClick={clearBucket} className="shrink-0">
                    <X aria-hidden /> ล้าง
                  </Button>
                </div>
              ) : null}
              {/* กอง "เลือกวิธีโทร" (Phase 5.9) — ใบที่ worker ถอด claim เพราะดองเกิน 1 วัน
                  🔴 ซ่อนตัวเองเมื่อไม่มีของ (แพตเทิร์นเดียวกับ MyCallsSection) — แถบที่ขึ้น
                  ทุกวันด้วยเลข 0 คือขยะ (เจ้าของ: "ของน้อยคือสัญญาณ ของเยอะคือพื้นหลัง") */}
              {awaitingChoiceRows.length > 0 ? (
                <div className={cn('space-y-2 rounded-xl border px-3 py-2.5', TONE.warn.soft)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={cn('text-xs font-medium', TONE.warn.value)}>
                      ต้องเลือกวิธีโทร {awaitingChoiceRows.length.toLocaleString('th-TH')} คน —
                      ถูกถอดจากคนที่เก็บไว้แล้วไม่โทรเกิน 1 วัน
                    </p>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Button variant="secondary" size="sm"
                        type="button"
                        onClick={() => void keepForSelf(awaitingChoiceRows.map((r) => r.id))}
                        >
                        เก็บไปโทรเองทั้งหมด
                      </Button>
                      <Button size="sm"
                        type="button"
                        onClick={() => askSendAi(awaitingChoiceRows.map((r) => r.id))}
                        >
                        ส่ง AI โทรทั้งหมด
                      </Button>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {awaitingChoiceRows.slice(0, AWAITING_ROWS_SHOWN).map((r) => {
                      const cd = choiceCountdown(r.unclaimed_at, now);
                      return (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-1 text-xs first:border-0 first:pt-0"
                        >
                          <span className="min-w-0">
                            <b className={DASH.cellStrong}>{r.full_name}</b>
                            {r.unclaimed_from_name ? (
                              <span className={DASH.muted}> · เดิม {r.unclaimed_from_name} เก็บไว้</span>
                            ) : null}
                            {cd ? (
                              <span className={cd.overdue ? TONE.danger.value : TONE.warn.value}>
                                {' '}
                                · {cd.label}
                              </span>
                            ) : null}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void keepForSelf([r.id])}
                              className={cn(
                                // min-h-9 = 36px กดโดนด้วยนิ้วบนมือถือ (เกณฑ์ของ panel เอกสาร)
                                'inline-flex min-h-9 items-center rounded-full border px-3 font-medium',
                                TONE.primary.outline,
                              )}
                            >
                              โทรเอง
                            </button>
                            <button
                              type="button"
                              onClick={() => askSendAi([r.id])}
                              className={cn(
                                'inline-flex min-h-9 items-center rounded-full border px-3 font-medium',
                                TONE.violet.outline,
                              )}
                            >
                              ส่ง AI โทร (ยิงสายจริง)
                            </button>
                          </span>
                        </li>
                      );
                    })}
                    {awaitingChoiceRows.length > AWAITING_ROWS_SHOWN ? (
                      <li className={cn('pt-1 text-xs', DASH.muted)}>
                        และอีก {awaitingChoiceRows.length - AWAITING_ROWS_SHOWN} คน — ใช้ปุ่ม
                        "ทั้งหมด" ด้านบน หรือกดกล่อง "รอเลือกวิธีโทร" บนแดชบอร์ดเพื่อดูครบ
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              {/* rm-print-area: ตอนกด "โหลดเป็น PDF" print CSS จะโชว์เฉพาะก้อนนี้
                  (เฉพาะแท็บนัดหมาย — แท็บอื่นพิมพ์ทั้งหน้าตามปกติ) */}
              {elsewhere.length > 0 ? (
                <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs', TONE.info.soft)}>
                  <span className={TONE.info.value}>ผู้สมัครตามตัวกรองนี้อยู่แท็บ</span>
                  {elsewhere.map((x) => (
                    <Button
                      key={x.tab}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => goToTab(x.tab)}
                    >
                      {RM_TAB_LABEL[x.tab]} {x.n.toLocaleString('th-TH')} คน
                    </Button>
                  ))}
                </div>
              ) : null}
              <div className={tab === 'appointments' ? 'rm-print-area' : undefined}>
              {tab === 'appointments' ? <AppointmentPrintSheet groups={printGroups} /> : null}
              <div className={tab === 'appointments' ? 'print:hidden' : undefined}>
              <RmTable
                tab={tab}
                rows={pageRows}
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                onAction={onRowAction}
                holdByRef={holdByRef}
                onAttendance={onAttendance}
                unitOf={unitOf}
                recruiterOf={recruiterOf}
                actionsOverride={cancelledView ? ['view', 'restore'] : undefined}
              />
              </div>
              </div>
              {/* ตัวแบ่งหน้าแบบเดียวทั้งระบบ ‹ 1/N › (`PagePager` · เจ้าของ Choice 12 ต.ค. 2569) */}
              <PagePager
                className="pt-2"
                page={currentPage}
                pageCount={totalPages}
                onPageChange={setPage}
                summary={`แสดง ${shown.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, shown.length)} จาก ${shown.length}`}
                size={{
                  value: pageSize,
                  options: PAGE_SIZE_OPTIONS,
                  onChange: (s) => {
                    setPageSize(s as PageSizeOption);
                    setPage(1);
                  },
                }}
              />
            </>
          )}
        </div>
      </div>

      <AddApplicantDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(created) => {
          // เบอร์เดิมเคยสมัคร = บอกเลยว่ากี่ครั้ง (21 ต.ค. 2569)
          const n = created?.apply_count ?? 1;
          say(n > 1 ? `บันทึกผู้สมัครแล้ว · เบอร์นี้สมัครมาแล้ว ${n} ครั้ง` : 'บันทึกผู้สมัครแล้ว');
          load(); // ใบใหม่ต้องโผล่ในตารางทันที ไม่ต้องให้กดรีเฟรชเอง
        }}
      />

      <ImportApplicantsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSaved={(inserted) => {
          say(`นำเข้าผู้สมัครแล้ว ${inserted} คน`);
          load();
        }}
      />

      {/* ยืนยันก่อนให้ AI โทรจริง — โชว์รายชื่อ (Phase 5.9/5.12 · กติกา: ปุ่มที่ยิงสายต้องมีป๊อป) */}
      <CallChoiceConfirmDialog
        open={aiConfirmIds !== null}
        names={aiConfirmNames}
        busy={aiSending}
        onCancel={() => setAiConfirmIds(null)}
        onConfirm={() => void confirmSendAi()}
        confirmDisabled={aiUnbound.length > 0 && !bindJobId}
        extra={
          aiUnbound.length > 0 ? (
            <div className="space-y-1.5" data-testid="ai-bind-job">
              <p className="text-sm font-medium text-foreground">
                {aiUnbound.length === aiConfirmNames.length
                  ? 'ยังไม่มีใบขอหรือใบขอปิดแล้ว เลือกใบขอ หรือให้ AI ทักทายถามก่อน'
                  : `${aiUnbound.length} คนยังไม่มีใบขอหรือใบขอปิดแล้ว เลือกใบขอ หรือให้ AI ทักทายถามก่อน`}
              </p>
              <SearchableSelect
                value={bindJobId}
                onChange={setBindJobId}
                groups={bindGroups}
                placeholder="เลือกใบขอ"
                searchPlaceholder="ค้นหาหน่วยงาน ตำแหน่ง จังหวัด"
                emptyText="ไม่เจอใบขอ"
              />
            </div>
          ) : null
        }
      />

      {/* ดูข้อมูลของแท็บผู้สมัคร = ป๊อปแบบรูป iRecruit (4 ต.ค. 2569): แท็บ 6 อัน ไม่มีขั้นตอน 3 ขั้น + ยกเลิกข้อมูลผู้สมัคร
          (แทนใบประวัติเต็มหน้า 1 ต.ค.) · คนละโหมดของป๊อปตัวเดียวกับแท็บการติดต่อ */}
      {profileApp ? (
        <ApplicantContactDialog
          mode="profile"
          application={profileApp}
          recruiterName={recruiterOf(profileApp)}
          jobRecruiterName={jobRecruiterOf?.(profileApp) ?? null}
          onClose={() => setProfileApp(null)}
          onSaved={() => {
            say('บันทึกข้อมูลผู้สมัครแล้ว');
            load();
          }}
          onCancelled={() => {
            say(`ยกเลิกข้อมูล ${profileApp.full_name} แล้ว`);
            setProfileApp(null);
            load();
          }}
        />
      ) : null}

      {/* dialog รายละเอียด + ติดต่อสำเร็จ/ไม่สำเร็จ + นัด (ลิสต์ข้อ 7 · 14 ส.ค. 2569) */}
      <ApplicantContactDialog
        application={contactApp}
        recruiterName={contactApp ? recruiterOf(contactApp) : null}
        jobRecruiterName={contactApp ? (jobRecruiterOf?.(contactApp) ?? null) : null}
        /* แท็บติดตามนัดหมาย = ป๊อปติดตามนัด · แท็บการติดต่อ = ติดต่อ→นัดหมาย (4 ต.ค. 2569) */
        mode={tab === 'appointments' ? 'appointment' : 'contact'}
        onClose={() => setContactApp(null)}
        onSaved={() => {
          say('บันทึกผลติดต่อแล้ว');
          load(); // สถานะใบเปลี่ยน (นัดได้ = converted) แถวอาจย้ายแท็บ — โหลดใหม่ให้เห็นทันที
        }}
      />
    </div>
  );
};

export default RmWorkspace;
