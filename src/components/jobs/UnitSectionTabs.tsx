import React from 'react';
import { GlassTabIndicator, glassTabClass, glassTabsListClass } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * สองมุมมองของเมนู "หน่วยงาน" (เจ้าของสั่ง 16 ส.ค. 2569 เย็น:
 * *"ใน menu หน่วยงาน เอาหน้า matching ไปรวม แต่แยกหน้าเป็น หน่วยงาน กับ จับคู่กับงาน"*)
 *
 * - หน่วยงาน    = รายการใบขอ (ของเดิม `/jobs/list`)
 * - จับคู่กับงาน = หน้า Matching (ของเดิม `/matching/match`) — ไม่ย้ายไฟล์ แค่ทำทางเข้าร่วม
 *
 * ⚠️ **ไม่ย้าย route จริง** — หน้า Matching มีลิงก์เข้าจากที่อื่นเต็มไปหมด
 * (ปุ่มบนการ์ด · เมนูเดิม · ลิงก์ที่คนแชร์กันไว้) ย้าย path = ของเก่าพังเงียบทั้งหมด
 * แท็บนี้ทำหน้าที่ "ทางเข้าคู่กัน" ให้สองหน้ารู้สึกเป็นที่เดียวกันพอ
 */
export type UnitSectionId = 'units' | 'matching' | 'contact';

const TABS: Array<{ id: UnitSectionId; label: string; to: string }> = [
  { id: 'units', label: 'หน่วยงาน', to: '/jobs/list' },
  { id: 'matching', label: 'จับคู่กับงาน', to: '/matching/match' },
  // คนของเราที่กด "เก็บไปโทรเอง" บนหน้าจับคู่ ไปโทร+ลงผลที่นี่ (20 ต.ค. 2569 — เดิมไม่มีทางเข้าบนจอ)
  { id: 'contact', label: 'การติดต่อ', to: '/matching/contact' },
];

const UnitSectionTabs: React.FC<{ active: UnitSectionId }> = ({ active }) => {
  const navigate = useNavigate();
  return (
    /* แถบกระจก (เจ้าของ 19 ต.ค. 2569 "เปลี่ยนเป็นกระจกทั้งหมด") — เดิมขีดเส้นใต้ */
    <div className={cn(glassTabsListClass, 'h-auto flex-wrap justify-start rounded-2xl')} role="tablist">
        <GlassTabIndicator />
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => active !== t.id && navigate(t.to)}
          className={glassTabClass(active === t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};

export default UnitSectionTabs;
