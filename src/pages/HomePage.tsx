import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PhoneForwarded,
  ArrowRight,
  ArrowDown,
  Phone,
  PhoneCall,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  LoaderCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { BrandTitle } from '@/components/shared/BrandMark';
import { resolveUnitNavPath } from '@/lib/jobUnitSessionState';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TONE, type ToneKey } from '@/lib/designTokens';
import PageHeroStrip, { heroButton } from '@/components/shared/PageHeroStrip';
import {
  fetchFlowSummary,
  confirmedThisMonth,
  callResultsThisMonth,
  type FlowSummary,
  type FlowFollowUpItem,
} from '@/lib/flowSummaryApi';


/**
 * ก้อนตัวเลข 1 ขั้นใน funnel — กดแล้วพาไปหน้าที่เกี่ยวข้อง
 * สีทั้งแถบหัวการ์ดและตัวเลขมาจาก token กลางตัวเดียว (@/lib/designTokens) ไม่ประกาศ class สีที่นี่
 */
function FlowStage({
  label,
  value,
  sub,
  onClick,
  tone,
}: {
  label: string;
  value: number;
  /** รับ node ได้ — ขั้น "ผลจากการโทร" ใช้แต้มสีแยก สนใจ/ไม่สนใจ/ไม่รับ ในบรรทัดย่อย */
  sub?: React.ReactNode;
  onClick: () => void;
  /** โทนของขั้นนี้ — บอกว่าอยู่ช่วงไหนของสาย กวาดตาแยกได้ก่อนอ่านตัวเลข */
  tone: ToneKey;
}) {
  const t = TONE[tone];
  // ขั้น funnel อยู่บน hero เข้ม (mockup rev.3 ข้อ 01): กล่องโปร่งขอบบนสีตามขั้น
  // ตัวเลขใช้ TONE.onDark (โทนอ่อน) เพราะพื้นเข้มตลอดทั้งสองธีม
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-w-0 flex-1 rounded-xl border border-white/[0.14] bg-white/[0.07] px-3 py-2 text-left transition-colors hover:bg-white/[0.12] !border-t-[3px]',
        t.bar,
      )}
    >
      <div className="text-[10px] font-medium leading-tight text-slate-400">{label}</div>
      <div className={cn('mt-0.5 text-2xl font-bold leading-none tabular-nums tracking-tight', t.onDark)}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-[10px] leading-tight text-slate-400">{sub}</div> : null}
    </button>
  );
}

