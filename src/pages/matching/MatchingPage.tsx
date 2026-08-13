import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import CallFunnelPanel, { FlowArrow, FlowSlotFiller, FlowStage, FUNNEL_ROW_GRID } from '@/components/follow/CallFunnelPanel';

/**
 * โครงคอลัมน์ของแถวฝั่งงาน — **ต้องเป็นระบบเดียวกับ FUNNEL_ROW_GRID** ของเส้นการโทร
 * (การ์ด `minmax(0,1fr)` กว้างเท่ากันเป๊ะ · ช่องลูกศร `auto`) ไม่งั้นสองแถวในแผงเดียวกัน
 * จะดูคนละจังหวะทั้งที่เป็นเรื่องต่อเนื่องกัน
 *
 * 5 การ์ด: อัตราทั้งหมด · ในนั้นด่วน → มีคนเขียว · มีคนเหลือง · ยังไม่มีคน
 * (ลูกศรคั่นแค่จุดเดียว เพราะสามใบขวาเป็น "ผลลัพธ์คู่ขนาน" ของการที่ AI หาคน ไม่ใช่ลำดับ)
 */
/**
 * แถวฝั่งงานใช้ **โครงคอลัมน์เดียวกับแถวการโทร** (`FUNNEL_ROW_GRID` 11 ช่อง)
 * เจ้าของติง 11 ส.ค. 2569 ว่าสองแถว "จัดเรียงดูไม่ไปทิศทางเดียวกัน" — เดิมแถวนี้มีโครง
 * ของตัวเอง 6 ช่อง การ์ดเลยกว้างไม่เท่ากับแถวล่างและลูกศรไม่ตรงคอลัมน์กัน
 * ช่องลูกศรที่ไม่ใช้ = `<FlowArrow ghost />` (กินที่เท่าลูกศรจริงแต่มองไม่เห็น)
 * ช่องการ์ดที่เกิน = `<FlowSlotFiller />` — ห้ามปล่อยว่าง ไม่งั้นคอลัมน์ยุบแล้วเหลื่อมทั้งแถว
 */
