import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * แท็บของใบขอ (เจ้าของสั่ง 16 ส.ค. 2569 เย็น: *"กดเข้าไปที่ใบงานจะเจอรายละเอียดงาน
 * มีหน้าผู้สมัคร และหน้า AI Match และหน้าการติดต่อ"*)
 *
 * แยก 4 แท็บเพราะตอบคนละคำถาม:
 *   รายละเอียด — งานนี้คืออะไร
 *   ผู้สมัคร    — ใครสมัครเข้ามาบ้าง (ของจริงที่มีใบสมัครแล้ว)
 *   AI Match   — AI แนะนำใครบ้าง (ยังไม่ใช่ใบสมัคร)
 *   การติดต่อ   — ใครถูกโทรไปแล้ว ผลเป็นยังไง
 *
 * 🔴 **ห้ามเพิ่มแท็บ "ประกาศ / ลิงก์สมัคร" กลับมาที่นี่** (เจ้าของสั่ง 27 ส.ค. 2569)
 * ผมเคยเอามาแปะไว้ที่นี่หนึ่งรอบ แล้วโดนว่า:
 * *"หน้าใบงานกดเข้าไปต้องเจอแค่ รายละเอียดงาน ผู้สมัคร AI match การติดต่อ ·
 *  ประกาศ/ลิงก์สมัคร ต้องอยู่กล่องงานสิ ทำไมไม่เข้าใจ"*
 * ⇒ งานประกาศ/ลิงก์เป็น **งานของกล่องงาน** (หน้านั้นมีหน้าที่ปล่อยประกาศ)
 * อยู่ที่ `/jobs/board/:id/posting` (`BoardPostingPage`) · ใบงานตอบแค่ "ใบนี้คืออะไร ใครสมัคร"
 *
 * ⚠️ navigate จริง ไม่ใช่ซ่อน/โชว์ — คนต้องส่งลิงก์แท็บที่ตัวเองดูอยู่ให้กันได้
 */
export const UNIT_TAB_IDS = ['detail', 'applicants', 'ai-match', 'contact'] as const;
export type UnitRequestTabId = (typeof UNIT_TAB_IDS)[number];

const TAB_LABEL: Record<UnitRequestTabId, string> = {
  detail: 'รายละเอียดงาน',
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
