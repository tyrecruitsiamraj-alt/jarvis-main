import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { formatCountdown, shortTime } from '@/lib/dateTh';
import {
  recordCallResult,
  releaseCallHold,
  CALL_RESULT_LABEL,
  CALL_RESULT_DESTINATION,
  type CallHold,
  type CallResultOutcome,
  type CallResultScope,
} from '@/lib/callHoldsApi';
import { PhoneCall } from 'lucide-react';

// ─── "รับไปโทรเอง" — ล็อกสิทธิ์โทร กันเจ้าหน้าที่โทรชนกัน + กัน AI โทรทับ ──────

/** ผลโทร → โทนสีตามความหมาย (ห้ามเขียนสีสดในหน้า — ดู designTokens) */
const CALL_RESULT_TONE: Record<CallResultOutcome, ToneKey> = {
  confirmed: 'success',
  declined: 'danger',
  reschedule_requested: 'warn',
  no_answer: 'neutral',
  wrong_person: 'neutral',
};

const CALL_RESULT_ORDER: CallResultOutcome[] = [
  'confirmed',
  'declined',
  'reschedule_requested',
  'no_answer',
  'wrong_person',
];

/**
 * แผงโทร — กางในการ์ดเดิม ไม่เปลี่ยนหน้า (mockup ที่เจ้าของเคาะ 6 ส.ค. 2569)
 *
 * ผลโทรใช้ศัพท์ชุดเดียวกับที่ Lumos ส่งกลับ → funnel นับ "ผลจากคน" รวมกับ "ผลจาก AI" ได้
 * "ไม่สนใจ" **บังคับเลือก 2 แบบ** เพราะผลต่างกันมาก:
 *   ไม่สนใจงานนี้ → AI ยังเสนองานอื่นให้เขาได้ · ไม่หางานแล้ว → ต้องพักเบอร์ ห้ามโทรอีก
 */
