import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { Phone, MapPin, Search, Users, RefreshCw, Building2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { JobRequest } from '@/types';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { unitRequestCardSubtitle, unitRequestCardTitle, unitRequestSearchBlob } from '@/lib/unitRequestDisplay';
import { unitRequestPath } from '@/lib/jobNavigation';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { apiFetch } from '@/lib/apiFetch';
import {
  saveProposal,
  listProposalsForJob,
  proposalKey,
  proposalStatusLabel,
  type ProposalStatus,
} from '@/lib/candidateProposalsApi';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { classifyJobFamily, candidateMatchesFamily, fallbackKeywords } from '@/lib/jobFamilyLexicon';
import {
  type IrecruitCandidateMatch,
  type IrecruitMatchResult,
  matchTierEmoji,
  matchTierLabel,
} from '@/lib/irecruitMatchTypes';

/** "คนของเรา" — ผ่านสัมภาษณ์แล้ว รอลงงาน (จาก board) แมทกับใบขอด้วย AI */
type BoardCandidateMatch = {
  card_id: number;
  full_name: string;
  nick_name: string | null;
  mobile: string | null;
  sex_code: string | null;
  age: number | null;
  required_salary: number | null;
  job1_name: string | null;
  job2_name: string | null;
  province_name: string | null;
  amphur_name: string | null;
  tier: 'green' | 'yellow' | 'red';
  reason: string;
};
type BoardMatchResult = {
  jobId: string;
  job_family_code: string;
  job_family_label: string;
  pool_size: number;
  matches: BoardCandidateMatch[];
};

function boardTierMeta(tier: BoardCandidateMatch['tier']): { icon: string; label: string; cls: string } {
  if (tier === 'green') return { icon: '🟢', label: 'ลงได้ทันที', cls: 'border-emerald-200 bg-emerald-50/60' };
  if (tier === 'red') return { icon: '🔴', label: 'ห่างไกล', cls: 'border-red-200 bg-red-50/50' };
  return { icon: '🟡', label: 'พอได้ ต้องเช็ค', cls: 'border-amber-200 bg-amber-50/60' };
}

/** ข้อความตำแหน่งจากใบขอ (รวม job description + staff title) สำหรับ classify family */
function jobTitleText(j: JobRequest): string {
  const pick = (k: keyof JobRequest) => {
    const v = j[k];
    const s = v == null ? '' : String(v).trim();
    return s && s !== 'ไม่ระบุ' ? s : '';
  };
  return [pick('job_description_code_1'), pick('job_description_code_2'), pick('staff_title_name')]
    .filter(Boolean)
    .join(' ');
}

const MatchingPage: React.FC = () => {
  const { jobs, loading: loadingJobs } = useUnitRequestsFeed();
  const [search, setSearch] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [unitFilter, setUnitFilter] = useState('');
  const [jobDetail, setJobDetail] = useState<JobRequest | null>(null);

  const [boardMatchById, setBoardMatchById] = useState<Record<string, BoardMatchResult>>({});
  const [boardLoadingId, setBoardLoadingId] = useState<string | null>(null);
  const [boardErrorById, setBoardErrorById] = useState<Record<string, string>>({});
  // #2 (ยุบ) — หาผู้สมัคร iRecruit + เสนอในหน้า match เลย (ไม่ต้องไป pre-check)
  const [irMatchById, setIrMatchById] = useState<Record<string, IrecruitMatchResult>>({});
  const [irLoadingId, setIrLoadingId] = useState<string | null>(null);
  const [irErrorById, setIrErrorById] = useState<Record<string, string>>({});
  // pool เบา ๆ สำหรับนับ "คนของเราน่าจะตรง" บนการ์ดตั้งแต่หน้าแรก (ไม่เรียก AI)
  const [pool, setPool] = useState<Array<{ card_id: number; job1_name: string | null; job2_name: string | null }>>([]);
  // ดูรายละเอียดพนักงานของเรา
  const [candDetail, setCandDetail] = useState<BoardCandidateMatch | null>(null);
  // การเสนอ/จองตัว/ลงงาน — สถานะล่าสุดต่อผู้สมัคร (คีย์ = source#ref) ต่อใบขอที่เปิดอยู่
  const [proposedByKey, setProposedByKey] = useState<Record<string, ProposalStatus>>({});
  const [proposingKey, setProposingKey] = useState<string | null>(null);
  const [proposeError, setProposeError] = useState<string | null>(null);
  // #3 กันเสนอซ้ำ — ซ่อนคนที่เสนอ/จอง/ลงแล้ว
  const [hideProposed, setHideProposed] = useState(false);
  // #5 pre-warm AI งานด่วนเบื้องหลัง
  const [prewarming, setPrewarming] = useState(false);
  const prewarmStartedRef = useRef(false);

  useEffect(() => {
    apiFetch('/api/matching/board-candidates?pool=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.pool) setPool(d.pool);
      })
      .catch(() => {});
  }, []);

  // #5 pre-warm AI แมทงานด่วนล่วงหน้าเบื้องหลัง (~30วิ/ใบ) — เปิดใบด่วนแล้วผลพร้อมทันที
  // ทำแบบระวัง: เฉพาะงานด่วนที่ใกล้ครบกำหนดสุด, ทีละใบ, จำกัดจำนวน, ข้ามใบที่มีผล/เคยอุ่นแล้ว
  const PREWARM_LIMIT = 3;
  useEffect(() => {
    // รันครั้งเดียวเมื่อ jobs โหลดเสร็จ (กัน re-run จาก jobs อ้างอิงใหม่ทุก render)
    if (prewarmStartedRef.current || jobs.length === 0) return;
    prewarmStartedRef.current = true;
    let cancelled = false;
    const targets = jobs
      .filter((j) => j.urgency === 'urgent')
      .slice()
      .sort((a, b) => (a.required_date || '').localeCompare(b.required_date || ''))
      .slice(0, PREWARM_LIMIT);
    if (targets.length === 0) return;

    const run = async () => {
      setPrewarming(true);
      for (const j of targets) {
        if (cancelled) break;
        try {
          const r = await apiFetch(`/api/matching/board-candidates?jobId=${encodeURIComponent(j.id)}`);
          if (!r.ok) continue;
          const data = (await r.json()) as BoardMatchResult;
          if (!cancelled) setBoardMatchById((prev) => (prev[j.id] ? prev : { ...prev, [j.id]: data }));
        } catch {
          /* เงียบ — เป็นการอุ่นเครื่องเบื้องหลัง */
        }
      }
      if (!cancelled) setPrewarming(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length]);

  const fetchBoardMatch = async (jobId: string, refresh = false) => {
    setBoardLoadingId(jobId);
    setBoardErrorById((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    try {
      const params = new URLSearchParams({ jobId });
      if (refresh) params.set('refresh', '1');
      const r = await apiFetch(`/api/matching/board-candidates?${params.toString()}`);
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { message?: string; detail?: string; error?: string };
        throw new Error(data.message || data.detail || data.error || `ค้นหาไม่สำเร็จ (HTTP ${r.status})`);
      }
      const data = (await r.json()) as BoardMatchResult;
      setBoardMatchById((prev) => ({ ...prev, [jobId]: data }));
    } catch (e) {
      setBoardErrorById((prev) => ({ ...prev, [jobId]: e instanceof Error ? e.message : 'ค้นหาไม่สำเร็จ' }));
    } finally {
      setBoardLoadingId((current) => (current === jobId ? null : current));
    }
  };

  // เปิดใบขอ → หาคนของเราอัตโนมัติ + โหลดสถานะการเสนอที่เคยบันทึก
  const openJob = (j: JobRequest) => {
    setJobDetail(j);
    setProposeError(null);
    if (!boardMatchById[j.id] && boardLoadingId !== j.id) void fetchBoardMatch(j.id);
    void listProposalsForJob(j.id).then((items) => {
      setProposedByKey((prev) => {
        const next = { ...prev };
        for (const p of items) next[proposalKey(p.source, p.candidate_ref)] = p.status;
        return next;
      });
    });
  };

  // บันทึกการเสนอ/จองตัว/ลงงาน "คนของเรา" (board) ลง DB
  const proposeBoard = async (job: JobRequest, m: BoardCandidateMatch, status: ProposalStatus) => {
    const key = proposalKey('board', m.card_id);
    setProposingKey(key);
    setProposeError(null);
    try {
      const saved = await saveProposal({
        jobId: job.id,
        requestNo: job.request_no,
        source: 'board',
        candidateRef: m.card_id,
        candidateName: m.full_name,
        candidatePhone: m.mobile,
        candidatePosition: [m.job1_name, m.job2_name].filter(Boolean).join(' / ') || null,
        tier: m.tier,
        reason: m.reason,
        status,
      });
      setProposedByKey((prev) => ({ ...prev, [key]: saved.status }));
    } catch (e) {
      setProposeError(e instanceof Error ? e.message : 'บันทึกการเสนอไม่สำเร็จ');
    } finally {
      setProposingKey((cur) => (cur === key ? null : cur));
    }
  };

  // ค้นหาผู้สมัครจากฐาน iRecruit สำหรับใบขอนี้ (inline ในหน้า match)
  const fetchIrecruit = async (jobId: string, refresh = false) => {
    setIrLoadingId(jobId);
    setIrErrorById((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    try {
      const params = new URLSearchParams({ jobId });
      if (refresh) params.set('refresh', '1');
      const r = await apiFetch(`/api/matching/irecruit-candidates?${params.toString()}`);
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { message?: string; detail?: string; error?: string };
        throw new Error(data.message || data.detail || data.error || `ค้นหาไม่สำเร็จ (HTTP ${r.status})`);
      }
      const data = (await r.json()) as IrecruitMatchResult;
      setIrMatchById((prev) => ({ ...prev, [jobId]: data }));
    } catch (e) {
      setIrErrorById((prev) => ({ ...prev, [jobId]: e instanceof Error ? e.message : 'ค้นหาไม่สำเร็จ' }));
    } finally {
      setIrLoadingId((current) => (current === jobId ? null : current));
    }
  };

  // บันทึกการเสนอ/จองตัว/ลงงานผู้สมัคร iRecruit ลง DB (พร้อมเหตุผล)
  const proposeIrecruit = async (job: JobRequest, m: IrecruitCandidateMatch, status: ProposalStatus) => {
    const key = proposalKey('irecruit', m.id);
    setProposingKey(key);
    setProposeError(null);
    try {
      const reason =
        [m.reason?.trim(), job.request_no ? `จากใบขอ ${job.request_no}` : '']
          .filter(Boolean)
          .join('\n') || null;
      const saved = await saveProposal({
        jobId: job.id,
        requestNo: job.request_no,
        source: 'irecruit',
        candidateRef: m.id,
        candidateName: m.full_name,
        candidatePhone: m.phone_number,
        candidatePosition: m.position_name || m.job_name_th || null,
        tier: m.tier,
        reason,
        status,
      });
      setProposedByKey((prev) => ({ ...prev, [key]: saved.status }));
    } catch (e) {
      setProposeError(e instanceof Error ? e.message : 'บันทึกการเสนอไม่สำเร็จ');
    } finally {
      setProposingKey((cur) => (cur === key ? null : cur));
    }
  };

  const unitOptions = useMemo(
    () => [
      { value: '', label: '— ทุกหน่วยงาน —' },
      ...Array.from(new Set(jobs.map((j) => j.unit_name).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ value: name, label: name })),
    ],
    [jobs],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs
      .filter((j) => (urgentOnly ? j.urgency === 'urgent' : true))
      .filter((j) => (unitFilter ? j.unit_name === unitFilter : true))
      .filter((j) => (q ? unitRequestSearchBlob(j).includes(q) : true))
      .sort((a, b) => {
        // ด่วนขึ้นก่อน แล้ววันที่ต้องการเร็วสุดก่อน
        const ua = a.urgency === 'urgent' ? 0 : 1;
        const ub = b.urgency === 'urgent' ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return (a.required_date || '').localeCompare(b.required_date || '');
      });
  }, [jobs, search, urgentOnly, unitFilter]);

  // นับ "คนของเราน่าจะตรง" ต่อใบขอแบบเบา (ไม่เรียก AI) โชว์ตั้งแต่หน้าแรก
  // #6 แม่นขึ้น: classify ใบขอเข้า job family ก่อน แล้วนับผู้สมัครที่สกิลอยู่ family เดียวกัน
  //   (แทน keyword ดิบที่ over-count จากคำกว้าง ๆ) — fallback เป็น keyword overlap ถ้า classify ไม่ได้
  const quickCounts = useMemo(() => {
    const out: Record<string, number> = {};
    if (pool.length === 0) return out;
    const poolText = pool.map((c) => `${c.job1_name || ''} ${c.job2_name || ''}`.toLowerCase());
    for (const j of rows) {
      const title = jobTitleText(j);
      const family = classifyJobFamily(title);
      if (family) {
        out[j.id] = poolText.filter((t) => candidateMatchesFamily(t, family)).length;
        continue;
      }
      const kws = fallbackKeywords(title);
      out[j.id] = kws.length === 0 ? 0 : poolText.filter((t) => kws.some((k) => t.includes(k))).length;
    }
    return out;
  }, [rows, pool]);

  // #4 dashboard เล็ก — ใบขอด่วน: พร้อมลง (มีคนของเรา) vs ยังไม่มีคน
  // ใช้ผล AI ที่ยืนยันแล้ว (boardMatchById) ถ้ามี ไม่งั้น fallback เป็น quick count (สกิล, ยังไม่ AI)
  const urgentSummary = useMemo(() => {
    const urgent = rows.filter((j) => j.urgency === 'urgent');
    let ready = 0;
    let confirmedCount = 0;
    for (const j of urgent) {
      const confirmed = boardMatchById[j.id]?.matches.length;
      if (confirmed != null) confirmedCount++;
      const hasPeople = confirmed != null ? confirmed > 0 : (quickCounts[j.id] ?? 0) > 0;
      if (hasPeople) ready++;
    }
    return { total: urgent.length, ready, none: urgent.length - ready, confirmedCount };
  }, [rows, quickCounts, boardMatchById]);

  const closeJob = () => setJobDetail(null);

  return (
    <div>
      <PageHeader title="Matching — คนของเรา" subtitle="เปิดใบขอ แล้วหาคนที่ผ่านสัมภาษณ์รอลงงานที่สกิลตรง" backPath="/matching" />
      <div className="px-4 md:px-6 space-y-4">
        {/* ตัวกรอง */}
        <div className="glass-card rounded-[1.5rem] p-4 md:p-5 border border-white/70 space-y-3">
          <div className="flex items-center gap-2">
            <div className="glass-card rounded-xl px-3 py-2 border border-white/70 flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-blue-600 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหา site / หน่วยงาน / ตำแหน่ง / สถานที่"
                className="bg-transparent text-sm outline-none flex-1"
              />
            </div>
            <button
              type="button"
              onClick={() => setUrgentOnly((v) => !v)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition-colors',
                urgentOnly
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-white/70 bg-white/50 text-muted-foreground hover:border-destructive/30',
              )}
            >
              🔴 ด่วนเท่านั้น
            </button>
          </div>
          <SearchableSelect
            value={unitFilter}
            onChange={setUnitFilter}
            options={unitOptions}
            placeholder="ทุกหน่วยงาน"
            searchPlaceholder="ค้นหาหน่วยงาน..."
            emptyText="ไม่พบหน่วยงาน"
          />
        </div>

        {/* #4 สรุปงานด่วน: พร้อมลง vs ยังไม่มีคนของเรา */}
        {urgentSummary.total > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card rounded-2xl border border-red-200/70 bg-red-50/50 px-3 py-2.5 text-center">
              <div className="text-lg font-bold tabular-nums text-red-600">{urgentSummary.total}</div>
              <div className="text-[11px] text-muted-foreground">ใบขอด่วน</div>
            </div>
            <div className="glass-card rounded-2xl border border-emerald-200/70 bg-emerald-50/50 px-3 py-2.5 text-center">
              <div className="text-lg font-bold tabular-nums text-emerald-600">{urgentSummary.ready}</div>
              <div className="text-[11px] text-muted-foreground">น่าจะมีคนของเรา</div>
            </div>
            <div className="glass-card rounded-2xl border border-amber-200/70 bg-amber-50/50 px-3 py-2.5 text-center">
              <div className="text-lg font-bold tabular-nums text-amber-600">{urgentSummary.none}</div>
              <div className="text-[11px] text-muted-foreground">ยังไม่มีคน</div>
            </div>
          </div>
        ) : null}
        {urgentSummary.total > 0 ? (
          <p className="px-1 text-[11px] text-muted-foreground">
            {urgentSummary.confirmedCount > 0
              ? `ยืนยันด้วย AI แล้ว ${urgentSummary.confirmedCount} ใบ · ที่เหลือประมาณจากสกิล (กดใบขอเพื่อให้ AI คัดจริง)`
              : 'ประมาณการจากสกิล (ยังไม่ผ่าน AI) — กดใบขอเพื่อให้ AI คัดจริง'}
          </p>
        ) : null}

        <div className="flex items-center gap-2 px-1">
          <p className="text-sm text-muted-foreground">
            ใบขอ <span className="text-blue-600 font-bold tabular-nums">{rows.length}</span> รายการ
            {loadingJobs ? ' · กำลังโหลด…' : ''}
          </p>
          <p className="text-xs text-muted-foreground">· เรียงงานด่วนขึ้นก่อน · กดเพื่อหาคนของเราที่ตรง</p>
          {prewarming ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" /> อุ่นเครื่อง AI งานด่วนล่วงหน้า…
            </span>
          ) : null}
        </div>

        {/* การ์ดรวมใบขอ */}
        <div className="space-y-2.5">
          {rows.length === 0 && !loadingJobs ? (
            <div className="glass-card rounded-2xl p-8 border border-white/70 text-center text-muted-foreground">
              <Search className="w-8 h-8 text-blue-400/60 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">ไม่พบใบขอตามเงื่อนไข</p>
            </div>
          ) : null}
          {rows.map((j) => {
            const matchCount = boardMatchById[j.id]?.matches.length;
            return (
              <div
                key={j.id}
                role="button"
                tabIndex={0}
                onClick={() => openJob(j)}
                onKeyDown={(e) => e.key === 'Enter' && openJob(j)}
                className="glass-card rounded-2xl px-3 py-2.5 border border-white/70 cursor-pointer hover:border-sky-300/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-blue-600 text-sm truncate">{unitRequestCardTitle(j)}</div>
                    {unitRequestCardSubtitle(j) ? (
                      <div className="text-[11px] text-muted-foreground truncate">{unitRequestCardSubtitle(j)}</div>
                    ) : null}
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{j.location_address}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full',
                        j.urgency === 'urgent' ? 'bg-destructive/15 text-destructive' : 'bg-info/15 text-info',
                      )}
                    >
                      {j.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
                    </span>
                    {matchCount != null ? (
                      <span
                        title="จำนวนที่ AI ยืนยันแล้ว"
                        className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                      >
                        คนของเรา {matchCount}
                      </span>
                    ) : quickCounts[j.id] ? (
                      <span
                        title="ประมาณการเบื้องต้นจากสกิล (ยังไม่ผ่าน AI) — กดเพื่อให้ AI คัดจริง"
                        className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
                      >
                        น่าจะตรง ~{quickCounts[j.id]}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground truncate">
                    {j.total_income.toLocaleString()} บาท · ต้องการ {formatYmdDmyBe(j.required_date)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openJob(j);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-200 bg-sky-50/70 px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100"
                  >
                    <Users className="h-3 w-3" />
                    {matchCount != null ? `ดูคนของเรา (${matchCount})` : boardLoadingId === j.id ? 'กำลังหา…' : 'หาคนของเรา'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawer: คนของเรา ต่อใบขอ */}
      <Sheet open={!!jobDetail} onOpenChange={(o) => !o && closeJob()}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground">คนของเรา — ผ่านสัมภาษณ์ รอลงงาน</SheetTitle>
            <SheetDescription className="sr-only">ผู้สมัครที่พร้อมลงงานซึ่งสกิลตรงกับใบขอ</SheetDescription>
          </SheetHeader>
          {jobDetail ? (
            <div className="space-y-3 mt-2">
              <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">{unitRequestCardTitle(jobDetail)}</div>
                      {jobDetail.request_no ? (
                        <div className="text-[11px] text-muted-foreground">{jobDetail.request_no}</div>
                      ) : null}
                    </div>
                  </div>
                  <Link
                    to={unitRequestPath(jobDetail)}
                    state={{ returnTo: '/matching/match' }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                  >
                    ดูใบขอ <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                {[jobDetail.staff_title_name, jobDetail.job_description_code_1, jobDetail.job_description_code_2]
                  .filter((v) => v && v !== 'ไม่ระบุ').length ? (
                  <p className="text-xs text-foreground">
                    ตำแหน่ง:{' '}
                    {[jobDetail.staff_title_name, jobDetail.job_description_code_1, jobDetail.job_description_code_2]
                      .filter((v) => v && v !== 'ไม่ระบุ')
                      .join(' · ')}
                  </p>
                ) : null}
                <div className="text-[11px] text-muted-foreground">📍 {jobDetail.location_address}</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                    เพศ: {jobDetail.gender_requirement || 'ไม่ระบุ'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                    อายุ:{' '}
                    {jobDetail.age_range_min != null || jobDetail.age_range_max != null
                      ? `${jobDetail.age_range_min ?? '—'}–${jobDetail.age_range_max ?? '—'}`
                      : 'ไม่ระบุ'}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                    {jobDetail.total_income.toLocaleString()} บาท
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                    ต้องการ: {formatYmdDmyBe(jobDetail.required_date)}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      jobDetail.urgency === 'urgent'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-sky-200 bg-sky-50 text-sky-700',
                    )}
                  >
                    {jobDetail.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {boardMatchById[jobDetail.id]
                    ? `AI แมทสกิล · จาก pool ${boardMatchById[jobDetail.id].pool_size} คน → เสนอ ${boardMatchById[jobDetail.id].matches.length}`
                    : 'ผู้สมัครที่พร้อมลงงานทันที'}
                </p>
                <div className="flex items-center gap-1.5">
                  {(() => {
                    const proposedCount = (boardMatchById[jobDetail.id]?.matches ?? []).filter(
                      (m) => proposedByKey[proposalKey('board', m.card_id)],
                    ).length;
                    return proposedCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setHideProposed((v) => !v)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                          hideProposed
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300',
                        )}
                      >
                        {hideProposed ? `แสดงทั้งหมด` : `ซ่อนที่เสนอแล้ว (${proposedCount})`}
                      </button>
                    ) : null;
                  })()}
                  <button
                    type="button"
                    onClick={() => void fetchBoardMatch(jobDetail.id, true)}
                    className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
                  >
                    <RefreshCw className="h-3 w-3" /> ค้นหาใหม่
                  </button>
                </div>
              </div>

              {boardLoadingId === jobDetail.id ? (
                <p className="text-xs text-sky-700">กำลังให้ AI แมทคนของเรากับใบขอ… (~30 วินาที)</p>
              ) : boardErrorById[jobDetail.id] ? (
                <p className="text-xs text-destructive">{boardErrorById[jobDetail.id]}</p>
              ) : boardMatchById[jobDetail.id] ? (
                boardMatchById[jobDetail.id].matches.length === 0 ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3 text-xs text-foreground">
                    ยังไม่มีคนของเราที่สกิลตรงกับใบขอนี้ — ลองหาจากฐาน iRecruit ด้านล่าง แล้วเสนอได้เลย
                  </p>
                ) : (
                  <div className="space-y-2">
                    {boardMatchById[jobDetail.id].matches
                      .filter((m) => !(hideProposed && proposedByKey[proposalKey('board', m.card_id)]))
                      .map((m) => {
                      const meta = boardTierMeta(m.tier);
                      const proposed = proposedByKey[proposalKey('board', m.card_id)];
                      return (
                        <button
                          type="button"
                          key={m.card_id}
                          onClick={() => setCandDetail(m)}
                          className={cn(
                            'w-full text-left rounded-xl border px-3 py-2 transition hover:brightness-[0.98]',
                            meta.cls,
                            proposed ? 'opacity-70' : '',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {meta.icon} {m.full_name}
                              {m.nick_name ? ` (${m.nick_name})` : ''}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                              {proposed ? (
                                <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> {proposalStatusLabel(proposed)}
                                </span>
                              ) : null}
                              <span className="rounded-full border border-white/80 bg-white/80 px-2 py-0.5 text-[10px] text-slate-600">
                                {meta.label}
                              </span>
                            </div>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                            <span>สกิล: {[m.job1_name, m.job2_name].filter(Boolean).join(' / ') || 'ไม่ระบุ'}</span>
                            {m.amphur_name || m.province_name ? (
                              <span>{[m.amphur_name, m.province_name].filter(Boolean).join(' ')}</span>
                            ) : null}
                            {m.age ? <span>อายุ {m.age}</span> : null}
                            {m.required_salary ? <span>ขอ {m.required_salary.toLocaleString()} บ.</span> : null}
                            {m.mobile ? (
                              <a
                                href={`tel:${m.mobile}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                              >
                                <Phone className="h-3 w-3" /> {m.mobile}
                              </a>
                            ) : null}
                          </div>
                          {m.reason ? <p className="mt-1 text-[11px] italic text-slate-600 line-clamp-2">— {m.reason}</p> : null}
                          <div className="mt-1 text-[10px] font-medium text-sky-600">แตะเพื่อดูรายละเอียด →</div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : null}

              {/* #2 (ยุบ) — ไม่พอ? หาผู้สมัครจากฐาน iRecruit แล้วเสนอในหน้านี้เลย */}
              {boardMatchById[jobDetail.id] && !boardErrorById[jobDetail.id] ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-blue-900">
                      {irMatchById[jobDetail.id]
                        ? `ผู้สมัครจากฐาน iRecruit → เสนอ ${irMatchById[jobDetail.id].matches.length}`
                        : 'ไม่พอ? หาผู้สมัครจากฐาน iRecruit'}
                    </p>
                    <button
                      type="button"
                      disabled={irLoadingId === jobDetail.id}
                      onClick={() => void fetchIrecruit(jobDetail.id, !!irMatchById[jobDetail.id])}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-300 bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {irLoadingId === jobDetail.id ? (
                        'กำลังค้นหา…'
                      ) : irMatchById[jobDetail.id] ? (
                        <>
                          <RefreshCw className="h-3 w-3" /> ค้นหาใหม่
                        </>
                      ) : (
                        <>
                          <Search className="h-3 w-3" /> ค้นหา iRecruit
                        </>
                      )}
                    </button>
                  </div>

                  {irLoadingId === jobDetail.id ? (
                    <p className="text-[11px] text-blue-700">กำลังค้นหาผู้สมัครจาก iRecruit… (อาจใช้ 1–3 นาที)</p>
                  ) : irErrorById[jobDetail.id] ? (
                    <p className="text-[11px] text-destructive">{irErrorById[jobDetail.id]}</p>
                  ) : irMatchById[jobDetail.id] ? (
                    irMatchById[jobDetail.id].matches.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">ไม่พบผู้สมัครที่ใกล้เคียงในฐาน iRecruit</p>
                    ) : (
                      <div className="space-y-2">
                        {irMatchById[jobDetail.id].matches
                          .filter((m) => !(hideProposed && proposedByKey[proposalKey('irecruit', m.id)]))
                          .map((m) => {
                            const key = proposalKey('irecruit', m.id);
                            const proposed = proposedByKey[key];
                            const busy = proposingKey === key;
                            return (
                              <div
                                key={m.id}
                                className={cn(
                                  'rounded-xl border border-white/70 bg-white/70 px-3 py-2 space-y-1',
                                  proposed ? 'opacity-70' : '',
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-blue-700">
                                    {matchTierEmoji(m.tier)} {m.full_name}
                                  </span>
                                  <div className="flex shrink-0 items-center gap-1">
                                    {proposed ? (
                                      <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                        <CheckCircle2 className="h-2.5 w-2.5" /> {proposalStatusLabel(proposed)}
                                      </span>
                                    ) : null}
                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                                      {matchTierLabel(m.tier)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                  <span>{m.position_name || m.job_name_th || 'ไม่ระบุตำแหน่ง'}</span>
                                  {m.location_label ? <span>{m.location_label}</span> : null}
                                  {m.age != null ? <span>อายุ {m.age}</span> : null}
                                  {m.phone_number ? (
                                    <a
                                      href={`tel:${m.phone_number}`}
                                      className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                                    >
                                      <Phone className="h-3 w-3" /> {m.phone_number}
                                    </a>
                                  ) : null}
                                </div>
                                {m.reason ? (
                                  <p className="text-[11px] italic text-slate-600 line-clamp-2">— {m.reason}</p>
                                ) : null}
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void proposeIrecruit(jobDetail, m, 'reserved')}
                                    className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                                  >
                                    <UserPlus className="h-3 w-3" />
                                    {busy ? 'บันทึก…' : proposed === 'reserved' ? 'จองตัวแล้ว ✓' : 'จองตัว'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void proposeIrecruit(jobDetail, m, 'placed')}
                                    className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    {busy ? 'บันทึก…' : proposed === 'placed' ? 'ลงงานแล้ว ✓' : 'ลงงานแล้ว'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      กดค้นหาเพื่อดึงผู้สมัครที่ตรงจากฐาน iRecruit แล้วกดจองตัว/ลงงานได้เลยในหน้านี้
                    </p>
                  )}
                  {proposeError ? <p className="text-[11px] text-destructive">{proposeError}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* รายละเอียดพนักงานของเรา + เหตุผลที่ AI เลือก */}
      <Dialog open={!!candDetail} onOpenChange={(o) => !o && setCandDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              {candDetail ? boardTierMeta(candDetail.tier).icon : ''} {candDetail?.full_name}
              {candDetail?.nick_name ? ` (${candDetail.nick_name})` : ''}
            </DialogTitle>
            <DialogDescription className="sr-only">รายละเอียดพนักงานของเราและเหตุผลที่ AI เลือก</DialogDescription>
          </DialogHeader>
          {candDetail ? (
            <div className="space-y-3">
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                {boardTierMeta(candDetail.tier).label}
              </span>

              <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2">
                <p className="text-xs font-semibold text-sky-900">ทำไม AI เลือกคนนี้</p>
                <p className="mt-1 text-xs text-sky-800 leading-relaxed">
                  {candDetail.reason || 'สกิลตรงกับใบขอ'}
                </p>
              </div>

              <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">สกิล/ตำแหน่ง</span>
                  <span className="text-right text-foreground">
                    {[candDetail.job1_name, candDetail.job2_name].filter(Boolean).join(' / ') || 'ไม่ระบุ'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">เพศ / อายุ</span>
                  <span className="text-right text-foreground">
                    {[candDetail.sex_code, candDetail.age ? `${candDetail.age} ปี` : ''].filter(Boolean).join(' · ') || '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">พื้นที่</span>
                  <span className="text-right text-foreground">
                    {[candDetail.amphur_name, candDetail.province_name].filter(Boolean).join(' ') || '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">เงินเดือนที่ขอ</span>
                  <span className="text-right text-foreground">
                    {candDetail.required_salary ? `${candDetail.required_salary.toLocaleString()} บาท` : '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">รหัสการ์ด</span>
                  <span className="text-right text-foreground">#{candDetail.card_id}</span>
                </div>
              </div>

              {candDetail.mobile ? (
                <a
                  href={`tel:${candDetail.mobile}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  <Phone className="h-4 w-4" /> โทร {candDetail.mobile}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">ไม่มีเบอร์โทรในระบบ</p>
              )}

              {/* จองตัว / ลงงาน — บันทึกการเสนอลง DB */}
              {jobDetail ? (
                (() => {
                  const key = proposalKey('board', candDetail.card_id);
                  const current = proposedByKey[key];
                  const busy = proposingKey === key;
                  return (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-violet-900">เสนอคนนี้ให้ใบขอ</p>
                        {current ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> {proposalStatusLabel(current)}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void proposeBoard(jobDetail, candDetail, 'reserved')}
                          className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                        >
                          {busy ? 'กำลังบันทึก…' : current === 'reserved' ? 'จองตัวแล้ว ✓' : 'จองตัว'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void proposeBoard(jobDetail, candDetail, 'placed')}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busy ? 'กำลังบันทึก…' : current === 'placed' ? 'ลงงานแล้ว ✓' : 'ลงงานแล้ว'}
                        </button>
                      </div>
                      {proposeError ? <p className="text-[11px] text-destructive">{proposeError}</p> : null}
                    </div>
                  );
                })()
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchingPage;
