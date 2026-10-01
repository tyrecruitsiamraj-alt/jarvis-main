/**
 * ═══ แก้ตารางทั้งชุด — ฝังในกล่องแก้ไขรายการติดตาม (เจ้าของ Choice 1 ต.ค. 2569 "แก้ตารางหลังบันทึกไม่ได้ → แก้") ═══
 *
 * 🔴 ไม่ใช่ Dialog ใหม่ (ห้ามซ้อน Dialog ใน Dialog) — กล่องแก้ไขสลับเนื้อในมาเป็นตัวนี้ (แพตเทิร์น `embedded`)
 * หนึ่งแถว = หนึ่งสาย: วันเวลา · AI โทร/คนโทร · เอาออก · ปุ่มเพิ่มสาย · สายที่โทรไปแล้ว/เลยเวลา = อ่านอย่างเดียว
 * ตรรกะอยู่ `src/lib/followScheduleEdit.ts` · ฝั่ง API ตรวจซ้ำทุกข้อแล้วส่งแผนใหม่ให้ Lumos
 */
import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, LoaderCircle, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import DateTimeField24 from '@/components/shared/DateTimeField24';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { replaceFollowSchedule, type FollowEntry } from '@/lib/followApi';
import { roundTabLabel } from '@/lib/followRoundVisual';
import {
  draftFromRows,
  isEditableFollowRound,
  nextDraftRow,
  scheduleDraftChanged,
  scheduleReplaceBody,
  validateScheduleDraft,
  type ScheduleDraftRow,
} from '@/lib/followScheduleEdit';

const WHEN_FMT = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const byTime = (a: FollowEntry, b: FollowEntry) => Date.parse(a.scheduled_at ?? '') - Date.parse(b.scheduled_at ?? '');

export default function FollowScheduleEditor({
  anchor,
  setRows,
  onBack,
  onSaved,
}: {
  /** แถวที่เปิดกล่องแก้ไขมา — ฝั่ง API ใช้ลอกคน/เรื่อง/ทีมให้สายใหม่ */
  anchor: FollowEntry;
  /** ทุกสายของชุดนี้ที่ยังไม่ยกเลิก (`followSetRows`) */
  setRows: readonly FollowEntry[];
  onBack: () => void;
  onSaved: (message: string) => void;
}) {
  const [openedAt] = useState(() => new Date());
  const editable = useMemo(() => setRows.filter((r) => isEditableFollowRound(r, openedAt)).sort(byTime), [setRows, openedAt]);
  const locked = useMemo(() => setRows.filter((r) => !isEditableFollowRound(r, openedAt)).sort(byTime), [setRows, openedAt]);
  const initial = useMemo(() => draftFromRows(editable), [editable]);
  const [draft, setDraft] = useState<ScheduleDraftRow[]>(initial);
  const newKey = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = validateScheduleDraft(draft, new Date());
  const changed = scheduleDraftChanged(initial, draft);
  const keptIds = new Set(draft.map((d) => d.id).filter(Boolean));
  const removed = editable.filter((e) => !keptIds.has(e.id)).length;
  const aiCount = draft.filter((d) => d.mode === 'ai').length;

  const patch = (key: string, next: Partial<ScheduleDraftRow>) =>
    setDraft((prev) => prev.map((d) => (d.key === key ? { ...d, ...next } : d)));

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const out = await replaceFollowSchedule(anchor.id, scheduleReplaceBody(editable, draft));
      const parts = [`บันทึกตารางแล้ว — เหลือ ${draft.length.toLocaleString('th-TH')} สาย`];
      if (removed > 0) parts.push(`เอาออก ${removed.toLocaleString('th-TH')}`);
      if (aiCount > 0) {
        parts.push(out.lumos.pushed ? 'AI โทรตามเวลาใหม่' : `ยังส่งให้ AI ไม่สำเร็จ (${out.lumos.reason ?? 'ไม่ทราบเหตุ'})`);
      }
      onSaved(parts.join(' · '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกตารางไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      {locked.length > 0 ? (
        <div className="space-y-1">
          <p className="ml-1 text-xs font-medium text-muted-foreground">โทรไปแล้ว / เลยเวลา</p>
          <ul className="space-y-1">
            {locked.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                <span className="tabular-nums">{r.scheduled_at ? WHEN_FMT.format(new Date(r.scheduled_at)) : '—'}</span>
                <span>{r.call_round ? roundTabLabel(r.call_round) : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="ml-1 text-xs font-medium text-foreground">สายที่ยังไม่ถึงเวลา</p>
        {draft.length === 0 ? (
          <p className="ml-1 text-[11px] text-muted-foreground">ไม่เหลือสาย — กดบันทึกแล้วสายที่เหลือของชุดนี้จะถูกยกเลิก</p>
        ) : null}
        {draft.map((d, i) => (
          <div key={d.key} className="space-y-1.5 rounded-xl border border-border/70 p-2.5">
            <div className="flex items-center gap-2">
              <DateTimeField24
                value={d.when}
                onChange={(next) => patch(d.key, { when: next })}
                label={`สายที่ ${i + 1}`}
                className="min-h-[44px] flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDraft((prev) => prev.filter((x) => x.key !== d.key))}
                aria-label={`เอาสายที่ ${i + 1} ออก`}
              >
                <X aria-hidden />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {(['ai', 'manual'] as const).map((mode) => (
                <label key={mode} className="flex cursor-pointer items-center gap-1.5">
                  <Checkbox
                    checked={d.mode === mode}
                    onCheckedChange={() => patch(d.key, { mode })}
                    aria-label={`สายที่ ${i + 1} — ${mode === 'ai' ? 'AI โทร' : 'คนโทร'}`}
                  />
                  <span className={cn('text-xs font-medium', d.mode === mode ? 'text-foreground' : 'text-muted-foreground')}>
                    {mode === 'ai' ? 'AI โทร' : 'คนโทร'}
                  </span>
                </label>
              ))}
            </div>
            {check.errors[d.key] ? <p className={cn('text-[11px]', TONE.danger.value)}>{check.errors[d.key]}</p> : null}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => {
            newKey.current += 1;
            setDraft((prev) => [...prev, nextDraftRow(prev, new Date(), `new-${newKey.current}`)]);
          }}
        >
          <Plus aria-hidden /> เพิ่มสาย
        </Button>
      </div>

      <p className="ml-1 text-[11px] text-muted-foreground">
        รวม {draft.length.toLocaleString('th-TH')} สาย — AI โทร {aiCount.toLocaleString('th-TH')} · เราโทรเอง{' '}
        {(draft.length - aiCount).toLocaleString('th-TH')}
        {removed > 0 ? ` · เอาออก ${removed.toLocaleString('th-TH')}` : ''}
      </p>

      {error ? (
        <p className={cn('rounded-lg px-3 py-2 text-xs', TONE.danger.soft, TONE.danger.value)}>{error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
          <ChevronLeft aria-hidden /> กลับ
        </Button>
        <Button type="button" onClick={() => void save()} disabled={busy || !changed || !check.ok}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          บันทึกตาราง
        </Button>
      </div>
    </div>
  );
}
