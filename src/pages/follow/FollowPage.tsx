import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { Phone, Plus, X, LoaderCircle, RefreshCw, PhoneForwarded } from 'lucide-react';
import {
  listFollowEntries,
  createFollowEntry,
  cancelFollowEntry,
  FOLLOW_STATUS_LABEL,
  FOLLOW_STATUS_CLASS,
  type FollowEntry,
  type FollowCallStatus,
} from '@/lib/followApi';

const FILTERS: Array<{ id: 'all' | FollowCallStatus; label: string }> = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'pending', label: 'รอโทร' },
  { id: 'delivered', label: 'กำลังโทร' },
  { id: 'completed', label: 'โทรสำเร็จ' },
  { id: 'failed', label: 'ไม่สำเร็จ' },
];

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

/** ค่าเริ่มต้นช่องวันเวลา = ตอนนี้ (รูปแบบ datetime-local ตามเวลาเครื่อง) */
function nowForInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const FollowPage: React.FC = () => {
  const [items, setItems] = useState<FollowEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | FollowCallStatus>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [scheduledAt, setScheduledAt] = useState(nowForInput);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listFollowEntries());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดรายการไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const resetForm = () => {
    setName('');
    setPhone('');
    setTopic('');
    setNote('');
    setScheduledAt(nowForInput());
    setFormError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createFollowEntry({
        recipient_name: name,
        recipient_phone: phone,
        topic,
        note: note || undefined,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      resetForm();
      setFormOpen(false);
      setOkMessage('เพิ่มรายชื่อแล้ว — ส่งเข้าคิว AI โทรเรียบร้อย');
      window.setTimeout(() => setOkMessage(null), 5000);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'เพิ่มรายชื่อไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const doCancel = async (id: string) => {
    setBusyId(id);
    try {
      await cancelFollowEntry(id);
      setCancellingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((it) => it.call_status === filter)),
    [items, filter],
  );

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.call_status === 'pending').length;
    const done = items.filter((i) => i.call_status === 'completed').length;
    return { total: items.length, pending, done };
  }, [items]);

  return (
    <div className="relative">
      <div className="jarvis-page-orb top-0 right-4 h-32 w-32" aria-hidden />
      <PageHeader
        title="Follow"
        subtitle="ลงรายชื่อคนที่ต้องติดตาม แล้ว AI จะโทรตามให้"
        backPath="/"
      />

      <div className="px-4 md:px-6 py-4 space-y-4">
        {/* สรุป + ปุ่มเพิ่ม */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setFormOpen((v) => !v);
              setFormError(null);
            }}
            className="jarvis-pill-btn inline-flex min-h-[44px] items-center gap-1.5 px-5 py-2.5 text-sm touch-manipulation"
          >
            <Plus className="h-4 w-4" aria-hidden />
            เพิ่มรายชื่อที่ต้องติดตาม
          </button>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 shadow-sm hover:bg-sky-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            รีเฟรช
          </button>
          <p className="text-xs text-muted-foreground">
            ทั้งหมด <span className="font-bold tabular-nums text-foreground">{counts.total}</span> · รอโทร{' '}
            <span className="font-bold tabular-nums text-slate-700">{counts.pending}</span> · สำเร็จ{' '}
            <span className="font-bold tabular-nums text-emerald-700">{counts.done}</span>
          </p>
        </div>

        {okMessage ? (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700">{okMessage}</p>
        ) : null}

        {/* ฟอร์มเพิ่ม */}
        {formOpen ? (
          <form onSubmit={submit} className="jarvis-frost space-y-3 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="followName" className="ml-1 text-xs font-medium text-muted-foreground">
                  ชื่อผู้ที่ต้องติดตาม
                </label>
                <input
                  id="followName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="เช่น สมชาย ใจดี"
                  className="jarvis-soft-field min-h-[46px]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="followPhone" className="ml-1 text-xs font-medium text-muted-foreground">
                  เบอร์โทร (มือถือ 10 หลัก)
                </label>
                <input
                  id="followPhone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  inputMode="tel"
                  placeholder="0812345678"
                  className="jarvis-soft-field min-h-[46px]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="followTopic" className="ml-1 text-xs font-medium text-muted-foreground">
                เรื่องที่จะให้โทรติดตาม
              </label>
              <input
                id="followTopic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                placeholder="เช่น ยืนยันวันเริ่มงาน 15 ส.ค."
                className="jarvis-soft-field min-h-[46px]"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="followNote" className="ml-1 text-xs font-medium text-muted-foreground">
                  รายละเอียดเพิ่มเติม (ถ้ามี)
                </label>
                <input
                  id="followNote"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="ข้อความที่อยากให้ AI พูดเพิ่ม"
                  className="jarvis-soft-field min-h-[46px]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="followWhen" className="ml-1 text-xs font-medium text-muted-foreground">
                  ให้โทรเมื่อ
                </label>
                <input
                  id="followWhen"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="jarvis-soft-field min-h-[46px]"
                />
              </div>
            </div>

            {formError ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="jarvis-pill-btn inline-flex min-h-[46px] items-center gap-1.5 px-6 py-2.5 text-sm disabled:opacity-50"
              >
                {submitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <PhoneForwarded className="h-4 w-4" aria-hidden />
                )}
                {submitting ? 'กำลังบันทึก…' : 'บันทึก + ส่ง AI โทร'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                className="inline-flex min-h-[46px] items-center rounded-full border border-slate-300 bg-white/70 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-white"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        ) : null}

        {/* ตัวกรอง */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'min-h-[36px] rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                filter === f.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-white/70 bg-white/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">{error}</p>
        ) : null}

        {/* รายการ */}
        {loading && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-500" aria-hidden />
            กำลังโหลดรายการ…
          </p>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-2xl border border-white/70 p-8 text-center text-muted-foreground">
            <PhoneForwarded className="mx-auto mb-2 h-8 w-8 text-blue-400/60" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              {items.length === 0 ? 'ยังไม่มีรายชื่อที่ต้องติดตาม' : 'ไม่มีรายการตามตัวกรองนี้'}
            </p>
            {items.length === 0 ? (
              <p className="mt-1 text-xs">กด “เพิ่มรายชื่อที่ต้องติดตาม” เพื่อให้ AI โทรตามให้</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((it) => (
              <div key={it.id} className="glass-card rounded-2xl border border-white/70 px-3.5 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-foreground">{it.recipient_name}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          FOLLOW_STATUS_CLASS[it.call_status],
                        )}
                      >
                        {FOLLOW_STATUS_LABEL[it.call_status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{it.topic}</p>
                    {it.note ? <p className="text-xs text-muted-foreground">{it.note}</p> : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      ให้โทร {formatWhen(it.scheduled_at)}
                      {it.created_by_name ? ` · ลงโดย ${it.created_by_name}` : ''}
                    </p>
                    {it.call_outcome || it.call_summary ? (
                      <p className="mt-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] text-slate-700">
                        ผลการโทร{it.call_outcome ? ` (${it.call_outcome})` : ''}
                        {it.call_summary ? `: ${it.call_summary}` : ''}
                        {it.called_at ? ` · ${formatWhen(it.called_at)}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={`tel:${it.recipient_phone}`}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-sky-200 bg-sky-50/70 px-3 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100"
                    >
                      <Phone className="h-3 w-3" aria-hidden />
                      {it.recipient_phone}
                    </a>
                    {!it.cancelled && it.call_status === 'pending' ? (
                      cancellingId === it.id ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === it.id}
                            onClick={() => void doCancel(it.id)}
                            className="inline-flex min-h-[36px] items-center rounded-full bg-red-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {busyId === it.id ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancellingId(null)}
                            className="inline-flex min-h-[36px] items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-600"
                          >
                            ไม่
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCancellingId(it.id)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                        >
                          <X className="h-3 w-3" aria-hidden />
                          ยกเลิก
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowPage;
