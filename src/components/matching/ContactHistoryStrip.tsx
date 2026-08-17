import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TONE, DASH } from '@/lib/designTokens';
import { fetchContactHistory, type ContactHistoryItem } from '@/lib/contactHistoryApi';
import { PhoneCall, Bot } from 'lucide-react';

/**
 * แถบ "คนนี้ถูกติดต่ออะไรไปแล้วบ้าง" — โชว์ก่อนเจ้าหน้าที่จะยกหู
 * จะได้เห็นว่าเมื่อวาน AI เพิ่งโทรแล้วเขาขอเลื่อน ไม่ใช่โทรทับจนผู้สมัครรำคาญ
 * รวมทั้งสายที่คนโทร (จากล็อกโทร) และสายของ AI (คิว Lumos) ในเส้นเวลาเดียว
 */

const OUTCOME_TH: Record<string, string> = {
  confirmed: 'สนใจ',
  acknowledged: 'รับทราบ',
  declined: 'ไม่สนใจ',
  reschedule_requested: 'ขอเลื่อน',
  busy: 'สายไม่ว่าง',
  no_answer: 'ไม่รับสาย',
  unresponsive: 'ไม่ตอบ',
  wrong_person: 'เบอร์ผิด/คนผิด',
  failed: 'โทรไม่สำเร็จ',
  cancelled: 'ถูกยกเลิก',
};

const GOOD = new Set(['confirmed', 'acknowledged']);
const BAD = new Set(['declined', 'wrong_person', 'failed']);

function outcomeChip(item: ContactHistoryItem): { label: string; cls: string } {
  if (!item.outcome) {
    if (item.kind === 'human') {
      return { label: 'รับไปโทร · ยังไม่กดผล', cls: cn(TONE.warn.soft, TONE.warn.value) };
    }
    // ฝั่ง AI ที่ยังไม่มีผล — บอกสถานะคิวแทน
    const s = item.queueStatus;
    if (s === 'pending') return { label: 'รอโทร', cls: cn(TONE.info.soft, TONE.info.value) };
    if (s === 'delivered') return { label: 'AI รับไปแล้ว', cls: cn(TONE.primary.soft, TONE.primary.value) };
    if (s === 'cancelled') return { label: 'ถูกยกเลิก', cls: cn(TONE.neutral.soft, TONE.neutral.value) };
    return { label: s || 'ยังไม่มีผล', cls: cn(TONE.neutral.soft, TONE.neutral.value) };
  }
  const label =
    item.outcome === 'declined' && item.scope === 'all'
      ? 'ไม่หางานแล้ว'
      : (OUTCOME_TH[item.outcome] ?? item.outcome);
  const tone = GOOD.has(item.outcome) ? TONE.success : BAD.has(item.outcome) ? TONE.danger : TONE.warn;
  return { label, cls: cn(tone.soft, tone.value) };
}

function timeAgoTh(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} นาทีก่อน`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ก่อน`;
  return `${Math.floor(hrs / 24)} วันก่อน`;
}

export default function ContactHistoryStrip({ phone }: { phone: string | null | undefined }) {
  const [items, setItems] = useState<ContactHistoryItem[] | null>(null);

  useEffect(() => {
    setItems(null);
    const p = (phone || '').trim();
    if (!p) {
      setItems([]);
      return;
    }
    let cancelled = false;
    void fetchContactHistory(p).then((rows) => {
      if (!cancelled) setItems(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [phone]);

  if (!phone) return null;
  if (items === null) return <p className={cn('text-[11px]', DASH.muted)}>กำลังดูประวัติการติดต่อ…</p>;
  if (items.length === 0)
    return <p className={cn('text-[11px]', DASH.muted)}>ยังไม่เคยมีการติดต่อเบอร์นี้จากระบบ</p>;

  return (
    <div className="space-y-1">
      <p className={cn('text-xs font-semibold', DASH.cellStrong)}>
        ประวัติการติดต่อ ({items.length.toLocaleString('th-TH')} ครั้งล่าสุด)
      </p>
      <ul className="space-y-0.5">
        {items.slice(0, 6).map((it, i) => {
          const chip = outcomeChip(it);
          return (
            <li key={`${it.kind}-${it.at}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
              {it.kind === 'ai' ? (
                <Bot className={cn('h-3 w-3 shrink-0', TONE.primary.value)} aria-label="AI โทร" />
              ) : (
                <PhoneCall className={cn('h-3 w-3 shrink-0', TONE.success.value)} aria-label="คนโทร" />
              )}
              <span className={DASH.muted}>{timeAgoTh(it.at)}</span>
              <span className={cn('rounded-full border px-1.5 py-0 text-[10px] font-semibold', chip.cls)}>
                {chip.label}
              </span>
              {it.kind === 'human' && it.byName ? <span className={DASH.muted}>โดย {it.byName}</span> : null}
              {it.kind === 'ai' && it.attemptCount && it.attemptCount > 1 ? (
                <span className={DASH.muted}>ครั้งที่ {it.attemptCount}</span>
              ) : null}
              {it.jobRef ? <span className={cn('font-mono text-[10px]', DASH.muted)}>{it.jobRef}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
