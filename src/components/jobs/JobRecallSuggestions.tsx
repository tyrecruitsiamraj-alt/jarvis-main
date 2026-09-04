import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { EM_DASH } from '@/lib/displayFallback';
import {
  fetchSelectionRecall,
  recruitLaneSendSummary,
  selectionRecallPoolSummary,
  tierChipClass,
  type SelectionRecallResult,
} from '@/lib/recruitLaneApi';

/**
 * "คนที่ AI จับให้จากกองคนที่เคยปฏิเสธงานอื่น" — โผล่ในแท็บ **ไม่สนใจ** ของกล่องงาน
 * (Phase 5.12 · เจ้าของเคาะ 22 ส.ค. 2569)
 *
 * ทำไมอยู่แท็บนี้: แท็บนี้คือกอง "ปฏิเสธ" ซึ่งเป็น dead end ของใบนี้ — ของที่ควรอยู่คู่กัน
 * คือกอง "คนที่ปฏิเสธ**งานอื่น** แต่ AI ว่าเข้ากับใบนี้" (เส้นชวนกลับที่มีอยู่แล้ว)
 * ทำให้หน้าที่เคยเป็นทางตันมีงานให้ทำต่อ
 *
 * 🔴 กติกาที่ห้ามพลาด
 * - **ห้ามค้นเองตอนเปิดแท็บ** — เส้นนี้เรียก Ollama (timeout 180 วิ) และเคยมีบั๊กจริงที่
 *   "แค่เปิดแท็บ = เข้าคิวโทร 20 คน" (RecruitLaneDialog 19 ส.ค.) · ต้องกดปุ่มเอง
 * - **ยิงสายจริง → ต้องยืนยันก่อน** · ยืนยันเป็น **บล็อกในหน้า** ไม่ใช่ Dialog
 *   เพราะ component นี้อยู่ข้างใน Dialog อยู่แล้ว (ห้ามซ้อน Dialog ใน Dialog)
 * - ส่งเฉพาะที่ติ๊ก (`refs`) — เขียว/เหลืองเท่านั้นที่ส่งได้ (แดง AI ว่าไม่เข้าเกณฑ์)
 */

/** tier ที่ระบบยอมส่งเข้าคิว — ตรงกับ `enqueueLumosInterviewForRecall` ฝั่ง server */
const SENDABLE = new Set(['green', 'yellow']);

