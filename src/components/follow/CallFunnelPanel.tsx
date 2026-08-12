import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import {
  EMPTY_FUNNEL,
  fetchCallFunnel,
  type CallFunnel,
  type CallFunnelSource,
  type NeedsHumanItem,
} from '@/lib/callFunnelApi';
import { acquireCallHold } from '@/lib/callHoldsApi';
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
export function FlowStage({
  label,
  value,
  sub,
  tone,
  onClick,
  active = false,
  disabled = false,
  title,
}: {
  label: string;
  value: number;
  sub?: React.ReactNode;
  tone: ToneKey;
  onClick?: () => void;
  /** กดค้างเป็นตัวกรองอยู่ — ใช้ที่หน้า Matching ซึ่งการ์ดแถวบนเป็นตัวกรองรายการด้านล่าง */
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick || disabled}
      title={title}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        'min-w-0 flex-1 rounded-2xl border border-white/[0.14] bg-white/[0.07] px-4 py-3 text-left transition-colors !border-t-4',
        onClick ? 'hover:bg-white/[0.12] disabled:cursor-wait' : 'cursor-default',
        // ⚠️ เน้นด้วย **วงแหวน** ไม่ใช่พื้นสว่างขึ้น — ลองพื้น white/[0.16] แล้ววัดได้
        // contrast ตก 3.87 → 2.92 (พื้นสว่างขึ้นแต่ตัวหนังสือยังสีเดิม) ซึ่งแย่กว่าการ์ดอื่น
        // ในแถบเดียวกัน · วงแหวนเน้นได้เท่ากันโดยไม่แตะพื้น (กติกาเดียวกับปุ่มเลขหน้า)
        // ring-blue-400/50 ของการ์ดพื้นอ่อนเดิมจมหายบนพื้นเข้ม จึงใช้ sky-300
        active && 'ring-2 ring-sky-300/80',
        t.bar,
      )}
    >
      <div className="text-xs font-medium leading-tight text-slate-400">{label}</div>
      <div className={cn('mt-1 text-3xl font-bold leading-none tabular-nums tracking-tight', t.onDark)}>
        {value.toLocaleString('th-TH')}
      </div>
      {sub ? <div className="mt-1.5 text-[11px] leading-snug text-slate-400">{sub}</div> : null}
    </button>
  );
}

/** ต้นทางที่เลือกดูได้ — เรียงจาก "ของหน้านี้" ไปหาภาพรวม */
const SOURCE_TABS: Array<{ id: CallFunnelSource; label: string; hint: string }> = [
  { id: 'follow', label: 'จากหน้านี้', hint: 'เฉพาะรายชื่อที่ลงไว้ในหน้า Follow' },
  { id: 'board', label: 'Job Offer', hint: 'ที่ส่งจากหน้า Matching (คนบนบอร์ด)' },
  { id: 'irecruit', label: 'iRecruit', hint: 'ที่ส่งจากผลค้นหา iRecruit' },
  { id: 'all', label: 'ทั้งหมด', hint: 'รวมทุกต้นทาง' },
];

/**
 * ปุ่มที่โชว์ตอนสลับได้ — **ไม่มี "จากหน้านี้"** (เจ้าของสั่ง 10 ส.ค. 2569)
 * ปุ่มนั้นหมายถึง "หน้า Follow" ซึ่งพอไปโผล่บนหน้า Matching แล้วอ่านไม่รู้เรื่อง
 * หน้า Follow เองใช้โหมดล็อก ไม่มีปุ่มอยู่แล้ว แต่ยังต้องมี entry นี้ไว้ทำป้ายหัวแผง
 */
const SWITCHABLE_TABS = SOURCE_TABS.filter((t) => t.id !== 'follow');

/**
 * โครงคอลัมน์ของแถบ funnel — **หลักการเดียวกับ FLOW_ROW_GRID ในหน้าหลัก**
 * (เจ้าของสั่ง 10 ส.ค. 2569: "ทำ Tone ให้เหมือนกับหน้าหลัก")
 *
 * 7 ช่องการ์ด `minmax(0,1fr)` กว้างเท่ากันเป๊ะ สลับกับช่องลูกศร `auto` 4 ช่อง
 * เดิมเป็น flex ล้วน ซึ่งแบ่งความกว้างตามเนื้อหาแต่ละใบ การ์ดจึงกว้างไม่เท่ากัน
 * และดูคนละจังหวะกับ funnel หน้าหลักทั้งที่เป็นของชุดเดียวกัน
 *
 * สังเกต: สนใจ / ไม่สนใจ / ไม่รับ อยู่ติดกันโดยไม่มีลูกศรคั่น เพราะเป็น
 * **ผลลัพธ์คู่ขนานของขั้น "มีผลจริง"** ไม่ใช่ขั้นที่ต่อจากกัน
 */
