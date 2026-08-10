import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { useAuth } from '@/contexts/AuthContext';
import {
  allowedCallWindow,
  withAllowedCallWindow,
  normalizeCallFollowupPolicy,
  DEFAULT_CALL_FOLLOWUP_POLICY,
  type CallFollowupPolicy,
} from '@/lib/callFollowupPolicy';
import { fetchCallFollowupPolicy, saveCallFollowupPolicy } from '@/lib/callFollowupPolicyApi';
import { PhoneCall, Pencil } from 'lucide-react';

/**
 * นโยบายการโทร — เจ้าของตั้งเองได้ว่า "คนนึงจะโทรกี่ครั้ง และโทรช่วงเวลากี่โมงบ้าง"
 *
 * ทุก role เห็นค่าที่ใช้อยู่ (จะได้รู้ว่าทำไม AI ยังไม่โทร) · แก้ได้เฉพาะ admin
 * (ตรงกับ PUT ฝั่ง API — ค่าพวกนี้คุมการโทรหาคนจริง)
 * มุมคนใช้เป็น "ช่วงที่โทรได้" ส่วนนโยบายเก็บเป็น "ช่วงห้ามโทร" — แปลงด้วย
 * allowedCallWindow()/withAllowedCallWindow() ที่ callFollowupPolicy.ts
 */
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function CallPolicyPanel() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';

  const [policy, setPolicy] = useState<CallFollowupPolicy | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftAttempts, setDraftAttempts] = useState(DEFAULT_CALL_FOLLOWUP_POLICY.maxAttempts);
  const [draftFrom, setDraftFrom] = useState(8);
  const [draftTo, setDraftTo] = useState(20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCallFollowupPolicy()
      .then((p) => { if (alive) setPolicy(p); })
      .catch(() => { if (alive) setPolicy(normalizeCallFollowupPolicy(null)); });
    return () => { alive = false; };
  }, []);

  if (!policy) return null;

  const win = allowedCallWindow(policy);
  const allDay = win.fromHour === win.toHour;

  const startEdit = () => {
    setDraftAttempts(policy.maxAttempts);
    setDraftFrom(win.fromHour);
    setDraftTo(win.toHour);
    setError(null);
    setSavedAt(null);
    setEditing(true);
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const next = withAllowedCallWindow(
        { ...policy, maxAttempts: draftAttempts },
        draftFrom,
        draftTo,
      );
      const saved = await saveCallFollowupPolicy(next);
      setPolicy(saved);
      setEditing(false);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-[1.5rem] border border-white/70 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-sky-600 dark:text-sky-300" />
          <h2 className={cn('text-sm font-semibold', DASH.cellStrong)}>นโยบายการโทร</h2>
        </div>
        {canEdit && !editing ? (
          <button type="button" onClick={startEdit} className="jarvis-btn-ghost">
            <Pencil className="h-3 w-3" /> แก้ไข
          </button>
        ) : null}
      </div>

      {!editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={cn('rounded-full border px-2.5 py-1', TONE.primary.soft, TONE.primary.value)}>
            โทรต่อคนสูงสุด {policy.maxAttempts} ครั้ง
          </span>
          <span className={cn('rounded-full border px-2.5 py-1', TONE.info.soft, TONE.info.value)}>
            {allDay ? 'โทรได้ทั้งวัน' : `โทรได้ ${hh(win.fromHour)}–${hh(win.toHour)}`}
          </span>
          <span className={cn('rounded-full border px-2.5 py-1', TONE.neutral.soft, DASH.muted)}>
            เว้นก่อนโทรซ้ำ {policy.retryGapHours} ชม.
          </span>
          {savedAt ? <span className={cn('text-[11px]', TONE.success.value)}>บันทึกแล้ว</span> : null}
          {!canEdit ? (
            <span className={cn('text-[11px]', DASH.muted)}>· แก้ได้เฉพาะผู้ดูแลระบบ</span>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <label className="flex items-center gap-2">
              <span className={DASH.muted}>โทรต่อคนสูงสุด</span>
              <input
                type="number"
                min={1}
                max={10}
                value={draftAttempts}
                onChange={(e) => setDraftAttempts(Number(e.target.value))}
                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <span className={DASH.muted}>ครั้ง (รวมครั้งแรก)</span>
            </label>
            <label className="flex items-center gap-2">
              <span className={DASH.muted}>โทรได้ตั้งแต่</span>
              <select
                value={draftFrom}
                onChange={(e) => setDraftFrom(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{hh(h)}</option>
                ))}
              </select>
              <span className={DASH.muted}>ถึง</span>
              <select
                value={draftTo}
                onChange={(e) => setDraftTo(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{hh(h)}</option>
                ))}
              </select>
            </label>
          </div>
          <p className={cn('text-[11px]', DASH.muted)}>
            เลือกเวลาเริ่ม = เวลาสิ้นสุด หมายถึงโทรได้ทั้งวัน · นอกช่วงนี้ระบบจะเลื่อนคิวไป
            โทรตอนเปิดช่วงของวันถัดไปเอง (มีผลทั้งคิวใหม่และโทรซ้ำ)
          </p>
          {error ? <p className={cn('text-[11px]', TONE.danger.value)}>{error}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="jarvis-btn-primary"
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึกนโยบาย'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="jarvis-btn-ghost">
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
