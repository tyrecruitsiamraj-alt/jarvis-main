import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PhoneForwarded,
  ArrowRight,
  ArrowDown,
  PhoneCall,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  LoaderCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BrandTitle } from '@/components/shared/BrandMark';
import { resolveUnitNavPath } from '@/lib/jobUnitSessionState';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  fetchFlowSummary,
  confirmedThisMonth,
  type FlowSummary,
  type FlowFollowUpItem,
} from '@/lib/flowSummaryApi';


/** ก้อนตัวเลข 1 ขั้นใน funnel — กดแล้วพาไปหน้าที่เกี่ยวข้อง */
function FlowStage({
  label,
  value,
  sub,
  onClick,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="jarvis-stat-tile min-w-0 flex-1"
    >
      <div className="jarvis-stat-label">{label}</div>
      <div className={cn('jarvis-stat-value', accent)}>{value}</div>
      {sub ? <div className="jarvis-stat-sub">{sub}</div> : null}
    </button>
  );
}

/** โทนสีบอกสถานะของรายการติดตาม — เขียว=พร้อม/สนใจ · เหลือง=รอโทรซ้ำ · แดง=ติดขัด/ไม่มีคน */
const FOLLOW_UP_TONE = {
  good: {
    row: 'border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/70',
    dot: '🟢',
    hint: 'พร้อม — กดจองได้เลย',
  },
  warn: {
    row: 'border-amber-200 bg-amber-50/80 hover:bg-amber-100/70',
    dot: '🟡',
    hint: 'รอโทรซ้ำ',
  },
  bad: {
    row: 'border-red-200 bg-red-50/80 hover:bg-red-100/70',
    dot: '🔴',
    hint: 'ติดขัด — ต้องมีคนตัดสินใจ',
  },
} as const;
type FollowUpTone = keyof typeof FOLLOW_UP_TONE;

