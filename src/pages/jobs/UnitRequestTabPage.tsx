import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { resolveUnitDetailBackPath } from '@/lib/jobUnitSessionState';
import { backLabelFor } from '@/lib/stageOrigin';
import UnitRequestTabs, { type UnitRequestTabId } from '@/components/jobs/UnitRequestTabs';
import { MyCallsSection } from '@/pages/matching/MyCallsPage';
import { fetchAllUnitOptions, fetchSiamrajUnitRequest } from '@/lib/siamrajUnitRequestsApi';
import type { BoardUnitOption } from '@/lib/boardUnitPicker';
import { fetchJobApplications, type PublicApplication } from '@/lib/publicApplicationsApi';
import { fetchRecruitLaneCandidates, tierChipClass, type RecruitLaneMatch } from '@/lib/recruitLaneApi';
import { fetchBoardMatchForJob } from '@/lib/boardMatchApi';
import { dispatchLumosCalls } from '@/lib/lumosDispatchApi';
import { acquireCallHold } from '@/lib/callHoldsApi';
import { LumosSendBar } from '@/components/matching/LumosPanels';
import type { BoardMatchResponse } from '@/lib/boardCandidateTypes';
import {
  groupApplicationsByOrigin,
  summarizeUnitMatches,
  unitMatchFactLine,
  unitMatchOriginLabel,
  unitMatchStatus,
} from '@/lib/unitMatchingView';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import SelectionProgressControls from '@/components/recruit-rm/SelectionProgressControls';
import { isInterestedApplicant, isInterestedOutcome } from '@/lib/applicantCallOutcome';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { EM_DASH } from '@/lib/displayFallback';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { SEARCH_ALL_POOLS } from '@/lib/candidateSearchLabels';
import type { JobRequest } from '@/types';
import { LoaderCircle, RefreshCw, Search, Users } from 'lucide-react';

const STATUS_CLASS: Record<string, string> = {
  success: 'jarvis-chip jarvis-chip-success',
  warn: 'jarvis-chip jarvis-chip-warn',
  danger: 'jarvis-chip jarvis-chip-danger',
  neutral: 'jarvis-chip jarvis-chip-neutral',
};

/** 🔴 แท็บ `posting` มีหน้าของตัวเอง (`UnitRequestPostingTabPage`) — ไฟล์นี้ไม่รับ */
export type UnitRequestSubTab = Exclude<UnitRequestTabId, 'detail' | 'posting'>;

const TAB_TITLE: Record<UnitRequestSubTab, string> = {
  applicants: 'ผู้สมัคร',
  'ai-match': 'AI Match',
  contact: 'การติดต่อ',
};

/**
 * แท็บย่อยของใบขอ — ผู้สมัคร / AI Match / การติดต่อ
 * (เจ้าของสั่ง 16 ส.ค. 2569 เย็น · แท็บ "รายละเอียดงาน" ยังเป็นหน้าเดิมคนละไฟล์)
 *
 * ⚠️ **ผู้สมัคร ≠ AI Match** — ผู้สมัครคือคนที่มีใบสมัครจริงกับใบขอนี้ ส่วน AI Match
 * คือคนที่ AI แนะนำ ซึ่งยังไม่ใช่ใบสมัคร · เอาปนกันแล้วยอด "ผู้สมัคร" จะเฟ้อทันที
 */
