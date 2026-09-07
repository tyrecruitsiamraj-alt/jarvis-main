/**
 * ═══ "คิวงานของฉัน" — หน้าเดียวจบงาน (ออกแบบใหม่จริง · 5 ก.ย. 2569) ═══
 *
 * เจ้าของตีกลับว่ารอบก่อน *"ไม่ได้มีอะไรใหม่เลย ก็ที่ฉันเคยทำไว้ทั้งนั้น"* — ถูกต้อง
 * รอบก่อนคือ **ทาสีใหม่ + ถอดของประดับ** โครงหน้ายังเป็นของเดิมทุกหน้า
 * รอบนี้เจ้าของเลือกทิศทาง **"หน้าเดียวจบงาน"**:
 *
 *   เดิม: เห็นว่ามีงานค้าง → **กระโดดไปอีกหน้า** → หาแถวนั้นให้เจอ → ทำ → ย้อนกลับมา
 *   ใหม่: คิวอยู่ซ้าย · กดแล้ว **ลิ้นชักงานเปิดข้างขวาในหน้าเดียวกัน** ทำจบตรงนั้น
 *
 * 🔴 กติกาที่ยึด (เจ้าของวางไว้เอง):
 * 1. **ไม่ยิง API ใหม่แม้แต่เส้นเดียว** — ประกอบจาก `flow-summary` + `office-floor`
 *    ชุดเดียวกับหน้าแรก (เส้นพวกนี้แตะ ERP เพิ่มเส้น = ทั้งระบบช้าลง)
 * 2. **ไม่มีข้อมูลไหนหาย** — ทุกแถวยังมีทางเปิดหน้าเต็มของเดิมเสมอ
 * 3. **อยู่หลังสวิตช์ `?ui=v2`** — คนที่ไม่ได้เปิดสวิตช์ไม่มีทางเจอหน้านี้ (production ปลอดภัย)
 * 4. ปุ่มที่ "ทำจริง" ใช้เส้นเดิมทั้งหมด (`saveProposal` เส้นเดียวกับปุ่มจองหน้า Matching)
 *    ⇒ กติกาเดิมติดมาครบ เช่น 1 คนจองได้ใบเดียว (backend ตอบ 409)
 *
 * **ภาษาการออกแบบ** (จากตัวอย่างที่เจ้าของส่งมา — แต่เป็นจานขาว/กรมท่า/เบอร์กันดี + Kanit):
 * หัวเรื่องใหญ่กินพื้นที่ · แถวงานเป็น **เส้นบางไม่มีกล่อง** · เลข 01–04 นำแถว ·
 * ที่ว่างเยอะ · ขยับแค่ตอนเข้าหน้าและตอนชี้เมาส์ (ไม่มีอะไรวนไม่จบ)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, ExternalLink, Phone, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet2, StatRow2, Stat2 } from '@/components/shared/ui-v2/Sheet2';
import { useAuth } from '@/contexts/AuthContext';
import { useUiV2 } from '@/lib/uiV2';
import { cn } from '@/lib/utils';
import { buildNextTasks, type NextTaskTone } from '@/lib/nextTask';
import {
  callBoxCount,
  fetchFlowSummary,
  type FlowFollowUpItem,
  type FlowSummary,
} from '@/lib/flowSummaryApi';
import { fetchOfficeFloor, type OfficeFloorResponse } from '@/lib/officeFloorApi';
import { bookingActionFor, bookingTargetFromPersonRef } from '@/lib/callResultBooking';
import { ProposalConflictError, saveProposal } from '@/lib/candidateProposalsApi';
import { METRICS } from '@/lib/metricDictionary';
import {
  bookingKeyOf,
  buildWorkQueueRows,
  workQueueHeadline,
  type WorkPersonGroup,
  type WorkQueueRow,
} from '@/lib/workQueueRows';

/** สีป้ายตามความด่วน — ความหมายเดิมของทั้งระบบ (ไม่ใช่สีแบรนด์) */
const TONE_TEXT: Record<NextTaskTone, string> = {
  danger: 'text-red-700 dark:text-red-300',
  warn: 'text-amber-700 dark:text-amber-300',
  info: 'text-sky-700 dark:text-sky-300',
};

