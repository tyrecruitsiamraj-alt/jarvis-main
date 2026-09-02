import React, { useEffect, useMemo, useState } from 'react';
import { conveyorLabel } from '@/lib/soRecruitNav';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS } from '@/types';
import { jobSectorLabel } from '@/lib/unitRequestDisplay';
import { jobBoardCardTitle, jobBoardCardSubtitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import BoardCardProgress from '@/components/jobs/BoardCardProgress';
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
import {
  canShowNumbers,
  combineFeedStates,
  dataAgeLabel,
  type FeedState,
} from '@/lib/boardDataState';
import { httpStatusOf } from '@/lib/apiFetch';
import { extractJobSubtypeLabel } from '@/lib/siamrajUnitFilters';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { EM_DASH, dashIfEmpty } from '@/lib/displayFallback';
import { inferProvinceFromAddress, inferSubdistrictFromAddress } from '@/lib/parseThaiJobAddress';
import { benefitDisplayLabels } from '@/lib/extraBenefits';
import { displayDistrictLine } from '@/lib/displayJobLocation';
import { resolveApplyPositionPreset } from '@/lib/jobBoardPositionPreset';
import JobBoardTopFilters from '@/components/jobs/JobBoardTopFilters';
import PrequestBadge from '@/components/jobs/PrequestBadge';
import SearchField from '@/components/shared/SearchField';
import PublicApplyDialog from '@/components/jobs/PublicApplyDialog';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';
/**
 * เลนสรรหา — lazy ตั้งใจ: ไฟล์นี้ใช้ร่วมกับหน้าสมัครสาธารณะ /apply
 * กล่องผลค้น (+ ตัวเรียก API หลังบ้าน) ต้องไม่ถูกลากเข้า bundle ฝั่ง public
 */
import RecruitBoardTools from '@/components/jobs/RecruitBoardTools';
import RecruitControlPanel from '@/components/recruit-rm/RecruitControlPanel';
import PageHeroStrip, { heroButton } from '@/components/shared/PageHeroStrip';
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
  RELEASE_STEP_ORDER,
  RELEASE_STEP_TEXT,
  buildReleaseLedger,
  releaseProgressOf,
  releaseProgressTitle,
  filterByReleaseLane,
  filterByReleaseStep,
  releasableJobsOf,
  type ReleaseFacts,
  type ReleaseLaneKey,
  type ReleaseStepKey,
} from '@/lib/boardRelease';
import JobBoardSilentLinks from '@/components/jobs/JobBoardSilentLinks';
import {
  buildReleaseIndex,
  fetchJobReleases,
  releaseJobsToPublic,
  unreleaseJobsFromPublic,
  type JobRelease,
} from '@/lib/jobPublicReleaseApi';
import {
  boardPostingPath,
  navigateToUnitRequest,
  type UnitRequestTabName,
} from '@/lib/jobNavigation';
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
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { INCOME_PERIOD_LABEL } from '@/lib/incomeBreakdown';
import { useJobBoardFilters } from '@/hooks/useJobBoardFilters';
import { compareJobsByAgeDaysDesc, getJobAgeChipInfo, JOB_AGE_CHIP_META } from '@/lib/jobUrgency';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { MapPin, Briefcase, Calendar, Banknote, RefreshCw, Send, Users, Link2, Pencil, Search, ClipboardCheck, Flag, EyeOff, LoaderCircle } from 'lucide-react';
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
};

/**
 * แท็บระดับบอร์ด — 'board' คือกล่องงาน ที่เหลือ mapped เข้าแท็บของ RmWorkspace
 * 🔴 **ไม่มี 'closed' / 'cancelled' อีกแล้ว** (19 ส.ค. 2569) — ปิดแล้ว/ยกเลิกเป็น
 * **กล่องบนหน้ากล่องงาน** ที่กดแล้วกรองในหน้าเดิม เหมือนกล่องอื่นทุกกล่อง
 * ลิงก์เก่า `?view=closed` / `?view=cancelled` ถูกแปลงเป็นกล่องที่ `StaffJobBoardPage`
 */
