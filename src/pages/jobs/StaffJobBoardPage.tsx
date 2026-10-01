import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import JobBoardView, { type BoardViewId } from '@/components/jobs/JobBoardView';
import RmWorkspace from '@/components/recruit-rm/RmWorkspace';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { useClosedRequestsFeed } from '@/hooks/useClosedRequestsFeed';
import type { JobBoxKey } from '@/lib/jobBoxGroups';
import { sumJobPositionUnits } from '@/lib/jobPositionUnits';
import { PREQUEST_ID_PREFIX } from '@/lib/siamrajUnitRequestsApi';
import type { BoardPublishedTotals } from '@/lib/boardRelease';

/**
 * แท็บ Dashboard (28 ก.ย. 2569) — โหลดเมื่อกดเท่านั้น: กราฟ recharts + ข้อมูลย้อนหลังไม่ควรถ่วงกล่องงานที่คนเปิดทั้งวัน
 * 🔴 30 ก.ย. 2569 แท็บภาพรวม = **ภาพรวมงานสรรหาแบบ iRecruit** (`RecruitOverview` · เจ้าของ Choice "ทั้งหน้าเป็น iRecruit")
 * แผงเดิม (`BoardDashboard`) เก็บไว้เป็นทางถอยที่ `?dash=classic` — ห้ามลบจนกว่าเจ้าของจะสั่ง
 */
const BoardDashboard = lazy(() => import('@/components/dashboard-trends/BoardDashboard'));
const RecruitOverview = lazy(() => import('@/components/dashboard-trends/RecruitOverview'));

/**
 * บอร์ดรับสมัครฝั่งเจ้าหน้าที่ — สี่มุมมองในหน้าเดียว
 * (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก: รวม RM เข้าบอร์ด · 13 ส.ค. 2569: ยกแท็บ
 * "การติดต่อ"/"ติดตามนัดหมาย" จากแท็บย่อยของ RM ขึ้นระดับเดียวกับกล่องงาน)
 *
 * `?view=board` กล่องงาน (ค่าเริ่มต้น) · `list` รายชื่อผู้สมัคร ·
 * `contact` การติดต่อ · `appointments` ติดตามนัดหมาย — สามตัวหลังคือ
 * RmWorkspace ตัวเดียวกัน ล็อกไว้คนละแท็บ (แถบแท็บย่อยข้างในถูกซ่อน)
 *
 * 🔴 **ปิดแล้ว/ยกเลิกไม่ใช่มุมมองแยกอีกแล้ว** (เจ้าของสั่ง 19 ส.ค. 2569:
 * *"ปิดแล้วกับยกเลิกในหน้ากล่องงานมันต้องกดแล้วดูได้แบบกล่องอื่น ๆ สิ กดแล้วเด้งไป
 * หน้าอื่นทำไม ทำไมไม่ทำให้มันเหมือนกัน"*) — ชุดใบปิดโหลดไว้ที่นี่แล้วส่งเข้ากล่องงาน
 * กดกล่องแล้วกรองการ์ดในหน้าเดิม ใช้ตัวกรอง/คำค้น/แบ่งหน้าชุดเดียวกับกล่องอื่น
 *
 * ⚠️ `RmWorkspace` ต้อง import ที่นี่เท่านั้น — `JobBoardView` ใช้ร่วมกับหน้าสมัคร
 * สาธารณะ ลากโค้ด RM เข้าไปตรงนั้น = bundle หน้า public บวมด้วยของภายใน
 */

const RM_VIEWS = ['list', 'contact', 'appointments'] as const;
/** มุมที่ไม่ใช่กล่องงานและไม่ใช่ RM — แท็บ Dashboard */
const EXTRA_VIEWS = ['dashboard'] as const;

