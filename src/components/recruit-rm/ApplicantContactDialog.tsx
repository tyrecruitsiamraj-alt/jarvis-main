import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PublicApplication } from '@/lib/publicApplicationsApi';
import { applicationJobLabel } from '@/lib/recruitRm';
import { applicantAddressLine } from '@/lib/applicantDisplay';
import { dashIfEmpty, EM_DASH } from '@/lib/displayFallback';
import { formatDateTimeTh } from '@/lib/dateTh';
import { fetchRecruitReasons } from '@/lib/recruitReasonsApi';
import type { RecruitReason } from '@/lib/recruitReasons';
import { fetchContactLogs, saveContactLog, type ContactLog } from '@/lib/applicationContactsApi';
import { fetchSiamrajUnitRequests } from '@/lib/siamrajUnitRequestsApi';
import { unitRequestCardTitle } from '@/lib/unitRequestDisplay';
import type { JobRequest } from '@/types';
import { CheckCircle2, Loader2, Phone, XCircle } from 'lucide-react';

/**
 * dialog รายละเอียดผู้สมัคร + บันทึกผลการติดต่อ (ลิสต์ข้อ 7 · เจ้าของสั่ง 14 ส.ค. 2569):
 * "กดเข้าไปที่รายชื่อ โชว์รายละเอียด แต่ด้านบนมีปุ่ม ติดต่อสำเร็จ กับ ติดต่อไม่สำเร็จ
 * · สำเร็จ → นัดได้ไหม → นัดวันไหน นัดที่ไหน ลงหน่วยงานอะไร (dropdown เฉพาะ
 * หน่วยงานที่ยังรับอยู่ หรือบอกว่าหาล่วงหน้า) · ไม่สำเร็จ → เลือกเหตุผล"
 *
 * - dropdown หน่วยงาน = ใบขอเปิดจาก feed (จำกัดปี 2567 แล้ว) + ตัวเลือก "หาล่วงหน้า"
 *   (เจ้าของเคาะ: "บางกรณีนัดไว้แต่ไม่รู้เอาไปไหน")
 * - เหตุผลไม่สำเร็จ = master เหตุผล process '1' (การติดต่อ) × outcome 'C' (ไม่สำเร็จ)
 * - สถานะใบขยับตามขั้นที่คนทำ (server): นัดได้ → converted · ที่เหลือ → contacted
 */
