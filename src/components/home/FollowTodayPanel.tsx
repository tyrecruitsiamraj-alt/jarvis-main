import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { EMPTY_FUNNEL, fetchCallFunnel, type CallFunnel } from '@/lib/callFunnelApi';
import { listFollowEntries, type FollowEntry } from '@/lib/followApi';
import { toYmdBangkok } from '@/lib/dateTh';
import { bucketOfCall, CALL_BUCKET_LABEL, type CallBucket } from '@/lib/callOutcomeBuckets';
import { followRoundSlot } from '@/lib/followRoundBuckets';
import { ChevronRight, Phone, PhoneOutgoing, RefreshCw, X } from 'lucide-react';

/**
 * แผง "งาน Follow วันนี้" บนหน้าหลัก (เจ้าของสั่ง 14 ส.ค. 2569 · ปรับ 17 ส.ค. 2569)
 *
 * ตอบ: "หน้างาน Follow ดูได้ทันทีว่าวันนี้ส่งไปกี่คน · รอบแรกโทรไปแล้ว โทรติดกี่คน
 * ไม่ติดกี่คน ยกเลิกกี่คน · มีประมาณ 3 รอบ ให้ทั้ง 3 รอบเห็นแบบเดียวกัน"
 *
 * 17 ส.ค. เจ้าของสั่งเพิ่ม: *"ทำให้รู้หน่อยแบบดูสวย แล้วกดแล้วมี popup เด้งมาว่ามีใครบ้าง"*
 * → แต่ละรอบมีแถบสัดส่วนให้กวาดตาเห็นทันทีว่ากองอยู่ถังไหน · กดแล้วเปิดรายชื่อของรอบนั้น
 *
 * ⚠️ **แต่ละรอบเป็น snapshot** — "ตอนนี้ใครอยู่รอบไหน + ผลรอบนั้น" ไม่ใช่ประวัติสะสม
 * คนที่ขยับไปรอบ 2 จะไม่โผล่ในรอบ 1 อีก
 *
 * 🔴 **ยอดบนแถบมาจาก funnel (นับในฐาน) ส่วนรายชื่อมาจากตารางรายการติดตาม**
 * สองเส้นคนละที่มา — ถ้านับได้ไม่เท่ากันต้อง**บอกในกล่อง** ห้ามเงียบ
 * (เช่น แถวคิวที่ไม่มีรายการติดตามคู่กันแล้ว หรือรายการที่ยังไม่เคยเข้าคิว)
 */
