import React from 'react';
import { useSearchParams } from 'react-router-dom';
import OurPeoplePage from '@/pages/matching/OurPeoplePage';
import ErpBoardPage from '@/pages/matching/ErpBoardPage';

/**
 * รายชื่อรอลงงาน (เจ้าของ 2 พ.ย. 2569): ค่าเริ่ม = บอร์ดของ ERP แบบเดียวกับ ERP
 * หน้ารายชื่อเดิมเป็นทางถอย: ?view=list หรือลิงก์เก่าที่ส่ง ?bucket= มา
 */
const CandidatesBoardRoute: React.FC = () => {
  const [sp] = useSearchParams();
  if (sp.get('view') === 'list' || sp.has('bucket')) return <OurPeoplePage />;
  return <ErpBoardPage />;
};

export default CandidatesBoardRoute;