export default function CallHoldPanel({
  hold,
  phone,
  now,
  onFinished,
}: {
  hold: CallHold;
  phone: string | null;
  now: number;
  /** ปล่อย/บันทึกผลเสร็จ — ให้หน้าเอา hold ออกจาก state การ์ดจะกลับเป็น "ว่าง" */
  onFinished: (candidateRef: string) => void;
}) {
  const [outcome, setOutcome] = useState<CallResultOutcome | null>(null);
  const [scope, setScope] = useState<CallResultScope | null>(null);
  const [note, setNote] = useState('');
  const [agreedSalary, setAgreedSalary] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const msLeft = new Date(hold.expiresAt).getTime() - now;

  const pick = (next: CallResultOutcome) => {
    setOutcome(next);
    setError(null);
    if (next !== 'declined') setScope(null);
  };

  const save = async () => {
    if (!outcome || busy) return;
    if (outcome === 'declined' && !scope) {
      setError('เลือกก่อนว่า “ไม่สนใจงานนี้” หรือ “ไม่หางานแล้ว”');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const detail: Record<string, unknown> = {};
      if (outcome === 'confirmed' && agreedSalary.trim()) detail.agreedSalary = agreedSalary.trim();
      if (outcome === 'reschedule_requested' && callbackAt) detail.callbackAt = callbackAt;
      if (outcome === 'wrong_person' && newPhone.trim()) detail.newPhone = newPhone.trim();
      await recordCallResult({
        holdId: hold.id,
        outcome,
        scope: outcome === 'declined' ? (scope ?? 'job') : undefined,
        note: note.trim() || null,
        detail: Object.keys(detail).length > 0 ? detail : undefined,
      });
      onFinished(hold.candidateRef);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกผลโทรไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const release = async (reason: 'manual' | 'to_ai') => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await releaseCallHold(hold.id, reason);
      onFinished(hold.candidateRef);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'คืนงานไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('mt-2 space-y-2 rounded-xl border px-3 py-2.5', TONE.primary.soft)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
        <span className={cn('font-semibold', TONE.primary.value)}>
          คุณถืออยู่ · รับเมื่อ {shortTime(hold.heldAt)}
        </span>
        <span className={DASH.muted}>
          ล็อก 1 วัน · คายอีก{' '}
          <span className="font-mono font-bold tabular-nums">{formatCountdown(msLeft)}</span>
        </span>
      </div>

      {phone ? (
        <div className={cn('flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2', TONE.neutral.soft)}>
          <a
            href={`tel:${phone}`}
            className={cn('flex-1 font-mono text-base font-bold tabular-nums', TONE.primary.value)}
          >
            {phone}
          </a>
          <a
            href={`tel:${phone}`}
            className={cn('rounded-full px-3 py-1 text-[11px] font-bold', TONE.primary.solid)}
          >
            โทร
          </a>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p className={cn('text-[10px] font-bold uppercase tracking-wider', DASH.muted)}>
          โทรเสร็จแล้ว กดผล
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CALL_RESULT_ORDER.map((key) => {
            const tone = TONE[CALL_RESULT_TONE[key]];
            const active = outcome === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => pick(key)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  active ? cn(tone.soft, tone.value, 'ring-2 ring-ring') : cn(tone.soft, tone.value, tone.softHover),
                )}
              >
                {CALL_RESULT_LABEL[key]}
              </button>
            );
          })}
        </div>
      </div>

      {outcome ? (
        <div className={cn('space-y-2 rounded-lg border px-2.5 py-2 text-[11px]', TONE.neutral.soft)}>
          <p className={DASH.muted}>ผลนี้จะไปต่อที่: {CALL_RESULT_DESTINATION[outcome]}</p>

          {outcome === 'declined' ? (
            <div className="space-y-1">
              {(
                [
                  ['job', 'ไม่สนใจงานนี้', 'AI ยังเสนองานอื่นให้เขาได้'],
                  ['all', 'ไม่หางานแล้ว', 'พักเบอร์นี้ ไม่โทรอีก — ดับทุกใบที่เขาแมท'],
                ] as Array<[CallResultScope, string, string]>
              ).map(([value, label, hint]) => (
                <label key={value} className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name={`declined-scope-${hold.id}`}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-sky-600"
                  />
                  <span>
                    <span className={cn('font-semibold', DASH.cellStrong)}>{label}</span>
                    <span className={cn('ml-1', DASH.muted)}>— {hint}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          {outcome === 'confirmed' ? (
            <input
              type="text"
              value={agreedSalary}
              onChange={(e) => setAgreedSalary(e.target.value)}
              placeholder="ค่าจ้างที่ตกลงได้ (ถ้ามี)"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          ) : null}

          {outcome === 'reschedule_requested' ? (
            <div className="space-y-1">
              <input
                type="datetime-local"
                value={callbackAt}
                onChange={(e) => setCallbackAt(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <p className={DASH.muted}>เว้นว่างได้ — ถ้าไม่ระบุจะถือว่าให้นัดใหม่ตามค่าเริ่มต้น</p>
            </div>
          ) : null}

          {outcome === 'wrong_person' ? (
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="เบอร์ใหม่ (ถ้าได้มา)"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          ) : null}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="โน้ตเพิ่มเติม (ถ้ามี)"
            className="min-h-[44px] w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      ) : null}

      {error ? <p className={cn('text-[11px]', TONE.danger.value)}>{error}</p> : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !outcome}
          className={cn(
            'rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-50',
            TONE.primary.solid,
          )}
        >
          {busy ? 'กำลังบันทึก…' : 'บันทึกผล'}
        </button>
        <button
          type="button"
          onClick={() => void release('manual')}
          disabled={busy}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50',
            TONE.neutral.soft,
            TONE.neutral.value,
            TONE.neutral.softHover,
          )}
        >
          คืนงาน
        </button>
        <button
          type="button"
          onClick={() => void release('to_ai')}
          disabled={busy}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50',
            TONE.info.soft,
            TONE.info.value,
            TONE.info.softHover,
          )}
        >
          คืนให้ AI โทรต่อ
        </button>
      </div>
    </div>
  );
}

