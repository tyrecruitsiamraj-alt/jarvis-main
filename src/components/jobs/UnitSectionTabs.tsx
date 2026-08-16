import React from 'react';
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
export type UnitSectionId = 'units' | 'matching';

const TABS: Array<{ id: UnitSectionId; label: string; to: string }> = [
  { id: 'units', label: 'หน่วยงาน', to: '/jobs/list' },
  { id: 'matching', label: 'จับคู่กับงาน', to: '/matching/match' },
];

const UnitSectionTabs: React.FC<{ active: UnitSectionId }> = ({ active }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap gap-1 border-b-2 border-border/70" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => active !== t.id && navigate(t.to)}
          className={cn(
            '-mb-0.5 border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors',
            active === t.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};

export default UnitSectionTabs;
