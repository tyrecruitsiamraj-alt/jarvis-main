import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * หน้างานสรรหา (RM) ถูกยุบรวมเข้ากับบอร์ดรับสมัครแล้ว (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก:
 * "เอาไปรวมกับหน้าบอร์ดรับสมัคร ... ต้องการแบบแยกกล่องงาน แต่ยังดึงเก็บไปแบบหน้า RM ได้")
 *
 * เนื้อทั้งหมดย้ายไป `src/components/recruit-rm/RmWorkspace.tsx` ซึ่งเป็นมุมมอง
 * "รายชื่อผู้สมัคร" ของบอร์ด (`/jobs/board?view=list`) — path นี้เหลือเป็น redirect
 * กัน bookmark เก่าพัง และคง `?tab=` ที่แชร์กันไว้ให้ด้วย
 */
const RecruitRmPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const target = `/jobs/board?view=list${tab ? `&tab=${encodeURIComponent(tab)}` : ''}`;
  return <Navigate to={target} replace />;
};

export default RecruitRmPage;
