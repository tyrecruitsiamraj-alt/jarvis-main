/**
 * ═══ แท็บ "ประกาศ / ลิงก์สมัคร" ของใบขอ ═══
 *
 * เจ้าของสั่ง 27 ส.ค. 2569: *"หน้ากล่องงานต้องโชว์พวกนี้ พอกดแล้วก็พาไปดูข้อมูล
 * ไม่เอาแบบ Popup เด้งนะ"*
 *
 * 🔴 **หน้านี้แทนป๊อปอัป 3 ขั้นบนการ์ดกล่องงาน** (รายละเอียดงาน → แก้ไข → Gen link)
 * ที่ถูกถอดออกทั้งดวง · ของที่ป๊อปนั้นเคยเป็นบ้านหลังเดียวและย้ายมาที่นี่ครบ:
 *   1. ปล่อย / ดึงลง หน้าสมัครสาธารณะ (ทะเบียน `job_public_releases`)
 *   2. แก้ข้อความประกาศ (`EditPostingDialog` โหมด embedded)
 *   3. แก้ข้อมูลที่จะขึ้นประกาศ — จังหวัด/รายได้/สวัสดิการ (`EditPublicJobFieldsDialog`)
 *   4. สร้าง / ดูลิงก์สมัคร (`GenApplyLinkDialog` โหมด embedded)
 *
 * 🔴 **ฟอร์มทุกตัวฝังในหน้า ไม่ห่อ Dialog** — ใช้ component ตัวเดิมโหมด `embedded`
 * (ห้ามก๊อปฟอร์มมาทำใหม่ · กติกา UI ข้อ 2)
 */
import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { History, Link2, Pencil, Send } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import UnitRequestTabs from '@/components/jobs/UnitRequestTabs';
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
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { unitTabPath } from '@/components/jobs/UnitRequestTabs';
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

const UnitRequestPostingTabPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  /** ปุ่มย้อนกลับ = กลับหน้าที่พามา (บอร์ดพร้อมขั้นที่กรองอยู่) ไม่ใช่ path ตายตัว */
  const backPath = resolveUnitDetailBackPath({
    stateReturnTo: (location.state as { returnTo?: string } | null)?.returnTo,
    search: location.search,
  });
  /**
   * ปุ่ม "ยกเลิก" ในฟอร์มที่ฝังไว้ — ฟอร์มพวกนี้เกิดมาเพื่ออยู่ในป๊อป `onClose` จึงหมายถึง
   * "ปิดกล่อง" · 🔴 ฝังในหน้าแล้วต้องมีปลายทางจริง ไม่งั้นเป็น**ปุ่มตาย**
   * ⇒ ยกเลิก = กลับไปแท็บรายละเอียดของใบเดิม
   */
  const leaveToDetail = React.useCallback(
    () => navigate(unitTabPath(id, 'detail')),
    [navigate, id],
  );
  /** ⚠️ ชื่อคนแก้เป็นข้อมูลภายใน — ประวัติการแก้ไขโชว์เฉพาะเจ้าหน้าที่ */
  const { hasPermission } = useAuth();
  const isStaff = hasPermission('staff');

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

  return (
    <div className="relative">
      <PageHeader
        title="ประกาศ / ลิงก์สมัคร"
        subtitle={job ? jobBoardCardTitle(job) : id}
        backPath={backPath}
      />

      <div className="space-y-4 px-4 py-4 md:px-6">
        <UnitRequestTabs jobId={id} active="posting" />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {/* ── 1. คนนอกเห็นใบนี้หรือยัง ─────────────────────────────
            🔴 ปล่อย = คนนอก **และ AI (Lumos)** เห็นใบนี้ทันที · ดึงลง = หายจากทั้งสองที่ */}
        <Block
          icon={Send}
          title="หน้าสมัครสาธารณะ"
          hint="ปล่อยแล้วคนนอกเห็นและสมัครได้ · AI (Lumos) ก็เห็นใบนี้ด้วย"
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
                    : 'คนนอกยังไม่เห็น · แก้รายได้/สวัสดิการให้เรียบร้อยก่อนปล่อยได้'}
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
                      ? 'ดึงลงจากหน้าสาธารณะ'
                      : 'ปล่อยขึ้นหน้าสาธารณะ'}
                </Button>
              </div>
            )}
          </div>
        </Block>

        {/* ── 2. ข้อความประกาศ — มีเฉพาะใบที่สร้างประกาศแล้ว ── */}
        <Block
          icon={Pencil}
          title="ข้อความประกาศ"
          hint={
            latestPosting
              ? 'แก้แล้วคนที่เปิดลิงก์เห็นข้อความใหม่ทันที'
              : 'ใบนี้ยังไม่มีประกาศ — สร้างลิงก์สมัครที่บล็อกล่างสุดก่อน'
          }
        >
          {latestPosting ? (
            <EditPostingDialog
              embedded
              posting={latestPosting}
              onClose={leaveToDetail}
              onSaved={() => void loadPostings()}
            />
          ) : (
            <p className={cn('px-4 py-3 text-xs', DASH.muted)}>
              ยังไม่มีข้อความประกาศให้แก้
            </p>
          )}
        </Block>

        {/* ── 3. ข้อมูลที่จะขึ้นประกาศ — แก้ได้ทุกใบ ไม่ต้องมีประกาศก่อน ── */}
        <Block
          icon={Pencil}
          title="ข้อมูลที่จะขึ้นประกาศ"
          hint="จังหวัด / อำเภอ / ตำบล · รายได้รวม · สวัสดิการ — แก้ได้ทุกใบ ไม่ต้องมีประกาศก่อน"
        >
          {jobWithPatch ? (
            <React.Suspense
              fallback={<p className={cn('px-4 py-3 text-xs', DASH.muted)}>กำลังโหลดฟอร์ม…</p>}
            >
              <div className="px-4 py-3">
                <EditPublicJobFieldsDialog
                  embedded
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

        {/* ── 4. ลิงก์สมัคร ── */}
        <Block
          icon={Link2}
          title="ลิงก์สมัคร"
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

        {/* ── 5. ใครแก้อะไรไป — ย้ายมาจากป๊อปการ์ดกล่องงาน (เจ้าของสั่ง 18 ส.ค. 2569) ── */}
        {isStaff ? (
          <Block
            icon={History}
            title="ประวัติการแก้ไข — ใครแก้อะไรไป"
            hint="เฉพาะการแก้ที่เกิดในระบบ Jarvis · ของที่มาจากระบบงานหลักไม่ถูกนับ"
          >
            <div className="px-4 py-3">
              <UnitEditLogSection job={job} />
            </div>
          </Block>
        ) : null}
      </div>
    </div>
  );
};

export default UnitRequestPostingTabPage;
