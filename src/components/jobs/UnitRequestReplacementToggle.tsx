import React, { useCallback, useEffect, useState } from 'react';
import type { JobRequest } from '@/types';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { saveUnitRequestMeta } from '@/lib/siamrajUnitRequestsApi';
import { unitRequestNoteKey } from '@/lib/siamrajUnitRequestsApi';
import { cn } from '@/lib/utils';
import UnitRequestReplacementBadge from '@/components/jobs/UnitRequestReplacementBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** ค่าที่แทน "ยังไม่ระบุ" ใน Select — Radix ห้าม value ว่าง */
const UNSET = '__unset__';

type Props = {
  job: JobRequest;
  onSaved?: (sendReplacement: boolean | null) => void;
  compact?: boolean;
  readOnly?: boolean;
};

const UnitRequestReplacementToggle: React.FC<Props> = ({ job, onSaved, compact, readOnly }) => {
  const [value, setValue] = useState<boolean | null | undefined>(job.send_replacement);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(job.send_replacement);
  }, [job.id, job.send_replacement]);

  const persist = useCallback(
    async (next: boolean | null) => {
      const key = unitRequestNoteKey(job);
      if (!key) return;
      setSaving(true);
      try {
        await saveUnitRequestMeta(key, { send_replacement: next });
        setValue(next);
        onSaved?.(next);
      } catch {
        /* keep prior */
      } finally {
        setSaving(false);
      }
    },
    [job, onSaved],
  );

  const yes = value === true;
  const no = value === false;

  if (readOnly) {
    return <UnitRequestReplacementBadge value={value} compact={compact} />;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', compact ? 'text-[10px]' : 'text-sm')}>
      <button
        type="button"
        disabled={saving}
        title={yes ? 'กดซ้ำเพื่อล้างค่ากลับเป็น —' : undefined}
        onClick={() => void persist(yes ? null : true)}
        className={cn(
          'px-3 py-2 rounded-full border font-medium transition-colors disabled:opacity-50',
          yes
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-white/60 text-muted-foreground border-border/60 hover:border-primary/40',
        )}
      >
        ส่งคนแทน
      </button>
      <button
        type="button"
        disabled={saving}
        title={no ? 'กดซ้ำเพื่อล้างค่ากลับเป็น —' : undefined}
        onClick={() => void persist(no ? null : false)}
        className={cn(
          'px-3 py-2 rounded-full border font-medium transition-colors disabled:opacity-50',
          no
            ? 'bg-secondary text-foreground border-border'
            : 'bg-white/60 text-muted-foreground border-border/60 hover:border-border',
        )}
      >
        ไม่ส่งคนแทน
      </button>
    </div>
  );
};

export function UnitRequestReplacementDetail({
  job,
  onSaved,
}: {
  job: JobRequest;
  onSaved?: (sendReplacement: boolean | null) => void;
}) {
  const { isFunctionEnabled } = useRolePermissions();
  const readOnly = !isFunctionEnabled('unit_notes_edit');

  return (
    <div className="space-y-2">
      <UnitRequestReplacementToggle job={job} onSaved={onSaved} readOnly={readOnly} />
      {readOnly ? (
        <p className="text-xs text-muted-foreground">
          ไม่มีสิทธิ์แก้ไข — ติดต่อ Admin หรือดูที่ Settings → Role
        </p>
      ) : null}
    </div>
  );
}

/**
 * ส่งคนแทน แบบ **dropdown** — เจ้าของสั่ง 25 ส.ค. 2569 ให้สามกล่องบนหน้าใบขอ
 * (ราชการ/เอกชน · ส่งคนแทน · สถานะทำงาน) อยู่แถวเดียวกันและ **หน้าตาเหมือนกัน**
 *
 * 🔴 ยังเป็นสามค่าเหมือนปุ่มเดิม: ยังไม่ระบุ (`null`) / ส่งคนแทน (`true`) / ไม่ส่งคนแทน (`false`)
 * **ห้ามยุบ "ยังไม่ระบุ" ทิ้ง** — ใบที่ยังไม่มีใครตัดสินใจต้องต่างจาก "ไม่ส่งคนแทน"
 * (ปุ่มเดิมล้างค่าได้ด้วยการกดซ้ำ · dropdown ต้องมีตัวเลือกนี้ให้ชัดแทน)
 */
export function UnitRequestReplacementSelect({
  job,
  onSaved,
  className,
}: {
  job: JobRequest;
  onSaved?: (sendReplacement: boolean | null) => void;
  className?: string;
}) {
  const { isFunctionEnabled } = useRolePermissions();
  const readOnly = !isFunctionEnabled('unit_notes_edit');
  const [value, setValue] = useState<boolean | null | undefined>(job.send_replacement);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(job.send_replacement);
  }, [job.id, job.send_replacement]);

  const current = value === true ? 'yes' : value === false ? 'no' : UNSET;

  const persist = async (next: boolean | null) => {
    const key = unitRequestNoteKey(job);
    if (!key) return;
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      await saveUnitRequestMeta(key, { send_replacement: next });
      onSaved?.(next);
    } catch {
      // ล้มแล้วถอยกลับค่าเดิม — ห้ามให้จอโกหกว่าบันทึกแล้ว
      setValue(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select
      value={current}
      disabled={readOnly || saving}
      onValueChange={(v) => void persist(v === UNSET ? null : v === 'yes')}
    >
      <SelectTrigger className={cn('w-full', className)} aria-label="ส่งคนแทนหรือไม่">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>ยังไม่ระบุ</SelectItem>
        <SelectItem value="yes">ส่งคนแทน</SelectItem>
        <SelectItem value="no">ไม่ส่งคนแทน</SelectItem>
      </SelectContent>
    </Select>
  );
}

export default UnitRequestReplacementToggle;
