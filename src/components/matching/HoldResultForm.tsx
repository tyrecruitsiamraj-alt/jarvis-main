/**
 * ฟอร์มลงผลโทรของคนที่เก็บไปโทรเอง (ล็อก call hold) — หน้าการติดต่อของจับคู่งาน (20 ต.ค. 2569)
 * กติกาเดียวกับฟอร์มเดิมใน `MyCallsSection`: ผล 5 แบบ · สนใจ/ไม่สนใจต้องเลือกขอบเขต ·
 * นัดได้เลยต้องมีวันนัด (`resolveAppointment` ตัวเดียวกับ server) · คืนให้ AI / คืนเข้าถังกลาง
 * ทุกปุ่มจาก shadcn · ไม่ซ้อน Dialog (ผู้เรียกวางไว้ใน Dialog ของตัวเอง)
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import DateSelectDmyBe from '@/components/shared/DateSelectDmyBe';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { CONFIRMED_SCOPE_HINT, CONFIRMED_SCOPE_LABEL, CONFIRMED_SCOPES, resolveAppointment } from '@/lib/callAppointment';
import {
  CALL_RESULT_DESTINATION,
  CALL_RESULT_LABEL,
  CALL_RESULT_OUTCOMES,
  recordCallResult,
  releaseCallHold,
  type CallResultOutcome,
  type CallResultScope,
} from '@/lib/callHoldsApi';

const DECLINED_SCOPES: Array<[CallResultScope, string, string]> = [
  ['job', 'ไม่สนใจงานนี้', 'AI ยังเสนองานอื่นให้ได้'],
  ['all', 'ไม่หางานแล้ว', 'พักเบอร์นี้ ไม่โทรอีกทุกใบ'],
];

const HoldResultForm: React.FC<{
  holdId: string;
  onSaved: (outcome: CallResultOutcome) => void;
  onReleased: (reason: 'manual' | 'to_ai') => void;
  onCancel: () => void;
}> = ({ holdId, onSaved, onReleased, onCancel }) => {
  const [outcome, setOutcome] = useState<CallResultOutcome | null>(null);
  const [scope, setScope] = useState<CallResultScope | null>(null);
  const [appointmentAt, setAppointmentAt] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (key: CallResultOutcome) => {
    // สลับผลต้องล้างขอบเขต — ชุดของสนใจกับไม่สนใจเป็นคนละชุด (กันค่าค้างข้ามชุด)
    if (key !== outcome) setScope(null);
    setOutcome(key);
    if (key !== 'confirmed') setAppointmentAt('');
    setError(null);
  };

  const submit = async () => {
    if (!outcome || busy) return;
    if (outcome === 'declined' && !scope) return setError('เลือกก่อนว่า “ไม่สนใจงานนี้” หรือ “ไม่หางานแล้ว”');
    if (outcome === 'confirmed' && !scope) return setError('เลือกก่อนว่า “นัดได้เลย” หรือ “สนใจ แต่ยังนัดไม่ได้”');
    const decided = resolveAppointment({ outcome, scope, appointmentAt, now: new Date().toISOString() });
    if (!decided.ok) return setError(decided.reason);
    setBusy(true);
    setError(null);
    try {
      await recordCallResult({
        holdId,
        outcome,
        scope: decided.scope ?? undefined,
        appointmentAt: decided.appointmentAt,
        note: note.trim() || null,
      });
      onSaved(outcome);
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
      await releaseCallHold(holdId, reason);
      onReleased(reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'คืนงานไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">ผลโทร</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="ผลโทร">
          {CALL_RESULT_OUTCOMES.map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={outcome === key ? 'default' : 'outline'}
              aria-pressed={outcome === key}
              onClick={() => pick(key)}
            >
              {CALL_RESULT_LABEL[key]}
            </Button>
          ))}
        </div>
        {outcome ? <p className="text-xs text-muted-foreground">ไปต่อที่ {CALL_RESULT_DESTINATION[outcome]}</p> : null}
      </div>

      {outcome === 'confirmed' ? (
        <div className="space-y-3">
          <RadioGroup
            value={scope ?? ''}
            onValueChange={(v) => {
              setScope(v as CallResultScope);
              if (v === 'unscheduled') setAppointmentAt('');
              setError(null);
            }}
            className="gap-2"
          >
            {CONFIRMED_SCOPES.map((value) => (
              <div key={value} className="flex items-start gap-2">
                <RadioGroupItem value={value} id={`confirm-${holdId}-${value}`} className="mt-0.5" />
                <Label htmlFor={`confirm-${holdId}-${value}`} className="space-y-1 font-normal">
                  <span className="block text-sm font-medium text-foreground">{CONFIRMED_SCOPE_LABEL[value]}</span>
                  <span className="block text-xs text-muted-foreground">{CONFIRMED_SCOPE_HINT[value]}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          {scope === 'scheduled' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">วันนัดสัมภาษณ์</span>
              <DateSelectDmyBe
                value={appointmentAt}
                onChange={(v) => {
                  setAppointmentAt(v);
                  setError(null);
                }}
                allowEmpty
                ariaLabel="วันนัดสัมภาษณ์"
                className="w-40"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {outcome === 'declined' ? (
        <RadioGroup value={scope ?? ''} onValueChange={(v) => setScope(v as CallResultScope)} className="gap-2">
          {DECLINED_SCOPES.map(([value, label, hint]) => (
            <div key={value} className="flex items-start gap-2">
              <RadioGroupItem value={value} id={`scope-${holdId}-${value}`} className="mt-0.5" />
              <Label htmlFor={`scope-${holdId}-${value}`} className="space-y-1 font-normal">
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      ) : null}

      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="โน้ต (ถ้ามี)" rows={2} />

      {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void submit()} disabled={busy || !outcome}>
          {busy ? 'กำลังบันทึก…' : 'บันทึกผล'}
        </Button>
        <Button type="button" variant="outline" onClick={() => void release('to_ai')} disabled={busy}>
          คืนให้ AI โทรต่อ
        </Button>
        <Button type="button" variant="outline" onClick={() => void release('manual')} disabled={busy}>
          คืนเข้าถังกลาง
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          ปิด
        </Button>
      </div>
    </div>
  );
};

export default HoldResultForm;