const PERSON_GROUP: Record<
  WorkPersonGroup,
  { title: string; reason: string; badge: string; tone: NextTaskTone; action: string }
> = {
  confirmed: {
    title: 'สนใจงานแล้ว — จองตัวได้เลย',
    reason: 'AI โทรแล้วตอบว่าสนใจ ยังไม่มีใครรับช่วงต่อ',
    badge: 'รอจองตัว',
    tone: 'info',
    action: 'จองตัวเลย',
  },
  needs_human: {
    title: 'AI คุยต่อไม่ได้ — ต้องคนโทรเอง',
    reason: 'ครบเพดานการโทรหรือคุยแล้วไม่จบ ต้องมีคนตามต่อ',
    badge: 'ต้องคนตาม',
    tone: 'danger',
    action: 'เปิดหน้าติดตาม',
  },
};

/* ── แถวในคิว — เส้นบาง ไม่มีกล่อง (ภาษาเดียวกับตัวอย่างที่เจ้าของส่งมา) ─────── */
const QueueRowButton: React.FC<{
  index: number;
  title: string;
  reason: string;
  badge: string;
  tone: NextTaskTone;
  count?: number;
  active: boolean;
  onSelect: () => void;
}> = ({ index, title, reason, badge, tone, count, active, onSelect }) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group flex w-full items-start gap-4 border-l-2 px-4 py-4 text-left transition-colors sm:px-6',
        active ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/50',
      )}
    >
      <span className="pt-0.5 text-[12px] font-semibold tabular-nums text-primary/70">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-snug text-foreground">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">
          {reason}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3 pt-0.5">
        {typeof count === 'number' ? (
          <span className="text-[15px] font-semibold tabular-nums text-foreground">
            {count.toLocaleString('th-TH')}
          </span>
        ) : null}
        <span className={cn('hidden text-[11.5px] sm:block', TONE_TEXT[tone])}>{badge}</span>
        <ArrowRight
          className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </button>
  </li>
);

/**
 * ── หนึ่งก้อนของคิว ────────────────────────────────────────────────────────────
 * 🔴 **เลขลำดับเริ่มใหม่ที่ 01 ทุกก้อน** — เพราะสองก้อนนี้คนละหน่วย (กอง ↔ คน)
 * ถ้าเรียงเลขต่อกันคนจะอ่านว่าเป็นลิสต์เดียว แล้วเอาความยาวไปบวกกันอีก
 */
const QueueSection: React.FC<{
  eyebrow: React.ReactNode;
  /** สรุปหน่วย+ยอดจริงของก้อนนี้ — บอกด้วยว่าลิสต์ถูกตัดหรือเปล่า */
  summary: React.ReactNode;
  emptyText: string;
  rows: WorkQueueRow[];
  selectedId?: string;
  onSelect: (id: string) => void;
  action?: React.ReactNode;
}> = ({ eyebrow, summary, emptyText, rows, selectedId, onSelect, action }) => (
  <Sheet2 className="animate-in fade-in slide-in-from-bottom-2 duration-500">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 pb-2 pt-5 lg:px-8">
      <span className="text-[12.5px] font-medium text-foreground">{eyebrow}</span>
      <span className="text-[12px] text-muted-foreground">{summary}</span>
      <span className="flex-1" />
      {action}
    </div>
    {rows.length === 0 ? (
      <p className="px-6 py-8 text-center text-[13px] text-muted-foreground lg:px-8">{emptyText}</p>
    ) : (
      <ol className="divide-y divide-border/50 border-t border-border/60">
        {rows.map((r, i) => (
          <QueueRowButton
            key={r.id}
            index={i}
            title={r.kind === 'bucket' ? r.task.title : r.item.name || r.item.person_ref}
            reason={
              r.kind === 'bucket' ? r.task.reason : r.item.summary || PERSON_GROUP[r.group].reason
            }
            badge={r.kind === 'bucket' ? r.task.badge : PERSON_GROUP[r.group].badge}
            tone={r.kind === 'bucket' ? r.task.tone : PERSON_GROUP[r.group].tone}
            count={r.kind === 'bucket' ? r.task.count : undefined}
            active={selectedId === r.id}
            onSelect={() => onSelect(r.id)}
          />
        ))}
      </ol>
    )}
  </Sheet2>
);

