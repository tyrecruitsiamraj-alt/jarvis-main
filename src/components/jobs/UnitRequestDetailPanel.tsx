/**
 * แถบรายละเอียดใบขอที่ "กดลงมาค่อยเห็น" (เจ้าของสั่ง 25 ส.ค. 2569)
 *
 * 🔴 ไฟล์นี้แค่**วาด** — ว่าช่องไหนมีค่า/ไม่มีค่า/เป็นเงินเท่าไหร่ ตัดสินที่
 * `src/lib/unitRequestDetail.ts` (pure + เทสต์) ที่เดียว
 * 🔴 "ไม่มีข้อมูล" ต้องดูต่างจากตัวเลขจริงชัดเจน — ไม่ใช่ขีดจาง ๆ ที่อ่านเป็น 0 ได้
 */
import * as React from 'react';

import { DASH } from '@/lib/designTokens';
import {
  buildUnitRequestDetail,
  detailValueText,
  type DetailValue,
} from '@/lib/unitRequestDetail';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';

const ValueText: React.FC<{ value: DetailValue }> = ({ value }) => {
  const txt = detailValueText(value);
  if (value.kind === 'unknown') {
    return <span className={cn('text-xs italic', DASH.cellMuted)}>{txt}</span>;
  }
  return (
    <span
      className={cn(
        'text-xs',
        value.kind === 'money' ? cn('font-mono tabular-nums', DASH.cellStrong) : DASH.cell,
      )}
    >
      {txt}
    </span>
  );
};

export type UnitRequestDetailPanelProps = {
  job: JobRequest;
  className?: string;
};

export const UnitRequestDetailPanel: React.FC<UnitRequestDetailPanelProps> = ({
  job,
  className,
}) => {
  const groups = React.useMemo(() => buildUnitRequestDetail(job), [job]);

  if (groups.length === 0) {
    return (
      <p className={cn('py-3 text-xs', DASH.cellMuted, className)}>
        ใบขอนี้ยังไม่มีรายละเอียดเพิ่มเติมใน ERP
      </p>
    );
  }

  return (
    <div className={cn('grid gap-4 py-1 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {groups.map((g) => (
        <div key={g.key} className="min-w-0">
          <p className={cn('mb-1.5 text-[11px] font-semibold', DASH.muted)}>{g.title}</p>
          <dl className="space-y-1">
            {g.items.map((it) => (
              <div key={it.key} className="flex items-baseline justify-between gap-3">
                <dt className={cn('shrink-0 text-xs', DASH.cellMuted)}>{it.label}</dt>
                <dd className="min-w-0 text-right">
                  <ValueText value={it.value} />
                  {it.hint && it.value.kind !== 'unknown' ? (
                    <span className={cn('block text-[10px]', DASH.muted)}>{it.hint}</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
};

export default UnitRequestDetailPanel;
