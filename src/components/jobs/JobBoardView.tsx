import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import { jobBoardCardTitle, unitRequestCardSubtitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { extractJobSubtypeLabel } from '@/lib/siamrajUnitFilters';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { EM_DASH, dashIfEmpty } from '@/lib/displayFallback';
import { inferProvinceFromAddress, inferSubdistrictFromAddress } from '@/lib/parseThaiJobAddress';
import { extraBenefitLabels } from '@/lib/extraBenefits';
import { displayDistrictLine } from '@/lib/displayJobLocation';
import { resolveApplyPositionPreset } from '@/lib/jobBoardPositionPreset';
import JobBoardTopFilters from '@/components/jobs/JobBoardTopFilters';
import PrequestBadge from '@/components/jobs/PrequestBadge';
import SearchField from '@/components/shared/SearchField';
import PublicApplyDialog from '@/components/jobs/PublicApplyDialog';
import JobApplicantsDialog from '@/components/jobs/JobApplicantsDialog';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';
/**
 * เลนสรรหา — lazy ตั้งใจ: ไฟล์นี้ใช้ร่วมกับหน้าสมัครสาธารณะ /apply
 * กล่องผลค้น (+ ตัวเรียก API หลังบ้าน) ต้องไม่ถูกลากเข้า bundle ฝั่ง public
 */
const EditPublicJobFieldsDialog = React.lazy(
  () => import('@/components/jobs/EditPublicJobFieldsDialog'),
);
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
import { TONE, type ToneKey } from '@/lib/designTokens';
import { useJobBoardFilters } from '@/hooks/useJobBoardFilters';
import { compareJobsByAgeDaysDesc } from '@/lib/jobUrgency';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { MapPin, Briefcase, Calendar, Banknote, RefreshCw, Send, Users, Link2, Pencil, Search, ClipboardCheck, Flag, EyeOff, LoaderCircle } from 'lucide-react';
import EditPostingDialog from '@/components/jobs/EditPostingDialog';
const RecruitLaneDialog = React.lazy(() => import('@/components/jobs/RecruitLaneDialog'));
import {
  isUnitRequestWorkStatus,
  UNIT_REQUEST_WORK_STATUS_LABELS,
} from '@/lib/unitRequestWorkStatus';
import { isHiddenFromPublicByWorkStatus } from '@/lib/publicJobVisibility';
import { cn } from '@/lib/utils';

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
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<JobRequest | null>(null);
  /**
   * แท็บในป๊อปอัปที่กดการ์ด (เจ้าของเคาะ 19 ส.ค. 2569 — เลือกแบบ "แท็บมีไอคอน 3 อัน ชิดขวา"):
   * **รายละเอียดงาน → แก้ไข → Gen link** · กดแล้ว**เนื้อกลางเปลี่ยนในป๊อปเดิม** ไม่เปลี่ยนหน้า
   * 🔴 ฟอร์มแก้ไข/Gen link ใช้ component ตัวเดิมในโหมด `embedded` (ห้ามก๊อปฟอร์มมาทำใหม่
   * และห้ามซ้อน Dialog ใน Dialog)
   */
  const [popupTab, setPopupTab] = useState<'detail' | 'edit' | 'genlink'>('detail');
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
  /** ใบที่กำลังแก้ข้อมูลประกาศ (จังหวัด/รายได้/สวัสดิการ) — 17 ส.ค. 2569 */
  /** ค่าที่เพิ่งแก้ — ทับบนการ์ดทันทีโดยไม่ต้องรีเฟรชทั้งบอร์ด */
  const [publicPatchById, setPublicPatchById] = useState<Record<string, Partial<JobRequest>>>({});

  // แบ่งหน้าการ์ดประกาศ — ใช้แถบเลขหน้ากลางของระบบ (เลือกจำนวนต่อหน้าได้เหมือนหน้าอื่น)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  /**
   * กล่องสถานะที่เลือกอยู่ (เจ้าของสั่ง 19 ส.ค. 2569) — null = ทั้งหมด
   * ⚠️ กรอง**หลัง**ตัวกรองปกติ (จังหวัด/ตำแหน่ง/ฯลฯ) — เลขบนกล่องจึงเป็น
   * "ในผลที่กรองอยู่ตอนนี้" ไม่ใช่ยอดทั้งระบบ ซึ่งตรงกับที่คนกำลังมองบนจอ
   */
  const [openBox, setOpenBox] = useState<JobBoxKey | null>(initialBox);
  /** กล่องปิดแล้ว/ยกเลิกที่เลือกอยู่ — null = กำลังดูชุดใบเปิด */
  const closedBox: ClosedBoxKey | null = openBox && isClosedBox(openBox) ? openBox : null;
  const openBoxKey: OpenBoxKey | null = openBox && !isClosedBox(openBox) ? openBox : null;
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
  const totalPages = getTotalPages(boxedJobs.length, pageSize);
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
    if (closedBox) return [...boxedJobs].sort(compareByClosedDateDesc);
    const today = new Date();
    const hasApplicants = (id: string) => ((applicantCounts[id] ?? 0) > 0 ? 0 : 1);
    return [...boxedJobs].sort((a, b) => {
      const byAge = compareJobsByAgeDaysDesc(a, b, today);
      if (byAge !== 0) return byAge;
      return hasApplicants(a.id) - hasApplicants(b.id);
    });
  }, [boxedJobs, applicantCounts, closedBox]);
  const visibleJobs = orderedJobs.slice(pageStart, pageStart + pageSize);

  // เปิดใบใหม่ = เริ่มที่แท็บรายละเอียดเสมอ ไม่ค้างแท็บของใบก่อน
  useEffect(() => {
    setPopupTab('detail');
  }, [selected?.id]);

  // เปลี่ยนกล่อง = กลับหน้าแรกเสมอ (ไม่งั้นค้างหน้า 5 ของกล่องเดิม)
  useEffect(() => {
    setPage(1);
  }, [openBox]);

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

  // เจ้าหน้าที่: กดการ์ดเพื่อดูผู้สมัครที่กรอกฟอร์มของงานนั้น
  // (state จำนวนผู้สมัครต่อใบย้ายไปประกาศไว้ข้างบน — การเรียงการ์ดต้องใช้ก่อนถึงตรงนี้)
  const [applicantsJob, setApplicantsJob] = useState<JobRequest | null>(null);
  const [laneJob, setLaneJob] = useState<JobRequest | null>(null);
  // เจ้าหน้าที่: สร้างลิงก์รับสมัครของงาน (Gen Link)
  /** ใบขอที่กำลังกด "หาคนเพิ่ม + ส่ง AI โทร" ของเลนสรรหา (R2b) */
  /** สร้างลิงก์ของกล่องลอย — กดจากการ์ดกล่องลอยตรง ๆ ไม่ต้องผ่านตัวเลือกประเภทอีกชั้น */
  const [genStandalone, setGenStandalone] = useState<
    { kind: string; kindLabel: string; departmentCode: string } | null
  >(null);
  // เจ้าหน้าที่: แก้เนื้อหาประกาศที่สร้างไว้แล้ว (mockup rev.3 ข้อ 04)
  // สาธารณะ: เปิดฟอร์มสมัครอัตโนมัติจาก deep link /apply?job=<id>
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  /**
   * ประกาศของบอร์ด (mockup rev.3 ข้อ 04) — ใช้ 2 ที่:
   * แถวกล่องลอย = รวมผู้สมัครต่อประเภทที่ไม่ผูกใบขอ · ชิปบนการ์ด = ช่องทางที่ปล่อยลิงก์ + ยอดคลิก
   * ล้มเหลวก็ปล่อยเงียบเหมือน applicantCounts — เป็นข้อมูลเสริม ไม่ใช่ตัวหลักของหน้า
   */
  const [postings, setPostings] = useState<Awaited<ReturnType<typeof fetchRecruitPostings>>>([]);
  /** บวกหนึ่งเพื่อสั่งโหลดประกาศใหม่ — ใช้หลังสร้าง/แก้ประกาศ ไม่งั้นชิปช่องทางกับปุ่มแก้ไขไม่อัปเดตจนรีเฟรชหน้า */
  const [postingsRev, setPostingsRev] = useState(0);

  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    fetchRecruitPostings()
      .then((p) => {
        if (!cancelled) setPostings(p);
      })
      .catch(() => {
        /* ข้อมูลเสริม — ไม่ต้องรบกวนคนใช้งาน */
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
  const latestPostingByJob = useMemo(() => {
    const map = new Map<string, RecruitPosting>();
    for (const p of postings) {
      if (!p.jobId || map.has(p.jobId)) continue;
      map.set(p.jobId, p);
    }
    return map;
  }, [postings]);

  /** ใบขอ → ช่องทางที่ปล่อยลิงก์ไว้ (รวมยอดคลิกของช่องทางเดียวกันเข้าด้วยกัน) */
  const channelsByJob = useMemo(() => {
    const map = new Map<string, { label: string; hits: number }[]>();
    for (const p of postings) {
      if (!p.jobId) continue;
      const acc = new Map<string, number>();
      for (const l of p.links) {
        const label = (l.channelLabel || 'ลิงก์กลาง').trim();
        acc.set(label, (acc.get(label) ?? 0) + (l.hitCount ?? 0));
      }
      const prev = map.get(p.jobId) ?? [];
      map.set(p.jobId, [...prev, ...[...acc].map(([label, hits]) => ({ label, hits }))]);
    }
    return map;
  }, [postings]);

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
            eyebrow="บอร์ดงานเปิดรับ · เจ้าหน้าที่"
            title="งานสรรหา"
            /* 🔴 บอกหน่วยให้ครบทั้ง "ใบขอ" และ "อัตรา" — เดิมเขียน "292 ตำแหน่ง" ทั้งที่ 292
               คือจำนวน**ใบ** ทำให้เอาไปเทียบกับ Dashboard (340 อัตรา) แล้วสรุปว่าใบขอหาย */
            meta={
              loading
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
                {view === 'board' ? <RecruitBoardTools variant="onDark" /> : null}
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
          resultCount={loading ? undefined : boxedJobs.length}
          totalCount={
            loading
              ? undefined
              : closedBox
                ? filterByClosedBox(closedJobs ?? [], closedBox).length
                : filters.visibleCount
          }
          /* เจ้าหน้าที่: เลขนี้คือจำนวน**ใบขอ** + บอกอัตราต่อท้ายให้เทียบกับ Dashboard ได้
             สาธารณะ: คงคำว่า "ตำแหน่ง" เดิม (คนนอกไม่ได้ดูหน่วยอัตราของ ERP) */
          countUnitLabel={isStaff ? 'ใบขอ' : undefined}
          positionsNote={
            isStaff && !loading
              ? `${sumJobPositionUnits(boxedJobs).toLocaleString('th-TH')} อัตรา${closedBox ? '' : 'ที่ยังต้องหา'}`
              : undefined
          }
        />

        {/* กล่องสถานะ (เจ้าของสั่ง 19 ส.ค. 2569: *"มีกล่องเพื่อดูข้อมูลได้หมดอะ"* +
            *"ทำเป็น visual ให้เห็นแบ่งสีแบ่งอะไรให้ชัดเจน"*)

            สีเรียงตามการเดินทางของงาน: ฟ้า = เพิ่งเริ่มหา → ม่วง = กำลังคัดคน →
            ส้ม = รอ → เขียว = ได้คนเริ่มงานแล้ว · เทา = จบแล้ว · แดง = ยกเลิก
            ⚠️ สีมาจาก `JOB_BOX_TONE` → `designTokens` ที่เดียว ห้ามเขียน class สีสดตรงนี้
            ⚠️ staff เท่านั้น — หน้าสมัครสาธารณะใช้ component ตัวเดียวกันนี้ */}
        {isStaff && view === 'board' ? (
          <div className="mt-3 space-y-2">
            <div className="overflow-x-auto pb-1">
              <div className="inline-flex w-max items-stretch gap-2">
                {/* ทั้งหมด — ไม่มีสีประจำ ใช้เป็นตัวล้างตัวกรอง */}
                <button
                  type="button"
                  onClick={() => setOpenBox(null)}
                  className={cn(
                    'min-w-[7rem] rounded-xl border-2 px-3 py-2 text-left transition-colors',
                    openBox === null
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent bg-secondary/60 hover:bg-secondary',
                  )}
                >
                  <span className="block whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
                    ทั้งหมด
                  </span>
                  <span className="block text-2xl font-bold leading-tight tabular-nums text-foreground">
                    {filters.filtered.length.toLocaleString('th-TH')}
                    <span className="ml-1 text-[11px] font-semibold text-muted-foreground">ใบขอ</span>
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {filteredPositions.toLocaleString('th-TH')} อัตราที่ยังต้องหา
                  </span>
                </button>

                {OPEN_BOX_KEYS.map((key) => {
                  const tone = TONE[JOB_BOX_TONE[key]];
                  const active = openBox === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setOpenBox((prev) => (prev === key ? null : key))}
                      aria-pressed={active}
                      className={cn(
                        'min-w-[9rem] rounded-xl border-2 px-3 py-2 text-left transition-colors',
                        tone.soft,
                        tone.softHover,
                        active ? 'border-primary' : 'border-transparent',
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
                        <span className="truncate whitespace-nowrap text-[11px] font-semibold text-foreground">
                          {JOB_BOX_LABEL[key]}
                        </span>
                      </span>
                      <span className={cn('block text-2xl font-bold leading-tight tabular-nums', tone.num)}>
                        {boxCounts[key].toLocaleString('th-TH')}
                        <span className="ml-1 text-[11px] font-semibold text-muted-foreground">
                          ใบขอ · {boxPositions[key].toLocaleString('th-TH')} อัตรา
                        </span>
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {JOB_BOX_HINT[key]}
                      </span>
                    </button>
                  );
                })}

                {/* เส้นคั่น — ของสองกล่องขวามาจากอีก feed (ใบที่หลุดจากกล่องงานไปแล้ว)
                    แต่**กดแล้วกรองในหน้าเดิมเหมือนกล่องอื่นทุกกล่อง** (เจ้าของสั่ง 19 ส.ค. 2569:
                    *"กดแล้วเด้งไปหน้าอื่นทำไม ทำไมไม่ทำให้มันเหมือนกัน"*) */}
                <span className="mx-1 w-px shrink-0 self-stretch bg-border" aria-hidden />

                {CLOSED_BOX_KEYS.map((key) => {
                  const tone = TONE[JOB_BOX_TONE[key]];
                  const active = openBox === key;
                  const rows = closedBoxCounts[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setOpenBox((prev) => (prev === key ? null : key))}
                      aria-pressed={active}
                      className={cn(
                        'min-w-[9rem] rounded-xl border-2 px-3 py-2 text-left transition-colors',
                        tone.soft,
                        tone.softHover,
                        active ? 'border-primary' : 'border-transparent',
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
                        <span className="truncate whitespace-nowrap text-[11px] font-semibold text-foreground">
                          {JOB_BOX_LABEL[key]}
                        </span>
                      </span>
                      <span className={cn('block text-2xl font-bold leading-tight tabular-nums', tone.num)}>
                        {closedLoading && rows.length === 0 ? (
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            {rows.length.toLocaleString('th-TH')}
                            <span className="ml-1 text-[11px] font-semibold text-muted-foreground">
                              ใบขอ · {sumJobPositionUnits(rows).toLocaleString('th-TH')} อัตรา
                            </span>
                          </>
                        )}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {JOB_BOX_HINT[key]} · {closedDays} วันล่าสุด
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {openBox ? (
              <p className="text-[11px] text-muted-foreground">
                กรองอยู่: <span className="font-semibold text-foreground">{JOB_BOX_LABEL[openBox]}</span>{' '}
                — {JOB_BOX_HINT[openBox]} · กดกล่องเดิมซ้ำเพื่อล้าง
              </p>
            ) : null}

            {/* ช่วงวันที่ของชุดใบปิด/ยกเลิก — โผล่เฉพาะตอนเลือกสองกล่องนั้น
                ⚠️ **ต้องมีช่วงวันที่เสมอ** ใบปิดสะสมย้อนหลังหลายปี ดึงหมดคือรอเป็นนาที */}
            {closedBox ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2 text-xs">
                <span className="font-semibold text-foreground">ปิดภายใน</span>
                <div className="flex flex-wrap items-center gap-1">
                  {CLOSED_RANGE_OPTIONS.map((r) => (
                    <button
                      key={r.days}
                      type="button"
                      onClick={() => onClosedDaysChange?.(r.days)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-xs font-semibold',
                        closedDays === r.days ? TONE.info.solid : TONE.neutral.outline,
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={closedLoading}
                  onClick={() => onReloadClosed?.()}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50',
                    TONE.neutral.outline,
                  )}
                >
                  {closedLoading ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  รีเฟรช
                </button>
                {closedError ? (
                  <span className="text-destructive">{closedError}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Pre-Check ย้ายมาอยู่ท้ายแถบตัวกรอง (เจ้าของสั่ง 16 ส.ค. 2569 เย็น:
            "หน้า Pre-check ก็ย้ายไปไว้ในหน้ากล่องงาน เอาไว้ตรง Filter")
            — เมนูเดิมถูกถอดออกแล้ว · route /matching/pre-check ยังอยู่ ลิงก์เก่าไม่พัง
            ⚠️ staff เท่านั้น — หน้าสมัครสาธารณะใช้ component ตัวเดียวกันนี้ */}
        {isStaff && view === 'board' ? (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/matching/pre-check')}
              title="ตรวจใบขอก่อนเริ่มหาคน — เปิดหน้า Pre-Check"
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold',
                TONE.neutral.outline,
              )}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Pre-Check
            </button>
          </div>
        ) : null}

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
          <div className="mt-10 jarvis-frost rounded-[1.5rem] border border-dashed border-white/70 p-10 text-center">
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

        {isStaff ? (
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-[#b08d4f] dark:text-[#cfae72]">
            {closedBox ? JOB_BOX_LABEL[closedBox] : 'ประกาศจากใบขอ'}
          </p>
        ) : null}
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleJobs.map((job) => (
            <Card
              key={job.id}
              /* กดที่กล่อง = เปิดรายละเอียดใบงานเลย (เจ้าของสั่ง 17 ส.ค. 2569)
                 เดิมกดกล่องแล้วได้รายชื่อผู้สมัคร ส่วนรายละเอียดต้องไปหาปุ่มเล็ก ๆ ใน footer
                 ตอนนี้สลับกัน: กล่อง = รายละเอียด · รายชื่อเป็นปุ่มที่กดตรง ๆ */
              onClick={() => setSelected(job)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(job);
                }
              }}
              className={cn(
                // flex-col + h-full: grid ยืดกล่องสูงเท่ากันอยู่แล้ว แต่ลูกเรียงชิดบน
                // พื้นที่เหลือจึงกองใต้ footer → แถบ "ผู้สมัคร N คน" ของแต่ละใบลอยคนละระดับ
                // (⚠️ ใส่ที่จุดเรียกใช้เท่านั้น ห้ามแก้ ui/card.tsx ซึ่งทั้งแอปใช้ร่วมกัน)
                'group jarvis-interactive-card flex h-full flex-col overflow-hidden rounded-[1.5rem] border-white/70 transition-all duration-300 hover:border-blue-300/40',
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
                    <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
                      {unitRequestCardSubtitle(job) || EM_DASH}
                    </p>
                    {/* เลขที่ใบขอโชว์เฉพาะเจ้าหน้าที่ (หน้าสมัครสาธารณะไม่ต้องเห็น จึงไม่จองที่)
                        แต่ในฝั่งเจ้าหน้าที่ต้องมีที่ยืนทุกใบ ไม่งั้นแถวล่างเลื่อนไม่ตรงกัน */}
                    {isStaff ? (
                      <p className="mt-0.5 font-mono text-[11px] leading-4 text-muted-foreground/80">
                        {dashIfEmpty(job.request_no)}
                      </p>
                    ) : null}
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
                      {JOB_CATEGORY_LABELS[job.job_category]}
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
                    {job.monthly_income
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
                {[...(job.benefits ?? []), ...extraBenefitLabels(job.extra_benefits)].length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {[...(job.benefits ?? []), ...extraBenefitLabels(job.extra_benefits)].map((b) => (
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
                        ผู้สมัคร {applicantCounts[job.id] ?? 0} คน
                        {/* Lead = ใบที่ถูกปัดเข้าคลัง ไม่ถูกนับในยอดซ้าย — โชว์เป็นเลขที่สอง
                            แทนที่จะยุบรวม (ยุบรวมแล้วเลขบนการ์ดจะไม่ตรงกับที่กดเข้าไปเห็น
                            ซึ่งเป็นเหตุผลที่ตัวนับกรอง Lead ออกตั้งแต่แรก) */}
                        {(leadCounts[job.id] ?? 0) > 0 ? (
                          <span className="font-normal text-muted-foreground">
                            · Lead {leadCounts[job.id]}
                          </span>
                        ) : null}
                        {/* แยกที่มาให้เห็นบนใบขอเลย — ไม่รู้ที่มา = ไม่ขึ้นบรรทัดนี้ */}
                        {applicantOriginSummary(originCounts[job.id]) ? (
                          <span className="font-normal text-muted-foreground">
                            ({applicantOriginSummary(originCounts[job.id])})
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
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLaneJob(job);
                          }}
                          title="ค้นคนที่ยังไม่สมัครจาก Checklist + ฐานใหม่ + iRecruit แล้วส่งคนที่ AI แนะนำเข้าคิว Lumos โทรทันที"
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold',
                            TONE.success.outline,
                          )}
                        >
                          <Send className="h-3.5 w-3.5" />
                          หาผู้สมัครเพิ่ม
                        </button>
                          </>
                        )}
                        {/* 🔴 Gen link กับ แก้ไข **ย้ายไปอยู่ในป๊อปอัปที่กดการ์ด** แล้ว
                            (เจ้าของเคาะ 19 ส.ค. 2569: การ์ดเหลือแค่ "ดูรายชื่อ" กับ
                            "หาผู้สมัครเพิ่ม") — ห้ามใส่ปุ่มกลับมาบนการ์ดโดยไม่ถามก่อน */}
                        {/* รายชื่อผู้สมัครย้ายมาเป็นปุ่มจริง เพราะคลิกของกล่องถูกใช้เปิด
                            รายละเอียดใบงานแล้ว (เจ้าของสั่ง 17 ส.ค. 2569)
                            ⚠️ stopPropagation — ไม่งั้นโดนคลิกของกล่องทับ */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setApplicantsJob(job);
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold',
                            TONE.info.outline,
                          )}
                        >
                          <Users className="h-3.5 w-3.5" />
                          ดูรายชื่อ
                        </button>
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
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#b08d4f] dark:text-[#cfae72]">
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
                      'group jarvis-interactive-card flex h-full flex-col overflow-hidden rounded-[1.5rem] border-white/70 transition-all duration-300 hover:border-blue-300/40',
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

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="flex max-h-[min(92dvh,820px)] w-[min(calc(100vw-1.25rem),32rem)] max-w-none flex-col gap-0 overflow-hidden border-border/80 p-0">
          <DialogHeader className="shrink-0 border-b border-border/50 px-5 pb-3 pt-5 text-left">
            <div className="flex items-start justify-between gap-3 pr-8">
              <DialogTitle className="text-base font-semibold leading-snug sm:text-lg break-words">
                {selected ? jobBoardCardTitle(selected) : ''}
              </DialogTitle>
              {/* แท็บไอคอนชิดขวา (เจ้าของเคาะ 19 ส.ค. 2569) — รายละเอียดงาน → แก้ไข → Gen link
                  ⚠️ เจ้าหน้าที่เท่านั้น · ใบที่ปิด/ยกเลิกแล้วเหลือแท็บรายละเอียดอันเดียว
                  (งานจบแล้ว ไม่ต้องแก้ประกาศ/ปล่อยลิงก์รับสมัครอีก) */}
              {isStaff && selected ? (
                <div className="flex shrink-0 items-center gap-1">
                  {(
                    [
                      { id: 'detail' as const, label: 'รายละเอียดงาน', Icon: ClipboardCheck, show: true },
                      {
                        id: 'edit' as const,
                        label: 'แก้ไข',
                        Icon: Pencil,
                        /**
                         * 🔴 **โชว์เสมอ** (เจ้าของสั่ง 20 ส.ค. 2569: *"เปิดมาต้องเจอ 3 ปุ่ม
                         * 1.รายละเอียดงาน 2.แก้ไข 3.Gen link"*) — เดิมซ่อนเมื่อใบยังไม่มีประกาศ
                         * ทำให้บางใบเห็น 2 ปุ่ม บางใบเห็น 3 ปุ่ม ไม่คงที่
                         * ใบที่ยังไม่มีประกาศ กดแล้วเจอคำอธิบาย + ปุ่มพาไป Gen link (ไม่ใช่ทางตัน)
                         */
                        show: !closedBox,
                      },
                      { id: 'genlink' as const, label: 'Gen link', Icon: Link2, show: !closedBox },
                    ] as const
                  )
                    .filter((t) => t.show)
                    .map((t) => {
                      const active = popupTab === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setPopupTab(t.id)}
                          title={t.label}
                          aria-label={t.label}
                          aria-pressed={active}
                          className={cn(
                            'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                            active
                              ? cn(TONE.primary.solid, 'border-transparent')
                              : 'border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground',
                          )}
                        >
                          <t.Icon className="h-4 w-4" />
                        </button>
                      );
                    })}
                </div>
              ) : null}
            </div>
            <DialogDescription className="sr-only">
              รายละเอียดตำแหน่งงาน
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              {/* เนื้อกลางเปลี่ยนตามแท็บ — ฟอร์มแก้ไข/Gen link ใช้ component ตัวเดิม
                  ในโหมด embedded (คืนเนื้อฟอร์มเปล่า ๆ ไม่ห่อ Dialog) */}
              {popupTab === 'edit' ? (
                /**
                 * แท็บ "แก้ไข" = **สองส่วนในที่เดียว** (เจ้าของเคาะ 20 ส.ค. 2569 —
                 * ถอดไอคอนดินสอบนการ์ดแล้วย้ายฟอร์มมารวมที่นี่)
                 *   1. ข้อความประกาศ (มีเฉพาะใบที่สร้างประกาศแล้ว — ใบที่ยังไม่มีก็ไม่ต้อง
                 *      ขึ้นโน้ตชวนไป Gen link เพราะ Gen link เป็นแท็บข้าง ๆ อยู่แล้ว
                 *      เจ้าของสั่งถอดโน้ตนั้นออก 20 ส.ค. 2569: *"มันอยู่อีกหน้าแล้ว"*)
                 *   2. ข้อมูลที่จะขึ้นประกาศ — จังหวัด/อำเภอ/ตำบล · รายได้รวม · สวัสดิการ
                 *      (แก้ได้ทุกใบ ไม่ต้องมีประกาศก่อน) → แท็บนี้จึงไม่เคยเป็นทางตัน
                 */
                <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
                  {latestPostingByJob.has(selected.id) ? (
                    <EditPostingDialog
                      embedded
                      posting={latestPostingByJob.get(selected.id) ?? null}
                      onClose={() => setPopupTab('detail')}
                      onSaved={() => {
                        setPostingsRev((n) => n + 1);
                        setPopupTab('detail');
                      }}
                    />
                  ) : null}

                  <div className="space-y-3 px-5 py-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      ข้อมูลที่จะขึ้นประกาศ
                    </p>
                    <React.Suspense
                      fallback={<p className="text-xs text-muted-foreground">กำลังโหลดฟอร์ม…</p>}
                    >
                      <EditPublicJobFieldsDialog
                        embedded
                        job={{ ...selected, ...(publicPatchById[selected.id] || {}) }}
                        onClose={() => setPopupTab('detail')}
                        onSaved={(patch) =>
                          setPublicPatchById((prev) => ({
                            ...prev,
                            [selected.id]: { ...(prev[selected.id] || {}), ...patch },
                          }))
                        }
                      />
                    </React.Suspense>
                  </div>
                </div>
              ) : popupTab === 'genlink' ? (
                <GenApplyLinkDialog
                  embedded
                  open
                  job={selected}
                  onClose={() => setPopupTab('detail')}
                  onCreated={() => setPostingsRev((n) => n + 1)}
                />
              ) : (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 text-sm">
                <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium">
                  {publicJobPositionLabel(selected)}
                </span>
                {selected.job_description_code_1 ? (
                  <span className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                    {JOB_TYPE_LABELS[selected.job_type]}
                  </span>
                ) : (
                  <span className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                    {JOB_CATEGORY_LABELS[selected.job_category]}
                  </span>
                )}
                {selected.urgency === 'urgent' && (
                  <span className="rounded-lg bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
                    รับด่วน
                  </span>
                )}
              </div>
              <dl className="grid gap-0 text-xs sm:text-sm">
                {isStaff && selected.request_no ? (
                  <div className="border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">เลขที่ใบขอ</dt>
                    <dd className="mt-0.5 font-mono font-medium text-foreground">{selected.request_no}</dd>
                  </div>
                ) : null}
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">สถานที่</dt>
                  <dd className="mt-0.5 font-medium leading-relaxed text-foreground break-words">
                    {selected.location_address}
                  </dd>
                </div>
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">ตำบล / แขวง</dt>
                  <dd className="mt-0.5 font-medium text-foreground break-words">
                    {selected.override_subdistrict ||
                      (inferSubdistrictFromAddress(selected.location_address || '') ?? '—')}
                  </dd>
                </div>
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">อำเภอ / เขต</dt>
                  <dd className="mt-0.5 font-medium text-foreground break-words">
                    {selected.override_district ||
                      (displayDistrictLine(selected.location_address || '') ?? '—')}
                  </dd>
                </div>
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">จังหวัด</dt>
                  <dd className="mt-0.5 font-medium text-foreground break-words">
                    {selected.override_province ||
                      (inferProvinceFromAddress(selected.location_address || '') ?? '—')}
                  </dd>
                </div>
                {extractJobSubtypeLabel(selected) !== 'ไม่ระบุ' ? (
                  <div className="border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">ลักษณะงานย่อย</dt>
                    <dd className="mt-0.5 font-medium text-foreground break-words">
                      {extractJobSubtypeLabel(selected)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  {/**
                   * ⚠️ **ค่านี้ไม่ใช่ยอดรวม** — วัดจาก ERP 16 ส.ค. 2569:
                   * `total_income` = `payment_rate` ของแถว `is_wage='Y'` **แถวเดียว**
                   * (ดู siamrajSqlServerRequests.ts — ROW_NUMBER เลือกแถวค่าแรงหลัก)
                   * ใบ LAO6908007 มี 12 แถว: ค่าแรงหลัก 16,000 + อีก 11 แถวที่เป็น
                   * **คนละหน่วย** (โอทีต่อชั่วโมง · เบี้ยเลี้ยงต่อวัน) และมี **รายการหัก**
                   * ปนอยู่ด้วย (ค่าปรับขาดงาน) → บวกกันตรง ๆ ได้เลขที่ไม่มีความหมาย
                   * จึงห้ามเรียกว่า "รายได้รวม" · ของแถมที่เหลือโชว์เป็นชิปสวัสดิการแทน
                   * (ต่างจาก JobDetailPage/AddJobPage ที่เป็นใบขอฝั่งเราซึ่งคนกรอกยอดรวมเอง)
                   */}
                  <dt className="text-muted-foreground">
                    {selected.monthly_income ? 'รายได้ต่อเดือน' : 'ค่าแรง (อัตราจาก ERP)'}
                  </dt>
                  <dd className="text-success font-semibold">
                    ฿{(selected.monthly_income ?? selected.total_income).toLocaleString('th-TH')}
                  </dd>
                </div>
                {/* แจกแจงที่มาของยอด — ผู้สมัครต้องเห็นว่าเลขมาจากไหน ไม่ใช่เชื่อยอดรวมลอย ๆ
                    ⚠️ ไม่รวมโอที/เบี้ยเลี้ยง/เบี้ยขยัน เพราะไม่การันตี (โชว์เป็นชิปแยก) */}
                {selected.monthly_income ? (
                  <div className="border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">คิดจาก</dt>
                    <dd className="mt-0.5 space-y-0.5 text-xs">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">ค่าแรงหลัก</span>
                        <span className="font-medium">
                          ฿{(selected.monthly_income_base ?? 0).toLocaleString('th-TH')}
                        </span>
                      </div>
                      {(selected.monthly_income_items ?? []).map((it) => (
                        <div key={it.label} className="flex justify-between gap-4">
                          <span className="text-muted-foreground">+ {it.label}</span>
                          <span className="font-medium">฿{it.monthly.toLocaleString('th-TH')}</span>
                        </div>
                      ))}
                      <p className="pt-1 text-[11px] text-muted-foreground">
                        ยังไม่รวมโอที เบี้ยขยัน และเบี้ยเลี้ยง ซึ่งได้เพิ่มตามงานจริง
                      </p>
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">วันที่ต้องการคน</dt>
                  <dd>{formatYmdDmyBe(selected.required_date)}</dd>
                </div>
                {(selected.age_range_min != null || selected.age_range_max != null) && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">ช่วงอายุ</dt>
                    <dd>
                      {selected.age_range_min ?? '—'} – {selected.age_range_max ?? '—'} ปี
                    </dd>
                  </div>
                )}
                {selected.gender_requirement && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">เพศ</dt>
                    <dd>{selected.gender_requirement}</dd>
                  </div>
                )}
                {selected.vehicle_required && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">รถที่ใช้</dt>
                    <dd className="text-right break-words">{selected.vehicle_required}</dd>
                  </div>
                )}
                {selected.work_schedule && (
                  <div className="border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">เวลาทำงาน</dt>
                    <dd className="mt-0.5 break-words">{selected.work_schedule}</dd>
                  </div>
                )}
                {isStaff && staffAssigneeLine(selected) ? (
                  <div className="py-2.5">
                    <dt className="text-muted-foreground">ผู้รับผิดชอบ</dt>
                    <dd className="mt-0.5 font-medium leading-relaxed text-foreground break-words">
                      {staffAssigneeLine(selected)}
                    </dd>
                  </div>
                ) : null}
              </dl>
              </div>
              )}
              <div className="flex shrink-0 flex-col gap-2 border-t border-border/50 px-5 py-4">
                {/* 19 ส.ค. 2569 เจ้าของสั่งเอาปุ่ม "เปิดใบขอในระบบ" ออก —
                    กดที่กล่องบนบอร์ดก็เข้าหน้ารายละเอียดอยู่แล้ว ปุ่มนี้ซ้ำซ้อน */}
                {/* 🔴 "สมัครตำแหน่งนี้" มีเฉพาะหน้าสาธารณะ (เจ้าของสั่ง 19 ส.ค. 2569) —
                    กล่องงานเป็นหน้าเจ้าหน้าที่ ไม่ใช่หน้าที่คนสมัครเอง */}
                {!isStaff ? (
                  <button
                    type="button"
                    onClick={() => {
                      const job = selected;
                      setSelected(null);
                      openApply(job);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                  >
                    สมัครตำแหน่งนี้
                    <Send className="h-4 w-4" />
                  </button>
                ) : null}

                {/* 🔴 Gen link + แก้ไขประกาศ = **แท็บไอคอนบนหัวป๊อปอัป** (เจ้าของเคาะ
                    19 ส.ค. 2569: รายละเอียดงาน → แก้ไข → Gen link ในป๊อปเดียว)
                    ห้ามเอาปุ่มกลับมาไว้ท้ายป๊อปหรือบนการ์ดโดยไม่ถามก่อน */}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PublicApplyDialog
        open={applyOpen}
        job={applyJob}
        onClose={() => setApplyOpen(false)}
      />

      <JobApplicantsDialog
        open={!!applicantsJob}
        job={applicantsJob}
        onClose={() => setApplicantsJob(null)}
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