/** รายการคนที่ต้องตามต่อจากผลโทร — สีของแถวบอกสถานะเอง กดแล้วเปิดใบขอนั้นในหน้า Matching */
function FollowUpList({
  items,
  tone,
  emptyHidden,
  onOpen,
}: {
  items: FlowFollowUpItem[];
  tone: FollowUpTone;
  emptyHidden?: boolean;
  onOpen: (item: FlowFollowUpItem) => void;
}) {
  if (items.length === 0 && emptyHidden) return null;
  const t = FOLLOW_UP_TONE[tone];
  return (
    <div className="mt-1.5 space-y-1">
      {items.slice(0, 3).map((it) => (
        <button
          key={`${it.job_ref}:${it.person_ref}`}
          type="button"
          onClick={() => onOpen(it)}
          title={t.hint}
          className={cn('w-full rounded-lg border px-2 py-1.5 text-left', t.row)}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-foreground">
              <span aria-hidden>{t.dot}</span> {it.name || it.person_ref}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{it.request_no}</span>
          </div>
          {it.summary ? <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{it.summary}</p> : null}
        </button>
      ))}
      {items.length > 3 ? (
        <p className="text-[10px] text-muted-foreground">…และอีก {items.length - 3} รายการ</p>
      ) : null}
    </div>
  );
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // สรุปการไหลของงาน — ของหลักของหน้านี้ (เมนูทั้งหมดอยู่ใน burger แล้ว)
  const [flow, setFlow] = useState<FlowSummary | null>(null);
  const [flowLoading, setFlowLoading] = useState(true);

  const loadFlow = async () => {
    setFlowLoading(true);
    try {
      setFlow(await fetchFlowSummary());
    } catch {
      setFlow(null);
    } finally {
      setFlowLoading(false);
    }
  };

  useEffect(() => {
    void loadFlow();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';

  return (
    <div className="relative -mx-4 sm:-mx-5 md:-mx-6 lg:-mx-8 px-4 sm:px-5 md:px-6 lg:px-8 py-6 md:py-8">
      {/* subtle orb accent */}
      <div
        className="pointer-events-none absolute -top-8 right-0 h-40 w-40 jarvis-blue-orb opacity-30 blur-sm"
        aria-hidden
      />

      {/* ทักทายสั้น ๆ บรรทัดเดียว — login ปุ๊บต้องเห็น "การไหลของงานสรรหา" ทันที */}
      <p className="mb-4 text-sm text-muted-foreground">
        {greeting} <span className="font-semibold text-foreground">{user?.full_name}</span> ·{' '}
        <BrandTitle className="font-medium" />
      </p>

      {/* การไหลของงานสรรหา — งานเข้า → AI → โทร → จอง → ลงงาน (กดตัวเลขเพื่อไปหน้านั้น) */}
      {flowLoading && !flow ? (
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" aria-hidden />
          กำลังโหลดภาพรวมการไหลของงาน…
        </p>
      ) : null}
      {!flowLoading && !flow ? (
        <div className="glass-card mb-8 rounded-2xl border border-white/70 p-5 text-sm text-muted-foreground">
          โหลดภาพรวมไม่สำเร็จ —{' '}
          <button type="button" onClick={() => void loadFlow()} className="font-medium text-blue-600 hover:underline">
            ลองใหม่
          </button>{' '}
          หรือเปิดเมนูจากปุ่ม ☰ มุมซ้ายบน
        </div>
      ) : null}
      {flow ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="jarvis-section-title">
              การไหลของงานสรรหา · เดือนนี้
            </h2>
            <button
              type="button"
              onClick={() => void loadFlow()}
              disabled={flowLoading}
              className="jarvis-btn-ghost"
            >
              <RefreshCw className={cn('h-3 w-3', flowLoading && 'animate-spin')} /> รีเฟรช
            </button>
          </div>

          {/* Funnel หลัก */}
          <div className="glass-card rounded-[1.5rem] border border-white/70 p-3">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-stretch">
              <FlowStage
                label="ใบขอเปิดอยู่"
                value={flow.jobs.open_total}
                sub={`ด่วน ${flow.jobs.urgent} ใบ`}
                accent="text-slate-800"
                onClick={() => navigate(resolveUnitNavPath())}
              />
              <div className="flex items-center justify-center text-muted-foreground/60">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="AI แนะนำคนแล้ว"
                value={flow.jobs.with_recommend}
                sub={`จากที่ประเมิน ${flow.jobs.analyzed} ใบ`}
                accent="text-sky-700"
                onClick={() => navigate('/matching/match?workflow=green')}
              />
              <div className="flex items-center justify-center text-muted-foreground/60">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="ส่ง AI โทร"
                value={flow.lumos.sent_month}
                sub={`รอโทรอีก ${flow.lumos.waiting_call + flow.lumos.delivered_waiting}`}
                accent="text-blue-700"
                onClick={() => navigate('/matching/match')}
              />
              <div className="flex items-center justify-center text-muted-foreground/60">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="สนใจงาน (จากผลโทร)"
                value={confirmedThisMonth(flow)}
                sub={`ปฏิเสธ ${flow.lumos.outcomes_month['declined'] ?? 0} · ไม่รับสาย ${(flow.lumos.outcomes_month['no_answer'] ?? 0) + (flow.lumos.outcomes_month['unresponsive'] ?? 0)}`}
                accent="text-emerald-700"
                onClick={() => navigate('/matching/match')}
              />
              <div className="flex items-center justify-center text-muted-foreground/60">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="จองตัวอยู่ / ลงงาน"
                value={flow.proposals.reserved_active + flow.proposals.placed_month}
                sub={`จอง ${flow.proposals.reserved_active} · ลงงานเดือนนี้ ${flow.proposals.placed_month}`}
                accent="text-violet-700"
                onClick={() => navigate('/matching/reservations')}
              />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              ตัวเลขการเคลื่อนไหวนับเดือนนี้ · ของค้างนับทั้งหมด · เป็นสถานะการทำงานของทีม Matching ไม่ใช่ยอด
              "หาได้แล้ว/ปิดครบใบขอ" ทางการจากใบขอ
            </p>
          </div>

          {/* ต้องติดตาม + สำเร็จ */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {flow.follow_ups.confirmed_waiting.length > 0 ? (
              <div className="glass-card rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                  <PhoneCall className="h-3.5 w-3.5" />
                  สนใจงานแล้ว — รอคนกดจอง ({flow.follow_ups.confirmed_waiting.length})
                </div>
                <FollowUpList
                  items={flow.follow_ups.confirmed_waiting}
                  tone="good"
                  onOpen={(it) => navigate(`/matching/match?jobId=${encodeURIComponent(it.job_ref)}`)}
                />
              </div>
            ) : null}

            {flow.follow_ups.no_answer.length > 0 ? (
              <div className="glass-card rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  <PhoneForwarded className="h-3.5 w-3.5" />
                  ไม่รับสาย — ควรโทรซ้ำ ({flow.follow_ups.no_answer.length})
                </div>
                <FollowUpList
                  items={flow.follow_ups.no_answer}
                  tone="warn"
                  onOpen={(it) => navigate(`/matching/match?jobId=${encodeURIComponent(it.job_ref)}`)}
                />
              </div>
            ) : null}

            {flow.jobs.urgent_stuck > 0 || flow.lumos.stale_delivered > 0 ? (
              <div className="glass-card rounded-2xl border border-red-200/80 bg-red-50/40 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-900">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  ติดขัด — ต้องมีคนตัดสินใจ
                </div>
                {flow.jobs.urgent_stuck > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate('/matching/match?urgent=1&workflow=none')}
                    className="w-full rounded-lg border border-red-200 bg-red-50/80 px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-red-100/70"
                  >
                    <span aria-hidden>🔴</span> ใบด่วนที่ AI ไม่พบคน และยังไม่ส่งโพสหาคนใหม่ —{' '}
                    <span className="font-bold text-red-700">{flow.jobs.urgent_stuck} ใบ</span>
                  </button>
                ) : null}
                {flow.lumos.stale_delivered > 0 ? (
                  <div className="rounded-lg border border-red-200 bg-red-50/80 px-2 py-1.5 text-[11px] text-foreground">
                    <span aria-hidden>🔴</span> ส่ง AI โทรแล้วเกิน 2 วันยังไม่มีผลกลับ —{' '}
                    <span className="font-bold text-red-700">{flow.lumos.stale_delivered} ราย</span>
                    <span className="text-muted-foreground"> · ควรเช็คกับทีม Lumos</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {flow.follow_ups.confirmed_waiting.length === 0 &&
            flow.follow_ups.no_answer.length === 0 &&
            flow.jobs.urgent_stuck === 0 &&
            flow.lumos.stale_delivered === 0 ? (
              <div className="glass-card rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-3 lg:col-span-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  ไม่มีเรื่องค้างที่ต้องตามตอนนี้ — ผลโทรที่สนใจถูกจองครบ และใบด่วนมีคนดูแลแล้ว
                </div>
              </div>
            ) : null}
          </div>
        </motion.section>
      ) : null}
      {/* เมนูหลักถูกถอดออก — ทุกโมดูลเข้าถึงได้จากปุ่ม ☰ (burger) ที่ header อยู่แล้ว */}
    </div>
  );
};

export default HomePage;
