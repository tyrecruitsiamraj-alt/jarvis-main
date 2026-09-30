import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { saveUnitRequestNote, unitRequestNoteKey } from '@/lib/siamrajUnitRequestsApi';

type BaseProps = {
  requestKey: string;
  initialNote?: string;
  readOnly?: boolean;
  onSaved?: (note: string) => void;
};

/**
 * ═══ ร่างหมายเหตุที่ยังไม่กดบันทึก — จำไว้ **ในเครื่องนี้** เท่านั้น ═══
 *
 * เจ้าของสั่ง 28 ก.ย. 2569: *"หมายเหตุเวลากรอกมันบันทึก Auto อะยังพิมพ์ไม่เสร็จเลย เอาเป็นพิมพ์เสร็จแล้ว
 * กดบันทึกเองดีกว่า"* → Choice "จำร่างไว้ในเครื่อง" (ข้อ "เซฟดราฟต์เอาไว้เสมอ" 22 ก.ย. ยังอยู่ — แค่ไม่ขึ้นฐานเอง)
 * ⇒ **ขึ้นฐานเฉพาะตอนกดปุ่ม "บันทึกหมายเหตุ"** · ปิดป๊อป/สลับขั้นกลางคัน = ข้อความยังอยู่เมื่อเปิดใบเดิมอีกครั้ง
 * ⚠️ เก็บใน localStorage ต่อเครื่องต่อใบ — คนอื่น/เครื่องอื่นไม่เห็นร่าง · เครื่องไม่ให้เก็บ = ใช้ต่อได้แค่ไม่จำร่าง
 */
const DRAFT_PREFIX = 'jarvis:unit-note-draft:';

function readDraft(key: string): string | null {
  if (!key.trim()) return null;
  try {
    return window.localStorage.getItem(DRAFT_PREFIX + key.trim());
  } catch {
    return null;
  }
}

/** `null` = ไม่มีร่างค้าง (ลบทิ้ง) */
function writeDraft(key: string, text: string | null): void {
  if (!key.trim()) return;
  try {
    if (text === null) window.localStorage.removeItem(DRAFT_PREFIX + key.trim());
    else window.localStorage.setItem(DRAFT_PREFIX + key.trim(), text);
  } catch {
    /* เครื่องไม่ให้เก็บ (โหมดส่วนตัว ฯลฯ) — ช่องใช้ต่อได้ แค่ไม่จำร่าง */
  }
}

/** ค่าที่ช่องควรโชว์ตอนเปิด: มีร่างค้างที่ต่างจากที่บันทึกไว้ = ร่าง · ไม่งั้น = ที่บันทึกไว้ */
function openingValue(key: string, saved: string, readOnly: boolean): string {
  if (readOnly) return saved;
  const draft = readDraft(key);
  return draft !== null && draft.trim() !== saved.trim() ? draft : saved;
}

const UnitRequestNoteEditor: React.FC<BaseProps> = ({
  requestKey,
  initialNote = '',
  readOnly = false,
  onSaved,
}) => {
  const [value, setValue] = useState(() => openingValue(requestKey, initialNote, readOnly));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const lastSaved = useRef(initialNote);
  /** ข้อความล่าสุดในช่อง — กดบันทึกแล้วยังพิมพ์ต่อระหว่างรอ ร่างส่วนที่พิมพ์เพิ่มต้องไม่หาย */
  const latestValue = useRef(value);

  useEffect(() => {
    const next = openingValue(requestKey, initialNote, readOnly);
    // ร่างที่เท่ากับของที่บันทึกแล้ว = ไม่ใช่ร่างค้าง → ลบทิ้ง
    if (next === initialNote) writeDraft(requestKey, null);
    setValue(next);
    latestValue.current = next;
    lastSaved.current = initialNote;
  }, [initialNote, requestKey, readOnly]);

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
      // บันทึกแล้ว = ไม่มีร่างค้าง · ยกเว้นพิมพ์เพิ่มระหว่างรอ — ส่วนนั้นยังเป็นร่างอยู่
      const current = latestValue.current;
      writeDraft(requestKey, current.trim() === trimmed ? null : current);
      onSaved?.(trimmed);
      setSavedMsg('บันทึกหมายเหตุแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกหมายเหตุไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }, [onSaved, readOnly, requestKey, saving, value]);

  /** กลับไปเป็นหมายเหตุที่บันทึกไว้ + ทิ้งร่างในเครื่อง */
  const discardDraft = () => {
    setValue(lastSaved.current);
    latestValue.current = lastSaved.current;
    writeDraft(requestKey, null);
    setError(null);
  };

  /*
   * 🔴 ไม่มี auto-save แล้ว (28 ก.ย. 2569) — เดิมหยุดพิมพ์ 1.5 วิ ยิงบันทึกเอง + ปิดป๊อปแล้ว flush
   * (22 ก.ย.) และระหว่างบันทึกช่องถูกล็อก ⇒ เจ้าของพิมพ์ยังไม่จบก็โดนบันทึก/พิมพ์ต่อไม่ได้
   * ⇒ ห้ามเอา timer/flush กลับ — ของค้างเก็บเป็นร่างในเครื่องแทน (มีเทสต์คุม `boardAutoSave`)
   */
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        placeholder={readOnly ? '—' : 'พิมพ์หมายเหตุ…'}
        disabled={readOnly}
        readOnly={readOnly}
        rows={4}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          latestValue.current = next;
          setSavedMsg(null);
          writeDraft(requestKey, next.trim() === lastSaved.current.trim() ? null : next);
        }}
        className={cn(
          'jarvis-soft-field w-full text-sm min-h-[96px] resize-y',
          saving && 'opacity-60',
          error && 'border-destructive/50',
        )}
        aria-label="หมายเหตุใบขอ"
      />
      {/* 🔴 บรรทัด "หมายเหตุที่เคยใช้" ถอดแล้ว (30 ก.ย. 2569 · เจ้าของ: *"ไม่ต้องโชว์สิ"*) — มันดึงหมายเหตุของใบอื่น
          มาโชว์ทั้งก้อน ซึ่งมีชื่อ เบอร์ และอีเมลของผู้สมัครปนอยู่ · เส้น `?history=1` ฝั่ง API ถอดตามไปด้วย ห้ามเอากลับ */}
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm"
            type="button"
            onClick={() => void persist()}
            disabled={saving || !dirty}
            className="text-sm px-4 py-2"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกหมายเหตุ'}
          </Button>
          {/* มีที่พิมพ์ค้าง = บอกให้รู้ว่ายังไม่ขึ้นระบบ (เปิดใบเดิมอีกครั้งร่างยังอยู่) · ยกเลิก = กลับเป็นที่บันทึกไว้ */}
          {dirty && !saving ? (
            <>
              <span className={cn('text-xs font-medium', TONE.warn.value)}>ยังไม่ได้บันทึก</span>
              <Button type="button" variant="ghost" size="xs" onClick={discardDraft}>
                ยกเลิกที่แก้
              </Button>
            </>
          ) : null}
          {savedMsg && !dirty ? <span className="text-xs text-muted-foreground">{savedMsg}</span> : null}
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
