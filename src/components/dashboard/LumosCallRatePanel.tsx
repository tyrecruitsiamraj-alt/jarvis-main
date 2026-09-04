import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import DashboardExpandablePanel from '@/components/dashboard/analytics/DashboardExpandablePanel';
import { fetchCallRateSeries } from '@/lib/callFunnelApi';
import type { CallFunnelSource } from '@/lib/callFunnelApi';
import {
  ageText,
  bangkokTodayYmd,
  compareCallRate,
  stuckLevel,
  ymdAddDays,
  type CallRateDay,
  type CallRateWindow,
  type CallStuck,
  type TrendDir,
} from '@/lib/lumosCallRate';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * แผง "Rate ผลการโทร Lumos" — ตอบ 4 คำถามของเจ้าของ (3 ก.ย. 2569):
 * ส่งไปเท่าไหร่ · แยกผล (สำเร็จ/ปฏิเสธ/ไม่ถึงตัว) นับ+% · ปริมาณโตขึ้นหรือลดลง ·
 * ผลสำเร็จดีขึ้นหรือลดลง — เทียบ "ช่วงล่าสุด N วัน" กับ "N วันก่อนหน้านั้น"
 *
 * ⚠️ ตัวเลขที่นี่คือการทำงานของการโทร ไม่ใช่ "หาได้แล้ว/ปิดครบใบขอ" ทางการจาก ERP
 * (แดชบอร์ดก้อนบนเป็นเรื่องใบขอ — แผงนี้จงใจแยกก้อน ไม่ปนนิยาม)
 *
 * นิยามที่เขียนบนจอ (บทเรียน Haiku: คำอธิบายใน tooltip อย่างเดียว = ไม่มีอยู่จริง):
 * - ส่งไป = สายที่ส่งจริง ไม่รวมที่กดยกเลิก (ยกเลิกโชว์แยก)
 * - สำเร็จ = ตอบยืนยัน/สนใจ (confirmed) — รับสายเฉย ๆ ไม่นับเป็นสำเร็จ
 * - ปฏิเสธ = declined — งานเสนอ: "ไม่สนใจ" · งานติดตาม: "ไม่ไปแล้ว"
 * - % ทุกตัวคิดจากสายที่มีผลจริง (หักยกเลิก) — หลักเดียวกับ callFunnelMath
 */

/** ช่วงที่เลือกดูได้ — เทียบกับช่วงก่อนหน้าความยาวเท่ากันเสมอ */
const WINDOW_CHOICES = [7, 14, 30] as const;

/** ดึงมา 60 วันครั้งเดียว (ครอบ 30×2) — สลับช่วงบนจอไม่ต้องยิงซ้ำ สลับต้นทางค่อยยิงใหม่ */
const FETCH_DAYS = 60;

/** ต้นทางของสาย — ป้ายชุดเดียวกับแผงการโทรหน้าอื่น (Job Offer/iRecruit เป็นชื่อที่ใช้ทั้งระบบ) */
const SOURCE_TABS: Array<{ id: CallFunnelSource; label: string; hint: string }> = [
  { id: 'all', label: 'ทั้งหมด', hint: 'รวมทุกต้นทาง' },
  { id: 'board', label: 'Job Offer', hint: 'ที่ส่งจากหน้าจับคู่งาน (คนบนบอร์ด)' },
  { id: 'follow', label: 'งานติดตาม', hint: 'ที่ส่งจากหน้าติดตาม' },
  { id: 'irecruit', label: 'iRecruit', hint: 'ที่ส่งจากผลค้นหาคนที่ยังไม่สมัคร' },
];

// Intl ประกาศระดับโมดูลเสมอ (กติกาโปรเจกต์ — เคยทำหน้าอื่นช้ามาแล้ว)
const TH_DM = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' });

const fmtDay = (ymd: string): string => TH_DM.format(new Date(`${ymd}T00:00:00+07:00`));
const fmtN = (n: number): string => n.toLocaleString('th-TH');

