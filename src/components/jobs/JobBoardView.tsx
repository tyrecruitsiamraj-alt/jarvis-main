import React, { useEffect, useMemo, useState } from 'react';
import { trackPublicClick } from '@/lib/publicClickApi';
import { useSearchParams } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { jobSectorLabel } from '@/lib/unitRequestDisplay';
import { jobBoardCardTitle, jobBoardCardSubtitle, publicJobCardSubtitle } from '@/lib/unitRequestDisplay';
import BoardCardProgress from '@/components/jobs/BoardCardProgress';
import {
  canShowNumbers,
  combineFeedStates,
  dataAgeLabel,
  type FeedState,
} from '@/lib/boardDataState';
import { apiFetch, httpStatusOf } from '@/lib/apiFetch';
import { extractJobSubtypeLabel } from '@/lib/siamrajUnitFilters';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { EM_DASH, dashIfEmpty } from '@/lib/displayFallback';
import { inferProvinceFromAddress, inferSubdistrictFromAddress } from '@/lib/parseThaiJobAddress';
import { benefitDisplayLabels } from '@/lib/extraBenefits';
import { payCycleText, payCyclesOf } from '@/lib/payCycle';
import { displayDistrictLine } from '@/lib/displayJobLocation';
import { resolveApplyPositionPreset } from '@/lib/jobBoardPositionPreset';
import JobBoardTopFilters from '@/components/jobs/JobBoardTopFilters';
import { publicJobTitle } from '@/lib/publicJobTitle';
import PrequestBadge from '@/components/jobs/PrequestBadge';
import BoardJobCard from '@/components/jobs/BoardJobCard';
import SearchField from '@/components/shared/SearchField';
import PublicApplyDialog from '@/components/jobs/PublicApplyDialog';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';
/**
 * เลนสรรหา — lazy ตั้งใจ: ไฟล์นี้ใช้ร่วมกับหน้าสมัครสาธารณะ /apply
 * กล่องผลค้น (+ ตัวเรียก API หลังบ้าน) ต้องไม่ถูกลากเข้า bundle ฝั่ง public
 */
import RecruitBoardTools from '@/components/jobs/RecruitBoardTools';
import PageHeader from '@/components/shared/PageHeader';
import {
  applicantOriginSummary,
  fetchJobApplicantBreakdown,
  type ApplicationOrigin,
} from '@/lib/publicApplicationsApi';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { getTotalPages, type PageSizeOption } from '@/lib/pagination';
import { fetchRecruitPostings } from '@/lib/recruitPostingsApi';
import { selectSilentLinkRows } from '@/lib/jobLinkSilence';
import { buildCountIndex, buildJobKeyIndex, countFor } from '@/lib/jobKeyIndex';
import {
  MOVED_ON_STAGE_KEYS,
  buildBoardStages,
  type BoardStageFacts,
} from '@/lib/boardFlow';
import BoardReleaseHeader from '@/components/jobs/BoardReleaseHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
const BoardPostingSteps = React.lazy(() =>
  import('@/pages/jobs/BoardPostingPage').then((m) => ({ default: m.BoardPostingSteps })),
);
/** ป๊อปประกาศหน้าเดียว (เจ้าของเลือก B 2 ต.ค. 2569) — ตั้งแต่ 4 ต.ค. เป็นทางถอยที่ `?popup=sheet` (ค่าเริ่ม = ป๊อป 4 หน้า) */
const BoardPublishSheet = React.lazy(() => import('@/components/jobs/BoardPublishSheet'));

/**
 * id ที่หน้าไล่งานต้องใช้ — 🔴 ต้องเป็นรูปเดียวกับที่ URL ของใบขอใช้
 * (ใบขอล่วงหน้าต้องพก prefix `siamraj-pre:` ไม่งั้นอ่านผิดบริษัท)
 * ⚠️ ถอดจาก `boardPostingPath()` เพื่อไม่ให้มีสูตรประกอบ id สองชุด
 */
function postingUnitId(job: JobRequest): string {
  const p = boardPostingPath(job);
  const m = /^\/jobs\/board\/(.+)\/posting$/.exec(p);
  return m ? decodeURIComponent(m[1]) : job.id;
}
import {
  RELEASE_LANE_TEXT,
  buildReleaseLedger,
  releaseProgressOf,
  releaseProgressTitle,
  filterByReleaseLane,
  type ReleaseFacts,
  type ReleaseLaneKey,
  type BoardPublishedTotals,
} from '@/lib/boardRelease';
import JobBoardSilentLinks from '@/components/jobs/JobBoardSilentLinks';
import {
  buildReleaseIndex,
  fetchJobReleases,
  type JobRelease,
} from '@/lib/jobPublicReleaseApi';
import { fetchReleaseSkips } from '@/lib/jobReleaseSkipApi';
import { publishReadinessOf, type PublishReadinessFacts } from '@/lib/publishReadiness';
import { buildSkipIndex, type JobReleaseSkip } from '@/lib/jobReleaseSkips';
import { boardPostingPath } from '@/lib/jobNavigation';
import { useHeaderSearch } from '@/hooks/useHeaderSearch';
import { APPLICANT_FILTER_PARAM_PREFIX } from '@/lib/applicantFilters';
import { STANDALONE_POSTING_KINDS, type RecruitPosting } from '@/lib/recruitPostings';
import {
  CLOSED_BOX_KEYS,
  JOB_BOX_HINT,
  JOB_BOX_LABEL,
  JOB_BOX_TONE,
  OPEN_BOX_KEYS,
  compareByClosedDateDesc,
  countOpenBoxes,
  countOpenBoxPositions,
  filterByClosedBox,
  filterByOpenBox,
  isClosedBox,
  type ClosedBoxKey,
  type JobBoxKey,
  type OpenBoxKey,
} from '@/lib/jobBoxGroups';
import { CLOSED_RANGE_OPTIONS } from '@/hooks/useClosedRequestsFeed';
import { jobPositionUnits, sumJobPositionUnits } from '@/lib/jobPositionUnits';
import { DASH, EVEN_TYPE, TONE, type ToneKey } from '@/lib/designTokens';
import { INCOME_PERIOD_LABEL } from '@/lib/incomeBreakdown';
import { incomeDisplay } from '@/lib/incomeLabel';
import { publicBenefitList, publicFieldVisible } from '@/lib/publicFieldVisibility';
import { useJobBoardFilters } from '@/hooks/useJobBoardFilters';
import {
  applyBoardFilters,
  BOARD_SORT_PARAM,
  buildBoardFacets,
  EMPTY_BOARD_FILTER_STATE,
  hasAnyBoardFilter,
  readBoardFilterState,
  readBoardSearch,
  readBoardSort,
  sortBoardJobs,
  toggleBoardFacetValue,
  writeBoardFilterState,
  applyPublicFilters,
  buildPublicFacets,
  publicFilterState,
  writeBoardSearch,
  type BoardDateField,
  type BoardFacetFacts,
  type BoardFacetKey,
  type BoardFilterState,
  type BoardSort,
} from '@/lib/boardFilters';
import { BoardFilterBar, BoardResetButton } from '@/components/jobs/BoardFilterPanel';
import { compareJobsByAgeDaysDesc, getJobAgeChipInfo, JOB_AGE_CHIP_META } from '@/lib/jobUrgency';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MapPin, Briefcase, Calendar, Banknote, RefreshCw, Send, Users, Link2, Pencil, Search, Flag, EyeOff, LoaderCircle } from 'lucide-react';
const RecruitLaneDialog = React.lazy(() => import('@/components/jobs/RecruitLaneDialog'));
import {
  isUnitRequestWorkStatus,
  UNIT_REQUEST_WORK_STATUS_LABELS,
} from '@/lib/unitRequestWorkStatus';
import { isHiddenFromPublicByWorkStatus } from '@/lib/publicJobVisibility';
import { cn } from '@/lib/utils';
import { SEARCH_ALL_POOLS_AND_CALL } from '@/lib/candidateSearchLabels';
import { Button } from '@/components/ui/button';

