import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import { useAuth } from '@/contexts/AuthContext';
import { CallTeamBoardSection } from '@/pages/matching/CallTeamBoardPage';
import CallBatchPanel from '@/components/follow/CallBatchPanel';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import NameAvatar from '@/components/shared/NameAvatar';
import {
  fetchMyCallQueue,
  recordCallResult,
  releaseCallHold,
  CALL_RESULT_DESTINATION,
  CALL_RESULT_LABEL,
  EMPTY_TALLY,
  type CallHold,
  type CallResultOutcome,
  type CallResultScope,
  type CallResultTally,
} from '@/lib/callHoldsApi';
import { Phone, RefreshCw, ArrowRight } from 'lucide-react';

/**
 * หน้า "โทรของฉัน" — ถังงานโทรของเจ้าหน้าที่คนเดียว
 *
 * ทำไมต้องมีหน้าแยกจาก Matching: การ์ดในหน้า Matching ไว้รับ+โทรทันทีตอนกำลังดูใบขอนั้น
 * แต่พอรับสะสมจากหลายใบขอ ต้องมีถังรวมที่ **เรียงให้เสร็จว่าโทรใครก่อน** ไม่ต้องเปิดไล่ทีละใบ
 *
 * ผลโทรใช้ศัพท์ชุดเดียวกับ Lumos (ดู callHoldsApi) → funnel นับรวมกับผลของ AI ได้
 */


const OUTCOME_ORDER: CallResultOutcome[] = [
  'confirmed',
  'declined',
  'reschedule_requested',
  'no_answer',
  'wrong_person',
];

function msLeftOf(hold: CallHold, now: number): number {
  return new Date(hold.expiresAt).getTime() - now;
}

