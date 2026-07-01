import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  fetchUnitNoteHistory,
  saveUnitRequestNote,
  unitRequestNoteKey,
} from '@/lib/siamrajUnitRequestsApi';

type Props = {
  requestKey: string;
  initialNote?: string;
  compact?: boolean;
  readOnly?: boolean;
  onSaved?: (note: string) => void;
};

const UnitRequestNoteField: React.FC<Props> = ({
  requestKey,
  initialNote = '',
  compact,
  readOnly = false,
  onSaved,
}) => {
  const [value, setValue] = useState(initialNote);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(initialNote);
  const listId = `unit-note-${requestKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  useEffect(() => {
    setValue(initialNote);
    lastSaved.current = initialNote;
  }, [initialNote, requestKey]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const items = await fetchUnitNoteHistory();
      if (!cancelled) setSuggestions(items);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (next: string) => {
      if (readOnly) return;
      const trimmed = next.trim();
      if (trimmed === lastSaved.current.trim()) return;

      setSaving(true);
      setError(null);
      try {
        await saveUnitRequestNote(requestKey, trimmed);
        lastSaved.current = trimmed;
        onSaved?.(trimmed);
        const items = await fetchUnitNoteHistory();
        setSuggestions(items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'บันทึกหมายเหตุไม่สำเร็จ');
      } finally {
        setSaving(false);
      }
    },
    [onSaved, readOnly, requestKey],
  );

  return (
    <div
      className={cn('min-w-0', compact ? 'max-w-[220px]' : 'w-full')}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        list={listId}
        value={value}
        placeholder={readOnly ? '—' : 'หมายเหตุ...'}
        disabled={saving || readOnly}
        readOnly={readOnly}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void persist(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          'jarvis-soft-field w-full text-xs',
          saving && 'opacity-60',
          error && 'border-destructive/50',
        )}
        aria-label="หมายเหตุใบขอ"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {error ? <p className="text-[10px] text-destructive mt-0.5">{error}</p> : null}
    </div>
  );
};

export function UnitRequestNoteCell({
  job,
  compact,
  onSaved,
}: {
  job: { request_no?: string; externalId?: string; id: string; list_note?: string };
  compact?: boolean;
  onSaved?: (note: string) => void;
}) {
  const { hasPermission } = useAuth();
  const readOnly = !hasPermission('supervisor');
  const key = unitRequestNoteKey(job as Parameters<typeof unitRequestNoteKey>[0]);
  const initial = job.list_note ?? '';
  return (
    <UnitRequestNoteField
      requestKey={key}
      initialNote={initial}
      compact={compact}
      readOnly={readOnly}
      onSaved={onSaved}
    />
  );
}

export default UnitRequestNoteField;
