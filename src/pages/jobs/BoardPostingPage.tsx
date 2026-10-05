/**
 * ═══ ไล่งานของใบขอหนึ่งใบ — **ขั้น 1 → 2 → 3 → 4** ═══
 *
 * 🔴 **หน้านี้เป็นของกล่องงาน ไม่ใช่ของใบงาน** (เจ้าของสั่ง 27 ส.ค. 2569)
 * > *"หน้าใบงานกดเข้าไปต้องเจอแค่ รายละเอียดงาน ผู้สมัคร AI match การติดต่อ ·
 * >  ประกาศ/ลิงก์สมัคร ต้องอยู่กล่องงานสิ ทำไมไม่เข้าใจ"*
 *
 * 🔴🔴 **เป็น "ขั้นตอน" ไม่ใช่ "กองบล็อก"** — เจ้าของพูดไว้สามรอบ (*"พอจะปล่อยก็ไปกดดู แล้วก็ตามขั้นตอน
 * 1 2 3 4 แล้วก็ปล่อยไป"*) · แถบขั้นอยู่บนสุด โชว์เนื้อทีละขั้น ท้ายขั้นมีปุ่ม "ถัดไป" · ขั้น 4 คือส่งประกาศ
 * ขั้นที่ใบนี้ค้าง (ป้าย "ค้างที่นี่") มาจาก `releaseStepOf()` ที่เดียว — ตัวเดียวกับเลขบนหัวกล่องงาน
 *
 * ═══ โฉมใหม่ 30 ก.ย. 2569 (เจ้าของไล่ทีละหน้า) ═══
 *   ① ตรวจใบขอ — การ์ดแยก: ข้อมูลใบขอ · คนที่ออก · เพศที่รับ · **"ไม่ปล่อยใบนี้" ย้ายลงล่างสุด**
 *      ถอด "ใครแก้อะไรไป" (*"ซ่อนไว้แค่เก็บ Log หลังบ้าน"* — ระบบยังบันทึกประวัติเหมือนเดิม) ·
 *      ถอด "ติดอะไรไหม" ทั้งกล่อง (Choice "ถอดทั้งกล่อง" — หมายเหตุยังเขียนได้ที่หน้าใบขอ)
 *   ② สถานที่ปฏิบัติงาน · ③ รายได้ + สวัสดิการ — ฟอร์มฝัง (`EditPublicJobFieldsDialog`) ไม่มีปุ่มบันทึกแล้วปิด
 *   ④ สรุป + ส่งประกาศ — Choice "ส่งได้เลย ลิงก์ไม่บังคับ (แนะนำ)": สรุปของที่จะขึ้นประกาศ ·
 *      ติ๊ก "สร้างลิงก์" ถึงกางฟอร์มสร้างลิงก์ · ปุ่ม "บันทึกแบบร่าง" (ปิดป๊อป ยังไม่ขึ้นหน้าสาธารณะ) / "ส่งประกาศ"
 *   ทั้งป๊อป: ตัดคำอธิบายที่ไม่จำเป็น · ระยะตัวอักษร/บรรทัดเท่ากัน (`EVEN_TYPE`) · Kanit ตัวเดียว
 *
 * 🔴 **ฟอร์มทุกตัวฝังในหน้า ไม่ห่อ Dialog** (เจ้าของสั่ง: *"ไม่เอาแบบ Popup เด้งนะ"*)
 */
