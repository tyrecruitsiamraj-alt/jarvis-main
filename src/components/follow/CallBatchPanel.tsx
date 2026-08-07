import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import {
  approveCallBatch,
  cancelCallBatch,
  fetchCallBatches,
  removeCallBatchItem,
} from '@/lib/callBatchApi';
import {
  CALL_BATCH_STATUS_LABEL,
  activeItemCount,
  canEditBatch,
  undoMsLeft,
  type CallBatch,
  type CallBatchStatus,
} from '@/lib/callBatch';
import { RefreshCw, X } from 'lucide-react';

/**
 * ชุดส่งงานโทรที่รออนุมัติ / รอปล่อย — โจทย์ "อนุมัติแล้วอยากยกเลิกต้องทำได้"
 *
 * อนุมัติแล้วยังไม่เข้าคิวทันที มีช่วงถอนคำ (นับถอยหลังให้เห็น)
 * ระหว่างนั้นยกเลิกทั้งชุด หรือถอนคนออกรายคนได้
 */

const STATUS_TONE: Record<CallBatchStatus, ToneKey> = {
  draft: 'neutral',
  pending_approval: 'warn',
  approved: 'primary',
  dispatched: 'success',
  cancelled: 'neutral',
};

function countdown(ms: number): string {
  if (ms <= 0) return 'กำลังปล่อย…';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const CallBatchPanel: React.FC = () => {
  const [batches, setBatches] = useState<CallBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    setLoading(true);
    void fetchCallBatches().then((b) => {
      setBatches(b);
      setLoading(false);
    });
  }, []);

  useEffect(load, [load]);

  /** เดินนาฬิกาเฉพาะตอนมีชุดที่นับถอยหลังอยู่ */
  const hasCountdown = batches.some((b) => b.status === 'approved');
  useEffect(() => {
    if (!hasCountdown) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [hasCountdown]);

  /** โชว์เฉพาะชุดที่ยังต้องตัดสินใจ + ชุดที่เพิ่งปล่อย (จบไปนานแล้วไม่ต้องรก) */
  const visible = useMemo(
    () => batches.filter((b) => b.status !== 'cancelled').slice(0, 12),
    [batches],
  );

  const act = async (id: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  if (!loading && visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={DASH.eyebrow}>ชุดส่งงานโทร</p>
          <p className={cn('text-[11px]', DASH.muted)}>
            อนุมัติแล้วยังไม่โทรทันที — มีช่วงถอนคำให้ยกเลิก/ถอนคนออกได้
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
            TONE.neutral.soft,
            TONE.neutral.value,
            TONE.neutral.softHover,
          )}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> รีเฟรช
        </button>
      </div>

      {error ? (
        <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.danger.soft, TONE.danger.value)}>
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        {visible.map((b) => {
          const tone = TONE[STATUS_TONE[b.status]];
          const left = undoMsLeft(b, now);
          const editable = canEditBatch(b);
          const count = activeItemCount(b);
          return (
            <div key={b.id} className={cn('overflow-hidden rounded-xl border', DASH.card)}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                <span className={tone.chip}>{CALL_BATCH_STATUS_LABEL[b.status]}</span>
                <span className={cn('font-mono text-xs font-bold', DASH.cellStrong)}>
                  {b.requestNo || b.jobId}
                </span>
                <span className={cn('text-[11px]', DASH.muted)}>
                  {count.toLocaleString('th-TH')} คน ·{' '}
                  {b.channel === 'reminder' ? 'คนของเรา' : 'iRecruit'}
                  {b.createdByName ? ` · สร้างโดย ${b.createdByName}` : ''}
                </span>

                {b.status === 'approved' ? (
                  <span className={cn('font-mono text-xs font-bold tabular-nums', TONE.warn.value)}>
                    ถอนคำได้อีก {countdown(left)}
                  </span>
                ) : null}

                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  {b.status === 'pending_approval' ? (
                    <button
                      type="button"
                      onClick={() => void act(b.id, () => approveCallBatch(b.id))}
                      disabled={busy === b.id || count === 0}
                      title={count === 0 ? 'ถอนคนออกหมดแล้ว — อนุมัติไม่ได้' : undefined}
                      className={cn(
                        'rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-50',
                        TONE.primary.solid,
                      )}
                    >
                      อนุมัติ
                    </button>
                  ) : null}
                  {editable ? (
                    <button
                      type="button"
                      onClick={() => void act(b.id, () => cancelCallBatch(b.id))}
                      disabled={busy === b.id}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50',
                        TONE.danger.soft,
                        TONE.danger.value,
                        TONE.danger.softHover,
                      )}
                    >
                      ยกเลิกทั้งชุด
                    </button>
                  ) : null}
                </div>
              </div>

              {/* รายชื่อในชุด — ถอนออกได้เฉพาะก่อนเข้าคิวจริง */}
              <div className={cn('flex flex-wrap gap-1.5 border-t px-3 py-2', DASH.divider)}>
                {b.items.map((item) => (
                  <span
                    key={item.id}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                      item.removed
                        ? cn(TONE.neutral.soft, DASH.muted, 'line-through')
                        : cn(TONE.neutral.soft, TONE.neutral.value),
                    )}
                  >
                    {item.candidateName || `#${item.candidateRef}`}
                    {editable && !item.removed ? (
                      <button
                        type="button"
                        aria-label={`ถอน ${item.candidateName || item.candidateRef} ออกจากชุด`}
                        onClick={() => void act(b.id, () => removeCallBatchItem(b.id, item.id))}
                        disabled={busy === b.id}
                        className="rounded-full hover:opacity-70 disabled:opacity-40"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CallBatchPanel;