/** ถังผลบนแผงนี้ — สีตามความหมาย (เขียว=จบดี แดง=จบไม่ดี เหลือง=ไม่ถึงตัว ฟ้า=ติดแต่ยังไม่จบ เทา=รอ) */
const BUCKETS: Array<{
  key: 'confirmed' | 'connectedOther' | 'declined' | 'unreached' | 'pending';
  label: string;
  tone: ToneKey;
}> = [
  { key: 'confirmed', label: 'สำเร็จ', tone: 'success' },
  { key: 'connectedOther', label: 'ติดแต่ยังไม่จบ', tone: 'info' },
  { key: 'declined', label: 'ปฏิเสธ', tone: 'danger' },
  { key: 'unreached', label: 'ไม่ถึงตัว', tone: 'warn' },
  { key: 'pending', label: 'รอผล', tone: 'neutral' },
];

type DayStack = {
  day: string;
  sent: number;
  cancelled: number;
  confirmed: number;
  connectedOther: number;
  declined: number;
  unreached: number;
  pending: number;
};

/** แปลงยอดวันเป็นชั้นของแท่งกราฟ — ทุกชั้นบวกกันต้องเท่ายอดส่ง (มีเทสต์เรื่องฐานใน lib แล้ว) */
function stackOf(d: CallRateDay | undefined, day: string): DayStack {
  if (!d) {
    return { day, sent: 0, cancelled: 0, confirmed: 0, connectedOther: 0, declined: 0, unreached: 0, pending: 0 };
  }
  const sent = Math.max(d.queued - d.cancelled, 0);
  return {
    day,
    sent,
    cancelled: d.cancelled,
    confirmed: d.confirmed,
    // "ติดแต่ยังไม่จบ" = คุยได้แต่ยังไม่ใช่ทั้งยืนยันและปฏิเสธ (รับสายเฉย ๆ / ขอเลื่อน)
    connectedOther: Math.max(d.connected - d.confirmed - d.declined, 0),
    declined: d.declined,
    unreached: d.unreached,
    pending: Math.max(sent - d.withResult, 0),
  };
}

const DirIcon: React.FC<{ dir: TrendDir | null }> = ({ dir }) => {
  if (dir === 'up') return <TrendingUp className="h-4 w-4" aria-hidden />;
  if (dir === 'down') return <TrendingDown className="h-4 w-4" aria-hidden />;
  return <Minus className="h-4 w-4" aria-hidden />;
};

/** กล่องตัวเลขหนึ่งถังของช่วงนี้ — เลข + % จากสายที่มีผลจริง */
const StatBox: React.FC<{
  label: string;
  value: number;
  pct?: number | null;
  tone: ToneKey;
  sub?: string;
}> = ({ label, value, pct, tone, sub }) => (
  <div className={cn('rounded-xl border p-3', TONE[tone].soft)}>
    <p className={cn('text-[11px] font-medium leading-tight', DASH.muted)}>{label}</p>
    <p className={cn('mt-1 text-2xl font-bold leading-none tabular-nums', TONE[tone].value)}>
      {fmtN(value)}
      {pct !== undefined && pct !== null ? (
        <span className="ml-1 text-sm font-semibold">({pct}%)</span>
      ) : null}
    </p>
    {sub ? <p className={cn('mt-1 text-[10px] leading-snug', DASH.muted)}>{sub}</p> : null}
  </div>
);

/**
 * บรรทัดคำตัดสินแนวโน้ม — ห้ามเดา: เทียบไม่ได้ต้องบอกตรง ๆ ว่าเพราะอะไร
 * (กติกาจอห้ามโกหก: null ≠ 0 ≠ เท่าเดิม)
 */
const TrendLine: React.FC<{
  title: string;
  dir: TrendDir | null;
  /** ข้อความผล เช่น "โตขึ้น +100%" — ส่งมาพร้อมทิศ */
  verdict: string;
  detail: string;
  /** ทิศไหนคือ "ข่าวดี" — ปริมาณโต = ดี · แต่ถ้าวันหน้ามีเมตริกที่ลง = ดี ให้กลับได้ */
  goodDir?: TrendDir;
}> = ({ title, dir, verdict, detail, goodDir = 'up' }) => {
  const tone: ToneKey = dir === null ? 'neutral' : dir === 'flat' ? 'neutral' : dir === goodDir ? 'success' : 'danger';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2', TONE[tone].soft)}>
      <span className={cn('text-xs font-semibold', DASH.cellStrong)}>{title}</span>
      <span className={cn('inline-flex items-center gap-1 text-sm font-bold', TONE[tone].value)}>
        <DirIcon dir={dir} />
        {verdict}
      </span>
      <span className={cn('text-[11px]', DASH.muted)}>{detail}</span>
    </div>
  );
};