/** สถานะของรายการติดตาม — ผูกกับโทนกลาง: สำเร็จ=พร้อม/สนใจ · รอ=โทรซ้ำ · ติดขัด=ต้องมีคนตัดสินใจ */
const FOLLOW_UP_TONE = {
  good: {
    tone: 'success',
    dot: '🟢',
    hint: 'พร้อม — กดจองได้เลย',
  },
  warn: {
    tone: 'warn',
    dot: '🟡',
    hint: 'รอโทรซ้ำ',
  },
  bad: {
    tone: 'danger',
    dot: '🔴',
    hint: 'ติดขัด — ต้องมีคนตัดสินใจ',
  },
} as const satisfies Record<string, { tone: ToneKey; dot: string; hint: string }>;
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
          className={cn(
            'w-full rounded-lg border px-2 py-1.5 text-left',
            TONE[t.tone].soft,
            TONE[t.tone].softHover,
          )}
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
  // กดชื่อคนในการ์ดติดตาม → เปิดรายละเอียดคน + งานที่แมทไป ก่อนตัดสินใจเปิดใบขอ
  const [personDetail, setPersonDetail] = useState<{ item: FlowFollowUpItem; tone: FollowUpTone } | null>(null);

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
          {/* Funnel อยู่ใน hero เข้มตาม mockup rev.3 ข้อ 01 — เข้าระบบมาเจอการไหลของงานก่อนทุกอย่าง
              5 ขั้นหลัก + เส้นแยก "ไม่มีคนแนะนำ" อยู่ในแถวเดียวกัน (กดตัวเลขไปหน้านั้นได้เหมือนเดิม) */}
          {/* ไม่ติดป้าย "เดือนนี้" ทั้งแถบ — ตัวเลขปนกันสองแบบ (ของค้างนับทั้งหมด ·
              การเคลื่อนไหวนับเดือนนี้) ป้ายรวมจะโกหกครึ่งนึงเสมอ ให้บรรทัดท้ายอธิบายแทน */}
          <PageHeroStrip
            eyebrow="การไหลของงานสรรหา"
            actions={
              <button
                type="button"
                onClick={() => void loadFlow()}
                disabled={flowLoading}
                className={cn(heroButton, 'disabled:opacity-50')}
              >
                <RefreshCw className={cn('h-3 w-3', flowLoading && 'animate-spin')} /> รีเฟรช
              </button>
            }
          >
            <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-stretch">
              <FlowStage
                label="ใบขอเปิดอยู่"
                value={flow.jobs.open_total}
                sub={`ด่วน ${flow.jobs.urgent} ใบ`}
                tone="neutral"
                onClick={() => navigate(resolveUnitNavPath())}
              />
              <div className="flex items-center justify-center text-slate-500">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="AI แนะนำคนแล้ว"
                value={flow.jobs.with_recommend}
                sub={`จากที่ประเมิน ${flow.jobs.analyzed} ใบ`}
                tone="info"
                onClick={() => navigate('/matching/match?workflow=green')}
              />
              <div className="flex items-center justify-center text-slate-500">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="ส่ง AI โทร"
                value={flow.lumos.sent_month}
                sub={`รอโทรอีก ${flow.lumos.waiting_call + flow.lumos.delivered_waiting}`}
                tone="primary"
                onClick={() => navigate('/matching/match')}
              />
              <div className="flex items-center justify-center text-slate-500">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              {/* เลขใหญ่ = ผลกลับรวมทุกแบบ · บรรทัดย่อยแต้มสีตามความหมายชุดเดียวกับทั้งระบบ
                  (สนใจ=เขียว · ไม่สนใจ=แดง · ไม่รับ=เหลือง) เห็นปุ๊บรู้เลยว่าใครเป็นอะไร */}
              <FlowStage
                label="ผลจากการโทร"
                value={callResultsThisMonth(flow)}
                sub={
                  <span className="flex flex-wrap gap-x-1.5">
                    <span className={TONE.success.onDark}>สนใจ {confirmedThisMonth(flow)}</span>
                    <span className={TONE.danger.onDark}>ไม่สนใจ {flow.lumos.outcomes_month['declined'] ?? 0}</span>
                    <span className={TONE.warn.onDark}>
                      ไม่รับ {(flow.lumos.outcomes_month['no_answer'] ?? 0) + (flow.lumos.outcomes_month['unresponsive'] ?? 0)}
                    </span>
                  </span>
                }
                tone="teal"
                onClick={() => navigate('/follow')}
              />
              <div className="flex items-center justify-center text-slate-500">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="จองตัวอยู่ / ลงงาน"
                value={flow.proposals.reserved_active + flow.proposals.placed_month}
                sub={`จอง ${flow.proposals.reserved_active} · ลงงานเดือนนี้ ${flow.proposals.placed_month}`}
                tone="violet"
                onClick={() => navigate('/matching/reservations')}
              />

              {/* แยกเส้น ไม่ใช่ขั้นที่ 6 — ใบที่ AI หาคนของเราไม่ได้ ถูกส่งต่อทีมอื่นแทน
                  ป้ายกำกับไว้กันอ่านผิดว่าต่อจาก "จองตัว/ลงงาน" */}
              <div className="flex items-center justify-center gap-1.5 px-1">
                <span className="hidden h-8 w-px bg-white/20 sm:block" aria-hidden />
                <span className="text-[10px] font-medium leading-tight text-[#c9b184]">
                  ไม่มีคน
                  <br className="hidden sm:block" /> แนะนำ →
                </span>
              </div>
              <FlowStage
                label="ส่งคิด Content"
                value={flow.postings.content ?? 0}
                sub="ใบขอที่รอทีมคอนเทนต์ทำโพส"
                tone="orange"
                onClick={() => navigate('/matching/job-postings')}
              />
              <FlowStage
                label="ส่ง Scraping"
                value={flow.postings.scraping ?? 0}
                sub="ใบขอที่รอไปดูดประกาศหาคน"
                tone="teal"
                onClick={() => navigate('/matching/job-postings')}
              />
            </div>
            <p className="mt-2.5 text-[10px] leading-relaxed text-slate-400">
              ตัวเลขการเคลื่อนไหวนับเดือนนี้ · ของค้างนับทั้งหมด · เป็นสถานะการทำงานของทีม Matching ไม่ใช่ยอด
              "หาได้แล้ว/ปิดครบใบขอ" ทางการจากใบขอ
            </p>
          </PageHeroStrip>

          {/* ต้องติดตาม + สำเร็จ */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {flow.follow_ups.confirmed_waiting.length > 0 ? (
              <div className={cn('glass-card rounded-2xl border p-3', TONE.success.soft)}>
                <div className={cn('flex items-center gap-1.5 text-xs font-semibold', TONE.success.num)}>
                  <PhoneCall className="h-3.5 w-3.5" />
                  สนใจงานแล้ว — รอคนกดจอง ({flow.follow_ups.confirmed_waiting.length})
                </div>
                <FollowUpList
                  items={flow.follow_ups.confirmed_waiting}
                  tone="good"
                  onOpen={(it) => setPersonDetail({ item: it, tone: 'good' })}
                />
              </div>
            ) : null}

            {flow.follow_ups.no_answer.length > 0 ? (
              <div className={cn('glass-card rounded-2xl border p-3', TONE.warn.soft)}>
                <div className={cn('flex items-center gap-1.5 text-xs font-semibold', TONE.warn.num)}>
                  <PhoneForwarded className="h-3.5 w-3.5" />
                  ไม่รับสาย — ควรโทรซ้ำ ({flow.follow_ups.no_answer.length})
                </div>
                <FollowUpList
                  items={flow.follow_ups.no_answer}
                  tone="warn"
                  onOpen={(it) => setPersonDetail({ item: it, tone: 'warn' })}
                />
              </div>
            ) : null}

            {flow.jobs.urgent_stuck > 0 || flow.lumos.stale_delivered > 0 ? (
              <div className={cn('glass-card rounded-2xl border p-3 space-y-1.5', TONE.danger.soft)}>
                <div className={cn('flex items-center gap-1.5 text-xs font-semibold', TONE.danger.num)}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  ติดขัด — ต้องมีคนตัดสินใจ
                </div>
                {flow.jobs.urgent_stuck > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate('/matching/match?urgent=1&workflow=none')}
                    className={cn(
                      'w-full rounded-lg border px-2 py-1.5 text-left text-[11px] text-foreground',
                      TONE.danger.soft,
                      TONE.danger.softHover,
                    )}
                  >
                    <span aria-hidden>🔴</span> ใบด่วนที่ AI ไม่พบคน และยังไม่ส่งโพสหาคนใหม่ —{' '}
                    <span className={cn('font-bold', TONE.danger.value)}>{flow.jobs.urgent_stuck} ใบ</span>
                  </button>
                ) : null}
                {flow.lumos.stale_delivered > 0 ? (
                  <div className={cn('rounded-lg border px-2 py-1.5 text-[11px] text-foreground', TONE.danger.soft)}>
                    <span aria-hidden>🔴</span> ส่ง AI โทรแล้วเกิน 2 วันยังไม่มีผลกลับ —{' '}
                    <span className={cn('font-bold', TONE.danger.value)}>{flow.lumos.stale_delivered} ราย</span>
                    <span className="text-muted-foreground"> · ควรเช็คกับทีม Lumos</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {flow.follow_ups.confirmed_waiting.length === 0 &&
            flow.follow_ups.no_answer.length === 0 &&
            flow.jobs.urgent_stuck === 0 &&
            flow.lumos.stale_delivered === 0 ? (
              <div className={cn('glass-card rounded-2xl border p-3 lg:col-span-3', TONE.success.soft)}>
                <div className={cn('flex items-center gap-1.5 text-xs font-medium', TONE.success.value)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  ไม่มีเรื่องค้างที่ต้องตามตอนนี้ — ผลโทรที่สนใจถูกจองครบ และใบด่วนมีคนดูแลแล้ว
                </div>
              </div>
            ) : null}
          </div>
        </motion.section>
      ) : null}
      {/* เมนูหลักถูกถอดออก — ทุกโมดูลเข้าถึงได้จากปุ่ม ☰ (burger) ที่ header อยู่แล้ว */}

      {/* กดชื่อคนในการ์ดติดตาม → รายละเอียดคน + แมทกับงานอะไรไป ก่อนเปิดใบขอ */}
      <Dialog open={!!personDetail} onOpenChange={(o) => !o && setPersonDetail(null)}>
        <DialogContent className="max-w-sm">
          {personDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  <span aria-hidden>{FOLLOW_UP_TONE[personDetail.tone].dot}</span>{' '}
                  {personDetail.item.name || personDetail.item.person_ref}
                </DialogTitle>
                <DialogDescription>{FOLLOW_UP_TONE[personDetail.tone].hint}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">แมทกับใบขอ</p>
                  <p className="text-sm font-semibold text-foreground">
                    {personDetail.item.job_position || 'ไม่ระบุตำแหน่ง'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {personDetail.item.job_unit || '—'} ·{' '}
                    <span className="font-mono">{personDetail.item.request_no}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">ผลการโทรล่าสุด</p>
                  <p className="text-xs leading-relaxed text-foreground">
                    {personDetail.item.summary || 'ยังไม่มีสรุปบทสนทนา'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(personDetail.item.updated_at).toLocaleString('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {personDetail.item.phone ? (
                    <a href={`tel:${personDetail.item.phone}`} className="jarvis-btn-secondary">
                      <Phone className="h-3 w-3" /> {personDetail.item.phone}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      const jobRef = personDetail.item.job_ref;
                      setPersonDetail(null);
                      navigate(`/matching/match?jobId=${encodeURIComponent(jobRef)}`);
                    }}
                    className="jarvis-btn-primary"
                  >
                    เปิดใบขอนี้ →
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomePage;
