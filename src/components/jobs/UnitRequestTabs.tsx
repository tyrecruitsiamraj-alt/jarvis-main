import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * แท็บสองหน้าของใบขอ (เจ้าของเคาะ 16 ส.ค. 2569 จากภาพเสนอ)
 *   1. รายละเอียดใบขอ — "งานนี้คืออะไร"
 *   2. คนที่จับคู่ได้   — "ตอนนี้มีใครแล้วบ้าง"
 *
 * แยกสองหน้าเพราะตอบคนละคำถาม และรายชื่อยาวกว่าข้อมูลใบขอมาก
 * ⚠️ ใช้ navigate จริง ไม่ใช่ซ่อน/โชว์ในหน้าเดียว — คนจะได้ส่งลิงก์หน้าที่ตัวเองดูอยู่ให้กันได้
 */
export type UnitRequestTabId = 'detail' | 'matching';

export type UnitRequestTabsProps = {
  jobId: string;
  active: UnitRequestTabId;
  /** จำนวนคนที่จับคู่ได้ — undefined = ยังโหลดไม่เสร็จ (ไม่โชว์เลขมั่ว) */
  matchCount?: number;
};

const UnitRequestTabs: React.FC<UnitRequestTabsProps> = ({ jobId, active, matchCount }) => {
  const navigate = useNavigate();
  const base = `/jobs/siamraj/${encodeURIComponent(jobId)}`;
  const tabs: Array<{ id: UnitRequestTabId; label: string; to: string; count?: number }> = [
    { id: 'detail', label: 'รายละเอียดใบขอ', to: base },
    { id: 'matching', label: 'คนที่จับคู่ได้', to: `${base}/matching`, count: matchCount },
  ];

  return (
    <div className="flex gap-1 border-b-2 border-border/70" role="tablist">
      {tabs.map((t) => (
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
          {typeof t.count === 'number' ? (
            <span className="ml-1 font-mono text-xs tabular-nums opacity-80">({t.count})</span>
          ) : null}
        </button>
      ))}
    </div>
  );
};

export default UnitRequestTabs;