export const FUNNEL_ROW_GRID =
  'mt-3 flex flex-col gap-1.5 sm:grid sm:items-stretch ' +
  'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)]';

/**
 * ช่องเปล่าเติมท้ายแถวที่มีการ์ดน้อยกว่า — โครงคอลัมน์เดียวกันสองแถวต้องมีลูกครบทุกช่อง
 * ไม่งั้นช่องที่ว่างยุบแล้วการ์ดสองแถวกว้างไม่เท่ากัน (จอเล็กเรียงแนวตั้ง ไม่ต้องมี)
 */
export const FlowSlotFiller = () => <div className="hidden sm:block" aria-hidden />;

export const FlowArrow = ({ ghost = false }: { ghost?: boolean }) => (
  <div
    className={cn(
      'flex items-center justify-center text-slate-500',
      // ghost = ช่องลูกศรที่ "ไม่มีลูกศร" แต่ต้องกินที่เท่าลูกศรจริง — สองแถวใช้โครง
      // คอลัมน์เดียวกัน ถ้าช่อง auto ของแถวหนึ่งว่างเปล่ามันจะยุบเหลือ 0 แล้วคอลัมน์เหลื่อม
      // (กับดัก grid เดิมของโปรเจกต์) · จอเล็กเรียงแนวตั้ง ไม่ต้องกินที่ → ซ่อนทิ้ง
      ghost && 'invisible max-sm:hidden',
    )}
  >
    <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
    <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
  </div>
);

const Arrow = FlowArrow;

export type CallFunnelPanelProps = {
  /**
   * ต้นทางที่เปิดมาเห็นก่อน — **หน้า Follow ต้องเป็น 'follow' เสมอ**
   * หน้านั้นคือ "ลงรายชื่อคนที่ต้องติดตาม แล้ว AI โทรตามให้" คนเปิดมาย่อมถามว่า
   * "ที่ฉันส่งไปมันไปถึงไหนแล้ว" — เดิมโชว์ยอดทั้งระบบ 5,307 ทั้งที่หน้านั้นส่งเอง 1 คน
   * (เจ้าของทัก 10 ส.ค. 2569) · หน้าการไหลของงานเป็นภาพรวมทั้งระบบ จึงใช้ 'all'
   */
  defaultSource?: CallFunnelSource;
  /**
   * ล็อกต้นทางไว้ ไม่ให้สลับ — ซ่อนปุ่มสลับต้นทางทิ้ง
   * เจ้าของสั่ง 10 ส.ค. 2569: หน้า Follow เอาแค่ของตัวเองพอ ("ตอนนี้มีแค่ 1 พอ")
   * ส่วนตัวที่กดสลับดูต้นทางอื่นได้ ให้ไปอยู่หน้าการไหลของงานแทน
   */
  lockSource?: boolean;
  /**
   * โชว์แผง "สถานะการโทรรายรอบ" ไหม — **เปิดเฉพาะหน้า Follow**
   * (เจ้าของสั่ง 10 ส.ค. 2569 ให้เอาออกจากหน้า Matching · หน้านั้นดูภาพรวม funnel พอ
   * รายรอบเป็นมุมของคนที่ตามงานทีละคนซึ่งเป็นงานของหน้า Follow)
   */
  showAttempts?: boolean;
  /**
   * แถว "ฝั่งงาน" ที่เอามาต่อหัวเส้นการโทรในแผงเดียวกัน (เจ้าของสั่ง 11 ส.ค. 2569:
   * "เอาเข้าไปรวมกับการไหลของงาน จะได้ติดตามง่าย ๆ แบบ visual ที่ชัดเจน")
   *
   * ใช้ที่หน้า Matching ที่เดียว — ส่งการ์ดที่สร้างจาก `FlowStage` เข้ามา
   * เพื่อให้หน้าตา/โทน/ระยะเป็นชุดเดียวกับเส้นการโทรจริง ๆ ไม่ใช่แค่วางไว้ใกล้กัน
   *
   * ⚠️ **หน้า Follow ไม่ส่ง prop นี้** — หน้านั้นไม่มีฝั่งใบขอให้พูดถึง
   */
  leadIn?: React.ReactNode;
  /** ป้ายกำกับแถวฝั่งงาน + แถวการโทร (โผล่เฉพาะตอนมี leadIn) */
  leadInLabel?: string;
  callRowLabel?: string;
  /** หัวแผง — หน้า Matching รวมสองฝั่งแล้วจึงไม่ใช่ "การไหลของการโทร" อย่างเดียว */
  title?: string;
  /**
   * งานที่ต้องทำต่อจากฝั่งที่แผงนี้มองไม่เห็นเอง (เช่น "ยังไม่มีคน" ของฝั่งใบขอ)
   * — เอาไปต่อท้ายแถบ "ทำก่อน→หลัง" หลังสองข้อที่แผงคิดเองจาก funnel
   */
  nextActions?: Array<{ label: string; value: number }>;
};