export default function FollowTodayPanel() {
  const [funnel, setFunnel] = useState<CallFunnel>(EMPTY_FUNNEL);
  const [sentToday, setSentToday] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<FollowEntry[]>([]);
  /** รอบที่กดดูรายชื่ออยู่ — null = ไม่ได้เปิดกล่อง */
  const [openRound, setOpenRound] = useState<number | null>(null);

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
    // รายชื่อสำหรับ popup — ล้มก็ไม่ทำให้ยอดบนแผงหาย (กดดูรายชื่อค่อยบอกว่าโหลดไม่ได้)
    void listFollowEntries()
      .then(setEntries)
      .catch(() => setEntries([]));
  };

  useEffect(load, []);

  const rounds = funnel.byAttempt ?? [];

  /** รายชื่อแยกตามรอบ + ถัง — ใช้กติกาเดียวกับที่ฝั่งฐานนับ (callOutcomeBuckets) */
  const peopleByRound = useMemo(() => {
    const map = new Map<number, Record<CallBucket, FollowEntry[]>>();
    for (const slot of [1, 2, 3]) {
      map.set(slot, { connected: [], unreached: [], cancelled: [], pending: [] });
    }
    for (const e of entries) {
      /* 🔴 นิยาม "อยู่รอบไหน" ตัวเดียวกับฝั่งฐานและหน้าติดตาม (`followRoundSlot`)
         — งานติดตามใช้สายที่คนเลือกไว้ (`call_round`) ก่อน `attempt_count` เสมอ */
      const slot = followRoundSlot(e);
      if (slot === null) continue; // ยังไม่เคยเข้าคิว = ไม่ได้อยู่รอบไหน
      const bucket = bucketOfCall(e.cancelled ? 'cancelled' : e.call_status, e.call_outcome);
      map.get(slot)?.[bucket].push(e);
    }
    return map;
  }, [entries]);

  const BUCKET_TONE: Record<CallBucket, { text: string; bar: string }> = {
    connected: { text: TONE.success.value, bar: TONE.success.dot },
    unreached: { text: TONE.warn.value, bar: TONE.warn.dot },
    cancelled: { text: DASH.muted, bar: 'bg-slate-400' },
    pending: { text: TONE.primary.value, bar: TONE.primary.dot },
  };

  const openRoundData = openRound == null ? null : rounds.find((r) => r.attempt === openRound);
  const openRoundPeople = openRound == null ? null : peopleByRound.get(openRound);

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

      {/* 3 รอบ format เดียวกัน — ส่ง · โทรติด · ไม่ติด · ยกเลิก + แถบสัดส่วน
          กดที่แถวเพื่อดูรายชื่อของรอบนั้น */}
      <div className="mt-3 space-y-2">
        {rounds.map((r) => {
          const parts: { key: CallBucket; n: number }[] = [
            { key: 'connected', n: r.connected },
            { key: 'unreached', n: r.unreached },
            { key: 'pending', n: r.pending },
            { key: 'cancelled', n: r.cancelled },
          ];
          const empty = r.total === 0;
          return (
            <button
              key={r.attempt}
              type="button"
              disabled={empty}
              onClick={() => setOpenRound(r.attempt)}
              title={empty ? 'รอบนี้ยังไม่มีใคร' : 'กดเพื่อดูรายชื่อในรอบนี้'}
              className={cn(
                'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                TONE.neutral.soft,
                empty ? 'cursor-default opacity-70' : TONE.neutral.softHover,
              )}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className={cn('text-xs font-bold', DASH.cellStrong)}>รอบ {r.attempt}</span>
                <span className={cn('text-[11px]', DASH.muted)}>
                  ส่ง{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {r.total.toLocaleString('th-TH')}
                  </span>
                </span>
                {parts.map((p) => (
                  <span key={p.key} className="text-[11px]">
                    <span className={DASH.muted}>{CALL_BUCKET_LABEL[p.key]} </span>
                    <span className={cn('font-semibold tabular-nums', BUCKET_TONE[p.key].text)}>
                      {p.n.toLocaleString('th-TH')}
                    </span>
                  </span>
                ))}
                {!empty ? (
                  <ChevronRight className={cn('ml-auto h-3.5 w-3.5 shrink-0', DASH.muted)} aria-hidden />
                ) : null}
              </div>
              {/* แถบสัดส่วน — กวาดตาแล้วเห็นทันทีว่ารอบนี้กองอยู่ถังไหน
                  ⚠️ ไม่มีใครในรอบ = ไม่วาดแถบ ห้ามวาดเป็นแถบว่างที่ดูเหมือน 0% ของอะไรสักอย่าง */}
              {!empty ? (
                <div className="mt-2 flex h-[5px] w-full overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                  {parts
                    .filter((p) => p.n > 0)
                    .map((p) => (
                      <span
                        key={p.key}
                        className={cn('block h-full', BUCKET_TONE[p.key].bar)}
                        style={{ width: `${(p.n / r.total) * 100}%` }}
                        title={`${CALL_BUCKET_LABEL[p.key]} ${p.n}`}
                      />
                    ))}
                </div>
              ) : null}
            </button>
          );
        })}
        {rounds.every((r) => r.total === 0) ? (
          <p className={cn('rounded-xl border px-3 py-2 text-[11px]', TONE.neutral.soft, DASH.muted)}>
            ยังไม่มีงาน Follow ที่ส่งให้ AI โทร — เพิ่มรายชื่อที่หน้า Follow แล้วส่งโทร
          </p>
        ) : null}
      </div>

      <p className={cn('mt-2 text-[10px]', DASH.muted)}>
        แต่ละรอบ = คนที่ตอนนี้อยู่รอบนั้น (ไม่ใช่ยอดสะสมทุกครั้งที่โทร) · กดที่รอบเพื่อดูรายชื่อ
      </p>

      {openRoundData && openRoundPeople ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`รายชื่อในรอบ ${openRoundData.attempt}`}
          onClick={() => setOpenRound(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-background p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  งาน Follow · รอบ {openRoundData.attempt}
                </h3>
                <p className={cn('mt-0.5 text-[11px]', DASH.muted)}>
                  ส่ง {openRoundData.total.toLocaleString('th-TH')} คน
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenRound(null)}
                aria-label="ปิด"
                className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {(() => {
              const listed = (Object.keys(openRoundPeople) as CallBucket[]).reduce(
                (sum, k) => sum + openRoundPeople[k].length,
                0,
              );
              // 🔴 ยอดกับรายชื่อคนละเส้น — ไม่เท่ากันต้องบอก ไม่ใช่ปล่อยให้คนนับเอง
              return listed < openRoundData.total ? (
                <p className={cn('mt-2 rounded-lg px-2.5 py-1.5 text-[11px]', TONE.warn.soft, TONE.warn.value)}>
                  แสดงชื่อได้ {listed.toLocaleString('th-TH')} จาก{' '}
                  {openRoundData.total.toLocaleString('th-TH')} คน — ที่เหลือเป็นสายที่ไม่มีรายการ
                  ติดตามคู่กันแล้ว (เช่น ถูกลบทิ้ง)
                </p>
              ) : null;
            })()}

            <div className="mt-3 space-y-3">
              {(['connected', 'unreached', 'pending', 'cancelled'] as CallBucket[]).map((b) => {
                const list = openRoundPeople[b];
                if (list.length === 0) return null;
                return (
                  <section key={b}>
                    <p className={cn('mb-1.5 text-[11px] font-bold', BUCKET_TONE[b].text)}>
                      {CALL_BUCKET_LABEL[b]} ({list.length.toLocaleString('th-TH')})
                    </p>
                    <ul className="space-y-1">
                      {list.map((p) => (
                        <li
                          key={p.id}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5',
                            TONE.neutral.soft,
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-foreground">
                              {p.recipient_name}
                            </span>
                            <span className={cn('block truncate text-[10px]', DASH.muted)}>
                              {p.topic}
                              {p.unit_name ? ` · ${p.unit_name}` : ''}
                            </span>
                          </span>
                          <a
                            href={`tel:${p.recipient_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium',
                              TONE.info.outline,
                            )}
                          >
                            <Phone className="h-3 w-3" aria-hidden />
                            {p.recipient_phone}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              {(Object.keys(openRoundPeople) as CallBucket[]).every(
                (k) => openRoundPeople[k].length === 0,
              ) ? (
                <p className={cn('py-6 text-center text-xs', DASH.muted)}>
                  ดึงรายชื่อไม่ได้ — ลองกดรีเฟรชที่หัวแผง
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