/**
 * แถบ "ติดตรงไหน" — สายที่ยังไม่มีผลกลับ แยกสองขั้นที่คนละคนต้องแก้
 *
 * 🔴 ต้องพูดทุกสภาพ ห้ามเงียบ: ไม่มีค้าง = บอกว่าไม่มี · อ่านไม่ได้ = บอกว่าอ่านไม่ได้
 * (เงียบแล้วคนอ่านว่า "ปกติ" ซึ่งอาจไม่จริง — บทเรียนเดียวกับ lumosQueueDefs)
 */
const StuckStrip: React.FC<{ stuck: CallStuck | null }> = ({ stuck }) => {
  const level = stuckLevel(stuck);
  if (!stuck) {
    return (
      <div className={cn('rounded-xl border px-3 py-2', TONE.neutral.soft)}>
        <p className={cn('text-xs font-semibold', DASH.cellStrong)}>
          ติดตรงไหน — <span className={TONE.warn.value}>อ่านสถานะสายค้างไม่ได้</span>
        </p>
        <p className={cn('text-[11px]', DASH.muted)}>
          ไม่ได้แปลว่าไม่มีสายค้าง แค่ตอนนี้อ่านไม่ได้ — กดรีเฟรชอีกครั้ง
        </p>
      </div>
    );
  }
  if (level === 'ok') {
    return (
      <div className={cn('rounded-xl border px-3 py-2', TONE.success.soft)}>
        <p className={cn('text-xs font-semibold', DASH.cellStrong)}>
          ติดตรงไหน — <span className={TONE.success.value}>ไม่มีสายค้าง</span>
        </p>
        <p className={cn('text-[11px]', DASH.muted)}>ทุกสายที่ส่งไปมีผลกลับครบแล้ว</p>
      </div>
    );
  }
  const tone: ToneKey = level === 'alert' ? 'danger' : level === 'warn' ? 'orange' : 'info';
  const total = stuck.notDelivered + stuck.deliveredSilent;
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', TONE[tone].soft)}>
      <p className={cn('text-xs font-semibold', DASH.cellStrong)}>
        ติดตรงไหน —{' '}
        <span className={TONE[tone].value}>
          ยังไม่มีผลกลับ {fmtN(total)} สาย
          {level === 'alert' ? ' · ค้างข้ามคืนแล้ว' : ''}
        </span>
      </p>
      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
        {stuck.notDelivered > 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={cn('text-sm font-bold tabular-nums', TONE[tone].value)}>
              {fmtN(stuck.notDelivered)}
            </span>
            <span className={cn('text-[11px] font-semibold', DASH.cellStrong)}>ยังไม่ถึงมือ Lumos</span>
            <span className={cn('text-[11px]', DASH.muted)}>
              ค้างนานสุด {ageText(stuck.notDeliveredHours)} — สายยังไม่ถูกส่งออกจากระบบเรา (ฝั่งเราต้องดู)
            </span>
          </div>
        ) : null}
        {stuck.deliveredSilent > 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={cn('text-sm font-bold tabular-nums', TONE[tone].value)}>
              {fmtN(stuck.deliveredSilent)}
            </span>
            <span className={cn('text-[11px] font-semibold', DASH.cellStrong)}>Lumos รับไปแล้ว เงียบ</span>
            <span className={cn('text-[11px]', DASH.muted)}>
              ค้างนานสุด {ageText(stuck.deliveredSilentHours)} — ส่งถึงแล้วแต่ยังไม่ส่งผลกลับ (ฝั่ง Lumos ต้องดู)
            </span>
          </div>
        ) : null}
      </div>
      <p className={cn('mt-1 text-[10px]', DASH.muted)}>
        นับสายค้างทั้งหมดตอนนี้ ไม่ใช่แค่ในช่วงที่เลือก · ห้ามโทร 20:00–08:00 สายที่ตั้งไว้ตอนเย็นจึงค้างข้ามคืนได้ตามปกติ
      </p>
    </div>
  );
};