/* ── ลิ้นชักงานฝั่งขวา — "ทำจบตรงนี้" ────────────────────────────────────────── */
const DetailPane: React.FC<{
  row: WorkQueueRow | null;
  booked: Record<string, true>;
  busy: boolean;
  bookError: string | null;
  onBook: (item: FlowFollowUpItem) => void;
}> = ({ row, booked, busy, bookError, onBook }) => {
  if (!row) {
    return (
      <div className="px-6 py-10 text-center text-[13px] text-muted-foreground">
        เลือกงานทางซ้ายเพื่อดูรายละเอียดและลงมือได้ที่นี่
      </div>
    );
  }

  if (row.kind === 'bucket') {
    const t = row.task;
    return (
      <div className="px-6 py-6">
        <p className={cn('text-[11.5px] font-medium', TONE_TEXT[t.tone])}>{t.badge}</p>
        <h2 className="mt-1.5 text-[22px] font-semibold leading-snug tracking-tight">{t.title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{t.reason}</p>

        <dl className="mt-5 border-t border-border/60 pt-4 text-[13px]">
          <div className="flex items-baseline justify-between py-1.5">
            <dt className="text-muted-foreground">จำนวนที่ค้าง</dt>
            <dd className="font-semibold tabular-nums">{t.count.toLocaleString('th-TH')}</dd>
          </div>
        </dl>

        {/* 🔴 กองงานทั้งถังยังต้องเปิดหน้าเต็มไปทำ — ปุ่มนี้คือ "ทางเดิม" ที่ห้ามหาย */}
        <Button asChild className="mt-5 w-full rounded-full">
          <Link to={t.path}>
            {t.action}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    );
  }

  const item = row.item;
  const meta = PERSON_GROUP[row.group];
  const target = bookingTargetFromPersonRef(item.person_ref);
  const action = bookingActionFor({
    target,
    jobId: item.job_ref,
    personRef: item.person_ref,
    alreadyBooked: booked[bookingKeyOf(item)] === true,
    busy,
  });

  return (
    <div className="px-6 py-6">
      <p className={cn('text-[11.5px] font-medium', TONE_TEXT[meta.tone])}>{meta.badge}</p>
      <h2 className="mt-1.5 text-[22px] font-semibold leading-snug tracking-tight">
        {item.name || item.person_ref}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        {item.summary || meta.reason}
      </p>

      <dl className="mt-5 space-y-0 border-t border-border/60 pt-2 text-[13px]">
        {[
          ['ใบขอ', item.request_no || '—'],
          ['ตำแหน่ง', item.job_position || '—'],
          ['หน่วยงาน', item.job_unit || '—'],
          ['เบอร์โทร', item.phone || '—'],
          ['ผลโทรล่าสุด', item.outcome || '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 border-b border-border/40 py-2">
            <dt className="shrink-0 text-muted-foreground">{k}</dt>
            <dd className="min-w-0 truncate text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 space-y-2">
        {row.group === 'confirmed' ? (
          <>
            <Button
              type="button"
              className="w-full rounded-full"
              disabled={action.disabled}
              title={action.reason}
              onClick={() => onBook(item)}
            >
              {action.disabled ? action.reason : meta.action}
            </Button>
            {/* 🔴 ปิดปุ่มเมื่อไหร่ต้องบอกเหตุผลเสมอ (กติกาเดิม มีเทสต์คุมที่ callResultBooking) */}
            {bookError ? <p className="text-[12px] text-destructive">{bookError}</p> : null}
          </>
        ) : null}

        {item.phone ? (
          <Button asChild variant="outline" className="w-full rounded-full">
            <a href={`tel:${item.phone}`}>
              <Phone aria-hidden />
              โทรหาเอง {item.phone}
            </a>
          </Button>
        ) : null}

        <Button asChild variant="outline" className="w-full rounded-full">
          <Link to="/follow">
            <ExternalLink aria-hidden />
            เปิดหน้าติดตามแบบเต็ม
          </Link>
        </Button>
      </div>
    </div>
  );
};

const WorkQueuePage: React.FC = () => {
  const uiV2 = useUiV2();
  const { user } = useAuth();

  const [flow, setFlow] = useState<FlowSummary | null>(null);
  const [office, setOffice] = useState<OfficeFloorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booked, setBooked] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [f, o] = await Promise.all([
      fetchFlowSummary().catch(() => null),
      fetchOfficeFloor().catch(() => null),
    ]);
    setFlow(f);
    setOffice(o);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** กองงาน — ตรรกะเดียวกับคิวหน้าแรกเป๊ะ (ไฟล์ `nextTask.ts` ที่มีเทสต์คุมอยู่แล้ว) */
  const tasks = useMemo(
    () =>
      // 🔴 ป้อนค่าชุดเดียวกับหน้าแรกเป๊ะ — ถ้าคิวสองหน้าไม่ตรงกัน คนจะเลิกเชื่อทั้งคู่
      buildNextTasks({
        followPastDue: office ? office.counts.follow.pastDue : null,
        applicantsUntouched: office ? office.counts.intake.untouched : null,
        claimedIdle: office ? office.counts.intake.claimedIdle : null,
        callsStale: flow ? flow.lumos.stale_delivered : null,
        needsHuman: flow ? callBoxCount(flow, 'needs_human') : null,
        slaBreached: flow ? (flow.jobs.sla_breached ?? null) : null,
      }),
    [office, flow],
  );

  /**
   * แยกคิวเป็นสองก้อน **คนละหน่วย** (ตรรกะ+เทสต์อยู่ที่ `src/lib/workQueueRows.ts`)
   * กองงาน = ถังทั้งใบ · คนที่ตัดสินใจได้เลย = รายคนจาก flow-summary ที่โหลดอยู่แล้ว
   */
  const queue = useMemo(
    () =>
      buildWorkQueueRows({
        tasks,
        confirmed: flow?.call_boxes.confirmed ?? [],
        needsHuman: flow?.call_boxes.needs_human ?? [],
        confirmedTotal: flow ? callBoxCount(flow, 'confirmed') : null,
        needsHumanTotal: flow ? callBoxCount(flow, 'needs_human') : null,
      }),
    [tasks, flow],
  );

  const allRows = useMemo(() => [...queue.buckets, ...queue.people], [queue]);
  const selected = allRows.find((r) => r.id === selectedId) ?? allRows[0] ?? null;

  /** จองตัว — เส้นเดียวกับปุ่มจองหน้า Matching/หน้าแรก (ไม่ได้เขียนตรรกะใหม่) */
  const book = async (item: FlowFollowUpItem) => {
    const target = bookingTargetFromPersonRef(item.person_ref);
    if (!target || busy) return;
    setBusy(true);
    setBookError(null);
    try {
      await saveProposal({
        jobId: item.job_ref,
        requestNo: item.request_no || null,
        source: target.source,
        candidateRef: target.candidateRef,
        candidateName: item.name,
        candidatePhone: item.phone,
        operatorName: user?.full_name || user?.username || null,
        status: 'reserved',
      });
      setBooked((p) => ({ ...p, [bookingKeyOf(item)]: true }));
      void load();
    } catch (e) {
      setBookError(
        e instanceof ProposalConflictError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'จองตัวไม่สำเร็จ',
      );
    } finally {
      setBusy(false);
    }
  };

  // 🔴 หน้านี้เป็นของโฉมใหม่ล้วน — ไม่ได้เปิดสวิตช์ = ไม่มีหน้านี้ (กลับหน้าแรกของเดิม)
  if (!uiV2) return <Navigate to="/" replace />;

  const totalToDo = tasks.reduce((a, t) => a + t.count, 0);
  const pastDue = office?.counts.follow.pastDue ?? null;
  const waitingAi = office?.counts.aiCalls.waitingResult ?? null;
  const th = (n: number) => n.toLocaleString('th-TH');

  const refreshButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void load()}
      disabled={loading}
      className="h-8 px-2.5 text-muted-foreground"
    >
      <RefreshCw className={cn(loading && 'animate-spin')} aria-hidden />
      รีเฟรช
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 md:py-9">
      {/* ═══ หัวหน้า — ตัวใหญ่ ที่ว่างเยอะ แถวตัวเลขคั่นเส้นบาง ═══ */}
      <Sheet2 className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="px-6 pb-6 pt-7 lg:px-8">
          <p className="text-[12.5px] font-medium text-primary">คิวงานของคุณ</p>
          {/* 🔴 พาดหัวบอกสองหน่วยแยกกัน — เดิมยุบเป็น "เหลือ N เรื่อง" ซึ่งเอากองงาน
              มาบวกกับจำนวนคน (ถ้อยคำอยู่ที่ `workQueueHeadline` มีเทสต์คุม) */}
          <h1 className="mt-2 max-w-[24ch] text-[clamp(26px,3.6vw,42px)] font-semibold leading-[1.15] tracking-tight">
            {loading ? 'กำลังรวบรวมงานที่ต้องลงมือ…' : workQueueHeadline(queue)}
          </h1>
          <p className="mt-3 max-w-[60ch] text-[13.5px] leading-relaxed text-muted-foreground">
            ทุกเรื่องรวมไว้ที่เดียว — กดที่แถวแล้วทำต่อได้เลยทางขวา ไม่ต้องเปิดหลายหน้า
            <br />
            ข้างล่างแยกเป็นสองก้อน: <b className="font-medium text-foreground">กองงาน</b> นับเป็น
            &quot;กอง&quot; (กองเดียวมีได้หลายร้อยรายการ) ส่วน{' '}
            <b className="font-medium text-foreground">คนที่ตัดสินใจได้เลย</b> นับเป็น
            &quot;คน&quot; — สองเลขนี้บวกกันไม่ได้
          </p>
        </div>

        {/* 🔴 ช่องไหนยังไม่รู้ค่า = ขีด ไม่ใช่ 0 (กติกาเดิมของทั้งระบบ)
            ป้ายทุกช่องอ่านจากพจนานุกรมเลข ไม่พิมพ์เอง (กติกา metricDictionary) */}
        <StatRow2>
          <Stat2
            value={loading ? '—' : th(queue.buckets.length)}
            label={METRICS['work.queue_buckets'].label}
            hint="นับเป็นกอง — กดกองแล้วไปเคลียร์ที่หน้าเต็ม"
          />
          {/* Wave 2.4 (5 ก.ย. 2569): ผู้ทดสอบตาใหม่เอาเลขนี้ไปเทียบกับ "เหลือหา" ของ
              ศูนย์ควบคุมใบขอแล้วงงว่าทำไมไม่ตรง — คนละนิยามกันคนละเรื่อง
              (ตัวนี้นับ "เรื่องในคิวงาน" · อีกตัวนับ "อัตราที่ยังหาไม่ได้")
              ⚠️ เติมคำกำกับอย่างเดียว ไม่แตะตัวเลข/ตรรกะ */}
          <Stat2
            value={loading ? '—' : th(totalToDo)}
            label={METRICS['work.backlog_total'].label}
            hint={'ผลบวกของทุกกอง — คนละเลขกับ "เหลือหา" ของศูนย์ควบคุมใบขอ'}
          />
          <Stat2
            value={pastDue === null ? '—' : th(pastDue)}
            label={METRICS['closing.follow_past_due'].label}
            valueClassName={pastDue ? 'text-red-700 dark:text-red-300' : undefined}
          />
          {/* 🔴 ยอดจริงจาก `call_box_counts` — เดิมใช้ `.length` ของลิสต์ที่ SQL ตัดที่ 50 */}
          <Stat2
            value={flow ? th(queue.confirmedTotal) : '—'}
            label={METRICS['work.ready_to_book'].label}
            hint={waitingAi === null ? undefined : `รอผล AI อีก ${th(waitingAi)}`}
          />
        </StatRow2>
      </Sheet2>

      {/* ═══ ซ้าย: คิวสองก้อน · ขวา: ลิ้นชักงาน ═══ */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {queue.empty && !loading ? (
            <Sheet2 className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center justify-between px-6 pb-2 pt-5 lg:px-8">
                <span className="text-[12.5px] font-medium text-foreground">คิวงาน</span>
                {refreshButton}
              </div>
              <p className="px-6 py-10 text-center text-[13px] text-muted-foreground lg:px-8">
                ถังที่ระบบเฝ้าอยู่ว่างหมด — เปิดหน้าแรกเพื่อดูตัวเลขวันนี้
              </p>
            </Sheet2>
          ) : (
            <>
              {/* ── ก้อนที่ 1: กองงาน (หน่วย "กอง" · เลข 01 เป็นต้นไป) ── */}
              <QueueSection
                eyebrow="กองงาน · ทำก่อน → หลัง"
                /* ⚠️ ห้ามพิมพ์ยอดรวมของค้างซ้ำที่นี่ — ช่อง "งานค้างรวมทั้งระบบ" ข้างบน
                   นับ**ทุกถัง** รวมถังที่ถูกกางเป็นรายคนไปแล้ว (นิยามเดียวกับคิวหน้าแรก)
                   เอามาโชว์คู่กันเมื่อไหร่ สองเลขจะไม่ตรงกันแล้วคนจะเลิกเชื่อทั้งคู่ */
                summary={
                  loading
                    ? 'กำลังรวบรวม…'
                    : `${th(queue.buckets.length)} กอง · เรียงตามความด่วน ไม่ใช่ตามจำนวน`
                }
                emptyText={loading ? 'กำลังรวบรวมกองงาน…' : 'ไม่มีกองงานค้างตอนนี้'}
                rows={queue.buckets}
                selectedId={selected?.id}
                onSelect={setSelectedId}
                action={refreshButton}
              />

              {/* ── ก้อนที่ 2: รายคน (หน่วย "คน" · เลขลำดับ **เริ่มใหม่** ที่ 01) ── */}
              <QueueSection
                eyebrow={`${METRICS['work.queue_people'].label} · ตัดสินใจได้เลยในหน้านี้`}
                summary={
                  loading
                    ? 'กำลังรวบรวม…'
                    : `${th(queue.peopleTotal)} คน · สนใจงานรอจองตัว ${th(queue.confirmedTotal)} · ต้องคนโทรเอง ${th(queue.needsHumanTotal)}` +
                      // 🔴 ลิสต์จาก API ถูกตัดที่ 50 แถว — ต้องบอก ไม่ใช่เงียบ
                      (queue.peopleTruncated ? ` · แสดง ${th(queue.people.length)} รายแรก` : '')
                }
                emptyText={loading ? 'กำลังรวบรวมรายชื่อ…' : 'ยังไม่มีใครรอให้ตัดสินใจตอนนี้'}
                rows={queue.people}
                selectedId={selected?.id}
                onSelect={setSelectedId}
              />
            </>
          )}
        </div>

        <Sheet2 className="h-fit lg:sticky lg:top-24">
          <DetailPane
            row={selected}
            booked={booked}
            busy={busy}
            bookError={bookError}
            onBook={(item) => void book(item)}
          />
        </Sheet2>
      </div>
    </div>
  );
};

export default WorkQueuePage;
