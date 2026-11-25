import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { lazyPage } from '@/lib/staleChunkReload';
import RmWorkspace from '@/components/recruit-rm/RmWorkspace';
import { fetchScrapCandidatesOfJob } from '@/lib/scrapCandidatesApi';
import { isScrapApplication } from '@/lib/scrapCandidates';
import { resolveUnitDetailBackPath } from '@/lib/jobUnitSessionState';
import { backLabelFor } from '@/lib/stageOrigin';
import UnitRequestTabs, { type UnitRequestTabId } from '@/components/jobs/UnitRequestTabs';
import OrderPostButton from '@/components/jobs/OrderPostButton';
import { JobPostActionsPanel } from '@/components/jobs/JobPostActionsDialog';
import type { BoardActionTab } from '@/components/jobs/BoardCardActions';
import { applicationsJobKey, fetchSiamrajUnitRequest } from '@/lib/siamrajUnitRequestsApi';
import { fetchJobApplications } from '@/lib/publicApplicationsApi';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import type { JobRequest } from '@/types';

/** แผงจับคู่ของหน้าจับคู่งาน (ไฟล์ใหญ่ — โหลดเมื่อเปิดแท็บนี้เท่านั้น) */
const MatchingPage = lazyPage(() => import('@/pages/matching/MatchingPage'));

/** 🔴 แท็บ `posting` มีหน้าของตัวเอง (`UnitRequestPostingTabPage`) — ไฟล์นี้ไม่รับ */
export type UnitRequestSubTab = Exclude<UnitRequestTabId, 'detail' | 'posting'>;

const TAB_TITLE: Record<UnitRequestSubTab, string> = {
  applicants: 'ผู้สมัคร',
  scrap: 'Scrap',
  match: 'จับคู่งาน',
  actions: 'Autopost / Scrap / โพสต์เอง',
};

/**
 * แท็บย่อยของใบขอ (แท็บ "รายละเอียดงาน" เป็นหน้าเดิมคนละไฟล์)
 *
 * 🔴 25 พ.ย. 2569 เจ้าของ: "หน้าใบขอ ถ้ากดใบขอไหน ก็ทำเรื่องอะไรต่างๆในใบขอนั้นได้ เช่น จับคู่งาน … แต่เก็บแล้วไปหน้าการติดต่อเหมือนเดิม"
 *   Choice "แท็บจับคู่งานในใบขอ" + "แท็บ Scrap แบบใหม่" + "แท็บผู้สมัครแบบหน้าผู้สมัคร"
 * - ผู้สมัคร = ตาราง/กล่อง/ปุ่มชุดเดียวกับแท็บผู้สมัครของหน้างานสรรหา ล็อกใบขอนี้ (`RmWorkspace lockedJobId`)
 *   ใบจาก Scrap ไม่ขึ้นที่นี่ (อยู่แท็บ Scrap)
 * - Scrap = ตัวเดียวกับแท็บ Scrap ของหน้างานสรรหา ล็อกใบขอนี้ (`RmWorkspace scrap lockedJobId`)
 * - จับคู่งาน = แผงจับคู่ของใบนี้ (`MatchingPage lockedJob`)
 * - เก็บไปโทรเอง/เก็บ Lead แล้ว = ไปแท็บการติดต่อของหน้างานสรรหา (ไม่มีแท็บการติดต่อในใบขอ — ถอด 11 พ.ย. 2569)
 *
 * ⚠️ **ผู้สมัคร ≠ จับคู่งาน** — ผู้สมัครคือคนที่มีใบสมัครจริงกับใบขอนี้ ส่วนจับคู่งานคือคนที่ระบบแนะนำ ยังไม่ใช่ใบสมัคร
 */
