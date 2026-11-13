import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { resolveUnitDetailBackPath } from '@/lib/jobUnitSessionState';
import { backLabelFor } from '@/lib/stageOrigin';
import UnitRequestTabs, { type UnitRequestTabId } from '@/components/jobs/UnitRequestTabs';
import OrderPostButton from '@/components/jobs/OrderPostButton';
import { JobPostActionsPanel } from '@/components/jobs/JobPostActionsDialog';
import type { BoardActionTab } from '@/components/jobs/BoardCardActions';
import { applicationsJobKey, fetchSiamrajUnitRequest } from '@/lib/siamrajUnitRequestsApi';
import { fetchJobApplications, type PublicApplication } from '@/lib/publicApplicationsApi';
import {
  groupApplicationsByOrigin,
  summarizeUnitMatches,
  UNIT_MATCH_CALLER_LABEL,
  unitMatchFactLine,
  unitMatchLastCaller,
  unitMatchOriginLabel,
  unitMatchStatus,
  unitMatchStatusCounts,
} from '@/lib/unitMatchingView';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { EM_DASH } from '@/lib/displayFallback';
import type { JobRequest } from '@/types';
import { LoaderCircle, Users } from 'lucide-react';

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
  actions: 'Autopost / Scrap / โพสต์เอง',
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
  /** แท็บ Autopost / Scrap / โพสต์เอง — กล่องที่เลือก + โหลดใหม่หลังสั่งงาน */
  const [actionsTab, setActionsTab] = useState<BoardActionTab>('autopost');
  const [actionsRev, setActionsRev] = useState(0);

  const reload = useCallback(async () => {
    setError(null);
    try {
      // 🔴 QA 17 ต.ค. 2569: เดิมค้นใบสมัครด้วย `id` จาก URL (เลขใบขอเปล่า `OPL6909071`) แต่ใบสมัครเก็บด้วย
      // คีย์เต็ม `siamraj-sql:OPL6909071` ⇒ แท็บผู้สมัคร/การติดต่อขึ้น 0 ทุกใบ (ของจริง 44 คน) · ใช้ `job.id` แบบ loadBoardMatch
      const j = await fetchSiamrajUnitRequest(id).catch(() => null);
      const apps = await fetchJobApplications(applicationsJobKey(id, j?.id));
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
  /** ชิปที่กดอยู่ (ข้อความสถานะเดียวกับป้ายท้ายการ์ด) · null = ทุกคน */
  const [statusPick, setStatusPick] = useState<string | null>(null);
  const statusCounts = useMemo(() => unitMatchStatusCounts(items ?? []), [items]);
  const groups = useMemo(
    () => groupApplicationsByOrigin((items ?? []).filter((a) => !statusPick || unitMatchStatus(a).text === statusPick)),
    [items, statusPick],
  );

  return (
    <div className="relative">
      <PageHeader
        title={TAB_TITLE[tab]}
        subtitle={job ? jobBoardCardTitle(job) : id}
        backPath={backPath}
        backLabel={backLabelFor(backPath)}
      />

      {/* ไม่มีขอบบน — แถบแท็บต้องอยู่ระดับเดียวกับหน้ารายละเอียดใบขอ (เจ้าของ 19 ต.ค. 2569 "กดสลับแล้วหน้ากระโดด") */}
      <div className="space-y-4 px-4 pb-4 md:px-6">
        <UnitRequestTabs
          jobId={id}
          active={tab}
          counts={{ applicants: items?.length }}
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {/* ── ผู้สมัคร ───────────────────────────────────── */}
        {tab === 'applicants' ? (
          <>
            {/* ชิปนับตามป้ายท้ายการ์ด กดแล้วเหลือเฉพาะคนกลุ่มนั้น กดซ้ำ = ทุกคน (เจ้าของ 11 พ.ย. 2569) · ชิปรวมกัน = ผู้สมัครทั้งหมด */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-secondary/40 px-3.5 py-2.5 text-sm">
              <Button
                type="button"
                size="xs"
                variant={statusPick === null ? 'default' : 'outline'}
                className="rounded-full"
                aria-pressed={statusPick === null}
                onClick={() => setStatusPick(null)}
              >
                <Users aria-hidden />
                ผู้สมัคร <span className="tabular-nums">{summary.total}</span> คน
              </Button>
              {statusCounts.map((s) => (
                <Button
                  key={s.text}
                  type="button"
                  size="xs"
                  variant={statusPick === s.text ? 'default' : 'outline'}
                  className="rounded-full"
                  aria-pressed={statusPick === s.text}
                  onClick={() => setStatusPick((cur) => (cur === s.text ? null : s.text))}
                >
                  {s.text} <span className="tabular-nums">{s.count}</span>
                </Button>
              ))}
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
                  <h2 className="text-sm font-medium text-foreground">{g.label}</h2>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {g.items.length} คน
                  </span>
                  {g.hint ? <span className="text-xs text-muted-foreground">· {g.hint}</span> : null}
                </div>
                <ul className="space-y-1.5">
                  {g.items.map((a) => {
                    const st = unitMatchStatus(a);
                    const originLabel = unitMatchOriginLabel(a);
                    const caller = unitMatchLastCaller(a);
                    return (
                      <li
                        key={a.id}
                        className="grid gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm sm:grid-cols-[1.4fr_1.2fr_auto] sm:items-center"
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          <b className="font-medium text-foreground">{a.full_name}</b>
                          {originLabel ? (
                            <span className="jarvis-chip jarvis-chip-violet">{originLabel}</span>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {unitMatchFactLine(a) || EM_DASH}
                        </span>
                        {/* ทุกการ์ดหน้าตาเดียวกัน: สถานะ + ใครโทรล่าสุดอยู่ท้ายแถว (เจ้าของ 11 พ.ย. 2569
                            "ไม่เอาหน้าตาแบบนี้ เอาหน้าตาแบบ ณัฎฐกานต์ แต่บอกสถานะด้านหลัง") — แผงขั้นตอน/เตรียมเข้างานถอดจากการ์ดนี้ */}
                        <span className="flex flex-col items-start gap-0.5 sm:items-end">
                          <span className={STATUS_CLASS[st.tone]}>{st.text}</span>
                          {caller ? <span className="whitespace-nowrap text-xs text-muted-foreground">{UNIT_MATCH_CALLER_LABEL[caller]}</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        ) : null}

        {/* ── Autopost / Scrap / โพสต์เอง (เจ้าของ 13 พ.ย. 2569 "ย้ายไปเป็นอีกแท็บ … เอาทำอะไรไปแล้วโชว์ด้วย") ──
            บน = ทำอะไรไปแล้ว (ตัวเดียวกับป๊อปบนการ์ด) · ล่าง = ฟอร์มสั่งตัวเดียวกับป๊อปประกาศ (`OrderPostButton`) กางไว้เลย */}
        {tab === 'actions' ? (
          job ? (
            <>
              {/* ทำอะไรไปแล้ว อยู่บนฟอร์มสั่ง (เจ้าของ 13 พ.ย. 2569 "ทำอะไรไปแล้ว ไว้สูงกว่า") */}
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4" data-testid="unit-actions-done">
                <h2 className="text-base font-medium text-foreground">ทำอะไรไปแล้ว</h2>
                <JobPostActionsPanel jobId={job.id} tab={actionsTab} onTabChange={setActionsTab} reloadKey={actionsRev} />
              </section>
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4" data-testid="unit-actions-order">
                <OrderPostButton job={job} onLinksChanged={() => setActionsRev((n) => n + 1)} />
              </section>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
          )
        ) : null}

        {/* แท็บ "การติดต่อ" ถอดแล้ว (เจ้าของ 11 พ.ย. 2569 "เอาออกจากหน้านี้") — การติดต่ออยู่แท็บของหน้างานสรรหา */}
      </div>

    </div>
  );
};

export default UnitRequestTabPage;