/**
 * แท็บที่ถูกถอดออกแล้ว — ลิงก์เก่ามาถึงให้เปิดกล่องงานแทน แล้วล้าง `?view=` ทิ้ง
 * 🔴 `postings` "คำขอโพสต์งานใหม่" ถอดทั้งแท็บ 27 ก.ย. 2569 (เจ้าของสั่ง: *"ถอดแท็บคำขอโพสต์งานใหม่
 * ออกไปเลย"* — เหตุผลเดิม: *"ดูทีละกล่องแล้วก็เอาขึ้นไปเลย"*) · ห้ามเอากลับมาโดยไม่ได้สั่งใหม่
 * ⚠️ หน้ารวม `/matching/job-postings` ถูกถอดตามไปด้วย 27 ก.ย. 2569 (ลิงก์เก่าเปลี่ยนเส้นมากล่องงาน)
 * แต่ปุ่ม "ให้สร้าง Content" / "Scraping งาน" ในจับคู่งาน **ยังอยู่** — เจ้าของสั่ง "เอาแค่ปุ่ม"
 */
const RETIRED_VIEWS = ['postings'] as const;

/** ลิงก์เก่าที่เคยเป็นแท็บ → กล่องบนหน้ากล่องงาน (ไม่ทำลิงก์ที่ส่งกันไว้พัง) */
const LEGACY_BOX_VIEWS: Record<string, JobBoxKey> = {
  closed: 'closed',
  cancelled: 'cancelled',
};

/** view ระดับบอร์ด → แท็บของ RmWorkspace (นิยามแท็บอยู่ที่ lib/recruitRm เหมือนเดิม) */
const VIEW_TO_RM_TAB = {
  list: 'candidates',
  contact: 'contact',
  appointments: 'appointments',
} as const;

