import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { EMPTY_FUNNEL, fetchCallFunnel, type CallFunnel } from '@/lib/callFunnelApi';
import { toYmdBangkok } from '@/lib/dateTh';
import { PhoneOutgoing, RefreshCw } from 'lucide-react';

/**
 * แผง "งาน Follow วันนี้" บนหน้าหลัก (เจ้าของสั่ง 14 ส.ค. 2569)
 *
 * ตอบ: "หน้างาน Follow ดูได้ทันทีว่าวันนี้ส่งไปกี่คน · รอบแรกโทรไปแล้ว โทรติดกี่คน
 * ไม่ติดกี่คน ยกเลิกกี่คน · มีประมาณ 3 รอบ ให้ทั้ง 3 รอบเห็นแบบเดียวกัน"
 *
 * ⚠️ **แต่ละรอบเป็น snapshot** — "ตอนนี้ใครอยู่รอบไหน + ผลรอบนั้น" ไม่ใช่ประวัติสะสม
 * (ระบบล้างผลเก่าทิ้งตอนตั้งโทรซ้ำ · เจ้าของเคาะ 14 ส.ค. ว่ารับ snapshot ได้)
 * คนที่ขยับไปรอบ 2 จะไม่โผล่ในรอบ 1 อีก
 *
 * ⚠️ ไม่มีช่อง "กำลังเดินทาง" — เจ้าของสั่งเอาออก (14 ส.ค.)
 * ⚠️ ทั้ง 3 รอบ format เดียวกันเป๊ะ (ช่องจองที่เสมอ ไม่งอกตามข้อมูล — กติกา "ทุกใบต้องเหมือนกัน")
 */
export default function FollowTodayPanel() {
  const [funnel, setFunnel] = useState<CallFunnel>(EMPTY_FUNNEL);
  const [sentToday, setSentToday] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const today = toYmdBangkok(new Date());
    // ยิง 2 ครั้ง: วันนี้ (เอา queued = ส่งวันนี้กี่คน) · ทั้งหมด (เอา byAttempt = รอบปัจจุบัน)
    void Promise.all([
      fetchCallFunnel(today, 'follow'),
      fetchCallFunnel(undefined, 'follow'),
    ])
      .then(([todayData, allData]) => {
        setSentToday(todayData.funnel.queuedActive);
        setFunnel(allData.funnel);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const rounds = funnel.byAttempt ?? [];

  return (
    <div className={cn('rounded-2xl border p-4 md:p-5', DASH.card)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PhoneOutgoing className={cn('h-4 w-4', TONE.primary.value)} aria-hidden />
          <h2 className={cn('text-sm font-bold', DASH.cellStrong)}>งาน Follow</h2>
          <span className={cn('text-xs', DASH.muted)}>
            วันนี้ส่ง{' '}
            <span className={cn('font-bold tabular-nums', TONE.primary.value)}>
              {sentToday.toLocaleString('th-TH')}
            </span>{' '}
            คน
          </span>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="jarvis-btn-ghost shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> รีเฟรช
        </button>
      </div>

      {/* 3 รอบ format เดียวกัน — ส่ง · โทรติด · ไม่ติด · ยกเลิก */}
      <div className="mt-3 space-y-1.5">
        {rounds.map((r) => (
          <div
            key={r.attempt}
            className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-3 py-2', TONE.neutral.soft)}
          >
            <span className={cn('text-xs font-bold', DASH.cellStrong)}>รอบ {r.attempt}</span>
            <span className={cn('text-[11px]', DASH.muted)}>
              ส่ง <span className="font-semibold tabular-nums text-foreground">{r.total.toLocaleString('th-TH')}</span>
            </span>
            <span className="text-[11px]">
              <span className={DASH.muted}>โทรติด </span>
              <span className={cn('font-semibold tabular-nums', TONE.success.value)}>
                {r.connected.toLocaleString('th-TH')}
              </span>
            </span>
            <span className="text-[11px]">
              <span className={DASH.muted}>ไม่ติด </span>
              <span className={cn('font-semibold tabular-nums', TONE.warn.value)}>
                {r.unreached.toLocaleString('th-TH')}
              </span>
            </span>
            <span className="text-[11px]">
              <span className={DASH.muted}>ยกเลิก </span>
              <span className={cn('font-semibold tabular-nums', DASH.muted)}>
                {r.cancelled.toLocaleString('th-TH')}
              </span>
            </span>
          </div>
        ))}
        {rounds.every((r) => r.total === 0) ? (
          <p className={cn('rounded-xl border px-3 py-2 text-[11px]', TONE.neutral.soft, DASH.muted)}>
            ยังไม่มีงาน Follow ที่ส่งให้ AI โทร — เพิ่มรายชื่อที่หน้า Follow แล้วส่งโทร
          </p>
        ) : null}
      </div>

      <p className={cn('mt-2 text-[10px]', DASH.muted)}>
        แต่ละรอบ = คนที่ตอนนี้อยู่รอบนั้น (ไม่ใช่ยอดสะสมทุกครั้งที่โทร)
      </p>
    </div>
  );
}
