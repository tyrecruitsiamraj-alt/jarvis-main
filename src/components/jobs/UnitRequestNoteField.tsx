import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { isDemoMode } from '@/lib/demoMode';
import {
  fetchUnitNoteHistory,
  saveUnitRequestNote,
  unitRequestNoteKey,
} from '@/lib/siamrajUnitRequestsApi';
import {
  getDemoUnitNote,
  getDemoUnitNoteHistory,
  saveDemoUnitNote,
  UNIT_NOTES_CHANGED_EVENT,
} from '@/lib/unitNotesDemo';

type Props = {
  requestKey: string;
  initialNote?: string;
  compact?: boolean;
  onSaved?: (note: string) => void;
};

const UnitRequestNoteField: React.FC<Props> = ({ requestKey, initialNote = '', compact, onSaved }) => {
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
      const items = isDemoMode() ? getDemoUnitNoteHistory() : await fetchUnitNoteHistory();
      if (!cancelled) setSuggestions(items);
    };
    void load();

    if (!isDemoMode()) return () => { cancelled = true; };

    const onChanged = () => setSuggestions(getDemoUnitNoteHistory());
    window.addEventListener(UNIT_NOTES_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(UNIT_NOTES_CHANGED_EVENT, onChanged);
    };
  }, []);

  const persist = useCallback(
    async (next: string) => {
      const trimmed = next.trim();
      if (trimmed === lastSaved.current.trim()) return;

      setSaving(true);
      setError(null);
      try {
        if (isDemoMode()) {
          saveDemoUnitNote(requestKey, trimmed);
        } else {
          await saveUnitRequestNote(requestKey, trimmed);
        }
        lastSaved.current = trimmed;
        onSaved?.(trimmed);
        if (isDemoMode()) {
          setSuggestions(getDemoUnitNoteHistory());
        } else {
          const items = await fetchUnitNoteHistory();
          setSuggestions(items);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'บันทึกหมายเหตุไม่สำเร็จ');
      } finally {
        setSaving(false);
      }
    },
    [onSaved, requestKey],
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
        placeholder="หมายเหตุ..."
        disabled={saving}
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
  const key = unitRequestNoteKey(job as Parameters<typeof unitRequestNoteKey>[0]);
  const initial = job.list_note ?? (isDemoMode() ? getDemoUnitNote(key) : '');
  return <UnitRequestNoteField requestKey={key} initialNote={initial} compact={compact} onSaved={onSaved} />;
}

export default UnitRequestNoteField;