function staffAssigneeLine(j: JobRequest): string | null {
  const parts = [
    // ทีม online = ผู้รับผิดชอบ (เจ้าของสั่ง 18 ส.ค. 2569) — ขึ้นก่อนเพื่อน
    j.online_name ? `Online ${j.online_name}` : null,
    j.opl_name ? `OPL ${j.opl_name}` : null,
    j.recruiter_name ? `สรรหา ${j.recruiter_name}` : null,
    j.screener_name ? `คัดสรร ${j.screener_name}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** BU ตั้งต้นของกล่องลอยที่ยังไม่มีประกาศ — ผู้ใช้แก้ได้ในฟอร์ม (ชุดเดียวกับ RecruitBoardTools) */
const BOARD_DEFAULT_BU = 'LBD';

/** สีกล่องลอยต่อประเภท (mockup rev.3 ข้อ 04) — ม่วง/ม่วง/ฟ้า/ส้ม/เขียว ตามลำดับใน STANDALONE_POSTING_KINDS */
const STANDALONE_KIND_TONE: Record<string, ToneKey> = {
  thai_executive: 'violet',
  foreign_executive: 'violet',
  central: 'info',
  valet: 'orange',
  government: 'success',
};

export type JobBoardViewProps = {
  jobs: JobRequest[];
  loading: boolean;
  loadError?: string | null;
  variant?: 'public' | 'staff';
  searchPlaceholder?: string;
  onRefresh?: () => void;
  /** สภาพของเส้นใบขอจากหน้าแม่ — `failed`/`forbidden` = ห้ามโชว์เลข (ดู boardDataState) */
  feedState?: FeedState;
  /** ข้อมูลใบขอที่ถืออยู่เก่ากี่วินาที — `null` = ไม่รู้ */
  dataAgeSeconds?: number | null;
  refreshing?: boolean;
  detailReturnTo?: string;
  /**
   * มุมมองของบอร์ดฝั่งเจ้าหน้าที่ (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก: รวมหน้า RM เข้าบอร์ด
   * · 13 ส.ค. 2569: ยก "การติดต่อ"/"ติดตามนัดหมาย" ขึ้นเป็นแท็บระดับบอร์ด)
   * 'board' = กล่องงาน · ที่เหลือ = เนื้อ RM คนละแท็บ (ส่งมาทาง listContent —
   * StaffJobBoardPage เป็นคนเลือกแท็บให้ RmWorkspace ตาม view)
   * ⚠️ ตัวเนื้อ list ถูก import ที่ StaffJobBoardPage ไม่ใช่ที่นี่ — ไฟล์นี้ใช้ร่วมกับ
   * หน้าสมัครสาธารณะ ห้ามลากโค้ด RM เข้ามาใน bundle
   */
  view?: BoardViewId;
  onViewChange?: (view: BoardViewId) => void;
  listContent?: React.ReactNode;
  /** ของแท็บ RM ที่วางข้างปุ่มรีเฟรชบนแถวหัวหน้า (ปฏิทินวันที่สมัคร · 5 ต.ค. 2569) — แท็บโพสต์ประกาศไม่ใช้ */
  listHeaderActions?: React.ReactNode;
  /**
   * ชุดใบที่ปิดแล้ว/ยกเลิก (คนละ feed กับกล่องงาน) — ส่งมาจาก `StaffJobBoardPage`
   * เจ้าของสั่ง 19 ส.ค. 2569: *"ปิดแล้วกับยกเลิกในหน้ากล่องงานมันต้องกดแล้วดูได้
   * แบบกล่องอื่น ๆ สิ กดแล้วเด้งไปหน้าอื่นทำไม ทำไมไม่ทำให้มันเหมือนกัน"*
   * → กล่องทั้ง 6 กดแล้วกรองการ์ดในหน้าเดิมเหมือนกันหมด ไม่สลับมุมมองอีก
   */
  closedJobs?: JobRequest[];
  closedLoading?: boolean;
  closedError?: string | null;
  closedDays?: number;
  onClosedDaysChange?: (days: number) => void;
  onReloadClosed?: () => void;
  /** กล่องที่ให้เลือกไว้ตั้งแต่เปิดหน้า — รองรับลิงก์เก่า `?view=closed` / `?view=cancelled` */
  initialBox?: JobBoxKey | null;
  /**
   * ส่งยอด "ประกาศ" ของกล่องงานทั้งก้อนให้หน้าแม่ (แท็บภาพรวมใช้เลขเดียวกับหัว · 1 ต.ค. 2569)
   * `null` = ตัวเลขยังบอกไม่ได้ (ทะเบียนยังโหลดไม่ครบ/พัง) — ห้ามแปลงเป็น 0
   */
  onPublishedTotals?: (totals: BoardPublishedTotals | null) => void;
};

/**
 * แท็บระดับบอร์ด — 'board' คือกล่องงาน ที่เหลือ mapped เข้าแท็บของ RmWorkspace
 * 🔴 **ไม่มี 'closed' / 'cancelled' อีกแล้ว** (19 ส.ค. 2569) — ปิดแล้ว/ยกเลิกเป็น
 * **กล่องบนหน้ากล่องงาน** ที่กดแล้วกรองในหน้าเดิม เหมือนกล่องอื่นทุกกล่อง
 * ลิงก์เก่า `?view=closed` / `?view=cancelled` ถูกแปลงเป็นกล่องที่ `StaffJobBoardPage`
 */
export type BoardViewId = 'board' | 'list' | 'contact' | 'appointments' | 'dashboard';

/**
 * แท็บระดับบอร์ด + ชื่อหัวหน้าจอ — **ชุดเดียวใช้ทั้งแถบแท็บและหัวหน้าจอ**
 * 🔴 เดิมหัวของ 3 แท็บฝั่งผู้สมัครเรียก `conveyorLabel` ด้วยคีย์ applicants ซึ่งคืน `''` มาตั้งแต่ขั้น
 * "ผู้สมัคร" ถูกถอดออกจากสายพาน ⇒ หัวหน้าจอว่างเปล่า (เจอ 27 ก.ย. 2569 · เจ้าของสั่ง "แก้เลย")
 * ⇒ หัวต้องเป็นชื่อแท็บที่กดมา — กดแท็บ "การโทรของฉัน" หัวก็ต้องเขียน "การโทรของฉัน"
 */
const BOARD_VIEW_TABS: ReadonlyArray<{ id: BoardViewId; label: string }> = [
  // เจ้าของสั่ง 4 ต.ค. 2569: แท็บ "งานสรรหา" → "โพสต์ประกาศ" (ชื่อหน้า/เมนูยังเป็นงานสรรหา)
  { id: 'board', label: 'โพสต์ประกาศ' },
  // 🔴 ชื่อ + ลำดับแท็บตามที่เจ้าของเรียงเอง 30 ก.ย. 2569 (แบบ iRecruit): *"กล่องงาน > ผู้สมัคร > การติดตาม >
  // ติดตามนัดหมาย > ภาพรวม"* · สามแท็บกลางต้องตรงกับ `RM_TAB_LABEL` (lib/recruitRm — เทสต์คุม)
  { id: 'list', label: 'ผู้สมัคร' },
  { id: 'contact', label: 'การติดต่อ' },
  { id: 'appointments', label: 'ติดตามนัดหมาย' },
  // แท็บภาพรวม = มุมผู้บริหาร (28 ก.ย. 2569 ชื่อ "Dashboard" → เจ้าของเปลี่ยนเป็น "ภาพรวม" 30 ก.ย.) · `?view=dashboard` คงเดิม
  // เนื้อมาจาก StaffJobBoardPage (lazy · ห้าม import ในไฟล์นี้ — หน้าสมัครสาธารณะใช้ไฟล์นี้ร่วม)
  { id: 'dashboard', label: 'ภาพรวม' },
  // 🔴 แท็บ "คำขอโพสต์งานใหม่" ถูกถอดทั้งแท็บ 27 ก.ย. 2569 (เจ้าของสั่ง — ทีม Online
  // ดูทีละกล่องแล้วเอาขึ้นเลย ไม่ต้องมีคิวคำขอ) · ลิงก์เก่า ?view=postings เปิดกล่องงานแทน
  // ⚠️ **ไม่มี "ปิดแล้ว"/"ยกเลิก" บนแท็บแล้ว** (เจ้าของสั่ง 19 ส.ค. 2569:
  // *"มันมีด้านล่างแล้วไงตรงนี้อะ"*) — เป็นกล่องสถานะข้างล่างที่กดแล้ว
  // กรองในหน้าเดิม · ลิงก์เก่า ?view=closed/cancelled แปลงเป็นกล่องให้แล้ว
];

const JobBoardView: React.FC<JobBoardViewProps> = ({
  jobs,
  loading,
  loadError,
  variant = 'public',
  searchPlaceholder,
  onRefresh,
  feedState = 'ready',
  dataAgeSeconds = null,
  refreshing,
  detailReturnTo = '/jobs/board',
  view = 'board',
  onViewChange,
  listContent,
  listHeaderActions,
  closedJobs,
  closedLoading = false,
  closedError = null,
  closedDays = 30,
  onClosedDaysChange,
  onReloadClosed,
  initialBox = null,
  onPublishedTotals,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * 🔴 **กดอะไรในกล่องงานห้ามเด้งออกไปหน้าจับคู่งานหรือหน้าใบขอ** (เจ้าของสั่ง 27 ก.ย. 2569:
   * *"หน้ากล่องงาน มีอะไรกดไปโผล่หน้าจับคู่งานหรือใบขอไหม ถ้ามีปิดออกห้ามไป"*)
   * ⇒ ถอดตัวพาไปหน้าใบขอ (`openUnit`) · "ดูรายชื่อ" สลับแท็บในหน้าเดิม · Pre-Check ออกจากเมนูตั้งค่าบอร์ด
   */
  const positionPreset = useMemo(
    () => (variant === 'public' ? resolveApplyPositionPreset(searchParams.get('pos')) : null),
    [variant, searchParams],
  );
  const filters = useJobBoardFilters(jobs, {
    initialPosition: positionPreset?.positionFilter,
    lockPosition: positionPreset?.locked,
    drivingPositionGroup: positionPreset?.isDrivingGroup,
  });
  const isStaff = variant === 'staff';

  /**
   * 🔴 **ประวัติ "ใครแก้อะไรไป" ย้ายออกจากหน้านี้ 27 ส.ค. 2569**
   * เดิมอยู่ในป๊อปการ์ด · ตอนนี้เป็น `UnitEditLogSection` บนแท็บ "ประกาศ / ลิงก์สมัคร"
   * ของใบขอ ซึ่งเป็นที่ที่การแก้เกิดขึ้นจริง (คำสั่งเดิม 18 ส.ค. 2569 ยังอยู่ครบ)
   */

  /**
   * ตัวกรอง "ประเภทงาน" + "เจ้าหน้าที่สรรหา" (เจ้าของสั่งเพิ่ม 13 ส.ค. 2569)
   * ⚠️ **ส่งเฉพาะฝั่งเจ้าหน้าที่** — ชื่อเจ้าหน้าที่สรรหาเป็นข้อมูลภายใน
   * ห้ามหลุดออกหน้าสมัครสาธารณะ ซึ่งใช้ component ตัวเดียวกันนี้
   */
  // (ตัวกรองเจ้าหน้าที่/ประเภทสัญญาบนแถบเดิมของฝั่งเจ้าหน้าที่ ย้ายเข้าปุ่ม "ตัวกรอง" ของเครื่องกรองแล้ว — 27 ก.ย. 2569)

  // จำนวนผู้สมัครต่อใบ (เจ้าหน้าที่) — ประกาศตรงนี้เพราะการเรียงการ์ดข้างล่างต้องใช้
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});
  /** แยกยอดตามที่มาต่อใบขอ — "AI หามากี่คน สมัครใหม่กี่คน" (เจ้าของสั่ง 16 ส.ค. 2569) */
  const [originCounts, setOriginCounts] = useState<
    Record<string, Partial<Record<ApplicationOrigin, number>>>
  >({});
  /** ยอด Lead แยกต่างหาก — ใบที่ปัดเข้าคลังไม่ถูกนับใน applicantCounts (17 ส.ค. 2569) */
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  /** ส่ง AI โทรแล้ว x จาก y คน ต่อใบขอ (22 ก.ย. 2569 · นิยามกล่องงานข้อ 6) */
  const [aiCounts, setAiCounts] = useState<Record<string, { sent: number; total: number }>>({});
  /**
   * ยอดผู้สมัคร/Lead/AI มาถึงแล้วหรือยัง (แถบกรอง 26 ก.ย. 2569)
   * 🔴 ยังไม่มา ≠ ทุกใบมีผู้สมัคร 0 — แถบกรองต้องไม่โชว์หัวข้อที่พึ่งยอดพวกนี้จนกว่าจะมา
   */
  const [breakdownLoaded, setBreakdownLoaded] = useState(false);
  /** โหลดยอดผู้สมัครไม่ได้ — การ์ดต้องบอกว่าโหลดไม่ได้ ไม่ใช่ "ยังไม่มีผู้สมัคร" (QA 5 ต.ค. 2569) */
  const [breakdownFailed, setBreakdownFailed] = useState(false);
  /**
   * 🔴 **ฟอร์มแก้ข้อมูลประกาศย้ายออกจากหน้านี้แล้ว** (27 ส.ค. 2569)
   * อยู่ที่แท็บ "ประกาศ / ลิงก์สมัคร" ของใบขอ ⇒ ไม่ต้องมี patch ทับการ์ดที่นี่อีก
   * (กลับมาที่บอร์ดค่าใหม่มาพร้อมการโหลดใบขอรอบถัดไป)
   */

  /**
   * ทะเบียน "ปล่อยใบขอขึ้นหน้าสาธารณะ" (Phase 5 · เจ้าของเคาะ 22 ส.ค. 2569 — ทุกใบต้องกดปล่อย)
   *
   * 🔴 โหลดเฉพาะ `isStaff` — เส้นนี้เป็นของภายใน · `/apply` ห้ามยิง (ไฟล์นี้ใช้ร่วมสองหน้า)
   * ⚠️ ใบที่ไม่อยู่ในทะเบียนนี้ = คนนอกไม่เห็น และ AI (Lumos) ก็ไม่เห็น
   */
  const [releases, setReleases] = useState<JobRelease[] | null>(null);
  const releaseIdx = useMemo(() => buildReleaseIndex(releases ?? []), [releases]);

  /**
   * 🔴 **อ่านไม่ได้ ≠ ไม่มีใบไหนปล่อย** (แก้ 31 ส.ค. 2569)
   *
   * ของเดิม catch แล้ว `setReleases([])` ⇒ เส้นล่ม = จอบอกว่า "ปล่อยแล้ว 0" ทั้งที่จริง 173 ใบ
   * และคนที่สิทธิ์ไม่ถึง (403) ก็เห็นเลขเดียวกันซึ่งผิดทั้งแถวแต่ดูเหมือนจริง
   * ⇒ ตอนนี้เก็บสภาพไว้ตรง ๆ แล้วให้หัวจอเป็นคนบอกว่า "ยังบอกไม่ได้"
   */
  const [releasesState, setReleasesState] = useState<FeedState>('loading');

  const loadReleases = React.useCallback(async () => {
    if (!isStaff) return;
    setReleasesState('loading');
    try {
      setReleases(await fetchJobReleases());
      setReleasesState('ready');
    } catch (e) {
      setReleases(null);
      setReleasesState(httpStatusOf(e) === 403 ? 'forbidden' : 'failed');
    }
  }, [isStaff]);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  /**
   * ทะเบียน "ไม่ปล่อย + เหตุผล" (29 ก.ย. 2569 · migration 129) — ติดชิปบนการ์ดเท่านั้น
   * 🔴 **ไม่ย้ายเลน/ไม่แตะตัวเลขหัวกล่องงาน** (โครง 3 ก้อนเจ้าของเคาะเอง) · อ่านไม่ได้ = ไม่มีชิป (ไม่เดา)
   */
  const [skips, setSkips] = useState<JobReleaseSkip[]>([]);
  const skipIdx = useMemo(() => buildSkipIndex(skips), [skips]);
  const loadSkips = React.useCallback(async () => {
    if (!isStaff) return;
    try {
      setSkips(await fetchReleaseSkips());
    } catch {
      setSkips([]);
    }
  }, [isStaff]);
  useEffect(() => {
    void loadSkips();
  }, [loadSkips]);

  /**
   * 🔴 **ปล่อย/ดึงลงมีทางเดียว = ป๊อปไล่งานของใบนั้น** (ขั้น 4: ตัวอย่าง → ลิงก์ → ส่ง)
   * ปุ่ม "ส่งประกาศทีเดียว / ปล่อยทั้งหน้านี้" **ถูกถอดออกทั้งหมด 26 ก.ย. 2569**
   * (เจ้าของเคาะ Choice: *"ถอดปุ่มออก"* — ทุกใบต้องผ่านการตรวจ ที่อยู่ รายได้ เพศ ก่อนขึ้น
   * หน้าสาธารณะ · ปล่อยเป็นชุดข้ามทุกด่าน) — ห้ามเอากลับมาโดยไม่ได้สั่งใหม่
   */

  // แบ่งหน้าการ์ดประกาศ — ใช้แถบเลขหน้ากลางของระบบ (เลือกจำนวนต่อหน้าได้เหมือนหน้าอื่น)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  /**
   * กล่องสถานะที่เลือกอยู่ (เจ้าของสั่ง 19 ส.ค. 2569) — null = ทั้งหมด
   * ⚠️ กรอง**หลัง**ตัวกรองปกติ (จังหวัด/ตำแหน่ง/ฯลฯ) — เลขบนกล่องจึงเป็น
   * "ในผลที่กรองอยู่ตอนนี้" ไม่ใช่ยอดทั้งระบบ ซึ่งตรงกับที่คนกำลังมองบนจอ
   */
  /**
   * ขั้นบนเส้นทางที่เลือกอยู่ — `null` = ดูใบเปิดทั้งหมดที่กรองอยู่
   *
   * 🔴 **อยู่ใน URL ไม่ใช่ state ในหน้า** (27 ส.ค. 2569) — เจ้าของสั่งว่ากดแล้วต้อง
   * "พาไปดูข้อมูล" ⇒ ขั้นที่เลือกต้องเป็นที่ ๆ ส่งลิงก์ให้กันได้ · รีเฟรชไม่หาย ·
   * ปุ่มย้อนกลับของเบราว์เซอร์พากลับขั้นก่อนหน้า และกลับจากหน้าใบขอมาเจอขั้นเดิม
   * ⚠️ ค่าที่ไม่รู้จักใน URL = ถือว่าไม่ได้เลือกขั้น (ห้าม throw ใส่คนที่แก้ URL เล่น)
   */
  /**
   * ── เลน/ขั้นที่เลือกอยู่ — **อยู่ใน URL** ──
   *
   * 🔴 เจ้าของสั่งรื้อหน้านี้รอบสี่ 27 ส.ค. 2569: *"อยากเปิดมาแล้วรู้ว่า อ้อ ตอนนี้มีใบขอ
   * เท่านี้นะ เราปล่อยไปหน้าสาธารณะเท่านี้แล้วนะ เหลืออีกเท่านี้นะ"*
   * ⇒ หัวหน้าจอเป็น **เลนของงานปล่อยประกาศ** ไม่ใช่เส้น 9 ขั้นแบบเดิม
   * (ขั้น 9 ตัวไม่ได้หายไป — ปลายเส้นย้ายไปอยู่ใต้เลน "ไม่ต้องปล่อย" ที่เป็นเจ้าของมันจริง)
   *
   * `?lane=` = เลน · `?step=` = ขั้นที่ติด (เฉพาะเลนเหลือปล่อย)
   * ⚠️ ค่าที่ไม่รู้จัก = ถือว่าไม่ได้เลือก (ห้าม throw ใส่คนที่แก้ URL เล่น)
   * ⚠️ ลิงก์เก่า `?stage=closed|cancelled` ยังพาไปถังใบจบได้เหมือนเดิม
   */
  const laneParam = searchParams.get('lane');
  const stepParam = searchParams.get('step');
  /**
   * ป๊อปของการ์ด = **4 หน้า** (เจ้าของ 4 ต.ค. 2569 ไล่ Journey: ข้อมูลใบขอ → สถานที่ → สวัสดิการ+รายได้+เพศ+อายุ → สรุป)
   * กลับมาใช้ป๊อป 4 ขั้นแทนป๊อปหน้าเดียว (2 ต.ค.) · ทางถอย: `?popup=sheet` = ป๊อปหน้าเดียว
   */
  const stepsPopup = searchParams.get('popup') !== 'sheet';
  const legacyStage = searchParams.get('stage');

  const doneLane = useMemo<ClosedBoxKey | null>(() => {
    const raw = laneParam ?? legacyStage;
    return raw === 'closed' || raw === 'cancelled' ? raw : null;
  }, [laneParam, legacyStage]);

  /**
   * เลนที่กดอยู่ — รวมสองก้อนย่อยของ "ยังไม่ปล่อย" ที่เพิ่ม 21 ก.ย. 2569
   * (`sourcing` ยังต้องหาคน · `started` มีคนเริ่มงานแล้ว) ⇒ ลิงก์ที่แชร์กันก็พาไปถูกเลน
   */
  const lane = useMemo<ReleaseLaneKey | null>(
    () =>
      laneParam === 'released' ||
      laneParam === 'unreleased' ||
      laneParam === 'sourcing' ||
      laneParam === 'started' ||
      laneParam === 'applied' ||
      laneParam === 'silent'
        ? laneParam
        : null,
    [laneParam],
  );
  /**
   * 🔴 ลิงก์เก่า `?step=` → ล้างทิ้งเฉย ๆ (2 ต.ค. 2569 — "ติดขั้น" ถูกแทนด้วย "พร้อมประกาศไหม" ซึ่งไม่มีขั้นให้แปลง)
   * ไม่ throw ใส่คนที่แก้ URL เล่น · replace = ไม่เพิ่มประวัติ
   */
  useEffect(() => {
    if (stepParam === null) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('step');
        return params;
      },
      { replace: true },
    );
  }, [stepParam, setSearchParams]);

  /** เขียนเลนลง URL (ขั้นย้ายไปเป็นหัวข้อ "ติดขั้น" ในตัวกรองแล้ว — 30 ก.ย. 2569) */
  const setSelection = React.useCallback(
    (next: { lane?: ReleaseLaneKey | ClosedBoxKey | null }) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.delete('stage'); // ลิงก์เก่าถูกแปลงแล้ว ไม่ต้องค้างไว้
        if ('lane' in next) {
          if (next.lane) params.set('lane', next.lane);
          else params.delete('lane');
        }
        return params;
      });
    },
    [setSearchParams],
  );

  /** ลิงก์เก่า `?view=closed|cancelled` → แปลงเป็นเลนใบจบครั้งเดียว */
  useEffect(() => {
    if ((initialBox === 'closed' || initialBox === 'cancelled') && !laneParam && !legacyStage) {
      setSelection({ lane: initialBox });
    }
  }, [initialBox, laneParam, legacyStage, setSelection]);

  /**
   * 🔴 **กล่องสถานะ 6 กล่องถูกยุบเข้าเส้นทางแล้ว** (เจ้าของสั่งรื้อ 27 ส.ค. 2569)
   * ตัวแปรพวกนี้จึงไม่มี state ของตัวเองอีก — อนุมานจากขั้นที่เลือกบนเส้น
   * (ยังต้องมีอยู่เพราะส่วนอื่นของหน้าใช้: การเรียงการ์ด · ตัวเลือกช่วงวันใบปิด ·
   *  ป้ายบนหัวตาราง) · `initialBox` ที่ลิงก์เก่าส่งมาแปลงเป็นขั้นตั้งต้นแทน
   */
  const closedBox: ClosedBoxKey | null = doneLane;
  const openBoxKey: OpenBoxKey | null = null;
  /**
   * ประกาศของบอร์ด (mockup rev.3 ข้อ 04) — ใช้ 2 ที่:
   * แถวกล่องลอย = รวมผู้สมัครต่อประเภทที่ไม่ผูกใบขอ · ชิปบนการ์ด = ช่องทางที่ปล่อยลิงก์ + ยอดคลิก
   * ล้มเหลวก็ปล่อยเงียบเหมือน applicantCounts — เป็นข้อมูลเสริม ไม่ใช่ตัวหลักของหน้า
   */
  const [postings, setPostings] = useState<Awaited<ReturnType<typeof fetchRecruitPostings>>>([]);
  /** บวกหนึ่งเพื่อสั่งโหลดประกาศใหม่ — ใช้หลังสร้าง/แก้ประกาศ ไม่งั้นชิปช่องทางกับปุ่มแก้ไขไม่อัปเดตจนรีเฟรชหน้า */
  const [postingsRev, setPostingsRev] = useState(0);
  /**
   * 🔴 **โหลดประกาศเสร็จหรือยัง — ไม่ใช่ `postings.length > 0`**
   * ต้องรู้แน่ ๆ เพราะเลขบนหัวหน้าจอพึ่ง "ใบนี้มีลิงก์ไหม" · ยังไม่รู้ = ห้ามโชว์เลข
   */
  const [postingsState, setPostingsState] = useState<FeedState>('loading');

  /**
   * ใบที่ **ปล่อยลิงก์รับสมัครแล้ว** (มีประกาศผูกใบขอ) — ใช้กับชิปเตือนบนการ์ด
   * ⚠️ `postings` โหลดทีหลัง ระหว่างยังว่างจะยังไม่นับใบไหนว่าปล่อยแล้ว จึงต้องเช็ค
   * `postingsReady` ก่อนโชว์ชิป ไม่งั้นเปิดหน้ามาทุกใบขึ้น "ยังไม่ปล่อยลิงก์" แวบหนึ่ง
   */
  /**
   * 🔴 เทียบ **สองคีย์** ไม่ใช่ Set ของ id เต็ม — ประกาศเก็บ `siamraj-sql:XXX` แต่ใบ
   * ล่วงหน้าที่ feed ส่งมาเป็น `siamraj-pre:XXX` (บั๊กที่แก้ 23 ส.ค. 2569 · ดู `jobKeyIndex.ts`)
   * เดิมใช้ `Set(p.jobId)` → ใบล่วงหน้าที่ปล่อยลิงก์แล้วไม่ขึ้นชิปเขียวเลยทั้งกอง
   */
  const postedJobIds = useMemo(
    () => buildJobKeyIndex(postings.map((p) => [p.jobId, true] as const)),
    [postings],
  );

  /**
   * ยอดผู้สมัคร/Lead/ที่มา — ยอดจาก API คีย์ด้วย `public_job_applications.job_id`
   * ซึ่งสืบทอด `posting.jobId` (= `sql:` เสมอ) → ใบล่วงหน้าที่ feed ส่งมาเป็น `pre:`
   * เคยอ่านได้ 0 ทั้งที่มีคนสมัครจริง · ต้องผ่านตัวเทียบสองคีย์เหมือนกันทุกตัว
   */
  const applicantIdx = useMemo(() => buildCountIndex(applicantCounts), [applicantCounts]);
  /**
   * job_id ฝั่งใบสมัครของใบขอนี้ (สายเทียบสองคีย์เดียวกับยอดผู้สมัคร) — ปุ่ม "ดูรายชื่อ" ใช้ติ๊ก
   * หัวข้อ "ใบขอที่สมัคร" ในแท็บรายชื่อผู้สมัคร · ยังไม่มีใครสมัคร = ใช้ id ของใบขอเอง
   */
  const applicationJobKeyIdx = useMemo(
    () => buildJobKeyIndex(Object.keys(applicantCounts).map((k) => [k, k] as const)),
    [applicantCounts],
  );
  /**
   * 🔴 "ดูรายชื่อ" = สลับไปแท็บ "รายชื่อผู้สมัคร" **ในหน้าเดิม** พร้อมติ๊กใบนั้นให้
   * (เจ้าของสั่ง 27 ก.ย. 2569: *"หน้ากล่องงาน มีอะไรกดไปโผล่หน้าจับคู่งานหรือใบขอไหม
   * ถ้ามีปิดออกห้ามไป"* แล้วเลือก "ให้ไปแท็บรายชื่อผู้สมัคร") · เดิมพาไปแท็บผู้สมัครของหน้าใบขอ
   * ⚠️ push ไม่ใช่ replace — กดย้อนกลับแล้วกลับมากล่องงานที่เดิม · ตัวกรองแท็บผู้สมัครเดิมล้างทิ้ง
   */
  const openApplicantsOf = React.useCallback(
    (job: JobRequest) => {
      const key = applicationJobKeyIdx.get(job.id) ?? job.id;
      const params = new URLSearchParams(searchParams);
      for (const k of [...params.keys()]) {
        if (k.startsWith(APPLICANT_FILTER_PARAM_PREFIX)) params.delete(k);
      }
      params.set('view', 'list');
      params.delete('tab');
      params.append(`${APPLICANT_FILTER_PARAM_PREFIX}job`, key);
      setSearchParams(params);
    },
    [applicationJobKeyIdx, searchParams, setSearchParams],
  );
  const leadIdx = useMemo(() => buildCountIndex(leadCounts), [leadCounts]);
  const originIdx = useMemo(
    () => buildJobKeyIndex(Object.entries(originCounts)),
    [originCounts],
  );
  const postingsReady = postings.length > 0;

  /**
   * 🔴 **เลขบนหัวเชื่อได้แล้วหรือยัง** (เพิ่ม 27 ส.ค. 2569)
   *
   * เจอตอนให้โมเดลอ่อนสุดมาลองเล่น: มันกด "เหลือปล่อย" แล้วรายงานว่า
   * *"ตัวเลขเปลี่ยนเป็น 0 ทั้งหมด"* และตอนกดย้อนกลับจากหน้าใบขอก็เป็น 0 อีก
   * — เพราะหน้าถูกสร้างใหม่แล้วยังโหลดข้อมูลไม่เสร็จ **แต่หัวหน้าจอโชว์ 0 ไปเลย**
   *
   * 🔴 ที่แย่กว่า 0 คือช่วงที่ใบขอมาแล้วแต่**ทะเบียนลิงก์/การปล่อยยังไม่มา**:
   * `hasLink`/`isReleased` จะเป็น false ทุกใบ ⇒ "เหลือปล่อย" เฟ้อ "ปล่อยแล้ว" = 0
   * ซึ่ง **ดูเหมือนเลขจริง** จับไม่ได้ด้วยตา · กติกาข้อแรกของโปรเจกต์นี้คือห้ามโกหกตัวเลข
   * ⇒ ยังไม่ครบทั้งสามเส้น = โชว์ "กำลังอ่านตัวเลข…" ไม่ใช่โชว์เลข
   */
  /**
   * สภาพรวมของตัวเลขทั้งหัวจอ — รวมสามเส้น: ใบขอ (จากหน้าแม่) · ประกาศ · ทะเบียนปล่อย
   * 🔴 เส้นไหนพัง = พังทั้งชุด ห้ามโชว์เลขบางส่วนที่ดูเหมือนจริง (ดู combineFeedStates)
   */
  const ledgerState = useMemo(
    () =>
      combineFeedStates(
        loading ? 'loading' : feedState,
        postingsState,
        releasesState,
      ),
    [loading, feedState, postingsState, releasesState],
  );
  const ledgerReady = canShowNumbers(ledgerState);

  /**
   * ═══ แถบกรองด้านซ้ายแบบ iRecruit (เจ้าของสั่ง 26 ก.ย. 2569) ═══
   * แผน: `docs/plan-board-irecruit-filter-2569-09-26.md` · ตรรกะทั้งหมดอยู่ `lib/boardFilters`
   *
   * 🔴 **เฉพาะเจ้าหน้าที่ + มุมมองกล่องงาน** — หน้าสมัครสาธารณะใช้ component ตัวนี้ด้วย
   *    (ชื่อเจ้าหน้าที่/ยอดผู้สมัคร/สถานะปล่อย เป็นข้อมูลภายใน ห้ามหลุดออกไป)
   * 🔴 **กรองก่อนแยกเลน/ขั้น** — ตัวกรองบนแถบบนเดิมก็กรองตรงนี้อยู่แล้ว (หัว 3 ก้อนขยับตาม
   *    ตัวกรองบนจอเสมอ) ⇒ ตัวกรองใหม่ทำตัวเหมือนกัน · ไม่มีตัวกรอง = ชุดเดิมทุกใบ
   *    หัว 3 ก้อนจึงเหมือนเดิมเป๊ะ
   * 🔴 **ไม่แตะฐานข้อมูล** — ทุกอย่างอยู่ใน URL (`f.*` · `df` `dfrom` `dto` · `sort`)
   */
  const boardFilterOn = isStaff && view === 'board';
  const boardFilterState = useMemo<BoardFilterState>(
    () => (boardFilterOn ? readBoardFilterState(searchParams) : EMPTY_BOARD_FILTER_STATE),
    [boardFilterOn, searchParams],
  );
  const boardSort = useMemo<BoardSort>(
    () => (boardFilterOn ? readBoardSort(searchParams) : 'age'),
    [boardFilterOn, searchParams],
  );
  /**
   * ตัวกรองหน้าประกาศ (/apply) — เลือกได้หลายค่า อยู่ใน URL (`f.*`) แบบเดียวกับหน้างานสรรหา (เจ้าของ 4 ต.ค. 2569)
   * 🔴 เฉพาะหัวข้อสาธารณะ (`PUBLIC_FACET_KEYS`) — ค่าของหัวข้อภายในที่ติดมากับลิงก์ถูกทิ้ง
   */
  const publicFilterOn = !isStaff;
  const publicState = useMemo<BoardFilterState>(
    () => (publicFilterOn ? publicFilterState(readBoardFilterState(searchParams)) : EMPTY_BOARD_FILTER_STATE),
    [publicFilterOn, searchParams],
  );
  /**
   * ── เส้นทางงาน (เจ้าของสั่ง 27 ส.ค. 2569: "ทำให้มันไหลเป็นเส้น") ──
   * ตรรกะอยู่ lib/boardFlow (มีเทสต์) — ที่นี่แค่ประกอบ facts จาก index ที่โหลดอยู่แล้ว
   *
   * 🔴 **เลขบนเส้นนับจาก `boxedJobs` (ก่อนกรองขั้น)** — กดขั้นไหนเลขขั้นอื่นต้องไม่เปลี่ยน
   * ไม่งั้นกดปุ๊บเลขทุกช่องกลายเป็นของกลุ่มที่กรอง แล้วเทียบข้ามขั้นไม่ได้อีก
   * ส่วน **การ์ดที่โชว์** ใช้ชุดหลังกรอง (`flowJobs`) — แพตเทิร์นเดียวกับกล่องสถานะ
   */
  const stageFacts = useMemo<BoardStageFacts>(
    () => ({
      hasLink: (j) => (postingsReady ? postedJobIds.has(j.id) : false),
      isReleased: (j) => releaseIdx.has(j.id),
      applicants: (j) => countFor(applicantIdx, j.id),
    }),
    [postingsReady, postedJobIds, releaseIdx, applicantIdx],
  );
  /** ของที่ชิป "พร้อมประกาศ/ขาดอะไร" ต้องรู้ — ทะเบียนประกาศ + ทะเบียน "ไม่ประกาศ" (ตัวเดียวกับหัวข้อกรอง) */
  const readinessFacts = useMemo<PublishReadinessFacts>(
    () => ({ isReleased: (j) => releaseIdx.has(j.id), isSkipped: (j) => skipIdx.has(j.id) }),
    [releaseIdx, skipIdx],
  );
  const facetFacts = useMemo<BoardFacetFacts>(
    () => ({
      countsReady: breakdownLoaded,
      applicants: (j) => countFor(applicantIdx, j.id),
      leads: (j) => countFor(leadIdx, j.id),
      isReleased: ledgerReady ? (j) => releaseIdx.has(j.id) : null,
      aiSent: breakdownLoaded ? (j) => aiCounts[j.id]?.sent ?? 0 : null,
      // พร้อมประกาศไหม (2 ต.ค. 2569 — แทนติดขั้น) — ตัวเดียวกับชิปบนการ์ด
      readinessOf: ledgerReady ? (j) => publishReadinessOf(j, readinessFacts) : null,
    }),
    [breakdownLoaded, applicantIdx, leadIdx, ledgerReady, releaseIdx, aiCounts, readinessFacts],
  );
  /** ใบเปิดหลังแถบซ้าย — ตัวแทน `filters.filtered` ของทุกตัวเลขข้างล่าง */
  const openRows = useMemo(
    () =>
      boardFilterOn
        ? applyBoardFilters(filters.filtered, boardFilterState, facetFacts)
        : publicFilterOn
          ? applyPublicFilters(filters.filtered, publicState)
          : filters.filtered,
    [boardFilterOn, filters.filtered, boardFilterState, facetFacts, publicFilterOn, publicState],
  );
  const publicFacets = useMemo(
    () => (publicFilterOn ? buildPublicFacets(filters.filtered, publicState) : []),
    [publicFilterOn, filters.filtered, publicState],
  );
  const boardFacets = useMemo(
    () => (boardFilterOn ? buildBoardFacets(filters.filtered, boardFilterState, facetFacts) : []),
    [boardFilterOn, filters.filtered, boardFilterState, facetFacts],
  );
  /**
   * 🔴 **ช่องค้นหาอยู่ใน URL (`?q=`)** (เจ้าของเคาะ 26 ก.ย. 2569 — ตัวกรองทุกตัวต้องอยู่ในลิงก์)
   * URL เป็นตัวจริง: เปิดลิงก์/กดย้อนกลับ ⇒ ช่องค้นหาตามค่าใน URL · พิมพ์ ⇒ เขียน URL แบบแทนที่
   * ⚠️ เฉพาะเจ้าหน้าที่ + มุมมองกล่องงาน — หน้าสมัครสาธารณะค้นแบบเดิม (ไม่แตะ URL ของคนนอก)
   */
  const urlSearch = boardFilterOn ? readBoardSearch(searchParams) : null;
  const { search: currentSearch, setSearch: setFilterSearch } = filters;
  useEffect(() => {
    if (urlSearch !== null && urlSearch !== currentSearch) setFilterSearch(urlSearch);
    // ตามค่า URL อย่างเดียว — ใส่ currentSearch แล้วพิมพ์เร็ว ๆ ค่าจะเด้งกลับเป็นของเก่า
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch, setFilterSearch]);
  const setBoardSearch = React.useCallback(
    (q: string) => {
      setFilterSearch(q);
      if (boardFilterOn) setSearchParams((prev) => writeBoardSearch(prev, q), { replace: true });
    },
    [setFilterSearch, boardFilterOn, setSearchParams],
  );
  /**
   * 🔴 ช่องค้นหาของกล่องงานอยู่บนแถบบน ซ้ายกระดิ่ง (เจ้าของสั่ง 27 ก.ย. 2569 "ทั้งระบบ")
   * ค้นเรื่องเดิมทุกอย่าง (หน่วยงาน/ตำแหน่ง/ที่อยู่ · เขียน `?q=` เหมือนเดิม) — แค่ย้ายที่วาง
   * เฉพาะเจ้าหน้าที่ + มุมมองกล่องงาน · แท็บผู้สมัครฝากช่องของตัวเอง (RmWorkspace) · หน้าสาธารณะไม่เกี่ยว
   */
  const searchInHeader = useHeaderSearch(
    isStaff && view === 'board'
      ? { value: filters.search, onChange: setBoardSearch, placeholder: searchPlaceholder ?? 'ค้นหา…' }
      : null,
  );
  /** เขียนตัวกรองลง URL — ต่อยอด params เดิมเสมอ (ห้ามทำ `view` `lane` `step` หาย) */
  const commitBoardFilters = React.useCallback(
    (next: BoardFilterState) => {
      setSearchParams((prev) => writeBoardFilterState(prev, next), { replace: true });
    },
    [setSearchParams],
  );
  const setBoardSort = React.useCallback(
    (next: BoardSort) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === 'age') p.delete(BOARD_SORT_PARAM);
          else p.set(BOARD_SORT_PARAM, next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const togglePublicFacet = React.useCallback(
    (key: BoardFacetKey, value: string) => commitBoardFilters(toggleBoardFacetValue(publicState, key, value)),
    [commitBoardFilters, publicState],
  );
  const clearPublicFacets = React.useCallback(
    () => commitBoardFilters(EMPTY_BOARD_FILTER_STATE),
    [commitBoardFilters],
  );

  const toggleBoardFacet = React.useCallback(
    (key: BoardFacetKey, value: string) => {
      commitBoardFilters(toggleBoardFacetValue(boardFilterState, key, value));
    },
    [commitBoardFilters, boardFilterState],
  );
  const setBoardDates = React.useCallback(
    (patch: Partial<{ field: BoardDateField; from: string; to: string }>) => {
      const cur = boardFilterState.dates ?? { field: 'required' as BoardDateField, from: '', to: '' };
      const next = { ...cur, ...patch };
      commitBoardFilters({ ...boardFilterState, dates: next.from || next.to ? next : null });
    },
    [commitBoardFilters, boardFilterState],
  );
  /**
   * "↻ ล้าง" บนแถบบน = ล้างทุกตัวกรอง (แถบซ้าย + ช่วงวันที่ + คำค้น)
   * 🔴 เขียน URL **ครั้งเดียว** — เรียก setSearchParams สองครั้งติดกันตัวหลังจะทับตัวแรก
   */
  const clearAllBoardFilters = React.useCallback(
    (opts: { laneStep?: boolean; search?: boolean } = {}) => {
      if (opts.search) filters.setSearch('');
      setSearchParams(
        (prev) => {
          let p = writeBoardFilterState(prev, EMPTY_BOARD_FILTER_STATE);
          if (opts.search) p = writeBoardSearch(p, '');
          if (opts.laneStep) {
            p.delete('lane');
            p.delete('step');
            p.delete('stage');
          }
          return p;
        },
        // เปลี่ยนเลน/ขั้น = เป็นประวัติที่กดย้อนได้เหมือนเดิม · ล้างตัวกรองอย่างเดียว = แทนที่
        { replace: !opts.laneStep },
      );
    },
    [filters, setSearchParams],
  );

  const boxCounts = useMemo(() => countOpenBoxes(openRows), [openRows]);
  /** ชุดใบปิด/ยกเลิกหลังผ่าน**ตัวกรองชุดเดียวกับใบเปิด** (จังหวัด/ตำแหน่ง/คำค้น/…) */
  const closedFiltered = useMemo(
    () => {
      if (!isStaff) return [];
      const rows = filters.filterRows(closedJobs ?? []);
      // แถบซ้ายกรองกล่องปิดแล้ว/ยกเลิกด้วย — "กรองในหน้าเดิมเหมือนกันทุกกล่อง" (กติกาเดิม)
      return boardFilterOn ? applyBoardFilters(rows, boardFilterState, facetFacts) : rows;
    },
    [isStaff, filters, closedJobs, boardFilterOn, boardFilterState, facetFacts],
  );
  const closedBoxCounts = useMemo(
    () => ({
      closed: filterByClosedBox(closedFiltered, 'closed'),
      cancelled: filterByClosedBox(closedFiltered, 'cancelled'),
    }),
    [closedFiltered],
  );
  /**
   * 🔴 อัตราต่อกล่อง — **หน่วยเดียวกับ Dashboard** (เจ้าของทัก 19 ส.ค. 2569:
   * *"หน้า Dashboard มีงานทั้งหมด 339 แต่หน้ากล่องงานมีแค่ 291 เอง"*)
   * ของจริงคือชุดเดียวกัน แต่กล่องงานนับ "ใบ" ส่วน Dashboard นับ "อัตรา"
   * (วัดจริง 292 ใบ = 340 อัตรา = ขอมา 422 − หาได้แล้ว 82) → โชว์ทั้งสองหน่วยเสมอ
   */
  const boxPositions = useMemo(
    () => countOpenBoxPositions(openRows, jobPositionUnits),
    [openRows],
  );
  const filteredPositions = useMemo(
    () => sumJobPositionUnits(openRows),
    [openRows],
  );
  /**
   * การ์ดที่จะโชว์ — กล่องปิดแล้ว/ยกเลิกใช้ชุดใบปิด · กล่องอื่นใช้ชุดใบเปิด
   * ⚠️ ทั้งสองเส้นผ่านตัวกรองเดียวกันมาแล้ว จึงกรอง "ในหน้าเดิม" ได้เหมือนกันหมด
   */
  const boxedJobs = useMemo(
    () => (closedBox ? closedBoxCounts[closedBox] : filterByOpenBox(openRows, openBoxKey)),
    [closedBox, closedBoxCounts, openRows, openBoxKey],
  );

  const stages = useMemo(
    () =>
      isStaff
        ? buildBoardStages(openRows, stageFacts, {
            closed: closedBoxCounts.closed.length,
            cancelled: closedBoxCounts.cancelled.length,
          })
        : null,
    [isStaff, openRows, stageFacts, closedBoxCounts],
  );

  /**
   * ── เลขบนหัวหน้าจอ (ตรรกะอยู่ `lib/boardRelease` มีเทสต์คุมว่าบวกลงตัว) ──
   * 🔴 นับจาก `filters.filtered` = ใบเปิดหลังตัวกรองบนจอ **ก่อน**กรองเลน/ขั้น
   * ไม่งั้นกดเลนปุ๊บเลขเลนอื่นกลายเป็นของกลุ่มที่กรอง แล้วเทียบข้ามเลนไม่ได้อีก
   */
  const releaseFacts: ReleaseFacts = stageFacts;
  // `ledgerState` / `ledgerReady` ย้ายขึ้นไปอยู่เหนือ `boxCounts` (26 ก.ย. 2569) —
  // แถบกรองต้องรู้ว่าทะเบียนปล่อยพร้อมหรือยังก่อนจะกรองชุดใบเปิด
  const ledger = useMemo(
    () => buildReleaseLedger(openRows, releaseFacts),
    [openRows, releaseFacts],
  );
  /**
   * ยอด "ประกาศ" ของใบเปิดทั้งกล่องงาน **ก่อนตัวกรอง/คำค้น** — ตัวคิดเดียวกับหัว (เลขเท่าหัวตอนไม่ได้กรอง)
   * ส่งให้แท็บภาพรวม (เจ้าของ 1 ต.ค. 2569: *"เปลี่ยนเป็น 7 เหมือนหัวกล่องงาน"*) · ทะเบียนยังไม่พร้อม = null
   */
  const publishedTotals = useMemo<BoardPublishedTotals | null>(() => {
    if (!isStaff || !ledgerReady) return null;
    const all = buildReleaseLedger(filters.visible, releaseFacts);
    return { published: all.released, withApplicants: all.releasedWithApplicants };
  }, [isStaff, ledgerReady, filters.visible, releaseFacts]);
  useEffect(() => {
    onPublishedTotals?.(publishedTotals);
  }, [onPublishedTotals, publishedTotals]);
  /** ปลายเส้น 9 ขั้น — โชว์ใต้เลน "ไม่ต้องปล่อย" (ขั้นพวกนี้คือเจ้าของเลนนั้นจริง ๆ) */
  const movedOnStages = useMemo(
    () => (stages ?? []).filter((st) => MOVED_ON_STAGE_KEYS.includes(st.key)),
    [stages],
  );

  /**
   * การ์ดที่โชว์ = ใบในขั้นที่เลือก · ไม่เลือก = ใบเปิดทั้งหมดที่กรองอยู่
   * ⚠️ ขั้น "ปิดแล้ว/ยกเลิก" มาคนละ feed — ต้องหยิบจากชุดใบปิด ไม่ใช่กรองใบเปิด
   */
  const flowJobs = useMemo(() => {
    if (doneLane) return closedBoxCounts[doneLane];
    /**
     * 🔴 ยังอ่านทะเบียนลิงก์/การปล่อยไม่ครบ = **ยังไม่รู้ว่าใบไหนอยู่เลนไหน**
     * กรองไปก็ได้ชุดผิด (ทุกใบจะตกเลน "เหลือปล่อย") ⇒ โชว์ทั้งหมดไว้ก่อน
     * แล้วหัวหน้าจอจะบอกเองว่ากำลังอ่านตัวเลข
     */
    if (!ledgerReady) return boxedJobs;
    // ขั้นที่ติดกรองด้วยหัวข้อ "ติดขั้น" ในตัวกรองแล้ว (อยู่ใน `openRows` ตั้งแต่ต้น)
    if (lane) return filterByReleaseLane(openRows, releaseFacts, lane);
    return boxedJobs;
  }, [doneLane, ledgerReady, lane, closedBoxCounts, openRows, releaseFacts, boxedJobs]);

  const totalPages = getTotalPages(flowJobs.length, pageSize);
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  /**
   * ลำดับการ์ดบนบอร์ด — **ทั้งกล่องงานและหน้าสาธารณะ**
   *
   * 1. **ผ่านมานานสุดขึ้นก่อน** (เจ้าของสั่ง 18 ส.ค. 2569: *"เรียงงานที่ผ่านมานานๆ
   *    แล้วขึ้นก่อนเลย"*) — ใบที่ค้างนานคือใบที่กำลังจะเสียลูกค้า ต้องเห็นก่อนเสมอ
   *    ใช้ `compareJobsByAgeDaysDesc` ตัวเดียวกับหน้ารายการใบขอ นิยาม "ผ่านมา"
   *    จึงตรงกันทุกหน้า (ล่วงหน้านับจากวันที่กรอก · เลยกำหนดนับจากวันที่ต้องการ)
   *
   * 2. อายุเท่ากัน → ใบที่มีคนกรอกใบสมัครเข้ามาแล้วขึ้นก่อน
   *    (เจ้าของสั่ง 13 ส.ค. 2569 — ยังอยู่ แต่ลดเป็นตัวตัดสินรอง เพราะคำสั่งใหม่
   *    บอกให้อายุมาก่อน "เลย")
   *
   * ⚠️ ฝั่งสาธารณะไม่มี `applicantCounts` (โหลดเฉพาะเจ้าหน้าที่) → ข้อ 2 ไม่มีผล
   * แต่ข้อ 1 ทำงานทั้งสองฝั่ง ซึ่งเป็นสิ่งที่สั่งมา
   */
  const orderedJobs = useMemo(() => {
    // ใบปิด/ยกเลิกไม่มี "ค้างมานาน" แล้ว — เรียงตามวันที่ปิดล่าสุดขึ้นก่อน
    if (closedBox) return [...flowJobs].sort(compareByClosedDateDesc);
    const today = new Date();
    const hasApplicants = (id: string) => (countFor(applicantIdx, id) > 0 ? 0 : 1);
    const byDefault = (a: JobRequest, b: JobRequest) => {
      const byAge = compareJobsByAgeDaysDesc(a, b, today);
      if (byAge !== 0) return byAge;
      return hasApplicants(a.id) - hasApplicants(b.id);
    };
    /**
     * ปุ่มเรียงของแถบกรอง (26 ก.ย. 2569) — ค่าเดิม (`age`) ยังเป็นตัวเรียงข้างบนตัวเดียว
     * ส่วนอีกสองแบบใช้ตัวเรียงเดิมเป็นตัวตัดสินรองเมื่อค่าหลักเท่ากัน
     */
    if (boardSort !== 'age') {
      return sortBoardJobs(flowJobs, boardSort, (j) => countFor(applicantIdx, j.id), byDefault);
    }
    return [...flowJobs].sort(byDefault);
  }, [flowJobs, applicantIdx, closedBox, boardSort]);
  const visibleJobs = orderedJobs.slice(pageStart, pageStart + pageSize);

  /**
   * ตัวนับของแถบ "หน้าสาธารณะ" — นับจาก **ชุดที่กรองอยู่บนจอ** (boxedJobs)
   * ไม่ใช่ทั้งฐาน เพื่อให้เลขตรงกับที่ตาเห็นเสมอ (กติกาเดิมของบอร์ด)
   */
  const releasedCount = useMemo(
    () => boxedJobs.filter((j) => releaseIdx.has(j.id)).length,
    [boxedJobs, releaseIdx],
  );

  /**
   * 🔴 ตัวนับ "มีผู้สมัครแล้ว / ยังไม่มีใครสมัคร" — เกิดขึ้นเพราะบอร์ดทีมหน้าแรก
   * ส่งคนมาที่นี่ด้วยเลข "ยังไม่มีใครสมัคร 298 ใบ" แต่หน้านี้ **ไม่มีเลขนั้นอยู่เลย**
   * ต้องไล่เปิดดูทีละใบเอง (audit มุมพนักงานใหม่ 26 ส.ค. 2569)
   * นับจาก `boxedJobs` (ชุดที่กรองอยู่บนจอ) แบบเดียวกับแถบหน้าสาธารณะ — เลขตรงกับตาเห็นเสมอ
   */
  const withApplicantsCount = useMemo(
    () => boxedJobs.filter((j) => countFor(applicantIdx, j.id) > 0).length,
    [boxedJobs, applicantIdx],
  );
  const withoutApplicantsCount = boxedJobs.length - withApplicantsCount;

  /** คำบอกว่ากำลังดูอะไรอยู่ — 🔴 ป้ายทุกอันมาจาก lib ห้ามพิมพ์เอง */
  const selectionLabel = useMemo(() => {
    if (doneLane) return JOB_BOX_LABEL[doneLane];
    return lane ? RELEASE_LANE_TEXT[lane].label : null;
  }, [doneLane, lane]);

  /** จุดยึดของรายการการ์ด — ใช้เลื่อนจอไปให้เห็นว่าการ์ดเปลี่ยนตามที่กด */
  const cardListRef = React.useRef<HTMLDivElement | null>(null);
  /** ครั้งแรกที่โหลดหน้าไม่ต้องเลื่อน — เลื่อนเฉพาะตอนคน**กด**เปลี่ยนตัวเลือก */
  const selectionTouchedRef = React.useRef(false);

  // เปลี่ยนเลน/ขั้น = กลับหน้าแรกเสมอ (ไม่งั้นค้างหน้า 5 ของเลนเดิม)
  useEffect(() => {
    setPage(1);
    if (!selectionTouchedRef.current) {
      selectionTouchedRef.current = true;
      return;
    }
    /**
     * 🔴 เลื่อนจอไปที่การ์ด — ไม่งั้นกดเลขแล้ว "ไม่มีอะไรเกิดขึ้น" ในสายตาคนใช้
     * (โมเดลที่มาลองเล่นสรุปผิดเพราะเรื่องนี้เป๊ะ ๆ: *"กดแล้วมันแค่ขยายบอกความหมาย
     * ไม่ได้เปลี่ยนหน้าไป"*)
     */
    const el = cardListRef.current;
    if (!el) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [lane, doneLane]);

  // เปลี่ยนตัวกรองแล้วจำนวนผลลด — กันค้างอยู่หน้าที่หายไป
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  /**
   * ยอดคลิก **บนหน้าสาธารณะ** รายใบ (เจ้าของถาม 3 ก.ย. 2569 ว่าแท็กคลิกได้ไหม)
   * — คนละตัวกับ "คลิกลิงก์ช่องทาง" ที่มีอยู่แล้ว: อันนั้นคือกดลิงก์เข้ามา
   * อันนี้คือเข้ามาแล้ว **กดสมัคร / ส่งใบสมัครจริง**
   * 🔴 เส้นภายใน — `/apply` ห้ามยิง (ไฟล์นี้ใช้ร่วมสองหน้า)
   */
  const [publicClicks, setPublicClicks] = useState<Map<string, { apply: number; submit: number }>>(
    new Map(),
  );

  useEffect(() => {
    if (!isStaff) return;
    let alive = true;
    void apiFetch('/api/public-click-stats?days=30')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rows?: { jobRef: string | null; action: string; hits: number }[] } | null) => {
        if (!alive || !d?.rows) return;
        const m = new Map<string, { apply: number; submit: number }>();
        for (const row of d.rows) {
          if (!row.jobRef) continue;
          const cur = m.get(row.jobRef) ?? { apply: 0, submit: 0 };
          if (row.action === 'open_apply') cur.apply += row.hits;
          if (row.action === 'submit') cur.submit += row.hits;
          m.set(row.jobRef, cur);
        }
        setPublicClicks(m);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isStaff]);

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyJob, setApplyJob] = useState<JobRequest | null>(null);

  const openApply = (job: JobRequest | null = null) => {
    /**
     * 🔴 **แท็กคลิกเฉพาะหน้าสาธารณะ** (เจ้าของถาม 3 ก.ย. 2569) — ไฟล์นี้ใช้ร่วมสองหน้า
     * เจ้าหน้าที่กดดูใบขอในระบบ **ไม่ใช่** คนสนใจงาน ถ้านับปนกันเลขจะโป่งด้วยการกดของทีมเราเอง
     */
    if (!isStaff) trackPublicClick('open_apply', { jobRef: job?.id ?? null });
    setApplyJob(job);
    setApplyOpen(true);
  };

  /** เจ้าหน้าที่: รายชื่อผู้สมัครของใบนั้น **ไปหน้าแท็บผู้สมัคร** แล้ว ไม่ใช่ป๊อป (27 ส.ค. 2569) */
  const [laneJob, setLaneJob] = useState<JobRequest | null>(null);
  /**
   * 🔴 **ใบที่กำลังไล่งานอยู่ใน popup** (เจ้าของสั่ง 28 ส.ค. 2569:
   * *"ไม่ได้ให้เด้งไปหน้าถัดไปนะ ให้เด้ง Popup ทำเสร็จก็จะได้อยู่หน้าเดิม"*)
   * ⚠️ นี่คือ**คำสั่งล่าสุด** ทับของ 27 ส.ค. ที่สั่งว่ากดแล้วให้เปลี่ยนหน้า —
   * เหตุผลที่ต่างกัน: อันนั้นคือ "ป๊อปเอาไว้ดูข้อมูล" ส่วนอันนี้คือ **ป๊อปเอาไว้ทำงาน**
   * ทำเสร็จต้องได้อยู่ที่กล่องงานต่อ ไม่ต้องเดินกลับ
   */
  const [postingJob, setPostingJob] = useState<JobRequest | null>(null);
  // เจ้าหน้าที่: สร้างลิงก์รับสมัครของงาน (Gen Link)
  /** ใบขอที่กำลังกด "หาคนเพิ่ม + ส่ง AI โทร" ของเลนสรรหา (R2b) */
  /** สร้างลิงก์ของกล่องลอย — กดจากการ์ดกล่องลอยตรง ๆ ไม่ต้องผ่านตัวเลือกประเภทอีกชั้น */
  const [genStandalone, setGenStandalone] = useState<
    { kind: string; kindLabel: string; departmentCode: string } | null
  >(null);
  // เจ้าหน้าที่: แก้เนื้อหาประกาศที่สร้างไว้แล้ว (mockup rev.3 ข้อ 04)
  // สาธารณะ: เปิดฟอร์มสมัครอัตโนมัติจาก deep link /apply?job=<id>
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    setPostingsState('loading');
    fetchRecruitPostings()
      .then((p) => {
        if (!cancelled) {
          setPostings(p);
          setPostingsState('ready');
        }
      })
      .catch((e) => {
        /**
         * 🔴 เดิมปลดล็อกหัวจอด้วย `setPostingsLoaded(true)` = แกล้งว่าโหลดครบแต่ไม่มีประกาศ
         * ⇒ ขั้น "มีลิงก์แล้ว" กลายเป็น 0 ทุกใบ แล้วเลขทั้งชุดเพี้ยนแบบดูเหมือนจริง
         * ตอนนี้บอกตรง ๆ ว่าเส้นนี้พัง แล้วให้หัวจอโชว์ว่ายังบอกเลขไม่ได้
         */
        if (!cancelled) setPostingsState(httpStatusOf(e) === 403 ? 'forbidden' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [isStaff, postingsRev]);

  /**
   * ประเภทกล่องลอย → สรุปของจริงต่อประเภท (นับจากประกาศที่ไม่ผูกใบขอเท่านั้น)
   * เก็บชื่อประกาศ/จังหวัด/BU มาด้วย เพราะการ์ดกล่องลอยใช้โครงเดียวกับการ์ดใบขอ
   * ซึ่งมีบรรทัดคำบรรยายกับบรรทัดสถานที่ — **ทุกค่ามาจากประกาศจริง ไม่มีค่าตกแต่ง**
   */
  const standaloneSummary = useMemo(() => {
    const acc: Record<
      string,
      { postings: number; applicants: number; titles: string[]; provinces: string[]; bus: string[] }
    > = {};
    for (const k of STANDALONE_POSTING_KINDS) {
      acc[k.code] = { postings: 0, applicants: 0, titles: [], provinces: [], bus: [] };
    }
    for (const p of postings) {
      if (!p.standaloneKind || !acc[p.standaloneKind]) continue;
      const a = acc[p.standaloneKind];
      a.postings += 1;
      a.applicants += p.applicationCount ?? 0;
      const title = p.title?.trim();
      if (title && !a.titles.includes(title)) a.titles.push(title);
      const province = p.province?.trim();
      if (province && !a.provinces.includes(province)) a.provinces.push(province);
      const bu = p.departmentCode?.trim();
      if (bu && !a.bus.includes(bu)) a.bus.push(bu);
    }
    return acc;
  }, [postings]);

  /**
   * ใบขอ → ประกาศล่าสุดของใบนั้น — ใช้กับปุ่ม "แก้ไข" บนการ์ด (mockup rev.3 ข้อ 04)
   * ใบเดียวมีได้หลายประกาศ เลือกใบล่าสุดเพราะเป็นตัวที่กำลังใช้รับสมัครอยู่
   * (API เรียงมาแบบ created_at DESC แล้ว จึงเอาตัวแรกที่เจอ)
   */
  /** ⚠️ เทียบสองคีย์เหมือน `postedJobIds` — ไม่งั้นใบล่วงหน้าไม่มีแท็บ "แก้ไข" ในป๊อป */
  const latestPostingByJob = useMemo(
    // API เรียง created_at DESC มาแล้ว → ตัวแรกที่เจอคือล่าสุด (merge เก็บของเดิมไว้)
    () => buildJobKeyIndex(postings.map((p) => [p.jobId, p] as const), (existing) => existing),
    [postings],
  );

  /** ใบขอ → ช่องทางที่ปล่อยลิงก์ไว้ (รวมยอดคลิกของช่องทางเดียวกันเข้าด้วยกัน) */
  const channelsByJob = useMemo(
    () =>
      buildJobKeyIndex(
        postings
          .filter((p) => p.jobId)
          .map((p) => {
            const acc = new Map<string, number>();
            for (const l of p.links) {
              const label = (l.channelLabel || 'ลิงก์กลาง').trim();
              acc.set(label, (acc.get(label) ?? 0) + (l.hitCount ?? 0));
            }
            return [p.jobId, [...acc].map(([label, hits]) => ({ label, hits }))] as const;
          }),
        // ใบเดียวมีได้หลายประกาศ → ต่อรายการช่องทางเข้าด้วยกัน (เหมือนพฤติกรรมเดิม)
        (a, b) => [...a, ...b],
      ),
    [postings],
  );

  /**
   * แถว "ลิงก์ที่ปล่อยแล้วยังไม่มีใบสมัคร" — ตรรกะอยู่ที่ `jobLinkSilence.ts` (pure + เทสต์)
   * 🔴 กองนี้เล็กจริงโดยธรรมชาติ (ทั้งระบบปล่อยลิงก์ 12 ใบจาก 283 — วัดจริง 21 ส.ค. 2569
   * เข้าเงื่อนไข 4 ใบ) · **ห้ามขยายไปครอบใบที่ยังไม่ปล่อยลิงก์** นั่นคือกล่องส้ม 277 ใบที่ถูกตีตก
   * ⚠️ staff เท่านั้น · รอ postings + ยอดผู้สมัครมาก่อน ไม่งั้นแถบกระพริบ
   */
  const silentLinkRows = useMemo(() => {
    if (!isStaff || closedBox || !postingsReady) return [];
    // สร้างตัวอ่านจาก postings ตรง ๆ (คีย์สองชั้นเหมือนกันทุกตัว) แทนการไล่ Map เดิม
    const latestPostedAt = buildJobKeyIndex(
      postings.filter((p) => p.jobId && p.createdAt).map((p) => [p.jobId, p.createdAt] as const),
      (existing) => existing,
    );
    const clicksByJob = buildJobKeyIndex(
      postings
        .filter((p) => p.jobId)
        .map((p) => [p.jobId, p.links.reduce((s, l) => s + (l.hitCount ?? 0), 0)] as const),
      (a, b) => a + b,
    );
    return selectSilentLinkRows({
      jobs: boxedJobs,
      latestPostedAt,
      clicksByJob,
      // ยอดจาก API คีย์ด้วย job_id ของฝั่งเรา (`sql:`) → ต้องผ่านตัวเทียบสองคีย์ด้วย
      applicantCounts: applicantIdx,
      leadCounts: leadIdx,
    });
  }, [isStaff, closedBox, postingsReady, postings, boxedJobs, applicantIdx, leadIdx]);

  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    fetchJobApplicantBreakdown()
      .then((b) => {
        if (cancelled) return;
        setApplicantCounts(b.counts);
        setOriginCounts(b.byOrigin);
        setLeadCounts(b.leadCounts);
        setAiCounts(b.aiCounts);
        setBreakdownLoaded(true);
        setBreakdownFailed(false);
      })
      .catch(() => {
        // โหลดซ้ำพังหลังเคยได้ยอดแล้ว = ใช้ยอดเดิมต่อ · ไม่เคยได้เลย = การ์ดขึ้น "โหลดยอดผู้สมัครไม่ได้"
        if (!cancelled) setBreakdownFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isStaff, jobs]);

  useEffect(() => {
    if (isStaff || deepLinkHandled || loading) return;
    const jobId = searchParams.get('job');
    if (!jobId) return;
    setDeepLinkHandled(true);
    const match = jobs.find((j) => j.id === jobId);
    if (match) openApply(match);
  }, [isStaff, deepLinkHandled, loading, searchParams, jobs]);

  /**
   * 🔴 หัวหน้าเจ้าหน้าที่ = **หัวแบบเดียวกับหน้าอื่นทั้งระบบ** (`PageHeader` — ลูกศรย้อน + ชื่อ + คำอธิบาย)
   * เจ้าของสั่ง 27 ก.ย. 2569: *"หน้ากล่องงานไม่เข้ากับหน้าอื่นๆเลย รกมาก"* แล้วเลือกแบบ A จากแบบร่าง
   * ⇒ ถอดการ์ดกรมท่าทึบ (PageHeroStrip) · ถอดพื้นไล่สี + กรอบกว้าง max-w-6xl ของฝั่งเจ้าหน้าที่
   * (หน้าสมัครสาธารณะยังเป็นหัวแบบหน้าปกนิตยสารเหมือนเดิม — คนละกลุ่มคนดู)
   */
  const staffTitle = BOARD_VIEW_TABS.find((t) => t.id === view)?.label ?? 'งานสรรหา';
  /* 🔴 ตัวเลขยังบอกไม่ได้ (กำลังโหลด/พัง/ไม่มีสิทธิ์) = **ไม่พิมพ์อะไรเลย** (บทเรียน 31 ส.ค. 2569)
     บอกหน่วยครบทั้ง "ใบขอ" และ "อัตรา" (บทเรียน "292 ตำแหน่ง") · % ปล่อยประกาศย้ายมาจากแถบบนหัวกล่องงาน */
  const staffSubtitle =
    view === 'board' && ledgerReady
      ? [
          `${filters.visibleCount.toLocaleString('th-TH')} ใบขอ`,
          `${filters.visiblePositions.toLocaleString('th-TH')} อัตรา`,
          ledger.percent === null ? null : `ประกาศ ${ledger.percent}%`,
        ]
          .filter(Boolean)
          .join(' · ')
      : undefined;

  /**
   * แถบแท็บของหน้างานสรรหา — 🔴 อยู่แถวเดียวกับชื่อหน้า (เจ้าของสั่ง 4 ต.ค. 2569: *"โพสต์ประกาศ ผู้สมัคร การติดต่อ
   * ติดตามนัดหมาย ภาพรวม ย้ายไปอยู่แถวเดียวกับคำว่า ผู้สมัคร"* · Choice "คงชื่อหน้าไว้ แท็บต่อท้าย")
   * ⚠️ ทุกแท็บต้องอยู่ตำแหน่งเดียวกัน (คำสั่ง 14 ส.ค. 2569) — อยู่ในหัวหน้าจึงตรงกันทุกแท็บเอง
   */
  const staffTabs =
    isStaff && onViewChange ? (
      <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="มุมมองหน้างานสรรหา">
        {BOARD_VIEW_TABS.map((v) => {
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onViewChange(v.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? cn(TONE.primary.value, 'border-b-2 border-current')
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {v.label}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className={isStaff ? 'relative' : 'relative bg-gradient-to-b from-primary/10 via-primary/[0.04] to-transparent'}>
      {isStaff ? (
        <PageHeader
          title={staffTitle}
          subtitle={staffSubtitle}
          backPath="/"
          afterTitle={staffTabs}
          /* ชื่อหน้าถอดออก เหลือ ← + แท็บ (เจ้าของสั่ง 4 ต.ค. 2569 "เอาชื่อหน้าออกดีกว่าดูเยอะไป") */
          hideTitle={Boolean(staffTabs)}
          actions={
            view === 'board' ? (
              <>
                {!searchInHeader ? (
                  <SearchField
                    compact
                    placeholder={searchPlaceholder}
                    value={filters.search}
                    onChange={(e) => setBoardSearch(e.target.value)}
                    wrapperClassName="w-full min-w-0 sm:w-72"
                  />
                ) : null}
                {/* เหลือ "สร้างลิงก์" + "ตั้งค่าบอร์ด" + รีเฟรชแบบไอคอน (เจ้าของสั่ง 27 ก.ย. 2569) ·
                    Pre-Check ถูกถอดจากเมนูนี้ (ห้ามพาไปหมวดจับคู่งาน) */}
                <RecruitBoardTools />
                {onRefresh ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="iconXs"
                    onClick={() => void onRefresh()}
                    disabled={loading || refreshing}
                    aria-label="รีเฟรชข้อมูล"
                    title="รีเฟรชข้อมูล"
                  >
                    <RefreshCw className={cn(refreshing && 'animate-spin')} />
                  </Button>
                ) : null}
              </>
            ) : onRefresh ? (
              /* 🔴 สร้างลิงก์ (ประกาศลอย) + ตั้งค่าบอร์ด อยู่แค่แท็บโพสต์ประกาศ — แท็บอื่นเหลือรีเฟรช (ย้ายขึ้นมาจากแถวใต้แท็บ)
                 เจ้าของสั่ง 4 ต.ค. 2569 (กลับคำสั่งช่วงบ่ายวันเดียวกันที่ให้แท็บผู้สมัครมีปุ่มตั้งค่า)
                 · `listHeaderActions` = ของแท็บนั้นที่วางข้างรีเฟรช (ปฏิทินวันที่สมัคร · 5 ต.ค. 2569) */
              <>
                {listHeaderActions}
                <Button
                  type="button"
                  variant="outline"
                  size="iconXs"
                  onClick={() => void onRefresh()}
                  aria-label="รีเฟรชข้อมูล"
                  title="รีเฟรชข้อมูล"
                >
                  <RefreshCw />
                </Button>
              </>
            ) : undefined
          }
        />
      ) : null}

      <div
        className={
          isStaff ? 'relative px-4 pb-10 md:px-6' : 'relative mx-auto max-w-6xl px-4 md:px-6 pt-8 pb-6 md:pt-12 md:pb-10'
        }
      >
        {isStaff ? null : (
          /**
           * ═══ หน้าสาธารณะ — หัวเรื่องแบบ "หน้าปกนิตยสาร" (เจ้าของเคาะ 5 ก.ย. 2569) ═══
           *
           * 🔴 หน้านี้ **ไม่มีสวิตช์ `?ui=v2` กั้น** เพราะคนที่เห็นคือผู้สมัครภายนอก
           * ซึ่งไม่มีทางพิมพ์พารามิเตอร์เอง — เจ้าของเคาะแล้วว่า *"รื้อเลย ยอมให้คนนอกเห็นของใหม่"*
           *
           * ⚠️ **ข้อความเดิมอยู่ครบทุกคำ** — เพิ่มแค่ป้ายบรรทัดบนกับบรรทัดจำนวนตำแหน่ง
           * ที่เปิดรับ (นับจากการ์ดที่หน้านี้แสดงอยู่แล้ว ผู้สมัครนับเองก็ได้ ไม่ใช่ยอดภายใน)
           * ⚠️ ตัวเลขยังไม่พร้อม (กำลังโหลด/เส้นพัง) = **ไม่พิมพ์บรรทัดนั้นเลย** ห้ามโชว์ 0
           */
          <div className="rounded-3xl border border-border/70 bg-card px-6 py-8 shadow-sm sm:px-8 sm:py-10">
            <p className="text-[12.5px] font-medium text-primary">รับสมัครงาน</p>
            {/* เจ้าของเคาะ 18 ส.ค. 2569: **ยังไม่เอาโลโก้** — หัวข้อข้อความล้วน
                (ถ้าจะเอากลับ ดู docs/LOGO-SO.md) */}
            <h1 className="mt-2 max-w-3xl text-[clamp(28px,4.4vw,46px)] font-medium leading-[1.15] tracking-tight text-foreground">
              ค้นหางานที่เหมาะกับคุณ
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              เลือกตำแหน่งที่สนใจ แล้วกรอกใบสมัครได้ทันที{' '}
              <span className="font-medium text-foreground">ทีมสรรหาจะติดต่อกลับ</span>
            </p>
            {/* 🔴 เงื่อนไขของ **หน้าสาธารณะ** ต้องไม่ผูกกับสถานะบัญชีปล่อยประกาศของเจ้าหน้าที่
                (`ledgerReady` เป็นเรื่องฝั่งพนักงาน คนนอกไม่มีทางพร้อม) — ใช้แค่
                "โหลดเสร็จแล้วและมีประกาศจริง" · ยังโหลดอยู่/ไม่มีเลย = ไม่พิมพ์บรรทัดนี้
                (ห้ามโชว์ 0 ที่ยังไม่รู้จริง — กติกาเดิมของโปรเจกต์) */}
            {!loading && filters.visibleCount > 0 ? (
              <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border/60 pt-5">
                <span>
                  <span className="block text-[26px] font-medium leading-none tabular-nums text-foreground">
                    {filters.visibleCount.toLocaleString('th-TH')}
                  </span>
                  <span className="mt-1 block text-[12px] text-muted-foreground">
                    ประกาศที่เปิดรับตอนนี้
                  </span>
                </span>
                <span>
                  <span className="block text-[26px] font-medium leading-none tabular-nums text-foreground">
                    {filters.visiblePositions.toLocaleString('th-TH')}
                  </span>
                  <span className="mt-1 block text-[12px] text-muted-foreground">อัตราที่รับ</span>
                </span>
                <span className="text-[12px] text-muted-foreground">
                  ไม่ต้องสมัครสมาชิก · กรอกใบสมัครออนไลน์ได้เลย
                </span>
              </div>
            ) : null}
          </div>
        )}

        {/*
          แผงคุม 9 ตัวเลขของงานสรรหา — ตัวเดียวกับที่อยู่หน้า /recruit/rm
          ⚠️ เจ้าหน้าที่เท่านั้น — บอร์ดตัวนี้ใช้เป็นหน้าสาธารณะด้วย ยอดภายในห้ามหลุดออกไป
          ⚠️ **เฉพาะมุมมอง "รายชื่อผู้สมัคร"** (เจ้าของสั่ง 13 ส.ค. 2569:
          "ภาพรวมงานสรรหา อยู่แค่หน้ารายชื่อผู้สมัครก็พอ หน้าอื่นๆในนี้ไม่ต้องมี")
          — ตัวเลขในแผงเป็นเรื่องของ **คน** (กรอกมา/ติดต่อ/นัดหมาย) ไม่ใช่เรื่องของ
          ใบขอ จึงไม่เข้ากับมุมมองกล่องงาน และดันเนื้อหาจริงตกจอไปเปล่า ๆ
        */}
        {/* ⚠️ ช่องค้นหาของเจ้าหน้าที่เคยอยู่ตรงนี้ (ใต้แผงตัวเลข 9 ช่อง) — ย้ายขึ้นไปอยู่ใน
            แถบหัวข้าง ๆ ปุ่มแล้ว แบบหน้า Dashboard (เจ้าของสั่ง 13 ส.ค. 2569)
            หน้าสาธารณะช่องค้นหายังอยู่ที่เดิมในแถบตัวกรอง — คนนอกไม่มีแถบหัวเข้ม */}

        {/* แท็บสลับมุมมอง (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก: รวมหน้า RM เข้าบอร์ด)
            เจ้าของสั่งเพิ่ม 13 ส.ค. 2569: ยก "การติดต่อ" กับ "ติดตามนัดหมาย" จากแท็บย่อย
            ของ RM ขึ้นมาอยู่ระดับเดียวกับกล่องงาน/รายชื่อผู้สมัคร (แท็บย่อยใน RmWorkspace
            ถูกซ่อนเมื่อคุมจากข้างนอก) · โผล่เฉพาะเจ้าหน้าที่ — หน้าสาธารณะไม่มีทางเห็น
            ⚠️ **ต้องอยู่ position เดียวกันทุกแท็บ** (เจ้าของสั่ง 14 ส.ค. 2569: "Position
            เดียวกันกับหน้ากล่องงาน") — จึงอยู่ **เหนือ** ภาพรวมงานสรรหา · เดิม funnel
            แทรกก่อน tab bar ทำให้แท็บเลื่อนลงเฉพาะหน้ารายชื่อผู้สมัคร */}
        {/* 🔴 แถบแท็บย้ายขึ้นไปแถวเดียวกับชื่อหน้า (`staffTabs` ใน PageHeader · เจ้าของสั่ง 4 ต.ค. 2569) */}

        {/* 🔴 ศูนย์คุมงานสรรหา **ย้ายไปแท็บภาพรวมแล้ว** (30 ก.ย. 2569 · `BoardDashboard`) — แท็บผู้สมัครเหลือแค่
            รายชื่อแบบ iRecruit · ไม่ import ในไฟล์นี้อีก (ไฟล์นี้ใช้ร่วมหน้าสมัครสาธารณะ ของภายในไม่ควรติดไป) */}

        {/* มุมมองฝั่ง RM (รายชื่อผู้สมัคร/การติดต่อ/ติดตามนัดหมาย) — แทนที่ก้อน
            กล่องลอย+ตัวกรอง+การ์ดทั้งหมด · hero + แผงภาพรวมข้างบนคงอยู่ทุกมุมมอง */}
        {isStaff && view !== 'board' && listContent ? (
          <div className="mt-4 pb-10">{listContent}</div>
        ) : (
          <>
        {/* ═══ ฝั่งเจ้าหน้าที่ (แบบ A · 27 ก.ย. 2569): การ์ดตัวเลข 3 ใบ + ติดขั้น → แถว [ตัวกรอง][เรียง] ═══
            เจ้าของ: *"หน้ากล่องงานไม่เข้ากับหน้าอื่นๆเลย รกมาก"* — เดิมมีกล่องซ้อนกัน 4 ก้อนก่อนถึงการ์ดงาน
            (ตัวกรอง · ภาพรวม · ติดขั้นไหน · ปล่อยแล้วได้ผลยังไง) ⇒ เหลือการ์ดตัวเลข + แถวเดียว
            🔴 เลนสามก้อน/ขั้น 1–4 ยังกดกรองได้เหมือนเดิม (เจ้าของสั่งไว้ 27 ส.ค. 2569 — ห้ามถอด)
            หน้าสมัครสาธารณะใช้แถบตัวกรองแบบการ์ด frost ตัวเดิม (ข้างล่าง) */}
        {isStaff && view === 'board' ? (
          <div className="mt-3 space-y-3">
            <BoardReleaseHeader
              state={ledgerState}
              ageLabel={dataAgeLabel(dataAgeSeconds)}
              onRetry={() => {
                void loadReleases();
                setPostingsRev((n) => n + 1);
                onRefresh?.();
              }}
              ledger={ledger}
              lane={lane}
              onLaneChange={(next) => setSelection({ lane: next })}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <BoardFilterBar
                facets={boardFacets}
                onToggle={toggleBoardFacet}
                done={{
                  closed: closedBoxCounts.closed.length,
                  cancelled: closedBoxCounts.cancelled.length,
                  lane: doneLane,
                  onChange: (next) => setSelection({ lane: next }),
                }}
                dates={boardFilterState.dates}
                onDatesChange={setBoardDates}
                sort={boardSort}
                onSortChange={setBoardSort}
              />
              {/* 🔴 "แสดง N จาก M ใบขอ · ต้องหาคน X อัตรา" (เจ้าของเลือกคำเอง 27 ก.ย. 2569) · N/X = ชุดที่การ์ดโชว์จริง รวมเลนที่กด (`flowJobs` · 5 ต.ค. 2569) ·
                  ตัวเลขยังบอกไม่ได้ = ไม่พิมพ์ (ห้ามขึ้น "0 ใบขอ" ปลอม) · ล้างตัวกรองโผล่เฉพาะตอนมีตัวกรอง */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {closedBox ? (
                  <span className={cn('rounded-full px-2 py-0.5 font-medium', TONE.neutral.chip)}>
                    {JOB_BOX_LABEL[closedBox]}
                  </span>
                ) : null}
                {ledgerReady ? (
                  <span>
                    แสดง <span className="font-medium text-foreground">{flowJobs.length.toLocaleString('th-TH')}</span>{' '}
                    จาก{' '}
                    {(closedBox
                      ? filterByClosedBox(closedJobs ?? [], closedBox).length
                      : filters.visibleCount
                    ).toLocaleString('th-TH')}{' '}
                    ใบขอ ·{' '}
                    {closedBox
                      ? `${sumJobPositionUnits(flowJobs).toLocaleString('th-TH')} อัตรา`
                      : `ต้องหาคน ${sumJobPositionUnits(flowJobs).toLocaleString('th-TH')} อัตรา`}
                  </span>
                ) : null}
                {hasAnyBoardFilter(boardFilterState) || filters.search.trim() !== '' || Boolean(selectionLabel) ? (
                  <BoardResetButton onReset={() => clearAllBoardFilters({ search: true, laneStep: true })} />
                ) : null}
              </div>
            </div>

            {/* ช่วงวันที่ของชุดใบปิด/ยกเลิก — โผล่เฉพาะตอนเลือกสองกล่องนั้น
                ⚠️ **ต้องมีช่วงวันที่เสมอ** ใบปิดสะสมย้อนหลังหลายปี ดึงหมดคือรอเป็นนาที */}
            {closedBox ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2 text-xs">
                <span className="font-medium text-foreground">ปิดภายใน</span>
                <div className="flex flex-wrap items-center gap-1">
                  {CLOSED_RANGE_OPTIONS.map((r) => (
                    <Button
                      key={r.days}
                      type="button"
                      size="sm"
                      variant={closedDays === r.days ? 'default' : 'outline'}
                      onClick={() => onClosedDaysChange?.(r.days)}
                      className={cn(
                        /* 🔴 h-7 (28px) วัดจริงบนมือถือ 375px ได้ ~31.5px < 36px ขั้นต่ำสัมผัสได้ง่าย
                           (ผู้ทดสอบมือถือทัก 5 ก.ย. 2569) → ดัน min-h-9 เฉพาะจอเล็ก sm: คืนค่าเดิม */
                        'min-h-9 sm:min-h-0 h-7 rounded-lg px-2.5 text-xs',
                        closedDays === r.days ? TONE.info.solid : TONE.neutral.outline,
                      )}
                    >
                      {r.label}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={closedLoading}
                  onClick={() => onReloadClosed?.()}
                  className={cn('min-h-9 sm:min-h-0 h-7 rounded-lg px-2.5 text-xs', TONE.neutral.outline)}
                >
                  {closedLoading ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <RefreshCw aria-hidden />
                  )}
                  รีเฟรช
                </Button>
                {closedError ? (
                  <span className="text-destructive">{closedError}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <JobBoardTopFilters
          search={filters.search}
          onSearchChange={filters.setSearch}
          provinceFilter={filters.provinceFilter}
          onProvinceFilterChange={filters.onProvinceFilterChange}
          districtFilter={filters.districtFilter}
          onDistrictFilterChange={filters.setDistrictFilter}
          positionFilter={filters.positionFilter}
          onPositionFilterChange={filters.setPositionFilter}
          lockPosition={filters.lockPosition}
          subtypeFilter={filters.subtypeFilter}
          onSubtypeFilterChange={filters.setSubtypeFilter}
          provinceOptions={filters.provinceOptions}
          districtOptions={filters.districtOptions}
          positionOptions={filters.positionOptions}
          subtypeOptions={filters.subtypeOptions}
          loading={loading}
          searchPlaceholder={searchPlaceholder}
          resultCount={!ledgerReady ? undefined : boxedJobs.length}
          totalCount={!ledgerReady ? undefined : filters.visibleCount}
          facetFilter={
            publicFilterOn
              ? { facets: publicFacets, onToggle: togglePublicFacet, onClear: clearPublicFacets }
              : undefined
          }
        />
        )}

        {/* 🔴 ปุ่ม Pre-Check ย้ายเข้าเมนู "ตั้งค่าบอร์ด" แล้ว (เจ้าของสั่ง 20 ส.ค. 2569) —
            เดิมลอยเดี่ยวชิดขวาเป็นแถวของตัวเอง กินความสูงและไม่บอกว่าเกี่ยวกับอะไร
            route /matching/pre-check ยังอยู่ ลิงก์เก่าไม่พัง */}

        {loadError ? <p className="mt-4 text-sm text-destructive">{loadError}</p> : null}

        {loading && (
          <p className="mt-10 text-sm text-muted-foreground animate-pulse text-center">กำลังโหลดประกาศงาน...</p>
        )}

        {!loading && filters.usedRelatedFallback && filters.search.trim() && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            ไม่พบผลที่ตรงคำค้นทั้งหมด — แสดงงานที่ใกล้เคียงแทน
          </p>
        )}

        {!loading && boxedJobs.length === 0 && (
          <div className="mt-10 jarvis-frost rounded-2xl border border-dashed border-white/70 p-10 text-center">
            {closedBox && closedLoading ? (
              <>
                <LoaderCircle className="mx-auto mb-3 h-10 w-10 animate-spin text-muted-foreground/50" />
                <p className="font-medium text-foreground">กำลังโหลดใบขอที่ปิดแล้ว…</p>
              </>
            ) : (
              <>
                <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="font-medium text-foreground">
                  {closedBox
                    ? `ไม่มี${JOB_BOX_LABEL[closedBox]}ในช่วง ${closedDays} วันล่าสุด`
                    : 'ยังไม่มีตำแหน่งที่ตรงกับตัวกรอง'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {closedBox ? 'ลองขยายช่วงวันที่ดู' : 'ลองเปลี่ยนคำค้นหาหรือกด "ทั้งหมด"'}
                </p>
              </>
            )}
          </div>
        )}

        {/* 🔴 **แถบ "หน้าสาธารณะ" กับ "ผู้สมัคร" ถูกถอดออก 27 ส.ค. 2569**
            ทั้งสองแถบพูดเลขเดียวกับขั้นบนเส้นทางเป๊ะ ("ปล่อยแล้ว 176" = ขั้นรอคนสมัคร +
            มีคนสมัคร · "มีคนสมัครแล้ว 1" = ขั้นมีคนสมัคร) — เจ้าของสั่งว่าหน้านี้เละ
            และเคยสั่งไว้ตั้งแต่แรกว่า "อันไหนข้อมูลเดียวกันก็ยุบ ๆ รวม ๆ ไป"
            ⚠️ ปุ่ม "ปล่อยทั้งหน้านี้" ที่เคยย้ายไปท้ายแถบเส้นทาง **ถูกถอดทิ้งแล้ว 26 ก.ย. 2569**
            (เจ้าของเคาะ — ปล่อยได้ทางเดียวคือป๊อปไล่งานของใบนั้น) */}

        {/* แถบ "ลิงก์ที่ปล่อยแล้วยังไม่มีใบสมัคร" — ซ่อนตัวเองเมื่อไม่มีของ
            กดแถว = ไปหน้ารายละเอียดใบขอ · กดปุ่ม = ไปแท็บ "ประกาศ / ลิงก์สมัคร"

            🔴 **โชว์เฉพาะเลน "ปล่อยแล้ว" เท่านั้น** (แก้ 27 ส.ค. 2569)
            ของเดิมโชว์ตลอด ⇒ โมเดลที่มาลองเล่นถามว่า *"ลิงก์ที่ปล่อยแล้วยังไม่มีใบสมัคร
            5 ใบ กับ ปล่อยแล้ว 102 ต่างกันยังไง ต่างหรือไม่?"* — เป็นอาการ "สองที่พูด
            เลขเดียวกัน" ที่เจ้าของห้ามไว้ · ที่จริงมันเป็น**ส่วนย่อยของเลนปล่อยแล้ว**
            (ใบที่ปล่อยไปนานแล้วแต่ยังเงียบ) จึงต้องอยู่ใต้เลนนั้นที่เดียว */}
        {isStaff && lane === 'released' ? (
          <JobBoardSilentLinks
            rows={silentLinkRows}
            /* ทั้งกดแถวและกดปุ่ม = ไปหน้าประกาศของใบนั้น — อยู่ในกล่องงานเหมือนกัน
               (เจ้าของสั่ง: กดของในกล่องงานห้ามเด้งไปหน้าใบขอ) */
            onOpen={(job) => setPostingJob(job)}
          />
        ) : null}

        {/* ป้ายทอง "ประกาศจากใบขอ" ย้ายไปอยู่ในแถบสรุป+ตัวกรอง (eyebrow) แล้ว —
            เดิมกินแถวของตัวเอง ~40px (21 ส.ค. 2569) */}
        {/* ═══ แถบกรองด้านซ้าย + การ์ด (26 ก.ย. 2569 · แบบ iRecruit) ═══
            การ์ดเหมือนเดิมทุกอย่าง — แค่ย้ายไปอยู่คอลัมน์ขวาเมื่อมีแถบซ้าย
            (จอ lg มีที่เหลือจากแถบ 16rem ให้การ์ดแค่ 2 คอลัมน์ · xl ขึ้นไปกลับเป็น 3 เหมือนเดิม)
            🔴 เฉพาะเจ้าหน้าที่ + มุมมองกล่องงาน — หน้าสมัครสาธารณะได้กริดเดิมทุกพิกเซล */}
        <div className="mt-3">
        {/* แบบ C (5 ต.ค. 2569): ช่องไฟระหว่างการ์ดเจ้าหน้าที่แคบลง · หน้าสาธารณะเท่าเดิม */}
        <div ref={cardListRef} className={cn('grid sm:grid-cols-2 lg:grid-cols-3', isStaff ? 'gap-3' : 'gap-4')}>
          {boardFilterOn && ledgerReady && flowJobs.length === 0 && hasAnyBoardFilter(boardFilterState) ? (
            <div
              className={cn(
                'col-span-full rounded-xl border px-4 py-6 text-center text-sm',
                TONE.neutral.soft,
              )}
            >
              <p className="font-medium text-foreground">ไม่มีใบขอที่ตรงกับตัวกรองนี้</p>
              <p className="mt-1 text-xs text-muted-foreground">ลองเอาบางค่าออก หรือกด "ล้าง" ในแถบตัวกรอง</p>
            </div>
          ) : null}
          {visibleJobs.map((job) =>
            isStaff ? (
              /* 🔴 ฝั่งเจ้าหน้าที่ = การ์ดย่อ 5 บรรทัด (แบบ A · 27 ก.ย. 2569) — การ์ดข้างล่างเหลือของหน้าสมัครสาธารณะ */
              <BoardJobCard
                key={job.id}
                job={job}
                readiness={ledgerReady && !closedBox ? publishReadinessOf(job, readinessFacts) : null}
                applicants={
                  breakdownLoaded ? countFor(applicantIdx, job.id) : breakdownFailed ? 'error' : null
                }
                ai={aiCounts[job.id] ?? null}
                closed={Boolean(closedBox)}
                onOpen={setPostingJob}
                onApplicants={openApplicantsOf}
                skip={skipIdx.get(job.id) ?? null}
              />
            ) : (
            <Card
              key={job.id}
              /**
               * กดที่กล่อง — **ปลายทางต่างกันตามหน้า** (ไฟล์นี้ใช้ร่วมสองหน้า)
               *
               * 🔴🔴 **เจ้าหน้าที่ (กล่องงาน): ไปหน้า "ประกาศ / ลิงก์สมัคร" ของใบนั้น**
               * **ห้ามเด้งไปหน้าใบขอ** — เจ้าของทัก 27 ส.ค. 2569 สองรอบติด:
               * > *"ประกาศ/ลิงก์สมัคร ต้องอยู่กล่องงานสิ ทำไมไม่เข้าใจ"*
               * > *"กดงานที่หน้ากล่องงานเด้งไปหน้าใบขออยู่เลย งงไรเนี่ย"*
               *
               * เหตุผล: กล่องงานมีหน้าที่**ปล่อยประกาศ** ⇒ กดใบในหน้านี้ = จะทำงานประกาศของใบนั้น
               * ไม่ใช่จะไปอ่านว่าใบนี้คืออะไร (อันนั้นเป็นหน้าใบขอ ซึ่งมีลิงก์ไปให้ในหน้าประกาศ
               * และมีปุ่ม "ดูรายชื่อ" บนการ์ดพาไปแท็บผู้สมัครโดยตรง)
               *
               * 🔴 หน้าสมัครสาธารณะ (`/apply`): **ห้ามพาไปหน้าไหนที่ต้องล็อกอิน**
               * ⇒ เปิดฟอร์มสมัครเลย (ตัวเดียวกับปุ่ม "สมัครงาน" บนการ์ด)
               */
              onClick={() => (isStaff ? setPostingJob(job) : openApply(job))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isStaff) setPostingJob(job);
                  else openApply(job);
                }
              }}
              className={cn(
                // flex-col + h-full: grid ยืดกล่องสูงเท่ากันอยู่แล้ว แต่ลูกเรียงชิดบน
                // พื้นที่เหลือจึงกองใต้ footer → แถบ "ผู้สมัคร N คน" ของแต่ละใบลอยคนละระดับ
                // (⚠️ ใส่ที่จุดเรียกใช้เท่านั้น ห้ามแก้ ui/card.tsx ซึ่งทั้งแอปใช้ร่วมกัน)
                'group jarvis-interactive-card flex h-full flex-col overflow-hidden rounded-2xl border-white/70 transition-all duration-300 hover:border-primary/30',
                'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              )}
            >
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  {/**
                   * 🔴 **จังหวะบรรทัดของหัวการ์ด — คุมที่เดียวด้วย `space-y-1`** (21 ก.ย. 2569)
                   * เจ้าของสั่ง: *"ช่องไฟการเว้นบรรทัด และระยะห่างมันต้องพอดีกัน เท่ากัน"*
                   * ของเดิมแต่ละบรรทัดตั้ง `mt-*` เองคนละค่า (mt-1 · mt-0.5 · mt-2)
                   * ⇒ ระยะห่างไม่เท่ากันและแก้ทีต้องไล่ทุกบรรทัด
                   */}
                  <div className="min-w-0 space-y-1">
                    {/* ป้ายใบขอชั่วคราว (17 ส.ค. 2569 · เปลี่ยนคำ 19 ส.ค.) — ต้องรู้ตั้งแต่แรกเห็น
                        ว่ายังไม่ใช่ใบจริง เพราะยังไม่การันตีว่าจะเปิดงาน (หาคนล่วงหน้าได้ แต่อย่าไปสัญญา) */}
                    <PrequestBadge job={job} />
                    <h2 className="line-clamp-2 text-base font-medium text-foreground transition-colors group-hover:text-primary">
                      {jobBoardCardTitle(job)}
                    </h2>
                    {/* ตำแหน่งงานอยู่ใต้ชื่อไซต์ทันที + ไฮไลต์สี (เจ้าของสั่ง 17 ส.ค. 2569:
                        *"ตำแหน่งงานอยู่ใต้ Site งาน และขอไฮไลสีด้วย"*)
                        เดิมตำแหน่งเป็นชิปเทา ๆ ปนอยู่แถวล่างกับประเภทงาน กวาดตาหาไม่เจอ
                        ทั้งที่เป็นคำที่คนใช้ตัดสินใจมากที่สุดบนการ์ด */}
                    <p className="line-clamp-2 text-sm font-medium text-primary">
                      {/* งานขับรถ = "พนักงานขับรถ + ชนิด" (เจ้าของ 4 ต.ค. 2569) — ป้ายชนิดงานแยกถูกถอด */}
                      {publicJobTitle(job)}
                    </p>
                    {/* บรรทัดรอง: ตัดตำแหน่งที่ซ้ำกับบรรทัดสีน้ำเงินข้างบนออก (เดิมพิมพ์ซ้ำทุกใบ) */}
                    {/* หน้าสาธารณะไม่โชว์สาเหตุที่ขอ (ลาออก ฯลฯ) และชื่อคนเก่า (เจ้าของสั่ง 5 ต.ค. 2569) */}
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {(isStaff ? jobBoardCardSubtitle(job) : publicJobCardSubtitle(job)) || EM_DASH}
                    </p>
                    {/* เลขที่ใบขอโชว์เฉพาะเจ้าหน้าที่ (หน้าสมัครสาธารณะไม่ต้องเห็น จึงไม่จองที่)
                        แต่ในฝั่งเจ้าหน้าที่ต้องมีที่ยืนทุกใบ ไม่งั้นแถวล่างเลื่อนไม่ตรงกัน */}
                    {isStaff ? (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground/80">
                          {dashIfEmpty(job.request_no)}
                        </p>
                        {/* ชิปอายุ = เหตุผลที่ใบนี้อยู่ลำดับนี้ (บอร์ดเรียงด้วย
                            compareJobsByAgeDaysDesc แต่เดิมไม่มีเลขให้เห็นบนการ์ดเลย)
                            🔴 ข้อความ/สี/tooltip จาก getJobAgeChipInfo **ที่เดียว** —
                            ห้ามสร้างสเกลสีอายุที่สอง (บทเรียน "ป้ายบอกล่วงหน้า สีบอกด่วน")
                            🔴 staff เท่านั้น — คนนอกไม่ควรรู้ว่างานค้างมานานเท่าไหร่ */}
                        {(() => {
                          const age = getJobAgeChipInfo(job);
                          return (
                            <span
                              className={cn(
                                'shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-medium',
                                JOB_AGE_CHIP_META[age.level].chipCls,
                              )}
                              title={age.title}
                            >
                              {age.cardText}
                            </span>
                          );
                        })()}
                      </div>
                    ) : null}
                    {/* แถบ "ใบนี้อยู่ขั้นไหน" (เจ้าของสั่ง 31 ส.ค. 2569 — ส่งภาพตัวอย่างมาให้ดู)
                        🔴 เจ้าหน้าที่เท่านั้น · 100% = ส่งประกาศขึ้นหน้าสาธารณะแล้ว ไม่ใช่หาคนได้ครบ
                        ⚠️ ต้องรอทะเบียนโหลดครบก่อน (`ledgerReady`) ไม่งั้นทุกใบจะขึ้น "ขั้น 1 · 0%"
                        ซึ่งดูเหมือนเลขจริง — บทเรียนเดียวกับหัวกล่องงานที่เคยขึ้น 0 ทั้งแถว */}
                    {isStaff && ledgerReady
                      ? (() => {
                          const progress = releaseProgressOf(job, releaseFacts);
                          return (
                            <div className="pt-1" title={releaseProgressTitle(progress)}>
                              <BoardCardProgress progress={progress} />
                            </div>
                          );
                        })()
                      : null}
                  </div>
                  {/* มุมขวาบน = ป้ายสถานะ + ปุ่มแก้ข้อมูลประกาศ (เจ้าของสั่ง 17 ส.ค. 2569
                      ให้ย้ายปุ่มมาไว้ตรงนี้) · วางเป็นคอลัมน์ให้ป้ายอยู่บน ปุ่มอยู่ล่าง
                      จะได้ไม่แย่งบรรทัดกับหัวข้อที่ยาว 2 บรรทัด
                      ⚠️ ปุ่มอยู่ในกล่องที่คลิกได้ทั้งใบ → ต้อง stopPropagation
                      ไม่งั้นกดปุ่มแล้วเด้งไปเปิดรายละเอียดแทน */}
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {job.urgency === 'urgent' && (
                      <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium uppercase text-destructive">
                        ด่วน
                      </span>
                    )}
                    {/* 🔴 ไอคอนดินสอ "แก้ข้อมูลประกาศ" ถูกถอดออกจากการ์ด (เจ้าของสั่ง
                        20 ส.ค. 2569) — ฟอร์มย้ายไปรวมในแท็บ "แก้ไข" ของป๊อปอัปแล้ว
                        ห้ามเอาไอคอนกลับมาบนการ์ดโดยไม่ถามก่อน */}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {/* ⚠️ ชิป "ตำแหน่ง" เดิมถูกถอดออกจากแถวนี้ — ขึ้นเป็นบรรทัดไฮไลต์
                      ใต้ชื่อไซต์แล้ว ปล่อยไว้ทั้งสองที่ = อ่านซ้ำสองรอบบนการ์ดเดียว */}
                  {/* สถานะงาน + บอกด้วยเมื่อสถานะนั้นทำให้ประกาศไม่ขึ้นหน้าสาธารณะ
                      (เจ้าของสั่ง 17 ส.ค. 2569: *"ถ้าบอกมีคนรอเริ่มงานแล้วไม่ขึ้น
                      งั้นต่อไปหน้ากล่องงานช่วยบอกสถานะด้วยจะได้รู้"*)
                      เคสจริงที่ทำให้สั่ง: LBM6908002 แคททาเลอร์ ถูกตั้ง "รอแจ้งเข้า"
                      แล้วหายจากหน้าประกาศ โดยที่กล่องงานไม่ได้บอกอะไรเลย
                      ⚠️ ฝั่งสาธารณะไม่ต้องเห็น — เป็นข้อมูลการทำงานภายใน */}
                  {isStaff && isUnitRequestWorkStatus(job.work_status) ? (
                    <span
                      title={
                        isHiddenFromPublicByWorkStatus(job.work_status)
                          ? 'สถานะนี้แปลว่าได้ตัวคนแล้ว — ประกาศจึงไม่ขึ้น (เปลี่ยนสถานะแล้วประกาศกลับมาเอง)'
                          : 'สถานะงานที่เจ้าหน้าที่ตั้งไว้'
                      }
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        isHiddenFromPublicByWorkStatus(job.work_status)
                          ? TONE.warn.chip
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {isHiddenFromPublicByWorkStatus(job.work_status) ? (
                        <EyeOff className="h-3 w-3" aria-hidden />
                      ) : null}
                      {UNIT_REQUEST_WORK_STATUS_LABELS[job.work_status]}
                      {isHiddenFromPublicByWorkStatus(job.work_status) ? ' · ไม่ขึ้นประกาศ' : ''}
                    </span>
                  ) : null}
                  {/* ป้ายชนิดงาน (ส่วนกลาง/Valet …) ถอดแล้ว 4 ต.ค. 2569 — ชนิดอยู่ในชื่อตำแหน่ง ("พนักงานขับรถ ส่วนกลาง")
                      ป้ายเดิมเดาจากคำแล้วขึ้น "ส่วนกลาง" บนการ์ดคนสวนด้วย */}
                  {job.job_description_code_1 ? null : (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {jobSectorLabel(job)}
                    </span>
                  )}
                </div>
              </CardHeader>
              {/* flex-1: ดูดพื้นที่เหลือของกล่องไว้ที่นี่ ให้ footer ถูกตรึงก้นการ์ด
                  ความแปรผันของเนื้อด้านบน (ชิปช่องทางที่หายทั้งบล็อกในบางใบ ฯลฯ)
                  จึงไม่ทำให้แถบ "ผู้สมัคร N คน" ของแต่ละใบอยู่คนละระดับอีก */}
              <CardContent className="flex-1 space-y-2 pb-4">
                <p className="flex items-start gap-2 text-xs text-muted-foreground line-clamp-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                  {/* ข้อความสำรองแบบเดียวกับการ์ดกล่องลอย ('ไม่ได้ระบุจังหวัด') —
                      คำที่ผู้สมัครทั่วไปอ่านรู้เรื่อง เพราะโผล่บนหน้าสมัครสาธารณะด้วย */}
                  {job.location_address?.trim() || 'ไม่ได้ระบุสถานที่'}
                </p>
                {/**
                 * 🔴 มือถือ: แถวนี้พับเหลือแถวเดียวเลื่อนซ้าย-ขวาได้ (เจ้าของเคาะ 5 ก.ย. 2569
                 * — Haiku ทดสอบมือถือให้ 62/100 เพราะปุ่ม "สมัครงาน" ต้องเลื่อนหาไกลเกินไป)
                 * ⚠️ ข้อมูลห้ามหาย — ทุกฟิลด์ยังอยู่ครบ แค่ไม่ตกลงบรรทัดใหม่บนจอแคบ
                 * จอกว้างขึ้น (`sm:`) กลับไปพับหลายบรรทัดตามเดิม
                 */}
                <div className="flex flex-nowrap items-center gap-x-3 gap-y-1.5 overflow-x-auto text-xs sm:flex-wrap sm:overflow-visible">
                  {/* ยอดรายเดือน = ค่าแรงหลัก + รายได้มั่นคง (เจ้าของสั่ง 16 ส.ค. 2569)
                      ⚠️ ถอยไป total_income เมื่อคิดไม่ได้ — แต่ตัวนั้นบางใบเป็น**อัตรารายวัน**
                      (410 = ค่าแรง/วัน · 20 จาก 200 ใบ) จึงไม่ติดคำว่า "/เดือน" ให้ */}
                  {/**
                   * 🔴 **เงินต้องบอกหน่วยเสมอ — และ "ไม่รู้หน่วย" ต้องบอกว่าไม่รู้** (21 ก.ย. 2569)
                   *
                   * ของเดิมปั้นสูตรเองตรงนี้ แล้วกรณีสุดท้ายพิมพ์ `฿400` เปล่า ๆ เท่ากับ
                   * `฿12,000` ทุกประการ ⇒ กวาดตาผ่าน ๆ อ่านเป็น "เงินเดือน 400"
                   * (เจ้าของทักเอง · ของจริงมี 20 จาก 200 ใบที่เป็นค่าแรง**ต่อวัน**)
                   *
                   * เปลี่ยนมาใช้ `incomeDisplay()` ซึ่งเป็นตัวเดียวกับที่หน้าจับคู่ใช้อยู่แล้ว
                   * ⇒ หนึ่งเมตริกหนึ่งนิยาม · ไม่รู้หน่วย = ขึ้น "บาท" เฉย ๆ + คำเตือนใน tooltip
                   * ⚠️ คำเตือนเป็นภาษาภายใน (พูดถึง ERP) ⇒ **เฉพาะเจ้าหน้าที่**
                   * การ์ดใบนี้โผล่บนหน้าสมัครสาธารณะด้วย
                   */}
                  {(isStaff || publicFieldVisible(job, 'income')) && (() => {
                    const money = job.income_display
                      ? {
                          text: `฿${job.income_display.total.toLocaleString('th-TH')} ${INCOME_PERIOD_LABEL[job.income_display.period]}`,
                          hint: null as string | null,
                        }
                      : (() => {
                          const d = incomeDisplay({
                            totalIncome: job.total_income,
                            monthlyIncome: job.monthly_income,
                          });
                          return d ? { text: d.text, hint: d.hint } : null;
                        })();
                    if (!money) return null;
                    return (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-foreground font-medium"
                        title={isStaff && money.hint ? money.hint : undefined}
                      >
                        <Banknote className="h-3.5 w-3.5 text-success" />
                        {money.text}
                      </span>
                    );
                  })()}
                  {isStaff || publicFieldVisible(job, 'required_date') ? (
                    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      ต้องการ {formatYmdDmyBe(job.required_date)}
                    </span>
                  ) : null}
                  {/* สัญชาติเจ้านาย (เจ้าของสั่ง 17 ส.ค. 2569 — เอาขึ้นทั้งกล่องงานและหน้าสาธารณะ)
                      ⚠️ ERP กรอกมาแค่ ~40% ของใบขอ · ไม่มีข้อมูล = ไม่ขึ้นบรรทัดนี้
                      ห้ามขึ้นว่า "ไม่ระบุ" — การ์ดนี้โผล่บนหน้าสมัครสาธารณะด้วย */}
                  {job.boss_nationality?.trim() && (isStaff || publicFieldVisible(job, 'boss_nationality')) ? (
                    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-muted-foreground">
                      <Flag className="h-3.5 w-3.5" />
                      นายสัญชาติ {job.boss_nationality.trim()}
                    </span>
                  ) : null}
                </div>
                {/* สวัสดิการ (เจ้าของเคาะ 16 ส.ค. 2569 — "เอาเหมือนที่ AI พูด")
                    ⚠️ ตัวเลขทั้งหมดเป็น **อัตราจ่าย** ที่พนักงานได้จริง ไม่ใช่อัตราเบิก
                    ⚠️ ไม่มีข้อมูล = ไม่ขึ้นแถวนี้ (ห้ามขึ้นว่า "ไม่มีสวัสดิการ") */}
                {/* ชิปสวัสดิการ = ของจาก ERP (อัตราจริง) + ของที่เจ้าหน้าที่ติ๊กเพิ่มเอง
                    เรียง ERP ก่อนเพราะมีตัวเลขจริงกำกับ น่าเชื่อกว่า */}
                {(() => {
                  /* รอบรับเงิน (4 ต.ค. 2569 — ไม่ใช่สวัสดิการ) ขึ้นหน้าแถวชิป ตามช่องรายได้ที่ติ๊กให้เห็น */
                  const pay = isStaff || publicFieldVisible(job, 'income') ? payCycleText(payCyclesOf(job)) : '';
                  // ติ๊กโอทีออก = ตัดชิปโอทีบนประกาศ (4 ต.ค. 2569 · เดิมช่องนี้ไม่ได้ต่อกับอะไร) — เจ้าหน้าที่ยังเห็นครบ
                  const chips = isStaff
                    ? [...(job.benefits ?? []), ...benefitDisplayLabels(job.extra_benefits)]
                    : publicBenefitList(job, benefitDisplayLabels(job.extra_benefits));
                  return pay || chips.length > 0 ? (
                  // 🔴 มือถือ: พับเหลือแถวเดียวเลื่อนได้เหมือนแถวเงินเดือนด้านบน (เจ้าของเคาะ 5 ก.ย. 2569)
                  <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible">
                    {pay ? <span className={cn('shrink-0 whitespace-nowrap', TONE.info.chip)}>{pay}</span> : null}
                    {chips.map((b) => (
                      <span key={b} className={cn('shrink-0 whitespace-nowrap', TONE.success.chip)}>
                        {b}
                      </span>
                    ))}
                  </div>
                  ) : null;
                })()}
              </CardContent>
              <CardFooter className="mt-auto flex-col items-stretch gap-2 border-t border-border/60 bg-muted/20 pt-3">
                {isStaff ? (
                  <>
                    {/**
                      * ชิปเดียวที่เพิ่มเข้ามา — **ติดเฉพาะใบที่ปล่อยลิงก์แล้ว** (21 ส.ค. 2569)
                      *
                      * 🔴 เคยทำกลับกัน (เตือนส้มใบที่ยังไม่ปล่อย) แล้ว**ใช้ไม่ได้จริง**:
                      * ของจริงมีประกาศผูกใบขอแค่ **12 จาก 283 ใบ** → ชิปเตือนขึ้น 271 ใบ
                      * = เกือบทุกใบ · คำเตือนที่ขึ้นทุกใบไม่ใช่คำเตือน มันคือพื้นหลัง
                      * (เจ้าของเคาะ: *"กลับด้าน ติดเขียวเฉพาะ 12 ใบที่ปล่อยแล้ว"*)
                      * → ของน้อยคือสัญญาณ ของเยอะคือพื้น
                      * ⚠️ รอ `postingsReady` ก่อน ไม่งั้นแวบแรกไม่มีใบไหนติดเขียวเลย
                      */}
                    {postingsReady && postedJobIds.has(job.id) ? (
                      <span className={cn('self-start', TONE.success.chip)}>สร้างลิงก์แล้ว</span>
                    ) : null}
                    {/* ยอดคลิกบนหน้าสมัครสาธารณะ 30 วัน — ขึ้นเฉพาะใบที่มีคนกดจริง
                        (ใบที่ยังไม่มีใครกดไม่ต้องขึ้นชิป 0 · ชิปที่ขึ้นทุกใบไม่ใช่สัญญาณ) */}
                    {(() => {
                      const c = publicClicks.get(job.id);
                      if (!c || c.apply === 0) return null;
                      return (
                        <span
                          className={cn('self-start', TONE.info.chip)}
                          title="นับจากประกาศ 30 วันล่าสุด — กดปุ่มสมัคร / ส่งใบสมัครจริง"
                        >
                          กดสมัคร {c.apply.toLocaleString('th-TH')}
                          {c.submit > 0 ? ` · ส่งจริง ${c.submit.toLocaleString('th-TH')}` : ''}
                        </span>
                      );
                    })()}
                    {/* ชิปช่องทางที่ปล่อยลิงก์ไว้ + ยอดคลิก (mockup rev.3 ข้อ 04) */}
                    {(channelsByJob.get(job.id) ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(channelsByJob.get(job.id) ?? []).slice(0, 3).map((c, i) => (
                          <span
                            key={`${c.label}-${i}`}
                            className={i === 0 ? TONE.primary.chip : TONE.neutral.chip}
                            title={`${c.label} · คลิก ${c.hits.toLocaleString('th-TH')} ครั้ง`}
                          >
                            {c.label} · คลิก {c.hits.toLocaleString('th-TH')}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {/* เจ้าของสั่ง 14 ส.ค. 2569: จัดเรียงให้สวย · "สร้างลิงก์" → "Gen link"
                        · 2 ปุ่มคนละสี (ค้นหา = ฟ้า · Gen link = ม่วง) — สีมาจาก TONE ที่เดียว
                        แถวเดียว wrap ได้ · "ผู้สมัคร N คน" ซ้าย · ปุ่ม+ดูรายชื่อ ขวา */}
                    <div className="flex w-full flex-wrap items-center justify-between gap-1.5">
                      <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-foreground">
                        <Users className={cn('h-3.5 w-3.5', TONE.info.value)} />
                        {/* 🔴 เลขผู้สมัครต้องเด่น + ใบที่ยังไม่มีใครสมัครมีป้ายเตือน (แผนแถบกรอง
                            26 ก.ย. 2569 — เจ้าของอยากเห็นปราดเดียวว่า "งานไหนไม่มีคนเลย")
                            ⚠️ ป้ายรอยอดโหลดครบก่อน (`breakdownLoaded`) — ยังไม่มา = ห้ามบอกว่า
                            ไม่มีคนสมัคร ทั้งที่แค่ยังอ่านไม่เสร็จ (บทเรียนเลข 0 ปลอมบนหัวกล่องงาน) */}
                        {isStaff && breakdownLoaded && countFor(applicantIdx, job.id) === 0 ? (
                          <span
                            className={cn(
                              'rounded-md border px-1.5 py-0.5 text-xs font-medium',
                              TONE.warn.soft,
                              TONE.warn.value,
                            )}
                          >
                            ยังไม่มีคนสมัคร
                          </span>
                        ) : (
                          <>
                            ผู้สมัคร{' '}
                            <span className="text-sm font-medium tabular-nums">
                              {countFor(applicantIdx, job.id).toLocaleString('th-TH')}
                            </span>{' '}
                            คน
                          </>
                        )}
                        {/* Lead = ใบที่ถูกปัดเข้าคลัง ไม่ถูกนับในยอดซ้าย — โชว์เป็นเลขที่สอง
                            แทนที่จะยุบรวม (ยุบรวมแล้วเลขบนการ์ดจะไม่ตรงกับที่กดเข้าไปเห็น
                            ซึ่งเป็นเหตุผลที่ตัวนับกรอง Lead ออกตั้งแต่แรก) */}
                        {countFor(leadIdx, job.id) > 0 ? (
                          <span className="font-normal text-muted-foreground">
                            · Lead {countFor(leadIdx, job.id)}
                          </span>
                        ) : null}
                        {/* แยกที่มาให้เห็นบนใบขอเลย — ไม่รู้ที่มา = ไม่ขึ้นบรรทัดนี้ */}
                        {applicantOriginSummary(originIdx.get(job.id)) ? (
                          <span className="font-normal text-muted-foreground">
                            ({applicantOriginSummary(originIdx.get(job.id))})
                          </span>
                        ) : null}
                        {/**
                         * 🔴 "ส่ง AI แล้ว x/y" (เจ้าของเคาะ 22 ก.ย. 2569 นิยามกล่องงานข้อ 6:
                         * *"เข้ามาแล้วถูกส่งไปหา AI หรือยัง"*)
                         * y=0 (ยังไม่มีผู้สมัคร) ไม่ขึ้นชิป · ไม่รู้ (server ไม่ส่งคีย์) ไม่ขึ้น ·
                         * ยังส่งไม่ครบ = เหลือง (มีคนค้างไม่ถูกส่ง) · ส่งครบ = เขียว
                         */}
                        {(() => {
                          const ai = aiCounts[job.id];
                          if (!ai || ai.total === 0) return null;
                          const done = ai.sent >= ai.total;
                          return (
                            <span
                              className={cn('shrink-0', done ? TONE.success.chip : TONE.warn.chip)}
                              title={
                                done
                                  ? 'ผู้สมัครทุกคนถูกส่งให้ AI โทรแล้ว'
                                  : 'ยังมีผู้สมัครที่ยังไม่ถูกส่งให้ AI โทร'
                              }
                            >
                              ส่ง AI แล้ว {ai.sent}/{ai.total}
                            </span>
                          );
                        })()}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* 🔴 ใบที่ปิด/ยกเลิกแล้วไม่มีปุ่มลงมือ — หาคนเพิ่ม/ปล่อยลิงก์/แก้ประกาศ
                            ของใบที่จบไปแล้วคือส่งคนไปงานที่ไม่มีอยู่ (ดูรายชื่อยังกดได้) */}
                        {closedBox ? null : (
                          <>
                        {/* เจ้าของเคาะ 17 ส.ค. 2569: *"ถ้าไม่ต่างเหลือแค่ปุ่มเดียวพอ"* →
                            ยุบสองปุ่มเป็นปุ่มเดียว **เก็บตัวที่ทำงานครบกว่า** (ค้น 3 แหล่ง:
                            Checklist + ฐานใหม่ + iRecruit แล้วส่ง AI โทรทันที) แล้วเปลี่ยน
                            คำเป็น "หาผู้สมัครเพิ่ม" · ปุ่มเดิมที่พาไปหน้า Matching ค้นแต่
                            iRecruit ให้ดูเฉย ๆ ถูกถอดออก (ของใหม่ครอบอยู่แล้ว) */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLaneJob(job);
                          }}
                          title={SEARCH_ALL_POOLS_AND_CALL.hint}
                          /* 🔴 ui/button.tsx variant เป็นธีมสว่างล้วน (bg-white/50 ไม่มีคู่ dark)
                             → ทับด้วย TONE.*.outline ที่มีคู่ dark ครบ (กติกาข้อ 4) */
                          className={cn('min-h-9 sm:min-h-0 h-7 rounded-lg px-2 text-xs', TONE.success.outline)}
                        >
                          <Send aria-hidden />
                          {SEARCH_ALL_POOLS_AND_CALL.label}
                        </Button>
                          </>
                        )}
                        {/* ⚠️ **ไม่มีปุ่ม "ประกาศ / ลิงก์" บนการ์ด** — กดตัวการ์ดคือไปหน้านั้นแล้ว
                            (ใส่ปุ๊มซ้ำ = ปุ่มที่ทำงานเหมือนการกดกล่องที่มันอยู่ข้างใน) */}
                        {/* "ดูรายชื่อ" = **ไปแท็บ "รายชื่อผู้สมัคร" ในหน้านี้** พร้อมติ๊กใบนี้ให้
                            (27 ก.ย. 2569 — เจ้าของสั่งห้ามเด้งไปหน้าใบขอ · เดิมไปแท็บผู้สมัครของหน้าใบขอ)
                            ⚠️ stopPropagation — ไม่งั้นโดนคลิกของกล่องทับ */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openApplicantsOf(job);
                          }}
                          className={cn('min-h-9 sm:min-h-0 h-7 rounded-lg px-2 text-xs', TONE.info.outline)}
                        >
                          <Users aria-hidden />
                          ดูรายชื่อ
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex w-full gap-2">
                    <Button size="sm"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openApply(job);
                      }}
                      className="flex-1 py-2.5 text-xs font-medium"
                    >
                      สมัครงาน
                      <Send className="opacity-90" />
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
            ),
          )}
        </div>
        </div>

        {/* แถบเลขหน้า — ตัวเดียวกับหน้าหน่วยงาน/ผู้สมัคร เลือกจำนวนต่อหน้าได้ (20/40/60/100) */}
        {/* 🔴 นับจาก `flowJobs` (ชุดเดียวกับการ์ดที่โชว์ · รวมเลนที่กด) — เดิมใช้ `boxedJobs` เลยไม่เปลี่ยนตามเลน (5 ต.ค. 2569) */}
        {flowJobs.length > 0 ? (
          <div className="pb-10 pt-4">
            <ListPaginationBar
              page={currentPage}
              pageSize={pageSize}
              totalItems={flowJobs.length}
              totalPages={totalPages}
              pageFrom={pageStart + 1}
              pageTo={pageStart + visibleJobs.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>

        ) : null}

        {/*
          กล่องลอย (ไม่ผูกใบขอ) — เจ้าของสั่ง 13 ส.ค. 2569 ให้ "เอาลงมารวม" ท้ายลิสต์
          (เดิมอยู่เหนือตัวกรอง ดันใบขอจริงตกจอ) · ทรงการ์ดเดียวกับการ์ดใบขอ (11 ส.ค. 2569)
          (`jarvis-interactive-card` · หัวข้อ → ชิป → เนื้อ → แถบล่าง) แทนกล่องเล็กแบน ๆ เดิม

          ⚠️ ไม่มีลิงก์ "ดูรายชื่อ →" เหมือนการ์ดใบขอ — ใบสมัครฝั่งเราผูกกับ `job_id`
          ไม่ได้ผูกกับประกาศ จึงยังกรองรายชื่อ "เฉพาะกล่องลอยประเภทนี้" ไม่ได้จริง
          ใส่ปุ่มไปก็เป็นปุ่มหลอก · การกดการ์ด = สร้างลิงก์ของประเภทนั้น ซึ่งทำได้จริง
        */}
        {isStaff && postings.some((p) => p.standaloneKind) ? (
          /**
           * 🔴 **คั่นให้ชัดว่าข้ามเรื่องแล้ว** (เจ้าของเคาะ 21 ก.ย. 2569)
           *
           * เจ้าของยืนยันให้**คงไว้ท้ายลิสต์ตามที่สั่งไว้ 13 ส.ค.** (ย้ายขึ้นบนแล้วดันใบขอ
           * จริงตกจอ) แต่ป้ายเดิมเป็นบรรทัดจาง ๆ ตัวเล็ก 11px บรรทัดเดียว ⇒ คนเลื่อนลงมา
           * ไม่มีทางรู้ว่ากำลังดูคนละเรื่องกับบอร์ดข้างบน (ผมวัดเองตอนตรวจหน้า 16 ก.ย.)
           *
           * เพิ่มเส้นคั่นเต็มความกว้าง + หัวเรื่องขนาดอ่านออก + บรรทัดบอกว่าต่างจากข้างบน
           * ยังไง — **ไม่ย้ายตำแหน่ง ไม่แตะการ์ดข้างใน**
           */
          <div className="mt-10">
            <Separator className="mb-4" />
            <div className="mb-3">
              <h2 className="text-sm font-medium text-foreground">กล่องลอย (ไม่ผูกใบขอ)</h2>
              <p className={cn('mt-0.5 text-xs', DASH.muted)}>
                ประกาศที่ไม่ได้มาจากใบขอของหน่วยงาน — ตัวเลขข้างบนทั้งหมดไม่นับส่วนนี้ ·
                กดที่กล่องเพื่อสร้างลิงก์รับสมัครของประเภทนั้น
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STANDALONE_POSTING_KINDS.map((k) => {
                const tone = TONE[STANDALONE_KIND_TONE[k.code] ?? 'neutral'];
                const s =
                  standaloneSummary[k.code] ??
                  { postings: 0, applicants: 0, titles: [], provinces: [], bus: [] };
                const openGen = () =>
                  setGenStandalone({
                    kind: k.code,
                    kindLabel: k.label,
                    departmentCode: s.bus[0] ?? BOARD_DEFAULT_BU,
                  });
                return (
                  <Card
                    key={k.code}
                    onClick={openGen}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openGen();
                      }
                    }}
                    className={cn(
                      // ทรงเดียวกับการ์ด "ประกาศจากใบขอ" เป๊ะ (เจ้าของสั่ง 17 ส.ค. 2569
                      // — "กล่องลอยทำให้เหมือนกับประกาศจากใบขอ") · flex-col + h-full
                      // คือตัวที่ทำให้กล่องสูงเท่ากันทั้งแถวและ footer ปักอยู่ล่างสุด
                      // เดิมกล่องลอยไม่มีสองคลาสนี้ แถวจึงสูงไม่เท่ากันและแถบล่างลอยคนละระดับ
                      'group jarvis-interactive-card flex h-full flex-col overflow-hidden rounded-2xl border-white/70 transition-all duration-300 hover:border-primary/30',
                      'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                      s.postings === 0 && 'opacity-60',
                    )}
                  >
                    <CardHeader className="space-y-3 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="line-clamp-2 text-base font-medium text-foreground transition-colors group-hover:text-primary">
                            {k.label}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {s.titles.length > 0 ? s.titles.join(' • ') : 'ยังไม่มีประกาศของประเภทนี้'}
                          </p>
                        </div>
                        <span className={cn('shrink-0', tone.chip)}>
                          {s.postings.toLocaleString('th-TH')} ประกาศ
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          กล่องลอย
                        </span>
                        {s.bus.map((bu) => (
                          <span
                            key={bu}
                            className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {bu}
                          </span>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-2 pb-4">
                      <p className="flex items-start gap-2 text-xs text-muted-foreground line-clamp-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                        {s.provinces.length > 0 ? s.provinces.join(' · ') : 'ไม่ได้ระบุจังหวัด'}
                      </p>
                    </CardContent>
                    <CardFooter className="mt-auto flex-col items-stretch gap-2 border-t border-border/60 bg-muted/20 pt-3">
                      {/* แถวล่างจัดแบบเดียวกับการ์ดใบขอ: "ผู้สมัคร N คน" ซ้าย · ปุ่มขวา
                          ⚠️ ไม่มีปุ่ม "ดูรายชื่อ" เพราะใบสมัครผูกกับ `job_id` ไม่ได้ผูกกับ
                          ประกาศ — กรองรายชื่อ "เฉพาะกล่องลอยประเภทนี้" ยังทำไม่ได้จริง
                          ใส่ไปก็เป็นปุ่มหลอก */}
                      <div className="flex w-full flex-wrap items-center justify-between gap-1.5">
                        <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-foreground">
                          <Users className={cn('h-3.5 w-3.5', TONE.info.value)} />
                          ผู้สมัคร {s.applicants.toLocaleString('th-TH')} คน
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium',
                            TONE.violet.outline,
                          )}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Gen link
                        </span>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : null}
          </>
        )}

        {!isStaff ? (
          <div className="mx-auto max-w-md pb-14 pt-2 text-center">
            <div className="jarvis-frost rounded-2xl border border-white/70 px-6 py-8">
              <p className="text-sm font-medium text-foreground">พร้อมสมัครแล้ว?</p>
              <p className="mt-1 text-xs text-muted-foreground">กรอกใบสมัครสั้นๆ แล้วทีมสรรหาจะติดต่อกลับ</p>
              <Button size="sm"
                type="button"
                onClick={() => openApply(null)}
                className="mt-5 inline-flex w-full justify-center px-8 py-3.5 text-sm font-medium transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                กรอกใบสมัครงาน
                <Send aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* 🔴 **ป๊อปอัป 3 ขั้นของการ์ดถูกถอดทั้งดวง 27 ส.ค. 2569**
          เจ้าของสั่ง: *"พอกดแล้วก็พาไปดูข้อมูล ไม่เอาแบบ Popup เด้งนะ"*
          กดการ์ด = ไปหน้ารายละเอียดใบขอจริง · ของที่ป๊อปเคยเป็นบ้านหลังเดียว
          (ปล่อยหน้าสาธารณะ · แก้ข้อความประกาศ · แก้ข้อมูลที่จะขึ้นประกาศ · Gen link ·
          ประวัติการแก้ไข) ย้ายไปแท็บ "ประกาศ / ลิงก์สมัคร" ของใบขอครบแล้ว
          ⇒ `/jobs/siamraj/:id/posting` (`UnitRequestPostingTabPage`) */}

      {/* ── 🔴 popup ไล่งาน 4 ขั้น — ทำเสร็จปิดแล้วอยู่ที่กล่องงานต่อ ──
          เนื้อในเป็น component เดียวกับหน้า deep-link `/jobs/board/:id/posting`
          (ห้ามก๊อปเนื้อมาทำใหม่) · ปิดแล้วโหลดทะเบียนใหม่ ตัวเลขบนหัวจะขยับตามทันที */}
      <Dialog
        open={!!postingJob}
        onOpenChange={(o) => {
          if (!o) {
            setPostingJob(null);
            void loadReleases();
            void loadSkips();
            setPostingsRev((n) => n + 1);
          }
        }}
      >
        <DialogContent
          className={cn(
            'flex max-h-[min(92dvh,860px)] max-w-none flex-col gap-0 overflow-hidden border-border/80 p-0',
            // ป๊อปหน้าเดียวกว้างกว่า (ซ้ายตัวอย่างคนนอก · ขวาช่องที่จะขึ้นประกาศ) · ป๊อป 4 ขั้นเดิมเท่าเดิม
            stepsPopup ? 'w-[min(calc(100vw-1.25rem),40rem)]' : 'w-[min(calc(100vw-1.25rem),52rem)]',
            // พื้นทึบใต้ไล่เฉดของ jarvis-frost — เดิมโปร่ง ~5% ตัวหนังสือการ์ดกล่องงานข้างหลังลอยทะลุช่องว่างระหว่างการ์ด
            '!bg-background',
            EVEN_TYPE,
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border/50 px-5 pb-3 pt-5 text-left">
            <DialogTitle className="text-base font-medium sm:text-lg break-words">
              {postingJob ? jobBoardCardTitle(postingJob) : ''}
            </DialogTitle>
            {/* คำอธิบายเหลือไว้ให้โปรแกรมอ่านจอ — บนจอตัดออก (เจ้าของ 30 ก.ย. 2569: "คำอธิบายอันไหนไม่จำเป็นก็ตัด") */}
            <DialogDescription className="sr-only">{stepsPopup ? 'ไล่งานประกาศของใบนี้ทีละขั้น' : 'ตรวจแล้วประกาศใบนี้'}</DialogDescription>
            {/* 🔴 ปุ่ม "หาคนทุกกอง + ให้ AI โทร" ย้ายไปอยู่บนแท็บ **รายชื่อ** ในป๊อป (เจ้าของ Choice 1 ต.ค. 2569
                "4 ขั้นเดิม แต่ตัดของรก") — ส่ง `onSearchAllPools` ลงไป · ⚠️ ห้ามซ้อน Dialog ⇒ กดแล้วปิดป๊อปนี้ก่อน
                ค่อยเปิดหน้าต่างหาคน · ใบที่ปิด/ยกเลิกแล้วไม่มีปุ่มนี้ (ส่งคนไปงานที่ไม่มีอยู่) */}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
            {postingJob ? (
              <React.Suspense
                fallback={<p className="py-6 text-center text-xs text-muted-foreground">กำลังโหลด…</p>}
              >
                {(() => {
                  const onSearchAllPools = closedBox
                    ? undefined
                    : () => {
                        const j = postingJob;
                        setPostingJob(null);
                        setLaneJob(j);
                      };
                  const onDone = () => {
                    setPostingJob(null);
                    void loadReleases();
                    void loadSkips();
                    setPostingsRev((n) => n + 1);
                  };
                  return stepsPopup ? (
                    <BoardPostingSteps id={postingUnitId(postingJob)} chrome={false} onSearchAllPools={onSearchAllPools} onDone={onDone} />
                  ) : (
                    <BoardPublishSheet id={postingUnitId(postingJob)} onSearchAllPools={onSearchAllPools} onDone={onDone} />
                  );
                })()}
              </React.Suspense>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <PublicApplyDialog
        open={applyOpen}
        job={applyJob}
        onClose={() => setApplyOpen(false)}
      />

      {/* ⚠️ Gen link/แก้ไขประกาศ **ของใบขอ** ไม่ใช้ Dialog แยกอีกแล้ว — ฝังเป็นแท็บ
          ในป๊อปอัปของการ์ด (19 ส.ค. 2569) · ที่เหลือข้างล่างเป็นของ**ประกาศลอย** คนละตัว */
      }
      <GenApplyLinkDialog
        open={!!genStandalone}
        job={null}
        standalone={genStandalone}
        onClose={() => setGenStandalone(null)}
        onCreated={() => setPostingsRev((n) => n + 1)}
      />

      {/* เลนสรรหา (R2b) — โหลดเมื่อกดเท่านั้น ไม่ให้ติดไปกับ bundle ของ /apply */}
      {laneJob ? (
        <React.Suspense fallback={null}>
          <RecruitLaneDialog open job={laneJob} onClose={() => setLaneJob(null)} />
        </React.Suspense>
      ) : null}

    </div>
  );
};

export default JobBoardView;