const StaffJobBoardPage: React.FC = () => {
  const { jobs, loading, refreshing, loadError, feedState, dataAgeSeconds, refetch } =
    useUnitRequestsFeed();
  const closed = useClosedRequestsFeed();
  /** ยอดเหลือหาของกล่องงาน (ตัวเดียวกับหัวกล่องงาน) — ส่งให้แท็บ Dashboard ใช้ ห้ามนับชุดที่สอง */
  const boardOpen = useMemo(() => {
    if (loading || feedState !== 'ready') return null;
    const pre = jobs.filter((j) => j.id.startsWith(PREQUEST_ID_PREFIX));
    return { positions: sumJobPositionUnits(jobs), prePositions: sumJobPositionUnits(pre), preCount: pre.length };
  }, [jobs, loading, feedState]);
  /**
   * ใบขอทั้งหมดที่หน้านี้โหลดไว้ (เปิดอยู่ + ปิดแล้ว) — แท็บผู้สมัครใช้บอก "เจ้าหน้าที่สรรหาของใบขอ"
   * ให้ตัวกรองดูเป็นคน (30 ก.ย. 2569) · ใช้ชุดเดิม ไม่ยิงเส้นใหม่
   */
  const allJobs = useMemo(() => [...jobs, ...closed.rows], [jobs, closed.rows]);
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('view');
  const legacyBox = raw ? (LEGACY_BOX_VIEWS[raw] ?? null) : null;
  const view: BoardViewId = [...RM_VIEWS, ...EXTRA_VIEWS].includes((raw ?? '') as never)
    ? (raw as BoardViewId)
    : 'board';
  const retiredView = (RETIRED_VIEWS as readonly string[]).includes(raw ?? '');
  /** ทางถอยของแท็บภาพรวม — แผง Dashboard เดิม (28 ก.ย.) ยังเปิดได้ที่ `?view=dashboard&dash=classic` */
  const classicDashboard = searchParams.get('dash') === 'classic';
  /**
   * 🔴 ยอด "ประกาศ" ของภาพรวม = ตัวเลขของหัวกล่องงาน (เจ้าของ 1 ต.ค. 2569: *"เปลี่ยนเป็น 7 เหมือนหัวกล่องงาน"*)
   * กล่องงานคิดแล้วส่งขึ้นมา (feed · ทะเบียนประกาศ · ยอดผู้สมัครชุดเดียวกับหัว) — ห้ามนับซ้ำที่อื่น
   */
  const [boardPublished, setBoardPublished] = useState<BoardPublishedTotals | null>(null);

  /** ลิงก์เก่ามาถึงแล้ว = เลือกกล่องให้ (หรือเปิดกล่องงานแทนแท็บที่ถอดแล้ว) แล้วล้าง ?view ทิ้ง
   *  (URL ไม่ค้างค่าที่ไม่มีความหมาย) */
  useEffect(() => {
    if (!legacyBox && !retiredView) return;
    const params = new URLSearchParams(searchParams);
    params.delete('view');
    setSearchParams(params, { replace: true });
  }, [legacyBox, retiredView, searchParams, setSearchParams]);

  const setView = (next: BoardViewId) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'board') params.delete('view');
    else params.set('view', next);
    // ?tab= เป็นของระบบแท็บย่อยเดิม — ตอนนี้แท็บถูกคุมด้วย ?view= แล้ว ล้างกันชนกัน
    params.delete('tab');
    // 🔴 **push ไม่ใช่ replace** (5 ก.ย. 2569) — นี่คือ "คนกดเปลี่ยนมุมมองเอง"
    // ถ้า replace ประวัติจะถูกทับ ⇒ กดย้อนกลับแล้ว **หลุดออกจากหน้านี้ไปเลย**
    // (เจ้าของทดสอบเจอเอง: อยู่กล่องงาน → กดแท็บรายชื่อผู้สมัคร → ย้อนกลับ → เด้งไปหน้าแรก)
    setSearchParams(params);
  };

  return (
    /* ระยะขอบเท่าหน้าอื่นทั้งระบบ — เดิมดึงขอบออก (-mx-*) เพื่อให้พื้นไล่สีเต็มจอ ซึ่งถอดไปแล้ว
       27 ก.ย. 2569 (เจ้าของ: "หน้ากล่องงานไม่เข้ากับหน้าอื่นๆเลย" → แบบ A หัว PageHeader ชุดเดียวกัน) */
    <div className="relative">
      <JobBoardView
        jobs={jobs}
        loading={loading}
        loadError={loadError}
        feedState={feedState}
        dataAgeSeconds={dataAgeSeconds}
        variant="staff"
        /* กดรีเฟรช = ข้ามสำเนา ไปถามระบบงานหลักสด */
        onRefresh={() => refetch({ fresh: true })}
        refreshing={refreshing}
        detailReturnTo="/jobs/board"
        // ช่องค้นหาย้ายไปอยู่ในแถบหัวแล้ว (แคบกว่าเดิม) — ข้อความยาวจะถูกตัดกลางคัน
        // ค้นได้เหมือนเดิมทุกฟิลด์ (หน่วยงาน/ที่อยู่/ตำแหน่ง/ลักษณะงานย่อย) แค่ป้ายสั้นลง
        searchPlaceholder="ค้นหาหน่วยงาน, ตำแหน่ง, ที่อยู่…"
        view={view}
        onViewChange={setView}
        closedJobs={closed.rows}
        closedLoading={closed.loading}
        closedError={closed.error}
        closedDays={closed.days}
        onClosedDaysChange={closed.setDays}
        onReloadClosed={closed.reload}
        initialBox={legacyBox}
        onPublishedTotals={setBoardPublished}
        listContent={
          view === 'board' ? null : view === 'dashboard' ? (
            <Suspense fallback={<p className="py-6 text-sm text-muted-foreground">กำลังเปิดภาพรวม…</p>}>
              {classicDashboard ? <BoardDashboard boardOpen={boardOpen} /> : <RecruitOverview published={boardPublished} />}
            </Suspense>
          ) : (
            <RmWorkspace tab={VIEW_TO_RM_TAB[view as (typeof RM_VIEWS)[number]]} jobs={allJobs} />
          )
        }
      />
    </div>
  );
};

export default StaffJobBoardPage;
