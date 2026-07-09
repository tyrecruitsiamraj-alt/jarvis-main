import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { cn } from '@/lib/utils';
import {
  fetchUnitNoteHistory,
  saveUnitRequestNote,
  unitRequestNoteKey,
} from '@/lib/siamrajUnitRequestsApi';

type BaseProps = {
  requestKey: string;
  initialNote?: string;
  readOnly?: boolean;
  onSaved?: (note: string) => void;
};

const UnitRequestNoteEditor: React.FC<BaseProps> = ({
  requestKey,
  initialNote = '',
  readOnly = false,
  onSaved,
}) => {
  const [value, setValue] = useState(initialNote);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const lastSaved = useRef(initialNote);

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

  const dirty = value.trim() !== lastSaved.current.trim();

  const persist = useCallback(async () => {
    if (readOnly || saving) return;
    const trimmed = value.trim();
    if (trimmed === lastSaved.current.trim()) return;

    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await saveUnitRequestNote(requestKey.trim(), trimmed);
      lastSaved.current = trimmed;
      onSaved?.(trimmed);
      setSavedMsg('บันทึกหมายเหตุแล้ว');
      const items = await fetchUnitNoteHistory();
      setSuggestions(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกหมายเหตุไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }, [onSaved, readOnly, requestKey, saving, value]);

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        placeholder={readOnly ? '—' : 'พิมพ์หมายเหตุ…'}
        disabled={saving || readOnly}
        readOnly={readOnly}
        rows={4}
        onChange={(e) => {
          setValue(e.target.value);
          setSavedMsg(null);
        }}
        className={cn(
          'jarvis-soft-field w-full text-sm min-h-[96px] resize-y',
          saving && 'opacity-60',
          error && 'border-destructive/50',
        )}
        aria-label="หมายเหตุใบขอ"
      />
      {suggestions.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          หมายเหตุที่เคยใช้: {suggestions.slice(0, 5).join(' · ')}
        </p>
      ) : null}
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void persist()}
            disabled={saving || !dirty}
            className="jarvis-pill-btn text-sm px-4 py-2 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกหมายเหตุ'}
          </button>
          {savedMsg ? <span className="text-xs text-muted-foreground">{savedMsg}</span> : null}
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">ไม่มีสิทธิ์แก้ไขหมายเหตุ — ติดต่อ Admin หรือดูที่ Settings → Role</p>
      )}
    </div>
  );
};

export function UnitRequestNotePreview({ note }: { note?: string | null }) {
  const trimmed = (note || '').trim();
  if (!trimmed) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="text-xs text-foreground line-clamp-2" title={trimmed}>
      {trimmed}
    </span>
  );
}

export function UnitRequestNoteDetail({
  job,
  onSaved,
}: {
  job: { request_no?: string; externalId?: string; id: string; list_note?: string };
  onSaved?: (note: string) => void;
}) {
  const { isFunctionEnabled } = useRolePermissions();
  const readOnly = !isFunctionEnabled('unit_notes_edit');
  const key = unitRequestNoteKey(job as Parameters<typeof unitRequestNoteKey>[0]);
  return (
    <UnitRequestNoteEditor
      requestKey={key}
      initialNote={job.list_note ?? ''}
      readOnly={readOnly}
      onSaved={onSaved}
    />
  );
}

export default UnitRequestNoteEditor;
