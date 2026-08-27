import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * แท็บของใบขอ (เจ้าของสั่ง 16 ส.ค. 2569 เย็น: *"กดเข้าไปที่ใบงานจะเจอรายละเอียดงาน
 * มีหน้าผู้สมัคร และหน้า AI Match และหน้าการติดต่อ"*)
 *
 * แยกแท็บเพราะตอบคนละคำถาม:
 *   รายละเอียด — งานนี้คืออะไร
 *   ประกาศ/ลิงก์ — ประกาศของใบนี้เขียนว่าอะไร · มีลิงก์สมัครหรือยัง · คนนอกเห็นหรือยัง
 *   ผู้สมัคร    — ใครสมัครเข้ามาบ้าง (ของจริงที่มีใบสมัครแล้ว)
 *   AI Match   — AI แนะนำใครบ้าง (ยังไม่ใช่ใบสมัคร)
 *   การติดต่อ   — ใครถูกโทรไปแล้ว ผลเป็นยังไง
 *
 * 🔴 แท็บ "ประกาศ / ลิงก์สมัคร" มาจากการรื้อป๊อปอัป 3 ขั้นบนหน้ากล่องงาน (27 ส.ค. 2569)
 * เจ้าของสั่ง: *"พอกดแล้วก็พาไปดูข้อมูล ไม่เอาแบบ Popup เด้ง"*
 *
 * ⚠️ navigate จริง ไม่ใช่ซ่อน/โชว์ — คนต้องส่งลิงก์แท็บที่ตัวเองดูอยู่ให้กันได้
 */
export const UNIT_TAB_IDS = ['detail', 'posting', 'applicants', 'ai-match', 'contact'] as const;
export type UnitRequestTabId = (typeof UNIT_TAB_IDS)[number];

const TAB_LABEL: Record<UnitRequestTabId, string> = {
  detail: 'รายละเอียดงาน',
  posting: 'ประกาศ / ลิงก์สมัคร',
  applicants: 'ผู้สมัคร',
  'ai-match': 'AI Match',
  contact: 'การติดต่อ',
};

/** path ต่อท้าย base ของแต่ละแท็บ — `detail` คือหน้าเปล่า (ไม่มี suffix) */
export function unitTabPath(jobId: string, tab: UnitRequestTabId): string {
  const base = `/jobs/siamraj/${encodeURIComponent(jobId)}`;
  return tab === 'detail' ? base : `${base}/${tab}`;
}

export type UnitRequestTabsProps = {
  jobId: string;
  active: UnitRequestTabId;
  /** ยอดต่อแท็บ — undefined = ยังโหลดไม่เสร็จ (ไม่โชว์เลขมั่ว) */
  counts?: Partial<Record<UnitRequestTabId, number>>;
};

const UnitRequestTabs: React.FC<UnitRequestTabsProps> = ({ jobId, active, counts }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap gap-1 border-b-2 border-border/70" role="tablist">
      {UNIT_TAB_IDS.map((id) => {
        const n = counts?.[id];
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => active !== id && navigate(unitTabPath(jobId, id))}
            className={cn(
              '-mb-0.5 border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors',
              active === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {TAB_LABEL[id]}
            {typeof n === 'number' ? (
              <span className="ml-1 font-mono text-xs tabular-nums opacity-80">({n})</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export default UnitRequestTabs;
