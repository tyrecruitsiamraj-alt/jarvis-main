import React from 'react';
import { useSearchParams } from 'react-router-dom';
import JobBoardView, { type BoardViewId } from '@/components/jobs/JobBoardView';
import RmWorkspace from '@/components/recruit-rm/RmWorkspace';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';

/**
 * บอร์ดรับสมัครฝั่งเจ้าหน้าที่ — สี่มุมมองในหน้าเดียว
 * (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก: รวม RM เข้าบอร์ด · 13 ส.ค. 2569: ยกแท็บ
 * "การติดต่อ"/"ติดตามนัดหมาย" จากแท็บย่อยของ RM ขึ้นระดับเดียวกับกล่องงาน)
 *
 * `?view=board` กล่องงาน (ค่าเริ่มต้น) · `list` รายชื่อผู้สมัคร ·
 * `contact` การติดต่อ · `appointments` ติดตามนัดหมาย — สามตัวหลังคือ
 * RmWorkspace ตัวเดียวกัน ล็อกไว้คนละแท็บ (แถบแท็บย่อยข้างในถูกซ่อน)
 *
 * ⚠️ `RmWorkspace` ต้อง import ที่นี่เท่านั้น — `JobBoardView` ใช้ร่วมกับหน้าสมัคร
 * สาธารณะ ลากโค้ด RM เข้าไปตรงนั้น = bundle หน้า public บวมด้วยของภายใน
 */

const RM_VIEWS = ['list', 'contact', 'appointments'] as const;

/** view ระดับบอร์ด → แท็บของ RmWorkspace (นิยามแท็บอยู่ที่ lib/recruitRm เหมือนเดิม) */
const VIEW_TO_RM_TAB = {
  list: 'candidates',
  contact: 'contact',
  appointments: 'appointments',
} as const;

const StaffJobBoardPage: React.FC = () => {
  const { jobs, loading, refreshing, loadError, refetch } = useUnitRequestsFeed();
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('view');
  const view: BoardViewId = (RM_VIEWS as readonly string[]).includes(raw ?? '')
    ? (raw as BoardViewId)
    : 'board';

  const setView = (next: BoardViewId) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'board') params.delete('view');
    else params.set('view', next);
    // ?tab= เป็นของระบบแท็บย่อยเดิม — ตอนนี้แท็บถูกคุมด้วย ?view= แล้ว ล้างกันชนกัน
    params.delete('tab');
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="relative -mx-4 sm:-mx-5 md:-mx-6 lg:-mx-8">
      <JobBoardView
        jobs={jobs}
        loading={loading}
        loadError={loadError}
        variant="staff"
        onRefresh={refetch}
        refreshing={refreshing}
        detailReturnTo="/jobs/board"
        searchPlaceholder="ค้นหาชื่อหน่วยงาน, ที่อยู่, ตำแหน่ง, ลักษณะงานย่อย..."
        view={view}
        onViewChange={setView}
        listContent={
          view === 'board' ? null : <RmWorkspace tab={VIEW_TO_RM_TAB[view as (typeof RM_VIEWS)[number]]} />
        }
      />
    </div>
  );
};

export default StaffJobBoardPage;
