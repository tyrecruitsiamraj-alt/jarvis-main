import React from 'react';
import PageHeader from '@/components/shared/PageHeader';
import SelectionContactBoard from '@/components/matching/SelectionContactBoard';
import UnitSectionTabs from '@/components/jobs/UnitSectionTabs';
import { conveyorLabel } from '@/lib/soRecruitNav';

/**
 * หน้า "การติดต่อ" ของ**เลนคัดสรร** (เจ้าของสั่ง 16 ส.ค. 2569: *"แยกนะ งานสรรหา
 * มีหน้าการติดต่อแล้ว งานคัดสรรก็ให้มีหน้าการติดต่อของเขาเอง ไม่ปนกัน"*)
 *
 * - เลนสรรหาใช้แท็บ "การติดต่อ" บนบอร์ดรับสมัคร (ของเดิม — ตอนนี้กรองเหลือเฉพาะ
 *   งานโทรคนที่ยังไม่สมัคร)
 * - หน้านี้คือฝั่งคัดสรร: งานโทรของคนที่**สมัครแล้ว** (คนบนบอร์ด + ใบสมัคร)
 *
 * 20 ต.ค. 2569: เนื้อในเป็นตาราง `SelectionContactBoard` หน้าตาเดียวกับแท็บการติดต่อของงานสรรหา
 * (เดิม MyCallsSection — ไม่มีเบอร์ให้กดโทร · ลงผลแล้วคนหาย)
 */
const SelectionContactPage: React.FC = () => (
  <div className="relative">
    {/* หัวเดียวกับหน้าจับคู่ — สามแท็บอยู่ใต้หัว "จับคู่งาน" ชุดเดียว */}
    <PageHeader title={conveyorLabel('matching')} subtitle="" backPath="/matching" />
    <div className="space-y-4 px-4 py-4 md:px-6">
      {/* 20 ต.ค. 2569 เจ้าของ: "หน้าจับคู่กับงานไม่มีเก็บเพื่อไปหน้าติดต่อ แล้วไปโทรจากหน้านั้นเหมือนงานสรรหาหรอ"
          — หน้านี้มีอยู่แต่ไม่มีทางเข้าบนจอ ⇒ เป็นแท็บที่ 3 ข้างหน่วยงาน · จับคู่กับงาน · ว่างแล้วไม่หาย */}
      <UnitSectionTabs active="contact" />
      <SelectionContactBoard />
    </div>
  </div>
);

export default SelectionContactPage;
