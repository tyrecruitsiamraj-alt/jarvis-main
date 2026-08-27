import React, { useState } from 'react';
import { Link2, Pencil } from 'lucide-react';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import {
  SILENT_PREVIEW_ROWS,
  silentRowFactLine,
  silentRowNextStep,
  type SilentLinkRow,
} from '@/lib/jobLinkSilence';
import { DASH, TONE } from '@/lib/designTokens';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * แถบ "ลิงก์ที่ปล่อยแล้วยังไม่มีใบสมัคร" — ของใหม่ชิ้นเดียวของการรื้อหน้าบอร์ด 21 ส.ค. 2569
 *
 * 🔴 **ซ่อนตัวเองเมื่อไม่มีของ** (แพตเทิร์นเดียวกับ MyCallsSection) — วันที่ทีมไม่มีลิงก์เงียบ
 * หน้าจะกลับไปเหมือนเดิมเป๊ะ ไม่มีกรอบเปล่าค้างไว้ให้รก
 *
 * 🔴 **ไม่ใช่คำเตือน** — เป็นรายการงานที่ "ลงแรงไปแล้วแต่ยังไม่ได้ผล"
 * จึงใช้พื้น `TONE.info.soft` ห้ามแดง/ส้ม และห้าม `TONE.*.solid`
 *
 * 🔴 **ไม่ใช่ Dialog และไม่เปิด Dialog** — เป็นบล็อกในหน้า · ปุ่ม**พาไปหน้าใบขอ**
 * ด้วย `onOpen(job, target)` (เจ้าของสั่ง 27 ส.ค. 2569: *"ไม่เอาแบบ Popup เด้งนะ"*)
 *
 * ⚠️ staff เท่านั้น — ผู้เรียกต้องกั้น `isStaff` เอง (component นี้อยู่ในไฟล์ที่ /apply ใช้ร่วม)
 */
const ICON = { genlink: Link2, edit: Pencil } as const;

const JobBoardSilentLinks: React.FC<{
  rows: SilentLinkRow[];
  /** พาไปหน้าใบขอ — `'detail'` = รายละเอียด · `'posting'` = ประกาศ / ลิงก์สมัคร */
  onOpen: (job: JobRequest, target: 'detail' | 'posting') => void;
}> = ({ rows, onOpen }) => {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;

  const shown = expanded ? rows : rows.slice(0, SILENT_PREVIEW_ROWS);
  const hidden = rows.length - shown.length;

  return (
    <div className={cn('mt-3 space-y-1.5 rounded-xl border border-border/60 px-3 py-2', TONE.info.soft)}>
      <p className={DASH.eyebrow}>
        ลิงก์ที่ปล่อยแล้วยังไม่มีใบสมัคร — {rows.length.toLocaleString('th-TH')} ใบ
      </p>

      <ul className="space-y-1">
        {shown.map((row) => {
          const next = silentRowNextStep(row);
          const Icon = ICON[next.action];
          return (
            <li key={row.job.id}>
              {/* กดที่แถว = เปิดป๊อปขั้น "รายละเอียดงาน" · กดปุ่ม = ข้ามไปขั้นที่ควรทำ */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpen(row.job, 'detail')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(row.job, 'detail');
                  }
                }}
                className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1.5 py-1 text-left hover:bg-background/60"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                  {jobBoardCardTitle(row.job)} · {publicJobPositionLabel(row.job)}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {silentRowFactLine(row)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(row.job, 'posting');
                  }}
                  className={cn(
                    'h-7 shrink-0 rounded-lg px-2 text-[11px]',
                    next.action === 'genlink' ? TONE.violet.outline : TONE.neutral.outline,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {next.label}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {hidden > 0 ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setExpanded(true)}
          className="h-auto p-0 text-[11px]"
        >
          ดูอีก {hidden.toLocaleString('th-TH')} ใบ
        </Button>
      ) : null}
    </div>
  );
};

export default JobBoardSilentLinks;