export default function ApplicantContactDialog({
  application,
  onClose,
  onSaved,
}: {
  application: PublicApplication | null;
  onClose: () => void;
  /** บันทึกสำเร็จ — ให้หน้าแม่ reload ลิสต์ (สถานะใบเปลี่ยน แถวอาจย้ายแท็บ) */
  onSaved: () => void;
}) {
  /** โหมดที่เลือก: ยังไม่เลือก / สำเร็จ / ไม่สำเร็จ */
  const [mode, setMode] = useState<'idle' | 'ok' | 'fail'>('idle');
  /** ฝั่งสำเร็จ: นัดได้ไหม */
  const [canSchedule, setCanSchedule] = useState<boolean | null>(null);
  const [appointmentAt, setAppointmentAt] = useState('');
  const [appointmentPlace, setAppointmentPlace] = useState('');
  /** ใบขอที่จะลง — '' = "หาล่วงหน้า" (นัดไว้แต่ยังไม่รู้ลงใบไหน) */
  const [jobId, setJobId] = useState('');
  /** ฝั่งไม่สำเร็จ: เหตุผลจาก master */
  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reasons, setReasons] = useState<RecruitReason[]>([]);
  const [openJobs, setOpenJobs] = useState<JobRequest[]>([]);
  const [logs, setLogs] = useState<ContactLog[]>([]);

  // โหลดของประกอบเมื่อเปิด dialog เท่านั้น (ใบขอ 500 ใบ + เหตุผล 67 — ไม่โหลดค้างทั้งหน้า)
  useEffect(() => {
    if (!application) return;
    setMode('idle');
    setCanSchedule(null);
    setAppointmentAt('');
    setAppointmentPlace('');
    setJobId('');
    setReasonId('');
    setNote('');
    setError(null);
    void fetchContactLogs(application.id).then(setLogs);
    // เหตุผล "การติดต่อ × ไม่สำเร็จ" ตาม master ระบบเดิม
    void fetchRecruitReasons({ processCode: '1', outcomeCode: 'C' })
      .then(setReasons)
      .catch(() => setReasons([]));
    void fetchSiamrajUnitRequests(500)
      .then(setOpenJobs)
      .catch(() => setOpenJobs([]));
  }, [application]);

  const selectedReason = useMemo(
    () => reasons.find((r) => r.id === reasonId) ?? null,
    [reasons, reasonId],
  );
  const selectedJob = useMemo(
    () => openJobs.find((j) => j.id === jobId) ?? null,
    [openJobs, jobId],
  );

  const submit = async () => {
    if (!application || busy) return;
    setError(null);
    if (mode === 'idle') return setError('เลือกก่อนว่าติดต่อสำเร็จหรือไม่สำเร็จ');
    if (mode === 'fail' && !selectedReason) return setError('เลือกเหตุผลที่ติดต่อไม่สำเร็จ');
    if (mode === 'ok' && canSchedule === null) return setError('เลือกก่อนว่านัดได้ไหม');
    if (mode === 'ok' && canSchedule && !appointmentAt) return setError('นัดได้ต้องใส่วันนัด');
    setBusy(true);
    try {
      await saveContactLog({
        applicationId: application.id,
        ok: mode === 'ok',
        reasonId: mode === 'fail' ? (selectedReason?.id ?? null) : null,
        reasonLabel: mode === 'fail' ? (selectedReason?.name ?? null) : null,
        appointmentAt: mode === 'ok' && canSchedule ? appointmentAt : null,
        appointmentPlace: mode === 'ok' && canSchedule ? appointmentPlace || null : null,
        jobId: mode === 'ok' && canSchedule && jobId ? jobId : null,
        jobLabel:
          mode === 'ok' && canSchedule
            ? selectedJob
              ? unitRequestCardTitle(selectedJob)
              : 'หาล่วงหน้า'
            : null,
        note: note.trim() || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกผลติดต่อไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const a = application;
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        {a ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">{a.full_name}</DialogTitle>
              <DialogDescription>
                {dashIfEmpty(applicationJobLabel(a))} · สมัคร {a.created_at ? formatDateTimeTh(a.created_at) : EM_DASH}
              </DialogDescription>
            </DialogHeader>

            {/* ปุ่มผลอยู่บนสุด (เจ้าของสั่ง: "ด้านบนมีปุ่มติดต่อสำเร็จ กับ ติดต่อไม่สำเร็จ") */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('ok');
                  setError(null);
                }}
                aria-pressed={mode === 'ok'}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors',
                  TONE.success.outline,
                  mode === 'ok' && 'ring-2 ring-ring',
                )}
              >
                <CheckCircle2 className="h-4 w-4" /> ติดต่อสำเร็จ
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('fail');
                  setError(null);
                }}
                aria-pressed={mode === 'fail'}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors',
                  TONE.danger.outline,
                  mode === 'fail' && 'ring-2 ring-ring',
                )}
              >
                <XCircle className="h-4 w-4" /> ติดต่อไม่สำเร็จ
              </button>
            </div>

            {/* ฝั่งสำเร็จ: นัดได้ไหม → วัน/ที่/หน่วยงาน */}
            {mode === 'ok' ? (
              <div className={cn('space-y-2 rounded-xl border px-3 py-2.5', TONE.success.soft)}>
                <p className={cn('text-xs font-semibold', DASH.cellStrong)}>นัดสัมภาษณ์ได้ไหม?</p>
                <div className="flex gap-1.5">
                  {(
                    [
                      [true, 'นัดได้'],
                      [false, 'ยังนัดไม่ได้'],
                    ] as Array<[boolean, string]>
                  ).map(([v, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setCanSchedule(v)}
                      aria-pressed={canSchedule === v}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-semibold',
                        TONE.success.outline,
                        canSchedule === v && 'ring-2 ring-ring',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {canSchedule ? (
                  <div className="space-y-2 text-xs">
                    <label className="block">
                      <span className={DASH.muted}>นัดวันไหน *</span>
                      <input
                        type="date"
                        value={appointmentAt}
                        onChange={(e) => setAppointmentAt(e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="block">
                      <span className={DASH.muted}>นัดที่ไหน</span>
                      <input
                        type="text"
                        value={appointmentPlace}
                        onChange={(e) => setAppointmentPlace(e.target.value)}
                        placeholder="เช่น สำนักงานใหญ่ / หน้างาน"
                        className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <label className="block">
                      <span className={DASH.muted}>ลงหน่วยงานอะไร (เฉพาะใบขอที่ยังเปิดรับ)</span>
                      <select
                        value={jobId}
                        onChange={(e) => setJobId(e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {/* เจ้าของเคาะ: บางกรณีนัดไว้แต่ยังไม่รู้ลงใบไหน — เป็นค่าเริ่มต้น */}
                        <option value="">ยังไม่ระบุ — หาล่วงหน้า</option>
                        {openJobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            {unitRequestCardTitle(j)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ฝั่งไม่สำเร็จ: เหตุผลจาก master (ระบบเดิม 67 ตัว — process การติดต่อ × ไม่สำเร็จ) */}
            {mode === 'fail' ? (
              <div className={cn('space-y-2 rounded-xl border px-3 py-2.5', TONE.danger.soft)}>
                <p className={cn('text-xs font-semibold', DASH.cellStrong)}>เหตุผลที่ติดต่อไม่สำเร็จ *</p>
                <select
                  value={reasonId}
                  onChange={(e) => setReasonId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">— เลือกเหตุผล —</option>
                  {reasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {reasons.length === 0 ? (
                  <p className={cn('text-[10px]', DASH.muted)}>โหลดเหตุผลไม่ได้ — ลองปิดแล้วเปิดใหม่</p>
                ) : null}
              </div>
            ) : null}

            {mode !== 'idle' ? (
              <>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="โน้ตเพิ่มเติม (ถ้ามี)"
                  className="min-h-[44px] w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {error ? <p className={cn('text-[11px]', TONE.danger.value)}>{error}</p> : null}
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy}
                  className="jarvis-btn-primary w-full justify-center disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} บันทึกผลติดต่อ
                </button>
              </>
            ) : null}

            {/* รายละเอียดผู้สมัคร */}
            <div className={cn('space-y-1 rounded-xl border px-3 py-2.5 text-xs', TONE.neutral.soft)}>
              <p>
                <Phone className="mr-1 inline h-3 w-3" aria-hidden />
                <a href={`tel:${a.phone}`} className="font-medium text-primary hover:underline">
                  {dashIfEmpty(a.phone)}
                </a>
              </p>
              <p className={DASH.muted}>{dashIfEmpty(applicantAddressLine(a))}</p>
              {a.note ? <p className={DASH.muted}>หมายเหตุ: {a.note}</p> : null}
            </div>

            {/* ประวัติการติดต่อ (log รายครั้ง — ล่าสุดก่อน) */}
            {logs.length > 0 ? (
              <div className="space-y-1">
                <p className={cn('text-[11px] font-semibold', DASH.muted)}>ประวัติการติดต่อ</p>
                {logs.map((l) => (
                  <div
                    key={l.id}
                    className={cn(
                      'rounded-lg border px-2.5 py-1.5 text-[11px]',
                      l.ok ? TONE.success.soft : TONE.danger.soft,
                    )}
                  >
                    <span className="font-semibold">{l.ok ? '✓ สำเร็จ' : '✗ ไม่สำเร็จ'}</span>
                    {l.reasonLabel ? ` · ${l.reasonLabel}` : ''}
                    {l.appointmentAt
                      ? ` · นัด ${formatDateTimeTh(l.appointmentAt)}${l.appointmentPlace ? ` ที่ ${l.appointmentPlace}` : ''} · ${l.jobLabel ?? 'หาล่วงหน้า'}`
                      : ''}
                    <span className={cn('ml-1', DASH.muted)}>
                      — {l.createdByName ?? 'ไม่ระบุ'} · {formatDateTimeTh(l.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
