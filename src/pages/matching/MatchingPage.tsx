import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { Phone, MapPin, Search, Users, RefreshCw, Building2, ExternalLink, Clock3, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { useAuth } from '@/contexts/AuthContext';
import {
  saveProposal,
  listProposalsForJob,
  listProposalsForJobs,
  listActiveProposals,
  cancelProposal,
  proposalKey,
  proposalStatusLabel,
  ProposalConflictError,
  type ProposalStatus,
  type ProposalConflictInfo,
  type CandidateProposal,
} from '@/lib/candidateProposalsApi';
import { CheckCircle2, UserPlus, Megaphone, X } from 'lucide-react';
import { classifyJobFamily, candidateMatchesFamily, fallbackKeywords } from '@/lib/jobFamilyLexicon';
import {
  type IrecruitCandidateMatch,
  type IrecruitMatchResult,
  matchTierEmoji,
  matchTierLabel,
} from '@/lib/irecruitMatchTypes';
import {
  getActiveJobPostingForJob,
  createJobPostingRequest,
  jobPostingStatusLabel,
  type JobPostingRequest,
} from '@/lib/jobPostingRequestsApi';
import { buildErpBranchDemandInput, parseErpBranchDemand } from '@/lib/erpBranchDemandParser';
import {
  distributeIrecruitMatchesToBranches,
  type BranchDemandItem,
} from '@/lib/distributeIrecruitToBranches';
import {
  saveUnitRequestMeta,
  unitRequestNoteKey,
  type UnitBranchOverride,
} from '@/lib/siamrajUnitRequestsApi';

/** สถานะการเสนอ + id แถวจริงใน DB (ไว้ยกเลิก) — คีย์ = source#ref */
type ProposedRef = {
  id: string;
  status: ProposalStatus;
  branchName: string | null;
  proposedByName: string | null;
  reason: string | null;
  updatedAt: string;
};
type WorkflowFilter = 'all' | 'sla' | 'green' | 'yellow' | 'none' | 'reserved';
type ProposalActionDraft = {
  candidateName: string;
  status: ProposalStatus;
  submit: (operatorName: string, reason: string) => Promise<void>;
};

/** "คนของเรา" — ผ่านสัมภาษณ์แล้ว รอลงงาน (จาก board) แมทกับใบขอด้วย AI */
type BoardCandidateMatch = {
  card_id: number;
  full_name: string;
  nick_name: string | null;
  mobile: string | null;
  sex_code: string | null;
  age: number | null;
  required_salary: number | null;
  job1_name: string | null;
  job2_name: string | null;
  province_name: string | null;
  amphur_name: string | null;
  tier: 'green' | 'yellow' | 'red';
  reason: string;
};
type BoardMatchResult = {
  jobId: string;
  job_family_code: string;
  job_family_label: string;
  pool_size: number;
  matches: BoardCandidateMatch[];
};

type MatchTier = BoardCandidateMatch['tier'];
type IrecruitDisplayRow =
  | { kind: 'branch'; key: string; branch: BranchDemandItem; candidateCount: number }
  | {
      kind: 'candidate';
      key: string;
      match: IrecruitCandidateMatch;
      branchId: string | null;
      branchName: string | null;
    };
const MATCHING_AI_PREWARM_ENABLED = import.meta.env.VITE_MATCHING_AI_PREWARM_ENABLED === 'true';

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

const TIER_CRITERIA: Record<MatchTier, { label: string; detail: string; dot: string }> = {
  green: {
    label: 'เขียว — เข้าข่ายมาก',
    detail: 'ตำแหน่งตรงหรือใกล้มาก อยู่สายงานเดียวกัน หรืองานใกล้เคียงระดับเขียว',
    dot: 'bg-emerald-500',
  },
  yellow: {
    label: 'เหลือง — พอได้ ต้องเช็ค',
    detail: 'งานใกล้เคียงและมีโอกาสทำได้ แต่ต้องเช็คประสบการณ์จริง คุณสมบัติสำคัญ หรือการเทรนเพิ่ม',
    dot: 'bg-amber-400',
  },
  red: {
    label: 'แดง — ห่างไกล',
    detail: 'คนละสายงาน ห่างจากตำแหน่งที่ขอมาก หรือคุณสมบัติสำคัญไม่สอดคล้อง',
    dot: 'bg-red-500',
  },
};

function TierCriteriaTooltip({ tier, children }: { tier: MatchTier; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="left" className="w-[min(340px,calc(100vw-24px))] space-y-2 p-3 text-left">
        <p className="text-xs font-semibold">AI ใช้เกณฑ์อะไรในการจัดสี?</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          เทียบตำแหน่งที่สมัครกับตำแหน่งในใบขอ สายงาน (Job Family) งานใกล้เคียงที่ยอมรับได้ และคุณสมบัติที่มีข้อมูล
          เช่น สกิล/ประสบการณ์ เพศ อายุ ใบขับขี่ และพื้นที่
        </p>
        <ul className="space-y-1.5">
          {(['green', 'yellow', 'red'] as const).map((candidateTier) => {
            const item = TIER_CRITERIA[candidateTier];
            return (
              <li
                key={candidateTier}
                className={cn(
                  'flex gap-2 rounded-md px-2 py-1.5 text-[11px] leading-snug',
                  tier === candidateTier ? 'bg-muted font-medium' : '',
                )}
              >
                <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', item.dot)} aria-hidden="true" />
                <span>
                  <span className="font-semibold">{item.label}</span>
                  <br />
                  {item.detail}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="border-t pt-2 text-[10px] leading-relaxed text-muted-foreground">
          สีเป็นคำแนะนำจาก AI ควรเช็คข้อมูลจริงกับผู้สมัครก่อนจองตัวหรือลงงาน
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

const ACTIVE_WORKFLOW_STATUSES: ProposalStatus[] = ['reserved', 'contacted', 'placed'];

function isActiveWorkflowStatus(status: ProposalStatus): boolean {
  return ACTIVE_WORKFLOW_STATUSES.includes(status);
}

function proposalStatusClass(status: ProposalStatus): string {
  if (status === 'placed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'reserved') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (status === 'contacted') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'rejected') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

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

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

function AiEvaluationStatus({ source }: { source: 'board' | 'irecruit' }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isBoard = source === 'board';
  const estimate = isBoard ? 'ปกติประมาณ 30–90 วินาที' : 'ปกติประมาณ 1–3 นาที';
  const stage = isBoard
    ? elapsedSeconds < 15
      ? 'กำลังอ่านสเปกใบขอ'
      : elapsedSeconds < 60
        ? 'กำลังเทียบสกิล พื้นที่ และเงื่อนไข'
        : 'AI ยังประเมินและจัดอันดับอยู่'
    : elapsedSeconds < 20
      ? 'กำลังค้นหาผู้สมัครในฐาน iRecruit'
      : elapsedSeconds < 60
        ? 'กำลังคัดคนที่อยู่ในสายงานใกล้เคียง'
        : 'AI กำลังประเมินและจัดอันดับผู้สมัคร';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-xl border px-3 py-3 shadow-sm',
        isBoard ? 'border-sky-200 bg-sky-50/80' : 'border-blue-200 bg-blue-50/80',
      )}
    >
      <div className="flex items-start gap-2.5">
        <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <p className="text-xs font-semibold text-blue-900">กำลังรอ AI ประเมิน — ระบบไม่ได้ค้าง</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-blue-700">
              <Clock3 className="h-3 w-3" /> {formatElapsed(elapsedSeconds)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-blue-800">{stage}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-blue-400 via-sky-500 to-blue-400" />
          </div>
          <p className="mt-1.5 text-[10px] text-blue-700">{estimate} · ไม่ต้องกดซ้ำ สามารถรอหน้านี้ได้</p>
        </div>
      </div>
    </div>
  );
}

type CheckVerdict = 'pass' | 'warn' | 'fail' | 'unknown';

function normText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function genderVerdict(required: string | null | undefined, actual: string | null | undefined): CheckVerdict {
  const req = normText(required);
  const value = normText(actual);
  if (!req || req === 'ไม่ระบุ' || !value) return 'unknown';
  const male = ['m', 'male', 'ชาย'].includes(value);
  const female = ['f', 'female', 'หญิง'].includes(value);
  if (req.includes('ชาย')) return male ? 'pass' : 'fail';
  if (req.includes('หญิง')) return female ? 'pass' : 'fail';
  return 'unknown';
}

function ageVerdict(job: JobRequest, age: number | null | undefined): CheckVerdict {
  if (job.age_range_min == null && job.age_range_max == null) return 'unknown';
  if (age == null) return 'unknown';
  if (job.age_range_min != null && age < job.age_range_min) return 'fail';
  if (job.age_range_max != null && age > job.age_range_max) return 'fail';
  return 'pass';
}

function areaVerdict(job: JobRequest, parts: Array<string | null | undefined>): CheckVerdict {
  const candidateParts = parts.map(normText).filter(Boolean);
  if (candidateParts.length === 0) return 'unknown';
  const jobArea = normText(`${job.location_address} ${job.unit_name}`);
  return candidateParts.some((part) => jobArea.includes(part)) ? 'pass' : 'warn';
}

function salaryVerdict(job: JobRequest, salary: number | null | undefined): CheckVerdict {
  if (!salary || !job.total_income) return 'unknown';
  return salary <= job.total_income ? 'pass' : 'warn';
}

const CHECK_META: Record<CheckVerdict, { icon: string; cls: string }> = {
  pass: { icon: '✓', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  warn: { icon: '!', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  fail: { icon: '×', cls: 'border-red-200 bg-red-50 text-red-700' },
  unknown: { icon: '?', cls: 'border-slate-200 bg-slate-50 text-slate-500' },
};

function CheckChip({ label, verdict }: { label: string; verdict: CheckVerdict }) {
  const meta = CHECK_META[verdict];
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', meta.cls)}>
      {label} {meta.icon}
    </span>
  );
}

function CandidateChecklist({
  job,
  tier,
  sex,
  age,
  areaParts,
  salary,
  licenses,
}: {
  job: JobRequest;
  tier: MatchTier;
  sex?: string | null;
  age?: number | null;
  areaParts: Array<string | null | undefined>;
  salary?: number | null;
  licenses?: string[];
}) {
  const position: CheckVerdict = tier === 'green' ? 'pass' : tier === 'yellow' ? 'warn' : 'fail';
  const requiresLicense = Boolean(job.vehicle_required && normText(job.vehicle_required) !== 'ไม่ระบุ');
  const license: CheckVerdict = requiresLicense
    ? licenses == null
      ? 'unknown'
      : licenses.length > 0
        ? 'pass'
        : 'warn'
    : 'unknown';
  return (
    <div className="flex flex-wrap gap-1" aria-label="ผลตรวจคุณสมบัติเบื้องต้น">
      <CheckChip label="ตำแหน่ง" verdict={position} />
      <CheckChip label="พื้นที่" verdict={areaVerdict(job, areaParts)} />
      <CheckChip label="เพศ" verdict={genderVerdict(job.gender_requirement, sex)} />
      <CheckChip label="อายุ" verdict={ageVerdict(job, age)} />
      {salary !== undefined ? <CheckChip label="เงินเดือน" verdict={salaryVerdict(job, salary)} /> : null}
      {requiresLicense ? <CheckChip label="ใบขับขี่" verdict={license} /> : null}
    </div>
  );
}

function boardTierMeta(tier: BoardCandidateMatch['tier']): { icon: string; label: string; cls: string } {
  if (tier === 'green') return { icon: '🟢', label: 'ลงได้ทันที', cls: 'border-emerald-200 bg-emerald-50/60' };
  if (tier === 'red') return { icon: '🔴', label: 'ห่างไกล', cls: 'border-red-200 bg-red-50/50' };
  return { icon: '🟡', label: 'พอได้ ต้องเช็ค', cls: 'border-amber-200 bg-amber-50/60' };
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
  const { user } = useAuth();
  const { jobs, loading: loadingJobs } = useUnitRequestsFeed();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [unitFilter, setUnitFilter] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>('all');
  const [jobDetail, setJobDetail] = useState<JobRequest | null>(null);

  const [boardMatchById, setBoardMatchById] = useState<Record<string, BoardMatchResult>>({});
  const [boardLoadingId, setBoardLoadingId] = useState<string | null>(null);
  const [boardErrorById, setBoardErrorById] = useState<Record<string, string>>({});
  // #2 (ยุบ) — หาผู้สมัคร iRecruit + เสนอในหน้า match เลย (ไม่ต้องไป pre-check)
  const [irMatchById, setIrMatchById] = useState<Record<string, IrecruitMatchResult>>({});
  const [irLoadingId, setIrLoadingId] = useState<string | null>(null);
  const [irErrorById, setIrErrorById] = useState<Record<string, string>>({});
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
  // สีแดงเป็นผลห่างไกล: ซ่อนจากงานประจำและไม่นับเป็น AI แนะนำ แต่เปิดดูเพื่อตรวจ AI ได้
  const [showDistantCandidates, setShowDistantCandidates] = useState(false);
  const [branchEditorOpen, setBranchEditorOpen] = useState(false);
  const [branchDrafts, setBranchDrafts] = useState<UnitBranchOverride[]>([]);
  const [branchSaveBusy, setBranchSaveBusy] = useState(false);
  const [branchGeocodeBusyId, setBranchGeocodeBusyId] = useState<string | null>(null);
  const [branchEditorError, setBranchEditorError] = useState<string | null>(null);
  // #1 คำขอโพสหางานใหม่ — สร้าง ID ให้ทีมคอนเทนต์/สรรหารับไปทำต่อ
  const [jobPostingByJobId, setJobPostingByJobId] = useState<Record<string, JobPostingRequest>>({});
  const [creatingPosting, setCreatingPosting] = useState(false);
  const [postingError, setPostingError] = useState<string | null>(null);
  // #5 pre-warm AI งานด่วนเบื้องหลัง
  const [prewarming, setPrewarming] = useState(false);
  const prewarmStartedRef = useRef(false);

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
      if (!cancelled) setProposalsByJobId(byJob);
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

  // #5 pre-warm AI แมทงานด่วนล่วงหน้าเบื้องหลัง (~30วิ/ใบ) — เปิดใบด่วนแล้วผลพร้อมทันที
  // ทำแบบระวัง: เฉพาะงานด่วนที่ใกล้ครบกำหนดสุด, ทีละใบ, จำกัดจำนวน, ข้ามใบที่มีผล/เคยอุ่นแล้ว
  const PREWARM_LIMIT = 3;
  useEffect(() => {
    if (!MATCHING_AI_PREWARM_ENABLED) return;
    // รันครั้งเดียวเมื่อ jobs โหลดเสร็จ (กัน re-run จาก jobs อ้างอิงใหม่ทุก render)
    if (prewarmStartedRef.current || jobs.length === 0) return;
    prewarmStartedRef.current = true;
    let cancelled = false;
    const targets = jobs
      .filter((j) => j.urgency === 'urgent')
      .slice()
      .sort((a, b) => (a.required_date || '').localeCompare(b.required_date || ''))
      .slice(0, PREWARM_LIMIT);
    if (targets.length === 0) return;

    const run = async () => {
      setPrewarming(true);
      for (const j of targets) {
        if (cancelled) break;
        try {
          const r = await apiFetch(`/api/matching/board-candidates?jobId=${encodeURIComponent(j.id)}`);
          if (!r.ok) continue;
          const data = (await r.json()) as BoardMatchResult;
          if (!cancelled) setBoardMatchById((prev) => (prev[j.id] ? prev : { ...prev, [j.id]: data }));
        } catch {
          /* เงียบ — เป็นการอุ่นเครื่องเบื้องหลัง */
        }
      }
      if (!cancelled) setPrewarming(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length]);

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
      const data = (await r.json()) as BoardMatchResult;
      setBoardMatchById((prev) => ({ ...prev, [jobId]: data }));
    } catch (e) {
      setBoardErrorById((prev) => ({ ...prev, [jobId]: e instanceof Error ? e.message : 'ค้นหาไม่สำเร็จ' }));
    } finally {
      setBoardLoadingId((current) => (current === jobId ? null : current));
    }
  };

  // เปิดใบขอ → หาคนของเราอัตโนมัติ + โหลดสถานะการเสนอ/คำขอโพสหางานที่เคยบันทึก
  const openJob = (j: JobRequest) => {
    setJobDetail(j);
    setShowDistantCandidates(false);
    setProposeError(null);
    setPostingError(null);
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
    if (!jobId || jobs.length === 0) return;
    const job = jobs.find((j) => j.id === jobId);
    if (job) openJob(job);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, jobs]);

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

  const createPosting = async (job: JobRequest) => {
    setCreatingPosting(true);
    setPostingError(null);
    try {
      const item = await createJobPostingRequest({
        jobId: job.id,
        requestNo: job.request_no,
        reason: composePostingReason(job),
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
      const fieldOverrides = { ...(jobDetail.field_overrides || {}), branches };
      await saveUnitRequestMeta(unitRequestNoteKey(jobDetail), { field_overrides: fieldOverrides });
      setJobDetail((current) => (current ? { ...current, field_overrides: fieldOverrides } : current));
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

  const unitOptions = useMemo(
    () => [
      { value: '', label: '— ทุกหน่วยงาน —' },
      ...Array.from(new Set(jobs.map((j) => j.unit_name).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ value: name, label: name })),
    ],
    [jobs],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs
      .filter((j) => (urgentOnly ? j.urgency === 'urgent' : true))
      .filter((j) => (unitFilter ? j.unit_name === unitFilter : true))
      .filter((j) => (q ? unitRequestSearchBlob(j).includes(q) : true))
      .filter((j) => {
        if (workflowFilter === 'all') return true;
        if (workflowFilter === 'sla') {
          const status = jobToRequestControlRecord(j).slaStatus;
          return status === 'at_risk' || status === 'breached';
        }
        if (workflowFilter === 'reserved') {
          return (proposalsByJobId[j.id] ?? []).some((item) => item.status === 'reserved');
        }
        const matches = boardMatchById[j.id]?.matches;
        if (!matches) return false;
        if (workflowFilter === 'green') return matches.some((match) => match.tier === 'green');
        if (workflowFilter === 'yellow') {
          return !matches.some((match) => match.tier === 'green') && matches.some((match) => match.tier === 'yellow');
        }
        return recommendedCandidateCount(matches) === 0;
      })
      .sort((a, b) => {
        // SLA เกิน/เสี่ยงขึ้นก่อน ตามด้วยงานด่วนและวันที่ต้องการเร็วสุด
        const slaRank = (job: JobRequest) => {
          const status = jobToRequestControlRecord(job).slaStatus;
          return status === 'breached' ? 0 : status === 'at_risk' ? 1 : 2;
        };
        const sa = slaRank(a);
        const sb = slaRank(b);
        if (sa !== sb) return sa - sb;
        const ua = a.urgency === 'urgent' ? 0 : 1;
        const ub = b.urgency === 'urgent' ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return (a.required_date || '').localeCompare(b.required_date || '');
      });
  }, [jobs, search, urgentOnly, unitFilter, workflowFilter, proposalsByJobId, boardMatchById]);

  // นับ "คนของเราน่าจะตรง" ต่อใบขอแบบเบา (ไม่เรียก AI) โชว์ตั้งแต่หน้าแรก
  // #6 แม่นขึ้น: classify ใบขอเข้า job family ก่อน แล้วนับผู้สมัครที่สกิลอยู่ family เดียวกัน
  //   (แทน keyword ดิบที่ over-count จากคำกว้าง ๆ) — fallback เป็น keyword overlap ถ้า classify ไม่ได้
  const quickCounts = useMemo(() => {
    const out: Record<string, number> = {};
    if (pool.length === 0) return out;
    const poolText = pool.map((c) => `${c.job1_name || ''} ${c.job2_name || ''}`.toLowerCase());
    for (const j of rows) {
      const title = jobTitleText(j);
      const family = classifyJobFamily(title);
      if (family) {
        out[j.id] = poolText.filter((t) => candidateMatchesFamily(t, family)).length;
        continue;
      }
      const kws = fallbackKeywords(title);
      out[j.id] = kws.length === 0 ? 0 : poolText.filter((t) => kws.some((k) => t.includes(k))).length;
    }
    return out;
  }, [rows, pool]);

  // #4 dashboard เล็ก — แยกคำแนะนำ AI ออกจากสถานะจอง/ลงงานจริง
  // ถ้าวิเคราะห์แล้วให้นับเฉพาะสีเขียว; ถ้ายังไม่วิเคราะห์ใช้ quick count และติดป้ายว่าเป็นประมาณการ
  const urgentSummary = useMemo(() => {
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
  }, [rows, quickCounts, boardMatchById]);

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
      <PageHeader title="Matching — คนของเรา" subtitle="เปิดใบขอ แล้วหาคนที่ผ่านสัมภาษณ์รอลงงานที่สกิลตรง" backPath="/matching" />
      <div className="px-4 md:px-6 space-y-4">
        {/* ตัวกรอง */}
        <div className="glass-card rounded-[1.5rem] p-4 md:p-5 border border-white/70 space-y-3">
          <div className="flex items-center gap-2">
            <div className="glass-card rounded-xl px-3 py-2 border border-white/70 flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-blue-600 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหา site / หน่วยงาน / ตำแหน่ง / สถานที่"
                className="bg-transparent text-sm outline-none flex-1"
              />
            </div>
            <button
              type="button"
              onClick={() => setUrgentOnly((v) => !v)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition-colors',
                urgentOnly
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-white/70 bg-white/50 text-muted-foreground hover:border-destructive/30',
              )}
            >
              🔴 ด่วนเท่านั้น
            </button>
          </div>
          <SearchableSelect
            value={unitFilter}
            onChange={setUnitFilter}
            options={unitOptions}
            placeholder="ทุกหน่วยงาน"
            searchPlaceholder="ค้นหาหน่วยงาน..."
            emptyText="ไม่พบหน่วยงาน"
          />
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                ['all', 'ทั้งหมด'],
                ['sla', 'SLA เสี่ยง/เกิน'],
                ['green', 'มีคนเขียว'],
                ['yellow', 'มีแต่เหลือง'],
                ['none', 'AI ไม่พบคน'],
                ['reserved', 'จองแล้ว'],
              ] as Array<[WorkflowFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setWorkflowFilter(value)}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  workflowFilter === value
                    ? 'border-blue-300 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* #4 สรุปงานด่วน: พร้อมลง vs ยังไม่มีคนของเรา */}
        {urgentSummary.total > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card rounded-2xl border border-red-200/70 bg-red-50/50 px-3 py-2.5 text-center">
              <div className="text-lg font-bold tabular-nums text-red-600">{urgentSummary.total}</div>
              <div className="text-[11px] text-muted-foreground">ใบขอด่วน</div>
            </div>
            <div className="glass-card rounded-2xl border border-emerald-200/70 bg-emerald-50/50 px-3 py-2.5 text-center">
              <div className="text-lg font-bold tabular-nums text-emerald-600">{urgentSummary.greenSuggested}</div>
              <div className="text-[11px] text-muted-foreground">มีคนเขียวแนะนำ</div>
            </div>
            <div className="glass-card rounded-2xl border border-amber-200/70 bg-amber-50/50 px-3 py-2.5 text-center">
              <div className="text-lg font-bold tabular-nums text-amber-600">{urgentSummary.none}</div>
              <div className="text-[11px] text-muted-foreground">ยังไม่มีคน</div>
            </div>
          </div>
        ) : null}
        {urgentSummary.total > 0 ? (
          <p className="px-1 text-[11px] text-muted-foreground">
            {urgentSummary.analyzedCount > 0
              ? `AI วิเคราะห์แล้ว ${urgentSummary.analyzedCount} ใบ · ที่เหลือประมาณจากสกิล (ยังไม่ใช่การยืนยันว่าพร้อมลงงาน)`
              : 'ประมาณการจากสกิล (ยังไม่ผ่าน AI) — กดใบขอเพื่อให้ AI คัดจริง'}
          </p>
        ) : null}

        <div className="flex items-center gap-2 px-1">
          <p className="text-sm text-muted-foreground">
            ใบขอ <span className="text-blue-600 font-bold tabular-nums">{rows.length}</span> รายการ
            {loadingJobs ? ' · กำลังโหลด…' : ''}
          </p>
          <p className="text-xs text-muted-foreground">· เรียง SLA เกิน/เสี่ยงและงานด่วนขึ้นก่อน · กดเพื่อหาคนของเราที่ตรง</p>
          {prewarming ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" /> อุ่นเครื่อง AI งานด่วนล่วงหน้า…
            </span>
          ) : null}
        </div>

        {/* การ์ดรวมใบขอ */}
        <div className="space-y-2.5">
          {rows.length === 0 && !loadingJobs ? (
            <div className="glass-card rounded-2xl p-8 border border-white/70 text-center text-muted-foreground">
              <Search className="w-8 h-8 text-blue-400/60 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">ไม่พบใบขอตามเงื่อนไข</p>
            </div>
          ) : null}
          {rows.map((j) => {
            const matchCount = boardMatchById[j.id]
              ? recommendedCandidateCount(boardMatchById[j.id].matches)
              : undefined;
            const progress = proposalCounts(proposalsByJobId[j.id]);
            const requested = requestPositionCount(j);
            const remaining = officialRemainingCount(j);
            return (
              <div
                key={j.id}
                role="button"
                tabIndex={0}
                onClick={() => openJob(j)}
                onKeyDown={(e) => e.key === 'Enter' && openJob(j)}
                className="glass-card rounded-2xl px-3 py-2.5 border border-white/70 cursor-pointer hover:border-sky-300/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-blue-600 text-sm truncate">{unitRequestCardTitle(j)}</div>
                    {unitRequestCardSubtitle(j) ? (
                      <div className="text-[11px] text-muted-foreground truncate">{unitRequestCardSubtitle(j)}</div>
                    ) : null}
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{j.location_address}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full',
                        j.urgency === 'urgent' ? 'bg-destructive/15 text-destructive' : 'bg-info/15 text-info',
                      )}
                    >
                      {j.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
                    </span>
                    {matchCount != null ? (
                      <span
                        title="จำนวนที่ AI แนะนำจากคนของเรา — ยังไม่ใช่การยืนยันว่าพร้อมลงงาน"
                        className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                      >
                        AI แนะนำ {matchCount}
                      </span>
                    ) : quickCounts[j.id] ? (
                      <span
                        title="ประมาณการเบื้องต้นจากสกิล (ยังไม่ผ่าน AI) — กดเพื่อให้ AI คัดจริง"
                        className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
                      >
                        น่าจะตรง ~{quickCounts[j.id]}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {j.total_income.toLocaleString()} บาท · ต้องการ {formatYmdDmyBe(j.required_date)}
                    </span>
                    <span className="block truncate text-[10px] text-slate-600">
                      ขอ {requested} · ติดต่อ {progress.contacted} · จอง {progress.reserved} · ลงงานใน Matching {progress.placed} · เหลือหาทางการ {remaining}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openJob(j);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-200 bg-sky-50/70 px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100"
                  >
                    <Users className="h-3 w-3" />
                    {matchCount != null
                      ? `ดูคนของเรา (${matchCount})`
                      : boardLoadingId === j.id
                        ? 'AI กำลังประเมิน…'
                        : 'หาคนของเรา'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawer: คนของเรา ต่อใบขอ */}
      <Sheet open={!!jobDetail} onOpenChange={(o) => !o && closeJob()}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground">คนของเรา — ผ่านสัมภาษณ์ รอลงงาน</SheetTitle>
            <SheetDescription className="sr-only">ผู้สมัครที่พร้อมลงงานซึ่งสกิลตรงกับใบขอ</SheetDescription>
          </SheetHeader>
          {jobDetail ? (
            <div className="space-y-3 mt-2">
              <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">{unitRequestCardTitle(jobDetail)}</div>
                      {jobDetail.request_no ? (
                        <div className="text-[11px] text-muted-foreground">{jobDetail.request_no}</div>
                      ) : null}
                    </div>
                  </div>
                  <Link
                    to={unitRequestPath(jobDetail)}
                    state={{ returnTo: '/matching/match' }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                  >
                    ดูใบขอ <ExternalLink className="h-3 w-3" />
                  </Link>
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
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                    เพศ: {jobDetail.gender_requirement || 'ไม่ระบุ'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                    อายุ:{' '}
                    {jobDetail.age_range_min != null || jobDetail.age_range_max != null
                      ? `${jobDetail.age_range_min ?? '—'}–${jobDetail.age_range_max ?? '—'}`
                      : 'ไม่ระบุ'}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                    {jobDetail.total_income.toLocaleString()} บาท
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                    ต้องการ: {formatYmdDmyBe(jobDetail.required_date)}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      jobDetail.urgency === 'urgent'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-sky-200 bg-sky-50 text-sky-700',
                    )}
                  >
                    {jobDetail.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
                  </span>
                </div>
              </div>

              {(() => {
                const progress = proposalCounts(proposalsByJobId[jobDetail.id]);
                const recommended =
                  recommendedCandidateCount(boardMatchById[jobDetail.id]?.matches) +
                  recommendedCandidateCount(irMatchById[jobDetail.id]?.matches);
                const cells = [
                  { label: 'ขอ', value: requestPositionCount(jobDetail), cls: 'text-slate-700' },
                  { label: 'AI แนะนำ', value: recommended, cls: 'text-sky-700' },
                  { label: 'ติดต่อ', value: progress.contacted, cls: 'text-blue-700' },
                  { label: 'จอง', value: progress.reserved, cls: 'text-violet-700' },
                  { label: 'ลงงาน Matching', value: progress.placed, cls: 'text-emerald-700' },
                  { label: 'เหลือหาทางการ', value: officialRemainingCount(jobDetail), cls: 'text-amber-700' },
                ];
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                      {cells.map((cell) => (
                        <div key={cell.label} className="rounded-lg bg-white px-1.5 py-1.5 text-center">
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
                    ? `AI แมทสกิล · จาก pool ${boardMatchById[jobDetail.id].pool_size} คน → แนะนำ ${recommendedCandidateCount(boardMatchById[jobDetail.id].matches)}`
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
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300',
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
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-red-200',
                        )}
                      >
                        {showDistantCandidates ? 'ซ่อนคนห่างไกล' : `แสดงคนห่างไกล (${distant})`}
                      </button>
                    ) : null;
                  })()}
                  <button
                    type="button"
                    disabled={boardLoadingId === jobDetail.id}
                    onClick={() => void fetchBoardMatch(jobDetail.id, true)}
                    className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <RefreshCw className={cn('h-3 w-3', boardLoadingId === jobDetail.id && 'animate-spin')} />
                    {boardLoadingId === jobDetail.id ? 'AI กำลังประเมิน…' : 'ค้นหาใหม่'}
                  </button>
                </div>
              </div>

              {boardLoadingId === jobDetail.id ? (
                <AiEvaluationStatus source="board" />
              ) : boardErrorById[jobDetail.id] ? (
                <p className="text-xs text-destructive">{boardErrorById[jobDetail.id]}</p>
              ) : boardMatchById[jobDetail.id] ? (
                recommendedCandidateCount(boardMatchById[jobDetail.id].matches) === 0 &&
                !(showDistantCandidates && distantCandidateCount(boardMatchById[jobDetail.id].matches) > 0) ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3 text-xs text-foreground">
                    ยังไม่มีคนของเราที่เข้าข่ายกับใบขอนี้ — ลองหาจากฐาน iRecruit ด้านล่าง แล้วเสนอได้เลย
                  </p>
                ) : (
                  <div className="space-y-2">
                    {boardMatchById[jobDetail.id].matches
                      .filter((m) => showDistantCandidates || isRecommendedTier(m.tier))
                      .filter((m) => !(hideProposed && proposedByKey[proposalKey('board', m.card_id)]))
                      .map((m) => {
                      const meta = boardTierMeta(m.tier);
                      const candidateKey = proposalKey('board', m.card_id);
                      const proposed = proposedByKey[candidateKey];
                      const otherActive = activeProposalByCandidate[candidateKey];
                      const activeElsewhere = otherActive && otherActive.job_id !== jobDetail.id ? otherActive : null;
                      return (
                        <button
                          type="button"
                          key={m.card_id}
                          onClick={() => setCandDetail(m)}
                          className={cn(
                            'w-full text-left rounded-xl border px-3 py-2 transition hover:brightness-[0.98]',
                            meta.cls,
                            proposed ? 'opacity-70' : '',
                          )}
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
                                <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                  ติดใบขอ {activeElsewhere.request_no || activeElsewhere.job_id.slice(0, 8)}
                                </span>
                              ) : null}
                              <TierCriteriaTooltip tier={m.tier}>
                                <span
                                  tabIndex={0}
                                  className="cursor-help rounded-full border border-white/80 bg-white/80 px-2 py-0.5 text-[10px] text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                              <a
                                href={`tel:${m.mobile}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                              >
                                <Phone className="h-3 w-3" /> {m.mobile}
                              </a>
                            ) : null}
                          </div>
                          <div className="mt-1">
                            <CandidateChecklist
                              job={jobDetail}
                              tier={m.tier}
                              sex={m.sex_code}
                              age={m.age}
                              areaParts={[m.amphur_name, m.province_name]}
                              salary={m.required_salary}
                            />
                          </div>
                          {m.reason ? <p className="mt-1 text-[11px] italic text-slate-600 line-clamp-2">— {m.reason}</p> : null}
                          <div className="mt-1 text-[10px] font-medium text-sky-600">แตะเพื่อดูรายละเอียด →</div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : null}

              {/* #2 (ยุบ) — ไม่พอ? หาผู้สมัครจากฐาน iRecruit แล้วเสนอในหน้านี้เลย */}
              {boardMatchById[jobDetail.id] && !boardErrorById[jobDetail.id] ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-blue-900">
                      {irMatchById[jobDetail.id]
                        ? `ผู้สมัครจากฐาน iRecruit → แนะนำ ${recommendedCandidateCount(irMatchById[jobDetail.id].matches)}`
                        : 'ไม่พอ? หาผู้สมัครจากฐาน iRecruit'}
                    </p>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openBranchEditor(jobDetail)}
                        className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-white px-3 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                      >
                        <MapPin className="h-3 w-3" /> แก้ไขสาขา/ที่อยู่
                      </button>
                      <button
                        type="button"
                        disabled={irLoadingId === jobDetail.id}
                        onClick={() => void fetchIrecruit(jobDetail.id, !!irMatchById[jobDetail.id])}
                        className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
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
                            .filter((m) => !(hideProposed && proposedByKey[proposalKey('irecruit', m.id)])),
                          showDistantCandidates,
                        ).map((row) => {
                            if (row.kind === 'branch') {
                              return (
                                <div
                                  key={row.key}
                                  className="mt-3 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 first:mt-0"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-blue-950">{row.branch.branch_name_clean}</p>
                                      <p className="mt-0.5 text-[11px] text-blue-700">
                                        {[row.branch.district_hint, row.branch.province_hint].filter(Boolean).join(' · ') ||
                                          row.branch.branch_name_raw}
                                      </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <p className="text-xs font-semibold text-blue-800">
                                        ต้องการ {row.branch.requested_qty} คน
                                      </p>
                                      <p className="text-[10px] text-blue-600">พบใกล้สาขา {row.candidateCount} คน</p>
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
                            return (
                              <div
                                key={row.key}
                                className={cn(
                                  'rounded-xl border border-white/70 bg-white/70 px-3 py-2 space-y-1',
                                  proposed ? 'opacity-70' : '',
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-blue-700">
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
                                      <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                        ติดใบขอ {activeElsewhere.request_no || activeElsewhere.job_id.slice(0, 8)}
                                      </span>
                                    ) : null}
                                    <TierCriteriaTooltip tier={m.tier}>
                                      <span
                                        tabIndex={0}
                                        className="cursor-help rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                      className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
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
                                />
                                {m.reason ? (
                                  <p className="text-[11px] italic text-slate-600 line-clamp-2">— {m.reason}</p>
                                ) : null}
                                {proposed ? (
                                  <div className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[10px] text-slate-700">
                                     <p className="font-semibold">
                                       ผู้ดำเนินการ: {proposed.proposedByName || 'ไม่ระบุ'}
                                     </p>
                                     {proposed.branchName ? <p className="mt-0.5 text-blue-700">สาขา: {proposed.branchName}</p> : null}
                                     <p className="mt-0.5 text-slate-600">เหตุผล: {proposed.reason || 'ไม่ระบุ'}</p>
                                  </div>
                                ) : null}
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => openIrecruitCandidatePrefill(jobDetail, m, branchName)}
                                    className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100"
                                  >
                                    <UserPlus className="h-3 w-3" /> เพิ่มรายละเอียดผู้สมัคร
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy || !!activeElsewhere}
                                    onClick={() => openIrecruitProposalAction(jobDetail, m, 'contacted', branchId, branchName)}
                                    className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                  >
                                    {busy ? 'บันทึก…' : proposed?.status === 'contacted' ? 'ติดต่อแล้ว ✓' : 'ติดต่อแล้ว'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy || !!activeElsewhere}
                                    onClick={() => openIrecruitProposalAction(jobDetail, m, 'reserved', branchId, branchName)}
                                    className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                                  >
                                    <UserPlus className="h-3 w-3" />
                                    {busy ? 'บันทึก…' : proposed?.status === 'reserved' ? 'จองตัวแล้ว ✓' : 'จองตัว'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy || !!activeElsewhere}
                                    onClick={() => openIrecruitProposalAction(jobDetail, m, 'placed', branchId, branchName)}
                                    className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    {busy ? 'บันทึก…' : proposed?.status === 'placed' ? 'ลงงานแล้ว ✓' : 'ลงงานแล้ว'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => openIrecruitProposalAction(jobDetail, m, 'rejected', branchId, branchName)}
                                    className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    {proposed?.status === 'rejected' ? 'ไม่ผ่าน ✓' : 'ไม่ผ่าน'}
                                  </button>
                                  {proposed && isActiveWorkflowStatus(proposed.status) ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => openCancelProposalAction(jobDetail, key, m.full_name)}
                                      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      <X className="h-3 w-3" /> ยกเลิก
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      กดค้นหาเพื่อดึงผู้สมัครที่ตรงจากฐาน iRecruit แล้วกดจองตัว/ลงงานได้เลยในหน้านี้
                    </p>
                  )}
                  {proposeError ? <p className="text-[11px] text-destructive">{proposeError}</p> : null}
                </div>
              ) : null}

              {/* #1 หาคนไม่ได้ / คนที่มีไม่โอเค → สร้างคำขอโพสหางานใหม่ (ID ให้ทีมคอนเทนต์รับไปทำต่อ) */}
              {boardMatchById[jobDetail.id] ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50/40 px-3 py-3 space-y-2">
                  <p className="text-xs font-semibold text-rose-900">หาคนไม่ได้เลย หรือคนที่มีไม่โอเค?</p>
                  {jobPostingByJobId[jobDetail.id] ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        title={jobPostingByJobId[jobDetail.id].id}
                        className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-mono text-rose-700"
                      >
                        ID: {jobPostingByJobId[jobDetail.id].id.slice(0, 8)}
                      </span>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800">
                        {jobPostingStatusLabel(jobPostingByJobId[jobDetail.id].status)}
                      </span>
                      <a href="/matching/job-postings" className="text-[11px] text-blue-700 hover:underline">
                        ดูคำขอทั้งหมด →
                      </a>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={creatingPosting}
                      onClick={() => void createPosting(jobDetail)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      <Megaphone className="h-3.5 w-3.5" />
                      {creatingPosting ? 'กำลังสร้าง…' : 'ขอโพสหางานใหม่ (สร้าง ID)'}
                    </button>
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
            <DialogTitle>แยกและแก้ไขสาขาของใบขอ</DialogTitle>
            <DialogDescription>
              ตรวจชื่อสถานที่ ที่อยู่ จำนวนคน และพิกัดทีละสาขา ก่อนใช้จัดผู้สมัครตามพื้นที่
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {branchDrafts.map((branch, index) => {
              const branchId = branch.branch_id || `branch-${index + 1}`;
              const hasCoordinate = Number.isFinite(branch.lat) && Number.isFinite(branch.lng);
              return (
                <div key={branchId} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-blue-950">สาขา {index + 1}</p>
                    {branchDrafts.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setBranchDrafts((current) => current.filter((item) => item.branch_id !== branchId))}
                        className="text-[11px] font-medium text-red-600 hover:underline"
                      >
                        ลบสาขา
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                    <label className="md:col-span-4 text-[11px] font-medium text-slate-600">
                      ชื่อสาขา/สถานที่
                      <input
                        value={branch.branch_name_clean}
                        onChange={(event) => updateBranchDraft(branchId, { branch_name_clean: event.target.value })}
                        className="jarvis-soft-field mt-1 w-full"
                        placeholder="เช่น สิงห์คอมเพล็กซ์"
                      />
                    </label>
                    <label className="md:col-span-2 text-[11px] font-medium text-slate-600">
                      จำนวนคน
                      <input
                        type="number"
                        min={0}
                        value={branch.requested_qty}
                        onChange={(event) => updateBranchDraft(branchId, { requested_qty: Number(event.target.value) })}
                        className="jarvis-soft-field mt-1 w-full"
                      />
                    </label>
                    <label className="md:col-span-6 text-[11px] font-medium text-slate-600">
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
                    <label className="md:col-span-2 text-[11px] font-medium text-slate-600">
                      ถนน
                      <input
                        value={branch.road || ''}
                        onChange={(event) => updateBranchDraft(branchId, { road: event.target.value, geocode_status: 'unverified' })}
                        className="jarvis-soft-field mt-1 w-full"
                        placeholder="สามเสน"
                      />
                    </label>
                    <label className="md:col-span-2 text-[11px] font-medium text-slate-600">
                      แขวง/ตำบล
                      <input
                        value={branch.subdistrict || ''}
                        onChange={(event) =>
                          updateBranchDraft(branchId, { subdistrict: event.target.value, geocode_status: 'unverified' })
                        }
                        className="jarvis-soft-field mt-1 w-full"
                      />
                    </label>
                    <label className="md:col-span-2 text-[11px] font-medium text-slate-600">
                      เขต/อำเภอ
                      <input
                        value={branch.district_hint || ''}
                        onChange={(event) =>
                          updateBranchDraft(branchId, { district_hint: event.target.value, geocode_status: 'unverified' })
                        }
                        className="jarvis-soft-field mt-1 w-full"
                      />
                    </label>
                    <label className="md:col-span-3 text-[11px] font-medium text-slate-600">
                      จังหวัด
                      <input
                        value={branch.province_hint || ''}
                        onChange={(event) =>
                          updateBranchDraft(branchId, { province_hint: event.target.value, geocode_status: 'unverified' })
                        }
                        className="jarvis-soft-field mt-1 w-full"
                      />
                    </label>
                    <label className="md:col-span-3 text-[11px] font-medium text-slate-600">
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
                      className="rounded-full border border-blue-300 bg-white px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                    >
                      {branchGeocodeBusyId === branchId ? 'กำลังค้นหา…' : 'ค้นหาพิกัดจากที่อยู่'}
                    </button>
                    {hasCoordinate ? (
                      <>
                        <span className="text-slate-600">
                          {Number(branch.lat).toFixed(6)}, {Number(branch.lng).toFixed(6)}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${branch.lat},${branch.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-700 hover:underline"
                        >
                          ดูแผนที่
                        </a>
                        {branch.geocode_status !== 'confirmed' ? (
                          <button
                            type="button"
                            onClick={() => updateBranchDraft(branchId, { geocode_status: 'confirmed' })}
                            className="rounded-full bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
                          >
                            ยืนยันพิกัดนี้
                          </button>
                        ) : (
                          <span className="font-semibold text-emerald-700">ยืนยันพิกัดแล้ว</span>
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
              className="rounded-full border border-dashed border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
            >
              + เพิ่มสาขา
            </button>

            {jobDetail &&
            branchDrafts.reduce((sum, branch) => sum + (Number(branch.requested_qty) || 0), 0) !==
              requestPositionCount(jobDetail) ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
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
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={branchSaveBusy}
                onClick={() => void saveBranchDrafts()}
                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {branchSaveBusy ? 'กำลังบันทึก…' : 'บันทึกสาขา'}
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
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                {boardTierMeta(candDetail.tier).label}
              </span>

              <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2">
                <p className="text-xs font-semibold text-sky-900">ทำไม AI เลือกคนนี้</p>
                <p className="mt-1 text-xs text-sky-800 leading-relaxed">
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
                />
              ) : null}

              <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-3 space-y-1.5 text-sm">
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
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
                    <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-violet-900">เสนอคนนี้ให้ใบขอ</p>
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
                        <p className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 text-[11px] text-orange-800">
                          ผู้สมัครติดใบขอ {activeElsewhere.request_no || activeElsewhere.job_id} · {proposalStatusLabel(activeElsewhere.status)}
                        </p>
                      ) : null}
                      {current ? (
                        <div className="rounded-lg border border-violet-200 bg-white/80 px-2.5 py-2 text-[11px] text-slate-700">
                          <p className="font-semibold">ผู้ดำเนินการ: {current.proposedByName || 'ไม่ระบุ'}</p>
                          <p className="mt-0.5 text-slate-600">เหตุผล: {current.reason || 'ไม่ระบุ'}</p>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy || !!activeElsewhere}
                          onClick={() => openBoardProposalAction(jobDetail, candDetail, 'contacted')}
                          className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          {busy ? 'กำลังบันทึก…' : current?.status === 'contacted' ? 'ติดต่อแล้ว ✓' : 'ติดต่อแล้ว'}
                        </button>
                        <button
                          type="button"
                          disabled={busy || !!activeElsewhere}
                          onClick={() => openBoardProposalAction(jobDetail, candDetail, 'reserved')}
                          className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                        >
                          {busy ? 'กำลังบันทึก…' : current?.status === 'reserved' ? 'จองตัวแล้ว ✓' : 'จองตัว'}
                        </button>
                        <button
                          type="button"
                          disabled={busy || !!activeElsewhere}
                          onClick={() => openBoardProposalAction(jobDetail, candDetail, 'placed')}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busy ? 'กำลังบันทึก…' : current?.status === 'placed' ? 'ลงงานแล้ว ✓' : 'ลงงานแล้ว'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openBoardProposalAction(jobDetail, candDetail, 'rejected')}
                          className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {current?.status === 'rejected' ? 'ไม่ผ่าน ✓' : 'ไม่ผ่าน'}
                        </button>
                        {current && isActiveWorkflowStatus(current.status) ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openCancelProposalAction(jobDetail, key, candDetail.full_name)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
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
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400"
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
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400"
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
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              กลับ
            </button>
            <button
              type="button"
              disabled={proposalFormBusy || !proposalOperatorName.trim() || !proposalDecisionReason.trim()}
              onClick={() => void submitProposalAction()}
              className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {resolvingConflict ? 'กำลังยกเลิก…' : 'ยกเลิกใบเดิม แล้วจองใบนี้แทน'}
                </button>
                <button
                  type="button"
                  onClick={() => setConflictInfo(null)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchingPage;
