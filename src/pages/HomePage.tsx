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
 * โครงคอลัมน์ของ funnel — การ์ด 5 ช่องกว้างเท่ากัน คั่นด้วยช่องลูกศร 4 ช่อง
 *
 * ⚠️ ทั้งสองแถว (เส้นหลัก / เส้นที่ไม่มีคนแนะนำ) ต้องใช้ค่านี้ตัวเดียวกัน คอลัมน์จึงตรงกันเสมอ
 * เดิมใช้ flex ล้วน ซึ่งแบ่งความกว้างตาม **เนื้อหา** ของแต่ละแถว แถวล่างจึงกว้างกว่าและเยื้อง
 * (วัดจริง: การ์ด 214 vs 206 · เยื้อง 8–32px) `minmax(0,1fr)` บังคับให้ทุกช่องเท่ากันไม่ว่าข้างในยาวแค่ไหน
 * มือถือถอยเป็นเรียงลงล่างเหมือนเดิม
 */
const FLOW_ROW_GRID =
  'flex flex-col gap-1.5 sm:grid sm:items-stretch ' +
  'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]';

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
        'min-w-0 flex-1 rounded-2xl border border-white/[0.14] bg-white/[0.07] px-4 py-3 text-left transition-colors hover:bg-white/[0.12] !border-t-4',
        t.bar,
      )}
    >
      <div className="text-xs font-medium leading-tight text-slate-400">{label}</div>
      <div className={cn('mt-1 text-3xl font-bold leading-none tabular-nums tracking-tight', t.onDark)}>
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-[11px] leading-snug text-slate-400">{sub}</div> : null}
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
  const { user, hasPermission } = useAuth();

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
              เจ้าของสั่ง 10 ส.ค. 2569: แยก 2 บรรทัด — แถวบนคือเส้นที่ "มีคนแนะนำ" เดินต่อได้
              แถวล่างคือใบที่ AI ไม่พบคน ซึ่งไม่ได้เดินต่อในเส้นนี้ แต่โยงไป Content/Scraping
              (เดิมทั้งหมดอยู่แถวเดียว เส้นแยกเลยจมหาย อ่านผิดว่า Content ต่อจาก "จองตัว/ลงงาน") */}
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
            <div className={cn('mt-3', FLOW_ROW_GRID)}>
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
                tone="success"
                onClick={() => navigate('/matching/reservations')}
              />

            </div>

            {/* บรรทัดที่ 2 — ใบที่ AI ไม่พบคนของเรา ไม่ได้ไปต่อในเส้นบน แต่ถูกส่งต่อทีมอื่น
                เยื้องเข้ามาให้เห็นว่าแตกออกจาก "AI แนะนำคนแล้ว" ไม่ใช่ต่อจากขั้นสุดท้าย

                ⚠️ จังหวะของแถวนี้ต้องเท่าแถวบน (เจ้าของทัก 10 ส.ค. 2569 ว่า "จัดให้สวยแบบเส้นหลัก"):
                ใช้โครงคอลัมน์ตัวเดียวกัน (FLOW_ROW_GRID) คอลัมน์จึงตรงกันเสมอ

                ⚠️ **การ์ดนี้อยู่ใต้คอลัมน์ "AI แนะนำคนแล้ว" ห้ามย้ายไปคอลัมน์แรก**
                เคยวางไว้ใต้ "ใบขอเปิดอยู่" แล้วเจ้าของอ่านผิดทันที (10 ส.ค. 2569):
                "ดูแล้วไม่รู้ว่าไม่มีคนแนะนำคือเหลือมา มันเหมือนทั้งหมด + ไม่มีคนแนะนำ"
                — เลขสองตัวที่วางซ้อนคอลัมน์กันในแนวตั้งถูกอ่านว่า "เอามาบวกกัน" ไม่ใช่ "หักออก"
                วางใต้ 174 แทน = 314 แตกเป็น 174 กับ 140 อ่านออกว่าเป็นพี่น้องกัน ไม่ใช่ยอดใหม่
                ช่องแรกจึงเหลือเป็นป้าย "ที่เหลือจาก 314" พร้อมลูกศรชี้ลงเข้าการ์ด */}
            <div className={cn('mt-2 border-t border-white/10 pt-2', FLOW_ROW_GRID)}>
              {/* ⚠️ เคยมีป้าย "ที่เหลือจาก N ↳" ตรงนี้ — เจ้าของสั่งเอาออก 10 ส.ค. 2569
                  **ต้องคงกล่องเปล่าไว้** ไม่ใช่ลบทิ้ง เพราะคอลัมน์แรกเป็นช่อง `1fr` ของ grid
                  ถ้าไม่มีลูก การ์ด "ยังไม่มีคนแนะนำ" จะเลื่อนไปคอลัมน์ 1 แล้วหลุดจากใต้ 174 */}
              <div aria-hidden />
              <div className="hidden w-4 sm:block" aria-hidden />
              <FlowStage
                label="ยังไม่มีคนแนะนำ"
                value={Math.max(flow.jobs.open_total - flow.jobs.with_recommend, 0)}
                sub={
                  <>
                    {flow.jobs.open_total} − {flow.jobs.with_recommend} ที่แนะนำแล้ว
                    {flow.jobs.open_total > flow.jobs.analyzed ? (
                      <> · ยังไม่ได้ประเมิน {flow.jobs.open_total - flow.jobs.analyzed}</>
                    ) : null}
                  </>
                }
                tone="danger"
                onClick={() => navigate('/matching/match?workflow=none')}
              />
              <div className="flex items-center justify-center text-slate-500">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="ส่งคิด Content"
                value={flow.postings.content ?? 0}
                sub="ใบขอที่รอทีมคอนเทนต์ทำโพส"
                tone="orange"
                onClick={() => navigate('/matching/job-postings')}
              />
              {/* Content กับ Scraping เป็น "ปลายทางคู่ขนาน" ของถังเดียวกัน ไม่ใช่ขั้นต่อกัน
                  จึงคั่นด้วยจุด ไม่ใช่ลูกศร — แต่ต้องกว้าง w-4 เท่าไอคอนลูกศร ไม่งั้นช่องไฟเพี้ยน */}
              <div
                className="flex w-4 items-center justify-center text-base leading-none text-slate-600"
                aria-hidden
              >
                ·
              </div>
              {/* ห้ามซ้ำโทนกับ "ผลจากการโทร" (teal) ที่อยู่แถวบน — เจ้าของทักว่าดูแล้วสีเดียวกัน
                  แถวล่างจึงใช้คู่ ส้ม (Content) / ม่วง (Scraping) ซึ่งไม่ชนกับขั้นไหนในเส้นหลัก */}
              <FlowStage
                label="ส่ง Scraping"
                value={flow.postings.scraping ?? 0}
                sub="ใบขอที่รอไปดูดประกาศหาคน"
                tone="violet"
                onClick={() => navigate('/matching/job-postings')}
              />
              {/* ตัวคั่นเปล่าของคอลัมน์ที่ 8 — **ห้ามตัดทิ้ง** ถึงจะไม่มีอะไรให้แสดง
                  ช่อง `auto` ที่ไม่มีลูกจะยุบเหลือ 0 แล้วความกว้างที่หายไปถูกโยนไปให้ช่อง 1fr
                  ทำให้การ์ดแถวนี้กว้างกว่าแถวบนทันที (วัดแล้ว: ตัดทิ้ง = 213 vs 206 · คงไว้ = 206 เท่ากัน)
                  คอลัมน์ 9 ปล่อยว่างได้ เพราะ 1fr กว้างเท่ากันอยู่แล้วไม่ว่ามีลูกหรือไม่ */}
              <div className="hidden w-4 sm:block" aria-hidden />
            </div>

          {/* ⚠️ บรรทัดหมายเหตุ "ตัวเลขการเคลื่อนไหวนับเดือนนี้ · ของค้างนับทั้งหมด …"
              เคยอยู่ตรงนี้ — เจ้าของสั่งเอาออก 10 ส.ค. 2569 */}
          </PageHeroStrip>

          {/* ⚠️ เคยมี <CallFunnelPanel defaultSource="all" /> ตรงนี้ — เจ้าของสั่งเอาออก 10 ส.ค. 2569
              funnel การโทรอยู่หน้า Follow (ล็อกของหน้านั้น) และหน้า Matching (กดสลับต้นทางได้) */}

          {/* ⚠️ แผงอนุมัติชุด (CallBatchPanel) เคยอยู่ตรงนี้ — เจ้าของสั่งเอาออก 10 ส.ค. 2569
              **ย้ายไปหน้า Matching ไม่ได้ลบ** เพราะชุดที่รออนุมัติต้องมีที่ให้กด
              ไม่งั้นจะค้างถาวร (ตอนนี้มีค้างจริงบนฐาน) · หน้า Matching คือที่ที่ชุดถูกสร้าง
              จึงเป็นที่ที่ตรงกับงานที่สุด */}
          {/* ⚠️ กล่อง "งานโทรของฉัน" (CallStatusPanel) เคยอยู่ตรงนี้ — เจ้าของสั่งเอาออก
              10 ส.ค. 2569 · ลบคอมโพเนนต์ทิ้งด้วย ไม่มีหน้าไหนใช้แล้ว
              งานโทรที่ตัวเองถืออยู่ยังเห็นได้ที่การ์ดผู้สมัครในหน้า Matching (CallHoldPanel) */}

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