const UnitRequestTabPage: React.FC<{ tab: UnitRequestSubTab }> = ({ tab }) => {
  const { id = '' } = useParams();
  /**
   * 🔴 ปุ่มย้อนกลับต้องพากลับ **หน้าที่พามา** ไม่ใช่ `/jobs/list` ตายตัว
   * (เจ้าของทัก 27 ส.ค. 2569: กดจากกล่องงานแล้วงงว่าอยู่ไหน · กดกลับไปโผล่หน้าอื่น)
   */
  const location = useLocation();
  const backPath = resolveUnitDetailBackPath({
    stateReturnTo: (location.state as { returnTo?: string } | null)?.returnTo,
    search: location.search,
  });
  const [job, setJob] = useState<JobRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  /** เลขบนแท็บผู้สมัคร (ไม่นับใบจาก Scrap) — undefined = ยังโหลดไม่เสร็จ */
  const [applicantTotal, setApplicantTotal] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  /** แท็บ Autopost / Scrap / โพสต์เอง — กล่องที่เลือก + โหลดใหม่หลังสั่งงาน */
  const [actionsTab, setActionsTab] = useState<BoardActionTab>('autopost');
  const [actionsRev, setActionsRev] = useState(0);
  /** ยอดรายชื่อจาก Scrap ของใบนี้ (เลขบนแท็บ · 17 พ.ย. 2569) — undefined = ยังโหลดไม่เสร็จ */
  const [scrapTotal, setScrapTotal] = useState<number | undefined>(undefined);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const j = await fetchSiamrajUnitRequest(id).catch(() => null);
      setJob((j as JobRequest | null) ?? null);
      setLoaded(true);
      const apps = await fetchJobApplications(applicationsJobKey(id, j?.id));
      setApplicantTotal(apps.filter((a) => !isScrapApplication(a)).length);
      void fetchScrapCandidatesOfJob(j?.id ?? id)
        .then((d) => setScrapTotal(d.counts.total))
        .catch(() => setScrapTotal(undefined));
    } catch (e) {
      setLoaded(true);
      setError(e instanceof Error ? e.message : 'โหลดรายชื่อไม่สำเร็จ');
    }
  }, [id]);

  useEffect(() => {
    if (id) void reload();
  }, [id, reload]);

  /** id เต็มของใบ (`siamraj-sql:` / `siamraj-pre:`) — โหลดใบไม่ขึ้นใช้คีย์จาก URL */
  const jobKey = job?.id ?? applicationsJobKey(id, undefined);
  const loadingText = <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;

  return (
    <div className="relative">
      <PageHeader
        title={TAB_TITLE[tab]}
        subtitle={job ? jobBoardCardTitle(job) : id}
        backPath={backPath}
        backLabel={backLabelFor(backPath)}
      />

      <div className="space-y-4 px-4 pb-4 md:px-6">
        <UnitRequestTabs jobId={id} active={tab} counts={{ applicants: applicantTotal, scrap: scrapTotal }} />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {/* ── ผู้สมัคร: ตารางเดียวกับหน้าผู้สมัคร ล็อกใบนี้ ── */}
        {tab === 'applicants' ? (
          loaded ? <RmWorkspace tab="candidates" jobs={job ? [job] : []} lockedJobId={jobKey} /> : loadingText
        ) : null}

        {/* ── Scrap: ตัวเดียวกับแท็บ Scrap หน้างานสรรหา ล็อกใบนี้ (เจ้าของ 17 พ.ย. 2569 "เปิดใบขอไหนที่มีการสั่ง Scrap ต้องเห็นรายชื่อ") ── */}
        {tab === 'scrap' ? (
          loaded ? <RmWorkspace key="scrap" tab="candidates" scrap jobs={job ? [job] : []} lockedJobId={jobKey} /> : loadingText
        ) : null}

        {/* ── จับคู่งาน: แผงจับคู่ของใบนี้ ── */}
        {tab === 'match' ? (
          job ? (
            <Suspense fallback={loadingText}>
              <MatchingPage embedded lockedJob={job} />
            </Suspense>
          ) : loaded ? (
            <p className="text-sm text-muted-foreground">ไม่พบใบขอนี้</p>
          ) : (
            loadingText
          )
        ) : null}

        {/* ── Autopost / Scrap / โพสต์เอง (เจ้าของ 13 พ.ย. 2569 "ย้ายไปเป็นอีกแท็บ … เอาทำอะไรไปแล้วโชว์ด้วย") ──
            บน = ทำอะไรไปแล้ว (ตัวเดียวกับป๊อปบนการ์ด) · ล่าง = ฟอร์มสั่งตัวเดียวกับป๊อปประกาศ (`OrderPostButton`) กางไว้เลย */}
        {tab === 'actions' ? (
          job ? (
            <>
              {/* ทำอะไรไปแล้ว อยู่บนฟอร์มสั่ง (เจ้าของ 13 พ.ย. 2569 "ทำอะไรไปแล้ว ไว้สูงกว่า") */}
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4" data-testid="unit-actions-done">
                <h2 className="text-base font-medium text-foreground">ทำอะไรไปแล้ว</h2>
                <JobPostActionsPanel jobId={job.id} tab={actionsTab} onTabChange={setActionsTab} reloadKey={actionsRev} />
              </section>
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4" data-testid="unit-actions-order">
                <OrderPostButton job={job} onLinksChanged={() => setActionsRev((n) => n + 1)} />
              </section>
            </>
          ) : (
            loadingText
          )
        ) : null}

        {/* แท็บ "การติดต่อ" ถอดแล้ว (เจ้าของ 11 พ.ย. 2569 "เอาออกจากหน้านี้") — การติดต่ออยู่แท็บของหน้างานสรรหา */}
      </div>
    </div>
  );
};

export default UnitRequestTabPage;
