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
import { conversionRates } from '@/lib/callFunnelMath';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { CALL_OUTCOMES, type CallOutcome } from '@/lib/callFollowupPolicy';
import { CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import { RefreshCw, ChevronDown, ArrowRight, ArrowDown } from 'lucide-react';
import PageHeroStrip, { heroButton } from '@/components/shared/PageHeroStrip';
import { resolvedCallBase } from '@/lib/callFunnelMath';

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


/**
 * ก้อนตัวเลข 1 ขั้นของ funnel — รูปแบบเดียวกับ "การไหลของงานสรรหา" บนหน้าหลัก
 * (เจ้าของสั่ง 10 ส.ค. 2569: "หน้า Follow ทำให้สวยแบบนี้")
 * อยู่บน hero เข้มทั้งสองธีม จึงใช้ TONE.onDark ไม่ใช่ .value
 */
function FlowStage({
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  sub?: React.ReactNode;
  tone: ToneKey;
  onClick?: () => void;
}) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'min-w-0 flex-1 rounded-xl border border-white/[0.14] bg-white/[0.07] px-3 py-2 text-left transition-colors !border-t-[3px]',
        onClick ? 'hover:bg-white/[0.12]' : 'cursor-default',
        t.bar,
      )}
    >
      <div className="text-[10px] font-medium leading-tight text-slate-400">{label}</div>
      <div className={cn('mt-0.5 text-2xl font-bold leading-none tabular-nums tracking-tight', t.onDark)}>
        {value.toLocaleString('th-TH')}
      </div>
      {sub ? <div className="mt-1 text-[10px] leading-tight text-slate-400">{sub}</div> : null}
    </button>
  );
}

const Arrow = () => (
  <div className="flex items-center justify-center text-slate-500">
    <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
    <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
  </div>
);

const CallFunnelPanel: React.FC = () => {
  /** หน้า "งานโทร" ยังซ่อนไว้ให้แอดมิน — ลิงก์ที่ชี้ไปหน้านั้นต้องซ่อนตามกัน */
  const { hasPermission } = useAuth();
  const canSeeCallDesk = hasPermission('admin');

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
      <PageHeroStrip
        eyebrow="การไหลของการโทร"
        actions={
          <button type="button" onClick={load} className={cn(heroButton, 'disabled:opacity-50')}>
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> รีเฟรช
          </button>
        }
      >
        {/* เส้นเดียวอ่านซ้ายไปขวา: เข้าคิว → รอโทร → มีผลจริง → จบยังไง → ตกถังคน
            "มีผลจริง" หักสายที่คนกดยกเลิกออกแล้ว (นิยามเดียวกับอัตราด้านล่าง) */}
        <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-stretch">
          <FlowStage label="ส่งให้ Lumos" value={funnel.queued} sub="ทั้งหมดที่เข้าคิว" tone="neutral" />
          <Arrow />
          <FlowStage
            label="รอโทร"
            value={funnel.waiting}
            sub={funnel.retryScheduled > 0 ? `นัดโทรซ้ำไว้ ${funnel.retryScheduled.toLocaleString('th-TH')}` : 'ยังไม่มีผลกลับ'}
            tone="info"
          />
          <Arrow />
          <FlowStage
            label="มีผลจริง"
            value={resolvedCallBase(funnel)}
            sub="ไม่นับสายที่กดยกเลิก"
            tone="primary"
          />
          <Arrow />
          <FlowStage
            label="สนใจ"
            value={funnel.byOutcome['confirmed'] ?? 0}
            sub="พร้อมให้กดจอง"
            tone="success"
          />
          <FlowStage
            label="ไม่สนใจ"
            value={funnel.byOutcome['declined'] ?? 0}
            sub="ปฏิเสธงาน"
            tone="danger"
          />
          <FlowStage label="ไม่รับ / ไม่ติด" value={funnel.unreached} sub="ควรโทรซ้ำ" tone="warn" />
          <Arrow />
          <FlowStage
            label="ต้องคนตาม"
            value={funnel.needsHuman}
            sub="AI เอาไม่อยู่แล้ว"
            tone="orange"
          />
        </div>
        <p className="mt-2.5 text-[10px] leading-relaxed text-slate-400">
          สถานะการทำงานของการโทร (นับทั้งหมด) — ไม่ใช่ยอด "หาได้แล้ว/ปิดครบใบขอ" ทางการจาก ERP
        </p>
      </PageHeroStrip>

      {/* อัตราแปลงผล — ตัวเลขไว้ประกอบการตัดสินใจเปิด auto ไม่ใช่แค่ความรู้สึก
          นิยามฐาน (หักสายยกเลิก) อยู่ที่ callFunnelMath.ts ที่เดียว มีเทสต์คุม */}
      {(() => {
        const rates = conversionRates(funnel);
        if (!rates) return null;
        return (
          <p className={cn('px-1 text-xs', DASH.muted)}>
            จากสายที่มีผลจริง {rates.base.toLocaleString('th-TH')} สาย (ไม่นับที่กดยกเลิก) — โทรติด{' '}
            <span className={cn('font-semibold', TONE.success.value)}>{rates.connectedPct}%</span>
            {' · '}สนใจ{' '}
            <span className={cn('font-semibold', TONE.success.value)}>{rates.confirmedPct}%</span>
            {' · '}ต้องคนตาม{' '}
            <span className={cn('font-semibold', funnel.needsHuman > 0 ? TONE.danger.value : DASH.muted)}>
              {rates.needsHumanPct}%
            </span>
          </p>
        );
      })()}

      {outcomesWithCount.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {outcomesWithCount.map((o) => (
            <span key={o} className={TONE[CALL_OUTCOME_TONE[o]].chip}>
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
                  {/* นาฬิกาของถัง — เดิมงานตกถังแล้วนอนได้ไม่จำกัดโดยไม่มีอะไรบอก
                      ค้างเกิน 2 วัน = แดง ขัดกับหลัก "ไม่มีงานหายเงียบ" ถ้าปล่อยเงียบ */}
                  {(() => {
                    const days = Math.floor((Date.now() - new Date(item.updatedAt).getTime()) / 86400000);
                    if (days <= 0) return <span className={cn('text-[11px]', DASH.muted)}>เข้าวันนี้</span>;
                    return (
                      <span
                        className={cn(
                          'rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                          days >= 2 ? cn(TONE.danger.soft, TONE.danger.value) : cn(TONE.warn.soft, TONE.warn.value),
                        )}
                      >
                        ค้าง {days.toLocaleString('th-TH')} วัน
                      </span>
                    );
                  })()}
                  <span className={cn('text-[11px]', DASH.muted)}>
                    โทรไป {item.attemptCount.toLocaleString('th-TH')} ครั้ง
                    {item.lastOutcome
                      ? ` · ล่าสุด ${OUTCOME_LABEL[item.lastOutcome as CallOutcome] ?? item.lastOutcome}`
                      : ''}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {taken.has(item.id) ? (
                      canSeeCallDesk ? (
                        <Link
                          to="/matching/my-calls"
                          className={cn('text-[11px] font-bold underline', TONE.success.value)}
                        >
                          รับแล้ว → ไปหน้างานโทร
                        </Link>
                      ) : (
                        /* หน้างานโทรยังซ่อนไว้ให้แอดมิน — คนอื่นบอกแค่ว่ารับแล้ว ไม่ให้ลิงก์ที่กดไปแล้วตัน */
                        <span className={cn('text-[11px] font-bold', TONE.success.value)}>รับแล้ว</span>
                      )
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
