import React from 'react';
import JobBoardView from '@/components/jobs/JobBoardView';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';

const StaffJobBoardPage: React.FC = () => {
  const { jobs, loading, refreshing, loadError, refetch } = useUnitRequestsFeed();

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
      />
    </div>
  );
};

export default StaffJobBoardPage;