const JobRecallSuggestions: React.FC<{ jobId: string }> = ({ jobId }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SelectionRecallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  /** กดส่งแล้วรอทาน — ต้องเห็นรายชื่อก่อนยิงสายจริง */
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendNotice, setSendNotice] = useState<string | null>(null);

  const sendable = (result?.matches ?? []).filter((m) => SENDABLE.has(m.tier));
  const pickedNames = sendable.filter((m) => picked.includes(m.ref)).map((m) => m.full_name);

  const search = async () => {
    setLoading(true);
    setError(null);
    setSendNotice(null);
    setConfirming(false);
    try {
      const r = await fetchSelectionRecall(jobId);
      setResult(r);
      // ตั้งต้นติ๊กคนที่ส่งได้ทั้งหมด — คนกดมาเพื่อจะส่ง ไม่ใช่มาเพื่อติ๊กทีละคน
      setPicked(r.matches.filter((m) => SENDABLE.has(m.tier)).map((m) => m.ref));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ค้นหาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (picked.length === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetchSelectionRecall(jobId, { send: true, refs: picked });
      setResult(r);
      setSendNotice(r.dispatch ? recruitLaneSendSummary(r.dispatch) : 'ไม่มีใครเข้าเกณฑ์ส่ง');
      setConfirming(false);
      setPicked([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่ง AI โทรไม่สำเร็จ');
    } finally {
      setSending(false);
    }
  };

  const toggle = (ref: string) =>
    setPicked((prev) => (prev.includes(ref) ? prev.filter((x) => x !== ref) : [...prev, ref]));
  const toggleAll = () =>
    setPicked((prev) => (prev.length === sendable.length ? [] : sendable.map((m) => m.ref)));

  return (
    <div className={cn('mt-3 space-y-2 rounded-xl border px-3 py-2.5', DASH.card)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-xs font-semibold', DASH.cellStrong)}>
          คนที่เคยปฏิเสธงานอื่น — ให้ AI จับว่าใครเข้ากับใบนี้
        </p>
        <Button variant="secondary" size="sm"
          type="button"
          onClick={() => void search()}
          disabled={loading}
          className="shrink-0"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {loading ? 'AI กำลังคิด…' : result ? 'ค้นใหม่' : 'ให้ AI จับให้'}
        </Button>
      </div>

      {error ? (
        <p className={cn('rounded-lg border px-2.5 py-1.5 text-[11px]', TONE.danger.soft, TONE.danger.value)}>
          {error}
        </p>
      ) : null}
      {sendNotice ? (
        <p className={cn('rounded-lg border px-2.5 py-1.5 text-[11px]', TONE.success.soft, TONE.success.value)}>
          {sendNotice}
        </p>
      ) : null}

      {!result && !loading && !error ? (
        <p className={cn('text-[11px]', DASH.muted)}>
          ยังไม่ได้ค้น — กดปุ่มเพื่อให้ AI ไล่กองคนที่เคยตอบไม่สนใจงานอื่น (ใช้เวลาสักครู่)
        </p>
      ) : null}

      {result ? (
        <>
          <p className={cn('text-[11px]', DASH.muted)}>{selectionRecallPoolSummary(result)}</p>
          {result.matches.length === 0 ? (
            <p className={cn('text-[11px]', DASH.muted)}>AI ยังไม่เจอใครที่เข้ากับใบนี้</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" size="sm"
                  type="button"
                  onClick={toggleAll}
                  disabled={sendable.length === 0}
                  className="text-[11px]"
                >
                  {picked.length === sendable.length && sendable.length > 0
                    ? 'เอาออกทั้งหมด'
                    : `เลือกทั้งหมด (${sendable.length})`}
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={picked.length === 0 || confirming}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold disabled:opacity-40',
                    TONE.violet.outline,
                  )}
                >
                  <Bot className="h-3.5 w-3.5" aria-hidden />
                  ส่ง AI โทร ({picked.length})
                </button>
              </div>

              {/* ยืนยันแบบบล็อกในหน้า — ห้ามใช้ Dialog เพราะอยู่ใน Dialog อยู่แล้ว */}
              {confirming ? (
                <div className={cn('space-y-1.5 rounded-lg border px-2.5 py-2', TONE.warn.soft)}>
                  <p className={cn('text-[11px] font-semibold', TONE.warn.value)}>
                    ยืนยันให้ AI โทรหา {pickedNames.length} คนนี้จริง ๆ?
                  </p>
                  <p className={cn('text-[11px]', DASH.cell)}>
                    {pickedNames.slice(0, 10).join(' · ')}
                    {pickedNames.length > 10 ? ` และอีก ${pickedNames.length - 10} คน` : ''}
                  </p>
                  <p className={cn('text-[10px]', DASH.muted)}>
                    ระบบเว้นช่วง 20:00–08:00 น. ให้เอง · คนที่มีเจ้าหน้าที่ถือไปโทรอยู่ ·
                    เบอร์ที่พักไว้ · คนที่เคยปฏิเสธใบนี้ จะถูกข้ามและรายงานกลับ
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <Button size="sm"
                      type="button"
                      onClick={() => void send()}
                      disabled={sending}
                      className="text-[11px]"
                    >
                      {sending ? 'กำลังส่ง…' : `ส่ง ${pickedNames.length} คนเข้าคิวโทร`}
                    </Button>
                    <Button variant="ghost" size="sm"
                      type="button"
                      onClick={() => setConfirming(false)}
                      disabled={sending}
                      className="text-[11px]"
                    >
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : null}

              <ul className="space-y-1">
                {result.matches.map((m) => {
                  const canSend = SENDABLE.has(m.tier);
                  return (
                    <li
                      key={m.ref}
                      className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-1 text-[11px] first:border-0 first:pt-0"
                    >
                      <input
                        type="checkbox"
                        checked={picked.includes(m.ref)}
                        onChange={() => toggle(m.ref)}
                        disabled={!canSend}
                        aria-label={`เลือก ${m.full_name}`}
                        className="h-3.5 w-3.5 cursor-pointer accent-sky-600 disabled:cursor-not-allowed"
                      />
                      <span className={cn('font-semibold', DASH.cellStrong)}>{m.full_name}</span>
                      <span className={tierChipClass(m.tier)}>{m.tier === 'green' ? 'เข้าเกณฑ์' : m.tier === 'yellow' ? 'พอได้' : 'ไม่เข้าเกณฑ์'}</span>
                      <span className={cn('min-w-0 flex-1 truncate', DASH.muted)} title={m.reason || undefined}>
                        {m.reason || EM_DASH}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      ) : null}
    </div>
  );
};

export default JobRecallSuggestions;
