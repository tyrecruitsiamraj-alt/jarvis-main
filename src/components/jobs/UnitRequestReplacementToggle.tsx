import React, { useCallback, useEffect, useState } from 'react';
import type { JobRequest } from '@/types';
import { saveUnitRequestMeta } from '@/lib/siamrajUnitRequestsApi';
import { unitRequestNoteKey } from '@/lib/siamrajUnitRequestsApi';
import { cn } from '@/lib/utils';

type Props = {
  job: JobRequest;
  onSaved?: (sendReplacement: boolean | null) => void;
  compact?: boolean;
};

const UnitRequestReplacementToggle: React.FC<Props> = ({ job, onSaved, compact }) => {
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

  return (
    <div
      className={cn('flex flex-wrap gap-1', compact ? 'text-[10px]' : 'text-xs')}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="group"
      aria-label="ส่งคนแทน"
    >
      <button
        type="button"
        disabled={saving}
        onClick={() => void persist(true)}
        className={cn(
          'px-2 py-1 rounded-full border font-medium transition-colors disabled:opacity-50',
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
          'px-2 py-1 rounded-full border font-medium transition-colors disabled:opacity-50',
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

export default UnitRequestReplacementToggle;
