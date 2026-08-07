import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import {
  EMPTY_FUNNEL,
  fetchCallFunnel,
  type CallFunnel,
  type NeedsHumanItem,
} from '@/lib/callFunnelApi';
import { acquireCallHold } from '@/lib/callHoldsApi';
import { Link } from 'react-router-dom';
import { CALL_OUTCOMES, type CallOutcome } from '@/lib/callFollowupPolicy';
import { RefreshCw, ChevronDown } from 'lucide-react';

/**
 * funnel การโทร + ถัง "ต้องคนตาม" — ตอบคำถามที่เจ้าของถามหน้า Follow:
 * ส่งไปให้ Lumos กี่คน · โทรติดกี่คน · ไม่ติดกี่คน · ไม่รับสายกี่คน
 * แล้วต่อด้วย "ใครที่ AI เอาไม่อยู่แล้ว ต้องให้คนตาม"
 *
 * ⚠️ ตัวเลขที่นี่คือการทำงานของการโทร ไม่ใช่ "หาได้แล้ว/ปิดครบใบขอ" ทางการจาก ERP
 */

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  confirmed: 'สนใจ',
  acknowledged: 'รับทราบ',
  declined: 'ไม่สนใจ',
  reschedule_requested: 'ขอเลื่อน',
  wrong_person: 'เบอร์ผิด',
  no_answer: 'ไม่รับสาย',
  busy: 'สายไม่ว่าง',
  unresponsive: 'ไม่ตอบ',
  failed: 'โทรไม่สำเร็จ',
  cancelled: 'ยกเลิก',
};

const OUTCOME_TONE: Record<CallOutcome, ToneKey> = {
  confirmed: 'success',
  acknowledged: 'success',
  declined: 'danger',
  reschedule_requested: 'warn',
  wrong_person: 'neutral',
  no_answer: 'neutral',
  busy: 'neutral',
  unresponsive: 'neutral',
  failed: 'neutral',
  cancelled: 'neutral',
};

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: ToneKey;
}) {
  const t = tone ? TONE[tone] : null;
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', t ? t.soft : DASH.card)}>
      <p className={cn('text-[10px] font-bold uppercase tracking-wider', DASH.muted)}>{label}</p>
      <p
        className={cn(
          'font-mono text-2xl font-extrabold tabular-nums leading-tight',
          t ? t.value : DASH.cellStrong,
        )}
      >
        {value.toLocaleString('th-TH')}
      </p>
      {hint ? <p className={cn('text-[10px]', DASH.muted)}>{hint}</p> : null}
    </div>
  );
}

