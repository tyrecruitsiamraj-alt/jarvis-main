/**
 * ═══ ไล่งานของใบขอหนึ่งใบ — **ขั้น 1 → 2 → 3 → 4 จบที่ปุ่มปล่อย** ═══
 *
 * 🔴 **หน้านี้เป็นของกล่องงาน ไม่ใช่ของใบงาน** (เจ้าของสั่ง 27 ส.ค. 2569)
 * > *"หน้าใบงานกดเข้าไปต้องเจอแค่ รายละเอียดงาน ผู้สมัคร AI match การติดต่อ ·
 * >  ประกาศ/ลิงก์สมัคร ต้องอยู่กล่องงานสิ ทำไมไม่เข้าใจ"*
 *
 * ═══ 🔴🔴 ทำไมเป็น "ขั้นตอน" ไม่ใช่ "กองบล็อก" ═══
 *
 * เจ้าของพูดเรื่องนี้ไว้ **สามรอบ** แต่ผมทำหลุดสองรอบแรก:
 * 1. *"พอจะปล่อยก็ไปกดดู แล้วก็**ตามขั้นตอน 1 2 3 4** แล้วก็ปล่อยไป"*
 * 2. *"กดงานที่หน้ากล่องงานเด้งไปหน้าใบขออยู่เลย งงไรเนี่ย"*
 * 3. *"ยิ่งแก้ยิ่งแย่ ลองไล่ย้อนที่เคยคุยดิ · บอกกดหน้ากล่องงานเจอกล่องงาน
 *     **พอกดไปก็ไล่งานที่ต้องทำไป** นี่อะไรไม่รู้เละเทะ"*
 *
 * รุ่นที่ผิด: กองบล็อก 5 ก้อนเรียงกันลงมา **ปุ่มปล่อยอยู่ก้อนแรกสุด** ทั้งที่มันคือขั้น 4
 * ⇒ ปล่อยได้ก่อนเขียนประกาศ · ไม่มีอะไรบอกว่าใบนี้ค้างขั้นไหน · ไล่ทีละขั้นไม่ได้
 *
 * รุ่นนี้: **แถบขั้น 1-4 อยู่บนสุด** บอกว่าใบนี้อยู่ขั้นไหน ขั้นไหนผ่านแล้ว
 * โชว์เนื้อของขั้นที่เลือกทีละขั้น · ท้ายขั้นมีปุ่ม "ถัดไป" · ขั้น 4 คือปุ่มปล่อย
 *
 * 🔴 **ขั้นที่ใบนี้ค้างอยู่มาจาก `releaseStepOf()` ที่เดียว** — ตัวเดียวกับที่นับเลข
 * บนหัวกล่องงาน ⇒ กดขั้น 3 จากหน้ากล่องงานแล้วเข้ามา ต้องมาโผล่ที่ขั้น 3 ตรงกันเสมอ
 *
 * ของแต่ละขั้น (ทั้งหมดย้ายมาจากป๊อปอัป 3 ขั้นบนการ์ดที่ถูกถอดไปแล้ว):
 *   ① ตรวจใบขอ         — ข้อมูลใบขอ + ช่องหมายเหตุ "ติดอะไร" + ใครแก้อะไรไป
 *   ② แก้ข้อมูลประกาศ  — จังหวัด/รายได้/สวัสดิการ (`EditPublicJobFieldsDialog`)
 *   ③ สร้างลิงก์สมัคร  — `GenApplyLinkDialog` + แก้ข้อความประกาศถ้ามีแล้ว
 *   ④ ปล่อย            — ปล่อย/ดึงลงหน้าสมัครสาธารณะ
 *
 * 🔴 **ฟอร์มทุกตัวฝังในหน้า ไม่ห่อ Dialog** (เจ้าของสั่ง: *"ไม่เอาแบบ Popup เด้งนะ"*)
 */