function countdown(ms: number): string {
  if (ms <= 0) return 'หมดเวลา';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที`;
}

/** ใกล้คายภายใน 2 ชม. = ต้องรีบโทร (ไฮไลต์แถว) */
const DUE_SOON_MS = 2 * 60 * 60 * 1000;

const MyCallsPage: React.FC = () => {
  /**
   * เจ้าของสั่ง 7 ส.ค. 2569: ยังไม่เปิดให้ทุกคนเห็น ซ่อนไว้ให้แอดมินก่อน
   * เป็นการซ่อน "หน้าจอ" เท่านั้น — API ล็อกสิทธิ์ของมันเองอยู่แล้ว
   * (จับล็อกโทรผ่าน rbac `matching-proposals` · `?team=1` ต้อง supervisor+)
   * ตอนจะเปิดให้ทุกคน แก้บรรทัดนี้กับ `minimumRole` ใน dockNavConfig ที่เดียว
   */
  const { hasPermission } = useAuth();
  const canSeeCallDesk = hasPermission('admin');

  const [holds, setHolds] = useState<CallHold[]>([]);
  const [tally, setTally] = useState<CallResultTally>(EMPTY_TALLY);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  /** แถวที่กำลังกรอกผล + ค่าที่กรอก */
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CallResultOutcome | null>(null);
  const [scope, setScope] = useState<CallResultScope | null>(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** ผลที่เพิ่งบันทึก — โชว์ปลายทางค้างไว้ให้เห็นว่างานวิ่งไปไหน */
  const [justDone, setJustDone] = useState<Record<string, CallResultOutcome>>({});

  const load = useCallback(() => {
    setLoading(true);
    void fetchMyCallQueue().then((data) => {
      setHolds(data.holds);
      setTally(data.tally);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // เดินนาฬิกาเฉพาะเมื่อมีงานค้าง — ไม่ให้หน้าว่างเปลืองรอบ
  useEffect(() => {
    if (holds.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [holds.length]);

  /**
   * คิวเรียงเอง: ใกล้คายก่อน (ถือมานานสุด = ค้างสุด) → แล้วเรียงตามใบขอให้โทรจบเป็นเรื่อง ๆ
   * server เรียง expires_at asc มาแล้ว หน้านี้แค่จัดกลุ่มใบขอโดยคงลำดับความด่วนของใบแรกไว้
   */
  const grouped = useMemo(() => {
    const byJob = new Map<string, CallHold[]>();
    for (const h of holds) {
      const list = byJob.get(h.jobId) ?? [];
      list.push(h);
      byJob.set(h.jobId, list);
    }
    return [...byJob.entries()].map(([jobId, list]) => ({
      jobId,
      requestNo: list[0].requestNo,
      items: list,
    }));
  }, [holds]);

  const dueSoonCount = useMemo(
    () => holds.filter((h) => msLeftOf(h, now) <= DUE_SOON_MS).length,
    [holds, now],
  );

  const openForm = (hold: CallHold) => {
    setOpenRef(hold.id);
    setOutcome(null);
    setScope(null);
    setNote('');
    setError(null);
  };

  const submit = async (hold: CallHold) => {
    if (!outcome || busyId) return;
    if (outcome === 'declined' && !scope) {
      setError('เลือกก่อนว่า “ไม่สนใจงานนี้” หรือ “ไม่หางานแล้ว”');
      return;
    }
    setBusyId(hold.id);
    setError(null);
    try {
      await recordCallResult({
        holdId: hold.id,
        outcome,
        scope: outcome === 'declined' ? (scope ?? 'job') : undefined,
        note: note.trim() || null,
      });
      setJustDone((prev) => ({ ...prev, [hold.id]: outcome }));
      setHolds((prev) => prev.filter((h) => h.id !== hold.id));
      setOpenRef(null);
      void fetchMyCallQueue().then((d) => setTally(d.tally));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกผลโทรไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const giveBack = async (hold: CallHold, reason: 'manual' | 'to_ai') => {
    if (busyId) return;
    setBusyId(hold.id);
    setError(null);
    try {
      await releaseCallHold(hold.id, reason);
      setHolds((prev) => prev.filter((h) => h.id !== hold.id));
      setOpenRef(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'คืนงานไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  if (!canSeeCallDesk) {
    return (
      <div className="space-y-4 pb-10">
        <PageHeader title="งานโทร" subtitle="ยังไม่เปิดใช้งาน" />
        <div className={cn('rounded-2xl border p-6 text-center', DASH.card)}>
          <p className={cn('text-sm font-semibold', DASH.cellStrong)}>ยังไม่เปิดให้ใช้งาน</p>
          <p className={cn('mt-1 text-xs', DASH.muted)}>
            หน้านี้อยู่ระหว่างทดลองใช้ เปิดให้เฉพาะผู้ดูแลระบบก่อน
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="งานโทร"
        subtitle="โทรของฉัน + ภาระงานโทรของทีม อยู่หน้าเดียวกัน"
      />

      {/* ชุดส่งงานที่รออนุมัติ/รอปล่อย — ย้ายมาจากหน้า Follow (เจ้าของสั่ง 10 ส.ค. 2569:
          "หน้า Follow ไม่ต้องมีอนุมัติ") · การอนุมัติคืองานของหน้างานโทรอยู่แล้ว
          ซ่อนตัวเองถ้าไม่มีชุด · สิทธิ์จริงอยู่ที่ API เหมือนเดิม (supervisor/admin) */}
      <div className="px-4 md:px-6 pt-4">
        <CallBatchPanel />
      </div>

      <div className="border-b border-slate-200 pb-1 dark:border-slate-800">
        <h2 className={cn('text-base font-semibold', DASH.cellStrong)}>โทรของฉัน</h2>
        <p className={cn('text-xs', DASH.muted)}>
          งานโทรที่รับมาจากหน้า Matching — เรียงให้แล้วว่าโทรใครก่อน
        </p>
      </div>

      {/* แผนผังปลายทาง — กดผลแล้วงานวิ่งไปไหนต่อ */}
      <div className={cn('rounded-2xl border p-4', DASH.card)}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div>
            <p className={DASH.eyebrow}>รอโทร</p>
            <p className={cn('font-mono text-3xl font-extrabold tabular-nums', DASH.cellStrong)}>
              {holds.length.toLocaleString('th-TH')}
            </p>
            <p className={cn('text-xs', DASH.muted)}>
              {dueSoonCount > 0
                ? `ใกล้คาย ${dueSoonCount.toLocaleString('th-TH')} คน — รีบโทรก่อน`
                : 'ล็อกอยู่ได้ 1 วันต่อคน'}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
              TONE.neutral.soft,
              TONE.neutral.value,
              TONE.neutral.softHover,
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> รีเฟรช
          </button>
        </div>

        <div className="mt-3 grid gap-1.5">
          {OUTCOME_ORDER.map((key) => {
            const tone = TONE[CALL_OUTCOME_TONE[key]];
            const count =
              key === 'declined'
                ? tally.declinedByScope.job
                : (tally.byOutcome[key] ?? 0);
            const extra = key === 'declined' ? tally.declinedByScope.all : null;
            return (
              <div
                key={key}
                className={cn(
                  'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-xs font-semibold',
                  tone.soft,
                  tone.value,
                )}
              >
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                <span>{CALL_RESULT_LABEL[key]}</span>
                <span className={cn('font-normal', DASH.muted)}>
                  → {CALL_RESULT_DESTINATION[key]}
                </span>
                <span className="ml-auto font-mono tabular-nums">
                  วันนี้ {count.toLocaleString('th-TH')}
                  {extra != null && extra > 0
                    ? ` · ไม่หางานแล้ว ${extra.toLocaleString('th-TH')}`
                    : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error ? <p className={cn('px-1 text-xs', TONE.danger.value)}>{error}</p> : null}

      {loading && holds.length === 0 ? (
        <p className={cn('px-1 text-sm', DASH.muted)}>กำลังโหลดงานโทร…</p>
      ) : holds.length === 0 ? (
        <div className={cn('rounded-2xl border p-6 text-center', DASH.card)}>
          <p className={cn('text-sm font-semibold', DASH.cellStrong)}>ยังไม่มีงานโทรที่ถืออยู่</p>
          <p className={cn('mt-1 text-xs', DASH.muted)}>
            ไปที่{' '}
            <Link to="/matching/match" className={cn('font-semibold underline', TONE.primary.value)}>
              หน้า Matching
            </Link>{' '}
            แล้วกด “รับไปโทรเอง” บนการ์ดผู้สมัคร
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.jobId} className={cn('overflow-hidden rounded-2xl border', DASH.card)}>
              <div
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5',
                  DASH.divider,
                  DASH.tableHead,
                )}
              >
                <span className="font-mono text-xs font-bold">
                  {group.requestNo || group.jobId}
                </span>
                <span className="text-[11px]">
                  {group.items.length.toLocaleString('th-TH')} คนต้องโทร
                </span>
              </div>

              {group.items.map((hold) => {
                const left = msLeftOf(hold, now);
                const dueSoon = left <= DUE_SOON_MS;
                const isOpen = openRef === hold.id;
                const busy = busyId === hold.id;
                return (
                  <div
                    key={hold.id}
                    className={cn('border-b px-4 py-3 last:border-b-0', DASH.divider, dueSoon && TONE.warn.soft)}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <NameAvatar name={hold.candidateName || hold.candidateRef} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm font-semibold', DASH.cellStrong)}>
                          {hold.candidateName || `ผู้สมัคร #${hold.candidateRef}`}
                        </p>
                        <p className={cn('text-[11px]', DASH.muted)}>
                          {hold.source === 'board' ? 'คนของเรา' : 'iRecruit'} · คายอีก{' '}
                          <span className={cn('font-semibold', dueSoon ? TONE.warn.value : '')}>
                            {countdown(left)}
                          </span>
                        </p>
                      </div>
                      {!isOpen ? (
                        <button
                          type="button"
                          onClick={() => openForm(hold)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
                            TONE.primary.solid,
                          )}
                        >
                          <Phone className="h-3.5 w-3.5" /> กดผลโทร
                        </button>
                      ) : null}
                    </div>

                    {isOpen ? (
                      <div className={cn('mt-2.5 space-y-2 rounded-xl border px-3 py-2.5', TONE.primary.soft)}>
                        <div className="flex flex-wrap gap-1.5">
                          {OUTCOME_ORDER.map((key) => {
                            const tone = TONE[CALL_OUTCOME_TONE[key]];
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setOutcome(key);
                                  if (key !== 'declined') setScope(null);
                                  setError(null);
                                }}
                                className={cn(
                                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                                  tone.soft,
                                  tone.value,
                                  outcome === key ? 'ring-2 ring-ring' : tone.softHover,
                                )}
                              >
                                {CALL_RESULT_LABEL[key]}
                              </button>
                            );
                          })}
                        </div>

                        {outcome ? (
                          <p className={cn('text-[11px]', DASH.muted)}>
                            ผลนี้จะไปต่อที่: {CALL_RESULT_DESTINATION[outcome]}
                          </p>
                        ) : null}

                        {outcome === 'declined' ? (
                          <div className="space-y-1 text-[11px]">
                            {(
                              [
                                ['job', 'ไม่สนใจงานนี้', 'AI ยังเสนองานอื่นให้เขาได้'],
                                ['all', 'ไม่หางานแล้ว', 'พักเบอร์นี้ ไม่โทรอีก — ดับทุกใบที่เขาแมท'],
                              ] as Array<[CallResultScope, string, string]>
                            ).map(([value, label, hint]) => (
                              <label key={value} className="flex cursor-pointer items-start gap-2">
                                <input
                                  type="radio"
                                  name={`scope-${hold.id}`}
                                  checked={scope === value}
                                  onChange={() => setScope(value)}
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-sky-600"
                                />
                                <span>
                                  <span className={cn('font-semibold', DASH.cellStrong)}>{label}</span>
                                  <span className={cn('ml-1', DASH.muted)}>— {hint}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : null}

                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="โน้ตเพิ่มเติม (ถ้ามี)"
                          className="min-h-[44px] w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void submit(hold)}
                            disabled={busy || !outcome}
                            className={cn(
                              'rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-50',
                              TONE.primary.solid,
                            )}
                          >
                            {busy ? 'กำลังบันทึก…' : 'บันทึกผล'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void giveBack(hold, 'to_ai')}
                            disabled={busy}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50',
                              TONE.info.soft,
                              TONE.info.value,
                              TONE.info.softHover,
                            )}
                          >
                            คืนให้ AI โทรต่อ
                          </button>
                          <button
                            type="button"
                            onClick={() => void giveBack(hold, 'manual')}
                            disabled={busy}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50',
                              TONE.neutral.soft,
                              TONE.neutral.value,
                              TONE.neutral.softHover,
                            )}
                          >
                            คืนเข้าถังกลาง
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenRef(null)}
                            className={cn('px-2 py-1 text-[11px] font-semibold', DASH.muted)}
                          >
                            ปิด
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ผลที่เพิ่งบันทึกในรอบนี้ — ให้เห็นว่างานวิ่งไปไหนต่อ ไม่ใช่หายไปเฉย ๆ */}
      {Object.keys(justDone).length > 0 ? (
        <div className={cn('rounded-2xl border p-4', DASH.card)}>
          <p className={DASH.eyebrow}>เพิ่งบันทึกรอบนี้</p>
          <div className="mt-2 grid gap-1.5">
            {Object.entries(justDone).map(([id, key]) => (
              <p key={id} className={cn('text-xs', TONE[CALL_OUTCOME_TONE[key]].value)}>
                {CALL_RESULT_LABEL[key]} → {CALL_RESULT_DESTINATION[key]}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {/* ยุบ "ภาระโทรทีม" เข้ามาหน้าเดียวกันตามที่เจ้าของสั่ง — เดิมอยู่ที่ /matching/call-team */}
      <CallTeamBoardSection />
    </div>
  );
};

export default MyCallsPage;
