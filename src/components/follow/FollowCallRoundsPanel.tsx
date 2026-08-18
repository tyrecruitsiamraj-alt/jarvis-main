import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { EMPTY_FUNNEL, fetchCallFunnel, type CallFunnel } from '@/lib/callFunnelApi';
import { listFollowEntries, type FollowEntry } from '@/lib/followApi';
import {
  bucketOfCall,
  callAttemptSlot,
  CALL_BUCKET_LABEL,
  type CallBucket,
} from '@/lib/callOutcomeBuckets';
import {
  buildCallCalendar,
  callDayKey,
  monthGridDays,
  shiftMonth,
} from '@/lib/followCallCalendar';
import { formatYmdDmyBe, toYmdBangkok } from '@/lib/dateTh';
import { ChevronLeft, ChevronRight, Phone, RefreshCw } from 'lucide-react';

/**
 * แผงการโทรของหน้า Follow — **3 รอบ + ปฏิทิน** (เจ้าของสั่ง 18 ส.ค. 2569)
 *
 * > *"เปลี่ยนเอา ทั้งหมด รอโทร กำลังโทร โทรสำเร็จ ไม่สำเร็จ ไปใส่แทนแบ่งเป็น 3 แถว
 * > เพื่อให้รู้ว่าโทร 3 รอบ แต่ละกล่องกดแล้วต้องแสดงชื่อขึ้นมาพร้อมรายละเอียดของแต่ละคน
 * > มี calendar ให้หน่อยเพื่อจะได้รู้ว่าแต่ละวันโทรกี่คน"*
 *
 * แทน `CallFunnelPanel` (funnel 4 ช่อง) ซึ่งใช้ที่หน้า Follow ที่เดียว
 *
 * 🔴 **ยอดกับรายชื่อมาคนละเส้น** — ยอดมาจาก funnel (นับในฐาน) · รายชื่อมาจากตาราง
 * รายการติดตาม · นับได้ไม่เท่ากันต้อง**ขึ้นข้อความบอก** ห้ามเงียบ
 * เงื่อนไขแบ่งถังอยู่ที่ `callOutcomeBuckets.ts` ที่เดียว ทั้ง SQL และหน้าเว็บใช้ตัวเดียวกัน
 */

const BUCKET_ORDER: CallBucket[] = ['connected', 'unreached', 'pending', 'cancelled'];

const BUCKET_STYLE: Record<CallBucket, { text: string; bar: string }> = {
  connected: { text: TONE.success.value, bar: TONE.success.dot },
  unreached: { text: TONE.warn.value, bar: TONE.warn.dot },
  pending: { text: TONE.primary.value, bar: TONE.primary.dot },
  cancelled: { text: DASH.muted, bar: 'bg-slate-400' },
};

/** รายละเอียดของคนหนึ่งคนในกล่อง — เจ้าของขอ "ชื่อพร้อมรายละเอียดของแต่ละคน" */
function PersonRow({ p }: { p: FollowEntry }) {
  return (
    <li className={cn('rounded-lg border px-2.5 py-2', TONE.neutral.soft)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{p.recipient_name}</p>
          <p className={cn('truncate text-[11px]', DASH.muted)}>{p.topic}</p>
          {p.unit_name || p.site_code ? (
            <p className={cn('truncate text-[10px]', DASH.muted)}>
              {p.unit_name || '—'}
              {p.site_code ? ` (${p.site_code})` : ''}
            </p>
          ) : null}
          <p className={cn('mt-0.5 text-[10px]', DASH.muted)}>
            ให้โทร {p.scheduled_at ? formatYmdDmyBe(toYmdBangkok(new Date(p.scheduled_at))) : '—'}
            {p.created_by_name ? ` · เจ้าของข้อมูล ${p.created_by_name}` : ''}
          </p>
          {p.call_outcome || p.call_summary ? (
            <p className={cn('mt-1 rounded bg-background/60 px-1.5 py-1 text-[10px]', DASH.muted)}>
              ผล{p.call_outcome ? ` (${p.call_outcome})` : ''}
              {p.call_summary ? `: ${p.call_summary}` : ''}
            </p>
          ) : null}
        </div>
        <a
          href={`tel:${p.recipient_phone}`}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium',
            TONE.info.outline,
          )}
        >
          <Phone className="h-3 w-3" aria-hidden />
          {p.recipient_phone}
        </a>
      </div>
    </li>
  );
}

