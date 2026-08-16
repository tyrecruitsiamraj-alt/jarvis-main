import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import UnitRequestTabs from '@/components/jobs/UnitRequestTabs';
import { fetchSiamrajUnitRequest } from '@/lib/siamrajUnitRequestsApi';
import { fetchJobApplications, type PublicApplication } from '@/lib/publicApplicationsApi';
import { fetchSelectionRecall, recruitLaneSendSummary } from '@/lib/recruitLaneApi';
import {
  groupApplicationsByOrigin,
  summarizeUnitMatches,
  unitMatchFactLine,
  unitMatchOriginLabel,
  unitMatchStatus,
} from '@/lib/unitMatchingView';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { EM_DASH } from '@/lib/displayFallback';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';
import { LoaderCircle, RefreshCw, Search, Send, Users } from 'lucide-react';

const RecruitLaneDialog = React.lazy(() => import('@/components/jobs/RecruitLaneDialog'));

const STATUS_CLASS: Record<string, string> = {
  success: 'jarvis-chip jarvis-chip-success',
  warn: 'jarvis-chip jarvis-chip-warn',
  danger: 'jarvis-chip jarvis-chip-danger',
  neutral: 'jarvis-chip jarvis-chip-neutral',
};

/**
 * หน้า "คนที่จับคู่ได้" ของใบขอ (เจ้าของเคาะ 16 ส.ค. 2569 จากภาพเสนอ)
 *
 * รวมคนของใบขอนี้ไว้ที่เดียว แยกกลุ่มตามที่มา (สมัครเอง / AI หาให้ / เจ้าหน้าที่คีย์)
 * พร้อมปุ่มเติมกองสองทาง — หาคนที่ยังไม่สมัคร (เลนสรรหา) กับ ชวนคนที่เคยปฏิเสธกลับมา
 *
 * ⚠️ ตรรกะแบ่งกลุ่ม/นับ/สถานะ อยู่ที่ `unitMatchingView.ts` ทั้งหมด — ไฟล์นี้แค่ render
 */
const UnitRequestMatchingPage: React.FC = () => {
  const { id = '' } = useParams();
  const [job, setJob] = useState<JobRequest | null>(null);
  const [items, setItems] = useState<PublicApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [laneOpen, setLaneOpen] = useState(false);
  const [recallBusy, setRecallBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
   * ชวนคนที่เคยตอบไม่สนใจงานอื่นกลับมา แล้วส่ง AI โทรทันที
   * ⚠️ ส่งจริงตั้งแต่กด — เป็นนิยามของเส้นนี้ (เจ้าของเคาะ) จึงต้องสรุปผลให้เห็นทุกครั้ง
   */
  const runRecall = async () => {
    setRecallBusy(true);
    setNotice(null);
    try {
      const r = await fetchSelectionRecall(id, { send: true });
      setNotice(
        r.dispatch
          ? `🤖 ${recruitLaneSendSummary(r.dispatch)}`
          : `ค้นจากกอง ${r.pool_size} คน — ยังไม่มีใครเข้าข่าย`,
      );
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'ชวนกลับไม่สำเร็จ');
    } finally {
      setRecallBusy(false);
    }
  };

  return (
    <div className="relative">
      <PageHeader
        title="คนที่จับคู่ได้"
        subtitle={job ? jobBoardCardTitle(job) : id}
        backPath="/jobs/board"
      />

      <div className="space-y-4 px-4 py-4 md:px-6">
        <UnitRequestTabs jobId={id} active="matching" matchCount={items?.length} />

        {/* แถบสรุป + ปุ่มเติมกอง */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/70 bg-secondary/40 px-3.5 py-2.5 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Users className={cn('h-4 w-4', TONE.info.value)} />
            ในมือ {summary.total} คน
          </span>
          {job ? (
            <span className="text-muted-foreground">
              · ต้องการ {jobPositionUnits(job)} ตำแหน่ง
            </span>
          ) : null}
          <span className="text-muted-foreground">· สนใจแล้ว {summary.interested}</span>
          <span className="text-muted-foreground">· ยังไม่ได้โทร {summary.waiting}</span>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void reload()}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold',
                TONE.neutral.outline,
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" /> รีเฟรช
            </button>
            <button
              type="button"
              onClick={() => setLaneOpen(true)}
              title="ค้นคนที่ยังไม่สมัครจาก Checklist + ฐานใหม่ + iRecruit แล้วส่ง AI โทรทันที"
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold',
                TONE.info.outline,
              )}
            >
              <Search className="h-3.5 w-3.5" /> หาคนที่ยังไม่สมัคร
            </button>
            <button
              type="button"
              disabled={recallBusy}
              onClick={() => void runRecall()}
              title="ชวนคนที่เคยตอบไม่สนใจงานอื่นกลับมา แล้วส่ง AI โทรทันที"
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50',
                TONE.success.outline,
              )}
            >
              {recallBusy ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              ชวนคนที่เคยปฏิเสธ
            </button>
          </div>
        </div>

        {notice ? (
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary">{notice}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!items && !error ? (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" /> กำลังโหลดรายชื่อ…
          </p>
        ) : null}

        {items && items.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-card px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">ยังไม่มีใครในใบขอนี้</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              กด “หาคนที่ยังไม่สมัคร” เพื่อให้ AI ไปหามาจากฐาน หรือ “ชวนคนที่เคยปฏิเสธ”
              เพื่อกลับไปถามคนที่เคยตอบไม่สนใจงานอื่น
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
      </div>

      {laneOpen && job ? (
        <React.Suspense fallback={null}>
          <RecruitLaneDialog
            open
            job={job}
            onClose={() => {
              setLaneOpen(false);
              void reload();
            }}
          />
        </React.Suspense>
      ) : null}
    </div>
  );
};

export default UnitRequestMatchingPage;