import SearchField from '@/components/shared/SearchField';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { Phone, MapPin, Search, Users, RefreshCw, Building2, ExternalLink, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { JobRequest } from '@/types';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { unitRequestCardSubtitle, unitRequestCardTitle, unitRequestSearchBlob } from '@/lib/unitRequestDisplay';
import { unitRequestPath } from '@/lib/jobNavigation';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { apiFetch } from '@/lib/apiFetch';
import {
  distantCandidateCount,
  isRecommendedTier,
  officialRemainingCount,
  proposalCounts,
  recommendedCandidateCount,
  requestPositionCount,
} from '@/lib/matchingProgress';
import { jobToRequestControlRecord } from '@/lib/requestControl';
import {
  filterAndSortMatchingJobs,
  type MatchingWorkflowFilter,
  type MatchingListSort,
} from '@/lib/matchingListFilter';
import { APP_DEPARTMENT_CODES } from '@/lib/departmentCodes';
import {
  getJobRequestAgeDays,
  ageUrgencyLevelFromDays,
  JOB_AGE_URGENCY_META,
} from '@/lib/jobUrgency';
import { useAuth } from '@/contexts/AuthContext';
import {
  saveProposal,
  listProposalsForJob,
  listProposalsForJobs,
  listActiveProposals,
  cancelProposal,
  proposalKey,
  proposalStatusLabel,
  proposalStatusChip,
  ProposalConflictError,
  PROPOSAL_STATUS_TONE,
  type ProposalStatus,
  type ProposalConflictInfo,
  type CandidateProposal,
} from '@/lib/candidateProposalsApi';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import {
  compareCandidatePriority,
  describePriorityScore,
  scoreCandidatePriority,
  screeningVerdicts,
  DEFAULT_PRIORITY_CONFIG,
  type CandidatePriorityScore,
  type CandidateScreening,
  type PriorityConfig,
  type PriorityVerdict,
} from '@/lib/candidatePriority';
import { fetchMatchPriorityConfig } from '@/lib/matchPriorityWeightsApi';
import {
  fetchCandidateScreening,
  type CandidateScreeningRecord,
} from '@/lib/candidateScreeningApi';
/* หน้านี้ไม่มี "รับไปโทรเอง" แล้ว (เจ้าของสั่ง 11 ส.ค. 2569) — เหลืออ่านล็อกอย่างเดียว
   เพื่อบอกว่าใครถูกเจ้าหน้าที่รับไปตามอยู่ AI จะได้ไม่โทรทับ · ตัวจับ/ปล่อย/บันทึกผล
   ยังอยู่ครบใน callHoldsApi.ts และยังถูกใช้ที่ถัง "ต้องคนตาม" ในแถบการไหลของงาน */
import { acquireCallHold, fetchCallHoldsByPhones, type CallHold } from '@/lib/callHoldsApi';
import { partitionHoldTargets, summarizeAcquireResults, type HoldTarget } from '@/lib/callHoldsBulk';
import { CheckCircle2, Megaphone, X, PhoneCall, UserCheck, UserX } from 'lucide-react';
import { cancelCallBatch, createCallBatch } from '@/lib/callBatchApi';
import { CALL_BATCH_UNDO_MINUTES, type CallBatch } from '@/lib/callBatch';
import ContactHistoryStrip from '@/components/matching/ContactHistoryStrip';
import type { BoardCandidateMatch } from '@/lib/boardCandidateTypes';
import { fetchCandidateJobMatches, type CandidateJobMatchItem } from '@/lib/candidateJobMatchesApi';
import CandidateChecklist from '@/components/matching/CandidateChecklist';
import ScreeningEditor from '@/components/matching/ScreeningEditor';
import {
  CallBatchUndoStrip,
  LumosCallBadgeRow,
  LumosJobSummaryStats,
  LumosSendBar,
} from '@/components/matching/LumosPanels';
import { cardNextAction } from '@/lib/matchingCardAction';
import TierCriteriaTooltip from '@/components/matching/TierCriteriaTooltip';
import AiEvaluationStatus from '@/components/matching/AiEvaluationStatus';
import { TIER_CRITERIA } from '@/lib/matchTierCriteria';
import {
  areaVerdict,
  boardCandidatePriority,
  normText,
  type CheckVerdict,
} from '@/lib/candidateVerdicts';
import { JOB_FAMILIES, classifyJobFamily, candidateMatchesFamily, fallbackKeywords } from '@/lib/jobFamilyLexicon';
import {
  type IrecruitCandidateMatch,
  type IrecruitMatchResult,
  matchTierEmoji,
  matchTierLabel,
} from '@/lib/irecruitMatchTypes';
import {
  getActiveJobPostingForJob,
  createJobPostingRequest,
  jobPostingStatusChip,
  jobPostingStatusLabel,
  type JobPostingRequest,
  type JobPostingRequestType,
} from '@/lib/jobPostingRequestsApi';
import { buildErpBranchDemandInput, parseErpBranchDemand } from '@/lib/erpBranchDemandParser';
import {
  distributeIrecruitMatchesToBranches,
  nearestBranchForArea,
  type BranchDemandItem,
  type NearestBranchAssignment,
} from '@/lib/distributeIrecruitToBranches';
import {
  fetchSiamrajUnitRequest,
  saveUnitRequestMeta,
  unitRequestNoteKey,
  type UnitBranchOverride,
} from '@/lib/siamrajUnitRequestsApi';
import {
  listLumosCallStatus,
  listLumosCallStatusWithPool,
  filterLumosPool,
  dispatchLumosCalls,
  cancelLumosCall,
  indexLumosCallStatus,
  boardPersonRef,
  irecruitPersonRef,
  summarizeLumosCallStatus,
  boardColumnBadge,
  type LumosCallStatus,
  type LumosPoolCandidate,
  type LumosJobCallSummaryRow,
} from '@/lib/lumosDispatchApi';

/** สถานะการเสนอ + id แถวจริงใน DB (ไว้ยกเลิก) — คีย์ = source#ref */
type ProposedRef = {
  id: string;
  status: ProposalStatus;
  branchName: string | null;
  proposedByName: string | null;
  reason: string | null;
  updatedAt: string;
};
type WorkflowFilter = MatchingWorkflowFilter;
type ProposalActionDraft = {
  candidateName: string;
  status: ProposalStatus;
  submit: (operatorName: string, reason: string) => Promise<void>;
};

type BoardMatchResult = {
  jobId: string;
  job_family_code: string;
  job_family_label: string;
  pool_size: number;
  matches: BoardCandidateMatch[];
  /** เป้า = อัตราที่ขอ × 3 — ต่ำกว่านี้ระบบค้นถัง "ไม่มีงาน" เพิ่มให้แล้ว */
  recommended_target?: number;
  fallback_used?: boolean;
  fallback_pool_size?: number;
};
/** ผลจาก API — AI คิดที่ worker หลังบ้านเท่านั้น หน้าเว็บได้แค่ผลสำเร็จหรือสถานะรอ */
type BoardMatchResponse = BoardMatchResult & {
  computed_at?: string;
  /** ยังไม่มีผลของใบนี้ — ส่งเข้าคิวหลังบ้านให้แล้ว */
  pending?: boolean;
  /** สั่งค้นหาใหม่แล้ว — ผลที่เห็นคือของเดิม รอผลใหม่มาแทน */
  refresh_queued?: boolean;
  worker_active?: boolean;
};

type IrecruitDisplayRow =
  | { kind: 'branch'; key: string; branch: BranchDemandItem; candidateCount: number }
  | {
      kind: 'candidate';
      key: string;
      match: IrecruitCandidateMatch;
      branchId: string | null;
      branchName: string | null;
    };
/** ลิสต์ใบขอแบบ server-side pagination (ปิดกลับเป็น client เดิมได้ด้วย env = rollback) */
const MATCHING_SERVER_LIST_ENABLED = import.meta.env.VITE_MATCHING_SERVER_LIST !== 'false';
/** ค่าเริ่มต้นจำนวนใบขอต่อหน้า — ผู้ใช้เลือกเองได้ (จำไว้ในเครื่อง) */
const MATCHING_LIST_BATCH_SIZE = 60;
/** ตัวเลือกจำนวนต่อหน้า — เพดาน 100 ตรงกับที่ API ยอมรับ (pageSize > 100 ถูกตัดเป็น 100) */
const MATCHING_PAGE_SIZE_OPTIONS = [20, 40, 60, 100] as const;
const MATCHING_PAGE_SIZE_KEY = 'jarvis:matching-page-size';

function loadSavedPageSize(): number {
  try {
    const raw = Number(localStorage.getItem(MATCHING_PAGE_SIZE_KEY));
    return (MATCHING_PAGE_SIZE_OPTIONS as readonly number[]).includes(raw) ? raw : MATCHING_LIST_BATCH_SIZE;
  } catch {
    return MATCHING_LIST_BATCH_SIZE;
  }
}

/** สรุปยอดจาก /api/matching/list (นับตามชุดเต็มของ BU ที่เลือก) */
type ServerListSummary = {
  urgentTotal: number;
  urgentAnalyzed: number;
  urgentWithGreen: number;
  /** ยอดในหน่วย "ใบขอ" */
  scopedTotal?: number;
  withGreen?: number;
  withYellow?: number;
  noRecommend?: number;
  /** ในถัง "ยังไม่มีคน" แยก AI ดูแล้วไม่เจอ vs ยังไม่ได้ดู */
  noneAnalyzed?: number;
  noneUnanalyzed?: number;
  /** ยอดเดียวกันในหน่วย "อัตรา" — การ์ดสรุปโชว์อัตราเป็นเลขหลัก */
  positionsTotal?: number;
  positionsUrgent?: number;
  positionsGreen?: number;
  positionsYellow?: number;
  positionsNone?: number;
};

/**
 * เก็บผลลิสต์ครั้งล่าสุดไว้ระดับ module — กด back/สลับเมนูกลับมาแล้วเห็นข้อมูลเดิมทันที
 * (เดิมทุกครั้งที่กลับเข้าหน้า ต้องโหลดใหม่จากศูนย์ ~หลายวินาที จนดูเหมือนหน้าค้าง)
 * ข้อมูลอาจเก่ากว่าจริงชั่วครู่ — effect โหลดชุดใหม่มาแทนที่เองทันทีที่เข้าหน้า
 */
let lastServerList: {
  items: JobRequest[];
  total: number;
  page: number;
  unitOptions: string[];
  buCounts: Record<string, number>;
  summary: ServerListSummary | null;
  storedMatches: Record<string, { recommended: number; computedAt: string }>;
  lumosSummary: Record<string, LumosJobCallSummaryRow>;
} | null = null;

function branchDemandItems(job: JobRequest): BranchDemandItem[] {
  const overrides = job.field_overrides?.branches;
  if (overrides?.length) {
    return overrides.map((branch, index) => ({
      ...branch,
      branch_id: branch.branch_id || `branch-${index + 1}`,
      branch_name_clean: branch.branch_name_clean,
      branch_name_raw: branch.address_raw || branch.branch_name_clean,
      requested_qty: branch.requested_qty,
      confidence: 100,
      district_hint: branch.district_hint,
      province_hint: branch.province_hint,
    }));
  }

  const parserInput = job.parser_override_text?.trim() || buildErpBranchDemandInput(job);
  return parseErpBranchDemand(parserInput).items.map((branch, index) => ({
    ...branch,
    branch_id: `branch-${index + 1}`,
    address_raw: branch.branch_name_raw,
    road: branch.branch_name_clean.match(/(?:ถ\.|ถนน)\s*([^,]+)/)?.[1]?.trim() || null,
    geocode_status: 'unverified' as const,
  }));
}

function nearestBranchForBoardCandidate(
  job: JobRequest,
  match: BoardCandidateMatch,
): NearestBranchAssignment | null {
  return nearestBranchForArea(
    {
      district_name: match.amphur_name,
      province_name: match.province_name,
      location_label: [match.amphur_name, match.province_name].filter(Boolean).join(' '),
    },
    branchDemandItems(job),
  );
}

/**
 * ความมั่นใจว่าผู้สมัครอยู่ใกล้สาขาไหน — สีมาจาก token กลาง (designTokens) ไม่เขียนสีซ้ำที่หน้านี้
 * ฟันธงได้ = success · ยังต้องเช็คเอง = warn · รู้แค่จังหวัด = info (ยังรอได้) · ไม่รู้เลย = neutral
 */
function boardBranchProximityMeta(assignment: NearestBranchAssignment | null): { label: string; cls: string } | null {
  // ระบุไม่ได้ = ไม่มีชิป — ชิปที่บอกว่า "ไม่รู้" ไม่ช่วยตัดสินใจ มีแต่ทำให้การ์ดรก
  // (เจ้าของติง 11 ส.ค. 2569 ว่าการ์ด "ดูรก ๆ") · เหตุผลเต็มยังดูได้ในรายละเอียด
  if (!assignment || assignment.proximity_rank === 4) return null;
  const branchName = assignment.branch.branch_name_clean;
  if (assignment.proximity_rank === 0) {
    return { label: `ใกล้สาขา ${branchName} · เขตตรง`, cls: cn(TONE.success.soft, TONE.success.value) };
  }
  if (assignment.proximity_rank === 1) {
    return { label: `น่าจะใกล้สาขา ${branchName}`, cls: cn(TONE.success.soft, TONE.success.value) };
  }
  if (assignment.proximity_rank === 2) {
    return { label: 'จังหวัดเดียวกับจุดงาน · ยังฟันธงสาขาไม่ได้', cls: cn(TONE.info.soft, TONE.info.value) };
  }
  return { label: 'อยู่ กทม./ปริมณฑล · ยังฟันธงสาขาไม่ได้', cls: cn(TONE.warn.soft, TONE.warn.value) };
}

function buildIrecruitDisplayRows(
  job: JobRequest,
  matches: IrecruitCandidateMatch[],
  includeDistant: boolean,
): IrecruitDisplayRow[] {
  const branches = branchDemandItems(job);
  if (branches.length <= 1) {
    return matches.map((match) => ({
      kind: 'candidate',
      key: `candidate-${match.id}`,
      match,
      branchId: branches[0]?.branch_id ?? null,
      branchName: branches[0]?.branch_name_clean ?? null,
    }));
  }

  const groups = distributeIrecruitMatchesToBranches(matches, branches, {
    perBranchLimit: 20,
    maxProximityRank: includeDistant ? 4 : 3,
  });
  return groups.flatMap((group, index): IrecruitDisplayRow[] => [
    {
      kind: 'branch',
      key: `branch-${index}-${group.branch_name_clean}`,
      branch: group,
      candidateCount: group.matches.length,
    },
    ...group.matches.map((match) => ({
      kind: 'candidate' as const,
      key: `branch-${index}-candidate-${match.id}`,
      match,
      branchId: group.branch_id ?? `branch-${index + 1}`,
      branchName: group.branch_name_clean,
    })),
  ]);
}

const ACTIVE_WORKFLOW_STATUSES: ProposalStatus[] = ['reserved', 'contacted', 'placed'];

function isActiveWorkflowStatus(status: ProposalStatus): boolean {
  return ACTIVE_WORKFLOW_STATUSES.includes(status);
}

/** สีสถานะการเสนอ — ใช้แหล่งกลางเดียวกับหน้าจองตัว (lib/candidateProposalsApi) */
function proposalStatusClass(status: ProposalStatus): string {
  return proposalStatusChip(status);
}

const CANDIDATE_ACTION_BUTTON_CLASS =
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-[transform,box-shadow,background-color,border-color] hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none';

/**
 * ปุ่มเปลี่ยนสถานะผู้สมัคร — สีมาจากโทนของสถานะที่แหล่งกลาง (PROPOSAL_STATUS_TONE)
 * ไม่ประกาศสีสถานะซ้ำในหน้านี้: ติดต่อ=น้ำเงิน · จอง=ม่วง · ลงงาน=เขียว · ไม่ผ่าน=แดง
 * "ลงงานแล้ว" เป็นการปิดงานจริงจึงใช้ solid (บล็อกสีอิ่ม) ตัวเดียวในกลุ่ม ที่เหลือเป็นปุ่มพื้นจาง
 */
function proposalActionButtonClass(status: ProposalStatus): string {
  const tone = TONE[PROPOSAL_STATUS_TONE[status]];
  if (status === 'placed') return cn(CANDIDATE_ACTION_BUTTON_CLASS, 'border-transparent', tone.solid);
  return cn(CANDIDATE_ACTION_BUTTON_CLASS, tone.soft, tone.softHover, tone.value);
}

/**
 * ปุ่มกลม ๆ ของตัวกรอง/การเรียง/จำนวนต่อหน้า — ที่เลือกอยู่ = โทน primary (กำลังดำเนินการ)
 * ที่ไม่ได้เลือก = พื้นกลาง แล้ว hover เป็น primary เพื่อบอกว่ากดได้
 */
const FILTER_PILL_ACTIVE_CLASS = cn('border-blue-300 dark:border-blue-700', TONE.primary.solid);
const FILTER_PILL_IDLE_CLASS = cn(
  'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  'hover:border-blue-200 dark:hover:border-blue-800',
  TONE.primary.softHover,
);

function proposalRefFromItem(item: CandidateProposal): ProposedRef {
  return {
    id: item.id,
    status: item.status,
    branchName: item.branch_name,
    proposedByName: item.proposed_by_name,
    reason: item.reason,
    updatedAt: item.updated_at,
  };
}

function proposalActionLabel(status: ProposalStatus): string {
  if (status === 'contacted') return 'ติดต่อแล้ว';
  if (status === 'reserved') return 'จองตัว';
  if (status === 'placed') return 'ยืนยันลงงาน';
  if (status === 'rejected') return 'ไม่ผ่าน';
  if (status === 'cancelled') return 'ยกเลิกการจอง';
  return 'เสนอผู้สมัคร';
}

function suggestedProposalReason(status: ProposalStatus, aiReason?: string | null): string {
  if (status === 'reserved') return aiReason?.trim() || 'คุณสมบัติและความพร้อมสอดคล้องกับใบขอ';
  if (status === 'contacted') return 'ติดต่อเพื่อตรวจสอบความพร้อมและคุณสมบัติเพิ่มเติม';
  if (status === 'placed') return 'ผู้สมัครยืนยันวันเริ่มงาน สถานที่ และเงื่อนไขการลงงานแล้ว';
  if (status === 'rejected') return 'คุณสมบัติหรือความพร้อมยังไม่สอดคล้องกับใบขอ';
  if (status === 'cancelled') return 'ยกเลิกการจองเพื่อเปลี่ยนผู้สมัครหรือแก้ไขข้อมูล';
  return aiReason?.trim() || '';
}

/**
 * ป้าย tier ของคนบนบอร์ด — ตั้งชื่อโทนไว้ที่เดียวแบบเดียวกับ CHECK_META
 * ความหมายเดียวกับ TIER_CRITERIA (เขียว=success · เหลือง=warn · แดง=danger) จุดเรียกใช้เลือก variant เอง
 */
function boardTierMeta(tier: BoardCandidateMatch['tier']): { icon: string; label: string; tone: ToneKey } {
  if (tier === 'green') return { icon: '🟢', label: 'ลงได้ทันที', tone: 'success' };
  if (tier === 'red') return { icon: '🔴', label: 'ห่างไกล', tone: 'danger' };
  return { icon: '🟡', label: 'พอได้ ต้องเช็ค', tone: 'warn' };
}

/** ข้อความตำแหน่งจากใบขอ (รวม job description + staff title) สำหรับ classify family */
function jobTitleText(j: JobRequest): string {
  const pick = (k: keyof JobRequest) => {
    const v = j[k];
    const s = v == null ? '' : String(v).trim();
    return s && s !== 'ไม่ระบุ' ? s : '';
  };
  return [pick('job_description_code_1'), pick('job_description_code_2'), pick('staff_title_name')]
    .filter(Boolean)
    .join(' ');
}

const MatchingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  /** หน้า "งานโทร" ยังซ่อนไว้ให้แอดมิน — ลิงก์ที่ชี้ไปหน้านั้นต้องซ่อนตามกัน */
  // ในโหมด server-side list ไม่ต้องดึง feed 500 ใบมาที่ client — ใช้ serverItems แทน
  // skip=true → hook ไม่ยิง /api/siamraj/unit-requests?limit=500 เลย
  const { jobs: feedJobs, loading: feedLoading } = useUnitRequestsFeed({
    skip: MATCHING_SERVER_LIST_ENABLED,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [unitFilter, setUnitFilter] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>('all');
  /** แยกดูตาม BU (department_code เช่น LBD) — '' = ทุก BU */
  const [buFilter, setBuFilter] = useState('');
  /** จำนวนใบขอต่อหน้า — ผู้ใช้เลือกเอง จำค่าไว้ในเครื่อง */
  const [pageSize, setPageSize] = useState<number>(loadSavedPageSize);
  /** การเรียงลิสต์ — 'default' = SLA/ด่วนก่อนเหมือนเดิม */
  const [sortBy, setSortBy] = useState<MatchingListSort>('default');
  const [clientPageNo, setClientPageNo] = useState(1);
  const listTopRef = useRef<HTMLDivElement | null>(null);
  const listScrollPendingRef = useRef(false);
  const [jobDetail, setJobDetail] = useState<JobRequest | null>(null);
  const [localJobEditsById, setLocalJobEditsById] = useState<Record<string, Partial<JobRequest>>>({});

  // ── server-side pagination ของลิสต์ (/api/matching/list) — กรอง/เรียง/แบ่งหน้าที่ server
  // เริ่มจาก cache ของครั้งก่อน (ถ้ามี) → กลับเข้าหน้าแล้วเห็นทันที ระหว่างที่ effect โหลดชุดสดมาแทน
  const [serverItems, setServerItems] = useState<JobRequest[]>(() => lastServerList?.items ?? []);
  const [serverTotal, setServerTotal] = useState(() => lastServerList?.total ?? 0);
  const [serverPageNo, setServerPageNo] = useState(() => lastServerList?.page ?? 1);
  const [serverUnitOptions, setServerUnitOptions] = useState<string[]>(
    () => lastServerList?.unitOptions ?? [],
  );
  /** ยอดใบขอเปิดต่อ BU จาก /api/matching/list — ใช้วาดชิป "แยกดูตาม BU" */
  const [serverBuCounts, setServerBuCounts] = useState<Record<string, number>>(
    () => lastServerList?.buCounts ?? {},
  );
  const [serverSummary, setServerSummary] = useState<ServerListSummary | null>(
    () => lastServerList?.summary ?? null,
  );
  const [serverStoredMatches, setServerStoredMatches] = useState<
    Record<string, { recommended: number; computedAt: string }>
  >(() => lastServerList?.storedMatches ?? {});
  /** สรุปผลโทร Lumos ต่อใบ (จาก /api/matching/list) — โชว์ข้างการ์ดในลิสต์ */
  const [serverLumosSummary, setServerLumosSummary] = useState<Record<string, LumosJobCallSummaryRow>>(
    () => lastServerList?.lumosSummary ?? {},
  );
  const [serverListLoading, setServerListLoading] = useState(
    MATCHING_SERVER_LIST_ENABLED && !lastServerList,
  );
  const [serverListError, setServerListError] = useState<string | null>(null);
  const serverFetchSeq = useRef(0);

  // ย้ายมาอยู่หลัง state declarations ทั้งหมด เพื่อหลีก TDZ error
  const jobs = MATCHING_SERVER_LIST_ENABLED ? serverItems : feedJobs;
  const loadingJobs = MATCHING_SERVER_LIST_ENABLED ? serverListLoading : feedLoading;

  // ── worker status badge ───────────────────────────────────────────────────
  const [workerStatus, setWorkerStatus] = useState<{
    enabled: boolean;
    started: boolean;
    queueSize: number;
    isIdle: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await apiFetch('/api/matching/worker-status');
        if (!cancelled && r.ok) {
          const data = (await r.json()) as { enabled: boolean; started: boolean; queueSize: number; isIdle: boolean };
          setWorkerStatus(data);
        }
      } catch {
        // silent — status badge is non-critical
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 15_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  const fetchServerPage = async (page: number, append: boolean) => {
    const seq = ++serverFetchSeq.current;
    setServerListLoading(true);
    setServerListError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const q = search.trim();
      if (q) params.set('q', q);
      if (urgentOnly) params.set('urgent', '1');
      if (unitFilter) params.set('unit', unitFilter);
      if (workflowFilter !== 'all') params.set('workflow', workflowFilter);
      if (buFilter) params.set('bu', buFilter);
      if (sortBy !== 'default') params.set('sort', sortBy);
      const r = await apiFetch(`/api/matching/list?${params.toString()}`);
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || `โหลดรายการไม่สำเร็จ (HTTP ${r.status})`);
      }
      const data = (await r.json()) as {
        items: JobRequest[];
        total: number;
        page: number;
        unitOptions?: string[];
        buCounts?: Record<string, number>;
        summary?: ServerListSummary;
        storedMatches?: Record<string, { recommended: number; computedAt: string }>;
        lumosSummary?: Record<string, LumosJobCallSummaryRow>;
      };
      if (seq !== serverFetchSeq.current) return;
      setServerItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setServerTotal(data.total);
      setServerPageNo(data.page);
      if (data.unitOptions) setServerUnitOptions(data.unitOptions);
      if (data.buCounts) setServerBuCounts(data.buCounts);
      if (data.summary) setServerSummary(data.summary);
      setServerStoredMatches((prev) =>
        append ? { ...prev, ...(data.storedMatches ?? {}) } : (data.storedMatches ?? {}),
      );
      setServerLumosSummary((prev) =>
        append ? { ...prev, ...(data.lumosSummary ?? {}) } : (data.lumosSummary ?? {}),
      );
      if (!append) {
        // เก็บไว้ระดับ module — กลับเข้าหน้านี้รอบหน้าเห็นชุดนี้ทันทีระหว่างรอโหลดสด
        lastServerList = {
          items: data.items,
          total: data.total,
          page: data.page,
          unitOptions: data.unitOptions ?? [],
          buCounts: data.buCounts ?? {},
          summary: data.summary ?? null,
          storedMatches: data.storedMatches ?? {},
          lumosSummary: data.lumosSummary ?? {},
        };
      }
    } catch (e) {
      if (seq === serverFetchSeq.current) {
        setServerListError(e instanceof Error ? e.message : 'โหลดรายการไม่สำเร็จ');
      }
    } finally {
      if (seq === serverFetchSeq.current) setServerListLoading(false);
    }
  };

  useEffect(() => {
    if (!MATCHING_SERVER_LIST_ENABLED) return;
    // debounce เฉพาะตอนพิมพ์ค้นหา — เปลี่ยน filter อื่นยิงทันที
    const t = window.setTimeout(() => void fetchServerPage(1, false), search.trim() ? 350 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, urgentOnly, unitFilter, workflowFilter, buFilter, pageSize, sortBy]);

  const [boardMatchById, setBoardMatchById] = useState<Record<string, BoardMatchResult>>({});
  /** น้ำหนักเรียงผู้สมัครที่ตั้งไว้ที่ Settings — โหลดพลาดใช้ค่าเริ่มต้นในโค้ด */
  const [priorityConfig, setPriorityConfig] = useState<PriorityConfig>(DEFAULT_PRIORITY_CONFIG);

  useEffect(() => {
    let cancelled = false;
    void fetchMatchPriorityConfig().then((c) => {
      if (!cancelled) setPriorityConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * ผลคัดกรอง (เหล้า/บุหรี่ + คดี) ของผู้สมัครในใบขอที่เปิดอยู่ — คีย์เป็น card_id (string)
   * บอร์ด iRecruit ไม่มีสองฟิลด์นี้ เราเก็บฝั่ง Jarvis เอง (ดู lib/candidateScreeningApi)
   * โหลดพลาด/ตารางยังไม่ถูก migrate = ว่าง → เกณฑ์เป็น unknown ไม่ถูกนับ ไม่ทำให้ลิสต์เพี้ยน
   */
  const [screeningByRef, setScreeningByRef] = useState<Record<string, CandidateScreeningRecord>>({});

  /**
   * ผลคัดกรองของผู้สมัครฝั่ง iRecruit — คีย์เป็น `id` ของ iRecruit (string)
   * ⚠ ต้องแยก map กับ `screeningByRef` ของบอร์ด ห้ามยุบรวมเป็นก้อนเดียว
   * เพราะ `card_id` ของบอร์ดกับ `id` ของ iRecruit เป็นเลขคนละชุดที่ชนกันได้
   * (เช่น 1805 มีทั้งสองฝั่ง แต่เป็นคนละคน) — ฝั่ง DB แยกด้วยคอลัมน์ `source` อยู่แล้ว
   */
  const [irScreeningByRef, setIrScreeningByRef] = useState<Record<string, CandidateScreeningRecord>>({});

  /** แถว iRecruit ที่กางฟอร์มบันทึกผลคัดกรองอยู่ (ทีละคน — กันลิสต์ยาวเกินจนอ่านไม่ไหว) */
  const [screeningOpenIrId, setScreeningOpenIrId] = useState<number | null>(null);

  /**
   * "คนนี้แมทอยู่กี่งาน" — คีย์ = card_id (string) · ค่า = ใบขอเปิดที่คนนั้นถูกแนะนำ
   * (เจ้าของสั่ง 12 ส.ค. 2569: บอกบนรายชื่อว่าคนนี้ match อยู่กี่งาน)
   */
  const [jobMatchesByCard, setJobMatchesByCard] = useState<Record<string, CandidateJobMatchItem[]>>({});

  /** โหลดผลคัดกรองของผู้สมัครทุกคนในใบขอที่เปิด — รอผลแมทมาก่อนจึงรู้ว่ามีใคร */
  const openJobMatches = jobDetail ? boardMatchById[jobDetail.id]?.matches : undefined;
  useEffect(() => {
    if (!openJobMatches?.length) return;
    const refs = openJobMatches.map((m) => String(m.card_id));
    let cancelled = false;
    void fetchCandidateScreening('board', refs).then((map) => {
      if (cancelled || map.size === 0) return;
      setScreeningByRef((prev) => {
        const next = { ...prev };
        for (const [ref, rec] of map) next[ref] = rec;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [openJobMatches]);

  /** โหลด "แมทอยู่กี่งาน" ของผู้สมัครในใบขอที่เปิด — จังหวะเดียวกับผลคัดกรองข้างบน */
  useEffect(() => {
    if (!openJobMatches?.length) return;
    let cancelled = false;
    void fetchCandidateJobMatches(openJobMatches.map((m) => m.card_id)).then((map) => {
      if (cancelled || Object.keys(map).length === 0) return;
      setJobMatchesByCard((prev) => ({ ...prev, ...map }));
    });
    return () => {
      cancelled = true;
    };
  }, [openJobMatches]);

  /**
   * งานโทรที่ถูก "รับไปโทรเอง" — คีย์เป็น candidateRef (card_id / iRecruit id)
   * ล็อกจริงผูกกับเบอร์ที่ฝั่ง server · อ่านล็อกไม่ได้/ยังไม่ migrate = ทุกการ์ดเป็น "ว่าง"
   * ซึ่งยังปลอดภัยเพราะ server เป็นคนตัดสินตอนกดรับอยู่ดี
   */
  const [holdByRef, setHoldByRef] = useState<Record<string, CallHold>>({});

  /** โหลดสถานะล็อกของผู้สมัครในใบขอที่เปิด (คีย์ด้วยเบอร์ฝั่ง server) */
  useEffect(() => {
    if (!openJobMatches?.length) return;
    const phones = openJobMatches.map((m) => m.mobile);
    let cancelled = false;
    void fetchCallHoldsByPhones(phones).then((map) => {
      if (cancelled || map.size === 0) return;
      setHoldByRef((prev) => {
        const next = { ...prev };
        for (const [ref, hold] of map) next[ref] = hold;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [openJobMatches]);

  const [boardLoadingId, setBoardLoadingId] = useState<string | null>(null);
  const [boardErrorById, setBoardErrorById] = useState<Record<string, string>>({});
  // #2 (ยุบ) — หาผู้สมัคร iRecruit + เสนอในหน้า match เลย (ไม่ต้องไป pre-check)
  const [irMatchById, setIrMatchById] = useState<Record<string, IrecruitMatchResult>>({});
  const [irLoadingId, setIrLoadingId] = useState<string | null>(null);
  const [irErrorById, setIrErrorById] = useState<Record<string, string>>({});

  /**
   * โหลดผลคัดกรองฝั่ง iRecruit ของใบขอที่เปิด — คู่กับ effect ของบอร์ดข้างบน
   * ยิงแยกกันเพราะ `source` ต่างกัน ผลจึงเป็นคนละชุด ห้ามรวมเป็นคำขอเดียว
   * (อยู่ตรงนี้ ไม่ใช่ข้างบนกับของบอร์ด เพราะต้องประกาศหลัง `irMatchById`)
   */
  const openJobIrMatches = jobDetail ? irMatchById[jobDetail.id]?.matches : undefined;
  useEffect(() => {
    if (!openJobIrMatches?.length) return;
    const refs = openJobIrMatches.map((m) => String(m.id));
    let cancelled = false;
    void fetchCandidateScreening('irecruit', refs).then((map) => {
      if (cancelled || map.size === 0) return;
      setIrScreeningByRef((prev) => {
        const next = { ...prev };
        for (const [ref, rec] of map) next[ref] = rec;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [openJobIrMatches]);
  // pool เบา ๆ สำหรับนับ "คนของเราน่าจะตรง" บนการ์ดตั้งแต่หน้าแรก (ไม่เรียก AI)
  const [pool, setPool] = useState<Array<{ card_id: number; job1_name: string | null; job2_name: string | null }>>([]);
  // ดูรายละเอียดพนักงานของเรา
  const [candDetail, setCandDetail] = useState<BoardCandidateMatch | null>(null);
  // การเสนอ/จองตัว/ลงงาน — สถานะล่าสุดต่อผู้สมัคร (คีย์ = source#ref) ต่อใบขอที่เปิดอยู่
  const [proposedByKey, setProposedByKey] = useState<Record<string, ProposedRef>>({});
  const [proposalsByJobId, setProposalsByJobId] = useState<Record<string, CandidateProposal[]>>({});
  const [activeProposalByCandidate, setActiveProposalByCandidate] = useState<Record<string, CandidateProposal>>({});
  const [proposingKey, setProposingKey] = useState<string | null>(null);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposalActionDraft, setProposalActionDraft] = useState<ProposalActionDraft | null>(null);
  const [proposalOperatorName, setProposalOperatorName] = useState('');
  const [proposalDecisionReason, setProposalDecisionReason] = useState('');
  const [proposalFormBusy, setProposalFormBusy] = useState(false);
  const [rosterOperatorNames, setRosterOperatorNames] = useState<string[]>([]);
  // ผู้สมัครถูกจองอยู่กับใบขออื่นแล้ว (409 จาก backend) — ให้เลือกยกเลิกอันเดิมแล้วจองใบนี้แทน
  const [conflictInfo, setConflictInfo] = useState<{
    message: string;
    conflict: ProposalConflictInfo;
    operatorName: string;
    decisionReason: string;
    retry: () => Promise<void>;
  } | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  // #3 กันเสนอซ้ำ — ซ่อนคนที่เสนอ/จอง/ลงแล้ว
  const [hideProposed, setHideProposed] = useState(false);
  // แสดงทางเลือกนอกพื้นที่/ห่างไกลเป็นค่าเริ่มต้น แต่ไม่นับรวมเป็น AI แนะนำ
  const [showDistantCandidates, setShowDistantCandidates] = useState(true);
  /**
   * คนที่ "ปฏิเสธงานใบนี้" ไปแล้ว — ซ่อนจากรายการของใบนี้ (เจ้าของสั่ง 11 ส.ค. 2569:
   * "ถ้าปฏิเสธงานไหนก็ไม่ต้องโชว์งานนั้นอีกและบันทึกว่าปฏิเสธงานนั้น ๆ")
   *
   * ⚠️ ซ่อน **เฉพาะใบนี้** ไม่ใช่ทั้งระบบ — ปฏิเสธงานนี้ไม่ได้แปลว่าเลิกหางาน
   * (นิยามเดียวกับ `declinedScope: 'job'` ใน callFollowupPolicy: ใบอื่นยังเสนอได้)
   * ส่วน "ไม่หางานแล้ว" (`scope: 'all'`) จัดการด้วยการพักเบอร์ที่ฝั่ง server อยู่แล้ว
   *
   * ⚠️ ซ่อนแบบ **ยังกดดูได้** ไม่ใช่ลบทิ้งจากสายตา — เจ้าหน้าที่ต้องตอบได้ว่า
   * "คนที่หายไปคือใคร ทำไมหาย" ไม่งั้นจะกลายเป็นข้อมูลหายเงียบซึ่งเป็นสิ่งที่
   * โปรเจกต์นี้กันมาตลอด · ค่าเริ่มต้นคือซ่อน ตามที่สั่ง
   */
  const [showDeclined, setShowDeclined] = useState(false);
  const [branchEditorOpen, setBranchEditorOpen] = useState(false);
  const [branchEditAgeMin, setBranchEditAgeMin] = useState('');
  const [branchEditAgeMax, setBranchEditAgeMax] = useState('');
  const [branchEditGender, setBranchEditGender] = useState('');
  const [branchDrafts, setBranchDrafts] = useState<UnitBranchOverride[]>([]);
  const [branchSaveBusy, setBranchSaveBusy] = useState(false);
  const [branchGeocodeBusyId, setBranchGeocodeBusyId] = useState<string | null>(null);
  const [branchEditorError, setBranchEditorError] = useState<string | null>(null);
  // #1 คำขอโพสหางานใหม่ — สร้าง ID ให้ทีมคอนเทนต์/สรรหารับไปทำต่อ
  const [jobPostingByJobId, setJobPostingByJobId] = useState<Record<string, JobPostingRequest>>({});
  const [creatingPosting, setCreatingPosting] = useState(false);
  const [postingError, setPostingError] = useState<string | null>(null);
  // ยืนยันก่อน "ค้นหาใหม่" (Rematching) — กันกดโดนแล้วสั่งคิดใหม่ทับผลเดิมโดยไม่ตั้งใจ
  const [rematchConfirmJobId, setRematchConfirmJobId] = useState<string | null>(null);
  /** ใบที่รอผลจาก worker หลังบ้าน — baseline = computed_at เดิม (null = ยังไม่เคยมีผล) */
  const [boardWaitingById, setBoardWaitingById] = useState<Record<string, { baseline: string | null }>>({});

  // ── ส่งให้ Lumos โทร แบบคนติ๊กเลือกเอง (ไม่ส่งอัตโนมัติแล้ว) + ผลการโทรต่อคน
  /** สถานะการโทรต่อคนของใบขอที่เปิดอยู่ — คีย์ = person_ref ('card-<id>' / 'ir-<id>') */
  const [lumosStatusByRef, setLumosStatusByRef] = useState<Record<string, LumosCallStatus>>({});
  const [lumosSelectedBoard, setLumosSelectedBoard] = useState<number[]>([]);
  const [lumosSelectedIrecruit, setLumosSelectedIrecruit] = useState<number[]>([]);
  const [lumosConfirmOpen, setLumosConfirmOpen] = useState(false);
  /** popup "คนนี้แมทหลายงาน — ส่งไปงานไหนบ้าง" (เจ้าของสั่ง 12 ส.ค. 2569) */
  const [jobPickOpen, setJobPickOpen] = useState(false);
  /** งาน "อื่น" (นอกจากใบที่เปิด) ที่เลือกส่งเพิ่มต่อคน — คีย์ = card_id */
  const [extraJobsByCard, setExtraJobsByCard] = useState<Record<number, string[]>>({});
  const [lumosSending, setLumosSending] = useState(false);
  /** กำลังตั้งคิวเป็นชุด — แยกจาก lumosSending เพราะเป็นคนละปุ่มคนละปลายทาง */
  const [batchCreating, setBatchCreating] = useState(false);
  /**
   * ชุดที่ "ผู้ใช้คนนี้เพิ่งตั้งคิวในหน้านี้" — ไว้โชว์แถบนับถอยหลัง + ปุ่มยกเลิก
   * ไม่ได้ไปดึงรายการชุดทั้งระบบมา (นั่นคือแผงอนุมัติที่เจ้าของสั่งเอาออก)
   * ออกจากหน้าไปแล้วแถบหาย — ชุดยังเดินตามเวลาของมันต่อ ซึ่งตั้งใจให้เป็นแบบนั้น
   */
  const [pendingBatches, setPendingBatches] = useState<CallBatch[]>([]);
  const [batchCancellingId, setBatchCancellingId] = useState<string | null>(null);

  /* ⚠️ เคยอ่านโหมดส่งงาน (`dispatchModeCfg`) มาซ่อนปุ่ม "ส่ง AI โทร" ตอนจุดนั้นเปิดโหมด
     assist — โหมด assist ถูกถอดทิ้ง 11 ส.ค. 2569 พร้อมลูปอนุมัติ ตัวแปรนี้จึงตายตาม
     ตอนนี้ทั้งสองปุ่มโชว์เสมอ: "ส่ง AI โทร" = เข้าคิวทันที · "ตั้งคิวโทร" = หน่วง 10 นาที
     ถอนคำได้ — ไม่มีนโยบายอะไรที่ทำให้สองปุ่มขัดกันเองอีกแล้ว */
  const [lumosError, setLumosError] = useState<string | null>(null);
  const [lumosNotice, setLumosNotice] = useState<string | null>(null);
  /** กำลังวนจับล็อก "เก็บไปโทรเอง" — กันกดซ้ำระหว่างลูป */
  const [holdingSelf, setHoldingSelf] = useState(false);
  const [lumosExpandedRef, setLumosExpandedRef] = useState<string | null>(null);
  const [lumosCancellingRef, setLumosCancellingRef] = useState<string | null>(null);
  // หน้าต่างเลือกคนจาก pool "คนของเรา" — ใช้ตอนมีคนเพิ่มเข้ามาทีหลังแล้วใบขอด่วน
  // (auto-send ส่งเฉพาะคนที่อยู่ในผล AI แมทตอนนั้น คนเพิ่มใหม่ต้องดันเข้าคิวเอง)
  const [lumosPickerOpen, setLumosPickerOpen] = useState(false);
  const [lumosPool, setLumosPool] = useState<LumosPoolCandidate[]>([]);
  const [lumosPoolLoading, setLumosPoolLoading] = useState(false);
  const [lumosPoolSearch, setLumosPoolSearch] = useState('');

  const lumosSelectedCount = lumosSelectedBoard.length + lumosSelectedIrecruit.length;

  /**
   * person_ref ของคนที่ปฏิเสธ "ใบขอที่เปิดอยู่" — มาจากผลโทรของใบนี้ที่หน้าโหลดอยู่แล้ว
   * (`GET /api/lumos/dispatch?jobId=` → `listLumosCallStatusForJob`) ไม่ต้องยิงเพิ่ม
   *
   * ⚠️ ฝั่ง server อ่าน outcome ด้วย `coalesce(last_outcome, result->>'outcome')` แล้ว
   * ถ้าวันไหนมีคนแก้กลับไปอ่าน `result` ทางเดียว คนที่ปฏิเสธจะโผล่กลับมาให้เสนอใหม่
   * แบบเงียบ ๆ (ผลที่คนบันทึกเขียนแค่ last_outcome · ตั้งโทรซ้ำก็ล้าง result ทิ้ง)
   */
  const declinedRefs = useMemo(() => {
    const out = new Set<string>();
    for (const row of Object.values(lumosStatusByRef)) {
      if (row.outcome === 'declined') out.add(row.person_ref);
    }
    return out;
  }, [lumosStatusByRef]);

  /**
   * ⚠️ **นับเฉพาะคนที่ถูกซ่อนออกจากรายการนี้จริง ๆ** ไม่ใช่ทุกคนที่เคยปฏิเสธใบนี้
   *
   * เจอตอนตรวจกับข้อมูลจริง: ใบ OPL6907083 มีคนปฏิเสธ 1 คน (card-1756) แต่คนนั้น
   * **ไม่ได้อยู่ในผลแมทรอบปัจจุบันแล้ว** — แถบจึงขึ้นว่า "ซ่อนไว้ 1 คน" ทั้งที่ไม่ได้
   * ซ่อนใครเลย และกด "ดูว่าใครบ้าง" ก็ไม่มีใครโผล่ · เป็นอาการ "เลขถูกแต่ตอบผิดคำถาม"
   * แบบเดียวกับที่เจ้าของเคยทักเรื่อง funnel หน้า Follow (โชว์ 5,307 ทั้งที่ส่งเอง 1 คน)
   *
   * นับจากผลแมทที่กำลังจะแสดงจริง หลังผ่านตัวกรองตัวอื่นครบแล้ว
   */
  const hiddenDeclinedCount = useMemo(() => {
    if (!jobDetail) return 0;
    const board = (boardMatchById[jobDetail.id]?.matches ?? []).filter(
      (m) =>
        (showDistantCandidates || isRecommendedTier(m.tier)) &&
        !(hideProposed && proposedByKey[proposalKey('board', m.card_id)]) &&
        declinedRefs.has(boardPersonRef(m.card_id)),
    ).length;
    const ir = (irMatchById[jobDetail.id]?.matches ?? []).filter(
      (m) =>
        (showDistantCandidates || isRecommendedTier(m.tier)) &&
        !(hideProposed && proposedByKey[proposalKey('irecruit', m.id)]) &&
        declinedRefs.has(irecruitPersonRef(m.id)),
    ).length;
    return board + ir;
  }, [
    jobDetail,
    boardMatchById,
    irMatchById,
    declinedRefs,
    showDistantCandidates,
    hideProposed,
    proposedByKey,
  ]);

  /**
   * "อนุมัติทั้งใบ" — ทุกคนที่กำลังแสดงอยู่ในใบนี้และส่งได้จริง
   * (เจ้าของสั่ง 11 ส.ค. 2569: "กดอนุมัติทั้งใบงานให้ AI โทร หรือเลือกแล้วกดส่งก็ได้")
   *
   * ⚠️ ใช้เงื่อนไข "ส่งได้" **ชุดเดียวกับช่องติ๊ก** เป๊ะ (มีเบอร์ · ยังไม่เคยเข้าคิวใบนี้ ·
   * ไม่มีเจ้าหน้าที่ถืออยู่) ไม่งั้นกดอนุมัติทั้งใบแล้วได้จำนวนไม่ตรงกับที่ติ๊กเองทีละคน
   * ซึ่งอธิบายให้ผู้ใช้ไม่ได้ · และไม่รวมคนที่ปฏิเสธใบนี้ไปแล้ว (ถูกซ่อนอยู่)
   */
  const approveAllTargets = useMemo(() => {
    if (!jobDetail) return { board: [] as number[], irecruit: [] as number[] };
    const board = (boardMatchById[jobDetail.id]?.matches ?? [])
      .filter(
        (m) =>
          (showDistantCandidates || isRecommendedTier(m.tier)) &&
          !(hideProposed && proposedByKey[proposalKey('board', m.card_id)]) &&
          !declinedRefs.has(boardPersonRef(m.card_id)) &&
          Boolean(m.mobile) &&
          !lumosStatusByRef[boardPersonRef(m.card_id)] &&
          !holdByRef[String(m.card_id)],
      )
      .map((m) => m.card_id);
    const irecruit = (irMatchById[jobDetail.id]?.matches ?? [])
      .filter(
        (m) =>
          (showDistantCandidates || isRecommendedTier(m.tier)) &&
          !(hideProposed && proposedByKey[proposalKey('irecruit', m.id)]) &&
          !declinedRefs.has(irecruitPersonRef(m.id)) &&
          Boolean(m.phone_number) &&
          !lumosStatusByRef[irecruitPersonRef(m.id)],
      )
      .map((m) => m.id);
    return { board, irecruit };
  }, [
    jobDetail,
    boardMatchById,
    irMatchById,
    declinedRefs,
    showDistantCandidates,
    hideProposed,
    proposedByKey,
    lumosStatusByRef,
    holdByRef,
  ]);

  const approveAllCount = approveAllTargets.board.length + approveAllTargets.irecruit.length;

  /**
   * กดอนุมัติทั้งใบ = ติ๊กให้ครบแล้วเปิดหน้าต่างยืนยันตัวเดิม
   * ⚠️ **ต้องผ่านหน้าต่างยืนยันเสมอ** — ปุ่มนี้ยิงสายจริงทีเดียวหลายสิบคน
   * หน้าต่างนั้นโชว์รายชื่อ+เบอร์ทุกคนและเตือนว่า "AI จะโทรหาคนเหล่านี้จริง" อยู่แล้ว
   */
  const approveWholeJob = () => {
    if (approveAllCount === 0) return;
    setLumosSelectedBoard(approveAllTargets.board);
    setLumosSelectedIrecruit(approveAllTargets.irecruit);
    setLumosConfirmOpen(true);
  };

  /** ชื่อ/เบอร์ของ card_id ที่เลือก — หาจากผลแมทก่อน ไม่เจอค่อยดูใน pool (คนเพิ่มใหม่) */
  const boardPersonLabel = (cardId: number): { name: string; phone: string | null } => {
    const fromMatch = (boardMatchById[jobDetail?.id ?? '']?.matches ?? []).find((m) => m.card_id === cardId);
    if (fromMatch) return { name: fromMatch.full_name, phone: fromMatch.mobile };
    const fromPool = lumosPool.find((c) => c.card_id === cardId);
    if (fromPool) return { name: fromPool.full_name, phone: fromPool.mobile };
    return { name: `การ์ด #${cardId}`, phone: null };
  };

  const openLumosPicker = async () => {
    if (!jobDetail) return;
    setLumosPickerOpen(true);
    setLumosPoolSearch('');
    setLumosPoolLoading(true);
    setLumosError(null);
    try {
      const { items, pool } = await listLumosCallStatusWithPool(jobDetail.id);
      setLumosStatusByRef(indexLumosCallStatus(items));
      setLumosPool(pool);
    } catch (e) {
      setLumosError(e instanceof Error ? e.message : 'โหลดรายชื่อคนของเราไม่สำเร็จ');
    } finally {
      setLumosPoolLoading(false);
    }
  };

  const clearLumosSelection = () => {
    setLumosSelectedBoard([]);
    setLumosSelectedIrecruit([]);
    // งานอื่นที่เลือกไว้ใน popup ผูกกับการติ๊กรอบนี้ — ล้างพร้อมกันเสมอ
    setExtraJobsByCard({});
  };

  const toggleLumosBoard = (cardId: number) =>
    setLumosSelectedBoard((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId],
    );

  const toggleLumosIrecruit = (id: number) =>
    setLumosSelectedIrecruit((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const loadLumosStatus = async (jobId: string) => {
    try {
      setLumosStatusByRef(indexLumosCallStatus(await listLumosCallStatus(jobId)));
    } catch {
      // ไม่ให้ล้มการเปิดใบขอ — แค่ไม่มีป้ายผลการโทร
      setLumosStatusByRef({});
    }
  };

  /**
   * ตั้งคนที่ติ๊กไว้เป็น "ชุดคิวโทร" — เข้าคิวจริงเมื่อพ้นช่วงถอนคำ
   *
   * ⚠️ ไม่มีขั้นอนุมัติแล้ว (เจ้าของเคาะ 11 ส.ค. 2569) — API ตอบกลับมาเป็นชุดที่
   * `approved` พร้อม `releaseAt` อยู่ข้างหน้า · ตัวกันพลาดคือแถบถอนคำ ไม่ใช่คนอนุมัติ
   *
   * ⚠️ หนึ่งชุด = หนึ่งช่อง (บอร์ด→reminder · iRecruit→interview) API ตอบ 400 ถ้าส่งปนกัน
   * เลือกปนสองฝั่งจึงต้องยิงสองครั้ง = ได้ 2 ชุด ไม่ใช่ชุดเดียว
   * ถ้าครั้งที่สองล้ม ชุดแรกที่สร้างไปแล้วยังอยู่ — บอกผู้ใช้ตรง ๆ ว่าอะไรสำเร็จไปแล้ว
   * จะได้ไม่กดซ้ำจนเกิดชุดซ้อน (และชุดแรกก็ยังโผล่ในแถบถอนคำให้กดยกเลิกได้)
   */
  const createBatchFromSelection = async () => {
    if (!jobDetail || lumosSelectedCount === 0) return;
    setBatchCreating(true);
    setLumosError(null);
    setLumosNotice(null);
    const done: string[] = [];
    const created: CallBatch[] = [];
    try {
      if (lumosSelectedBoard.length > 0) {
        created.push(await createCallBatch({ jobId: jobDetail.id, boardCardIds: lumosSelectedBoard }));
        done.push(`คนของเรา ${lumosSelectedBoard.length} คน`);
      }
      if (lumosSelectedIrecruit.length > 0) {
        created.push(await createCallBatch({ jobId: jobDetail.id, irecruitIds: lumosSelectedIrecruit }));
        done.push(`iRecruit ${lumosSelectedIrecruit.length} คน`);
      }
      clearLumosSelection();
      setLumosNotice(
        `ตั้งคิวโทรแล้ว — ${done.join(' · ')} · เข้าคิวจริงในอีก ${CALL_BATCH_UNDO_MINUTES} นาที ยกเลิกได้จากแถบด้านล่าง`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ตั้งคิวไม่สำเร็จ';
      setLumosError(done.length > 0 ? `${msg} (ที่ตั้งคิวสำเร็จแล้ว: ${done.join(' · ')})` : msg);
    } finally {
      // ชุดที่สร้างทันก่อนล้มต้องเข้าแถบถอนคำด้วย ไม่งั้นของที่ยิงไปแล้วไม่มีทางถอน
      if (created.length > 0) setPendingBatches((prev) => [...prev, ...created]);
      setBatchCreating(false);
    }
  };

  /** ถอนคำ — ยกเลิกชุดที่ยังไม่ถึงเวลาปล่อย (ชุดที่ปล่อยไปแล้ว API ตอบ 409) */
  const cancelPendingBatch = async (batchId: string) => {
    setBatchCancellingId(batchId);
    setLumosError(null);
    try {
      await cancelCallBatch(batchId, 'ถอนคำจากหน้า Matching');
      setPendingBatches((prev) => prev.filter((b) => b.id !== batchId));
      setLumosNotice('ยกเลิกชุดแล้ว — ไม่มีใครถูกโทรจากชุดนี้');
    } catch (e) {
      setLumosError(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setBatchCancellingId(null);
    }
  };

  /**
   * ก่อนเปิดหน้าต่างยืนยันส่ง AI โทร — คนที่ติ๊กไว้ถ้าแมทหลายงาน ต้องมี popup
   * ให้เลือกก่อนว่าจะส่งไปงานไหนบ้าง (เจ้าของสั่ง 12 ส.ค. 2569)
   * ไม่มีใครแมทหลายงาน = ข้ามไปหน้าต่างยืนยันเลยเหมือนเดิม
   */
  const beginSendFlow = () => {
    const multi = lumosSelectedBoard.filter(
      (cardId) => (jobMatchesByCard[String(cardId)] ?? []).length >= 2,
    );
    if (multi.length === 0) {
      setExtraJobsByCard({});
      setLumosConfirmOpen(true);
      return;
    }
    // ค่าเริ่มต้น: ส่งเฉพาะใบที่เปิดอยู่ (ใบอื่นให้คนเลือกติ๊กเพิ่มเอง — ไม่เดาแทน)
    setExtraJobsByCard({});
    setJobPickOpen(true);
  };

  const sendSelectedToLumos = async () => {
    if (!jobDetail || lumosSelectedCount === 0) return;
    setLumosSending(true);
    setLumosError(null);
    setLumosNotice(null);
    try {
      const result = await dispatchLumosCalls({
        jobId: jobDetail.id,
        boardCardIds: lumosSelectedBoard,
        irecruitIds: lumosSelectedIrecruit,
      });
      // ส่งไป "งานอื่น" ที่เลือกไว้ใน popup — ยิงทีละใบ (API รับทีละ jobId)
      // ใบไหนล้มไม่ดึงทั้งก้อนลง: รวมผลแล้วรายงานตรง ๆ ว่าใบไหนไม่สำเร็จ
      const extraByJob = new Map<string, number[]>();
      for (const [cardIdStr, jobIds] of Object.entries(extraJobsByCard)) {
        const cardId = Number(cardIdStr);
        if (!lumosSelectedBoard.includes(cardId)) continue;
        for (const jid of jobIds) {
          if (jid === jobDetail.id) continue;
          extraByJob.set(jid, [...(extraByJob.get(jid) ?? []), cardId]);
        }
      }
      let extraQueued = 0;
      const extraFailed: string[] = [];
      for (const [jid, cardIds] of extraByJob) {
        try {
          const r = await dispatchLumosCalls({ jobId: jid, boardCardIds: cardIds, irecruitIds: [] });
          extraQueued += r.queued;
        } catch {
          const label =
            (jobMatchesByCard[String(cardIds[0])] ?? []).find((j) => j.jobId === jid)?.requestNo ?? jid;
          extraFailed.push(label);
        }
      }
      setExtraJobsByCard({});
      setLumosStatusByRef(indexLumosCallStatus(result.items));
      // pool ที่โหลดไว้ต้องรู้ว่าคนเหล่านี้ส่งแล้ว ไม่งั้นเปิด picker ซ้ำจะยังติ๊กได้
      const justSent = new Set(lumosSelectedBoard);
      setLumosPool((prev) =>
        prev.map((c) => (justSent.has(c.card_id) ? { ...c, already_sent: true } : c)),
      );
      clearLumosSelection();
      setLumosConfirmOpen(false);
      const parts = [`เข้าคิว AI โทร ${result.queued} คน`];
      if (result.duplicated.length > 0) parts.push(`เคยส่งไปแล้ว ${result.duplicated.length} คน (ไม่ส่งซ้ำ)`);
      if (result.skipped.length > 0) {
        parts.push(
          `ส่งไม่ได้ ${result.skipped.length} คน: ${result.skipped.map((s) => s.name).join(', ')} — ${result.skipped[0].reason}`,
        );
      }
      if (extraQueued > 0) parts.push(`ส่งไปงานอื่นที่เลือกไว้อีก ${extraQueued} รายการ`);
      if (extraFailed.length > 0) parts.push(`⚠️ ส่งไปงาน ${extraFailed.join(', ')} ไม่สำเร็จ`);
      setLumosNotice(parts.join(' · '));
    } catch (e) {
      setLumosError(e instanceof Error ? e.message : 'ส่ง AI โทรไม่สำเร็จ');
    } finally {
      setLumosSending(false);
    }
  };

  /**
   * "เก็บไปโทรเอง" — จับ call hold ให้ตัวเองแทนส่ง AI (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก)
   * วน**ทีละคน** (sequential) — เลือกคนเดียวกันจากสองแหล่ง เบอร์เดียวกันตัวหลังจะเจอ
   * 409 ของตัวเราเอง ซึ่ง summarize นับเป็น "อยู่ในถังอยู่แล้ว" ไม่ใช่ conflict
   * ล็อกสำเร็จ = AI ไม่โทรทับ (insertQueueItems กรองเบอร์ที่ถูกถือทุกเส้นอยู่แล้ว)
   */
  const holdSelectedForSelf = async () => {
    if (!jobDetail || lumosSelectedCount === 0 || holdingSelf) return;
    setHoldingSelf(true);
    setLumosError(null);
    setLumosNotice(null);
    try {
      const targets: HoldTarget[] = [
        ...lumosSelectedBoard.map((cardId): HoldTarget => {
          const m = openJobMatches?.find((x) => x.card_id === cardId);
          return {
            candidateRef: String(cardId),
            candidateName: m?.full_name ?? null,
            phone: m?.mobile ?? null,
            jobId: jobDetail.id,
            requestNo: jobDetail.request_no ?? null,
            source: 'board',
          };
        }),
        ...lumosSelectedIrecruit.map((id): HoldTarget => {
          const m = openJobIrMatches?.find((x) => x.id === id);
          return {
            candidateRef: String(id),
            candidateName: m?.full_name ?? null,
            phone: m?.phone_number ?? null,
            jobId: jobDetail.id,
            requestNo: jobDetail.request_no ?? null,
            source: 'irecruit',
          };
        }),
      ];
      const { ready, noPhone, noJob } = partitionHoldTargets(targets);
      const results: Array<{ target: HoldTarget; result: Awaited<ReturnType<typeof acquireCallHold>> }> = [];
      for (const t of ready) {
        const result = await acquireCallHold({
          phone: t.phone!,
          source: t.source,
          candidateRef: t.candidateRef,
          candidateName: t.candidateName,
          jobId: t.jobId!,
          requestNo: t.requestNo ?? null,
        });
        results.push({ target: t, result });
        // อัปเดตป้าย 🔒 ทันทีทั้งเคสสำเร็จและเคสมีคนถือ (คีย์ด้วย ref ของการ์ดที่เลือก
        // ไม่ใช่ ref ในล็อก — คนเดียวกันคนละแหล่ง ref คนละชุดแต่เบอร์เดียวกัน)
        const hold = result.ok ? result.hold : result.heldBy;
        if (hold) setHoldByRef((prev) => ({ ...prev, [t.candidateRef]: hold }));
      }
      clearLumosSelection();
      const summary = summarizeAcquireResults({
        results,
        viewerName: user?.email ?? null,
        skippedNoPhone: noPhone.length,
        skippedNoJob: noJob.length,
      });
      setLumosNotice(`${summary} — ไปโทร+บันทึกผลที่หน้า "โทรของฉัน"`);
    } catch (e) {
      setLumosError(e instanceof Error ? e.message : 'เก็บเข้าถังโทรไม่สำเร็จ');
    } finally {
      setHoldingSelf(false);
    }
  };

  const cancelLumosForRef = async (row: LumosCallStatus) => {
    if (!jobDetail) return;
    setLumosCancellingRef(row.person_ref);
    setLumosError(null);
    try {
      const items = await cancelLumosCall({
        jobId: jobDetail.id,
        channel: row.channel,
        ref: row.person_ref,
      });
      setLumosStatusByRef(indexLumosCallStatus(items));
      setLumosNotice('ยกเลิกการส่งแล้ว');
    } catch (e) {
      setLumosError(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setLumosCancellingRef((cur) => (cur === row.person_ref ? null : cur));
    }
  };

  useEffect(() => {
    apiFetch('/api/matching/board-candidates?pool=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.pool) setPool(d.pool);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch('/api/job-staff')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        const names = [
          ...(Array.isArray(data.recruiters) ? data.recruiters : []),
          ...(Array.isArray(data.screeners) ? data.screeners : []),
          ...(Array.isArray(data.opls) ? data.opls : []),
        ].filter((name): name is string => typeof name === 'string' && Boolean(name.trim()));
        setRosterOperatorNames(names);
      })
      .catch(() => {});
  }, []);

  const proposalOperatorOptions = useMemo(() => {
    const names = [
      user?.full_name,
      user?.email,
      ...rosterOperatorNames,
      jobDetail?.recruiter_name,
      jobDetail?.screener_name,
      jobDetail?.opl_name,
    ];
    const unique = new Map<string, string>();
    for (const name of names) {
      const trimmed = name?.trim();
      if (trimmed && !unique.has(trimmed.toLowerCase())) unique.set(trimmed.toLowerCase(), trimmed);
    }
    return [...unique.values()].sort((a, b) => a.localeCompare(b, 'th'));
  }, [jobDetail, rosterOperatorNames, user]);

  const refreshActiveProposals = async () => {
    const items = await listActiveProposals();
    const next: Record<string, CandidateProposal> = {};
    for (const item of items) next[proposalKey(item.source, item.candidate_ref)] = item;
    setActiveProposalByCandidate(next);
  };

  useEffect(() => {
    if (jobs.length === 0) return;
    let cancelled = false;
    void listProposalsForJobs(jobs.map((job) => job.id)).then((byJob) => {
      if (!cancelled) {
        // ในโหมด server ใช้ serverItems (เปลี่ยนตามหน้า) → สะสมแทน replace
        // เพื่อไม่ให้ proposal ของหน้าก่อนหายเมื่อเปลี่ยนหน้า
        if (MATCHING_SERVER_LIST_ENABLED) {
          setProposalsByJobId((prev) => ({ ...prev, ...byJob }));
        } else {
          setProposalsByJobId(byJob);
        }
      }
    });
    void refreshActiveProposals();
    return () => {
      cancelled = true;
    };
  }, [jobs]);

  const syncSavedProposal = (saved: CandidateProposal) => {
    setProposedByKey((prev) => ({
      ...prev,
      [proposalKey(saved.source, saved.candidate_ref)]: proposalRefFromItem(saved),
    }));
    setProposalsByJobId((prev) => {
      const list = prev[saved.job_id] ?? [];
      const nextList = [saved, ...list.filter((item) => item.id !== saved.id)];
      return { ...prev, [saved.job_id]: nextList };
    });
    void refreshActiveProposals();
  };

  const clearBoardWaiting = (jobId: string) =>
    setBoardWaitingById((prev) => {
      if (!(jobId in prev)) return prev;
      const next = { ...prev };
      delete next[jobId];
      return next;
    });

  // AI คิดที่ worker หลังบ้านเท่านั้น — GET นี้แค่ดึงผลที่ค้นเสร็จแล้ว (หรือส่งใบเข้าคิวถ้ายังไม่มี)
  const fetchBoardMatch = async (jobId: string, refresh = false) => {
    setBoardLoadingId(jobId);
    setBoardErrorById((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    try {
      const params = new URLSearchParams({ jobId });
      if (refresh) params.set('refresh', '1');
      const r = await apiFetch(`/api/matching/board-candidates?${params.toString()}`);
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { message?: string; detail?: string; error?: string };
        throw new Error(data.message || data.detail || data.error || `ค้นหาไม่สำเร็จ (HTTP ${r.status})`);
      }
      const data = (await r.json()) as BoardMatchResponse;
      if (data.pending) {
        if (data.worker_active === false) {
          setBoardErrorById((prev) => ({
            ...prev,
            [jobId]: 'ระบบค้นหาหลังบ้านปิดอยู่ — ต้องเปิด MATCH_PRECOMPUTE_ENABLED บนเซิร์ฟเวอร์ก่อนจึงจะมีผลใหม่',
          }));
          return;
        }
        setBoardWaitingById((prev) => ({ ...prev, [jobId]: { baseline: null } }));
        return;
      }
      setBoardMatchById((prev) => ({ ...prev, [jobId]: data }));
      if (data.refresh_queued) {
        // สั่งคิดใหม่แล้ว — คงผลเดิมไว้ก่อน แล้วรอผลใหม่ (computed_at เปลี่ยน) มาแทน
        setBoardWaitingById((prev) => ({ ...prev, [jobId]: { baseline: data.computed_at ?? null } }));
      } else if (refresh && data.worker_active === false) {
        setBoardErrorById((prev) => ({
          ...prev,
          [jobId]: 'ระบบค้นหาหลังบ้านปิดอยู่ — แสดงผลเดิมไว้ก่อน (ต้องเปิด MATCH_PRECOMPUTE_ENABLED จึงจะคิดใหม่ได้)',
        }));
      } else {
        clearBoardWaiting(jobId);
      }
    } catch (e) {
      setBoardErrorById((prev) => ({ ...prev, [jobId]: e instanceof Error ? e.message : 'ค้นหาไม่สำเร็จ' }));
    } finally {
      setBoardLoadingId((current) => (current === jobId ? null : current));
    }
  };

  // ระหว่างรอ worker หลังบ้าน — เช็คผลซ้ำทุก 15 วิ เฉพาะใบที่เปิดดูอยู่ (ผลใหม่มาแล้วแสดงเองอัตโนมัติ)
  useEffect(() => {
    const jobId = jobDetail?.id;
    if (!jobId) return;
    const waiting = boardWaitingById[jobId];
    if (!waiting) return;
    const timer = setInterval(async () => {
      try {
        const r = await apiFetch(`/api/matching/board-candidates?jobId=${encodeURIComponent(jobId)}`);
        if (!r.ok) return;
        const data = (await r.json()) as BoardMatchResponse;
        if (data.pending) return;
        if (waiting.baseline && data.computed_at === waiting.baseline) return; // ยังเป็นผลเดิม
        setBoardMatchById((prev) => ({ ...prev, [jobId]: data }));
        clearBoardWaiting(jobId);
      } catch {
        /* เงียบ — รอบถัดไป */
      }
    }, 15_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobDetail?.id, boardWaitingById]);

  // เปิดใบขอ → หาคนของเราอัตโนมัติ + โหลดสถานะการเสนอ/คำขอโพสหางานที่เคยบันทึก
  const openJob = (j: JobRequest) => {
    setJobDetail({ ...j, ...(localJobEditsById[j.id] || {}) });
    setShowDistantCandidates(true);
    setProposeError(null);
    setPostingError(null);
    // Lumos: เริ่มใหม่ทุกครั้งที่เปิดใบขอ (การเลือกผูกกับใบขอที่เปิดอยู่ใบเดียว)
    clearLumosSelection();
    setLumosStatusByRef({});
    setLumosError(null);
    setLumosNotice(null);
    setLumosExpandedRef(null);
    setLumosPickerOpen(false);
    setLumosPool([]);
    setLumosPoolSearch('');
    void loadLumosStatus(j.id);
    if (!boardMatchById[j.id] && boardLoadingId !== j.id) void fetchBoardMatch(j.id);
    void listProposalsForJob(j.id).then((items) => {
      setProposedByKey(() => {
        const next: Record<string, ProposedRef> = {};
        for (const p of items) next[proposalKey(p.source, p.candidate_ref)] = proposalRefFromItem(p);
        return next;
      });
      setProposalsByJobId((prev) => ({ ...prev, [j.id]: items }));
    });
    void getActiveJobPostingForJob(j.id).then((item) => {
      if (item) setJobPostingByJobId((prev) => ({ ...prev, [j.id]: item }));
    });
  };

  // เปิดจาก URL (?jobId=...) — เช่นลิงก์ "เปิดใบขอ" จากหน้ารายชื่อคนจอง/คำขอโพสหางาน
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (!jobId) return;
    // หาจาก items ที่มีอยู่ก่อน (เร็ว)
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      openJob(job);
      return;
    }
    // ในโหมด server: serverItems มีแค่หน้าปัจจุบัน → fetch เดี่ยวถ้ายังไม่โหลด
    if (MATCHING_SERVER_LIST_ENABLED && !serverListLoading) {
      void fetchSiamrajUnitRequest(jobId)
        .then((j) => openJob(j))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, jobs, serverListLoading]);

  // ตัวกรองจาก URL (?urgent=1&workflow=...&bu=LBD) — ลิงก์จากหน้าสรุปการไหลของงานบน HomePage
  useEffect(() => {
    if (searchParams.get('urgent') === '1') setUrgentOnly(true);
    const wf = searchParams.get('workflow');
    if (wf && (['all', 'sla', 'green', 'yellow', 'recommended', 'none', 'reserved'] as const).includes(wf as WorkflowFilter)) {
      setWorkflowFilter(wf as WorkflowFilter);
    }
    const bu = (searchParams.get('bu') || '').trim().toUpperCase();
    if (bu) setBuFilter(bu);
    // ครั้งเดียวตอน mount — หลังจากนั้นให้ผู้ใช้คุมเอง
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // บันทึกการเสนอ/จองตัว/ลงงาน "คนของเรา" (board) ลง DB
  const proposeBoard = async (
    job: JobRequest,
    m: BoardCandidateMatch,
    status: ProposalStatus,
    operatorName: string,
    decisionReason: string,
  ) => {
    const key = proposalKey('board', m.card_id);
    setProposingKey(key);
    setProposeError(null);
    try {
      const saved = await saveProposal({
        jobId: job.id,
        requestNo: job.request_no,
        source: 'board',
        candidateRef: m.card_id,
        candidateName: m.full_name,
        candidatePhone: m.mobile,
        candidatePosition: [m.job1_name, m.job2_name].filter(Boolean).join(' / ') || null,
        tier: m.tier,
        reason: decisionReason,
        operatorName,
        status,
      });
      syncSavedProposal(saved);
    } catch (e) {
      if (e instanceof ProposalConflictError) {
        setConflictInfo({
          message: e.message,
          conflict: e.conflict,
          operatorName,
          decisionReason,
          retry: () => proposeBoard(job, m, status, operatorName, decisionReason),
        });
      } else {
        setProposeError(e instanceof Error ? e.message : 'บันทึกการเสนอไม่สำเร็จ');
      }
    } finally {
      setProposingKey((cur) => (cur === key ? null : cur));
    }
  };

  // ยกเลิกการเสนอ/จองที่มีอยู่ (ปลดล็อกให้เสนอใบขออื่นได้)
  const cancelExisting = async (key: string, operatorName: string, decisionReason: string) => {
    const ref = proposedByKey[key];
    if (!ref) return;
    setProposingKey(key);
    setProposeError(null);
    try {
      const cancelled = await cancelProposal(ref.id, { operatorName, reason: decisionReason });
      syncSavedProposal(cancelled);
    } catch (e) {
      setProposeError(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setProposingKey((cur) => (cur === key ? null : cur));
    }
  };

  // ยกเลิกการจองเดิมที่ชนกัน แล้วลองเสนอใบขอนี้ใหม่อีกครั้ง
  const resolveConflict = async () => {
    if (!conflictInfo) return;
    setResolvingConflict(true);
    try {
      await cancelProposal(conflictInfo.conflict.id, {
        operatorName: conflictInfo.operatorName,
        reason: `ยกเลิกการจองเดิมเพื่อย้ายผู้สมัครมาใบขอใหม่ · ${conflictInfo.decisionReason}`,
      });
      await conflictInfo.retry();
      setConflictInfo(null);
    } catch (e) {
      setProposeError(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setResolvingConflict(false);
    }
  };

  // #1 สร้างคำขอโพสหางานใหม่ (สร้าง ID ให้ทีมคอนเทนต์/สรรหารับไปทำต่อ)
  const composePostingReason = (job: JobRequest): string => {
    const bm = boardMatchById[job.id];
    const recommended = recommendedCandidateCount(bm?.matches);
    if (!bm || recommended === 0) return 'ไม่มีคนของเราที่สกิลตรงกับใบขอนี้';
    return `มีคนของเราเข้าข่าย ${recommended} คน (จาก pool ${bm.pool_size}) แต่ยังไม่โอเค/ไม่เพียงพอ`;
  };

  /** ข้อมูลใบขอที่ทีมคอนเทนต์ต้องใช้ (ตำแหน่ง/พื้นที่/รายได้ ฯลฯ) — หน้านี้มีครบอยู่แล้ว
      แนบไปกับคำขอเลย ปลายทาง (api-scraper) จะได้ไม่เห็นแค่เลขใบขอ */
  const composeJobSnapshot = (job: JobRequest): Record<string, unknown> => ({
    position: job.staff_title_name || job.request_action_name || null,
    unit_name: job.unit_name || null,
    location: job.location_address || null,
    income: job.total_income || null,
    qty: job.request_positions ?? job.position_units ?? null,
    gender: job.gender_requirement || null,
    age_min: job.age_range_min ?? null,
    age_max: job.age_range_max ?? null,
    work_schedule: job.work_schedule || null,
    department: job.department_name || null,
    urgency: job.urgency || null,
    required_date: job.required_date || null,
    note: job.list_note || null,
  });

  const createPosting = async (job: JobRequest, requestType: JobPostingRequestType) => {
    setCreatingPosting(true);
    setPostingError(null);
    try {
      const item = await createJobPostingRequest({
        jobId: job.id,
        requestNo: job.request_no,
        reason: composePostingReason(job),
        requestType,
        jobSnapshot: composeJobSnapshot(job),
      });
      setJobPostingByJobId((prev) => ({ ...prev, [job.id]: item }));
    } catch (e) {
      setPostingError(e instanceof Error ? e.message : 'สร้างคำขอไม่สำเร็จ');
    } finally {
      setCreatingPosting(false);
    }
  };

  // ค้นหาผู้สมัครจากฐาน iRecruit สำหรับใบขอนี้ (inline ในหน้า match)
  const fetchIrecruit = async (jobId: string, refresh = false) => {
    setIrLoadingId(jobId);
    setIrErrorById((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    try {
      const params = new URLSearchParams({ jobId });
      if (refresh) params.set('refresh', '1');
      const r = await apiFetch(`/api/matching/irecruit-candidates?${params.toString()}`);
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { message?: string; detail?: string; error?: string };
        throw new Error(data.message || data.detail || data.error || `ค้นหาไม่สำเร็จ (HTTP ${r.status})`);
      }
      const data = (await r.json()) as IrecruitMatchResult;
      setIrMatchById((prev) => ({ ...prev, [jobId]: data }));
    } catch (e) {
      setIrErrorById((prev) => ({ ...prev, [jobId]: e instanceof Error ? e.message : 'ค้นหาไม่สำเร็จ' }));
    } finally {
      setIrLoadingId((current) => (current === jobId ? null : current));
    }
  };

  // บันทึกการเสนอ/จองตัว/ลงงานผู้สมัคร iRecruit ลง DB (พร้อมเหตุผล)
  const proposeIrecruit = async (
    job: JobRequest,
    m: IrecruitCandidateMatch,
    status: ProposalStatus,
    operatorName: string,
    decisionReason: string,
    branchId?: string | null,
    branchName?: string | null,
  ) => {
    const key = proposalKey('irecruit', m.id);
    setProposingKey(key);
    setProposeError(null);
    try {
      const saved = await saveProposal({
        jobId: job.id,
        requestNo: job.request_no,
        source: 'irecruit',
        candidateRef: m.id,
        candidateName: m.full_name,
        candidatePhone: m.phone_number,
        candidatePosition: m.position_name || m.job_name_th || null,
        branchId,
        branchName,
        tier: m.tier,
        reason: decisionReason,
        operatorName,
        status,
      });
      syncSavedProposal(saved);
    } catch (e) {
      if (e instanceof ProposalConflictError) {
        setConflictInfo({
          message: e.message,
          conflict: e.conflict,
          operatorName,
          decisionReason,
          retry: () => proposeIrecruit(job, m, status, operatorName, decisionReason, branchId, branchName),
        });
      } else {
        setProposeError(e instanceof Error ? e.message : 'บันทึกการเสนอไม่สำเร็จ');
      }
    } finally {
      setProposingKey((cur) => (cur === key ? null : cur));
    }
  };

  // เปิดฟอร์มเพิ่มผู้สมัครโดยเติมข้อมูลจาก iRecruit ให้ก่อน
  // ยังไม่สร้างข้อมูลจนกว่าผู้ใช้จะตรวจสอบและกดบันทึกในฟอร์ม
  // ⚠️ ตอนนี้**ไม่มีปุ่มไหนเรียกแล้ว** (ปุ่มต่อแถว iRecruit ถูกถอด 13 ส.ค. 2569
  // ตามคำสั่ง "ใต้ชื่อคนเหลือแค่ปุ่มที่บอก") — เก็บไว้เพราะจะกลับมาใช้ตอนสร้าง
  // "ที่จอง/เก็บรายละเอียดจากผลโทรสนใจ" · ถ้าถึงตอนนั้นไม่ใช้ ให้ลบทั้งฟังก์ชัน
  const openIrecruitCandidatePrefill = (
    job: JobRequest,
    match: IrecruitCandidateMatch,
    branchName?: string | null,
  ) => {
    const [first, ...rest] = match.full_name.trim().split(/\s+/);
    const params = new URLSearchParams();
    if (first) params.set('first_name', first);
    if (rest.length) params.set('last_name', rest.join(' '));
    if (match.phone_number) params.set('phone', match.phone_number);
    if (match.age != null) params.set('age', String(match.age));
    if (match.sex) params.set('sex', match.sex);
    if (match.province_name) params.set('province', match.province_name);
    if (match.district_name) params.set('district', match.district_name);
    if (match.location_label) params.set('location_label', match.location_label);
    if (match.position_name || match.job_name_th) {
      params.set('job_name', match.position_name || match.job_name_th || '');
    }

    const reason = [
      branchName ? `สาขาที่เลือก: ${branchName}` : '',
      match.reason?.trim(),
      job.request_no ? `จากใบขอ ${job.request_no}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    if (reason) params.set('reason', reason);
    params.set('returnTo', `/matching/match?jobId=${encodeURIComponent(job.id)}`);
    navigate(`/matching/candidates/add?${params.toString()}`);
  };

  const openBranchEditor = (job: JobRequest) => {
    const drafts = branchDemandItems(job).map((branch, index): UnitBranchOverride => ({
      branch_id: branch.branch_id || `branch-${index + 1}`,
      branch_name_clean: branch.branch_name_clean,
      address_raw: branch.address_raw || branch.branch_name_raw || null,
      road: branch.road || null,
      subdistrict: branch.subdistrict || null,
      requested_qty: branch.requested_qty,
      district_hint: branch.district_hint,
      province_hint: branch.province_hint,
      postal_code: branch.postal_code || null,
      lat: branch.lat ?? null,
      lng: branch.lng ?? null,
      geocode_status: branch.geocode_status || 'unverified',
    }));
    setBranchEditAgeMin(job.age_range_min != null ? String(job.age_range_min) : '');
    setBranchEditAgeMax(job.age_range_max != null ? String(job.age_range_max) : '');
    setBranchEditGender(job.gender_requirement || '');
    setBranchDrafts(drafts);
    setBranchEditorError(null);
    setBranchEditorOpen(true);
  };

  const updateBranchDraft = (branchId: string, patch: Partial<UnitBranchOverride>) => {
    setBranchDrafts((current) =>
      current.map((branch) => (branch.branch_id === branchId ? { ...branch, ...patch } : branch)),
    );
  };

  const geocodeBranch = async (branch: UnitBranchOverride) => {
    const branchId = branch.branch_id || '';
    const address = [
      branch.branch_name_clean,
      branch.address_raw,
      branch.road,
      branch.subdistrict,
      branch.district_hint,
      branch.province_hint,
      branch.postal_code,
      'Thailand',
    ]
      .filter(Boolean)
      .join(' ');
    if (!address.trim()) return;
    setBranchGeocodeBusyId(branchId);
    setBranchEditorError(null);
    try {
      const response = await apiFetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      const data = (await response.json().catch(() => ({}))) as {
        lat?: number | string;
        lng?: number | string;
        formatted_address?: string;
        message?: string;
      };
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (!response.ok || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        updateBranchDraft(branchId, { lat: null, lng: null, geocode_status: 'not_found' });
        throw new Error(data.message || 'ค้นหาพิกัดสาขาไม่สำเร็จ');
      }
      updateBranchDraft(branchId, {
        lat,
        lng,
        address_raw: branch.address_raw || data.formatted_address || null,
        geocode_status: 'estimated',
      });
    } catch (error) {
      setBranchEditorError(error instanceof Error ? error.message : 'ค้นหาพิกัดสาขาไม่สำเร็จ');
    } finally {
      setBranchGeocodeBusyId(null);
    }
  };

  const saveBranchDrafts = async () => {
    if (!jobDetail) return;
    const branches = branchDrafts
      .map((branch, index): UnitBranchOverride => ({
        ...branch,
        branch_id: branch.branch_id || `branch-${index + 1}`,
        branch_name_clean: branch.branch_name_clean.trim(),
        requested_qty: Math.max(0, Math.floor(Number(branch.requested_qty) || 0)),
        district_hint: branch.district_hint?.trim() || null,
        province_hint: branch.province_hint?.trim() || null,
      }))
      .filter((branch) => branch.branch_name_clean);
    if (!branches.length) {
      setBranchEditorError('ต้องมีอย่างน้อย 1 สาขา');
      return;
    }
    setBranchSaveBusy(true);
    setBranchEditorError(null);
    try {
      const ageMin = branchEditAgeMin.trim() === '' ? null : Number(branchEditAgeMin);
      const ageMax = branchEditAgeMax.trim() === '' ? null : Number(branchEditAgeMax);
      if ((ageMin != null && !Number.isFinite(ageMin)) || (ageMax != null && !Number.isFinite(ageMax))) {
        setBranchEditorError('กรุณาระบุอายุเป็นตัวเลข');
        return;
      }
      if (ageMin != null && ageMax != null && ageMin > ageMax) {
        setBranchEditorError('อายุต่ำสุดต้องไม่มากกว่าอายุสูงสุด');
        return;
      }
      const gender = branchEditGender.trim() || null;
      const fieldOverrides = {
        ...(jobDetail.field_overrides || {}),
        age_min: ageMin,
        age_max: ageMax,
        gender,
        branches,
      };
      await saveUnitRequestMeta(unitRequestNoteKey(jobDetail), { field_overrides: fieldOverrides });
      const savedEdit: Partial<JobRequest> = {
        age_range_min: ageMin ?? undefined,
        age_range_max: ageMax ?? undefined,
        gender_requirement: gender ?? undefined,
        field_overrides: fieldOverrides,
      };
      setLocalJobEditsById((current) => ({
        ...current,
        [jobDetail.id]: { ...(current[jobDetail.id] || {}), ...savedEdit },
      }));
      setJobDetail((current) =>
        current
          ? {
              ...current,
              ...savedEdit,
            }
          : current,
      );
      setBoardMatchById((current) => {
        const next = { ...current };
        delete next[jobDetail.id];
        return next;
      });
      setIrMatchById((current) => {
        const next = { ...current };
        delete next[jobDetail.id];
        return next;
      });
      setBranchEditorOpen(false);
    } catch (error) {
      setBranchEditorError(error instanceof Error ? error.message : 'บันทึกสาขาไม่สำเร็จ');
    } finally {
      setBranchSaveBusy(false);
    }
  };

  const preferredOperatorName = (job: JobRequest): string =>
    job.recruiter_name?.trim() ||
    job.screener_name?.trim() ||
    job.opl_name?.trim() ||
    user?.full_name?.trim() ||
    proposalOperatorOptions[0] ||
    '';

  const prepareProposalAction = (
    draft: ProposalActionDraft,
    job: JobRequest,
    suggestedReason: string,
  ) => {
    setProposalOperatorName(preferredOperatorName(job));
    setProposalDecisionReason(suggestedReason);
    setProposalActionDraft(draft);
  };

  const openBoardProposalAction = (job: JobRequest, candidate: BoardCandidateMatch, status: ProposalStatus) => {
    prepareProposalAction(
      {
        candidateName: candidate.full_name,
        status,
        submit: (operatorName, reason) => proposeBoard(job, candidate, status, operatorName, reason),
      },
      job,
      suggestedProposalReason(status, candidate.reason),
    );
  };

  // ⚠️ ตอนนี้**ไม่มีปุ่มไหนเรียกแล้ว** (ปุ่มต่อแถว iRecruit ถูกถอด 13 ส.ค. 2569) —
  // เก็บไว้เพราะการจอง iRecruit จะย้ายไปทำจากผลโทร "สนใจ" · ถึงตอนนั้นไม่ใช้ให้ลบ
  const openIrecruitProposalAction = (
    job: JobRequest,
    candidate: IrecruitCandidateMatch,
    status: ProposalStatus,
    branchId?: string | null,
    branchName?: string | null,
  ) => {
    const reason = [
      branchName ? `สาขาที่เลือก: ${branchName}` : '',
      suggestedProposalReason(status, candidate.reason),
    ]
      .filter(Boolean)
      .join('\n');
    prepareProposalAction(
      {
        candidateName: candidate.full_name,
        status,
        submit: (operatorName, reason) =>
          proposeIrecruit(job, candidate, status, operatorName, reason, branchId, branchName),
      },
      job,
      reason,
    );
  };

  const openCancelProposalAction = (job: JobRequest, key: string, candidateName: string) => {
    prepareProposalAction(
      {
        candidateName,
        status: 'cancelled',
        submit: (operatorName, reason) => cancelExisting(key, operatorName, reason),
      },
      job,
      suggestedProposalReason('cancelled'),
    );
  };

  const submitProposalAction = async () => {
    if (!proposalActionDraft || !proposalOperatorName.trim() || !proposalDecisionReason.trim()) return;
    const draft = proposalActionDraft;
    const operatorName = proposalOperatorName.trim();
    const decisionReason = proposalDecisionReason.trim();
    // ปิดฟอร์มทันทีเพื่อไม่ให้ผู้ใช้รู้สึกว่าหน้าค้าง ระหว่าง API บันทึกให้การ์ดแสดงสถานะกำลังบันทึก
    setProposalActionDraft(null);
    setProposalDecisionReason('');
    setProposalFormBusy(true);
    try {
      await draft.submit(operatorName, decisionReason);
    } finally {
      setProposalFormBusy(false);
    }
  };

  const unitOptions = useMemo(() => {
    const names =
      MATCHING_SERVER_LIST_ENABLED && serverUnitOptions.length > 0
        ? serverUnitOptions
        : Array.from(
            new Set(
              jobs
                .filter((j) =>
                  buFilter ? (j.department_code || '').trim().toUpperCase() === buFilter : true,
                )
                .map((j) => j.unit_name)
                .filter(Boolean),
            ),
          ).sort((a, b) => a.localeCompare(b));
    return [
      { value: '', label: '— ทุกหน่วยงาน —' },
      ...names.map((name) => ({ value: name, label: name })),
    ];
  }, [jobs, serverUnitOptions, buFilter]);

  const clientRows = useMemo(
    () =>
      MATCHING_SERVER_LIST_ENABLED
        ? []
        : filterAndSortMatchingJobs(
            jobs,
            { search, urgentOnly, unitFilter, workflowFilter, buFilter, sort: sortBy },
            {
              hasReserved: (jobId) =>
                (proposalsByJobId[jobId] ?? []).some((item) => item.status === 'reserved'),
              matchesFor: (jobId) => boardMatchById[jobId]?.matches,
            },
          ),
    [jobs, search, urgentOnly, unitFilter, workflowFilter, buFilter, sortBy, proposalsByJobId, boardMatchById],
  );

  // เปลี่ยน BU = เปลี่ยนขอบเขต → ล้างหน่วยงานที่เลือกไว้ (คนละ BU มีหน่วยงานคนละชุด ไม่ล้างจะได้ลิสต์ว่าง)
  const selectBu = (code: string) => {
    setBuFilter(code);
    setUnitFilter('');
  };

  // ตัวเลือก BU ในตัวกรอง — server mode ใช้ facet จาก API, client mode นับจาก jobs ที่โหลดมา
  // ผู้ใช้ที่ถูกล็อก BU จะได้กลับมาแค่ BU เดียว → หน้าเว็บซ่อนช่อง BU ไปเลย
  const buOptions = useMemo(() => {
    const counts: Record<string, number> = MATCHING_SERVER_LIST_ENABLED
      ? serverBuCounts
      : jobs.reduce<Record<string, number>>((acc, j) => {
          const code = (j.department_code || '').trim().toUpperCase();
          if (code) acc[code] = (acc[code] ?? 0) + 1;
          return acc;
        }, {});
    const known = APP_DEPARTMENT_CODES.filter((c) => counts[c]);
    const extra = Object.keys(counts)
      .filter((c) => !(APP_DEPARTMENT_CODES as readonly string[]).includes(c))
      .sort();
    const codes = [...known, ...extra];
    if (codes.length <= 1) return codes.map((code) => ({ value: code, label: `BU ${code}` }));
    const total = codes.reduce((sum, code) => sum + (counts[code] ?? 0), 0);
    return [
      { value: '', label: `ทุก BU · ${total}` },
      ...codes.map((code) => ({ value: code, label: `${code} · ${counts[code] ?? 0}` })),
    ];
  }, [serverBuCounts, jobs]);

  // server mode: รายการถูกกรอง/เรียง/แบ่งหน้ามาจาก server แล้ว (สะสมทีละหน้า)
  const rows = MATCHING_SERVER_LIST_ENABLED ? serverItems : clientRows;
  const listTotal = MATCHING_SERVER_LIST_ENABLED ? serverTotal : clientRows.length;

  useEffect(() => {
    setClientPageNo(1);
  }, [search, urgentOnly, unitFilter, workflowFilter, buFilter, sortBy]);

  // แบ่งหน้าแบบชัดเจน (เปลี่ยนหน้า = แทนที่รายการ ไม่ต่อท้ายสะสม) — server ส่งมาทีละหน้าอยู่แล้ว
  const currentPage = MATCHING_SERVER_LIST_ENABLED ? serverPageNo : clientPageNo;
  const totalPages = Math.max(1, Math.ceil(listTotal / pageSize));
  const visibleRows = useMemo(
    () =>
      MATCHING_SERVER_LIST_ENABLED
        ? rows
        : rows.slice((clientPageNo - 1) * pageSize, clientPageNo * pageSize),
    [rows, clientPageNo, pageSize],
  );
  const pageRangeStart = listTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageRangeEnd = Math.min((currentPage - 1) * pageSize + visibleRows.length, listTotal);

  // เปลี่ยนจำนวนต่อหน้า → กลับหน้า 1 เสมอ (หน้าเดิมอาจเลยจำนวนหน้าใหม่) + จำค่าไว้ใช้ครั้งต่อไป
  const changePageSize = (size: number) => {
    if (size === pageSize) return;
    setPageSize(size);
    setClientPageNo(1);
    try {
      localStorage.setItem(MATCHING_PAGE_SIZE_KEY, String(size));
    } catch {
      /* ไม่ให้ storage ที่ปิดอยู่ทำให้เปลี่ยนจำนวนต่อหน้าไม่ได้ */
    }
  };

  const goToPage = (page: number) => {
    const target = Math.min(Math.max(1, page), totalPages);
    if (target === currentPage) return;
    listScrollPendingRef.current = true;
    if (MATCHING_SERVER_LIST_ENABLED) void fetchServerPage(target, false);
    else setClientPageNo(target);
  };

  // เลื่อนกลับหัวลิสต์ "หลัง" หน้าเปลี่ยนจริง — เลื่อนตอนสั่ง fetch จะโดน re-render ยกเลิก
  useEffect(() => {
    if (!listScrollPendingRef.current) return;
    listScrollPendingRef.current = false;
    listTopRef.current?.scrollIntoView({ block: 'start' });
  }, [currentPage]);

  /** รายการเลขหน้าแบบย่อ: 1 … ก่อนหน้า ปัจจุบัน ถัดไป … สุดท้าย */
  const pageItems = useMemo<Array<number | '…'>>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const sorted = Array.from(pages).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const items: Array<number | '…'> = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) items.push('…');
      items.push(sorted[i]);
    }
    return items;
  }, [currentPage, totalPages]);

  // นับ "คนของเราน่าจะตรง" ต่อใบขอแบบเบา (ไม่เรียก AI) โชว์ตั้งแต่หน้าแรก
  // #6 แม่นขึ้น: classify ใบขอเข้า job family ก่อน แล้วนับผู้สมัครที่สกิลอยู่ family เดียวกัน
  //   (แทน keyword ดิบที่ over-count จากคำกว้าง ๆ) — fallback เป็น keyword overlap ถ้า classify ไม่ได้
  const quickCountPoolIndex = useMemo(() => {
    const texts = pool.map((candidate) => `${candidate.job1_name || ''} ${candidate.job2_name || ''}`.toLowerCase());
    const familyCounts = Object.fromEntries(
      JOB_FAMILIES.map((family) => [
        family.code,
        texts.reduce((count, text) => count + (candidateMatchesFamily(text, family.code) ? 1 : 0), 0),
      ]),
    ) as Record<(typeof JOB_FAMILIES)[number]['code'], number>;
    return { texts, familyCounts };
  }, [pool]);

  const quickCounts = useMemo(() => {
    const out: Record<string, number> = {};
    if (quickCountPoolIndex.texts.length === 0) return out;
    for (const j of rows) {
      const title = jobTitleText(j);
      const family = classifyJobFamily(title);
      if (family) {
        out[j.id] = quickCountPoolIndex.familyCounts[family] ?? 0;
        continue;
      }
      const kws = fallbackKeywords(title);
      out[j.id] =
        kws.length === 0
          ? 0
          : quickCountPoolIndex.texts.filter((text) => kws.some((keyword) => text.includes(keyword))).length;
    }
    return out;
  }, [rows, quickCountPoolIndex]);

  // #4 dashboard เล็ก — แยกคำแนะนำ AI ออกจากสถานะจอง/ลงงานจริง
  // ถ้าวิเคราะห์แล้วให้นับเฉพาะสีเขียว; ถ้ายังไม่วิเคราะห์ใช้ quick count และติดป้ายว่าเป็นประมาณการ
  const urgentSummary = useMemo(() => {
    if (MATCHING_SERVER_LIST_ENABLED && serverSummary) {
      // server mode: นับจากผล AI ที่เก็บถาวรทั้งชุด (ครอบคลุมทุกใบ ไม่ใช่แค่หน้าที่โหลด)
      return {
        total: serverSummary.urgentTotal,
        greenSuggested: serverSummary.urgentWithGreen,
        none: serverSummary.urgentTotal - serverSummary.urgentWithGreen,
        analyzedCount: serverSummary.urgentAnalyzed,
      };
    }
    const urgent = rows.filter((j) => j.urgency === 'urgent');
    let greenSuggested = 0;
    let analyzedCount = 0;
    for (const j of urgent) {
      const analyzed = boardMatchById[j.id];
      if (analyzed) analyzedCount++;
      const hasGreenSuggestion = analyzed
        ? analyzed.matches.some((match) => match.tier === 'green')
        : (quickCounts[j.id] ?? 0) > 0;
      if (hasGreenSuggestion) greenSuggested++;
    }
    return { total: urgent.length, greenSuggested, none: urgent.length - greenSuggested, analyzedCount };
  }, [rows, quickCounts, boardMatchById, serverSummary]);

  /**
   * แถว "ฝั่งงาน" ที่ไปต่อหัวเส้นการโทรในแผงเดียวกัน (เจ้าของสั่ง 11 ส.ค. 2569)
   *
   * เดิมเป็นการ์ดพื้นอ่อน 5 ใบลอยอยู่ใต้แผง funnel — คนอ่านต้องกวาดตาสองที่แล้วต่อเรื่อง
   * เอาเองว่า "อัตราที่ยังไม่มีคน" กับ "สายที่โทรไป" เกี่ยวกันยังไง
   *
   * ⚠️ **ยังเป็นตัวกรองรายการด้านล่างเหมือนเดิม** — กล่องตัวกรองถูกเอาออกไปแล้ว
   * (10 ส.ค. 2569) การ์ดพวกนี้คือทางกรองทางเดียวที่เหลืออยู่ · ทำหายเมื่อไหร่
   * คนจะกรองรายการไม่ได้เลยนอกจากแก้ URL เอง
   *
   * ⚠️ อ่านซ้ายไปขวา: อัตราทั้งหมด (+ในนั้นด่วนเท่าไหร่) → แยกตามที่ AI หาคนได้
   * เขียว + เหลือง + ยังไม่มีคน = อัตราทั้งหมดพอดี · **"ด่วน" นับซ้อน** ไม่ใช่ขั้นในเส้น
   * จึงวางคู่กับ "อัตราทั้งหมด" ก่อนลูกศร ไม่ใช่คั่นกลางเส้นให้เข้าใจผิดว่าเป็นลำดับ
   */
  const demandFlowRow = useMemo(() => {
    if ((serverSummary?.scopedTotal ?? listTotal) <= 0) return null;
    const jobs = (n: number) => `${n.toLocaleString('th-TH')} ใบขอ`;
    const noneJobs = serverSummary?.noRecommend ?? urgentSummary.none;
    const unanalyzed = serverSummary?.noneUnanalyzed ?? 0;
    return (
      <div className={FUNNEL_ROW_GRID}>
        <FlowStage
          label="อัตราทั้งหมด"
          value={serverSummary?.positionsTotal ?? listTotal}
          sub={jobs(serverSummary?.scopedTotal ?? listTotal)}
          tone="neutral"
          active={!urgentOnly && workflowFilter === 'all'}
          disabled={serverListLoading}
          title='กดเพื่อดูเฉพาะ "อัตราทั้งหมด"'
          onClick={() => {
            setUrgentOnly(false);
            setWorkflowFilter('all');
          }}
        />
        <FlowArrow ghost />
        <FlowStage
          label="ในนั้นเป็นงานด่วน"
          value={serverSummary?.positionsUrgent ?? urgentSummary.total}
          sub={`${jobs(serverSummary?.urgentTotal ?? urgentSummary.total)} · นับซ้อนกับ 3 ถังขวา`}
          tone="danger"
          active={urgentOnly}
          disabled={serverListLoading}
          title='กดเพื่อดูเฉพาะ "อัตราด่วน"'
          onClick={() => {
            setUrgentOnly(true);
            setWorkflowFilter('all');
          }}
        />
        <FlowArrow ghost />
        {/* การ์ด "มีคนแนะนำ" (เขียว∪เหลือง) — เดิมช่องนี้เป็นช่องโบ๋ (FlowSlotFiller)
            เจ้าของทัก 12 ส.ค. 2569 ว่าแถวนี้เละ · ตำแหน่งนี้อยู่ตรงกับ "มีผลจริง" ของ
            เส้นการโทรพอดี ซึ่งเป็นการ์ด "ยอดรวมก่อนแตกถัง" เหมือนกัน — อ่านสองแถวขนานกันได้
            · เป็นบ้านของตัวกรอง workflow=recommended (ลิงก์ "AI แนะนำคนแล้ว" จากหน้าแรกเข้าที่นี่) */}
        <FlowStage
          label="มีคนแนะนำ"
          value={(serverSummary?.positionsGreen ?? urgentSummary.greenSuggested) + (serverSummary?.positionsYellow ?? 0)}
          sub={jobs((serverSummary?.withGreen ?? urgentSummary.greenSuggested) + (serverSummary?.withYellow ?? 0))}
          tone="info"
          active={workflowFilter === 'recommended'}
          disabled={serverListLoading}
          title='กดเพื่อดูเฉพาะ "มีคนแนะนำ" (เขียวหรือเหลือง)'
          onClick={() => {
            setUrgentOnly(false);
            setWorkflowFilter('recommended');
          }}
        />
        <FlowArrow />
        <FlowStage
          label="มีคนเขียวแนะนำ"
          value={serverSummary?.positionsGreen ?? urgentSummary.greenSuggested}
          sub={jobs(serverSummary?.withGreen ?? urgentSummary.greenSuggested)}
          tone="success"
          active={workflowFilter === 'green'}
          disabled={serverListLoading}
          title='กดเพื่อดูเฉพาะ "มีคนเขียวแนะนำ"'
          onClick={() => {
            setUrgentOnly(false);
            setWorkflowFilter('green');
          }}
        />
        <FlowStage
          label="มีคนเหลืองแนะนำ"
          value={serverSummary?.positionsYellow ?? 0}
          sub={jobs(serverSummary?.withYellow ?? 0)}
          tone="warn"
          active={workflowFilter === 'yellow'}
          disabled={serverListLoading}
          title='กดเพื่อดูเฉพาะ "มีคนเหลืองแนะนำ"'
          onClick={() => {
            setUrgentOnly(false);
            setWorkflowFilter('yellow');
          }}
        />
        <FlowStage
          label="ยังไม่มีคน"
          value={serverSummary?.positionsNone ?? urgentSummary.none}
          // แยกให้เห็นว่า "AI ดูแล้วไม่เจอ" กับ "ยังไม่ได้ดู" คนละงานที่ต้องทำต่อ
          sub={
            unanalyzed > 0
              ? `${jobs(noneJobs)} · ยังไม่ได้ประเมิน ${unanalyzed.toLocaleString('th-TH')}`
              : jobs(noneJobs)
          }
          tone="orange"
          active={workflowFilter === 'none'}
          disabled={serverListLoading}
          title='กดเพื่อดูเฉพาะ "ยังไม่มีคน"'
          onClick={() => {
            setUrgentOnly(false);
            setWorkflowFilter('none');
          }}
        />
        <FlowArrow ghost />
        <FlowSlotFiller />
      </div>
    );
  }, [serverSummary, listTotal, urgentSummary, urgentOnly, workflowFilter, serverListLoading]);

  const closeJob = () => {
    setJobDetail(null);
    if (searchParams.get('jobId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('jobId');
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div>
      {/* ช่องค้นหาอยู่แถวเดียวกับหัวเรื่องแบบหน้า Dashboard (เจ้าของสั่ง 10 ส.ค. 2569)
          เดิมอยู่ในกล่องตัวกรองใต้แผง funnel ซึ่งต้องเลื่อนลงไปหา */}
      <PageHeader
        title="Matching — คนของเรา"
        subtitle="เปิดใบขอ แล้วหาคนที่ผ่านสัมภาษณ์รอลงงานที่สกิลตรง"
        backPath="/matching"
        actions={
          <SearchField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา site / หน่วยงาน / ตำแหน่ง / สถานที่"
            wrapperClassName="w-full sm:w-[26rem]"
          />
        }
      />
      <div className="px-4 md:px-6 space-y-4">
        {/* การไหลของการโทร — เจ้าของสั่งให้มี "เฉพาะหน้านี้" (10 ส.ค. 2569)
            ใช้คอมโพเนนต์ตัวเดียวกับหน้า Follow ตัวเลข/นิยาม/โทนสีจึงมาจากที่เดียวกัน
            เริ่มที่ "ทั้งระบบ" เพราะงานโทรเกือบทั้งหมดออกจากหน้านี้อยู่แล้ว
            (ข้อมูลจริง: คนของเรา 5,280 + iRecruit 26 + Follow 1) แล้วกดสลับดูรายต้นทางได้
            หัวแผงบอกเสมอว่ากำลังดูต้นทางไหน จึงไม่ซ้ำรอย "เลขถูกแต่ตอบผิดคำถาม" */}
        {/* เจ้าของสั่ง 11 ส.ค. 2569: เอาการ์ดสรุปฝั่งงานเข้ามารวมกับการไหลของงาน
            "จะได้ติดตามได้ง่าย ๆ ในแบบ visual ที่ชัดเจน" — เดิมเป็นสองก้อนคนละที่
            คนอ่านต้องกวาดตาสองรอบแล้วต่อเรื่องเอาเองว่าอัตราที่ยังไม่มีคนกับสายที่โทรไป
            เกี่ยวกันยังไง · ตอนนี้อ่านรวดเดียว: มีอัตราเท่าไหร่ → AI หาคนได้แค่ไหน →
            โทรไปถึงไหนแล้ว
            ⚠️ การ์ดแถวฝั่งงาน **ยังเป็นตัวกรองรายการด้านล่างเหมือนเดิม** (กล่องตัวกรอง
            ถูกเอาออกไปแล้ว 10 ส.ค. นี่คือทางกรองทางเดียวที่เหลืออยู่ ห้ามทำหาย) */}
        <CallFunnelPanel
          defaultSource="all"
          title="การไหลของงาน"
          leadIn={demandFlowRow}
          // งานฝั่งใบขอที่แผงมองไม่เห็นเอง — ต่อท้ายแถบ "ทำก่อน→หลัง"
          nextActions={[
            {
              label: 'หาคนให้อัตราที่ยังไม่มีคน',
              value: serverSummary?.positionsNone ?? urgentSummary.none,
            },
          ]}
        />

        {/* ⚠️ แผง "ชุดส่งงานโทร" (CallBatchPanel) เคยอยู่ตรงนี้ — เจ้าของสั่งเอาออก 10 ส.ค. 2569
            เอาออกจากทุกหน้าแล้ว (หน้าหลัก → หน้านี้ → ไม่เอาเลย) และลบคอมโพเนนต์ทิ้ง

            **ทางตันที่ตามมาถูกปิดแล้ว 11 ส.ค. 2569** — เจ้าของเคาะว่าให้ข้ามขั้นอนุมัติ
            ปุ่มในแถบติ๊กเลือกจึงเป็น "ตั้งคิวโทร (n)" ที่สร้างชุด `approved` เลย
            แล้วคงช่วงถอนคำ 10 นาทีไว้เป็นตัวกันพลาด (ดู CallBatchUndoStrip ใต้แถบติ๊กเลือก)

            โหมด assist (ระบบจัดชุด คนอนุมัติ) ถูกถอดทิ้งในวันเดียวกัน — มันเป็นทางเดียว
            ที่เหลือที่ยังผลิตชุด `pending_approval` ได้ ซึ่งไม่มีใครอนุมัติได้แล้ว */}

        {/* ⚠️ กล่องตัวกรอง (ด่วนเท่านั้น · BU · หน่วยงาน · ชิปสถานะ 6 ตัว) เคยอยู่ตรงนี้
            — เจ้าของสั่งเอาออก 10 ส.ค. 2569

            **state ของตัวกรองยังอยู่ครบและยังทำงาน** (`urgentOnly` · `buFilter` · `unitFilter`
            · `workflowFilter`) เพราะยังมีทางตั้งค่าจากที่อื่น:
            - ลิงก์จากหน้าหลัก (`?workflow=none` / `?workflow=green`) และการ์ดสรุปด้านล่าง
              ซึ่งกดแล้วตั้ง workflowFilter ให้
            - URL param ที่แชร์กันไว้เดิมยังใช้ได้ ไม่พัง
            ถ้าวันไหนอยากได้ตัวกรองกลับมา เปิดบล็อกนี้คืนได้เลยโดยไม่ต้องแก้ตรรกะ */}

        {/* ⚠️ กล่องสรุป 5 ใบเคยอยู่ตรงนี้ — ย้ายขึ้นไปรวมในแถบ "การไหลของงาน" ด้านบน
            (เจ้าของสั่ง 11 ส.ค. 2569) · ตัวสร้างอยู่ที่ `demandFlowRow` ใกล้ ๆ state ของตัวกรอง
            ตรรกะการกดกรองไม่เปลี่ยนเลย เปลี่ยนแค่ที่วางกับหน้าตาให้เป็นชุดเดียวกับเส้นการโทร */}
        {urgentSummary.total > 0 ? (
          <p className="px-1 text-[11px] text-muted-foreground">
            {urgentSummary.analyzedCount > 0
              ? `AI วิเคราะห์แล้ว ${urgentSummary.analyzedCount} ใบ · ที่เหลือประมาณจากสกิล (ยังไม่ใช่การยืนยันว่าพร้อมลงงาน)`
              : 'ประมาณการจากสกิล (ยังไม่ผ่าน AI) — กดใบขอเพื่อให้ AI คัดจริง'}
          </p>
        ) : null}

        {/* ⚠️ ชิป "ของฉันถืออยู่ n คน" เคยอยู่ตรงนี้ — เอาออกพร้อมปุ่มรับไปโทรเอง
            (เจ้าของสั่ง 11 ส.ค. 2569) หน้านี้ไม่มีทางรับงานโทรและไม่มีที่บันทึกผลแล้ว
            ชิปที่นับงานที่รับไว้จึงชี้ไปที่ที่ไม่มีอยู่ · งานที่ยังถืออยู่ดูได้ที่ถัง
            "ต้องคนตาม" ในแถบการไหลของงาน ซึ่งเป็นที่ที่กดรับมาแต่แรก */}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
          <p className="text-sm text-muted-foreground">
            {loadingJobs || serverListLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-blue-500" />
                <span>กำลังโหลดรายการ…</span>
              </span>
            ) : (
              <>
                ใบขอ <span className="text-blue-600 font-bold tabular-nums dark:text-blue-300">{listTotal}</span> รายการ
                {totalPages > 1 ? ` · แสดงลำดับ ${pageRangeStart}–${pageRangeEnd} (หน้า ${currentPage}/${totalPages})` : ''}
              </>
            )}
          </p>
          {/* เลือกจำนวนต่อหน้า — จำค่าไว้ในเครื่อง กลับมาเปิดหน้านี้อีกครั้งได้ค่าเดิม */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <span className="text-[11px] text-muted-foreground">หน้าละ</span>
            {MATCHING_PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => changePageSize(size)}
                disabled={serverListLoading}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors disabled:cursor-wait',
                  pageSize === size
                    ? FILTER_PILL_ACTIVE_CLASS
                    : FILTER_PILL_IDLE_CLASS,
                )}
              >
                {size}
              </button>
            ))}
          </div>
          {/* ⚠️ บรรทัด "· เรียง SLA เกิน/เสี่ยง… · กดเพื่อหาคนของเราที่ตรง" เคยอยู่ตรงนี้ —
              เจ้าของทัก 12 ส.ค. 2569 ว่าส่วนหัวลิสต์เละ · ข้อความซ้ำกับป้าย "SLA / ด่วนก่อน"
              ที่เป็นค่าเริ่มต้นของแถวเรียงข้างล่างอยู่แล้ว จึงตัดทิ้ง */}
          {/* เรียงลิสต์ — ค่าเริ่มต้นคงพฤติกรรมเดิม (SLA เกิน/เสี่ยงและงานด่วนขึ้นก่อน) */}
          <div className="flex w-full flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">เรียงตาม:</span>
            {(
              [
                ['default', 'SLA / ด่วนก่อน'],
                ['age_desc', 'ค้างนานสุด → ใหม่สุด'],
                ['age_asc', 'ใหม่สุด → ค้างนานสุด'],
                ['recommend', 'มีคนแนะนำก่อน'],
                ['no_recommend', 'ยังไม่มีคนแนะนำก่อน'],
              ] as Array<[MatchingListSort, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSortBy(value)}
                disabled={serverListLoading}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-wait',
                  sortBy === value
                    ? FILTER_PILL_ACTIVE_CLASS
                    : FILTER_PILL_IDLE_CLASS,
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* คู่มือสีสั้น ๆ — แถบสีซ้ายการ์ดบอกว่าใบขอค้างมานานแค่ไหน */}
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className="font-medium">สีบอกอายุใบขอ:</span>
            {(['fresh', 'warming', 'urgent', 'critical'] as const).map((lv) => (
              <span key={lv} className="inline-flex items-center gap-1">
                <span
                  className={cn('h-2 w-2.5 rounded-sm', JOB_AGE_URGENCY_META[lv].barCls)}
                  aria-hidden
                />
                {JOB_AGE_URGENCY_META[lv].label}
                {/* ตัด /70 ออก — ความจางทำให้ contrast เหลือ 4.06 ตกเกณฑ์ AA
                    ป้ายนี้เป็นเกณฑ์ของถังอายุ ไม่ใช่ของประดับ ต้องอ่านออก */}
                <span className="text-muted-foreground">
                  {lv === 'fresh' ? '≤7 วัน' : lv === 'warming' ? '8–30' : lv === 'urgent' ? '31–60' : '60+'}
                </span>
              </span>
            ))}
            {/* ⚠️ ชิป "AI พร้อมแล้ว" (สถานะ idle) เคยอยู่ระหว่างสองชิปนี้ — เจ้าของสั่งเอาออก
                12 ส.ค. 2569 ("AI พร้อมแล้ว ไม่ต้องเอามาโชว์") · idle = ไม่มีข้อมูลให้ทำอะไรต่อ
                คงไว้เฉพาะสถานะที่คนต้องรู้: กำลังประมวลผล (มีของกำลังวิ่ง) กับ ปิดอยู่ */}
            {workerStatus?.started && workerStatus.queueSize > 0 ? (
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', TONE.warn.soft, TONE.warn.value)}>
                <LoaderCircle className="h-2.5 w-2.5 animate-spin" /> AI กำลังประมวลผล {workerStatus.queueSize} ใบ
              </span>
            ) : workerStatus && !workerStatus.enabled ? (
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', TONE.neutral.soft, DASH.muted)}>
                AI ปิดอยู่
              </span>
            ) : null}
          </div>
        </div>

        {/* การ์ดรวมใบขอ */}
        <div className="space-y-2.5" ref={listTopRef}>
          {serverListError ? (
            <p className={cn('rounded-xl border px-3.5 py-2.5 text-xs font-medium', TONE.danger.soft, TONE.danger.value)}>
              {serverListError} — ลองรีเฟรชหน้า
            </p>
          ) : null}
          {/* โหลดครั้งแรก (ยังไม่มีข้อมูลใน cache) — spinner ตัวเดียวพร้อมข้อความ
              ชัดกว่าการ์ดหลอก 8 ใบ ที่คนเข้าใจผิดว่าหน้าค้างแล้วกด refresh ซ้ำ */}
          {rows.length === 0 && (loadingJobs || serverListLoading) ? (
            <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/70 px-6 py-16 text-center">
              <LoaderCircle className="h-8 w-8 animate-spin text-sky-500" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-foreground">กำลังโหลดใบขอ…</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  ดึงใบขอจากระบบ ERP พร้อมผลที่ AI คิดไว้ · ไม่ต้องกดซ้ำ
                </p>
              </div>
            </div>
          ) : null}
          {rows.length === 0 && !loadingJobs && !serverListLoading ? (
            <div className="glass-card rounded-2xl p-8 border border-white/70 text-center text-muted-foreground">
              <Search className="w-8 h-8 text-blue-400/60 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">ไม่พบใบขอตามเงื่อนไข</p>
            </div>
          ) : null}
          <div className={cn('space-y-2.5 transition-opacity duration-200', rows.length > 0 && serverListLoading && 'pointer-events-none opacity-50')}>
          {visibleRows.map((j) => {
            const matchCount = boardMatchById[j.id]
              ? recommendedCandidateCount(boardMatchById[j.id].matches)
              : serverStoredMatches[j.id]
                ? serverStoredMatches[j.id].recommended
                : undefined;
            const progress = proposalCounts(proposalsByJobId[j.id]);
            const requested = requestPositionCount(j);
            const remaining = officialRemainingCount(j);
            // สีบอกความด่วนจากอายุใบขอ: ≤7 วันยังไม่ด่วน · 8–30 เริ่มด่วน · 31–60 ด่วน · 60+ ด่วนมาก
            const ageDays = getJobRequestAgeDays(j);
            const ageLevel = ageUrgencyLevelFromDays(ageDays);
            const ageMeta = JOB_AGE_URGENCY_META[ageLevel];
            return (
              <div
                key={j.id}
                role="button"
                tabIndex={0}
                onClick={() => openJob(j)}
                onKeyDown={(e) => e.key === 'Enter' && openJob(j)}
                className="glass-card relative overflow-hidden rounded-2xl border border-white/70 py-2.5 pl-4 pr-3 cursor-pointer hover:border-sky-300/50 transition-colors dark:hover:border-sky-700/50"
              >
                {/* แถบสีซ้ายการ์ด — กวาดตาแล้วรู้ทันทีว่าใบไหนค้างนาน */}
                <span
                  aria-hidden
                  className={cn('absolute inset-y-0 left-0 w-1.5', ageMeta.barCls)}
                />
                {/*
                  บรรทัดแรก = "สิ่งที่ต้องตัดสินใจ" ตามหลักคนอ่านบนลงล่างที่เจ้าของยึด
                  ด่วนแค่ไหน → ต้องทำอะไรต่อ → เหลือหากี่คน
                  ชื่อหน่วยงาน/ตำแหน่ง/ที่อยู่เป็นของประกอบ ลงไปอยู่บรรทัดถัดไป
                */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    title={
                      ageDays == null
                        ? 'ไม่ทราบอายุใบขอ'
                        : `ใบขอนี้ค้างมา ${ageDays} วัน · เกณฑ์: ≤7 ยังไม่ด่วน · 8–30 เริ่มด่วน · 31–60 ด่วน · 60+ ด่วนมาก`
                    }
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums',
                      ageMeta.chipCls,
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', ageMeta.dotCls)} aria-hidden />
                    {ageMeta.label}
                    {ageDays != null ? ` · ค้าง ${ageDays} วัน` : ''}
                  </span>
                  {(() => {
                    const action = cardNextAction(matchCount, serverLumosSummary[j.id]);
                    return action ? (
                      <span className={cn(TONE[action.tone].chip, 'shrink-0')}>→ {action.text}</span>
                    ) : null;
                  })()}
                  <span className="ml-auto shrink-0 text-[11px] text-slate-600 dark:text-slate-300">
                    เหลือหา <b className={cn('text-[15px] tabular-nums', TONE.warn.value)}>{remaining}</b>
                    <span className="text-muted-foreground"> / {requested} อัตรา</span>
                  </span>
                </div>

                <div className="mt-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {/* ชื่อหน่วยงาน + ป้ายผลคัดคน — ของประกอบการตัดสินใจ ไม่ใช่ตัวตัดสินใจเอง */}
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-blue-600 dark:text-blue-300">{unitRequestCardTitle(j)}</span>
                      {matchCount != null ? (
                        <span
                          title="จำนวนที่ AI แนะนำจากคนของเรา — ยังไม่ใช่การยืนยันว่าพร้อมลงงาน"
                          className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', TONE.success.soft, TONE.success.value)}
                        >
                          AI แนะนำ {matchCount}
                        </span>
                      ) : quickCounts[j.id] ? (
                        /* เลข "ประมาณ" ต้องต่างจากเลข "ยืนยันแล้ว" ด้วยตา ไม่ใช่แค่ตัวหนอน —
                           เส้นประ + ไม่มีพื้น = ยังไม่ผ่าน AI · ทึบ + มีเครื่องหมายถูก = ยืนยันแล้ว */
                        <span
                          title="ประมาณการเบื้องต้นจากสกิล (ยังไม่ผ่าน AI) — กดเพื่อให้ AI คัดจริง"
                          className="shrink-0 rounded-full border border-dashed border-slate-400 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-500 dark:text-slate-300"
                        >
                          ~{quickCounts[j.id]} (ยังไม่ผ่าน AI)
                        </span>
                      ) : null}
                    </div>
                    {unitRequestCardSubtitle(j) ? (
                      <div className="text-[11px] text-muted-foreground truncate">{unitRequestCardSubtitle(j)}</div>
                    ) : null}
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{j.location_address}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                  {/* ในกล่องแบ่งสองคอลัมน์: ซ้าย = รายละเอียดงาน · ขวา = สรุปว่ามีใครกี่คนแล้ว */}
                  {/* แบ่งครึ่งตามที่เจ้าของสั่ง: ซ้าย = รายละเอียดงาน + ยอดอัตราทางการ
                      ขวา = แถบผลโทร 6 ช่อง (ใบที่ยังไม่ได้ส่งโทร ใช้ยอดคนบนบอร์ดแทน ไม่ปล่อยว่าง) */}
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <div className="min-w-0">
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {j.total_income.toLocaleString()} บาท · ต้องการ {formatYmdDmyBe(j.required_date)}
                      </span>
                      {/* ยอด ขอมา/เหลือหา ย้ายขึ้นบรรทัดแรกแล้ว ตรงนี้เหลือเลขที่ใบขอ
                          ซึ่งเป็นของอ้างอิง — ตามหลักบนลงล่าง ของอ้างอิงอยู่ล่างสุด */}
                      {j.request_no ? (
                        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                          {j.request_no}
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 border-slate-100 dark:border-slate-700/60 sm:border-l sm:pl-2.5">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                        {serverLumosSummary[j.id] ? 'ผลโทรในใบนี้' : 'คนในใบนี้'}
                      </p>
                      {serverLumosSummary[j.id] ? (
                        <LumosJobSummaryStats s={serverLumosSummary[j.id]} variant="column" />
                      ) : (
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                          <span>ติดต่อ <b className="tabular-nums">{progress.contacted}</b></span>
                          <span>จอง <b className="tabular-nums">{progress.reserved}</b></span>
                          <span>ลงงาน <b className="tabular-nums">{progress.placed}</b></span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openJob(j);
                      }}
                      className="jarvis-btn-secondary shrink-0"
                    >
                      <Users className="h-3 w-3" />
                      {matchCount != null
                        ? `ดูคนของเรา (${matchCount})`
                        : boardLoadingId === j.id
                          ? 'กำลังโหลดผล…'
                          : boardWaitingById[j.id]
                            ? 'AI กำลังคิดที่หลังบ้าน…'
                            : 'หาคนของเรา'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
          {totalPages > 1 ? (
            <nav aria-label="เปลี่ยนหน้ารายการใบขอ" className="space-y-1.5 pt-1">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  disabled={serverListLoading || currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                  className={cn(
                    'flex min-h-[40px] items-center rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm disabled:opacity-40',
                    TONE.info.outline,
                  )}
                >
                  ← ก่อนหน้า
                </button>
                {pageItems.map((item, idx) =>
                  item === '…' ? (
                    <span key={`gap-${idx}`} className="px-1 text-sm text-muted-foreground">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      disabled={serverListLoading}
                      onClick={() => goToPage(item)}
                      aria-current={item === currentPage ? 'page' : undefined}
                      className={cn(
                        'flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm disabled:opacity-40',
                        item === currentPage
                          ? // ไม่ใช้ TONE.info.solid ตรงนี้: ตัวขาวบน sky-600 ได้ contrast 4.10
                            // ซึ่งพอสำหรับ "ตัวเลขใหญ่" ตามที่ solid ออกแบบไว้ (เกณฑ์ 3:1)
                            // แต่ปุ่มนี้เป็นตัวหนังสือ 14px ต้องถึง 4.5 — ใช้ tile+num แทน แล้วเน้นด้วยวงแหวน
                            cn('ring-2 ring-sky-500', TONE.info.tile, TONE.info.num)
                          : TONE.info.outline,
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={serverListLoading || currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                  className={cn(
                    'flex min-h-[40px] items-center rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm disabled:opacity-40',
                    TONE.info.outline,
                  )}
                >
                  ถัดไป →
                </button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {serverListLoading
                  ? 'กำลังโหลด…'
                  : `แสดงลำดับ ${pageRangeStart.toLocaleString()}–${pageRangeEnd.toLocaleString()} จาก ${listTotal.toLocaleString()} ใบ`}
              </p>
            </nav>
          ) : null}
        </div>
      </div>

      {/* Drawer: คนของเรา ต่อใบขอ */}
      <Sheet open={!!jobDetail} onOpenChange={(o) => !o && closeJob()}>
        <SheetContent
          side="right"
          className="matching-sheet-scroll w-full overflow-y-auto [scrollbar-gutter:stable] sm:max-w-xl"
        >
          <SheetHeader>
            <SheetTitle className="text-foreground">คนของเรา — ผ่านสัมภาษณ์ รอลงงาน</SheetTitle>
            <SheetDescription className="sr-only">ผู้สมัครที่พร้อมลงงานซึ่งสกิลตรงกับใบขอ</SheetDescription>
          </SheetHeader>
          {jobDetail ? (
            <div className="space-y-3 mt-2">
              <div className="rounded-xl border border-white/70 bg-white/40 dark:border-white/10 dark:bg-white/5 px-3 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">{unitRequestCardTitle(jobDetail)}</div>
                      {jobDetail.request_no ? (
                        <div className="text-[11px] text-muted-foreground">{jobDetail.request_no}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => openBranchEditor(jobDetail)}
                      className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300 dark:hover:bg-violet-900/40"
                    >
                      <MapPin className="h-3 w-3" /> แก้ไขเงื่อนไข/สาขา
                    </button>
                    <Link
                      to={unitRequestPath(jobDetail)}
                      state={{ returnTo: '/matching/match' }}
                      onClick={() => setJobDetail(null)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                        TONE.primary.outline,
                      )}
                    >
                      ดูใบขอ <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
                {[jobDetail.staff_title_name, jobDetail.job_description_code_1, jobDetail.job_description_code_2]
                  .filter((v) => v && v !== 'ไม่ระบุ').length ? (
                  <p className="text-xs text-foreground">
                    ตำแหน่ง:{' '}
                    {[jobDetail.staff_title_name, jobDetail.job_description_code_1, jobDetail.job_description_code_2]
                      .filter((v) => v && v !== 'ไม่ระบุ')
                      .join(' · ')}
                  </p>
                ) : null}
                <div className="text-[11px] text-muted-foreground">📍 {jobDetail.location_address}</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    เพศ: {jobDetail.gender_requirement || 'ไม่ระบุ'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    อายุ:{' '}
                    {jobDetail.age_range_min != null || jobDetail.age_range_max != null
                      ? `${jobDetail.age_range_min ?? '—'}–${jobDetail.age_range_max ?? '—'}`
                      : 'ไม่ระบุ'}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {jobDetail.total_income.toLocaleString()} บาท
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    ต้องการ: {formatYmdDmyBe(jobDetail.required_date)}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      jobDetail.urgency === 'urgent'
                        ? cn(TONE.danger.soft, TONE.danger.value)
                        : cn(TONE.info.soft, TONE.info.value),
                    )}
                  >
                    {jobDetail.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
                  </span>
                </div>
              </div>

              {(() => {
                const branches = branchDemandItems(jobDetail);
                if (!branches.length) return null;
                const nearbyCounts = new Map<string, number>();
                for (const match of (boardMatchById[jobDetail.id]?.matches || []).filter((item) => isRecommendedTier(item.tier))) {
                  const assignment = nearestBranchForArea(
                    {
                      district_name: match.amphur_name,
                      province_name: match.province_name,
                      location_label: [match.amphur_name, match.province_name].filter(Boolean).join(' '),
                    },
                    branches,
                  );
                  if (assignment && assignment.proximity_rank <= 1) {
                    const key = assignment.branch.branch_id || assignment.branch.branch_name_clean;
                    nearbyCounts.set(key, (nearbyCounts.get(key) || 0) + 1);
                  }
                }
                return (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-3 dark:border-violet-800 dark:bg-violet-950/50">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-violet-900 dark:text-violet-200">สาขาที่ระบบแยกได้ ({branches.length})</p>
                        <p className="text-[10px] text-violet-700 dark:text-violet-300">กรุณาตรวจสอบ เพราะข้อความต้นทางอาจแยกคลาดเคลื่อนได้</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openBranchEditor(jobDetail)}
                        className={cn(
                          'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                          TONE.violet.outline,
                        )}
                      >
                        แก้ไข
                      </button>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {branches.map((branch, index) => (
                        <div
                          key={branch.branch_id || `${branch.branch_name_clean}-${index}`}
                          className="flex items-start justify-between gap-3 rounded-lg border border-white/80 bg-white/80 dark:border-white/10 dark:bg-white/5 px-2.5 py-2 text-[11px]"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{branch.branch_name_clean || `สาขา ${index + 1}`}</p>
                            <p className="text-slate-600 dark:text-slate-300">
                              {[branch.road, branch.subdistrict, branch.district_hint, branch.province_hint]
                                .filter(Boolean)
                                .join(' · ') || branch.address_raw || 'ยังไม่มีรายละเอียดที่อยู่'}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                              ต้องการ {branch.requested_qty} คน
                            </span>
                            {boardMatchById[jobDetail.id] ? (
                              <span className={cn('rounded-full border px-2 py-0.5 font-semibold', TONE.success.soft, TONE.success.value)}>
                                คนของเราใกล้ {nearbyCounts.get(branch.branch_id || branch.branch_name_clean) || 0} คน
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">รอประเมินคนใกล้สาขา</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const progress = proposalCounts(proposalsByJobId[jobDetail.id]);
                const recommended =
                  recommendedCandidateCount(boardMatchById[jobDetail.id]?.matches) +
                  recommendedCandidateCount(irMatchById[jobDetail.id]?.matches);
                const cells = [
                  // ขอมา=กลาง · AI แนะนำ=ฟ้า · สถานะการเสนอ 3 ช่องกลางดึงโทนจากแหล่งเดียวกับชิปสถานะ ·
                  // เหลือหา=เหลือง (ตาม token กลาง)
                  { label: 'ขอ', value: requestPositionCount(jobDetail), cls: TONE.neutral.value },
                  { label: 'AI แนะนำ', value: recommended, cls: TONE.info.value },
                  { label: 'ติดต่อ', value: progress.contacted, cls: TONE[PROPOSAL_STATUS_TONE.contacted].value },
                  { label: 'จอง', value: progress.reserved, cls: TONE[PROPOSAL_STATUS_TONE.reserved].value },
                  { label: 'ลงงาน Matching', value: progress.placed, cls: TONE[PROPOSAL_STATUS_TONE.placed].value },
                  { label: 'เหลือหาทางการ', value: officialRemainingCount(jobDetail), cls: TONE.warn.value },
                ];
                return (
                  // พื้นอ่อนตัวนี้เดิมไม่มีคู่มืด — โหมดมืดกล่องยังสว่างแต่ตัวหนังสือเปลี่ยนเป็นสีจาง
                  // วัดได้ contrast 1.27 คือแทบมองไม่เห็น
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-900/60">
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                      {cells.map((cell) => (
                        <div key={cell.label} className="rounded-lg bg-white px-1.5 py-1.5 text-center dark:bg-slate-900">
                          <div className={cn('text-sm font-bold tabular-nums', cell.cls)}>{cell.value}</div>
                          <div className="text-[9px] leading-tight text-muted-foreground">{cell.label}</div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">
                      สถานะ Matching ใช้ติดตามการทำงานของทีมเท่านั้น ส่วน “เหลือหาทางการ” อิงข้อมูลหาได้แล้วและยกเลิกจากใบขอ
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {boardMatchById[jobDetail.id]
                    ? `AI แมทสกิล · จาก pool ${boardMatchById[jobDetail.id].pool_size} คน → แนะนำ ${recommendedCandidateCount(boardMatchById[jobDetail.id].matches)}` +
                      (boardMatchById[jobDetail.id].recommended_target
                        ? ` / เป้า ${boardMatchById[jobDetail.id].recommended_target}`
                        : '')
                    : 'ผู้สมัครที่พร้อมลงงานทันที'}
                </p>
                <div className="flex items-center gap-1.5">
                  {(() => {
                    const proposedCount = (boardMatchById[jobDetail.id]?.matches ?? []).filter(
                      (m) => proposedByKey[proposalKey('board', m.card_id)],
                    ).length;
                    return proposedCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setHideProposed((v) => !v)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                          hideProposed
                            ? cn(TONE.success.soft, TONE.success.value)
                            : cn(TONE.neutral.outline, 'hover:border-emerald-300 dark:hover:border-emerald-700'),
                        )}
                      >
                        {hideProposed ? `แสดงทั้งหมด` : `ซ่อนที่เสนอแล้ว (${proposedCount})`}
                      </button>
                    ) : null;
                  })()}
                  {(() => {
                    const distant =
                      distantCandidateCount(boardMatchById[jobDetail.id]?.matches) +
                      distantCandidateCount(irMatchById[jobDetail.id]?.matches);
                    return distant > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowDistantCandidates((current) => !current)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                          showDistantCandidates
                            ? cn(TONE.danger.soft, TONE.danger.value)
                            : cn(TONE.neutral.outline, 'hover:border-red-200 dark:hover:border-red-800'),
                        )}
                      >
                        {showDistantCandidates
                          ? 'ซ่อนคนนอกพื้นที่/ห่างไกล'
                          : `แสดงคนนอกพื้นที่/ห่างไกล (${distant})`}
                      </button>
                    ) : null;
                  })()}
                  <button
                    type="button"
                    disabled={boardLoadingId === jobDetail.id || !!boardWaitingById[jobDetail.id]}
                    onClick={() => setRematchConfirmJobId(jobDetail.id)}
                    className="jarvis-btn-secondary disabled:cursor-wait"
                  >
                    <RefreshCw
                      className={cn(
                        'h-3 w-3',
                        (boardLoadingId === jobDetail.id || boardWaitingById[jobDetail.id]) && 'animate-spin',
                      )}
                    />
                    {boardWaitingById[jobDetail.id]
                      ? 'AI กำลังคิดที่หลังบ้าน…'
                      : boardLoadingId === jobDetail.id
                        ? 'กำลังโหลดผล…'
                        : 'ค้นหาใหม่'}
                  </button>
                </div>
              </div>

              {showDistantCandidates &&
              distantCandidateCount(boardMatchById[jobDetail.id]?.matches) +
                distantCandidateCount(irMatchById[jobDetail.id]?.matches) >
                0 ? (
                <p className={cn('rounded-lg border px-2.5 py-1.5 text-[10px]', TONE.danger.soft, TONE.danger.value)}>
                  กำลังแสดงคนนอกพื้นที่/ห่างไกลด้วยเพื่อเป็นทางเลือกสำรอง — กลุ่มนี้ไม่ถูกนับรวมในยอด AI แนะนำ
                </p>
              ) : null}

              {/* กติกาเป้า 3 เท่า: To do หาไม่ถึงเป้า → ระบบค้นถัง "ไม่มีงาน" เพิ่มให้แล้ว
                  ถ้ายังไม่ถึงเป้าอีก บอกทางไปต่อ (iRecruit / Re Use / โพสหาคนใหม่) */}
              {(() => {
                const bm = boardMatchById[jobDetail.id];
                // ขึ้นเมื่อรู้เป้าแล้ว และ (เคยค้นถังสำรอง หรือหาได้ไม่ถึงเป้า) — ไม่ครบต้องเห็นคำแนะนำเสมอ
                if (!bm?.recommended_target) return null;
                if (!bm.fallback_used && recommendedCandidateCount(bm.matches) >= bm.recommended_target) {
                  return null;
                }
                const got = recommendedCandidateCount(bm.matches);
                const short = got < bm.recommended_target;
                const posting = jobPostingByJobId[jobDetail.id];
                return (
                  <div
                    className={cn(
                      'rounded-lg border px-2.5 py-2 text-[10px] space-y-1.5',
                      short
                        ? cn(TONE.warn.soft, TONE.warn.num)
                        : cn(TONE.info.soft, TONE.info.num),
                    )}
                  >
                    <p>
                      To do หาได้ไม่ถึงเป้า {bm.recommended_target} คน (อัตราที่ขอ × 3) — ค้นถัง “ไม่มีงาน” เพิ่มแล้ว
                      {short
                        ? ` ก็ยังได้ ${got} คน · ทางไปต่อ: ค้นฐาน iRecruit ด้านล่าง · ดูคนเก่า Re Use ใน “เลือกคนส่ง AI โทร”`
                        : ` → รวมแนะนำ ${got} คน (ครบเป้า)`}
                    </p>
                    {/* หาไม่ครบเป้า = แนะนำให้ส่งต่อทีมอื่นตรงนี้เลย ไม่ต้องเลื่อนไปหาปุ่มด้านล่าง */}
                    {short ? (
                      posting ? (
                        <p className="font-semibold">
                          ส่งคำขอโพสหาคนไปแล้ว ({posting.request_type === 'scraping' ? 'Scraping' : 'Content'}) —
                          รอทีมรับไปทำ
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">แนะนำ: หาคนของเราไม่ครบ ส่งต่อทีมอื่นเลย →</span>
                          <button
                            type="button"
                            disabled={creatingPosting}
                            onClick={() => void createPosting(jobDetail, 'content')}
                            className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold disabled:opacity-60', TONE.orange.solid)}
                          >
                            <Megaphone className="h-3 w-3" />
                            {creatingPosting ? 'กำลังสร้าง…' : 'ให้สร้าง Content'}
                          </button>
                          <button
                            type="button"
                            disabled={creatingPosting}
                            onClick={() => void createPosting(jobDetail, 'scraping')}
                            className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold disabled:opacity-60', TONE.teal.solid)}
                          >
                            <Search className="h-3 w-3" />
                            {creatingPosting ? 'กำลังสร้าง…' : 'Scraping งาน'}
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                );
              })()}

              {lumosNotice ? (
                <p className={cn('rounded-lg border px-2.5 py-1.5 text-[11px]', TONE.success.soft, TONE.success.num)}>
                  {lumosNotice}
                </p>
              ) : null}
              {lumosError ? (
                <p className={cn('rounded-lg border px-2.5 py-1.5 text-[11px] text-destructive', TONE.danger.soft)}>
                  {lumosError}
                </p>
              ) : null}

              {/* ใบขอด่วน + มีคนเพิ่มเข้า pool ทีหลัง → ดันเข้าคิวโทรเองได้ ไม่ต้องรอ AI แมทรอบใหม่ */}
              <div className="space-y-1.5 rounded-xl border border-sky-200 bg-white/70 dark:bg-white/5 px-3 py-2 dark:border-sky-800">
                <LumosJobSummaryStats s={summarizeLumosCallStatus(Object.values(lumosStatusByRef))} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  คนที่ AI แนะนำถูกส่ง AI โทรอัตโนมัติแล้ว — ถ้ามีคนเพิ่มเข้ามาทีหลังและใบขอด่วน เลือกส่งเองได้
                </p>
                <button
                  type="button"
                  onClick={() => void openLumosPicker()}
                  className="jarvis-btn-secondary shrink-0"
                >
                  <PhoneCall className="h-3 w-3" /> เลือกคนส่ง AI โทร
                </button>
                </div>
              </div>

              {/* อนุมัติทั้งใบ — ทางลัดของ "ติ๊กให้ครบแล้วกดส่ง" สำหรับใบที่ตรวจแล้วเอาหมด
                  (เจ้าของสั่ง 11 ส.ค. 2569) · ยังผ่านหน้าต่างยืนยันตัวเดิมที่โชว์รายชื่อ
                  ครบทุกคนและเตือนว่า AI จะโทรจริง — ไม่มีทางลัดที่ข้ามการยืนยัน */}
              {approveAllCount > 0 ? (
                <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2', TONE.success.soft)}>
                  <span className={cn('text-[11px]', DASH.cell)}>
                    ใบนี้มีคนที่ส่งได้ทั้งหมด {approveAllCount.toLocaleString('th-TH')} คน —
                    ตรวจแล้วเอาทั้งใบก็กดปุ่มนี้ได้เลย ไม่ต้องไล่ติ๊กทีละคน
                  </span>
                  <button
                    type="button"
                    onClick={approveWholeJob}
                    disabled={lumosSending || batchCreating}
                    className="jarvis-btn-primary ml-auto shrink-0"
                  >
                    <PhoneCall className="h-3 w-3" /> อนุมัติทั้งใบ — ส่ง AI โทร ({approveAllCount})
                  </button>
                </div>
              ) : null}

              {/* คนที่ปฏิเสธใบนี้ถูกซ่อนไว้ — บอกจำนวนเสมอ และกดดูได้
                  ⚠️ ห้ามซ่อนแบบไม่บอก: เจ้าหน้าที่ต้องตอบได้ว่า "คนที่หายไปคือใคร"
                  ไม่งั้นจะกลายเป็นข้อมูลหายเงียบ ซึ่งเป็นสิ่งที่โปรเจกต์นี้กันมาตลอด */}
              {hiddenDeclinedCount > 0 ? (
                <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2', TONE.neutral.soft)}>
                  <span className={cn('text-[11px]', DASH.cell)}>
                    ปฏิเสธใบขอนี้ไปแล้ว {hiddenDeclinedCount.toLocaleString('th-TH')} คน —{' '}
                    {showDeclined ? 'กำลังแสดงอยู่ในรายการ' : 'ซ่อนไว้ ไม่เสนอใบนี้ให้เขาอีก'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDeclined((v) => !v)}
                    className="jarvis-btn-ghost ml-auto shrink-0"
                  >
                    {showDeclined ? 'ซ่อนอีกครั้ง' : 'ดูว่าใครบ้าง'}
                  </button>
                </div>
              ) : null}

              <LumosSendBar
                count={lumosSelectedCount}
                busy={lumosSending}
                onClear={clearLumosSelection}
                creatingBatch={batchCreating}
                onCreateBatch={() => void createBatchFromSelection()}
                onSend={beginSendFlow}
                onHoldSelf={() => void holdSelectedForSelf()}
                holdingSelf={holdingSelf}
              />
              <CallBatchUndoStrip
                batches={pendingBatches}
                cancellingId={batchCancellingId}
                onCancel={(id) => void cancelPendingBatch(id)}
              />

              {boardLoadingId === jobDetail.id ? (
                <AiEvaluationStatus source="board" />
              ) : boardErrorById[jobDetail.id] ? (
                <p className="text-xs text-destructive">{boardErrorById[jobDetail.id]}</p>
              ) : boardMatchById[jobDetail.id] ? (
                <>
                {boardWaitingById[jobDetail.id] ? (
                  <p className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2 text-[11px] text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                    <RefreshCw className="h-3 w-3 shrink-0 animate-spin" />
                    สั่งค้นหาใหม่แล้ว — AI กำลังคิดอยู่หลังบ้าน ผลใหม่จะมาแทนที่อัตโนมัติ (ที่เห็นตอนนี้คือผลเดิม)
                  </p>
                ) : null}
                {recommendedCandidateCount(boardMatchById[jobDetail.id].matches) === 0 &&
                !(showDistantCandidates && distantCandidateCount(boardMatchById[jobDetail.id].matches) > 0) ? (
                  <p className={cn('rounded-xl border px-3 py-3 text-xs', TONE.warn.soft, TONE.warn.num)}>
                    ยังไม่มีคนของเราที่เข้าข่ายกับใบขอนี้ — ลองหาจากฐาน iRecruit ด้านล่าง แล้วเสนอได้เลย
                  </p>
                ) : (
                  <div className="space-y-2">
                    {/* เรียงตามลำดับความสำคัญของเจ้าของ: อายุ → ที่อยู่ → ประสบการณ์ → รายได้
                        (เกณฑ์แข็งพังตกท้าย · คะแนนเท่ากันคงลำดับจาก AI — sort ของ JS เป็น stable) */}
                    {boardMatchById[jobDetail.id].matches
                      .filter((m) => showDistantCandidates || isRecommendedTier(m.tier))
                      .filter((m) => !(hideProposed && proposedByKey[proposalKey('board', m.card_id)]))
                      // ปฏิเสธงานนี้ไปแล้ว → ไม่เสนอใบนี้ให้เขาอีก (เจ้าของสั่ง 11 ส.ค. 2569)
                      .filter((m) => showDeclined || !declinedRefs.has(boardPersonRef(m.card_id)))
                      .map((m) => ({
                        m,
                        priority: boardCandidatePriority(
                          jobDetail,
                          m,
                          priorityConfig,
                          screeningByRef[String(m.card_id)],
                        ),
                      }))
                      .sort((a, b) => compareCandidatePriority(a.priority, b.priority))
                      .map(({ m, priority }) => {
                        const meta = boardTierMeta(m.tier);
                        const branchAssignment = nearestBranchForBoardCandidate(jobDetail, m);
                        const branchProximity = boardBranchProximityMeta(branchAssignment);
                        const candidateKey = proposalKey('board', m.card_id);
                        const proposed = proposedByKey[candidateKey];
                        const otherActive = activeProposalByCandidate[candidateKey];
                        const activeElsewhere = otherActive && otherActive.job_id !== jobDetail.id ? otherActive : null;
                        const lumosRef = boardPersonRef(m.card_id);
                        const lumosRow = lumosStatusByRef[lumosRef];
                        const holdRef = String(m.card_id);
                        const hold = holdByRef[holdRef];
                        const heldByOther = hold && !hold.mine ? hold : null;
                        const heldByMe = hold && hold.mine ? hold : null;
                        // คนที่มีเจ้าหน้าที่รับไปตามอยู่ = ห้ามส่ง AI ทับ
                        // (server กันอีกชั้นที่ insertQueueItems — ตรงนี้แค่ไม่ให้ติ๊กแล้วงง)
                        const canPickForLumos = Boolean(m.mobile) && !lumosRow && !hold;
                        return (
                        <div
                          key={m.card_id}
                          className={cn(
                            'matching-candidate-card rounded-xl border px-3 py-2',
                            TONE[meta.tone].soft,
                            proposed ? 'opacity-70' : '',
                          )}
                        >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={lumosSelectedBoard.includes(m.card_id)}
                            disabled={!canPickForLumos}
                            onChange={() => toggleLumosBoard(m.card_id)}
                            aria-label={`เลือก ${m.full_name} ให้ AI โทร`}
                            title={
                              !m.mobile
                                ? 'ไม่มีเบอร์มือถือ — ให้ AI โทรไม่ได้'
                                : lumosRow
                                  ? 'ส่ง AI โทรไปแล้ว'
                                  : 'เลือกให้ AI โทร'
                            }
                            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        <button
                          type="button"
                          onClick={() => setCandDetail(m)}
                          // บรรทัด "แตะเพื่อดูรายละเอียด →" ถูกถอด (การ์ดรก) — คงคำใบ้ไว้ใน title
                          title="แตะเพื่อดูรายละเอียด"
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              <TierCriteriaTooltip tier={m.tier}>
                                <span
                                  tabIndex={0}
                                  aria-label={`เกณฑ์สี ${TIER_CRITERIA[m.tier].label}`}
                                  className="cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {meta.icon}
                                </span>
                              </TierCriteriaTooltip>{' '}
                              {m.full_name}
                              {m.nick_name ? ` (${m.nick_name})` : ''}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                              {/* ป้าย "แมทอยู่ N งาน" — เฉพาะคนที่แมทเกิน 1 ใบ (เจ้าของสั่ง 12 ส.ค. 2569)
                                  hover เห็นเลขใบขอทั้งหมด · N นับเฉพาะใบเปิดใน BU + tier เขียว/เหลือง */}
                              {(() => {
                                const others = jobMatchesByCard[String(m.card_id)] ?? [];
                                if (others.length < 2) return null;
                                return (
                                  <span
                                    title={`แมทอยู่ ${others.length} งาน: ${others
                                      .map((j) => j.requestNo || j.jobId)
                                      .join(' · ')}`}
                                    className={cn(
                                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                      TONE.violet.soft,
                                      TONE.violet.value,
                                    )}
                                  >
                                    แมท {others.length} งาน
                                  </span>
                                );
                              })()}
                              {(() => {
                                const colBadge = boardColumnBadge(m.column_label);
                                return colBadge ? (
                                  <span
                                    className={cn(
                                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                      colBadge.cls,
                                    )}
                                  >
                                    {colBadge.text}
                                  </span>
                                ) : null;
                              })()}
                              {proposed ? (
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                    proposalStatusClass(proposed.status),
                                  )}
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5" /> {proposalStatusLabel(proposed.status)}
                                </span>
                              ) : null}
                              {activeElsewhere ? (
                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', TONE.violet.soft, TONE.violet.value)}>
                                  ติดใบขอ {activeElsewhere.request_no || activeElsewhere.job_id.slice(0, 8)}
                                </span>
                              ) : null}
                              <TierCriteriaTooltip tier={m.tier}>
                                <span
                                  tabIndex={0}
                                  className="cursor-help rounded-full border border-white/80 bg-white/80 dark:border-white/10 dark:bg-white/5 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {meta.label}
                                </span>
                              </TierCriteriaTooltip>
                            </div>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                            <span>สกิล: {[m.job1_name, m.job2_name].filter(Boolean).join(' / ') || 'ไม่ระบุ'}</span>
                            {m.amphur_name || m.province_name ? (
                              <span>{[m.amphur_name, m.province_name].filter(Boolean).join(' ')}</span>
                            ) : null}
                            {m.age ? <span>อายุ {m.age}</span> : null}
                            {m.required_salary ? <span>ขอ {m.required_salary.toLocaleString()} บ.</span> : null}
                            {m.mobile ? (
                              /**
                               * เบอร์ไว้อ่าน/ก๊อป ไม่ใช่ปุ่มโทร — เจ้าของสั่ง 11 ส.ค. 2569 ว่าหน้านี้
                               * ไม่มี "รับไปโทรเอง" แล้ว เหลือทางเดียวคือติ๊กเลือกแล้วส่งให้ AI โทร
                               * (เดิมแตะเบอร์แล้วจับล็อก + ต่อสายให้ทันที)
                               */
                              <span className={cn('inline-flex items-center gap-1 font-medium', DASH.cell)}>
                                <Phone className="h-3 w-3" aria-hidden /> {m.mobile}
                              </span>
                            ) : null}
                          </div>
                          {branchProximity ? (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span
                                title={branchAssignment?.proximity_reason || undefined}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                  branchProximity.cls,
                                )}
                              >
                                <MapPin className="h-2.5 w-2.5" /> {branchProximity.label}
                              </span>
                            </div>
                          ) : null}
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {/* คะแนนที่ใช้เรียงลิสต์นี้ — ชี้เมาส์ดูที่มาของคะแนนรายเกณฑ์ */}
                            <span
                              title={describePriorityScore(priority, priorityConfig).join('\n')}
                              className={cn(
                                'cursor-help rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums',
                                priority.hardFails > 0
                                  ? cn(TONE.danger.soft, TONE.danger.value)
                                  : cn(TONE.neutral.soft, TONE.neutral.value),
                              )}
                            >
                              {priority.percent}%
                            </span>
                            <CandidateChecklist
                              job={jobDetail}
                              tier={m.tier}
                              sex={m.sex_code}
                              age={m.age}
                              areaParts={[m.amphur_name, m.province_name]}
                              salary={m.required_salary}
                              screening={screeningByRef[String(m.card_id)]}
                            />
                          </div>
                          {m.reason ? <p className="mt-1 text-[11px] italic text-slate-600 dark:text-slate-300 line-clamp-1">— {m.reason}</p> : null}
                          </button>
                        </div>
                        {lumosRow ? (
                          <LumosCallBadgeRow
                            row={lumosRow}
                            expanded={lumosExpandedRef === lumosRef}
                            onToggle={() => setLumosExpandedRef((cur) => (cur === lumosRef ? null : lumosRef))}
                            onCancel={() => void cancelLumosForRef(lumosRow)}
                            cancelling={lumosCancellingRef === lumosRef}
                          />
                        ) : null}

                        {/* ⚠️ ปุ่ม "รับไปโทรเอง"/"ดึงมาโทรเอง" + แผงบันทึกผลโทร (CallHoldPanel)
                            เคยอยู่ตรงนี้ — เจ้าของสั่งเอาออก 11 ส.ค. 2569:
                            "matching เสร็จ ก็มีติ๊กแล้วมีปุ่มว่าส่ง AI โทรแค่นั้น"

                            หน้านี้จึงเหลือทางเดียว: ติ๊กเลือก → ส่ง AI โทร
                            ยังโชว์ป้ายว่ามีคนถืออยู่ (ถ้ามี) เพราะเป็นเหตุผลที่ AI จะไม่โทรคนนั้น
                            — ซ่อนไปเลยจะกลายเป็น "ติ๊กแล้วส่งแต่ไม่มีอะไรเกิดขึ้น" โดยไม่บอกทำไม
                            ⚠️ ตัวล็อกฝั่ง API ยังอยู่ครบและยังกรองที่ insertQueueItems เหมือนเดิม
                            (ถังต้องคนตามในหน้า Follow ยังกด "รับไปตาม" ได้) เอาออกแค่หน้านี้ */}
                        {heldByOther || heldByMe ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={TONE.neutral.chip}>
                              🔒 {heldByMe ? 'คุณ' : heldByOther?.heldByName || 'เจ้าหน้าที่อีกคน'}
                              {' '}รับไปตามอยู่ · AI จะไม่โทรทับ
                            </span>
                          </div>
                        ) : null}
                        </div>
                        );
                      })}
                  </div>
                )}
                </>
              ) : boardWaitingById[jobDetail.id] ? (
                <p className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-3 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  AI กำลังค้นหาใบนี้อยู่ที่หลังบ้าน — ผลจะแสดงอัตโนมัติเมื่อค้นหาเสร็จ
                </p>
              ) : null}

              {/* #2 (ยุบ) — ไม่พอ? หาผู้สมัครจากฐาน iRecruit แล้วเสนอในหน้านี้เลย */}
              {boardMatchById[jobDetail.id] && !boardErrorById[jobDetail.id] ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 px-3 py-3 space-y-2 dark:border-blue-800 dark:bg-blue-950/50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                      {irMatchById[jobDetail.id]
                        ? `ผู้สมัครจากฐาน iRecruit → แนะนำ ${recommendedCandidateCount(irMatchById[jobDetail.id].matches)}`
                        : 'ไม่พอ? หาผู้สมัครจากฐาน iRecruit'}
                    </p>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={irLoadingId === jobDetail.id}
                        onClick={() => void fetchIrecruit(jobDetail.id, !!irMatchById[jobDetail.id])}
                        className="jarvis-btn-primary"
                      >
                        {irLoadingId === jobDetail.id ? (
                          'กำลังค้นหา…'
                        ) : irMatchById[jobDetail.id] ? (
                          <>
                            <RefreshCw className="h-3 w-3" /> ค้นหาใหม่
                          </>
                        ) : (
                          <>
                            <Search className="h-3 w-3" /> ค้นหา iRecruit
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {irLoadingId === jobDetail.id ? (
                    <AiEvaluationStatus source="irecruit" />
                  ) : irErrorById[jobDetail.id] ? (
                    <p className="text-[11px] text-destructive">{irErrorById[jobDetail.id]}</p>
                  ) : irMatchById[jobDetail.id] ? (
                    recommendedCandidateCount(irMatchById[jobDetail.id].matches) === 0 &&
                    !(showDistantCandidates && distantCandidateCount(irMatchById[jobDetail.id].matches) > 0) ? (
                      <p className="text-[11px] text-muted-foreground">ไม่พบผู้สมัครที่ใกล้เคียงในฐาน iRecruit</p>
                    ) : (
                      <div className="space-y-2">
                        {buildIrecruitDisplayRows(
                          jobDetail,
                          irMatchById[jobDetail.id].matches
                            .filter((m) => showDistantCandidates || isRecommendedTier(m.tier))
                            .filter((m) => !(hideProposed && proposedByKey[proposalKey('irecruit', m.id)]))
                            // ปฏิเสธงานนี้ไปแล้ว → ไม่เสนอใบนี้อีก (กติกาเดียวกับฝั่งบอร์ด)
                            .filter((m) => showDeclined || !declinedRefs.has(irecruitPersonRef(m.id))),
                          showDistantCandidates,
                        ).map((row) => {
                            if (row.kind === 'branch') {
                              return (
                                <div
                                  key={row.key}
                                  className="mt-3 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 first:mt-0 dark:border-blue-800 dark:bg-blue-950/50"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-blue-950 dark:text-blue-200">{row.branch.branch_name_clean}</p>
                                      <p className="mt-0.5 text-[11px] text-blue-700 dark:text-blue-300">
                                        {[row.branch.district_hint, row.branch.province_hint].filter(Boolean).join(' · ') ||
                                          row.branch.branch_name_raw}
                                      </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">
                                        ต้องการ {row.branch.requested_qty} คน
                                      </p>
                                      <p className="text-[10px] text-blue-600 dark:text-blue-300">พบใกล้สาขา {row.candidateCount} คน</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            const m = row.match;
                            const branchId = row.branchId;
                            const branchName = row.branchName;
                            const key = proposalKey('irecruit', m.id);
                            const proposed = proposedByKey[key];
                            const busy = proposingKey === key;
                            const otherActive = activeProposalByCandidate[key];
                            const activeElsewhere = otherActive && otherActive.job_id !== jobDetail.id ? otherActive : null;
                            const lumosRef = irecruitPersonRef(m.id);
                            const lumosRow = lumosStatusByRef[lumosRef];
                            const canPickForLumos = Boolean(m.phone_number) && !lumosRow;
                            return (
                              <div
                                key={row.key}
                                className={cn(
                                  'matching-candidate-card space-y-1 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900',
                                  proposed ? 'opacity-70' : '',
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                                    <input
                                      type="checkbox"
                                      checked={lumosSelectedIrecruit.includes(m.id)}
                                      disabled={!canPickForLumos}
                                      onChange={() => toggleLumosIrecruit(m.id)}
                                      aria-label={`เลือก ${m.full_name} ให้ AI โทรสัมภาษณ์`}
                                      title={
                                        !m.phone_number
                                          ? 'ไม่มีเบอร์โทร — ให้ AI โทรไม่ได้'
                                          : lumosRow
                                            ? 'ส่ง AI โทรไปแล้ว'
                                            : 'เลือกให้ AI โทรสัมภาษณ์'
                                      }
                                      className="h-4 w-4 shrink-0 cursor-pointer accent-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    />
                                    <TierCriteriaTooltip tier={m.tier}>
                                      <span
                                        tabIndex={0}
                                        aria-label={`เกณฑ์สี ${TIER_CRITERIA[m.tier].label}`}
                                        className="cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                      >
                                        {matchTierEmoji(m.tier)}
                                      </span>
                                    </TierCriteriaTooltip>{' '}
                                    {m.full_name}
                                  </span>
                                  <div className="flex shrink-0 items-center gap-1">
                                    {proposed ? (
                                      <span
                                        className={cn(
                                          'inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                          proposalStatusClass(proposed.status),
                                        )}
                                      >
                                        <CheckCircle2 className="h-2.5 w-2.5" /> {proposalStatusLabel(proposed.status)}
                                      </span>
                                    ) : null}
                                    {activeElsewhere ? (
                                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', TONE.violet.soft, TONE.violet.value)}>
                                        ติดใบขอ {activeElsewhere.request_no || activeElsewhere.job_id.slice(0, 8)}
                                      </span>
                                    ) : null}
                                    <TierCriteriaTooltip tier={m.tier}>
                                      <span
                                        tabIndex={0}
                                        className="cursor-help rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                      >
                                        {matchTierLabel(m.tier)}
                                      </span>
                                    </TierCriteriaTooltip>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                  <span>{m.position_name || m.job_name_th || 'ไม่ระบุตำแหน่ง'}</span>
                                  {m.location_label ? <span>{m.location_label}</span> : null}
                                  {m.age != null ? <span>อายุ {m.age}</span> : null}
                                  {m.phone_number ? (
                                    <a
                                      href={`tel:${m.phone_number}`}
                                      className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline dark:text-sky-300"
                                    >
                                      <Phone className="h-3 w-3" /> {m.phone_number}
                                    </a>
                                  ) : null}
                                </div>
                                <CandidateChecklist
                                  job={jobDetail}
                                  tier={m.tier}
                                  sex={m.sex}
                                  age={m.age}
                                  areaParts={[m.district_name, m.province_name, m.location_label]}
                                  licenses={m.driving_licenses}
                                  screening={irScreeningByRef[String(m.id)]}
                                />
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => setScreeningOpenIrId((prev) => (prev === m.id ? null : m.id))}
                                    className="text-[10px] font-medium text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
                                  >
                                    {screeningOpenIrId === m.id ? 'ปิดผลคัดกรอง' : 'ผลคัดกรอง เหล้า-บุหรี่ / คดี'}
                                  </button>
                                  {screeningOpenIrId === m.id ? (
                                    <div className="mt-1.5">
                                      <ScreeningEditor
                                        source="irecruit"
                                        candidateRef={String(m.id)}
                                        candidateName={m.full_name}
                                        record={irScreeningByRef[String(m.id)]}
                                        onSaved={(rec) =>
                                          setIrScreeningByRef((prev) => ({ ...prev, [rec.candidateRef]: rec }))
                                        }
                                      />
                                    </div>
                                  ) : null}
                                </div>
                                {m.reason ? (
                                  <p className="text-[11px] italic text-slate-600 dark:text-slate-300 line-clamp-2">— {m.reason}</p>
                                ) : null}
                                {proposed ? (
                                  <div className="rounded-lg border border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/5 px-2.5 py-1.5 text-[10px] text-slate-700 dark:text-slate-200">
                                     <p className="font-semibold">
                                       ผู้ดำเนินการ: {proposed.proposedByName || 'ไม่ระบุ'}
                                     </p>
                                     {proposed.branchName ? <p className="mt-0.5 text-blue-700 dark:text-blue-300">สาขา: {proposed.branchName}</p> : null}
                                     <p className="mt-0.5 text-slate-600 dark:text-slate-300">เหตุผล: {proposed.reason || 'ไม่ระบุ'}</p>
                                  </div>
                                ) : null}
                                {/* ⚠️ แถบปุ่มต่อแถว (เพิ่มรายละเอียดผู้สมัคร · ติดต่อแล้ว · จองตัว ·
                                    ลงงานแล้ว · ไม่ผ่าน · ยกเลิก) เคยอยู่ตรงนี้ — เจ้าของสั่งเอาออก
                                    13 ส.ค. 2569: "ใต้ชื่อคนเอาปุ่มที่ฉันบอกไปไว้แค่นั้น"
                                    (3 ทาง: อนุมัติทั้งใบ / ติ๊กส่งโทร / เก็บไปโทรเอง — อยู่ที่แถบ
                                    LumosSendBar ใต้ลิสต์ ไม่ใช่ต่อแถว)
                                    ⚠️ ตัวจัดการ (openIrecruitProposalAction ฯลฯ) ยังอยู่ —
                                    การจอง/ลงงานฝั่ง iRecruit **ไม่มีปุ่มเหลือแล้ว** จนกว่าจะมี
                                    ที่จองใหม่จากผลโทร "สนใจ" (แจ้งเจ้าของแล้ว) · ฝั่งบอร์ดยังจอง
                                    ได้จาก dialog รายละเอียดคน (กดที่ชื่อ) */}
                                {lumosRow ? (
                                  <LumosCallBadgeRow
                                    row={lumosRow}
                                    expanded={lumosExpandedRef === lumosRef}
                                    onToggle={() =>
                                      setLumosExpandedRef((cur) => (cur === lumosRef ? null : lumosRef))
                                    }
                                    onCancel={() => void cancelLumosForRef(lumosRow)}
                                    cancelling={lumosCancellingRef === lumosRef}
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                      </div>
                    )
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      กดค้นหาเพื่อดึงผู้สมัครที่ตรงจากฐาน iRecruit แล้วติ๊กเลือกส่ง AI โทรได้เลย
                    </p>
                  )}
                  <LumosSendBar
                    count={lumosSelectedCount}
                    busy={lumosSending}
                    onClear={clearLumosSelection}
                    creatingBatch={batchCreating}
                    onCreateBatch={() => void createBatchFromSelection()}
                    onSend={() => setLumosConfirmOpen(true)}
                    onHoldSelf={() => void holdSelectedForSelf()}
                    holdingSelf={holdingSelf}
                  />
                  {/* แถบถอนคำอยู่ใต้ทั้งสองแถบติ๊กเลือก — ฝั่ง iRecruit อยู่ท้ายหน้า
                      ถ้ามีที่เดียวข้างบน คนที่ตั้งคิวจากตรงนี้จะไม่เห็นปุ่มยกเลิกเลย */}
                  <CallBatchUndoStrip
                    batches={pendingBatches}
                    cancellingId={batchCancellingId}
                    onCancel={(id) => void cancelPendingBatch(id)}
                  />
                  {proposeError ? <p className="text-[11px] text-destructive">{proposeError}</p> : null}
                </div>
              ) : null}

              {/* #1 หาคนไม่ได้ / คนที่มีไม่โอเค → สร้างคำขอโพสหางานใหม่ (ID ให้ทีมคอนเทนต์รับไปทำต่อ) */}
              {boardMatchById[jobDetail.id] ? (
                <div className={cn('rounded-xl border px-3 py-3 space-y-2', TONE.danger.soft)}>
                  <p className={cn('text-xs font-semibold', TONE.danger.num)}>หาคนไม่ได้เลย หรือคนที่มีไม่โอเค?</p>
                  {jobPostingByJobId[jobDetail.id] ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        title={jobPostingByJobId[jobDetail.id].id}
                        className={cn('rounded-full border px-2 py-0.5 text-[10px] font-mono', TONE.danger.soft, TONE.danger.value, 'bg-white dark:bg-transparent')}
                      >
                        ID: {jobPostingByJobId[jobDetail.id].id.slice(0, 8)}
                      </span>
                      <span
                        className={cn(
                          jobPostingStatusChip(jobPostingByJobId[jobDetail.id].status),
                          'jarvis-chip-sm',
                        )}
                      >
                        {jobPostingByJobId[jobDetail.id].request_type === 'scraping' ? 'Scraping' : 'Content'} ·{' '}
                        {jobPostingStatusLabel(jobPostingByJobId[jobDetail.id].status)}
                      </span>
                      <a href="/matching/job-postings" className="text-[11px] text-blue-700 hover:underline dark:text-blue-300">
                        ดูคำขอทั้งหมด →
                      </a>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={creatingPosting}
                        onClick={() => void createPosting(jobDetail, 'content')}
                        className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-60', TONE.orange.solid)}
                      >
                        <Megaphone className="h-3.5 w-3.5" />
                        {creatingPosting ? 'กำลังสร้าง…' : 'ให้สร้าง Content'}
                      </button>
                      <button
                        type="button"
                        disabled={creatingPosting}
                        onClick={() => void createPosting(jobDetail, 'scraping')}
                        className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-60', TONE.teal.solid)}
                      >
                        <Search className="h-3.5 w-3.5" />
                        {creatingPosting ? 'กำลังสร้าง…' : 'Scraping งาน'}
                      </button>
                    </div>
                  )}
                  {postingError ? <p className="text-[11px] text-destructive">{postingError}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={branchEditorOpen} onOpenChange={(open) => !branchSaveBusy && setBranchEditorOpen(open)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขเงื่อนไขและสาขาของใบขอ</DialogTitle>
            <DialogDescription>
              แก้เพศ ช่วงอายุ ชื่อสถานที่ ที่อยู่ จำนวนคน และพิกัด ก่อนใช้คัดและจัดผู้สมัคร
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/50">
              <p className="mb-2 text-xs font-semibold text-violet-900 dark:text-violet-200">เงื่อนไขผู้สมัคร</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  เพศ
                  <select
                    value={branchEditGender}
                    onChange={(event) => setBranchEditGender(event.target.value)}
                    className="jarvis-soft-field mt-1 w-full"
                  >
                    <option value="">ไม่ระบุ</option>
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                  </select>
                </label>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  อายุต่ำสุด
                  <input
                    type="number"
                    min={15}
                    max={100}
                    value={branchEditAgeMin}
                    onChange={(event) => setBranchEditAgeMin(event.target.value)}
                    className="jarvis-soft-field mt-1 w-full"
                    placeholder="ไม่ระบุ"
                  />
                </label>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  อายุสูงสุด
                  <input
                    type="number"
                    min={15}
                    max={100}
                    value={branchEditAgeMax}
                    onChange={(event) => setBranchEditAgeMax(event.target.value)}
                    className="jarvis-soft-field mt-1 w-full"
                    placeholder="ไม่ระบุ"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">สาขาปฏิบัติงาน</p>
                <p className="text-[10px] text-muted-foreground">แก้ผลที่ระบบแยกจากข้อความต้นทางได้ทุกช่อง</p>
              </div>
            </div>
            {branchDrafts.map((branch, index) => {
              const branchId = branch.branch_id || `branch-${index + 1}`;
              const hasCoordinate = Number.isFinite(branch.lat) && Number.isFinite(branch.lng);
              return (
                <div key={branchId} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-3 dark:border-blue-900 dark:bg-blue-950/50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-blue-950 dark:text-blue-200">สาขา {index + 1}</p>
                    {branchDrafts.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setBranchDrafts((current) => current.filter((item) => item.branch_id !== branchId))}
                        className={cn('text-[11px] font-medium hover:underline', TONE.danger.value)}
                      >
                        ลบสาขา
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                    <label className="md:col-span-4 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      ชื่อสาขา/สถานที่
                      <input
                        value={branch.branch_name_clean}
                        onChange={(event) => updateBranchDraft(branchId, { branch_name_clean: event.target.value })}
                        className="jarvis-soft-field mt-1 w-full"
                        placeholder="เช่น สิงห์คอมเพล็กซ์"
                      />
                    </label>
                    <label className="md:col-span-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      จำนวนคน
                      <input
                        type="number"
                        min={0}
                        value={branch.requested_qty}
                        onChange={(event) => updateBranchDraft(branchId, { requested_qty: Number(event.target.value) })}
                        className="jarvis-soft-field mt-1 w-full"
                      />
                    </label>
                    <label className="md:col-span-6 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      ที่อยู่สาขา
                      <input
                        value={branch.address_raw || ''}
                        onChange={(event) =>
                          updateBranchDraft(branchId, {
                            address_raw: event.target.value,
                            geocode_status: 'unverified',
                          })
                        }
                        className="jarvis-soft-field mt-1 w-full"
                        placeholder="ข้อความที่อยู่ของสาขานี้"
                      />
                    </label>
                    <label className="md:col-span-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      ถนน
                      <input
                        value={branch.road || ''}
                        onChange={(event) => updateBranchDraft(branchId, { road: event.target.value, geocode_status: 'unverified' })}
                        className="jarvis-soft-field mt-1 w-full"
                        placeholder="สามเสน"
                      />
                    </label>
                    <label className="md:col-span-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      แขวง/ตำบล
                      <input
                        value={branch.subdistrict || ''}
                        onChange={(event) =>
                          updateBranchDraft(branchId, { subdistrict: event.target.value, geocode_status: 'unverified' })
                        }
                        className="jarvis-soft-field mt-1 w-full"
                      />
                    </label>
                    <label className="md:col-span-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      เขต/อำเภอ
                      <input
                        value={branch.district_hint || ''}
                        onChange={(event) =>
                          updateBranchDraft(branchId, { district_hint: event.target.value, geocode_status: 'unverified' })
                        }
                        className="jarvis-soft-field mt-1 w-full"
                      />
                    </label>
                    <label className="md:col-span-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      จังหวัด
                      <input
                        value={branch.province_hint || ''}
                        onChange={(event) =>
                          updateBranchDraft(branchId, { province_hint: event.target.value, geocode_status: 'unverified' })
                        }
                        className="jarvis-soft-field mt-1 w-full"
                      />
                    </label>
                    <label className="md:col-span-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      รหัสไปรษณีย์
                      <input
                        value={branch.postal_code || ''}
                        onChange={(event) =>
                          updateBranchDraft(branchId, { postal_code: event.target.value, geocode_status: 'unverified' })
                        }
                        className="jarvis-soft-field mt-1 w-full"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      disabled={branchGeocodeBusyId === branchId}
                      onClick={() => void geocodeBranch(branch)}
                      className={cn('rounded-full border px-3 py-1.5 font-medium disabled:opacity-60', TONE.primary.outline)}
                    >
                      {branchGeocodeBusyId === branchId ? 'กำลังค้นหา…' : 'ค้นหาพิกัดจากที่อยู่'}
                    </button>
                    {hasCoordinate ? (
                      <>
                        <span className="text-slate-600 dark:text-slate-300">
                          {Number(branch.lat).toFixed(6)}, {Number(branch.lng).toFixed(6)}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${branch.lat},${branch.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                        >
                          ดูแผนที่
                        </a>
                        {branch.geocode_status !== 'confirmed' ? (
                          <button
                            type="button"
                            onClick={() => updateBranchDraft(branchId, { geocode_status: 'confirmed' })}
                            className={cn('rounded-full px-3 py-1.5 font-semibold', TONE.success.solid)}
                          >
                            ยืนยันพิกัดนี้
                          </button>
                        ) : (
                          <span className={cn('font-semibold', TONE.success.value)}>ยืนยันพิกัดแล้ว</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-500">
                        {branch.geocode_status === 'not_found' ? 'ไม่พบพิกัด กรุณาแก้ที่อยู่' : 'ยังไม่ได้ตรวจพิกัด'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => {
                const id = globalThis.crypto?.randomUUID?.() || `branch-${Date.now()}`;
                setBranchDrafts((current) => [
                  ...current,
                  {
                    branch_id: id,
                    branch_name_clean: '',
                    address_raw: null,
                    requested_qty: 1,
                    district_hint: null,
                    province_hint: null,
                    geocode_status: 'unverified',
                  },
                ]);
              }}
              className={cn('rounded-full border border-dashed px-3 py-1.5 text-xs font-medium', TONE.primary.outline)}
            >
              + เพิ่มสาขา
            </button>

            {jobDetail &&
            branchDrafts.reduce((sum, branch) => sum + (Number(branch.requested_qty) || 0), 0) !==
              requestPositionCount(jobDetail) ? (
              <p className={cn('rounded-lg border px-3 py-2 text-xs', TONE.warn.soft, TONE.warn.num)}>
                จำนวนรวมของสาขา {branchDrafts.reduce((sum, branch) => sum + (Number(branch.requested_qty) || 0), 0)} คน
                ไม่ตรงกับใบขอ {requestPositionCount(jobDetail)} คน — กรุณาตรวจสอบก่อนบันทึก
              </p>
            ) : null}
            {branchEditorError ? <p className="text-xs text-destructive">{branchEditorError}</p> : null}
            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                disabled={branchSaveBusy}
                onClick={() => setBranchEditorOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={branchSaveBusy}
                onClick={() => void saveBranchDrafts()}
                className={cn('rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-60', TONE.primary.solid)}
              >
                {branchSaveBusy ? 'กำลังบันทึก…' : 'บันทึกเงื่อนไขและสาขา'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* รายละเอียดพนักงานของเรา + เหตุผลที่ AI เลือก */}
      <Dialog open={!!candDetail} onOpenChange={(o) => !o && setCandDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              {candDetail ? boardTierMeta(candDetail.tier).icon : ''} {candDetail?.full_name}
              {candDetail?.nick_name ? ` (${candDetail.nick_name})` : ''}
            </DialogTitle>
            <DialogDescription className="sr-only">รายละเอียดพนักงานของเราและเหตุผลที่ AI เลือก</DialogDescription>
          </DialogHeader>
          {candDetail ? (
            <div className="space-y-3">
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {boardTierMeta(candDetail.tier).label}
              </span>

              <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 dark:border-sky-800 dark:bg-sky-950/50">
                <p className="text-xs font-semibold text-sky-900 dark:text-sky-200">ทำไม AI เลือกคนนี้</p>
                <p className="mt-1 text-xs text-sky-800 leading-relaxed dark:text-sky-200">
                  {candDetail.reason || 'สกิลตรงกับใบขอ'}
                </p>
              </div>

              {jobDetail ? (
                <CandidateChecklist
                  job={jobDetail}
                  tier={candDetail.tier}
                  sex={candDetail.sex_code}
                  age={candDetail.age}
                  areaParts={[candDetail.amphur_name, candDetail.province_name]}
                  salary={candDetail.required_salary}
                  screening={screeningByRef[String(candDetail.card_id)]}
                />
              ) : null}

              {/* ก่อนยกหู: คนนี้ถูกติดต่ออะไรไปแล้วบ้าง (คน+AI รวมเส้นเวลาเดียว คีย์ด้วยเบอร์) */}
              <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                <ContactHistoryStrip phone={candDetail.mobile} />
              </div>

              <ScreeningEditor
                source="board"
                candidateRef={String(candDetail.card_id)}
                candidateName={candDetail.full_name}
                record={screeningByRef[String(candDetail.card_id)]}
                onSaved={(rec) => setScreeningByRef((prev) => ({ ...prev, [rec.candidateRef]: rec }))}
              />

              <div className="rounded-xl border border-white/70 bg-white/40 dark:border-white/10 dark:bg-white/5 px-3 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">สกิล/ตำแหน่ง</span>
                  <span className="text-right text-foreground">
                    {[candDetail.job1_name, candDetail.job2_name].filter(Boolean).join(' / ') || 'ไม่ระบุ'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">เพศ / อายุ</span>
                  <span className="text-right text-foreground">
                    {[candDetail.sex_code, candDetail.age ? `${candDetail.age} ปี` : ''].filter(Boolean).join(' · ') || '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">พื้นที่</span>
                  <span className="text-right text-foreground">
                    {[candDetail.amphur_name, candDetail.province_name].filter(Boolean).join(' ') || '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">เงินเดือนที่ขอ</span>
                  <span className="text-right text-foreground">
                    {candDetail.required_salary ? `${candDetail.required_salary.toLocaleString()} บาท` : '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">รหัสการ์ด</span>
                  <span className="text-right text-foreground">#{candDetail.card_id}</span>
                </div>
              </div>

              {candDetail.mobile ? (
                <a
                  href={`tel:${candDetail.mobile}`}
                  className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold', TONE.info.solid)}
                >
                  <Phone className="h-4 w-4" /> โทร {candDetail.mobile}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">ไม่มีเบอร์โทรในระบบ</p>
              )}

              {/* จองตัว / ลงงาน — บันทึกการเสนอลง DB */}
              {jobDetail ? (
                (() => {
                  const key = proposalKey('board', candDetail.card_id);
                  const current = proposedByKey[key];
                  const busy = proposingKey === key;
                  const otherActive = activeProposalByCandidate[key];
                  const activeElsewhere = otherActive && otherActive.job_id !== jobDetail.id ? otherActive : null;
                  return (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2.5 space-y-2 dark:border-violet-800 dark:bg-violet-950/50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-violet-900 dark:text-violet-200">เสนอคนนี้ให้ใบขอ</p>
                        {current ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                              proposalStatusClass(current.status),
                            )}
                          >
                            <CheckCircle2 className="h-3 w-3" /> {proposalStatusLabel(current.status)}
                          </span>
                        ) : null}
                      </div>
                      {activeElsewhere ? (
                        <p className={cn('rounded-lg border px-2.5 py-2 text-[11px]', TONE.violet.soft, TONE.violet.num)}>
                          ผู้สมัครติดใบขอ {activeElsewhere.request_no || activeElsewhere.job_id} · {proposalStatusLabel(activeElsewhere.status)}
                        </p>
                      ) : null}
                      {current ? (
                        <div className="rounded-lg border border-violet-200 bg-white/80 dark:bg-white/5 px-2.5 py-2 text-[11px] text-slate-700 dark:text-slate-200 dark:border-violet-800">
                          <p className="font-semibold">ผู้ดำเนินการ: {current.proposedByName || 'ไม่ระบุ'}</p>
                          <p className="mt-0.5 text-slate-600 dark:text-slate-300">เหตุผล: {current.reason || 'ไม่ระบุ'}</p>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy || !!activeElsewhere}
                          onClick={() => openBoardProposalAction(jobDetail, candDetail, 'contacted')}
                          className={proposalActionButtonClass('contacted')}
                        >
                          <PhoneCall className="h-3.5 w-3.5" />
                          {busy ? 'กำลังบันทึก…' : current?.status === 'contacted' ? 'ติดต่อแล้ว ✓' : 'ติดต่อแล้ว'}
                        </button>
                        <button
                          type="button"
                          disabled={busy || !!activeElsewhere}
                          onClick={() => openBoardProposalAction(jobDetail, candDetail, 'reserved')}
                          className={proposalActionButtonClass('reserved')}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          {busy ? 'กำลังบันทึก…' : current?.status === 'reserved' ? 'จองตัวแล้ว ✓' : 'จองตัว'}
                        </button>
                        <button
                          type="button"
                          disabled={busy || !!activeElsewhere}
                          onClick={() => openBoardProposalAction(jobDetail, candDetail, 'placed')}
                          className={proposalActionButtonClass('placed')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {busy ? 'กำลังบันทึก…' : current?.status === 'placed' ? 'ลงงานแล้ว ✓' : 'ลงงานแล้ว'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openBoardProposalAction(jobDetail, candDetail, 'rejected')}
                          className={proposalActionButtonClass('rejected')}
                        >
                          <UserX className="h-3.5 w-3.5" />
                          {current?.status === 'rejected' ? 'ไม่ผ่าน ✓' : 'ไม่ผ่าน'}
                        </button>
                        {current && isActiveWorkflowStatus(current.status) ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openCancelProposalAction(jobDetail, key, candDetail.full_name)}
                            className={cn(
                              CANDIDATE_ACTION_BUTTON_CLASS,
                              cn(TONE.danger.outline, 'focus-visible:ring-red-400'),
                            )}
                          >
                            <X className="h-3 w-3" /> ยกเลิกการจอง
                          </button>
                        ) : null}
                      </div>
                      {proposeError ? <p className="text-[11px] text-destructive">{proposeError}</p> : null}
                    </div>
                  );
                })()
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* หน้าจริง: ระบุผู้ดำเนินการและเหตุผลก่อนบันทึกทุกสถานะ */}
      <Dialog
        open={!!proposalActionDraft}
        onOpenChange={(open) => {
          if (!open && !proposalFormBusy) {
            setProposalActionDraft(null);
            setProposalDecisionReason('');
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {proposalActionDraft ? `${proposalActionLabel(proposalActionDraft.status)}?` : 'ยืนยันสถานะผู้สมัคร'}
            </DialogTitle>
            <DialogDescription>
              {proposalActionDraft
                ? `${proposalActionLabel(proposalActionDraft.status)} · ${proposalActionDraft.candidateName}`
                : 'ระบุผู้ดำเนินการและเหตุผลก่อนบันทึก'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-foreground">ผู้ดำเนินการ / ผู้จอง</span>
              <select
                value={proposalOperatorName}
                onChange={(event) => setProposalOperatorName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">— เลือกชื่อ —</option>
                {proposalOperatorName && !proposalOperatorOptions.includes(proposalOperatorName) ? (
                  <option value={proposalOperatorName}>{proposalOperatorName}</option>
                ) : null}
                {proposalOperatorOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-foreground">เหตุผลที่เลือก / เปลี่ยนสถานะ</span>
              <textarea
                value={proposalDecisionReason}
                onChange={(event) => setProposalDecisionReason(event.target.value)}
                rows={4}
                placeholder="ระบุเหตุผลจากการตรวจสอบจริง เช่น สกิลตรง พื้นที่ใกล้ และยืนยันพร้อมเริ่มงาน"
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              เหตุผลนี้เป็นการตัดสินใจของเจ้าหน้าที่ แยกจากเหตุผลที่ AI แนะนำด้านบน
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={proposalFormBusy}
              onClick={() => setProposalActionDraft(null)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              กลับ
            </button>
            <button
              type="button"
              disabled={proposalFormBusy || !proposalOperatorName.trim() || !proposalDecisionReason.trim()}
              onClick={() => void submitProposalAction()}
              className={cn('rounded-full px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50', TONE.primary.solid)}
            >
              {proposalFormBusy ? 'กำลังบันทึก…' : 'ยืนยันและบันทึก'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ผู้สมัครนี้ถูกจองอยู่กับใบขออื่นแล้ว — เลือกยกเลิกอันเดิมแล้วจองใบนี้แทน */}
      <Dialog open={!!conflictInfo} onOpenChange={(o) => !o && setConflictInfo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">ผู้สมัครนี้ถูกจองอยู่แล้ว</DialogTitle>
            <DialogDescription className="sr-only">
              แจ้งเตือนเมื่อพยายามจองผู้สมัครที่มีการจองใบขออื่นอยู่ก่อนแล้ว
            </DialogDescription>
          </DialogHeader>
          {conflictInfo ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">{conflictInfo.message}</p>
              <p className="text-xs text-muted-foreground">
                จองอยู่กับใบขอ: {conflictInfo.conflict.request_no || conflictInfo.conflict.job_id} · สถานะ:{' '}
                {proposalStatusLabel(conflictInfo.conflict.status)}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={resolvingConflict}
                  onClick={() => void resolveConflict()}
                  className={cn('rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-60', TONE.danger.solid)}
                >
                  {resolvingConflict ? 'กำลังยกเลิก…' : 'ยกเลิกใบเดิม แล้วจองใบนี้แทน'}
                </button>
                <button
                  type="button"
                  onClick={() => setConflictInfo(null)}
                  className="jarvis-btn-ghost px-4 py-2"
                >
                  ปิด
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ยืนยันก่อนค้นหาใหม่ (Rematching) — สั่งให้ worker หลังบ้านคิดใหม่ ผลใหม่ทับผลเดิม */}
      <Dialog open={!!rematchConfirmJobId} onOpenChange={(o) => !o && setRematchConfirmJobId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">ค้นหาใหม่ด้วย AI?</DialogTitle>
            <DialogDescription className="sr-only">
              ยืนยันให้ AI ประเมินและจัดอันดับคนของเราสำหรับใบขอนี้ใหม่
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              ระบบจะส่งใบนี้ให้ AI ที่หลังบ้านประเมินใหม่ทั้งหมด — ระหว่างรอยังเห็นผลเดิม
              และผลใหม่จะมาแทนที่อัตโนมัติเมื่อคิดเสร็จ (ปกติไม่กี่นาที)
            </p>
            <p className="text-xs text-muted-foreground">
              ถ้าไม่ต้องการคิดใหม่ ระบบจะคงผลเดิมไว้ (แสดงเฉพาะคนที่ยังพร้อม)
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRematchConfirmJobId(null)}
                className="jarvis-btn-ghost px-4 py-2"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = rematchConfirmJobId;
                  setRematchConfirmJobId(null);
                  if (id) void fetchBoardMatch(id, true);
                }}
                className="jarvis-btn-primary px-4 py-2"
              >
                <RefreshCw className="h-3 w-3" /> ค้นหาใหม่
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ยืนยันก่อนส่งให้ Lumos โทร — AI จะโทรหาคนจริง จึงต้องเห็นรายชื่อครบก่อนกด */}
      {/* popup "คนนี้แมทหลายงาน — ส่งไปงานไหนบ้าง" (เจ้าของสั่ง 12 ส.ค. 2569)
          เด้งก่อนหน้าต่างยืนยัน เมื่อคนที่ติ๊กมีอย่างน้อย 1 คนแมท ≥ 2 งาน
          ใบที่เปิดอยู่ถูกส่งเสมอ (ติ๊กถาวร) · ใบอื่นเลือกเพิ่มได้ ไม่เดาแทน */}
      <Dialog open={jobPickOpen} onOpenChange={(o) => !o && setJobPickOpen(false)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">บางคนแมทอยู่หลายงาน — ส่งไปงานไหนบ้าง</DialogTitle>
            <DialogDescription>
              ใบที่เปิดอยู่ ({jobDetail?.request_no || jobDetail?.id}) ถูกส่งเสมอ · ติ๊กเพิ่มได้ถ้าจะให้
              AI เสนองานอื่นให้เขาด้วย (ระบบเสนอทีละงานอยู่แล้ว ไม่โทรถล่ม)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {jobDetail
              ? lumosSelectedBoard
                  .filter((cardId) => (jobMatchesByCard[String(cardId)] ?? []).length >= 2)
                  .map((cardId) => {
                    const person = boardPersonLabel(cardId);
                    const jobs = jobMatchesByCard[String(cardId)] ?? [];
                    const chosen = extraJobsByCard[cardId] ?? [];
                    return (
                      <div key={cardId} className={cn('rounded-xl border p-3', TONE.neutral.soft)}>
                        <p className="text-sm font-semibold text-foreground">
                          {person.name}{' '}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            แมทอยู่ {jobs.length} งาน
                          </span>
                        </p>
                        <div className="mt-1.5 space-y-1">
                          {jobs.map((j) => {
                            const isCurrent = j.jobId === jobDetail.id;
                            const checked = isCurrent || chosen.includes(j.jobId);
                            return (
                              <label
                                key={j.jobId}
                                className={cn(
                                  'flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-[12px]',
                                  isCurrent ? 'opacity-70' : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isCurrent}
                                  onChange={() =>
                                    setExtraJobsByCard((prev) => {
                                      const cur = prev[cardId] ?? [];
                                      return {
                                        ...prev,
                                        [cardId]: cur.includes(j.jobId)
                                          ? cur.filter((x) => x !== j.jobId)
                                          : [...cur, j.jobId],
                                      };
                                    })
                                  }
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-sky-600 disabled:cursor-default"
                                />
                                <span className="min-w-0">
                                  <span className="font-mono text-[11px]">{j.requestNo || j.jobId}</span>{' '}
                                  {j.position}
                                  {j.unit ? <span className="text-muted-foreground"> · {j.unit}</span> : null}
                                  {isCurrent ? (
                                    <span className={cn('ml-1 font-semibold', TONE.info.value)}>(ใบนี้)</span>
                                  ) : null}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
              : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setJobPickOpen(false)} className="jarvis-btn-ghost">
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setJobPickOpen(false);
                  setLumosConfirmOpen(true);
                }}
                className="jarvis-btn-primary"
              >
                ถัดไป — ไปหน้ายืนยัน
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={lumosConfirmOpen} onOpenChange={(o) => !o && setLumosConfirmOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">ส่ง AI โทร {lumosSelectedCount} คน?</DialogTitle>
            <DialogDescription className="sr-only">
              ยืนยันส่งรายชื่อผู้สมัครที่เลือกเข้าคิว AI โทร
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className={cn('rounded-lg border px-2.5 py-2 text-[11px]', TONE.warn.soft, TONE.warn.num)}>
              AI จะโทรหาคนเหล่านี้จริง — ตรวจรายชื่อให้แน่ใจก่อนกดส่ง
            </p>
            {(() => {
              const boardNames = lumosSelectedBoard.map((cardId) => {
                const { name, phone } = boardPersonLabel(cardId);
                return { key: `card-${cardId}`, name, phone };
              });
              const irNames = (irMatchById[jobDetail?.id ?? '']?.matches ?? [])
                .filter((m) => lumosSelectedIrecruit.includes(m.id))
                .map((m) => ({ key: `ir-${m.id}`, name: m.full_name, phone: m.phone_number }));
              return (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {boardNames.length > 0 ? (
                    <div>
                      <p className={cn('text-[11px] font-semibold', TONE.success.num)}>
                        คนของเรา — แจ้งงาน/โทรตาม ({boardNames.length})
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {boardNames.map((p) => (
                          <li key={p.key} className="text-[11px] text-slate-700 dark:text-slate-200">
                            • {p.name} <span className="text-muted-foreground">{p.phone || '(ไม่มีเบอร์)'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {irNames.length > 0 ? (
                    <div>
                      <p className={cn('text-[11px] font-semibold', TONE.primary.num)}>
                        ผู้สมัคร iRecruit — AI โทรสัมภาษณ์ ({irNames.length})
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {irNames.map((p) => (
                          <li key={p.key} className="text-[11px] text-slate-700 dark:text-slate-200">
                            • {p.name} <span className="text-muted-foreground">{p.phone || '(ไม่มีเบอร์)'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })()}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setLumosConfirmOpen(false)}
                className="jarvis-btn-ghost px-4 py-2"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={lumosSending}
                onClick={() => void sendSelectedToLumos()}
                className="jarvis-btn-primary px-4 py-2"
              >
                <PhoneCall className="h-3 w-3" />
                {lumosSending ? 'กำลังส่ง…' : `ยืนยันส่ง ${lumosSelectedCount} คน`}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* เลือกคนจาก pool "คนของเรา" — ครอบคนที่เพิ่งเพิ่มเข้ามาและยังไม่เคยผ่าน AI แมท */}
      <Dialog open={lumosPickerOpen} onOpenChange={(o) => !o && setLumosPickerOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">เลือกคนส่ง AI โทร</DialogTitle>
            <DialogDescription className="sr-only">
              เลือกผู้สมัครจาก pool คนของเราเพื่อส่งเข้าคิว AI โทร
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <input
              type="search"
              value={lumosPoolSearch}
              onChange={(e) => setLumosPoolSearch(e.target.value)}
              placeholder="ค้นชื่อ / สกิล / พื้นที่ / เบอร์"
              className="w-full rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus-visible:ring-2 focus-visible:ring-sky-400"
            />
            {lumosPoolLoading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                <LoaderCircle className="mx-auto mb-1.5 h-4 w-4 animate-spin text-sky-500" aria-hidden />
                กำลังโหลดรายชื่อคนของเรา…
              </p>
            ) : (
              (() => {
                const rows = filterLumosPool(lumosPool, lumosPoolSearch);
                if (lumosPool.length === 0) {
                  return <p className="py-6 text-center text-xs text-muted-foreground">ไม่มีคนของเราใน pool รอลงงาน</p>;
                }
                if (rows.length === 0) {
                  return <p className="py-6 text-center text-xs text-muted-foreground">ไม่พบคนที่ตรงกับคำค้น</p>;
                }
                return (
                  <>
                    <p className="text-[10px] text-muted-foreground">
                      pool {lumosPool.length} คน (รอลงงาน + รองาน + คนเก่า Re Use + กำลังเสนอใบอื่น) · แสดง {rows.length} ·
                      คนที่ส่งไปแล้วหรือไม่มีเบอร์เลือกไม่ได้
                    </p>
                    <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
                      {rows.map((c) => {
                        const selectable = Boolean(c.mobile) && !c.already_sent;
                        return (
                          <label
                            key={c.card_id}
                            className={cn(
                              'flex items-start gap-2 rounded-xl border px-2.5 py-2',
                              selectable
                                ? cn('cursor-pointer', TONE.neutral.outline, 'hover:border-sky-300 hover:bg-sky-50/50 dark:hover:border-sky-700 dark:hover:bg-sky-950/50')
                                : 'border-slate-200 bg-slate-50 opacity-70 dark:border-slate-700 dark:bg-slate-900/60',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={lumosSelectedBoard.includes(c.card_id)}
                              disabled={!selectable}
                              onChange={() => toggleLumosBoard(c.card_id)}
                              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-semibold text-foreground">{c.full_name}</span>
                                {(() => {
                                  const colBadge = boardColumnBadge(c.column_label);
                                  return colBadge ? (
                                    <span
                                      className={cn(
                                        'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold',
                                        colBadge.cls,
                                      )}
                                    >
                                      {colBadge.text}
                                    </span>
                                  ) : null;
                                })()}
                                {c.already_sent ? (
                                  <span className="rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    ส่งไปแล้ว
                                  </span>
                                ) : null}
                                {!c.mobile ? (
                                  <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-semibold', TONE.warn.soft, TONE.warn.num)}>
                                    ไม่มีเบอร์
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
                                <span>สกิล: {c.skills || 'ไม่ระบุ'}</span>
                                {c.area ? <span>{c.area}</span> : null}
                                {c.age ? <span>อายุ {c.age}</span> : null}
                                {c.required_salary ? <span>ขอ {c.required_salary.toLocaleString()} บ.</span> : null}
                                {c.mobile ? <span className="font-medium text-sky-700 dark:text-sky-300">{c.mobile}</span> : null}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                );
              })()
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5">
              <p className="text-[11px] font-semibold text-sky-900 dark:text-sky-200">เลือกไว้ {lumosSelectedBoard.length} คน</p>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLumosPickerOpen(false)}
                  className="jarvis-btn-ghost px-4 py-2"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  disabled={lumosSelectedCount === 0}
                  onClick={() => {
                    setLumosPickerOpen(false);
                    setLumosConfirmOpen(true);
                  }}
                  className="jarvis-btn-primary px-4 py-2"
                >
                  <PhoneCall className="h-3 w-3" /> ถัดไป ({lumosSelectedCount} คน)
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchingPage;