const CallFunnelPanel: React.FC = () => {
  const [funnel, setFunnel] = useState<CallFunnel>(EMPTY_FUNNEL);
  const [needsHuman, setNeedsHuman] = useState<NeedsHumanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openBucket, setOpenBucket] = useState(false);
  const [takingId, setTakingId] = useState<number | null>(null);
  const [takeError, setTakeError] = useState<string | null>(null);
  /** id ที่เพิ่งรับไปตามในรอบนี้ — โชว์ผลค้างไว้ ไม่ให้ดูเหมือนกดแล้วไม่มีอะไรเกิด */
  const [taken, setTaken] = useState<Set<number>>(new Set());

  const load = () => {
    setLoading(true);
    void fetchCallFunnel().then((d) => {
      setFunnel(d.funnel);
      setNeedsHuman(d.needsHuman);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const outcomesWithCount = CALL_OUTCOMES.filter((o) => (funnel.byOutcome[o] ?? 0) > 0);

  /**
   * รับงานตามจากถังนี้ตรง ๆ — ใช้ล็อกตัวเดียวกับหน้า Matching (ผูกกับเบอร์)
   * รับแล้วไปโทรต่อที่หน้า "โทรของฉัน" · คนอื่นถือแล้วจะได้ 409 พร้อมชื่อคนถือ
   */
  const take = async (item: NeedsHumanItem) => {
    if (takingId || !item.candidateRef || !item.source || !item.phone) return;
    setTakingId(item.id);
    setTakeError(null);
    try {
      const res = await acquireCallHold({
        phone: item.phone,
        source: item.source,
        candidateRef: item.candidateRef,
        candidateName: item.candidateName,
        jobId: item.jobRef,
        requestNo: null,
      });
      if (res.ok) {
        setTaken((prev) => new Set(prev).add(item.id));
      } else {
        setTakeError(res.message ?? 'รับงานไม่สำเร็จ');
      }
    } catch (e) {
      setTakeError(e instanceof Error ? e.message : 'รับงานไม่สำเร็จ');
    } finally {
      setTakingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={DASH.eyebrow}>การไหลของการโทร</p>
          <p className={cn('text-[11px]', DASH.muted)}>
            สถานะการทำงานของการโทร — ไม่ใช่ยอด "หาได้แล้ว/ปิดครบใบขอ" ทางการจาก ERP
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="ส่งให้ Lumos" value={funnel.queued} hint="ทั้งหมดที่เข้าคิว" />
        <Stat
          label="รอโทร"
          value={funnel.waiting}
          hint={
            funnel.retryScheduled > 0
              ? `นัดโทรซ้ำไว้ ${funnel.retryScheduled.toLocaleString('th-TH')}`
              : 'ยังไม่มีผลกลับ'
          }
          tone="info"
        />
        <Stat label="Lumos รับไปแล้ว" value={funnel.delivered} tone="primary" />
        <Stat label="โทรติด" value={funnel.connected} hint="ได้คุยกับคนจริง" tone="success" />
        <Stat label="ไม่ติด" value={funnel.unreached} hint="ไม่รับ/สายไม่ว่าง" tone="warn" />
        <Stat
          label="ต้องคนตาม"
          value={funnel.needsHuman}
          hint="AI เอาไม่อยู่แล้ว"
          tone={funnel.needsHuman > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {outcomesWithCount.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {outcomesWithCount.map((o) => (
            <span key={o} className={TONE[OUTCOME_TONE[o]].chip}>
              {OUTCOME_LABEL[o]}{' '}
              <span className="font-mono tabular-nums">
                {(funnel.byOutcome[o] ?? 0).toLocaleString('th-TH')}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      {/* ถัง "ต้องคนตาม" — กดขยายเห็นรายชื่อ */}
      {needsHuman.length > 0 ? (
        <div className={cn('overflow-hidden rounded-xl border', TONE.danger.soft)}>
          <button
            type="button"
            onClick={() => setOpenBucket((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
          >
            <span className={cn('text-sm font-bold', TONE.danger.value)}>
              🚩 ต้องคนตาม {needsHuman.length.toLocaleString('th-TH')} คน — AI โทรจนสุดมือแล้ว
            </span>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 transition-transform', openBucket && 'rotate-180')}
            />
          </button>
          {openBucket ? (
            <div className={cn('border-t', DASH.divider)}>
              {takeError ? (
                <p className={cn('border-b px-3 py-2 text-[11px]', DASH.divider, TONE.danger.value)}>
                  {takeError}
                </p>
              ) : null}
              {needsHuman.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-xs last:border-b-0',
                    DASH.divider,
                  )}
                >
                  <span className={cn('font-semibold', DASH.cellStrong)}>
                    {item.candidateName || item.personRef}
                  </span>
                  <span className={cn('font-mono text-[11px]', DASH.muted)}>{item.jobRef}</span>
                  <span className={cn('text-[11px]', DASH.muted)}>
                    โทรไป {item.attemptCount.toLocaleString('th-TH')} ครั้ง
                    {item.lastOutcome
                      ? ` · ล่าสุด ${OUTCOME_LABEL[item.lastOutcome as CallOutcome] ?? item.lastOutcome}`
                      : ''}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {taken.has(item.id) ? (
                      <Link
                        to="/matching/my-calls"
                        className={cn('text-[11px] font-bold underline', TONE.success.value)}
                      >
                        รับแล้ว → ไปโทรของฉัน
                      </Link>
                    ) : item.candidateRef && item.phone ? (
                      <button
                        type="button"
                        onClick={() => void take(item)}
                        disabled={takingId === item.id}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-bold disabled:opacity-50',
                          TONE.primary.solid,
                        )}
                      >
                        {takingId === item.id ? 'กำลังรับ…' : 'รับไปตาม'}
                      </button>
                    ) : (
                      <span className={cn('text-[10px]', DASH.muted)} title="ไม่มีเบอร์ที่โทรได้">
                        รับไปตามไม่ได้
                      </span>
                    )}
                    <span className={cn('text-[10px]', DASH.muted)}>
                      {new Date(item.updatedAt).toLocaleString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : funnel.queued > 0 ? (
        <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.success.soft, TONE.success.value)}>
          ยังไม่มีใครตกถัง "ต้องคนตาม" — AI ยังตามงานอยู่
        </p>
      ) : null}
    </div>
  );
};

export default CallFunnelPanel;