export default function FollowCallRoundsPanel() {
  const [funnel, setFunnel] = useState<CallFunnel>(EMPTY_FUNNEL);
  const [entries, setEntries] = useState<FollowEntry[]>([]);
  const [loading, setLoading] = useState(false);
  /** กล่องที่กางอยู่ — "รอบ:ถัง" · null = ยังไม่กด */
  const [openBox, setOpenBox] = useState<string | null>(null);
  const [month, setMonth] = useState(() => toYmdBangkok(new Date()).slice(0, 7));
  const [openDay, setOpenDay] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    void fetchCallFunnel(undefined, 'follow')
      .then((d) => setFunnel(d.funnel))
      .finally(() => setLoading(false));
    void listFollowEntries()
      .then(setEntries)
      .catch(() => setEntries([]));
  };
  useEffect(load, []);

  const rounds = funnel.byAttempt ?? [];

  /** รายชื่อแยกตามรอบ + ถัง — กติกาเดียวกับที่ฝั่งฐานนับ */
  const peopleByRound = useMemo(() => {
    const map = new Map<number, Record<CallBucket, FollowEntry[]>>();
    for (const slot of [1, 2, 3]) {
      map.set(slot, { connected: [], unreached: [], cancelled: [], pending: [] });
    }
    for (const e of entries) {
      // ยังไม่เคยเข้าคิว = ยังไม่อยู่รอบไหน
      if (e.call_attempt == null && e.call_status === 'pending' && !e.call_outcome) continue;
      const slot = callAttemptSlot(e.call_attempt);
      const bucket = bucketOfCall(e.cancelled ? 'cancelled' : e.call_status, e.call_outcome);
      map.get(slot)?.[bucket].push(e);
    }
    return map;
  }, [entries]);

  const calendar = useMemo(() => buildCallCalendar(entries), [entries]);
  const grid = useMemo(() => monthGridDays(month), [month]);
  const dayPeople = useMemo(() => {
    if (!openDay) return [];
    return entries.filter(
      (e) => callDayKey(e.scheduled_at) === openDay || callDayKey(e.called_at) === openDay,
    );
  }, [entries, openDay]);

  const monthLabel = (() => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return month;
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('th-TH', {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    });
  })();

  return (
    <div className={cn('space-y-3 rounded-2xl border p-4 md:p-5', DASH.card)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className={cn('text-sm font-bold', DASH.cellStrong)}>การโทรของงาน Follow</h2>
          <p className={cn('text-[11px]', DASH.muted)}>
            แยกตามรอบโทร · กดกล่องเพื่อดูรายชื่อ · แต่ละรอบคือ "ตอนนี้ใครอยู่รอบนั้น"
            ไม่ใช่ยอดสะสมทุกครั้งที่โทร
          </p>
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

      {/* 3 แถว = 3 รอบ · แต่ละแถวมี 4 กล่องถัง กดได้ */}
      <div className="space-y-2">
        {rounds.map((r) => {
          const people = peopleByRound.get(r.attempt);
          const counts: Record<CallBucket, number> = {
            connected: r.connected,
            unreached: r.unreached,
            pending: r.pending,
            cancelled: r.cancelled,
          };
          return (
            <div key={r.attempt} className={cn('rounded-xl border p-2.5', TONE.neutral.soft)}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className={cn('text-xs font-bold', DASH.cellStrong)}>รอบ {r.attempt}</span>
                <span className={cn('text-[11px]', DASH.muted)}>
                  ส่ง{' '}
                  <b className="tabular-nums text-foreground">{r.total.toLocaleString('th-TH')}</b>{' '}
                  คน
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {BUCKET_ORDER.map((b) => {
                  const key = `${r.attempt}:${b}`;
                  const n = counts[b];
                  const open = openBox === key;
                  return (
                    <button
                      key={b}
                      type="button"
                      disabled={n === 0}
                      onClick={() => setOpenBox(open ? null : key)}
                      className={cn(
                        'rounded-lg border px-2 py-1.5 text-left transition-colors',
                        open ? 'ring-2 ring-ring' : '',
                        n === 0 ? 'cursor-default opacity-60' : 'hover:bg-secondary',
                      )}
                    >
                      <span className={cn('block text-[10px] font-semibold', DASH.muted)}>
                        {CALL_BUCKET_LABEL[b]}
                      </span>
                      <span className={cn('block text-lg font-bold tabular-nums', BUCKET_STYLE[b].text)}>
                        {n.toLocaleString('th-TH')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* รายชื่อของกล่องที่กด */}
              {openBox?.startsWith(`${r.attempt}:`) && people ? (
                (() => {
                  const b = openBox.split(':')[1] as CallBucket;
                  const list = people[b];
                  const expected = counts[b];
                  return (
                    <div className="mt-2 border-t border-border/60 pt-2">
                      <p className={cn('mb-1.5 text-[11px] font-bold', BUCKET_STYLE[b].text)}>
                        รอบ {r.attempt} · {CALL_BUCKET_LABEL[b]} ({list.length.toLocaleString('th-TH')})
                      </p>
                      {/* 🔴 ยอดกับรายชื่อคนละเส้น — ไม่เท่ากันต้องบอก ไม่ใช่ให้คนนับเอง */}
                      {list.length < expected ? (
                        <p className={cn('mb-1.5 rounded px-2 py-1 text-[10px]', TONE.warn.soft, TONE.warn.value)}>
                          แสดงชื่อได้ {list.length} จาก {expected} คน — ที่เหลือเป็นสายที่ไม่มี
                          รายการติดตามคู่กันแล้ว
                        </p>
                      ) : null}
                      {list.length === 0 ? (
                        <p className={cn('py-3 text-center text-[11px]', DASH.muted)}>
                          ดึงรายชื่อไม่ได้ — ลองกดรีเฟรช
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {list.map((p) => (
                            <PersonRow key={p.id} p={p} />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()
              ) : null}
            </div>
          );
        })}
        {rounds.every((r) => r.total === 0) ? (
          <p className={cn('rounded-xl border px-3 py-2 text-[11px]', TONE.neutral.soft, DASH.muted)}>
            ยังไม่มีงาน Follow ที่ส่งให้ AI โทร — เพิ่มรายชื่อข้างล่างแล้วส่งโทร
          </p>
        ) : null}
      </div>

      {/* ปฏิทิน — แต่ละวันโทรกี่คน */}
      <div className="rounded-xl border border-border/60 p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="เดือนก่อนหน้า"
            className="rounded-full border border-border p-1 hover:bg-secondary"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className={cn('text-xs font-bold', DASH.cellStrong)}>{monthLabel}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="เดือนถัดไป"
            className="rounded-full border border-border p-1 hover:bg-secondary"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <div className={cn('grid grid-cols-7 gap-1 text-center text-[10px]', DASH.muted)}>
          {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => (
            <span key={d} className="py-0.5 font-semibold">
              {d}
            </span>
          ))}
          {grid.map((ymd, i) => {
            if (!ymd) return <span key={`x${i}`} />;
            const day = calendar.get(ymd);
            const planned = day?.planned ?? 0;
            const called = day?.called ?? 0;
            const has = planned > 0 || called > 0;
            const isOpen = openDay === ymd;
            return (
              <button
                key={ymd}
                type="button"
                disabled={!has}
                onClick={() => setOpenDay(isOpen ? null : ymd)}
                title={has ? `ตั้งไว้ ${planned} · โทรแล้ว ${called}` : undefined}
                className={cn(
                  'rounded-md border px-1 py-1 transition-colors',
                  has ? 'border-border hover:bg-secondary' : 'border-transparent opacity-45',
                  isOpen ? 'ring-2 ring-ring' : '',
                )}
              >
                <span className="block tabular-nums text-foreground">{Number(ymd.slice(-2))}</span>
                {has ? (
                  <span className="mt-0.5 block leading-none">
                    <b className={cn('tabular-nums', TONE.primary.value)}>{planned}</b>
                    {called > 0 ? (
                      <b className={cn('ml-1 tabular-nums', TONE.success.value)}>✓{called}</b>
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className={cn('mt-1.5 text-[10px]', DASH.muted)}>
          เลขน้ำเงิน = ตั้งไว้ว่าจะโทรวันนั้น · <b className={TONE.success.value}>✓</b> เขียว =
          มีผลโทรกลับมาแล้ว · สายที่ยกเลิกไม่ถูกนับ
        </p>

        {openDay ? (
          <div className="mt-2 border-t border-border/60 pt-2">
            <p className={cn('mb-1.5 text-[11px] font-bold', DASH.cellStrong)}>
              {formatYmdDmyBe(openDay)} · {dayPeople.length.toLocaleString('th-TH')} คน
            </p>
            <ul className="space-y-1.5">
              {dayPeople.map((p) => (
                <PersonRow key={p.id} p={p} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