export type BoardViewId = 'board' | 'list' | 'contact' | 'appointments' | 'postings';

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
  closedJobs,
  closedLoading = false,
  closedError = null,
  closedDays = 30,
  onClosedDaysChange,
  onReloadClosed,
  initialBox = null,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * 🔴 **กดอะไรบนบอร์ดก็ "ไปหน้า" ไม่ใช่ "เด้งป๊อป"** (เจ้าของสั่ง 27 ส.ค. 2569:
   * *"พอกดแล้วก็พาไปดูข้อมูล ไม่เอาแบบ Popup เด้งนะ"*)
   *
   * ⚠️ ต้องผ่าน `navigateToUnitRequest` เท่านั้น — ตัวนั้นรู้เรื่อง prefix ของใบขอล่วงหน้า
   * (ประกอบ URL เองแล้วเปิดผิดบริษัท เคยเกิดจริง 18 ส.ค. 2569)
   * `returnTo` = หน้าบอร์ดพร้อมขั้นที่กรองอยู่ ⇒ ปุ่มย้อนกลับพากลับมาที่เดิมเป๊ะ
   */
  const openUnit = React.useCallback(
    (job: JobRequest, tab?: UnitRequestTabName) => {
      navigateToUnitRequest(job, navigate, {
        tab,
        returnTo: `${window.location.pathname}${window.location.search}`,
      });
    },
    [navigate],
  );
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
  const staffOnlyFilterProps = isStaff
    ? {
        recruiterFilter: filters.recruiterFilter,
        onRecruiterFilterChange: filters.setRecruiterFilter,
        recruiterOptions: filters.recruiterOptions,
        contractTypeFilter: filters.contractTypeFilter,
        onContractTypeFilterChange: filters.setContractTypeFilter,
        contractTypeOptions: filters.contractTypeOptions,
      }
    : {};

  // จำนวนผู้สมัครต่อใบ (เจ้าหน้าที่) — ประกาศตรงนี้เพราะการเรียงการ์ดข้างล่างต้องใช้
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});
  /** แยกยอดตามที่มาต่อใบขอ — "AI หามากี่คน สมัครใหม่กี่คน" (เจ้าของสั่ง 16 ส.ค. 2569) */
  const [originCounts, setOriginCounts] = useState<
    Record<string, Partial<Record<ApplicationOrigin, number>>>
  >({});
  /** ยอด Lead แยกต่างหาก — ใบที่ปัดเข้าคลังไม่ถูกนับใน applicantCounts (17 ส.ค. 2569) */
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
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

  const [bulkReleaseBusy, setBulkReleaseBusy] = useState(false);
  /**
   * ป๊อปยืนยันก่อนปล่อยเป็นชุด (แผนแก้จุดงงข้อ 3 · เจ้าของเคาะ 2 ก.ย. 2569)
   * Haiku ทดสอบแล้วไม่กล้ากดปุ่มนี้เพราะ *"กดแล้วเกิดอะไรขึ้น?"* — กติกาก้อน C:
   * ปุ่มออกนอกบ้านต้องมีป๊อปยืนยันบอกว่าจะเกิดอะไรกี่ใบ
   */
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  /**
   * 🔴 **ปล่อย/ดึงลงทีละใบย้ายไปแท็บ "ประกาศ / ลิงก์สมัคร" ของใบขอแล้ว** (27 ส.ค. 2569)
   * หน้านี้เหลือเฉพาะ "ปล่อยทั้งหน้านี้" ที่ท้ายแถบเส้นทาง (ทำหลายใบพร้อมกัน)
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
  const legacyStage = searchParams.get('stage');

  const doneLane = useMemo<ClosedBoxKey | null>(() => {
    const raw = laneParam ?? legacyStage;
    return raw === 'closed' || raw === 'cancelled' ? raw : null;
  }, [laneParam, legacyStage]);

  const lane = useMemo<ReleaseLaneKey | null>(
    () => (laneParam === 'released' || laneParam === 'unreleased' ? laneParam : null),
    [laneParam],
  );
  const step = useMemo<ReleaseStepKey | null>(
    () =>
      (RELEASE_STEP_ORDER as readonly string[]).includes(stepParam ?? '')
        ? (stepParam as ReleaseStepKey)
        : null,
    [stepParam],
  );

  /** เขียนเลน/ขั้นลง URL — 🔴 เปลี่ยนเลนต้องล้างขั้นทิ้ง ไม่งั้นกรองสองชั้นแล้วได้ 0 ใบ */
  const setSelection = React.useCallback(
    (next: { lane?: ReleaseLaneKey | ClosedBoxKey | null; step?: ReleaseStepKey | null }) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.delete('stage'); // ลิงก์เก่าถูกแปลงแล้ว ไม่ต้องค้างไว้
        if ('lane' in next) {
          if (next.lane) params.set('lane', next.lane);
          else params.delete('lane');
          if (!('step' in next)) params.delete('step');
        }
        if ('step' in next) {
          if (next.step) params.set('step', next.step);
          else params.delete('step');
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
  const leadIdx = useMemo(() => buildCountIndex(leadCounts), [leadCounts]);
  const originIdx = useMemo(
    () => buildJobKeyIndex(Object.entries(originCounts)),
    [originCounts],
  );
  const postingsReady = postings.length > 0;

  const boxCounts = useMemo(() => countOpenBoxes(filters.filtered), [filters.filtered]);
  /** ชุดใบปิด/ยกเลิกหลังผ่าน**ตัวกรองชุดเดียวกับใบเปิด** (จังหวัด/ตำแหน่ง/คำค้น/…) */
  const closedFiltered = useMemo(
    () => (isStaff ? filters.filterRows(closedJobs ?? []) : []),
    [isStaff, filters, closedJobs],
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
    () => countOpenBoxPositions(filters.filtered, jobPositionUnits),
    [filters.filtered],
  );
  const filteredPositions = useMemo(
    () => sumJobPositionUnits(filters.filtered),
    [filters.filtered],
  );
  /**
   * การ์ดที่จะโชว์ — กล่องปิดแล้ว/ยกเลิกใช้ชุดใบปิด · กล่องอื่นใช้ชุดใบเปิด
   * ⚠️ ทั้งสองเส้นผ่านตัวกรองเดียวกันมาแล้ว จึงกรอง "ในหน้าเดิม" ได้เหมือนกันหมด
   */
  const boxedJobs = useMemo(
    () => (closedBox ? closedBoxCounts[closedBox] : filterByOpenBox(filters.filtered, openBoxKey)),
    [closedBox, closedBoxCounts, filters.filtered, openBoxKey],
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
  const stages = useMemo(
    () =>
      isStaff
        ? buildBoardStages(filters.filtered, stageFacts, {
            closed: closedBoxCounts.closed.length,
            cancelled: closedBoxCounts.cancelled.length,
          })
        : null,
    [isStaff, filters.filtered, stageFacts, closedBoxCounts],
  );

  /**
   * ── เลขบนหัวหน้าจอ (ตรรกะอยู่ `lib/boardRelease` มีเทสต์คุมว่าบวกลงตัว) ──
   * 🔴 นับจาก `filters.filtered` = ใบเปิดหลังตัวกรองบนจอ **ก่อน**กรองเลน/ขั้น
   * ไม่งั้นกดเลนปุ๊บเลขเลนอื่นกลายเป็นของกลุ่มที่กรอง แล้วเทียบข้ามเลนไม่ได้อีก
   */
  const releaseFacts: ReleaseFacts = stageFacts;
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
  const ledger = useMemo(
    () => buildReleaseLedger(filters.filtered, releaseFacts),
    [filters.filtered, releaseFacts],
  );
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
    /** ขั้นมีได้แค่ในเลน "เหลือปล่อย" ⇒ มี `step` ก็พอ ไม่ต้องรอ `lane` (กัน URL พิมพ์มือ) */
    if (step) return filterByReleaseStep(filters.filtered, releaseFacts, step);
    if (lane) return filterByReleaseLane(filters.filtered, releaseFacts, lane);
    return boxedJobs;
  }, [doneLane, ledgerReady, lane, step, closedBoxCounts, filters.filtered, releaseFacts, boxedJobs]);

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
    return [...flowJobs].sort((a, b) => {
      const byAge = compareJobsByAgeDaysDesc(a, b, today);
      if (byAge !== 0) return byAge;
      return hasApplicants(a.id) - hasApplicants(b.id);
    });
  }, [flowJobs, applicantIdx, closedBox]);
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
   * 🔴 **ใบที่ "ปล่อยได้จริง" = เลน "เหลือปล่อย" เท่านั้น** (แก้ 27 ส.ค. 2569 รอบสี่)
   *
   * ของเดิมนับ `ใบเปิดทั้งหมด − ที่ปล่อยแล้ว` ⇒ วัดบนจอจริงได้ **127** ทั้งที่
   * เหลือปล่อยจริง **104** · ส่วนต่าง 23 ใบคือใบที่ ERP พาไปคัดเลือก/เริ่มงานแล้ว
   * แต่เราไม่เคยกดปล่อย ⇒ ปุ่มเดิมจะไปปล่อยประกาศหาคนของตำแหน่งที่มีคนทำอยู่แล้ว
   * (เจอตอนต่อหัวหน้าจอใหม่แล้วเลขสองที่ไม่ตรงกัน — นี่คือประโยชน์ของ "เลขต้องกระทบยอด")
   */
  const releasableJobs = useMemo(
    () => releasableJobsOf(boxedJobs, releaseFacts),
    [boxedJobs, releaseFacts],
  );
  const unreleasedCount = releasableJobs.length;

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

  /**
   * ปล่อยใบที่ยังไม่ปล่อยในชุดที่กรองอยู่ (เครื่องมือวันเปลี่ยนผ่าน)
   * ⚠️ เพดาน 300 ใบต่อครั้งตรงกับฝั่ง server — กดซ้ำได้จนหมด
   */
  const bulkReleaseVisible = async () => {
    /** 🔴 ชุดเดียวกับเลขบนปุ่มเป๊ะ — ห้ามคำนวณคนละที่ (เคยเพี้ยน 23 ใบ) */
    const ids = releasableJobs.map((j) => j.id).slice(0, 300);
    if (ids.length === 0) return;
    setBulkConfirmOpen(false);
    setBulkReleaseBusy(true);
    try {
      await releaseJobsToPublic(ids, 'ปล่อยเป็นชุดจากบอร์ดรับสมัคร');
      await loadReleases();
    } catch {
      /* ทะเบียนไม่เปลี่ยน = ตัวเลขบนแถบยังเป็นของเดิม */
    } finally {
      setBulkReleaseBusy(false);
    }
  };

  /** คำบอกว่ากำลังดูอะไรอยู่ — 🔴 ป้ายทุกอันมาจาก lib ห้ามพิมพ์เอง */
  const selectionLabel = useMemo(() => {
    if (doneLane) return JOB_BOX_LABEL[doneLane];
    if (step) {
      const st = RELEASE_STEP_TEXT[step];
      return `${RELEASE_LANE_TEXT.unreleased.label} · ขั้น ${st.step} ${st.label}`;
    }
    return lane ? RELEASE_LANE_TEXT[lane].label : null;
  }, [doneLane, lane, step]);

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
  }, [lane, step, doneLane]);

  // เปลี่ยนตัวกรองแล้วจำนวนผลลด — กันค้างอยู่หน้าที่หายไป
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyJob, setApplyJob] = useState<JobRequest | null>(null);

  const openApply = (job: JobRequest | null = null) => {
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
      })
      .catch(() => {
        /* badge is optional — ignore */
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

  return (
    <div className="relative bg-gradient-to-b from-blue-100/35 via-blue-50/10 to-transparent">

      <div className="relative mx-auto max-w-6xl px-4 md:px-6 pt-8 pb-6 md:pt-12 md:pb-10">
        {/* ฝั่งเจ้าหน้าที่ = hero เข้มตาม mockup rev.3 ข้อ 04 · ฝั่งคนนอกคงหัวสว่างเดิมไว้ (หน้าแบรนด์) */}
        {isStaff ? (
          <PageHeroStrip
            eyebrow="บอร์ดรับสมัคร · เจ้าหน้าที่"
            /* 🔴 หน้านี้รับสองขั้นของสายพาน (ประกาศรับ / ผู้สมัคร) ต่างกันที่ `?view=`
               ⇒ ชื่อหัวต้องเปลี่ยนตามมุมมอง ไม่งั้นกดเมนูคนละขั้นแล้วเจอหัวเดียวกัน
               คนใหม่จะไม่แน่ใจว่ามาถูกหน้าหรือเปล่า (audit 26 ส.ค. 2569)
               ชื่อมาจาก `conveyorLabel` ที่เดียวกับเมนู ห้ามพิมพ์เอง */
            title={
              /* หน้าเดียวสามมุมมอง — หัวต้องตรงกับเมนูที่พามา (กล่องงานมีชื่อ
                 ของตัวเองในเมนูคลังข้อมูลแล้ว 27 ส.ค. 2569 — เดิมยืมชื่อ "ผู้สมัคร") */
              view === 'postings'
                ? conveyorLabel('postings')
                : view === 'board'
                  ? 'กล่องงาน'
                  : conveyorLabel('applicants')
            }
            /* 🔴 บอกหน่วยให้ครบทั้ง "ใบขอ" และ "อัตรา" — เดิมเขียน "292 ตำแหน่ง" ทั้งที่ 292
               คือจำนวน**ใบ** ทำให้เอาไปเทียบกับ Dashboard (340 อัตรา) แล้วสรุปว่าใบขอหาย */
            /* 🔴 ตัวเลขยังบอกไม่ได้ (กำลังโหลด/พัง/ไม่มีสิทธิ์) = **ไม่พิมพ์อะไรเลย**
               เดิมเช็คแค่ `loading` ⇒ ตอนเส้นข้อมูลพังจะขึ้น "0 ใบขอ · 0 อัตรา"
               ซึ่งเป็นเลขปลอมที่ดูเหมือนจริง (31 ส.ค. 2569) */
            meta={
              !ledgerReady
                ? undefined
                : `· ${filters.visibleCount.toLocaleString('th-TH')} ใบขอ · ${filters.visiblePositions.toLocaleString('th-TH')} อัตรา`
            }
            actions={
              <>
                {/* ค้นหาอยู่ในแถบหัวเดียวกับชื่อหน้า+ปุ่ม แบบหน้า Dashboard
                    (เจ้าของสั่ง 13 ส.ค. 2569: "ย้ายไปด้านบนแบบของหน้า Dashboard")
                    — เดิมอยู่ใต้แผงตัวเลข 9 ช่อง ต้องกวาดตาลงไปหา
                    ⚠️ เฉพาะมุมมอง "กล่องงาน" — แท็บอื่น (รายชื่อ/ติดต่อ/นัดหมาย) มีช่องค้นหา
                    ของตัวเองใน RmWorkspace ถ้าโชว์ตัวนี้ด้วยจะมีสองช่องที่ค้นคนละเรื่อง */}
                {view === 'board' ? (
                  <SearchField
                    compact
                    placeholder={searchPlaceholder}
                    value={filters.search}
                    onChange={(e) => filters.setSearch(e.target.value)}
                    wrapperClassName="w-full min-w-0 sm:w-72 lg:w-80"
                  />
                ) : null}
                {/* งานระดับตั้งค่าของบอร์ด — จัดการช่องทาง + สร้างประกาศลอย + เหตุผล
                    ⚠️ **เฉพาะมุมมอง "กล่องงาน"** (เจ้าของสั่ง 13 ส.ค. 2569:
                    "นอกจากหน้ากล่องงาน หน้าอื่นไม่ต้องมี") — ทั้งสามปุ่มทำงานกับ
                    ประกาศ/ช่องทางรับสมัคร ซึ่งเป็นเรื่องของฝั่งใบขอ ไม่ใช่ของรายชื่อคน */}
                {view === 'board' ? (
                  <RecruitBoardTools
                    variant="onDark"
                    /* Pre-Check ย้ายมาอยู่ในเมนูนี้ (20 ส.ค. 2569) — เดิมลอยเดี่ยวกลางหน้า */
                    extraMenuItems={[
                      {
                        key: 'preCheck',
                        label: 'Pre-Check (ตรวจใบขอก่อนหาคน)',
                        icon: ClipboardCheck,
                        onSelect: () => navigate('/matching/pre-check'),
                      },
                    ]}
                  />
                ) : null}
                {/* ปุ่มรีเฟรชนี้โหลด feed **ใบขอ** ใหม่ — แท็บอื่นแสดงรายชื่อคนคนละชุด
                    และมีปุ่มรีเฟรชของตัวเองใน RmWorkspace อยู่แล้ว */}
                {onRefresh && view === 'board' ? (
                  <button
                    type="button"
                    onClick={() => void onRefresh()}
                    disabled={loading || refreshing}
                    className={cn(heroButton, 'disabled:opacity-50')}
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                    รีเฟรชข้อมูล
                  </button>
                ) : null}
              </>
            }
          />
        ) : (
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl min-w-0">
              {/* เจ้าของเคาะ 18 ส.ค. 2569: **ยังไม่เอาโลโก้** — กลับมาใช้หัวข้อข้อความล้วน
                  (เคยลองเปลี่ยนเป็นโลโก้ + ลายน้ำ แต่ไฟล์โลโก้ตัวจริงยังไม่มีในโปรเจกต์
                  ถ้าจะเอากลับ ดู docs/LOGO-SO.md) */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight">
                ค้นหางานที่เหมาะกับคุณ
              </h1>
              <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl">
                เลือกตำแหน่งที่สนใจ แล้วกรอกใบสมัครได้ทันที{' '}
                <span className="font-medium text-foreground">ทีมสรรหาจะติดต่อกลับ</span>
              </p>
            </div>
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
        {isStaff && onViewChange ? (
          <div className="mt-6 flex flex-wrap items-center gap-1 border-b border-border/60">
            {(
              [
                { id: 'board', label: 'กล่องงาน' },
                { id: 'list', label: 'รายชื่อผู้สมัคร' },
                { id: 'contact', label: 'การโทรของฉัน' },
                { id: 'appointments', label: 'ติดตามนัดหมาย' },
                // ย้ายมาจากเมนู Matching (เจ้าของสั่ง 17 ส.ค. 2569) — ใบขอที่หาคนของเรา
                // ไม่ได้ ต้องให้ทีมคอนเทนต์รับไปโพสต่อ เป็นงานที่เกิดต่อจากกล่องงานโดยตรง
                { id: 'postings', label: 'คำขอโพสต์งานใหม่' },
                // ⚠️ **ไม่มี "ปิดแล้ว"/"ยกเลิก" บนแท็บแล้ว** (เจ้าของสั่ง 19 ส.ค. 2569:
                // *"มันมีด้านล่างแล้วไงตรงนี้อะ"*) — เป็นกล่องสถานะข้างล่างที่กดแล้ว
                // กรองในหน้าเดิม · ลิงก์เก่า ?view=closed/cancelled แปลงเป็นกล่องให้แล้ว
              ] as const
            ).map((v) => {
              const active = view === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onViewChange(v.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'px-4 py-2.5 text-sm font-semibold transition-colors',
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
        ) : null}

        {/* ภาพรวมงานสรรหา — เฉพาะแท็บรายชื่อผู้สมัคร · อยู่ **ใต้** tab bar (เจ้าของสั่ง
            14 ส.ค. 2569) เพื่อให้ tab bar อยู่ position เดียวกับหน้ากล่องงาน
            "ภาพรวมงานสรรหา อยู่แค่หน้ารายชื่อผู้สมัครก็พอ" (13 ส.ค.) — คงเงื่อนไข view==='list' */}
        {isStaff && view === 'list' ? (
          <div className="mt-4">
            {/* Dashboard ศูนย์คุมงานสรรหา (S6 · 15 ส.ค. 2569) — แทนแผงภาพรวมเดิม
                แผงเดิมยังเป็นทางถอยข้างใน (?panel=classic หรือ endpoint พัง) */}
            <RecruitControlPanel />
          </div>
        ) : null}

        {/* มุมมองฝั่ง RM (รายชื่อผู้สมัคร/การติดต่อ/ติดตามนัดหมาย) — แทนที่ก้อน
            กล่องลอย+ตัวกรอง+การ์ดทั้งหมด · hero + แผงภาพรวมข้างบนคงอยู่ทุกมุมมอง */}
        {isStaff && view !== 'board' && listContent ? (
          <div className="mt-4 pb-10">{listContent}</div>
        ) : (
          <>
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
          {...staffOnlyFilterProps}
          loading={loading}
          searchPlaceholder={searchPlaceholder}
          hideSearch={isStaff}
          /* ฝั่งเจ้าหน้าที่: แถบบรรทัดเดียว + ป้ายทองยุบเข้ามาในแถบ (คืนที่ ~84px ให้การ์ด)
             /apply ไม่ส่ง prop → การ์ด frost เดิมทุกพิกเซล */
          variant={isStaff ? 'bar' : 'card'}
          eyebrow={isStaff ? (closedBox ? JOB_BOX_LABEL[closedBox] : 'ประกาศจากใบขอ') : undefined}
          /* 🔴 เหตุผลเดียวกับ meta ข้างบน — พังแล้วห้ามขึ้น "พบ 0 ใบขอ" */
          resultCount={!ledgerReady ? undefined : boxedJobs.length}
          totalCount={
            !ledgerReady
              ? undefined
              : closedBox
                ? filterByClosedBox(closedJobs ?? [], closedBox).length
                : filters.visibleCount
          }
          /* เจ้าหน้าที่: เลขนี้คือจำนวน**ใบขอ** + บอกอัตราต่อท้ายให้เทียบกับ Dashboard ได้
             สาธารณะ: คงคำว่า "ตำแหน่ง" เดิม (คนนอกไม่ได้ดูหน่วยอัตราของ ERP) */
          countUnitLabel={isStaff ? 'ใบขอ' : undefined}
          positionsNote={
            isStaff && ledgerReady
              ? `${sumJobPositionUnits(boxedJobs).toLocaleString('th-TH')} อัตรา${closedBox ? '' : 'ที่ยังต้องหา'}`
              : undefined
          }
        />

        {/* ── หัวหน้าจอ = "ปล่อยไปแล้วเท่าไหร่ เหลืออีกเท่าไหร่" ──
            เจ้าของสั่งรื้อรอบสี่ 27 ส.ค. 2569: *"ฉันอยากเปิดมาแล้วรู้ว่า อ้อ ตอนนี้มีใบขอ
            เท่านี้นะ เราปล่อยไปหน้าสาธารณะเท่านี้แล้วนะ เหลืออีกเท่านี้นะ แล้วพอจะปล่อย
            ก็ไปกดดูแล้วก็ตามขั้นตอน 1 2 3 4 แล้วก็ปล่อยไป"*

            🔴 **เส้น 9 ขั้นไม่ได้ถูกทิ้ง** — ปลายเส้น (คัดเลือก/รอแจ้งเข้า/เริ่มแล้ว)
            ย้ายไปอยู่ใต้เลน "ไม่ต้องปล่อย" ซึ่งเป็นเจ้าของขั้นพวกนั้นจริง ๆ ·
            ต้นเส้น (รอตรวจ/รอปล่อย) กลายเป็นขั้น 1-4 ของเลน "เหลือปล่อย"
            ⚠️ staff เท่านั้น — หน้าสมัครสาธารณะใช้ component ตัวเดียวกันนี้ */}
        {isStaff && view === 'board' ? (
          <div className="mt-3 space-y-2">
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
              step={step}
              /* 🔴 กดขั้น = เข้าเลน "เหลือปล่อย" ด้วยเสมอ — ขั้นมีอยู่ในเลนนั้นเท่านั้น
                 (ขั้นโชว์ตั้งแต่เปิดหน้าโดยยังไม่ได้เลือกเลน ถ้าไม่ตั้งเลนให้ กดแล้วจะไม่กรองอะไร) */
              onStepChange={(next) =>
                setSelection(next ? { lane: 'unreleased', step: next } : { lane: null, step: null })
              }
              doneCounts={{
                closed: closedBoxCounts.closed.length,
                cancelled: closedBoxCounts.cancelled.length,
              }}
              doneLane={doneLane}
              onDoneLaneChange={(next) => setSelection({ lane: next })}
              action={
                /* ปุ่มลงมือของเลน "เหลือปล่อย" — ปล่อยใบที่ยังไม่ปล่อย **ในชุดที่กรองอยู่**
                   ⚠️ เพดาน 300 ใบต่อครั้งตรงกับฝั่ง server · กดซ้ำได้จนหมด */
                /**
                 * 🔴 ตัวเลขยังไม่พร้อม = **ปุ่มต้องหาย** ไม่ใช่โผล่พร้อมเลขที่เดาเอา
                 * (หนี้ Redteam ข้อ 2 — เดิมทะเบียนโหลดล้มแล้วยังโชว์ปุ่มอยู่)
                 * ⚠️ ตอนนี้หัวจอ return ก่อนตั้งแต่ยังไม่ ready อยู่แล้ว แต่กันไว้อีกชั้น
                 * เผื่อวันหน้ามีคนย้ายปุ่มออกไปไว้นอกหัวจอ
                 */
                ledgerReady && unreleasedCount > 0 ? (
                  <button
                    type="button"
                    disabled={bulkReleaseBusy}
                    /* กดแล้ว **ยังไม่ยิง** — เปิดป๊อปยืนยันก่อนเสมอ (ของจริงขึ้นหน้าสาธารณะ) */
                    onClick={() => setBulkConfirmOpen(true)}
                    /* 🔴 เลขบนปุ่ม **น้อยกว่า** "ยังไม่ปล่อย" บนหัว เพราะตัดใบที่ ERP
                       พาไปเริ่มงานแล้วออก — ประกาศหาคนของตำแหน่งที่มีคนทำอยู่ไม่มีประโยชน์
                       ⚠️ ต้องเขียนบอกไว้ ไม่งั้นคนเห็นเลขสองที่ไม่ตรงแล้วไม่เชื่อทั้งคู่ */
                    title={`ส่งประกาศใบที่ยังต้องหาคนและยังไม่ปล่อย ${Math.min(unreleasedCount, 300)} ใบ ขึ้นหน้าสมัครงานสาธารณะ — เลขนี้น้อยกว่า "ยังไม่ปล่อย" เพราะตัดใบที่มีคนเริ่มงานแล้วออก`}
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50',
                      TONE.success.outline,
                    )}
                  >
                    {bulkReleaseBusy
                      ? 'กำลังปล่อย…'
                      : `ส่งประกาศทีเดียว ${Math.min(unreleasedCount, 300)} ใบที่ยังต้องหาคน`}
                  </button>
                ) : null
              }
            />

            {/* 🔴 **แถบ "กำลังดูอะไรอยู่"** (แก้ 27 ส.ค. 2569)
                โมเดลที่มาลองเล่นสรุปว่า *"กดเลขแล้วมันแค่ขยายบอกความหมาย ไม่ได้เปลี่ยนหน้าไป"*
                — คือ **ไม่เห็นว่าการ์ดข้างล่างถูกกรอง** เพราะการ์ดอยู่ต่ำกว่าขอบจอ
                ⇒ ต้องมีแถบสีบอกชัด + ปุ่มล้าง + เลื่อนจอไปที่การ์ดให้เห็นว่ามันเปลี่ยน */}
            {ledgerReady && selectionLabel ? (
              <div
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2',
                  TONE.primary.soft,
                )}
              >
                <p className="text-[11px] font-semibold text-foreground">
                  กำลังดู: {selectionLabel} — {flowJobs.length.toLocaleString('th-TH')} ใบข้างล่าง
                </p>
                <button
                  type="button"
                  onClick={() => setSelection({ lane: null, step: null })}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-semibold',
                    TONE.neutral.outline,
                  )}
                >
                  ล้างตัวกรอง — ดูทั้งหมด
                </button>
              </div>
            ) : null}

            {/* ช่วงวันที่ของชุดใบปิด/ยกเลิก — โผล่เฉพาะตอนเลือกสองกล่องนั้น
                ⚠️ **ต้องมีช่วงวันที่เสมอ** ใบปิดสะสมย้อนหลังหลายปี ดึงหมดคือรอเป็นนาที */}
            {closedBox ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2 text-xs">
                <span className="font-semibold text-foreground">ปิดภายใน</span>
                <div className="flex flex-wrap items-center gap-1">
                  {CLOSED_RANGE_OPTIONS.map((r) => (
                    <Button
                      key={r.days}
                      type="button"
                      size="sm"
                      variant={closedDays === r.days ? 'default' : 'outline'}
                      onClick={() => onClosedDaysChange?.(r.days)}
                      className={cn(
                        'h-7 rounded-lg px-2.5 text-xs',
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
                  className={cn('h-7 rounded-lg px-2.5 text-xs', TONE.neutral.outline)}
                >
                  {closedLoading ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  รีเฟรช
                </Button>
                {closedError ? (
                  <span className="text-destructive">{closedError}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

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
            ⚠️ **ปุ่ม "ปล่อยทั้งหน้านี้" ไม่ได้หายไป** — ย้ายไปอยู่ท้ายแถบเส้นทางแล้ว */}

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
        <div ref={cardListRef} className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleJobs.map((job) => (
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
                'group jarvis-interactive-card flex h-full flex-col overflow-hidden rounded-2xl border-white/70 transition-all duration-300 hover:border-blue-300/40',
                'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              )}
            >
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {/* ป้ายใบขอชั่วคราว (17 ส.ค. 2569 · เปลี่ยนคำ 19 ส.ค.) — ต้องรู้ตั้งแต่แรกเห็น
                        ว่ายังไม่ใช่ใบจริง เพราะยังไม่การันตีว่าจะเปิดงาน (หาคนล่วงหน้าได้ แต่อย่าไปสัญญา) */}
                    <PrequestBadge job={job} className="mb-1" />
                    <h2 className="text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {jobBoardCardTitle(job)}
                    </h2>
                    {/* ตำแหน่งงานอยู่ใต้ชื่อไซต์ทันที + ไฮไลต์สี (เจ้าของสั่ง 17 ส.ค. 2569:
                        *"ตำแหน่งงานอยู่ใต้ Site งาน และขอไฮไลสีด้วย"*)
                        เดิมตำแหน่งเป็นชิปเทา ๆ ปนอยู่แถวล่างกับประเภทงาน กวาดตาหาไม่เจอ
                        ทั้งที่เป็นคำที่คนใช้ตัดสินใจมากที่สุดบนการ์ด */}
                    <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-blue-700 dark:text-blue-300">
                      {publicJobPositionLabel(job)}
                    </p>
                    {/* บรรทัดรอง: ตัดตำแหน่งที่ซ้ำกับบรรทัดสีน้ำเงินข้างบนออก (เดิมพิมพ์ซ้ำทุกใบ) */}
                    <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
                      {jobBoardCardSubtitle(job) || EM_DASH}
                    </p>
                    {/* เลขที่ใบขอโชว์เฉพาะเจ้าหน้าที่ (หน้าสมัครสาธารณะไม่ต้องเห็น จึงไม่จองที่)
                        แต่ในฝั่งเจ้าหน้าที่ต้องมีที่ยืนทุกใบ ไม่งั้นแถวล่างเลื่อนไม่ตรงกัน */}
                    {isStaff ? (
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="font-mono text-[11px] leading-4 text-muted-foreground/80">
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
                                'shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
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
                            <div className="mt-2" title={releaseProgressTitle(progress)}>
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
                      <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
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
                          ? 'สถานะนี้แปลว่าได้ตัวคนแล้ว — ประกาศจึงไม่ขึ้นหน้าสาธารณะ (เปลี่ยนสถานะแล้วประกาศกลับมาเอง)'
                          : 'สถานะงานที่เจ้าหน้าที่ตั้งไว้'
                      }
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
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
                  {job.job_description_code_1 && job.job_type ? (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {JOB_TYPE_LABELS[job.job_type]}
                    </span>
                  ) : (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {jobSectorLabel(job)}
                    </span>
                  )}
                </div>
              </CardHeader>
              {/* flex-1: ดูดพื้นที่เหลือของกล่องไว้ที่นี่ ให้ footer ถูกตรึงก้นการ์ด
                  ความแปรผันของเนื้อด้านบน (ชิปช่องทางที่หายทั้งบล็อกในบางใบ ฯลฯ)
                  จึงไม่ทำให้แถบ "ผู้สมัคร N คน" ของแต่ละใบอยู่คนละระดับอีก */}
              <CardContent className="flex-1 space-y-2 pb-4">
                <p className="flex items-start gap-2 text-xs leading-4 text-muted-foreground line-clamp-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600/70" />
                  {/* ข้อความสำรองแบบเดียวกับการ์ดกล่องลอย ('ไม่ได้ระบุจังหวัด') —
                      คำที่ผู้สมัครทั่วไปอ่านรู้เรื่อง เพราะโผล่บนหน้าสมัครสาธารณะด้วย */}
                  {job.location_address?.trim() || 'ไม่ได้ระบุสถานที่'}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {/* ยอดรายเดือน = ค่าแรงหลัก + รายได้มั่นคง (เจ้าของสั่ง 16 ส.ค. 2569)
                      ⚠️ ถอยไป total_income เมื่อคิดไม่ได้ — แต่ตัวนั้นบางใบเป็น**อัตรารายวัน**
                      (410 = ค่าแรง/วัน · 20 จาก 200 ใบ) จึงไม่ติดคำว่า "/เดือน" ให้ */}
                  <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                    <Banknote className="h-3.5 w-3.5 text-success" />
                    {/* breakdown ที่เจ้าหน้าที่ตั้งเองมาก่อนเสมอ — บอกหน่วยตามที่ตั้ง (วัน/เดือน) */}
                    {job.income_display
                      ? `฿${job.income_display.total.toLocaleString('th-TH')} ${INCOME_PERIOD_LABEL[job.income_display.period]}`
                      : job.monthly_income
                        ? `฿${job.monthly_income.toLocaleString('th-TH')} / เดือน`
                        : `฿${job.total_income.toLocaleString('th-TH')}`}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    ต้องการ {formatYmdDmyBe(job.required_date)}
                  </span>
                  {/* สัญชาติเจ้านาย (เจ้าของสั่ง 17 ส.ค. 2569 — เอาขึ้นทั้งกล่องงานและหน้าสาธารณะ)
                      ⚠️ ERP กรอกมาแค่ ~40% ของใบขอ · ไม่มีข้อมูล = ไม่ขึ้นบรรทัดนี้
                      ห้ามขึ้นว่า "ไม่ระบุ" — การ์ดนี้โผล่บนหน้าสมัครสาธารณะด้วย */}
                  {job.boss_nationality?.trim() ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
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
                {[...(job.benefits ?? []), ...benefitDisplayLabels(job.extra_benefits)].length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {[...(job.benefits ?? []), ...benefitDisplayLabels(job.extra_benefits)].map((b) => (
                      <span key={b} className={TONE.success.chip}>
                        {b}
                      </span>
                    ))}
                  </div>
                ) : null}
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
                      <span className={cn('self-start', TONE.success.chip)}>✓ ปล่อยลิงก์แล้ว</span>
                    ) : null}
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
                    <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                      <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-foreground">
                        <Users className={cn('h-3.5 w-3.5', TONE.info.value)} />
                        ผู้สมัคร {countFor(applicantIdx, job.id)} คน
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
                          className={cn('h-7 rounded-lg px-2 text-[11px]', TONE.success.outline)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {SEARCH_ALL_POOLS_AND_CALL.label}
                        </Button>
                          </>
                        )}
                        {/* ⚠️ **ไม่มีปุ่ม "ประกาศ / ลิงก์" บนการ์ด** — กดตัวการ์ดคือไปหน้านั้นแล้ว
                            (ใส่ปุ๊มซ้ำ = ปุ่มที่ทำงานเหมือนการกดกล่องที่มันอยู่ข้างใน) */}
                        {/* "ดูรายชื่อ" = **ไปแท็บผู้สมัครของใบขอ** ไม่ใช่ป๊อปอีกแล้ว
                            (เจ้าของสั่ง 27 ส.ค. 2569) — หน้านั้นมีตัวกรอง/ปุ่มลงมือครบกว่าป๊อป
                            ⚠️ stopPropagation — ไม่งั้นโดนคลิกของกล่องทับ */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openUnit(job, 'applicants');
                          }}
                          className={cn('h-7 rounded-lg px-2 text-[11px]', TONE.info.outline)}
                        >
                          <Users className="h-3.5 w-3.5" />
                          ดูรายชื่อ
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex w-full gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openApply(job);
                      }}
                      className="jarvis-pill-btn flex-1 py-2.5 text-xs font-semibold"
                    >
                      สมัครงาน
                      <Send className="h-3.5 w-3.5 opacity-90" />
                    </button>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* แถบเลขหน้า — ตัวเดียวกับหน้าหน่วยงาน/ผู้สมัคร เลือกจำนวนต่อหน้าได้ (20/40/60/100) */}
        {boxedJobs.length > 0 ? (
          <div className="pb-10 pt-4">
            <ListPaginationBar
              page={currentPage}
              pageSize={pageSize}
              totalItems={boxedJobs.length}
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
          <div className="mt-6">
            <p className={cn('mb-2 text-[11px] font-bold uppercase tracking-[0.14em]', TONE.warn.value)}>
              กล่องลอย (ไม่ผูกใบขอ)
            </p>
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
                      'group jarvis-interactive-card flex h-full flex-col overflow-hidden rounded-2xl border-white/70 transition-all duration-300 hover:border-blue-300/40',
                      'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                      s.postings === 0 && 'opacity-60',
                    )}
                  >
                    <CardHeader className="space-y-3 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-blue-600">
                            {k.label}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
                            {s.titles.length > 0 ? s.titles.join(' • ') : 'ยังไม่มีประกาศของประเภทนี้'}
                          </p>
                        </div>
                        <span className={cn('shrink-0', tone.chip)}>
                          {s.postings.toLocaleString('th-TH')} ประกาศ
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                          กล่องลอย
                        </span>
                        {s.bus.map((bu) => (
                          <span
                            key={bu}
                            className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {bu}
                          </span>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-2 pb-4">
                      <p className="flex items-start gap-2 text-xs leading-4 text-muted-foreground line-clamp-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600/70" />
                        {s.provinces.length > 0 ? s.provinces.join(' · ') : 'ไม่ได้ระบุจังหวัด'}
                      </p>
                    </CardContent>
                    <CardFooter className="mt-auto flex-col items-stretch gap-2 border-t border-border/60 bg-muted/20 pt-3">
                      {/* แถวล่างจัดแบบเดียวกับการ์ดใบขอ: "ผู้สมัคร N คน" ซ้าย · ปุ่มขวา
                          ⚠️ ไม่มีปุ่ม "ดูรายชื่อ" เพราะใบสมัครผูกกับ `job_id` ไม่ได้ผูกกับ
                          ประกาศ — กรองรายชื่อ "เฉพาะกล่องลอยประเภทนี้" ยังทำไม่ได้จริง
                          ใส่ไปก็เป็นปุ่มหลอก */}
                      <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                        <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-foreground">
                          <Users className={cn('h-3.5 w-3.5', TONE.info.value)} />
                          ผู้สมัคร {s.applicants.toLocaleString('th-TH')} คน
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold',
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
              <button
                type="button"
                onClick={() => openApply(null)}
                className="jarvis-pill-btn mt-5 inline-flex w-full justify-center px-8 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                กรอกใบสมัครงาน
                <Send className="h-4 w-4" />
              </button>
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
            setPostingsRev((n) => n + 1);
          }
        }}
      >
        <DialogContent className="flex max-h-[min(92dvh,860px)] w-[min(calc(100vw-1.25rem),40rem)] max-w-none flex-col gap-0 overflow-hidden border-border/80 p-0">
          <DialogHeader className="shrink-0 border-b border-border/50 px-5 pb-3 pt-5 text-left">
            <DialogTitle className="text-base font-semibold leading-snug sm:text-lg break-words">
              {postingJob ? jobBoardCardTitle(postingJob) : ''}
            </DialogTitle>
            <DialogDescription className="text-xs">
              ไล่งานประกาศของใบนี้ทีละขั้น — ปิดกล่องแล้วกลับมาที่กล่องงานเหมือนเดิม
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
            {postingJob ? (
              <React.Suspense
                fallback={<p className="py-6 text-center text-xs text-muted-foreground">กำลังโหลด…</p>}
              >
                <BoardPostingSteps
                  id={postingUnitId(postingJob)}
                  chrome={false}
                  onDone={() => {
                    setPostingJob(null);
                    void loadReleases();
                    setPostingsRev((n) => n + 1);
                  }}
                />
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

      {/* ═══ ป๊อปยืนยันปล่อยเป็นชุด (แผนแก้จุดงงข้อ 3 · 2 ก.ย. 2569) ═══
          ปุ่ม "ส่งประกาศทีเดียว" คือของออกนอกบ้าน — ต้องบอกก่อนว่าจะเกิดอะไร กี่ใบ
          ใครเห็น และมีทางถอย (Haiku ทดสอบ: ไม่กล้ากดเพราะไม่รู้ว่ากดแล้วเกิดอะไร) */}
      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ปล่อยประกาศ {Math.min(releasableJobs.length, 300).toLocaleString('th-TH')} ใบ ขึ้นหน้าสมัครงานสาธารณะ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1.5 text-left">
                <p>
                  ใบขอที่ยังต้องหาคนและยังไม่เคยปล่อย จะขึ้นหน้า /apply ให้
                  <b>คนนอกเห็นและกดสมัครได้ทันที</b>
                </p>
                <p>
                  เลขนี้น้อยกว่า &ldquo;ยังไม่ปล่อย&rdquo; บนหัว เพราะตัดใบที่มีคนเริ่มงานแล้วออก
                  {releasableJobs.length > 300 ? ' · เกิน 300 ใบ ระบบปล่อยครั้งละ 300 กดซ้ำได้จนหมด' : ''}
                </p>
                <p>ปล่อยแล้วดึงลงรายใบได้ที่การ์ดของใบนั้น</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยังก่อน</AlertDialogCancel>
            <AlertDialogAction onClick={() => void bulkReleaseVisible()}>
              ปล่อย {Math.min(releasableJobs.length, 300).toLocaleString('th-TH')} ใบเลย
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default JobBoardView;
