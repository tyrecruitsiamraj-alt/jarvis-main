/**
 * ═══ ตั้งค่า › โทรซ้ำคนไม่รับสาย ═══
 * 26 ต.ค. 2569 เดิมเป็นรายการเวลาคงที่ → 27 ต.ค. 2569 เจ้าของเปลี่ยนเป็นโทรซ้ำเป็นรอบ:
 * > *"กรอกมาตอนไหนก็โทรเลย ถ้าไม่รับก็โทรซ้ำ 3 รอบ ถ้าไม่รับก็บวกไปอีก 2 ชม แล้วโทรใหม่ ไม่รับก็โทรซ้ำ 3 สาย
 * > ถ้าไม่รับอีกก็ไปรอโทรวันถัดไป คนละเวลา"* · Choice: เว้น 10 นาที · เช้าสลับบ่าย · โทรแค่ 08:00–20:00
 * ตัวคำนวณเวลา `nextRetryAt` · ช่วงโทรได้ `clampToCallWindow` (src/lib/callFollowupPolicy.ts) · admin แก้
 * ตารางติดตามคนเริ่มงานมีเวลาของตัวเอง ไม่ใช้ค่านี้
 */
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TimeSelect24 from '@/components/shared/TimeSelect24';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_CALL_FOLLOWUP_POLICY, ROUND_LIMITS, totalCallsOf } from '@/lib/callFollowupPolicy';
import { fetchCallFollowupPolicy, saveCallFollowupPolicy, type CallRetryRoundInput } from '@/lib/callFollowupPolicyApi';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

type NumKey = keyof typeof ROUND_LIMITS;
type TimeKey = 'callFrom' | 'callTo' | 'dayMorning' | 'dayAfternoon';
type Form = Record<NumKey | TimeKey, string>;

const NUM_FIELDS: Array<{ key: NumKey; label: string }> = [
  { key: 'roundCalls', label: 'สายต่อรอบ' },
  { key: 'roundGapMinutes', label: 'เว้นระหว่างสาย (นาที)' },
  { key: 'roundsPerDay', label: 'รอบต่อวัน' },
  { key: 'roundsGapHours', label: 'เว้นระหว่างรอบ (ชม.)' },
  { key: 'retryDays', label: 'โทรกี่วัน' },
];
const TIME_FIELDS: Array<{ key: TimeKey; label: string }> = [
  { key: 'callFrom', label: 'เริ่มโทรได้' },
  { key: 'callTo', label: 'โทรได้ถึง' },
  { key: 'dayMorning', label: 'วันถัดไป รอบเช้าเริ่ม' },
  { key: 'dayAfternoon', label: 'วันถัดไป รอบบ่ายเริ่ม' },
];

const toForm = (p: CallRetryRoundInput): Form => ({
  roundCalls: String(p.roundCalls),
  roundGapMinutes: String(p.roundGapMinutes),
  roundsPerDay: String(p.roundsPerDay),
  roundsGapHours: String(p.roundsGapHours),
  retryDays: String(p.retryDays),
  callFrom: p.callFrom,
  callTo: p.callTo,
  dayMorning: p.dayMorning,
  dayAfternoon: p.dayAfternoon,
});

const CallRetryTab: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('admin');
  const [form, setForm] = useState<Form>(() => toForm(DEFAULT_CALL_FOLLOWUP_POLICY));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCallFollowupPolicy()
      .then((p) => {
        if (!alive) return;
        setForm(toForm(p));
        setLoaded(true);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ'));
    return () => {
      alive = false;
    };
  }, []);

  const set = (key: NumKey | TimeKey, v: string) => {
    setForm((cur) => ({ ...cur, [key]: v }));
    setNotice(null);
    setError(null);
  };
  const numOk = (k: NumKey) => {
    const n = Number(form[k]);
    return Number.isInteger(n) && n >= ROUND_LIMITS[k][0] && n <= ROUND_LIMITS[k][1];
  };
  const allNumOk = NUM_FIELDS.every((f) => numOk(f.key));
  const windowOk = form.callTo > form.callFrom;
  const total = allNumOk
    ? totalCallsOf({ roundCalls: Number(form.roundCalls), roundsPerDay: Number(form.roundsPerDay), retryDays: Number(form.retryDays) })
    : null;

  const save = async () => {
    if (saving || !allNumOk || !windowOk) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const saved = await saveCallFollowupPolicy({
        roundCalls: Number(form.roundCalls),
        roundGapMinutes: Number(form.roundGapMinutes),
        roundsPerDay: Number(form.roundsPerDay),
        roundsGapHours: Number(form.roundsGapHours),
        retryDays: Number(form.retryDays),
        callFrom: form.callFrom,
        callTo: form.callTo,
        dayMorning: form.dayMorning,
        dayAfternoon: form.dayAfternoon,
      });
      setForm(toForm(saved));
      setNotice('บันทึกแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="solid" className="max-w-xl space-y-5 p-5" data-testid="call-retry-settings">
      <h3 className="text-lg font-medium text-foreground">โทรซ้ำคนไม่รับสาย</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {NUM_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`retry-${f.key}`}>{f.label}</Label>
            <Input
              id={`retry-${f.key}`}
              type="number"
              inputMode="numeric"
              min={ROUND_LIMITS[f.key][0]}
              max={ROUND_LIMITS[f.key][1]}
              className="w-28 tabular-nums"
              value={form[f.key]}
              disabled={!canEdit || !loaded}
              onChange={(e) => set(f.key, e.target.value)}
              data-testid={`retry-${f.key}`}
            />
            {form[f.key] && !numOk(f.key) ? (
              <p className={cn('text-xs', TONE.danger.value)}>
                ใส่ {ROUND_LIMITS[f.key][0]}–{ROUND_LIMITS[f.key][1]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <p className="text-sm tabular-nums text-foreground" data-testid="retry-total">
        รวมโทรได้ {total ?? '—'} ครั้ง
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TIME_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}</Label>
            <TimeSelect24 value={form[f.key]} disabled={!canEdit || !loaded} label={f.label} onChange={(v) => set(f.key, v)} />
          </div>
        ))}
      </div>
      {!windowOk ? <p className={cn('text-xs', TONE.danger.value)}>เวลาโทรได้ถึง ต้องหลังเวลาเริ่มโทรได้</p> : null}

      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {notice ? (
        <p className={cn('text-sm', TONE.success.value)} data-testid="retry-notice">
          {notice}
        </p>
      ) : null}

      {canEdit ? (
        <Button type="button" disabled={!loaded || saving || !allNumOk || !windowOk} onClick={() => void save()} data-testid="retry-save">
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
      ) : null}
    </Card>
  );
};

export default CallRetryTab;
