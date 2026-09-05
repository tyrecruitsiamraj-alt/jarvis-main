import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import JobBoardView, { type BoardViewId } from '@/components/jobs/JobBoardView';
import RmWorkspace from '@/components/recruit-rm/RmWorkspace';
import JobPostingsPage from '@/pages/matching/JobPostingsPage';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { useClosedRequestsFeed } from '@/hooks/useClosedRequestsFeed';
import type { JobBoxKey } from '@/lib/jobBoxGroups';

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

/** แท็บที่ไม่ใช่ RmWorkspace — ย้ายมาจากเมนูอื่น (17 ส.ค. 2569) */
const EXTRA_VIEWS = ['postings'] as const;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('view');
  const legacyBox = raw ? (LEGACY_BOX_VIEWS[raw] ?? null) : null;
  const view: BoardViewId =
    (RM_VIEWS as readonly string[]).includes(raw ?? '') ||
    (EXTRA_VIEWS as readonly string[]).includes(raw ?? '')
      ? (raw as BoardViewId)
      : 'board';

  /** ลิงก์เก่ามาถึงแล้ว = เลือกกล่องให้ แล้วล้าง ?view ทิ้ง (URL ไม่ค้างค่าที่ไม่มีความหมาย) */
  useEffect(() => {
    if (!legacyBox) return;
    const params = new URLSearchParams(searchParams);
    params.delete('view');
    setSearchParams(params, { replace: true });
  }, [legacyBox, searchParams, setSearchParams]);

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
    <div className="relative -mx-4 sm:-mx-5 md:-mx-6 lg:-mx-8">
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
        listContent={
          view === 'board' ? null : view === 'postings' ? (
            /* หน้าเดิมทั้งหน้า ยกมาวางเป็นเนื้อของแท็บ — ไม่ได้ก๊อปโค้ด ใช้ตัวเดียวกัน
               กับที่ /matching/job-postings เคยเรียก (route เดิมยังอยู่เป็นทางถอย) */
            <JobPostingsPage embedded />
          ) : (
            <RmWorkspace tab={VIEW_TO_RM_TAB[view as (typeof RM_VIEWS)[number]]} />
          )
        }
      />
    </div>
  );
};

export default StaffJobBoardPage;