import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  ChevronDown,
  ClipboardCheck,
  History,
  Link2,
  Pencil,
  Send,
  StickyNote,
} from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import UnitEditLogSection from '@/components/jobs/UnitEditLogSection';
import EditPostingDialog from '@/components/jobs/EditPostingDialog';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { fetchSiamrajUnitRequest } from '@/lib/siamrajUnitRequestsApi';
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
import { resolveUnitDetailBackPath } from '@/lib/jobUnitSessionState';
import { backLabelFor } from '@/lib/stageOrigin';
import { unitTabPath } from '@/components/jobs/UnitRequestTabs';
import { UnitRequestNoteDetail } from '@/components/jobs/UnitRequestNoteField';
import {
  RELEASE_STEP_ORDER,
  RELEASE_STEP_TEXT,
  releaseStepOf,
  type ReleaseStepKey,
} from '@/lib/boardRelease';
import { EM_DASH } from '@/lib/displayFallback';
import UnitRequestInfoFields from '@/components/jobs/UnitRequestInfoFields';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';

const EditPublicJobFieldsDialog = React.lazy(
  () => import('@/components/jobs/EditPublicJobFieldsDialog'),
);

/** หัวข้อของแต่ละบล็อกในหน้า — ทรงเดียวกันทั้งหน้า */
function Block({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60">
      <header className="flex items-start gap-2 border-b border-border/50 px-4 py-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {hint ? <p className={cn('mt-0.5 text-[11px]', DASH.muted)}>{hint}</p> : null}
        </div>
      </header>
      {children}
    </section>
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
   * ปุ่ม "ยกเลิก" ในฟอร์มที่ฝังไว้ — ฟอร์มพวกนี้เกิดมาเพื่ออยู่ในป๊อป `onClose` จึงหมายถึง
   * "ปิดกล่อง" · 🔴 ฝังในหน้าแล้วต้องมีปลายทางจริง ไม่งั้นเป็น**ปุ่มตาย**
   * ⇒ ยกเลิก = กลับไปแท็บรายละเอียดของใบเดิม
   */
  const leaveToDetail = React.useCallback(() => {
    if (onDone) {
      onDone();
      return;
    }
    navigate(unitTabPath(id, 'detail'));
  }, [onDone, navigate, id]);
  /**
   * 🔴 **ประวัติการแก้ไขโชว์เฉพาะ Admin** (เจ้าของสั่ง 28 ส.ค. 2569:
   * *"ใครแก้อะไรไป ซ่อนไว้เห็นแค่ Admin"*)
   * เดิมกั้นที่ `staff` ⇒ สรรหา/คัดสรรเห็นชื่อกันหมด ซึ่งไม่ใช่เรื่องของพวกเขา
   */
  const { hasPermission } = useAuth();
  const canSeeEditLog = hasPermission('admin');

  const [job, setJob] = React.useState<JobRequest | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  /** ค่าที่เพิ่งแก้ — ทับบนฟอร์มทันทีโดยไม่ต้องโหลดใบใหม่ */
  const [publicPatch, setPublicPatch] = React.useState<Partial<JobRequest>>({});

  const [postings, setPostings] = React.useState<RecruitPosting[] | null>(null);
  const [releases, setReleases] = React.useState<JobRelease[] | null>(null);
  const [releaseBusy, setReleaseBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setError(null);
    fetchSiamrajUnitRequest(id)
      .then((j) => {
        if (alive) setJob(j);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'โหลดใบขอไม่สำเร็จ');
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

  React.useEffect(() => {
    void loadPostings();
    void loadReleases();
  }, [loadPostings, loadReleases]);

  /**
   * ประกาศล่าสุดของใบนี้ — 🔴 ต้องหาผ่าน `buildJobKeyIndex` ไม่ใช่ `===`
   * (id ใบขอมี 3 รูป · URL พาเลขที่ใบเปล่ามาก็ได้ — ดู `jobKeyIndex.ts`)
   */
  const latestPosting = React.useMemo(() => {
    if (!postings) return null;
    // API เรียง created_at DESC มาแล้ว → ตัวแรกที่เจอคือล่าสุด
    const idx = buildJobKeyIndex(
      postings.map((p) => [p.jobId, p] as const),
      (existing) => existing,
    );
    return (job ? idx.get(job.id) : null) ?? idx.get(id) ?? null;
  }, [postings, job, id]);

  const released = React.useMemo(() => {
    if (!releases || !job) return null;
    return buildReleaseIndex(releases).has(job.id);
  }, [releases, job]);

  const toggleRelease = async (next: boolean) => {
    if (!job) return;
    setReleaseBusy(true);
    try {
      if (next) await releaseJobsToPublic([job.id]);
      else await unreleaseJobsFromPublic([job.id]);
      await loadReleases();
    } catch {
      /* สภาพจริงมาจากทะเบียน — โหลดไม่สำเร็จก็ยังโชว์ค่าเดิม ไม่โชว์ค่าที่ยังไม่จริง */
    } finally {
      setReleaseBusy(false);
    }
  };

  const jobWithPatch = job ? ({ ...job, ...publicPatch } as JobRequest) : null;

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
   * ⚠️ ผมเคยทำให้เด้งไปขั้นที่ใบนั้นค้างอยู่ ซึ่งข้ามขั้นตรวจใบขอไปเลย — ผิด
   * `currentStep` ยังใช้อยู่ แต่ใช้แค่ติดป้าย "ค้างที่นี่" ไม่ได้ใช้เลือกขั้นเริ่ม
   */
  const [openStep, setOpenStep] = React.useState<ReleaseStepKey>('info');
  /** กล่อง "ข้อมูลใบขอ" กาง/หุบ — 🔴 หุบเป็นค่าตั้งต้น (เหมือนหน้าใบขอ) */
  const [infoOpen, setInfoOpen] = React.useState(false);
  const step: ReleaseStepKey = openStep;

  /**
   * ขั้นนี้ทำไปแล้วหรือยัง — ใช้กับติ๊กถูกบนแถบ
   * 🔴 อ่านจากร่องรอยจริงเท่านั้น (หมายเหตุ · การแก้ข้อมูล · มีลิงก์ · อยู่ในทะเบียนปล่อย)
   * **ห้ามติ๊กถูกให้ขั้นที่ไม่มีหลักฐาน** — บทเรียน "แถบติ๊กถูกที่โกหก" (25 ส.ค. 2569)
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

  return (
    <div className="relative">
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

        {/* ── 🔴 แถบขั้น 1-4 — หัวใจของหน้านี้ ──
            บอกสามอย่าง: ขั้นไหนผ่านแล้ว · ใบนี้ค้างขั้นไหน · กำลังเปิดดูขั้นไหน */}
        <nav
          className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-2xl border border-border/60 bg-card/60 px-3 py-2.5"
          aria-label="ขั้นตอนของงานประกาศ"
        >
          {RELEASE_STEP_ORDER.map((k, i) => {
            const t = RELEASE_STEP_TEXT[k];
            const on = step === k;
            const passed = doneStep(k);
            const here = currentStep === k;
            return (
              <React.Fragment key={k}>
                {i > 0 ? (
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-700"
                    aria-hidden
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpenStep(k)}
                  aria-current={on ? 'step' : undefined}
                  title={t.todo}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                    on
                      ? cn(TONE.primary.solid, 'border-transparent')
                      : passed
                        ? cn(TONE.success.value, 'border-emerald-300/60 bg-background hover:bg-secondary')
                        : 'border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      on ? 'bg-white/25' : passed ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-secondary',
                    )}
                    aria-hidden
                  >
                    {/* 🔴 **ห้ามใส่เครื่องหมายถูก** (เจ้าของสั่ง 28 ส.ค. 2569: *"เครื่องหมายถูก เอาออก"*)
                        บทเรียนเดิมของบ้านนี้: ติ๊กถูกบนแถบขั้น = อ้างว่า "ทำเสร็จแล้ว"
                        ทั้งที่ระบบไม่มีเหตุการณ์ยืนยันว่าใครทำขั้นนั้นจริง (เคยถอดออกจาก
                        หน้าแรกไปแล้วรอบหนึ่ง 26 ส.ค. 2569) ⇒ โชว์เลขขั้นเสมอ */}
                    {t.step}
                  </span>
                  <span className="whitespace-nowrap">{t.label}</span>
                  {here ? (
                    <span className={cn('whitespace-nowrap text-[10px] font-normal', on ? 'text-white/80' : DASH.cellMuted)}>
                      · ค้างที่นี่
                    </span>
                  ) : null}
                </button>
              </React.Fragment>
            );
          })}
          {released ? (
            <span
              className={cn(
                'ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold',
                TONE.success.soft,
                TONE.success.value,
              )}
            >
              ✓ ปล่อยขึ้นหน้าสาธารณะแล้ว
            </span>
          ) : null}
        </nav>

        {/* คำสั่งงานของขั้นที่เปิดอยู่ — มาจาก RELEASE_STEP_TEXT ที่เดียว */}
        <div className={cn('rounded-xl border px-3.5 py-2.5', TONE.primary.soft)}>
          <p className="text-[13px] font-semibold text-foreground">
            ขั้น {RELEASE_STEP_TEXT[step].step} — {RELEASE_STEP_TEXT[step].todo}
          </p>
          <p className={cn('mt-0.5 text-[11px]', DASH.muted)}>{RELEASE_STEP_TEXT[step].hint}</p>
        </div>

        {/* ── ① ตรวจใบขอ ── */}
        {step === 'info' ? (
          <>
            {/* ── ① ข้อมูลใบขอ — 🔴 **หุบไว้ กดลูกศรกางในกล่องเลย** ──
                เจ้าของสั่ง 28 ส.ค. 2569: *"เปิดใบขอเต็ม ๆ ก็ไม่ต้องเด้งไปหน้าใบงานสิ
                กดแล้วก็ขยายให้ดูเลยสิ"* ⇒ ถอดลิงก์ "เปิดใบขอเต็ม ๆ →" ที่พาออกไปหน้าอื่น
                แล้วกางชุดช่องเดียวกับหน้าใบขอ (`UnitRequestInfoFields`) ในที่เดิม
                ⚠️ สรุปสั้น 4 ช่องยังอยู่ข้างบน — คนไม่ต้องกางก็เห็นของสำคัญแล้ว */}
            <Block
              icon={ClipboardCheck}
              title="ข้อมูลใบขอ"
              hint="ดูสรุปได้ทันที · กดกางเพื่อดูครบทุกช่องแบบเดียวกับหน้าใบขอ"
            >
              <div className="space-y-3 px-4 py-3">
                {job ? (
                  <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                    <Fact label="เลขที่ใบขอ" value={job.request_no} />
                    <Fact label="ตำแหน่ง" value={job.job_description_code_1} />
                    <Fact label="สถานที่" value={job.location_address} />
                    <Fact
                      label="ต้องการวันที่"
                      value={job.required_date ? formatYmdDmyBe(job.required_date) : null}
                    />
                  </dl>
                ) : (
                  <p className={cn('text-xs', DASH.muted)}>กำลังโหลดใบขอ…</p>
                )}

                <button
                  type="button"
                  onClick={() => setInfoOpen((v) => !v)}
                  aria-expanded={infoOpen}
                  className="flex min-h-9 w-full items-center gap-1.5 text-left text-[11px] font-semibold text-blue-700 dark:text-blue-300"
                >
                  {infoOpen ? 'ย่อข้อมูลใบขอ' : 'กางดูข้อมูลใบขอทั้งใบ'}
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform', infoOpen && 'rotate-180')}
                    aria-hidden
                  />
                </button>

                {infoOpen && job ? <UnitRequestInfoFields job={job} /> : null}
              </div>
            </Block>

            <Block
              icon={StickyNote}
              title="ติดอะไรไหม"
              hint="ไม่มีอะไรก็ไปขั้นต่อไปได้เลย — ติดอะไรให้จดไว้ให้คนอื่นเห็น"
            >
              <div className="px-4 py-3">
                {job ? (
                  <UnitRequestNoteDetail job={job} />
                ) : (
                  <p className={cn('text-xs', DASH.muted)}>กำลังโหลด…</p>
                )}
              </div>
            </Block>

            {canSeeEditLog ? (
              <Block
                icon={History}
                title="ใครแก้อะไรไป"
                hint="เฉพาะการแก้ที่เกิดในระบบ Jarvis · ของที่มาจากระบบงานหลักไม่ถูกนับ"
              >
                <div className="px-4 py-3">
                  <UnitEditLogSection job={job} />
                </div>
              </Block>
            ) : null}
          </>
        ) : null}

        {/* ── ② สถานที่ปฏิบัติงาน (เจ้าของเคาะขั้นนี้เอง) ── */}
        {step === 'place' ? (
          <Block
            icon={Pencil}
            title="สถานที่ปฏิบัติงาน"
            hint="จังหวัด / อำเภอ / ตำบล ที่ผู้สมัครจะเห็นบนประกาศ"
          >
            {jobWithPatch ? (
              <React.Suspense
                fallback={<p className={cn('px-4 py-3 text-xs', DASH.muted)}>กำลังโหลดฟอร์ม…</p>}
              >
                <div className="px-4 py-3">
                  <EditPublicJobFieldsDialog
                    embedded
                    sections={['place']}
                    job={jobWithPatch}
                    onClose={leaveToDetail}
                    onSaved={(patch) => setPublicPatch((prev) => ({ ...prev, ...patch }))}
                  />
                </div>
              </React.Suspense>
            ) : (
              <p className={cn('px-4 py-3 text-xs', DASH.muted)}>กำลังโหลดใบขอ…</p>
            )}
          </Block>
        ) : null}

        {/* ── ③ Checklist สวัสดิการ (เจ้าของเคาะขั้นนี้เอง) ──
            *"ให้เลือกว่าจากข้อมูลใบขอจะเอาอะไรมาเป็นสวัสดิการบ้าง เช่น ถ้าติ๊กเลือก
             เบี้ยขยัน ในช่องสวัสดิการก็จะบอกว่าเบี้ยขยันเท่าไหร่"* */}
        {step === 'benefits' ? (
          <Block
            icon={ClipboardCheck}
            title="รายได้ + สวัสดิการที่จะขึ้นประกาศ"
            hint="เลือกจากข้อมูลใบขอว่าจะเอาอะไรขึ้นให้ผู้สมัครเห็น"
          >
            {jobWithPatch ? (
              <React.Suspense
                fallback={<p className={cn('px-4 py-3 text-xs', DASH.muted)}>กำลังโหลดฟอร์ม…</p>}
              >
                <div className="px-4 py-3">
                  <EditPublicJobFieldsDialog
                    embedded
                    sections={['income', 'benefits']}
                    job={jobWithPatch}
                    onClose={leaveToDetail}
                    onSaved={(patch) => setPublicPatch((prev) => ({ ...prev, ...patch }))}
                  />
                </div>
              </React.Suspense>
            ) : (
              <p className={cn('px-4 py-3 text-xs', DASH.muted)}>กำลังโหลดใบขอ…</p>
            )}
          </Block>
        ) : null}

        {/* ── ④ สร้างลิงก์ + ส่งประกาศ — 🔴 ปุ่มส่งอยู่ขั้นสุดท้ายเท่านั้น ── */}
        {step === 'publish' ? (
          <>
            <Block
              icon={Link2}
              title="สร้างลิงก์สมัคร"
              hint="สร้างลิงก์ต่อช่องทาง แล้วเอาไปโพสต์ — ยอดคลิกนับแยกต่อช่องทาง"
            >
              {job ? (
                <GenApplyLinkDialog
                  embedded
                  open
                  job={job}
                  onClose={leaveToDetail}
                  onCreated={() => void loadPostings()}
                />
              ) : (
                <p className={cn('px-4 py-3 text-xs', DASH.muted)}>กำลังโหลดใบขอ…</p>
              )}
            </Block>

            {latestPosting ? (
              <Block
                icon={Pencil}
                title="ข้อความประกาศที่มีอยู่แล้ว"
                hint="แก้แล้วคนที่เปิดลิงก์เห็นข้อความใหม่ทันที"
              >
                <EditPostingDialog
                  embedded
                  posting={latestPosting}
                  onClose={leaveToDetail}
                  onSaved={() => void loadPostings()}
                />
              </Block>
            ) : null}

            <Block
              icon={Send}
              title="ส่งประกาศขึ้นหน้าสมัครสาธารณะ"
              hint="ส่งแล้วคนนอกเห็นและสมัครได้ · AI (Lumos) ก็เห็นใบนี้ด้วย"
            >
              <div className="px-4 py-3">
                {released === null ? (
                  <p className={cn('text-xs', DASH.muted)}>กำลังอ่านทะเบียนการปล่อย…</p>
                ) : (
                  <div
                    className={cn(
                      'rounded-xl border px-3 py-2.5',
                      released ? TONE.success.soft : TONE.warn.soft,
                    )}
                  >
                    <p className="text-xs font-semibold text-foreground">
                      {released ? 'ใบนี้อยู่บนหน้าสาธารณะแล้ว' : 'ใบนี้ยังไม่ขึ้นหน้าสาธารณะ'}
                    </p>
                    <p className={cn('mt-0.5 text-[11px]', DASH.muted)}>
                      {released
                        ? 'คนนอกเห็นและสมัครได้ · AI (Lumos) เห็นใบนี้ด้วย'
                        : latestPosting
                          ? 'มีลิงก์สมัครแล้ว — กดส่งประกาศได้เลย'
                          : 'ยังไม่มีลิงก์สมัคร — สร้างลิงก์ข้างบนก่อนจะดีกว่า'}
                    </p>
                    <Button
                      type="button"
                      disabled={releaseBusy || !job}
                      onClick={() => void toggleRelease(!released)}
                      className={cn(
                        'mt-2 w-full rounded-xl py-2.5 text-sm',
                        released ? TONE.neutral.outline : TONE.success.solid,
                      )}
                    >
                      {releaseBusy
                        ? 'กำลังบันทึก…'
                        : released
                          ? 'ดึงประกาศลงจากหน้าสาธารณะ'
                          : 'ส่งประกาศขึ้นหน้าสาธารณะ'}
                    </Button>
                  </div>
                )}
              </div>
            </Block>
          </>
        ) : null}

        {/* ── ปุ่มไปขั้นต่อไป — ขั้น 4 ไม่มี เพราะปุ่มลงมือคือ "ปล่อย" ในขั้นนั้นเอง ── */}
        {nextStep ? (
          <Button
            type="button"
            onClick={() => setOpenStep(nextStep)}
            className="w-full rounded-xl py-2.5 text-sm"
          >
            ถัดไป — ขั้น {RELEASE_STEP_TEXT[nextStep].step} {RELEASE_STEP_TEXT[nextStep].label}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
};

/** ข้อเท็จจริงหนึ่งบรรทัดในขั้นตรวจ */
function Fact({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-xs text-foreground">
        {value === undefined || value === null || value === '' ? EM_DASH : value}
      </dd>
    </div>
  );
}

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
