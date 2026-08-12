import React from 'react';
import { useSearchParams } from 'react-router-dom';
import JobBoardView from '@/components/jobs/JobBoardView';
import RmWorkspace from '@/components/recruit-rm/RmWorkspace';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';

/**
 * บอร์ดรับสมัครฝั่งเจ้าหน้าที่ — สองมุมมองในหน้าเดียว (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก)
 * `?view=board` กล่องงาน (ค่าเริ่มต้น) · `?view=list` รายชื่อผู้สมัคร (เนื้อหน้า RM เดิม)
 *
 * ⚠️ `RmWorkspace` ต้อง import ที่นี่เท่านั้น — `JobBoardView` ใช้ร่วมกับหน้าสมัคร
 * สาธารณะ ลากโค้ด RM เข้าไปตรงนั้น = bundle หน้า public บวมด้วยของภายใน
 */
const StaffJobBoardPage: React.FC = () => {
  const { jobs, loading, refreshing, loadError, refetch } = useUnitRequestsFeed();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'list' ? 'list' : 'board';

  const setView = (next: 'board' | 'list') => {
    // ต่อยอดจาก params เดิม — ?tab= ของมุมมองรายชื่อต้องรอดตอนสลับไปกลับ
    const params = new URLSearchParams(searchParams);
    if (next === 'board') params.delete('view');
    else params.set('view', next);
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
        listContent={<RmWorkspace />}
      />
    </div>
  );
};

export default StaffJobBoardPage;
