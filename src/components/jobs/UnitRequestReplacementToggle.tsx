import React, { useCallback, useEffect, useState } from 'react';
import type { JobRequest } from '@/types';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { saveUnitRequestMeta } from '@/lib/siamrajUnitRequestsApi';
import { unitRequestNoteKey } from '@/lib/siamrajUnitRequestsApi';
import { cn } from '@/lib/utils';
import UnitRequestReplacementBadge from '@/components/jobs/UnitRequestReplacementBadge';

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
    async (next: boolean) => {
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
        onClick={() => void persist(true)}
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
        onClick={() => void persist(false)}
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

export default UnitRequestReplacementToggle;