const LumosCallRatePanel: React.FC = () => {
  // เปิดค้างเป็นค่าเริ่มต้น — เจ้าของสั่งทำแผงนี้เพื่อดูโดยเฉพาะ (แผงอื่นในหน้าเริ่มหุบ)
  const [open, setOpen] = useState(true);
  const [source, setSource] = useState<CallFunnelSource>('all');
  const [windowDays, setWindowDays] = useState<(typeof WINDOW_CHOICES)[number]>(7);
  /** undefined = กำลังโหลด · null = อ่านไม่ได้ (ห้ามโชว์ 0) · [] = อ่านได้แต่ไม่มีสาย */
  const [series, setSeries] = useState<CallRateDay[] | null | undefined>(undefined);
  /** งานค้างตอนนี้ (ไม่ผูกกับช่วงที่เลือก) — null = อ่านไม่ได้ ห้ามแปลว่า "ไม่มีค้าง" */
  const [stuck, setStuck] = useState<CallStuck | null>(null);

  const load = useCallback(() => {
    setSeries(undefined);
    void fetchCallRateSeries(FETCH_DAYS, source).then((res) => {
      setSeries(res ? res.series : null);
      setStuck(res?.stuck ?? null);
    });
  }, [source]);

  useEffect(() => load(), [load]);

  const todayYmd = bangkokTodayYmd();

  const trend = useMemo(
    () => (Array.isArray(series) ? compareCallRate(series, windowDays, todayYmd) : null),
    [series, windowDays, todayYmd],
  );

  /** แท่งรายวันของสองช่วงติดกัน (ช่วงก่อน + ช่วงนี้) — ช่องว่างของวันที่ไม่มีสายมีความหมาย */
  const bars = useMemo(() => {
    if (!Array.isArray(series)) return [];
    const byDay = new Map(series.map((d) => [d.day, d]));
    const from = ymdAddDays(todayYmd, -(windowDays * 2 - 1));
    const out: DayStack[] = [];
    for (let i = 0; i < windowDays * 2; i += 1) {
      const day = ymdAddDays(from, i);
      out.push(stackOf(byDay.get(day), day));
    }
    return out;
  }, [series, windowDays, todayYmd]);

  const maxSent = Math.max(1, ...bars.map((b) => b.sent));

  /** ยอดสะสมทั้งช่วงที่ดึงมา (60 วัน) — ไว้บอกหัวแผงตอนหุบ */
  const currentWin: CallRateWindow | null = trend?.current ?? null;

  const subtitle = (() => {
    if (series === undefined) return 'กำลังโหลด…';
    if (series === null) return 'อ่านตัวเลขไม่ได้ — เปิดแผงแล้วกดลองใหม่';
    if (!currentWin) return undefined;
    const parts = [`${windowDays} วันล่าสุด: ส่ง ${fmtN(currentWin.sent)} สาย`];
    if (currentWin.confirmedPct !== null) parts.push(`สำเร็จ ${currentWin.confirmedPct}%`);
    // Success Rate = คนที่รับสายแล้วปิดได้กี่ % (ฐานแคบกว่า จึงต้องมีคำกำกับเสมอ)
    if (currentWin.successRatePct !== null)
      parts.push(`Success Rate ${currentWin.successRatePct}% (จากคนที่รับสาย)`);
    if (trend?.volumeDir === 'up') parts.push('ปริมาณโตขึ้น');
    else if (trend?.volumeDir === 'down') parts.push('ปริมาณลดลง');
    // งานค้างต้องโผล่บนหัวแผงด้วย — หุบแผงอยู่ก็ต้องเห็นว่ามีของค้าง (ห้ามเงียบ)
    const stuckTotal = stuck ? stuck.notDelivered + stuck.deliveredSilent : 0;
    if (stuckTotal > 0) parts.push(`🚩 ค้างไม่มีผลกลับ ${fmtN(stuckTotal)} สาย`);
    return `${parts.join(' · ')} — กดเพื่อดู`;
  })();

  const volumeVerdict = (() => {
    if (!trend || trend.volumeDir === null) return { verdict: 'ยังไม่มีสาย', detail: 'สองช่วงนี้ไม่มีสายที่ส่งจริงเลย' };
    const cur = fmtN(trend.current.sent);
    const prev = fmtN(trend.previous.sent);
    const detail = `ช่วงนี้ ${cur} · ช่วงก่อน ${prev} สาย`;
    if (trend.volumeDir === 'flat') return { verdict: 'เท่าเดิม', detail };
    const word = trend.volumeDir === 'up' ? 'โตขึ้น' : 'ลดลง';
    if (trend.volumePct === null)
      return { verdict: word, detail: `${detail} — ช่วงก่อนไม่มีสาย เลยคิด % ไม่ได้` };
    const sign = trend.volumePct > 0 ? '+' : '';
    return { verdict: `${word} ${sign}${trend.volumePct}%`, detail };
  })();

  const successVerdict = (() => {
    if (!trend) return { dir: null as TrendDir | null, verdict: '', detail: '' };
    if (trend.successDeltaPts === null) {
      const side =
        trend.current.confirmedPct === null && trend.previous.confirmedPct === null
          ? 'สองช่วงนี้'
          : trend.current.confirmedPct === null
            ? 'ช่วงนี้'
            : 'ช่วงก่อน';
      return {
        dir: null as TrendDir | null,
        verdict: 'เทียบไม่ได้',
        detail: `${side}ยังไม่มีสายที่มีผลจริงให้คิด %`,
      };
    }
    const cur = trend.current.confirmedPct ?? 0;
    const prev = trend.previous.confirmedPct ?? 0;
    const detail = `สำเร็จ ${cur}% (ช่วงก่อน ${prev}%)${
      trend.connectedDeltaPts !== null
        ? ` · โทรติด ${trend.current.connectedPct}% (ช่วงก่อน ${trend.previous.connectedPct}%)`
        : ''
    }`;
    if (trend.successDir === 'flat') return { dir: 'flat' as TrendDir, verdict: 'เท่าเดิม', detail };
    const sign = trend.successDeltaPts > 0 ? '+' : '';
    return {
      dir: trend.successDir,
      verdict: `${trend.successDir === 'up' ? 'ดีขึ้น' : 'แย่ลง'} ${sign}${trend.successDeltaPts} จุด`,
      detail,
    };
  })();

  return (
    <DashboardExpandablePanel title="Rate ผลการโทร Lumos" subtitle={subtitle} open={open} onOpenChange={setOpen}>
      <div className={cn('rounded-2xl border p-4 space-y-4', DASH.card)}>
        {/* แถวควบคุม: ต้นทาง + ช่วงเวลา + รีเฟรช */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {SOURCE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.hint}
                onClick={() => setSource(t.id)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  source === t.id
                    ? TONE.primary.solid
                    : cn('border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'),
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {WINDOW_CHOICES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setWindowDays(d)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  windowDays === d
                    ? TONE.primary.solid
                    : cn('border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'),
                )}
              >
                {d} วัน
              </button>
            ))}
            <button
              type="button"
              onClick={load}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              <RefreshCw className={cn('h-3 w-3', series === undefined && 'animate-spin')} /> รีเฟรช
            </button>
          </div>
        </div>

        {series === undefined ? (
          <p className={cn('py-8 text-center text-sm', DASH.muted)}>กำลังโหลดข้อมูลการโทร…</p>
        ) : series === null ? (
          /* พัง = บอกตรง ๆ + ทางไปต่อ — ห้ามโชว์ 0 ตอนพัง (กติกาจอห้ามโกหก) */
          <div className="py-8 text-center">
            <p className={cn('text-sm font-semibold', TONE.danger.value)}>อ่านตัวเลขการโทรไม่ได้</p>
            <button
              type="button"
              onClick={load}
              className={cn('mt-2 rounded-full px-3 py-1.5 text-xs font-bold', TONE.primary.solid)}
            >
              ลองใหม่
            </button>
          </div>
        ) : trend ? (
          <>
            {/* 🔴 "ติดตรงไหน" — แถบนี้ต้องพูดทุกครั้ง ไม่ว่าจะมีค้างหรือไม่
                (เจ้าของสั่ง 3 ก.ย. 2569: "ไม่ต้องการให้ระบบเงียบ") · ไม่ผูกกับช่วงที่เลือก
                เพราะสายที่ค้างมาสามอาทิตย์ก็ยังเป็นงานค้างของวันนี้ */}
            <StuckStrip stuck={stuck} />

            {/* สรุปช่วงนี้ — เลข + % ต่อถัง (ช่วง = N วันล่าสุดจบวันนี้) */}
            <div>
              <p className={cn('text-[11px] font-semibold', DASH.cellStrong)}>
                ช่วงนี้ {fmtDay(trend.current.fromYmd)} – {fmtDay(trend.current.toYmd)} ({windowDays} วันล่าสุด)
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <StatBox
                  label="ส่งให้ Lumos"
                  value={trend.current.sent}
                  tone="primary"
                  sub={`ไม่รวมที่กดยกเลิก ${fmtN(trend.current.cancelled)} สาย`}
                />
                <StatBox
                  label="โทรติด (คุยได้)"
                  value={trend.current.connected}
                  pct={trend.current.connectedPct}
                  tone="info"
                  sub="รวมสายที่คุยแล้วปฏิเสธ"
                />
                <StatBox
                  label="สำเร็จ"
                  value={trend.current.confirmed}
                  pct={trend.current.confirmedPct}
                  tone="success"
                  sub="ตอบยืนยัน/สนใจ — % จากสายที่มีผลทั้งหมด"
                />
                {/* 🔴 **Success Rate — ฐานคือคนที่รับสาย** (เจ้าของสั่ง 4 ก.ย. 2569)
                    ตอบคำถาม *"พอได้คุยกับคนแล้ว ปิดได้กี่ %"* ต่างจากช่อง "สำเร็จ" ข้าง ๆ
                    ที่ฐานเป็นสายทั้งหมด ⇒ ต้องเขียนฐานกำกับทั้งสองช่อง ไม่งั้นอ่านสลับกัน */}
                <StatBox
                  label="Success Rate"
                  value={trend.current.confirmed}
                  pct={trend.current.successRatePct}
                  tone="success"
                  sub={`% จากคนที่รับสาย ${fmtN(trend.current.connected)} สาย`}
                />
                <StatBox
                  label="ปฏิเสธ"
                  value={trend.current.declined}
                  pct={trend.current.declinedPct}
                  tone="danger"
                  sub="ไม่สนใจ (งานเสนอ) / ไม่ไปแล้ว (งานติดตาม)"
                />
                <StatBox
                  label="ไม่ถึงตัว"
                  value={trend.current.unreached}
                  pct={trend.current.unreachedPct}
                  tone="warn"
                  sub="ไม่รับสาย/ไม่ว่าง/ไม่ตอบ/โทรไม่สำเร็จ"
                />
                <StatBox
                  label="รอผลกลับ"
                  value={trend.current.pending}
                  tone="neutral"
                  sub="ส่งแล้ว ยังไม่มีผล — ดูว่าติดขั้นไหนที่แถบบนสุด"
                />
              </div>
              {trend.current.withResult === 0 && trend.current.sent === 0 ? (
                <p className={cn('mt-2 text-xs', DASH.muted)}>
                  ยังไม่มีสายที่ส่งจริงในช่วงนี้ — เลือกช่วงยาวขึ้น หรือดูกราฟด้านล่างว่าสายก้อนล่าสุดอยู่วันไหน
                </p>
              ) : null}
            </div>

            {/* คำตัดสินแนวโน้ม — คำถามข้อ 3 กับ 4 ของเจ้าของ ตอบตรง ๆ สองบรรทัด */}
            <div className="grid gap-2 lg:grid-cols-2">
              <TrendLine
                title="ปริมาณการโทร"
                dir={trend.volumeDir}
                verdict={volumeVerdict.verdict}
                detail={volumeVerdict.detail}
              />
              <TrendLine
                title="ผลสำเร็จ"
                dir={successVerdict.dir}
                verdict={successVerdict.verdict}
                detail={successVerdict.detail}
              />
            </div>

            {/* แท่งรายวันสองช่วงติดกัน — เห็นด้วยตาว่าโต/หด และผลแต่ละวันเป็นสีอะไร */}
            <div>
              <div className="flex items-end gap-px overflow-x-auto pb-1" role="img" aria-label="ยอดส่งรายวันแยกตามผล">
                {bars.map((b, i) => {
                  const isPrev = i < windowDays;
                  const title = `${fmtDay(b.day)} — ส่ง ${fmtN(b.sent)} · สำเร็จ ${fmtN(b.confirmed)} · ติดแต่ยังไม่จบ ${fmtN(
                    b.connectedOther,
                  )} · ปฏิเสธ ${fmtN(b.declined)} · ไม่ถึงตัว ${fmtN(b.unreached)} · รอผล ${fmtN(b.pending)} · ยกเลิก ${fmtN(b.cancelled)}`;
                  return (
                    <div
                      key={b.day}
                      title={title}
                      className={cn(
                        'flex min-w-0 flex-1 flex-col items-stretch gap-0.5',
                        // เส้นคั่นสองช่วง — ให้ตาแบ่ง "ช่วงก่อน | ช่วงนี้" ได้โดยไม่ต้องอ่านวันที่
                        i === windowDays && 'border-l-2 border-dashed border-slate-300 pl-px dark:border-slate-600',
                      )}
                    >
                      <div className={cn('flex h-24 flex-col-reverse overflow-hidden rounded-sm', isPrev && 'opacity-60')}>
                        {b.sent === 0 ? (
                          <div className="h-px w-full bg-slate-200 dark:bg-slate-700" />
                        ) : (
                          BUCKETS.map(({ key, tone }) => {
                            const v = b[key];
                            if (v <= 0) return null;
                            return (
                              <div
                                key={key}
                                className={cn('w-full', TONE[tone].dot)}
                                style={{ height: `${(v / maxSent) * 100}%` }}
                              />
                            );
                          })
                        )}
                      </div>
                      {/* ป้ายวัน — โชว์หัวช่วง/วันนี้พอ ไม่งั้น 60 ช่องอ่านไม่ออก */}
                      <p className={cn('truncate text-center text-[9px] leading-tight', DASH.muted)}>
                        {i === 0 || i === windowDays || i === bars.length - 1 ? fmtDay(b.day) : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={cn('text-[10px]', DASH.muted)}>ซ้าย = ช่วงก่อน (จาง) · ขวา = ช่วงนี้</span>
                {BUCKETS.map(({ key, label, tone }) => (
                  <span key={key} className={cn('inline-flex items-center gap-1 text-[10px]', DASH.cell)}>
                    <span className={cn('h-2 w-2 rounded-full', TONE[tone].dot)} /> {label}
                  </span>
                ))}
              </div>
            </div>

            {/* นิยามพิมพ์บนจอ ไม่ซ่อนใน tooltip (บทเรียน Haiku 2 ก.ย. 2569) */}
            <p className={cn('border-t pt-2 text-[10px] leading-relaxed', DASH.divider, DASH.muted)}>
              นับตามวันที่ส่งเข้าคิว (ผลของสายผูกกับวันที่ส่ง) · ยอดส่งไม่รวมสายที่กดยกเลิก ·
              % ทุกตัวคิดจากสายที่มีผลจริง · ตัวเลขชุดนี้คือการทำงานของการโทร
              ไม่ใช่ยอด &quot;หาได้แล้ว/ปิดครบใบขอ&quot; ทางการจาก ERP
            </p>
          </>
        ) : null}
      </div>
    </DashboardExpandablePanel>
  );
};

export default LumosCallRatePanel;