const CallFunnelPanel: React.FC<CallFunnelPanelProps> = ({
  defaultSource = 'follow',
  lockSource = false,
  showAttempts = false,
  leadIn,
  leadInLabel = 'ขั้น 1 · ฝั่งงาน — อัตราที่ต้องหา',
  callRowLabel = 'ขั้น 2 · ฝั่งการโทร — คนที่ส่งไปแล้ว',
  title = 'การไหลของการโทร',
  nextActions,
}) => {
  const [source, setSource] = useState<CallFunnelSource>(defaultSource);
  const [funnel, setFunnel] = useState<CallFunnel>(EMPTY_FUNNEL);
  const [needsHuman, setNeedsHuman] = useState<NeedsHumanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openBucket, setOpenBucket] = useState(false);
  /** ชิปผลโทรรายแบบ — พับไว้ก่อน (เลขส่วนใหญ่ซ้ำกับช่องบนเส้น เจ้าของติงว่ารก) */
  const [openOutcomes, setOpenOutcomes] = useState(false);
  const [takingId, setTakingId] = useState<number | null>(null);
  const [takeError, setTakeError] = useState<string | null>(null);
  /** id ที่เพิ่งรับไปตามในรอบนี้ — โชว์ผลค้างไว้ ไม่ให้ดูเหมือนกดแล้วไม่มีอะไรเกิด */
  const [taken, setTaken] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    void fetchCallFunnel(undefined, source).then((d) => {
      setFunnel(d.funnel);
      setNeedsHuman(d.needsHuman);
      setLoading(false);
    });
  }, [source]);

  useEffect(() => load(), [load]);

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
        eyebrow={`${title} · ${SOURCE_TABS.find((t) => t.id === source)?.label ?? ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {lockSource
              ? null
              : SWITCHABLE_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSource(t.id)}
                    title={t.hint}
                    className={cn(heroButton, source === t.id && 'bg-white/25 text-white')}
                  >
                    {t.label}
                  </button>
                ))}
            <button type="button" onClick={load} className={cn(heroButton, 'disabled:opacity-50')}>
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> รีเฟรช
            </button>
          </div>
        }
      >
        {/* แถวฝั่งงาน (ถ้ามี) — วางไว้ "ก่อน" เส้นการโทรเพราะงานเกิดก่อนสาย
            อ่านต่อกันเป็นเรื่องเดียว: มีอัตราเท่าไหร่ → AI หาคนได้แค่ไหน → โทรไปถึงไหนแล้ว
            เดิมเป็นการ์ดพื้นอ่อนลอยอยู่คนละก้อนใต้แผงนี้ ต้องกวาดตาสองที่แล้วต่อเรื่องเอง */}
        {leadIn ? (
          <>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {leadInLabel}
            </p>
            {leadIn}
            <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {callRowLabel}
              </p>
              <p className="text-[10px] text-slate-500">
                — คนที่ AI แนะนำแล้วถูกส่งเข้าคิวโทร จะมานับต่อในแถวนี้
              </p>
            </div>
          </>
        ) : null}

        {/* เส้นเดียวอ่านซ้ายไปขวา: เข้าคิว → รอโทร → มีผลจริง → จบยังไง → ตกถังคน
            "มีผลจริง" หักสายที่คนกดยกเลิกออกแล้ว (นิยามเดียวกับอัตราด้านล่าง) */}
        <div className={FUNNEL_ROW_GRID}>
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
        {/* ทำก่อน→หลัง — ตอบคำถาม "เห็นแผงแล้วต้องขยับอะไรก่อน" (เจ้าของขอ 11 ส.ค. 2569)
            เรียงตามความเร่ง: คนตอบสนใจหลุดมือง่ายสุด → งานที่ AI เอาไม่อยู่ → ที่เหลือจากฝั่งใบขอ
            "ไม่รับ/ไม่ติด" ไม่อยู่ในแถบนี้ — AI นัดโทรซ้ำเองอยู่แล้ว ไม่ใช่งานของคน */}
        {(() => {
          const actions = [
            { label: 'จองคนที่ตอบ "สนใจ"', value: funnel.byOutcome['confirmed'] ?? 0 },
            { label: 'รับงาน "ต้องคนตาม" ไปโทรเอง', value: funnel.needsHuman },
            ...(nextActions ?? []),
          ].filter((a) => a.value > 0);
          if (actions.length === 0) return null;
          return (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                ทำก่อน → หลัง
              </span>
              {actions.map((a, i) => (
                <span
                  key={a.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.07] px-2.5 py-1 text-[11px] text-slate-200"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15 font-mono text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  {a.label}
                  <span className="font-mono font-semibold tabular-nums text-white">
                    {a.value.toLocaleString('th-TH')}
                  </span>
                </span>
              ))}
            </div>
          );
        })()}

        {/* ผลแยกรายแบบ — พับไว้ก่อน เพราะเลขส่วนใหญ่ซ้ำกับช่องบนเส้น (สนใจ/ไม่สนใจ)
            ของที่มีเฉพาะในนี้ (รับทราบ · ยกเลิก · แยกไม่รับสาย/สายไม่ว่าง) กดค่อยกาง */}
        {outcomesWithCount.length > 0 ? (
          <div className="mt-3 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => setOpenOutcomes((v) => !v)}
              aria-expanded={openOutcomes}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200"
            >
              ผลโทรแยกรายแบบ ({outcomesWithCount.length.toLocaleString('th-TH')} แบบ)
              <ChevronDown className={cn('h-3 w-3 transition-transform', openOutcomes && 'rotate-180')} aria-hidden />
            </button>
            {openOutcomes ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {outcomesWithCount.map((o) => (
                  <span
                    key={o}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.07] px-2.5 py-1 text-[11px]"
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', TONE[CALL_OUTCOME_TONE[o]].dot)} aria-hidden />
                    <span className="text-slate-300">{OUTCOME_LABEL[o]}</span>
                    <span className={cn('font-mono font-semibold tabular-nums', TONE[CALL_OUTCOME_TONE[o]].onDark)}>
                      {(funnel.byOutcome[o] ?? 0).toLocaleString('th-TH')}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="mt-2.5 text-[10px] leading-relaxed text-slate-400">
          {source === 'all'
            ? 'นับงานโทรทุกต้นทางรวมกัน (หน้า Follow + Job Offer + iRecruit)'
            : `นับเฉพาะงานโทรที่มาจาก "${SOURCE_TABS.find((t) => t.id === source)?.label}"${
                // ล็อกต้นทางแล้วไม่มีปุ่มให้กด — อย่าชี้ทางที่ไม่มีอยู่จริง
                lockSource ? '' : ' — กดปุ่มด้านบนเพื่อดูต้นทางอื่น'
              }`}
          {' · '}สถานะการทำงานของการโทร ไม่ใช่ยอด "หาได้แล้ว/ปิดครบใบขอ" ทางการจาก ERP
        </p>
      </PageHeroStrip>

      {/* ⚠️ บรรทัด "จากสายที่มีผลจริง N สาย — โทรติด x% · สนใจ y% · ต้องคนตาม z%"
          เคยอยู่ตรงนี้ — เจ้าของสั่งเอาออก 10 ส.ค. 2569
          นิยามฐาน (หักสายยกเลิก) ยังอยู่ที่ `callFunnelMath.ts` พร้อมเทสต์ ไม่ได้ลบ */}

      {/* Status รายรอบ (เจ้าของสั่ง 10 ส.ค. 2569: "เตรียมแล้วกี่คน โทรรอบแรกรับไม่รับกี่คน
          รอบสอง รอบสามด้วย ส่งโทรทั้งหมดกี่คน โทรไปแล้วกี่คน เหลือโทรกี่คน — ให้เห็นความเป็น
          visual control") · แถบสัดส่วนอ่านซ้ายไปขวา: ติด (เขียว) / ไม่ติด (เหลือง) / ยังไม่โทร (เทา)

          ⚠️ **ตัวเลขรายรอบนับตามรอบล่าสุดของแต่ละคน ไม่ใช่จำนวนสายที่โทรไปในรอบนั้น**
          คนที่โทรไปแล้ว 3 รอบจะอยู่ในแถวรอบ 3 อย่างเดียว ไม่ถูกนับซ้ำในรอบ 1-2
          (ฐานเก็บ `attempt_count` เป็นรอบล่าสุดต่อแถว ไม่ได้เก็บประวัติรายครั้ง)
          บรรทัดกำกับใต้แผงบอกเรื่องนี้ไว้ กันอ่านผิดว่าเป็นยอดสายต่อรอบ */}
      {showAttempts && funnel.byAttempt && funnel.byAttempt.some((a) => a.total > 0) ? (
        <div className={cn('rounded-2xl border p-3', DASH.card)}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className={DASH.eyebrow}>สถานะการโทรรายรอบ</p>
            <p className={cn('text-[11px]', DASH.muted)}>
              {/* เตรียมไว้ = เข้าคิวแล้วแต่ Lumos ยังไม่หยิบไปโทร (queued − delivered)
                  ⚠️ ห้ามใช้ `waiting` ตรงนี้ — มันคือ "ยังไม่มีผลกลับ" ซึ่งได้เลขเท่า "เหลือโทร"
                  พอดี กลายเป็นโชว์เลขเดียวกันสองช่อง (เจอตอนตรวจจริง) */}
              เตรียมไว้{' '}
              <span className="font-mono font-semibold tabular-nums">
                {Math.max(funnel.queued - funnel.delivered, 0).toLocaleString('th-TH')}
              </span>
              {' · '}ส่งโทรทั้งหมด{' '}
              <span className="font-mono font-semibold tabular-nums">{funnel.queued.toLocaleString('th-TH')}</span>
              {' · '}โทรไปแล้ว{' '}
              <span className="font-mono font-semibold tabular-nums">{funnel.withResult.toLocaleString('th-TH')}</span>
              {' · '}เหลือโทร{' '}
              <span className={cn('font-mono font-semibold tabular-nums', TONE.warn.value)}>
                {Math.max(funnel.queued - funnel.withResult, 0).toLocaleString('th-TH')}
              </span>
            </p>
          </div>

          <div className="mt-2.5 grid gap-2">
            {funnel.byAttempt.map((a) => {
              const pct = (v: number) => (a.total > 0 ? (v / a.total) * 100 : 0);
              return (
                <div key={a.attempt} className="flex items-center gap-3">
                  <span className={cn('w-24 shrink-0 text-[11px] font-medium', DASH.cell)}>
                    รอบที่ {a.attempt}
                    {a.attempt === 3 ? '+' : ''}
                  </span>
                  <div className="flex h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className={cn('h-full', TONE.success.dot)} style={{ width: `${pct(a.connected)}%` }} />
                    <div className={cn('h-full', TONE.warn.dot)} style={{ width: `${pct(a.unreached)}%` }} />
                    <div className="h-full bg-slate-400/70" style={{ width: `${pct(a.pending)}%` }} />
                  </div>
                  <span className="w-[13rem] shrink-0 text-right font-mono text-[11px] tabular-nums">
                    <span className={TONE.success.value}>รับ {a.connected.toLocaleString('th-TH')}</span>
                    {' · '}
                    <span className={TONE.warn.value}>ไม่รับ {a.unreached.toLocaleString('th-TH')}</span>
                    {' · '}
                    <span className={DASH.muted}>ยังไม่โทร {a.pending.toLocaleString('th-TH')}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <p className={cn('mt-2 text-[10px] leading-relaxed', DASH.muted)}>
            นับตาม "รอบล่าสุดของแต่ละคน" — คนที่โทรไปแล้ว 3 รอบจะอยู่ในแถวรอบ 3 แถวเดียว
            ไม่ถูกนับซ้ำในรอบก่อนหน้า · รอบ 4 ขึ้นไปรวบเข้ารอบ 3
          </p>
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
                      /* หน้าโทรของฉันเปิดกลับมาแล้ว (11 ส.ค. 2569 รอบหก) —
                         รับแล้วต้องมีที่ไปโทร+บันทึกผล ไม่งั้นล็อกค้างจนหมดอายุเอง */
                      <Link
                        to="/matching/my-calls"
                        className={cn('text-[11px] font-bold underline-offset-2 hover:underline', TONE.success.value)}
                      >
                        รับแล้ว → ไปหน้าโทรของฉัน
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
      ) : null}
      {/* ไม่มีแถบเขียว "ยังไม่มีใครตกถัง ต้องคนตาม" แล้ว (เจ้าของสั่งเอาออก 10 ส.ค. 2569)
          — ช่อง "ต้องคนตาม" ในแถบตัวเลขด้านบนบอกเลข 0 อยู่แล้ว แถบนี้เลยเป็นการพูดซ้ำ */}
    </div>
  );
};

export default CallFunnelPanel;