import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, ClipboardCheck, Link2, Send, UserMinus, Users } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';
import GenderPicker from '@/components/jobs/GenderPicker';
import AgeRangeFields from '@/components/jobs/AgeRangeFields';
import PostingLinksList from '@/components/jobs/PostingLinksList';
import AddChannelLinks from '@/components/jobs/AddChannelLinks';
import JobApplicantsDialog from '@/components/jobs/JobApplicantsDialog';
import ReleaseSkipControl from '@/components/jobs/ReleaseSkipControl';
import UnitRequestInfoFields, { UnitRequestBriefFields } from '@/components/jobs/UnitRequestInfoFields';
import { RequestRateLinesBlock, ResignedEmployeeBlock } from '@/components/jobs/UnitRequestPayBlocks';
import { StepCard } from '@/components/jobs/postingStepParts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchSiamrajUnitRequest } from '@/lib/siamrajUnitRequestsApi';
import { erpGenderLabel, genderNeedsChoice, onlineGenderChoice } from '@/lib/genderRequirement';
import { fetchRecruitPostings } from '@/lib/recruitPostingsApi';
import type { RecruitPosting } from '@/lib/recruitPostings';
import {
  buildReleaseIndex,
  fetchJobReleases,
  releaseJobsToPublic,
  unreleaseJobsFromPublic,
  type JobRelease,
} from '@/lib/jobPublicReleaseApi';
import { buildJobKeyIndex } from '@/lib/jobKeyIndex';
import { fetchReleaseSkips } from '@/lib/jobReleaseSkipApi';
import { buildSkipIndex, releaseSkipText, type JobReleaseSkip } from '@/lib/jobReleaseSkips';
import { resolveUnitDetailBackPath } from '@/lib/jobUnitSessionState';
import { backLabelFor } from '@/lib/stageOrigin';
import {
  RELEASE_STEP_ORDER,
  RELEASE_STEP_TEXT,
  releaseStepOf,
  type ReleaseStepKey,
} from '@/lib/boardRelease';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { postingPositionText } from '@/lib/publicJobTitle';
import { publicSafeAddress } from '@/lib/publicJobPrivacy';
import { INCOME_PERIOD_LABEL, buildIncomeDisplay } from '@/lib/incomeBreakdown';
import { benefitDisplayLabels } from '@/lib/extraBenefits';
import { boardCardAge } from '@/lib/boardCardFacts';
import { payCycleText, payCyclesOf } from '@/lib/payCycle';
import PublicJobCardPreview from '@/components/jobs/PublicJobCardPreview';
import { EVEN_TYPE, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { SEARCH_ALL_POOLS_AND_CALL } from '@/lib/candidateSearchLabels';
import type { JobRequest } from '@/types';
import { friendlyErrorText } from '@/lib/friendlyError';

const EditPublicJobFieldsDialog = React.lazy(
  () => import('@/components/jobs/EditPublicJobFieldsDialog'),
);

const NUM = new Intl.NumberFormat('th-TH');

/** ใบนี้มีข้อมูลคนเก่าให้ดูไหม — ใบเปิดไซต์ใหม่ไม่มีคนเก่า (ไม่ต้องวาดกล่องที่มีแต่ "—") */
function hasResignedInfo(job: JobRequest): boolean {
  return Boolean(
    job.resigned_employee_name?.trim() ||
      job.resigned_reason?.trim() ||
      job.resigned_wage_fee_rate != null ||
      job.resigned_wage_draw_rate != null ||
      (job.resigned_income_3m && job.resigned_income_3m.length > 0),
  );
}

/** รายได้ที่ผู้สมัครจะเห็น (จากที่ทีม Online ตั้ง) — `null` = ยังไม่ได้ตั้ง */
function incomeSummaryText(job: JobRequest): string | null {
  const fo = job.field_overrides;
  const shown = buildIncomeDisplay(fo?.income ?? null);
  if (shown) return `${NUM.format(shown.total)} บาท ${INCOME_PERIOD_LABEL[shown.period]}`;
  // ยอดรวมแบบเดิม (ไม่มีหน่วย) — หน้าสาธารณะนับเป็นต่อเดือน
  if (typeof fo?.total_income === 'number') return `${NUM.format(fo.total_income)} บาท ต่อเดือน`;
  return null;
}

function Loading({ text = 'กำลังโหลดใบขอ…' }: { text?: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

// ช่องเลือกเพศ (`GenderPicker`) ย้ายไปไฟล์ของตัวเอง 2 ต.ค. 2569 — ใช้ร่วมกับป๊อปประกาศหน้าเดียว (`BoardPublishSheet`)

/** หนึ่งแถวในสรุปขั้น 4 — ปุ่ม "แก้" พากลับไปขั้นของช่องนั้น */
function SummaryRow({
  label,
  children,
  warn = false,
  onEdit,
}: {
  label: string;
  children: React.ReactNode;
  warn?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <dt className="w-24 shrink-0 pt-1 text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 flex-1 break-words pt-0.5 text-sm', warn ? TONE.warn.value : 'text-foreground')}>
        {children}
      </dd>
      {onEdit ? (
        <Button type="button" variant="ghost" size="xs" onClick={onEdit} aria-label={`แก้${label}`}>
          แก้
        </Button>
      ) : null}
    </div>
  );
}

export type BoardPostingStepsProps = {
  /** เลขที่ใบ / id ของใบขอ */
  id: string;
  /** ปลายทางของปุ่มย้อนกลับ/ยกเลิก — popup ส่ง `onDone` มาแทน */
  backPath?: string;
  /** popup: ปิดกล่องแล้วอยู่หน้าเดิม (เจ้าของสั่ง 28 ส.ค. 2569) */
  onDone?: () => void;
  /** โหมด popup ไม่ต้องมีหัวหน้าจอของตัวเอง */
  chrome?: boolean;
  /**
   * ปุ่ม "หาคนทุกกอง + ให้ AI โทร" — อยู่บนแท็บ **รายชื่อ** (เจ้าของ Choice 1 ต.ค. 2569 "4 ขั้นเดิม แต่ตัดของรก":
   * ย้ายจากหัวป๊อปที่วางทับแถบขั้นประกาศ) · ไม่ส่ง = ไม่มีปุ่ม (ใบปิด/ยกเลิก · หน้า deep-link)
   */
  onSearchAllPools?: () => void;
};

/**
 * เนื้อ 4 ขั้น — ใช้ทั้งใน **popup บนกล่องงาน** และหน้า deep-link
 * (`/jobs/board/:id/posting` เก็บไว้ให้ลิงก์ที่บันทึกไว้ยังเปิดได้)
 */
export const BoardPostingSteps: React.FC<BoardPostingStepsProps> = ({
  id,
  backPath: backPathProp,
  onDone,
  chrome = true,
  onSearchAllPools,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  /** ปุ่มย้อนกลับของโหมดหน้า = กลับหน้าที่พามา · โหมด popup ใช้ `onDone` */
  const backPath =
    backPathProp ??
    resolveUnitDetailBackPath({
      stateReturnTo: (location.state as { returnTo?: string } | null)?.returnTo,
      search: location.search,
    });
  /**
   * จบงานในป๊อป (บันทึกแบบร่าง / ส่งประกาศ / ปิด) = กลับกล่องงาน
   * 🔴 ห้ามพาไปหน้าใบขอ — เจ้าของสั่ง 27 ก.ย. 2569 ของในกล่องงานห้ามเด้งออกไปหน้าอื่น
   */
  const leaveToBoard = React.useCallback(() => {
    if (onDone) {
      onDone();
      return;
    }
    navigate('/jobs/board');
  }, [onDone, navigate]);

  const [job, setJob] = React.useState<JobRequest | null>(null);
  /** ช่องที่เปิดอยู่ — **เริ่มที่ "ตรวจสอบ" เสมอ** ตามที่เจ้าของสั่ง */
  const [view, setView] = React.useState<'review' | 'people'>('review');
  const [error, setError] = React.useState<string | null>(null);
  /** ค่าที่เพิ่งแก้ — ทับบนฟอร์มทันทีโดยไม่ต้องโหลดใบใหม่ */
  const [publicPatch, setPublicPatch] = React.useState<Partial<JobRequest>>({});

  const [postings, setPostings] = React.useState<RecruitPosting[] | null>(null);
  const [releases, setReleases] = React.useState<JobRelease[] | null>(null);
  const [releaseBusy, setReleaseBusy] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  /** ทะเบียน "ไม่ปล่อย + เหตุผล" (29 ก.ย. 2569) — `null` = ยังอ่านไม่ได้ ⇒ ไม่โชว์ปุ่ม (ห้ามเดาว่ายังไม่ได้ตั้ง) */
  const [skips, setSkips] = React.useState<JobReleaseSkip[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    setError(null);
    fetchSiamrajUnitRequest(id)
      .then((j) => {
        if (alive) setJob(j);
      })
      .catch((e: unknown) => {
        if (alive) setError(friendlyErrorText(e, 'โหลดใบขอไม่สำเร็จ'));
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const loadPostings = React.useCallback(async () => {
    try {
      setPostings(await fetchRecruitPostings());
    } catch {
      setPostings([]); // อ่านไม่ได้ = ถือว่ายังไม่มีประกาศ (ฟอร์มสร้างลิงก์ยังใช้ได้)
    }
  }, []);

  const loadReleases = React.useCallback(async () => {
    try {
      setReleases(await fetchJobReleases());
    } catch {
      setReleases([]); // fail-closed เหมือนฝั่ง server — อ่านไม่ได้ = ถือว่ายังไม่ปล่อย
    }
  }, []);

  const loadSkips = React.useCallback(async () => {
    try {
      setSkips(await fetchReleaseSkips());
    } catch {
      setSkips(null);
    }
  }, []);

  React.useEffect(() => {
    void loadPostings();
    void loadReleases();
    void loadSkips();
  }, [loadPostings, loadReleases, loadSkips]);

  /**
   * ประกาศทั้งหมดของใบนี้ (ใหม่ → เก่า) — 🔴 ต้องหาผ่าน `buildJobKeyIndex` ไม่ใช่ `===`
   * (id ใบขอมี 3 รูป · URL พาเลขที่ใบเปล่ามาก็ได้ — ดู `jobKeyIndex.ts`)
   */
  const jobPostings = React.useMemo<RecruitPosting[] | null>(() => {
    if (!postings) return null;
    // API เรียง created_at DESC มาแล้ว → ต่อท้ายตามลำดับ ตัวแรกคือล่าสุด
    const idx = buildJobKeyIndex<RecruitPosting[]>(
      postings.map((p) => [p.jobId, [p]] as const),
      (existing, incoming) => [...existing, ...incoming],
    );
    return (job ? idx.get(job.id) : undefined) ?? idx.get(id) ?? [];
  }, [postings, job, id]);
  const latestPosting = jobPostings?.[0] ?? null;
  /** ประกาศที่ยังเปิดล่าสุด — สร้างลิงก์เพิ่มใต้ประกาศนี้ (ไม่สร้างประกาศใหม่ซ้ำ) */
  const openPosting = jobPostings?.find((p) => p.status === 'open') ?? null;
  /** ลิงก์สมัครที่ยังใช้ได้ (ประกาศที่ยังเปิด) */
  const linkCount = jobPostings
    ? jobPostings.filter((p) => p.status === 'open').reduce((sum, p) => sum + p.links.length, 0)
    : null;

  const released = React.useMemo(() => {
    if (!releases || !job) return null;
    return buildReleaseIndex(releases).has(job.id);
  }, [releases, job]);

  /** แถว "ไม่ปล่อย" ของใบนี้ — `undefined` = ยังอ่านไม่ได้ · `null` = ยังไม่ได้ตั้ง */
  const skip = React.useMemo<JobReleaseSkip | null | undefined>(
    () => (skips && job ? (buildSkipIndex(skips).get(job.id) ?? null) : undefined),
    [skips, job],
  );

  const toggleRelease = async (next: boolean) => {
    if (!job) return;
    setReleaseBusy(true);
    setSendError(null);
    try {
      if (next) await releaseJobsToPublic([job.id]);
      else await unreleaseJobsFromPublic([job.id]);
      await loadReleases();
    } catch (e) {
      /* สภาพจริงมาจากทะเบียน — ค่าเดิมยังโชว์อยู่ · 🔴 แต่ต้องบอกว่าไม่สำเร็จ (5 ต.ค. 2569 ไล่กดทุกปุ่มเจอ:
         เดิมกลืนเงียบ กด "ดึงประกาศลง" แล้วล้ม = จอนิ่ง คนเข้าใจว่าดึงลงแล้ว) */
      const fallback = next ? 'ประกาศไม่สำเร็จ ลองอีกครั้ง' : 'ดึงประกาศลงไม่สำเร็จ ลองอีกครั้ง';
      setSendError(e instanceof Error && e.message ? `${fallback} (${e.message})` : fallback);
    } finally {
      setReleaseBusy(false);
    }
  };

  /** ขั้น 4 "ส่งประกาศ" — ส่งสำเร็จแล้วปิดป๊อปกลับกล่องงาน · ไม่สำเร็จบอกในป๊อป (ห้ามเงียบ) */
  const sendPost = async () => {
    if (!job) return;
    setReleaseBusy(true);
    setSendError(null);
    try {
      await releaseJobsToPublic([job.id]);
      await loadReleases();
      leaveToBoard();
    } catch (e) {
      setSendError(e instanceof Error && e.message ? e.message : 'ส่งประกาศไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setReleaseBusy(false);
    }
  };

  /**
   * 🔴 ต้อง memo (5 ต.ค. 2569 เจอตอนไล่กดทุกปุ่ม): เดิมสร้างก้อนใหม่ทุก render — หน้าบอร์ดข้างหลัง render ถี่
   * ⇒ auto-save ของฟอร์มหน้า 2/3 (ผูกกับ `job`) รีเซ็ตนาฬิกา 1.5 วิไม่หยุด กว่าจะยิงจริง ~20 วิ
   */
  const jobWithPatch = React.useMemo(
    () => (job ? ({ ...job, ...publicPatch } as JobRequest) : null),
    [job, publicPatch],
  );
  /** 🔴 ใบขอไม่ระบุเพศและยังไม่มีใครเลือก = ส่งประกาศไม่ได้ (เจ้าของเคาะ 26 ก.ย. 2569) */
  const genderBlocked = jobWithPatch ? genderNeedsChoice(jobWithPatch) : false;

  /**
   * 🔴 ใบนี้ค้างอยู่ขั้นไหน — **ตัวเดียวกับที่นับเลขบนหัวกล่องงาน** (`releaseStepOf`)
   * ⚠️ `null` = ยังอ่านข้อมูลไม่ครบ ห้ามเดาขั้น (เดาผิด = พาคนไปทำขั้นที่ไม่ใช่)
   */
  const currentStep = React.useMemo<ReleaseStepKey | null>(() => {
    if (!job || postings === null || releases === null) return null;
    if (released) return null; // ปล่อยแล้ว = เดินครบแล้ว ไม่มีขั้นค้าง
    return releaseStepOf(job, {
      hasLink: () => Boolean(latestPosting),
      isReleased: () => Boolean(released),
      applicants: () => 0,
    });
  }, [job, postings, releases, released, latestPosting]);

  /**
   * ขั้นที่กำลังเปิดดู — 🔴 **เริ่มที่ขั้น 1 เสมอ** (เจ้าของสั่ง 28 ส.ค. 2569:
   * *"พอกดเข้าไปทำไมไปโผล่ กดปล่อย เลยอะ ไม่ไล่ไปจาก 1.ตรวจใบขอ ไล่ไปอะ"*)
   * `currentStep` ใช้แค่ติดป้าย "ค้างที่นี่" ไม่ได้ใช้เลือกขั้นเริ่ม
   */
  const [openStep, setOpenStep] = React.useState<ReleaseStepKey>('info');
  /** "คนเก่า + รายได้ย้อนหลัง" — หุบเป็นค่าตั้งต้น (เจ้าของ Choice 1 ต.ค. 2569 "4 ขั้นเดิม แต่ตัดของรก") */
  /** "ดูเพิ่ม" ใต้หน้า 1 — ส่วนเกินของใบขอ (ใบเต็ม + รายละเอียดคนเก่า) พับไว้เป็นค่าตั้งต้น */
  const [moreOpen, setMoreOpen] = React.useState(false);
  /** ขั้น 4: ติ๊ก "สร้างลิงก์" ถึงกางฟอร์ม (ลิงก์ไม่บังคับ — Choice 30 ก.ย. 2569) */
  const [wantLink, setWantLink] = React.useState(false);
  /** "มีแล้ว N ลิงก์" กดแล้วกางรายการลิงก์ทีละอัน (เจ้าของ 4 ต.ค. 2569 — Choice "ครบ") */
  const [linksOpen, setLinksOpen] = React.useState(false);
  const step: ReleaseStepKey = openStep;

  /**
   * ขั้นนี้ผ่านแล้วหรือยัง — ใช้ระบายสีบนแถบ
   * 🔴 อ่านจากร่องรอยจริงเท่านั้น **ห้ามอ้างว่าผ่านโดยไม่มีหลักฐาน** — บทเรียน "แถบติ๊กถูกที่โกหก" (25 ส.ค. 2569)
   */
  const doneStep = React.useCallback(
    (k: ReleaseStepKey): boolean => {
      if (!job || postings === null || releases === null) return false;
      if (released) return true; // เดินครบเส้นแล้ว ทุกขั้นถือว่าผ่าน
      const order = RELEASE_STEP_ORDER.indexOf(k);
      const at = currentStep ? RELEASE_STEP_ORDER.indexOf(currentStep) : -1;
      return at >= 0 && order < at;
    },
    [job, postings, releases, released, currentStep],
  );

  const stepIdx = RELEASE_STEP_ORDER.indexOf(step);
  const nextStep = stepIdx >= 0 ? RELEASE_STEP_ORDER[stepIdx + 1] : undefined;
  const onFieldsSaved = (patch: Partial<JobRequest>) => setPublicPatch((prev) => ({ ...prev, ...patch }));

  // ── สรุปขั้น 4 ──
  const genderChosen = jobWithPatch ? onlineGenderChoice(jobWithPatch) : null;
  const genderErp = jobWithPatch ? erpGenderLabel(jobWithPatch) : null;
  const genderText = genderChosen ?? (genderErp === 'ชาย' || genderErp === 'หญิง' ? genderErp : null);
  const incomeText = jobWithPatch ? incomeSummaryText(jobWithPatch) : null;
  const benefitLines = jobWithPatch ? benefitDisplayLabels(jobWithPatch.extra_benefits) : [];

  return (
    <div className={cn('relative', EVEN_TYPE)}>
      {chrome ? (
        <PageHeader
          title="ไล่งานของใบนี้"
          subtitle={job ? jobBoardCardTitle(job) : id}
          backPath={backPath}
          backLabel={backLabelFor(backPath)}
        />
      ) : null}

      <div className={cn('space-y-4', chrome ? 'px-4 py-4 md:px-6' : 'py-1')}>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {/**
         * ═══ สองช่องบนสุด: **ตรวจสอบ** กับ **รายชื่อ** (เจ้าของสั่ง 21 ก.ย. 2569) ═══
         * 🔴 **ห้ามเอารายชื่อไปต่อท้ายขั้นตอน** (เคยทำแบบนั้นแล้วเจ้าของตีกลับ) — สองช่องแยกกันที่กดสลับ
         */}
        <Tabs value={view} onValueChange={(v) => setView(v as 'review' | 'people')}>
          <TabsList className="w-full">
            <TabsTrigger value="review" className="flex-1">
              <ClipboardCheck aria-hidden /> ตรวจสอบ
            </TabsTrigger>
            <TabsTrigger value="people" className="flex-1">
              <Users aria-hidden /> รายชื่อ
            </TabsTrigger>
          </TabsList>

          <TabsContent value="people" className="mt-4 space-y-3">
            {onSearchAllPools ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                title={SEARCH_ALL_POOLS_AND_CALL.hint}
                onClick={onSearchAllPools}
                className={TONE.success.outline}
              >
                <Send aria-hidden />
                {SEARCH_ALL_POOLS_AND_CALL.label}
              </Button>
            ) : null}
            {job ? <JobApplicantsDialog embedded open job={job} onClose={() => undefined} /> : <Loading />}
          </TabsContent>

          <TabsContent value="review" className="mt-4 space-y-4">
            {/* ── แถบขั้น 1-4 — บอกสามอย่าง: ขั้นไหนผ่านแล้ว · ใบนี้ค้างขั้นไหน · กำลังเปิดดูขั้นไหน ── */}
            {/* 🔴 4 ขั้นอยู่แถวเดียวเสมอ (เจ้าของสั่ง 5 ต.ค. 2569 "ให้อยู่แถวเดียวกัน") — กริด 4 ช่อง ชื่อยาวตัดบรรทัดในช่องตัวเอง
                ป้าย "ค้างที่นี่" อยู่ใต้ชื่อในช่องเดียวกัน (เดิมต่อท้ายจนขั้น 4 ตกบรรทัด) */}
            <nav className="grid grid-cols-4 gap-1.5" aria-label="ขั้นตอนของงานประกาศ">
              {RELEASE_STEP_ORDER.map((k) => {
                const t = RELEASE_STEP_TEXT[k];
                const on = step === k;
                const passed = doneStep(k);
                const here = currentStep === k;
                return (
                  <Button
                    key={k}
                    type="button"
                    size="xs"
                    variant={on ? 'default' : 'outline'}
                    aria-current={on ? 'step' : undefined}
                    title={t.todo}
                    onClick={() => setOpenStep(k)}
                    className={cn(
                      'h-auto min-h-9 items-start justify-start whitespace-normal py-1.5 text-left leading-snug',
                      !on && passed && TONE.success.value,
                    )}
                  >
                    {/* 🔴 **ห้ามใส่เครื่องหมายถูก** (เจ้าของสั่ง 28 ส.ค. 2569) — โชว์เลขขั้นเสมอ */}
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-xs tabular-nums',
                        on ? 'bg-primary-foreground/20' : 'bg-secondary',
                      )}
                      aria-hidden
                    >
                      {t.step}
                    </span>
                    <span className="min-w-0">
                      <span className="block">{t.label}</span>
                      {here ? (
                        <span className={cn('block font-normal', on ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                          ค้างที่นี่
                        </span>
                      ) : null}
                    </span>
                  </Button>
                );
              })}
            </nav>

            {released ? (
              /* 🔴 ปุ่มย้อนกลับอยู่ข้างป้ายเลย ไม่ต้องไล่ไปขั้น 4 (เจ้าของเคาะ 29 ก.ย. 2569: *"ถ้าอันไหนต้องการเอาออกจากหน้า
                 สาธารณะต้องมีปุ่มให้ย้อนกลับมาได้"* → Choice "บนหัวป๊อป ข้างป้าย ปล่อยแล้ว") · ปุ่มเดิมในขั้น 4 ยังอยู่ */
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full border px-3 py-1 text-xs', TONE.success.soft, TONE.success.value)}>
                  ประกาศแล้ว
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={releaseBusy || !job}
                  onClick={() => void toggleRelease(false)}
                >
                  {releaseBusy ? 'กำลังบันทึก…' : 'ดึงประกาศลง'}
                </Button>
                {sendError ? (
                  <p role="alert" className="text-xs text-destructive">
                    {sendError}
                  </p>
                ) : null}
              </div>
            ) : skip ? (
              <p className={cn('w-fit rounded-full border px-3 py-1 text-xs', TONE.danger.soft, TONE.danger.value)}>
                ตั้งไม่ประกาศไว้ · {releaseSkipText(skip)}
              </p>
            ) : null}

            {/* ── ① ตรวจใบขอ ── */}
            {step === 'info' ? (
              <>
                {/* 🔴 หน้า 1 = เฉพาะที่เจ้าของสั่ง (5 ต.ค. 2569: *"รายละเอียดขอดูแค่นี้"* + Choice "เหลือแค่ที่บอก เก็บส่วนเกินไว้ใน ดูเพิ่ม")
                    หน่วยงาน · ตำแหน่ง · วันที่ต้องการ · จำนวน · สถานที่ · วันเวลาทำงาน · อัตราตามใบขอ (ฐาน + สวัสดิการ)
                    · ชื่อคนลาออก/ถูกเปลี่ยนตัว + รายได้ 3 เดือนล่าสุดของคนนั้น
                    ส่วนเกิน (ใบเต็ม 26 ช่อง · สาเหตุ · รุ่นรถ · อัตราตามเงื่อนไข) อยู่ใต้ "ดูเพิ่ม" — เดิม 4 ต.ค. กางใบเต็มทั้งใบ */}
                <StepCard title="ข้อมูลใบขอ">
                  {job ? (
                    <div className="space-y-3">
                      <UnitRequestBriefFields job={job} />
                      <RequestRateLinesBlock job={job} posting />
                      {/* ใบเปิดไซต์ใหม่ไม่มีคนเก่า = บอกบรรทัดเดียว (ไม่วาดการ์ดที่มีแต่ "—") */}
                      {hasResignedInfo(job) ? (
                        <ResignedEmployeeBlock job={job} compact brief />
                      ) : (
                        <p className="text-xs text-muted-foreground">ใบนี้ไม่มีข้อมูลคนเก่า</p>
                      )}
                    </div>
                  ) : (
                    <Loading />
                  )}
                </StepCard>

                {job ? (
                  <StepCard>
                    <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="ghost" size="xs" className="-ml-2">
                          ดูเพิ่ม
                          <ChevronDown className={cn('transition-transform', moreOpen && 'rotate-180')} aria-hidden />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-3 pt-3" data-testid="request-more">
                        <UnitRequestInfoFields job={job} />
                        {hasResignedInfo(job) ? <ResignedEmployeeBlock job={job} compact /> : null}
                      </CollapsibleContent>
                    </Collapsible>
                  </StepCard>
                ) : null}

              </>
            ) : null}

            {/* ── ② สถานที่ปฏิบัติงาน · ③ รายได้ + สวัสดิการ — ฟอร์มฝัง (บันทึกเอง ไม่มีปุ่มบันทึกแล้วปิด) ── */}
            {step === 'place' || step === 'benefits' ? (
              jobWithPatch ? (
                <React.Suspense fallback={<Loading text="กำลังโหลดฟอร์ม…" />}>
                  <EditPublicJobFieldsDialog
                    key={`${jobWithPatch.id}-${step}`}
                    sections={step === 'place' ? ['place'] : ['income', 'benefits']}
                    job={jobWithPatch}
                    onSaved={onFieldsSaved}
                  />
                </React.Suspense>
              ) : (
                <Loading />
              )
            ) : null}

            {/* หน้า 3 มีเพศ + อายุด้วย (เจ้าของ 4 ต.ค. 2569: *"เลือกสวัสดิการ + รายได้ เพศ อายุ ดึงจากใบขอมาก่อน แก้ได้"*)
                เพศย้ายมาจากหน้า 1 — หน้า 1 เหลือข้อมูลใบขออย่างเดียว */}
            {step === 'benefits' ? (
              <>
                <StepCard title="เพศที่รับ">
                  {jobWithPatch ? <GenderPicker job={jobWithPatch} onSaved={onFieldsSaved} /> : <Loading />}
                </StepCard>
                <StepCard title="อายุที่รับ">
                  {jobWithPatch ? <AgeRangeFields job={jobWithPatch} onSaved={onFieldsSaved} /> : <Loading />}
                </StepCard>
              </>
            ) : null}

            {/* ── ④ สรุป + ส่งประกาศ ── */}
            {step === 'publish' ? (
              <>
                {/* ผู้สมัครจะเห็นแบบไหน (เจ้าของ 4 ต.ค. 2569: *"หน้าสรุปต้องบอกว่าผู้สมัครจะเห็นหน้าตาแบบไหน จะได้ตรวจว่าครบไหม"*)
                    การ์ดตัวเดียวกับหน้าประกาศ — ช่องที่ติ๊กซ่อนก็ซ่อนในนี้ด้วย */}
                <StepCard title="ผู้สมัครจะเห็นแบบนี้">
                  {jobWithPatch ? <PublicJobCardPreview job={jobWithPatch} /> : <Loading />}
                </StepCard>

                {/* 🔴 หน้า 4 = สรุป แก้ในหน้านี้ไม่ได้ (เจ้าของ 4 ต.ค. 2569) — ปุ่ม "แก้" พาไปหน้าของช่องนั้น */}
                <StepCard title="สรุปก่อนส่ง">
                  {jobWithPatch ? (
                    <dl className="divide-y divide-border/60">
                      <SummaryRow label="ตำแหน่ง">{postingPositionText(jobWithPatch)}</SummaryRow>
                      <SummaryRow label="สถานที่" onEdit={() => setOpenStep('place')}>
                        {publicSafeAddress(jobWithPatch) || 'ไม่ระบุจังหวัด'}
                      </SummaryRow>
                      <SummaryRow label="รายได้" onEdit={() => setOpenStep('benefits')}>
                        {incomeText ?? <span className="text-muted-foreground">ยังไม่ได้ตั้ง</span>}
                      </SummaryRow>
                      <SummaryRow label="รับเงิน" onEdit={() => setOpenStep('benefits')}>
                        {payCycleText(payCyclesOf(jobWithPatch)).replace(/^รับเงิน/, '') || (
                          <span className="text-muted-foreground">ยังไม่ได้เลือก</span>
                        )}
                      </SummaryRow>
                      <SummaryRow label="สวัสดิการ" onEdit={() => setOpenStep('benefits')}>
                        {benefitLines.length > 0 ? (
                          <span className="flex flex-col">
                            {benefitLines.map((b) => (
                              <span key={b}>{b}</span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">ยังไม่ได้เลือก</span>
                        )}
                      </SummaryRow>
                      <SummaryRow label="เพศที่รับ" warn={genderBlocked} onEdit={() => setOpenStep('benefits')}>
                        {genderText ?? 'ยังไม่ได้เลือก'}
                      </SummaryRow>
                      <SummaryRow label="อายุที่รับ" onEdit={() => setOpenStep('benefits')}>
                        {boardCardAge(jobWithPatch)}
                      </SummaryRow>
                    </dl>
                  ) : (
                    <Loading />
                  )}
                </StepCard>

                <StepCard title="ลิงก์สมัคร" aside={<span className="text-xs text-muted-foreground">ไม่บังคับ</span>}>
                  {/* "มีแล้ว N ลิงก์" กดแล้วกางดูทีละลิงก์ว่าเกี่ยวกับอะไร (เจ้าของ 4 ต.ค. 2569 → Choice "ครบ") */}
                  {linkCount === null ? (
                    <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
                  ) : linkCount > 0 ? (
                    <Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="-ml-2">
                          มีแล้ว {NUM.format(linkCount)} ลิงก์
                          <ChevronDown className={cn('transition-transform', linksOpen && 'rotate-180')} aria-hidden />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <PostingLinksList postings={(jobPostings ?? []).filter((p) => p.status === 'open')} onChanged={() => void loadPostings()} />
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <p className="text-sm text-muted-foreground">ยังไม่มีลิงก์</p>
                  )}
                  {/* 🔴 "Gen link" เป็นปุ่มกางลง (เจ้าของสั่ง 5 ต.ค. 2569: *"สร้างลิงก์ เปลี่ยนเป็น Gen link และพอกดไป
                      ให้มันเป็น Dropdown ไม่ใช่ค้างโชว์ไว้"*) — เดิมเป็นช่องติ๊กที่กางฟอร์มค้างไว้ · กดอีกครั้ง = พับ
                      มีประกาศแล้ว = เลือกช่องทางอย่างเดียว ข้อความเดิม · ยังไม่มี = กรอกข้อความประกาศครั้งแรกครั้งเดียว */}
                  <Collapsible open={wantLink} onOpenChange={setWantLink}>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="outline" size="sm" data-testid="gen-link-toggle">
                        <Link2 aria-hidden />
                        {linkCount ? 'Gen link เพิ่ม' : 'Gen link'}
                        <ChevronDown className={cn('transition-transform', wantLink && 'rotate-180')} aria-hidden />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      {job && openPosting ? (
                        <AddChannelLinks
                          posting={openPosting}
                          onCreated={() => {
                            void loadPostings();
                            setLinksOpen(false);
                          }}
                        />
                      ) : job ? (
                        <GenApplyLinkDialog
                          embedded
                          open
                          previewFirst
                          job={job}
                          onClose={() => setWantLink(false)}
                          onCreated={() => {
                            void loadPostings();
                            setLinksOpen(true);
                          }}
                        />
                      ) : null}
                    </CollapsibleContent>
                  </Collapsible>
                </StepCard>

                {!released && skip ? (
                  <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2', TONE.danger.soft)}>
                    <p className={cn('text-sm', TONE.danger.value)}>ใบนี้ตั้งไม่ประกาศไว้ ยกเลิกที่ขั้น 1 ก่อนถึงจะส่งได้</p>
                    <Button type="button" size="xs" variant="outline" onClick={() => setOpenStep('info')}>
                      ไปขั้น 1
                    </Button>
                  </div>
                ) : null}
                {!released && genderBlocked ? (
                  <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2', TONE.warn.soft)}>
                    <p className={cn('text-sm', TONE.warn.value)}>ใบขอไม่ระบุเพศ เลือกเพศก่อนถึงจะส่งได้</p>
                    <Button type="button" size="xs" variant="outline" onClick={() => setOpenStep('benefits')}>
                      ไปหน้า 3 เลือกเพศ
                    </Button>
                  </div>
                ) : null}

                {released === null ? (
                  <Loading text="กำลังอ่านทะเบียนการประกาศ…" />
                ) : released ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <p className={cn('mr-auto text-sm', TONE.success.value)}>ใบนี้ประกาศแล้ว</p>
                    {sendError ? (
                      <p role="alert" className="text-xs text-destructive">
                        {sendError}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={releaseBusy || !job}
                      onClick={() => void toggleRelease(false)}
                    >
                      {releaseBusy ? 'กำลังบันทึก…' : 'ดึงประกาศลง'}
                    </Button>
                    <Button type="button" onClick={leaveToBoard}>
                      ปิด
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {sendError ? <p className="mr-auto text-xs text-destructive">{sendError}</p> : null}
                    {/* ร่าง = ของที่ทำไว้บันทึกแล้วทุกขั้น ยังไม่ขึ้นหน้าสาธารณะ ⇒ ปิดป๊อปกลับกล่องงาน */}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={releaseBusy}
                      title="เก็บที่ทำไว้ ยังไม่ประกาศ"
                      onClick={leaveToBoard}
                    >
                      บันทึกแบบร่าง
                    </Button>
                    <Button
                      type="button"
                      /* 🔴 ส่งได้เลย ลิงก์ไม่บังคับ (Choice 30 ก.ย. 2569) · ยังต้องผ่านสองด่าน: เลือกเพศแล้ว + ไม่ได้ตั้งไม่ปล่อย */
                      disabled={releaseBusy || !job || genderBlocked || Boolean(skip)}
                      onClick={() => void sendPost()}
                    >
                      {releaseBusy ? 'กำลังส่ง…' : 'ส่งประกาศ'}
                    </Button>
                  </div>
                )}
              </>
            ) : null}

            {/* ── ปุ่มไปขั้นต่อไป — ขั้น 4 ไม่มี เพราะปุ่มลงมือคือ "ส่งประกาศ" ในขั้นนั้นเอง ── */}
            {nextStep ? (
              <Button type="button" className="w-full" onClick={() => setOpenStep(nextStep)}>
                ถัดไป ขั้น {RELEASE_STEP_TEXT[nextStep].step} {RELEASE_STEP_TEXT[nextStep].label}
                <ChevronRight aria-hidden />
              </Button>
            ) : null}

            {/* ── "ไม่ปล่อย + เหตุผล" — ล่างสุดของขั้น 1 (เจ้าของสั่ง 30 ก.ย. 2569: "ไม่ปล่อยใบนี้ ย้ายไปไว้ข้างล่าง")
                ฟอร์มกางในที่เดิม ไม่ซ้อน Dialog ในป๊อป ── */}
            {step === 'info' && job ? (
              <ReleaseSkipControl jobId={job.id} skip={skip} released={released} onChanged={() => void loadSkips()} />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

/**
 * หน้า deep-link `/jobs/board/:id/posting` — เก็บไว้ให้ลิงก์ที่ใครบันทึกไว้ยังเปิดได้
 * 🔴 ทางเข้าหลักคือ **popup บนกล่องงาน** (เจ้าของสั่ง 28 ส.ค. 2569:
 * *"ไม่ได้ให้เด้งไปหน้าถัดไปนะ ให้เด้ง Popup ทำเสร็จก็จะได้อยู่หน้าเดิม"*)
 */
const BoardPostingPage: React.FC = () => {
  const { id = '' } = useParams();
  return <BoardPostingSteps id={id} />;
};

export default BoardPostingPage;
