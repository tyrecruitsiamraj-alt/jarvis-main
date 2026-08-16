import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import UnitRequestTabs, { type UnitRequestTabId } from '@/components/jobs/UnitRequestTabs';
import { MyCallsSection } from '@/pages/matching/MyCallsPage';
import { fetchSiamrajUnitRequest } from '@/lib/siamrajUnitRequestsApi';
import { fetchJobApplications, type PublicApplication } from '@/lib/publicApplicationsApi';
import { fetchRecruitLaneCandidates, tierChipClass, type RecruitLaneMatch } from '@/lib/recruitLaneApi';
import {
  groupApplicationsByOrigin,
  summarizeUnitMatches,
  unitMatchFactLine,
  unitMatchOriginLabel,
  unitMatchStatus,
} from '@/lib/unitMatchingView';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { EM_DASH } from '@/lib/displayFallback';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';
import { LoaderCircle, RefreshCw, Search, Users } from 'lucide-react';

const STATUS_CLASS: Record<string, string> = {
  success: 'jarvis-chip jarvis-chip-success',
  warn: 'jarvis-chip jarvis-chip-warn',
  danger: 'jarvis-chip jarvis-chip-danger',
  neutral: 'jarvis-chip jarvis-chip-neutral',
};

const TAB_TITLE: Record<Exclude<UnitRequestTabId, 'detail'>, string> = {
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
const UnitRequestTabPage: React.FC<{ tab: Exclude<UnitRequestTabId, 'detail'> }> = ({ tab }) => {
  const { id = '' } = useParams();
  const [job, setJob] = useState<JobRequest | null>(null);
  const [items, setItems] = useState<PublicApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [aiMatches, setAiMatches] = useState<RecruitLaneMatch[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

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

  const summary = useMemo(() => summarizeUnitMatches(items ?? []), [items]);
  const groups = useMemo(() => groupApplicationsByOrigin(items ?? []), [items]);

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
        backPath="/jobs/list"
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
              <span className="font-semibold">คนที่ AI แนะนำสำหรับใบขอนี้</span>
              <span className="text-xs text-muted-foreground">
                · ยังไม่ใช่ใบสมัคร — ต้องโทรถามก่อน
              </span>
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => void runAiMatch()}
                className={cn(
                  'ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50',
                  TONE.info.outline,
                )}
              >
                {aiBusy ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                {aiMatches ? 'ค้นใหม่' : 'ให้ AI ค้นหา'}
              </button>
            </div>

            {aiNotice ? (
              <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{aiNotice}</p>
            ) : null}

            {!aiMatches && !aiBusy && !aiNotice ? (
              <div className="rounded-xl border border-border/70 bg-card px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">ยังไม่ได้ค้น</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  กด “ให้ AI ค้นหา” เพื่อดูรายชื่อที่เข้าข่าย · หน้านี้ดูอย่างเดียว
                  การส่งเข้าคิวโทรอยู่ที่ปุ่มบนการ์ดในกล่องงาน
                </p>
              </div>
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
            <p className="rounded-xl border border-border/70 bg-card px-3 py-2 text-[11px] text-muted-foreground">
              งานโทรที่คุณเก็บไว้เอง — เก็บแล้ว AI จะไม่โทรทับเบอร์นั้น ·
              รายการนี้เป็นของคุณคนเดียว ไม่ใช่ของทั้งใบขอ
            </p>
            <MyCallsSection />
          </>
        ) : null}
      </div>
    </div>
  );
};

export default UnitRequestTabPage;