const UnitRequestTabPage: React.FC<{ tab: UnitRequestSubTab }> = ({ tab }) => {
  const { id = '' } = useParams();
  /**
   * 🔴 ปุ่มย้อนกลับต้องพากลับ **หน้าที่พามา** ไม่ใช่ `/jobs/list` ตายตัว
   * (เจ้าของทัก 27 ส.ค. 2569: กดจากกล่องงานแล้วงงว่าอยู่ไหน · กดกลับไปโผล่หน้าอื่น)
   */
  const location = useLocation();
  const backPath = resolveUnitDetailBackPath({
    stateReturnTo: (location.state as { returnTo?: string } | null)?.returnTo,
    search: location.search,
  });
  const [job, setJob] = useState<JobRequest | null>(null);
  const [items, setItems] = useState<PublicApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [aiMatches, setAiMatches] = useState<RecruitLaneMatch[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  /**
   * ผลแมท "คนของเรา" ของใบนี้ — **แหล่งเดียวกับหน้าจับคู่งาน** (เจ้าของสั่ง 17 ส.ค. 2569)
   * ต่างกันแค่ขอบเขต: หน้าจับคู่งานโชว์ทุกใบ · แท็บนี้โชว์เฉพาะใบนี้
   * โหลดเองทันทีที่เปิดแท็บ ไม่ต้องกดปุ่ม (ของเดิมต้องกด "ให้ AI ค้นหา" ก่อนถึงจะเห็นอะไร)
   */
  const [board, setBoard] = useState<BoardMatchResponse | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  /**
   * ยืนยันก่อนสั่ง AI คิดใหม่ — ผลใหม่ **ทับผลเดิม** ที่ทีมอาจกำลังไล่โทรอยู่
   * (หน้าจับคู่งานมี popup นี้ตั้งแต่ต้น แต่แท็บนี้ไม่มี · เจ้าของสั่งให้มีทุกที่ 22 ส.ค. 2569)
   */
  const [rematchConfirm, setRematchConfirm] = useState(false);
  const [boardWaiting, setBoardWaiting] = useState(false);

  /**
   * หน่วยงานให้เลือกในขั้น "รอหน่วยงานพิจารณา/รอสัมภาษณ์" (Phase 6.6)
   * ⚠️ โหลดพัง = `[]` → ปุ่มเลือกหน่วยงานไม่โผล่ (ห้ามบล็อกงานอื่นในแท็บ)
   * ใช้ชุดเดียวกับหน้า Follow (`?units=1`) เพื่อให้ชื่อ/รหัสไซต์ตรงกันทั้งระบบ
   */
  const [units, setUnits] = useState<BoardUnitOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetchAllUnitOptions()
      .then((v) => {
        if (!cancelled) setUnits(v);
      })
      .catch(() => {
        if (!cancelled) setUnits([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * ติ๊กคนจากผล AI Match แล้วลงมือได้จากแท็บนี้เลย (Phase 6.7 · เจ้าของเคาะ 22 ส.ค. 2569)
   *
   * 🔴 เดิมแท็บนี้ "ดูอย่างเดียว" — เห็นว่า AI แนะนำใครแล้วต้องเด้งไปหน้าจับคู่งานเพื่อกดส่ง
   * ตอนนี้ใช้ **แถบปุ่มตัวเดียวกับหน้าจับคู่งาน** (`LumosSendBar` → `lumosSendActions`)
   * และ **เส้นส่งเดียวกัน** (`dispatchLumosCalls`) — ห้ามก๊อปตรรกะปุ่ม/เส้นส่งมาไว้ที่นี่
   * ⚠️ ส่ง AI = ยิงสายจริง → ต้องผ่านป๊อปยืนยันรายชื่อก่อนทุกครั้ง
   */
  const [picked, setPicked] = useState<number[]>([]);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [holding, setHolding] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  /** คนที่ส่ง/ล็อกได้ต้องมีเบอร์ — ไม่มีเบอร์ติ๊กไม่ได้ (ปุ่มจะบอกเหตุผลเอง) */
  const sendableMatches = useMemo(
    () => (board?.matches ?? []).filter((m) => (m.mobile ?? '').trim()),
    [board],
  );
  const pickedMatches = useMemo(
    () => sendableMatches.filter((m) => picked.includes(m.card_id)),
    [sendableMatches, picked],
  );
  const togglePick = (cardId: number) =>
    setPicked((prev) => (prev.includes(cardId) ? prev.filter((x) => x !== cardId) : [...prev, cardId]));

  const sendPickedToAi = async () => {
    const jobKey = job?.id;
    if (!jobKey || pickedMatches.length === 0 || sending) return;
    setSending(true);
    setActionNotice(null);
    try {
      const r = await dispatchLumosCalls({
        jobId: jobKey,
        boardCardIds: pickedMatches.map((m) => m.card_id),
        irecruitIds: [],
      });
      const parts = [`เข้าคิว AI โทร ${r.queued} คน`];
      if (r.duplicated.length > 0) parts.push(`เคยส่งแล้ว ${r.duplicated.length} คน (ไม่ส่งซ้ำ)`);
      if (r.skipped.length > 0) {
        parts.push(`ส่งไม่ได้ ${r.skipped.length} คน — ${r.skipped[0].reason}`);
      }
      setActionNotice(parts.join(' · '));
      setPicked([]);
      setSendConfirm(false);
    } catch (e) {
      setActionNotice(e instanceof Error ? e.message : 'ส่ง AI โทรไม่สำเร็จ');
      setSendConfirm(false);
    } finally {
      setSending(false);
    }
  };

  /** เก็บไปโทรเอง = ล็อกเบอร์กัน AI ทับ (คนพวกนี้ยังไม่มีใบสมัคร จึงไม่มี claim ให้จอง) */
  const holdPickedForSelf = async () => {
    const jobKey = job?.id;
    if (!jobKey || pickedMatches.length === 0 || holding) return;
    setHolding(true);
    setActionNotice(null);
    let ok = 0;
    const failed: string[] = [];
    for (const m of pickedMatches) {
      const r = await acquireCallHold({
        phone: (m.mobile ?? '').trim(),
        source: 'board',
        candidateRef: String(m.card_id),
        candidateName: m.full_name,
        jobId: jobKey,
      });
      if (r.ok) ok += 1;
      else failed.push(`${m.full_name} (${r.heldBy?.heldByName || 'มีคนถืออยู่'})`);
    }
    setActionNotice(
      [
        ok > 0 ? `เก็บไปโทรเอง ${ok} คน — ล็อกเบอร์กัน AI โทรทับแล้ว` : 'ยังเก็บไม่ได้เลย',
        failed.length > 0 ? `ข้าม ${failed.length} คน: ${failed.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    );
    setPicked([]);
    setHolding(false);
  };

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [j, apps] = await Promise.all([
        fetchSiamrajUnitRequest(id).catch(() => null),
        fetchJobApplications(id),
      ]);
      setJob((j as JobRequest | null) ?? null);
      setItems(apps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดรายชื่อไม่สำเร็จ');
    }
  }, [id]);

  useEffect(() => {
    if (id) void reload();
  }, [id, reload]);

  /**
   * 🔴 **ต้องใช้ `job.id` ไม่ใช่ `id` จาก URL** — id บน route คือเลขที่ใบขอเปล่า ๆ
   * (`OPL6908052`) แต่หน้าจับคู่งานส่ง id เต็ม (`siamraj-sql:OPL6908052`)
   * ผลแมทถูกเก็บโดยคีย์ตามสตริงที่ส่งไป ส่งคนละรูป = **คนละช่องเก็บ** สองหน้าจะเห็น
   * คนละผลทั้งที่เป็นใบเดียวกัน (เจอจริงตอนตรวจ 17 ส.ค. — มีแถว `OPL6908052`
   * โผล่มาข้างแถว `siamraj-sql:OPL6908052`) · เจ้าของสั่งให้เป็น "ค่าเดียวกัน"
   */
  const loadBoardMatch = useCallback(
    async (refresh = false) => {
      const jobKey = job?.id;
      if (!jobKey) return;
      setBoardError(null);
      try {
        const data = await fetchBoardMatchForJob(jobKey, { refresh });
        if (data.pending) {
          // worker หลังบ้านปิดอยู่ = รอไปก็ไม่มีผล ต้องบอกให้ไปเปิด ไม่ใช่หมุนค้าง
          if (data.worker_active === false) {
            setBoardWaiting(false);
            setBoardError('ระบบค้นหาหลังบ้านปิดอยู่ — ต้องเปิด MATCH_PRECOMPUTE_ENABLED บนเซิร์ฟเวอร์ก่อน');
            return;
          }
          setBoardWaiting(true);
          return;
        }
        setBoard(data);
        setBoardWaiting(Boolean(data.refresh_queued));
      } catch (e) {
        setBoardWaiting(false);
        setBoardError(e instanceof Error ? e.message : 'โหลดผลแมทไม่สำเร็จ');
      }
    },
    [job?.id],
  );

  // เปิดแท็บ AI Match = โหลดเลย (ไม่ต้องกดปุ่ม) · รอ job โหลดก่อนเพราะต้องใช้ id เต็ม
  useEffect(() => {
    if (tab === 'ai-match' && job?.id) void loadBoardMatch(false);
  }, [tab, job?.id, loadBoardMatch]);

  // ระหว่างรอ worker คิด — เช็คซ้ำทุก 15 วิ แล้วผลโผล่เอง (แพตเทิร์นเดียวกับหน้าจับคู่งาน)
  useEffect(() => {
    if (!boardWaiting || tab !== 'ai-match') return;
    const timer = setInterval(() => void loadBoardMatch(false), 15_000);
    return () => clearInterval(timer);
  }, [boardWaiting, tab, loadBoardMatch]);

  const summary = useMemo(() => summarizeUnitMatches(items ?? []), [items]);
  const groups = useMemo(() => groupApplicationsByOrigin(items ?? []), [items]);
  /** คนที่ "สนใจ" ของใบขอนี้ (Phase 6.10) — กติกาเดียวกับแท็บ/กล่องอื่นทั้งระบบ */
  const interestedItems = useMemo(
    () => (items ?? []).filter((a) => isInterestedApplicant(a)),
    [items],
  );

  /**
   * ค้นคนที่ยังไม่สมัคร (เลนสรรหา) — **ไม่ส่งเข้าคิวโทร** จากหน้านี้
   * เพราะแท็บนี้ตอบว่า "AI แนะนำใคร" ไม่ใช่ปุ่มยิงสาย · ส่งจริงยังอยู่ที่ปุ่มบนการ์ดกล่องงาน
   */
  const runAiMatch = async () => {
    setAiBusy(true);
    setAiNotice(null);
    try {
      const r = await fetchRecruitLaneCandidates(id, { send: false });
      setAiMatches(r.matches);
      if (r.matches.length === 0) setAiNotice(`ค้นจากกอง ${r.pool_size} คน — ยังไม่มีใครเข้าข่าย`);
    } catch (e) {
      setAiNotice(e instanceof Error ? e.message : 'ค้นหาไม่สำเร็จ');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="relative">
      <PageHeader
        title={TAB_TITLE[tab]}
        subtitle={job ? jobBoardCardTitle(job) : id}
        backPath={backPath}
        backLabel={backLabelFor(backPath)}
      />

      <div className="space-y-4 px-4 py-4 md:px-6">
        <UnitRequestTabs
          jobId={id}
          active={tab}
          counts={{ applicants: items?.length, 'ai-match': aiMatches?.length }}
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {/* ── ผู้สมัคร ───────────────────────────────────── */}
        {tab === 'applicants' ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/70 bg-secondary/40 px-3.5 py-2.5 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Users className={cn('h-4 w-4', TONE.info.value)} />
                ผู้สมัคร {summary.total} คน
              </span>
              {job ? (
                <span className="text-muted-foreground">· ต้องการ {jobPositionUnits(job)} ตำแหน่ง</span>
              ) : null}
              <span className="text-muted-foreground">· สนใจแล้ว {summary.interested}</span>
              <span className="text-muted-foreground">· ยังไม่ได้โทร {summary.waiting}</span>
              <button
                type="button"
                onClick={() => void reload()}
                className={cn(
                  'ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold',
                  TONE.neutral.outline,
                )}
              >
                <RefreshCw className="h-3.5 w-3.5" /> รีเฟรช
              </button>
            </div>

            {!items && !error ? (
              <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" /> กำลังโหลด…
              </p>
            ) : null}

            {items && items.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-card px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">ยังไม่มีใครสมัครใบขอนี้</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  ใบสมัครจากหน้าสาธารณะจะมาโผล่ที่นี่ · กดแท็บ “AI Match” เพื่อดูว่า AI แนะนำใครบ้าง
                </p>
              </div>
            ) : null}

            {groups.map((g) => (
              <section key={g.origin} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h2 className="text-sm font-bold text-foreground">{g.label}</h2>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {g.items.length} คน
                  </span>
                  {g.hint ? <span className="text-xs text-muted-foreground">· {g.hint}</span> : null}
                </div>
                <ul className="space-y-1.5">
                  {g.items.map((a) => {
                    const st = unitMatchStatus(a);
                    const originLabel = unitMatchOriginLabel(a);
                    return (
                      <li
                        key={a.id}
                        className="grid gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm sm:grid-cols-[1.4fr_1.2fr_auto] sm:items-center"
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          <b className="font-semibold text-foreground">{a.full_name}</b>
                          {originLabel ? (
                            <span className="jarvis-chip jarvis-chip-violet">{originLabel}</span>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {unitMatchFactLine(a) || EM_DASH}
                        </span>
                        <span className="sm:text-right">
                          <span className={STATUS_CLASS[st.tone]}>{st.text}</span>
                        </span>
                        {/* ขั้นในกระบวนการจ้าง + เช็คลิสต์ (ข้อ 5–7) — โผล่เฉพาะคนที่
                            คุยแล้วสนใจหรือมีนัดแล้ว · คนที่ยังไม่ได้โทรไม่ต้องรก */}
                        {a.appointment_at || isInterestedOutcome(a.last_call_outcome) || a.selection_status ? (
                          <div className="sm:col-span-3">
                            <SelectionProgressControls
                              subject={{ kind: 'application', application: a }}
                              units={units}
                              onSaved={(next) =>
                                setItems((cur) =>
                                  (cur ?? []).map((x) => (x.id === next.id ? next : x)),
                                )
                              }
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        ) : null}

        {/* ── AI Match ──────────────────────────────────── */}
        {tab === 'ai-match' ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/70 bg-secondary/40 px-3.5 py-2.5 text-sm">
              <span className="font-semibold">
                คนของเราที่ AI แนะนำ {board ? `${board.matches.length} คน` : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                {board
                  ? `· จากกอง ${board.pool_size.toLocaleString('th-TH')} คน (To do · ไม่มีงาน)`
                  : '· ยังไม่ใช่ใบสมัคร — ต้องโทรถามก่อน'}
              </span>
              <button
                type="button"
                disabled={boardWaiting}
                onClick={() => setRematchConfirm(true)}
                title="สั่งให้หลังบ้านคิดใหม่ — ผลเดิมยังแสดงอยู่ระหว่างรอ"
                className={cn(
                  'ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50',
                  TONE.info.outline,
                )}
              >
                {boardWaiting ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                คิดใหม่
              </button>
            </div>

            {boardError ? (
              <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                {boardError}
              </p>
            ) : null}

            {!board && boardWaiting ? (
              <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
                AI กำลังคิดที่หลังบ้าน — ผลจะขึ้นเองเมื่อเสร็จ
              </p>
            ) : null}

            {board && board.matches.length > 0 ? (
              <ul className="space-y-1.5">
                {board.matches.map((m) => (
                  <li
                    key={m.card_id}
                    className="grid gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm sm:grid-cols-[1.3fr_1.3fr_auto] sm:items-center"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        {/* ติ๊กได้เฉพาะคนที่มีเบอร์ — ไม่มีเบอร์ส่ง/ล็อกไม่ได้ทั้งคู่ */}
                        <input
                          type="checkbox"
                          checked={picked.includes(m.card_id)}
                          disabled={!(m.mobile ?? '').trim() || sending || holding}
                          onChange={() => togglePick(m.card_id)}
                          aria-label={`เลือก ${m.full_name}`}
                          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-sky-600 disabled:cursor-not-allowed"
                        />
                        <span className="min-w-0 truncate font-semibold text-foreground">
                          {m.full_name}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[m.job1_name, m.province_name, m.column_label].filter(Boolean).join(' · ') ||
                          EM_DASH}
                      </span>
                    </span>
                    <span className="min-w-0 truncate text-xs text-muted-foreground">{m.reason}</span>
                    <span
                      className={cn(
                        'justify-self-start rounded-full px-2.5 py-0.5 text-xs font-semibold sm:justify-self-end',
                        m.tier === 'green'
                          ? TONE.success.chip
                          : m.tier === 'yellow'
                            ? TONE.warn.chip
                            : TONE.neutral.chip,
                      )}
                    >
                      {m.tier === 'green' ? 'ตรงสาย' : m.tier === 'yellow' ? 'ใกล้เคียง' : 'คนละสาย'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : board ? (
              <div className="rounded-xl border border-border/70 bg-card px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">ยังไม่มีคนของเราที่เข้าข่ายใบนี้</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ลองกด “{SEARCH_ALL_POOLS.label}” ข้างล่าง — {SEARCH_ALL_POOLS.hint}
                </p>
              </div>
            ) : null}

            {/* แถบปุ่มลงมือ (Phase 6.7) — ตัวเดียวกับหน้าจับคู่งาน (lumosSendActions คุมเหตุผล)
                ⚠️ ไม่มีปุ่ม "ส่งทั้งหมด" ที่นี่: แท็บนี้เป็นมุมของใบขอเดียว ส่งทั้งใบทำที่หน้าจับคู่งาน
                (ปุ่มเดียวกันคนละพฤติกรรม = บั๊ก — จึงส่ง allCount = จำนวนที่ติ๊กเท่านั้น) */}
            {board && sendableMatches.length > 0 ? (
              <LumosSendBar
                count={pickedMatches.length}
                allCount={pickedMatches.length}
                matchedCount={sendableMatches.length}
                onSend={() => setSendConfirm(true)}
                onSendAll={() => setSendConfirm(true)}
                onCreateBatch={() => setActionNotice('ตั้งคิวแบบหน่วงเวลาทำที่หน้าจับคู่งาน')}
                onClear={() => setPicked([])}
                busy={sending}
                creatingBatch={false}
                onHoldSelf={() => void holdPickedForSelf()}
                holdingSelf={holding}
              />
            ) : null}

            {actionNotice ? (
              <p className={cn('rounded-xl border px-3 py-2 text-sm', TONE.info.soft, TONE.info.value)}>
                {actionNotice}
              </p>
            ) : null}

            {/* ── หาผู้สมัครเพิ่ม (เลนสรรหา · คนที่ยังไม่สมัคร) ─────────────── */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/70 bg-secondary/40 px-3.5 py-2.5 text-sm">
              <span className="font-semibold">{SEARCH_ALL_POOLS.label}</span>
              <span className="text-xs text-muted-foreground">
                · ค้นจากฐานคนที่ยังไม่สมัคร (Checklist · ฐานใหม่ · iRecruit) — หน้านี้ดูอย่างเดียว
                ไม่ส่งเข้าคิวโทร
              </span>
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => void runAiMatch()}
                className={cn(
                  'ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50',
                  TONE.neutral.outline,
                )}
              >
                {aiBusy ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                {aiMatches ? SEARCH_ALL_POOLS.again : SEARCH_ALL_POOLS.label}
              </button>
            </div>

            {aiNotice ? (
              <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{aiNotice}</p>
            ) : null}

            {aiMatches && aiMatches.length > 0 ? (
              <ul className="space-y-1.5">
                {aiMatches.map((m) => (
                  <li
                    key={m.ref}
                    className="grid gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm sm:grid-cols-[1.4fr_1.4fr_auto] sm:items-center"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <b className="font-semibold text-foreground">{m.full_name}</b>
                      <span className="jarvis-chip jarvis-chip-violet">{m.source_label}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[m.position_text, m.location_label].filter(Boolean).join(' · ') || EM_DASH}
                    </span>
                    <span className="sm:text-right">
                      <span className={tierChipClass(m.tier)}>
                        {m.tier === 'green' ? 'เข้าข่ายมาก' : m.tier === 'red' ? 'ห่างไกล' : 'พอได้'}
                      </span>
                    </span>
                    {m.reason ? (
                      <span className="text-[11px] text-muted-foreground sm:col-span-3">{m.reason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        {/* ── การติดต่อ ─────────────────────────────────── */}
        {tab === 'contact' ? (
          <>
            {/* คนที่ตอบว่าสนใจจากการโทร — ของทั้งใบขอ (Phase 6.10 · เจ้าของเคาะ 22 ส.ค. 2569)
                🔴 เดิมแท็บนี้มีแต่ "ถังโทรของฉัน" ซึ่งเป็นของคนที่เปิดดูคนเดียว → คนสนใจ
                ที่คนอื่นโทรได้มาไม่โผล่ที่ไหนในใบขอเลย · กติกา "ใครสนใจ" มาจาก
                `applicantCallOutcome` ที่เดียว (เทียบผลโทรกับผลติดต่อ อันใหม่กว่าชนะ) */}
            {interestedItems.length > 0 ? (
              <section className={cn('space-y-2 rounded-xl border px-3 py-2.5', TONE.success.soft)}>
                <p className={cn('text-xs font-semibold', TONE.success.value)}>
                  คนที่ตอบว่าสนใจจากการโทร {interestedItems.length} คน — ของทั้งใบขอ (ทุกคนเห็น)
                </p>
                <ul className="space-y-1.5">
                  {interestedItems.map((a) => (
                    <li key={a.id} className="rounded-xl border border-border/70 bg-card px-3 py-2 text-sm">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <b className="font-semibold text-foreground">{a.full_name}</b>
                        <span className="font-mono text-[11px] text-muted-foreground">{a.phone}</span>
                        {unitMatchOriginLabel(a) ? (
                          <span className="jarvis-chip jarvis-chip-violet">{unitMatchOriginLabel(a)}</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {unitMatchFactLine(a) || EM_DASH}
                      </span>
                      {/* ตั้งขั้น/เช็คลิสต์ได้จากที่นี่เลย ไม่ต้องเด้งไปแท็บผู้สมัคร */}
                      <div className="mt-2">
                        <SelectionProgressControls
                          subject={{ kind: 'application', application: a }}
                          units={units}
                          onSaved={(next) =>
                            setItems((cur) => (cur ?? []).map((x) => (x.id === next.id ? next : x)))
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <p className="rounded-xl border border-border/70 bg-card px-3 py-2 text-[11px] text-muted-foreground">
              งานโทรที่คุณเก็บไว้เอง — เก็บแล้ว AI จะไม่โทรทับเบอร์นั้น ·
              รายการนี้เป็นของคุณคนเดียว ไม่ใช่ของทั้งใบขอ
            </p>
            <MyCallsSection />
          </>
        ) : null}
      </div>

      {/* 🔴 ยืนยันก่อนให้ AI โทรจริง — โชว์รายชื่อ (กติกา: ปุ่มที่ยิงสายต้องมีป๊อปทุกตัว) */}
      <AlertDialog open={sendConfirm} onOpenChange={setSendConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ให้ AI โทรหา {pickedMatches.length} คนนี้?</AlertDialogTitle>
            <AlertDialogDescription>
              AI จะโทรออกหาคนในรายชื่อนี้จริง (เว้นช่วง 20:00–08:00 น. ระบบเลื่อนให้เอง) ·
              คนที่มีเจ้าหน้าที่ถือไปโทรอยู่ · เบอร์ที่พักไว้ · คนที่เคยปฏิเสธงานใบนี้
              ระบบจะข้ามให้เองและรายงานกลับ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border/70 px-3 py-2">
            <ul className="space-y-0.5 text-xs">
              {pickedMatches.slice(0, 12).map((m, i) => (
                <li key={m.card_id}>
                  {i + 1}. {m.full_name}
                </li>
              ))}
              {pickedMatches.length > 12 ? (
                <li className="pt-1 text-[11px] text-muted-foreground">
                  และอีก {pickedMatches.length - 12} คน
                </li>
              ) : null}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending || pickedMatches.length === 0}
              onClick={() => void sendPickedToAi()}
            >
              {sending ? 'กำลังส่ง…' : `ส่ง ${pickedMatches.length} คนเข้าคิวโทร`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ยืนยันก่อนสั่งคิดใหม่ — ใช้ AlertDialog ของ shadcn (ไม่สร้าง Dialog เอง ตามกติกาโปรเจกต์)
          คำอธิบายตรงกับของหน้าจับคู่งาน: ผลเดิมยังอยู่ระหว่างรอ แล้วผลใหม่มาแทนเอง */}
      <AlertDialog open={rematchConfirm} onOpenChange={setRematchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ให้ AI คิดคนใหม่สำหรับใบขอนี้?</AlertDialogTitle>
            <AlertDialogDescription>
              ระบบจะส่งใบนี้ให้ AI ที่หลังบ้านประเมินใหม่ทั้งหมด — ระหว่างรอยังเห็นรายชื่อเดิม
              และ <b>ผลใหม่จะมาแทนที่ผลเดิม</b> เมื่อคิดเสร็จ (ปกติไม่กี่นาที)
              ถ้ากำลังไล่โทรจากรายชื่อชุดนี้อยู่ ให้โทรให้จบก่อน
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => void loadBoardMatch(true)}>
              คิดใหม่
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UnitRequestTabPage;
