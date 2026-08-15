import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { getTotalPages, type PageSizeOption } from '@/lib/pagination';
import RmFilterSidebar from '@/components/recruit-rm/RmFilterSidebar';
import RmSearchBar from '@/components/recruit-rm/RmSearchBar';
import RmTable from '@/components/recruit-rm/RmTable';
import { MyCallsSection } from '@/pages/matching/MyCallsPage';
import AddApplicantDialog from '@/components/recruit-rm/AddApplicantDialog';
import ApplicantContactDialog from '@/components/recruit-rm/ApplicantContactDialog';
import {
  EMPTY_RM_FILTERS,
  RM_ROW_ACTION_LABEL,
  RM_TABS,
  RM_TAB_LABEL,
  filterApplications,
  isInRmTab,
  isInRmListView,
  isRmListView,
  RM_LIST_VIEWS,
  RM_LIST_VIEW_LABEL,
  type RmListView,
  provincesFromApplications,
  rmTabHasLeadTools,
  type RmFilters,
  type RmRowAction,
  type RmTab,
} from '@/lib/recruitRm';
import {
  fetchAllJobApplications,
  recordAppointmentAttendance,
  setJobApplicationLead,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import { ATTENDANCE_LABEL, type AttendanceResult } from '@/lib/appointmentAttendance';
import {
  LEAD_VIEW_HINT,
  summarizeLeadUpdate,
  type LeadUpdateResult,
} from '@/lib/recruitLead';
import {
  acquireCallHold,
  fetchCallHoldsByPhones,
  type CallHold,
} from '@/lib/callHoldsApi';
import {
  partitionHoldTargets,
  summarizeAcquireResults,
  type HoldTarget,
} from '@/lib/callHoldsBulk';
import { canHoldApplication } from '@/lib/recruitRm';
import { useAuth } from '@/contexts/AuthContext';

/**
 * พื้นที่ทำงาน "รายชื่อผู้สมัคร" — เนื้อของหน้างานสรรหา (RM) เดิมทั้งก้อน
 *
 * เจ้าของเคาะ 11 ส.ค. 2569 รอบหก: รวมหน้า RM เข้ากับบอร์ดรับสมัครเป็นแท็บสลับมุมมอง
 * ("แยกกล่องงาน แต่ยังดึงเก็บไปแบบหน้า RM ได้") — component นี้คือมุมมองฝั่ง list
 * ถูก mount โดย `StaffJobBoardPage` (ไม่ใช่ใน JobBoardView — กันโค้ด RM รั่วเข้า
 * bundle หน้าสมัครสาธารณะ) · หน้า `/recruit/rm` เดิมเหลือเป็น redirect เข้าบอร์ด
 *
 * ⚠️ ไม่มี RecruitFunnelPanel ในนี้ — บอร์ดมีแผงภาพรวมของตัวเองอยู่แล้ว (โชว์ทั้งสองมุมมอง)
 * ⚠️ แท็บอยู่ใน `?tab=` เหมือนเดิม และต้อง **คง query param อื่นไว้** (`?view=` ของบอร์ด)
 *    — สร้าง URLSearchParams จากของเดิมเสมอ ห้ามเขียนทับทั้งก้อน
 *
 * ═══ ของที่ยังไม่ได้ต่อ (ขึ้นข้อความบอกตรง ๆ ไม่ปล่อยกดแล้วเงียบ) ═══
 * TODO(api) ระบบ Lead (เก็บ/ลบ Lead) — ยังไม่มีตารางฝั่งเรา
 * TODO(api) ปุ่ม "ช่องทาง"/"สร้างลิงก์" บนแถบนี้ — ของจริงอยู่ที่แถบบอร์ด (มุมมองกล่องงาน)
 */

const PAGE_SIZE_DEFAULT: PageSizeOption = 20;

function isRmTab(v: string | null): v is RmTab {
  return !!v && (RM_TABS as readonly string[]).includes(v);
}

const RmWorkspace: React.FC<{
  /**
   * แท็บที่ถูกคุมจากข้างนอก (เจ้าของสั่ง 13 ส.ค. 2569: "การติดต่อ"/"ติดตามนัดหมาย"
   * เป็นแท็บระดับบอร์ดแล้ว) — ส่งมา = ล็อกแท็บนั้นและซ่อนแถบแท็บย่อยข้างใน
   * ไม่ส่ง = พฤติกรรมเดิม (อ่านจาก ?tab= · มีแถบแท็บของตัวเอง)
   */
  tab?: RmTab;
}> = ({ tab: controlledTab }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: RmTab = controlledTab ?? (isRmTab(tabParam) ? tabParam : 'candidates');
  /**
   * มุมมองย่อยของแท็บ "รายชื่อผู้สมัคร" (เจ้าของสั่ง 13 ส.ค. 2569 ให้แบ่ง 3 อัน)
   * เก็บใน `?list=` เพื่อให้ refresh/แชร์ลิงก์แล้วยังอยู่มุมมองเดิม — แพตเทิร์นเดียวกับ ?tab=
   */
  const listParam = searchParams.get('list');
  const listView: RmListView = isRmListView(listParam) ? listParam : 'all';

  const [rows, setRows] = useState<PublicApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RmFilters>(EMPTY_RM_FILTERS);
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(PAGE_SIZE_DEFAULT);
  /** ข้อความบอกว่ายังไม่ได้ต่อของจริง — ดีกว่าปุ่มที่กดแล้วเงียบ */
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  /** dialog รายละเอียด+บันทึกผลติดต่อ (ลิสต์ข้อ 7) — เปิดจากปุ่ม "ดูรายละเอียด"/"บันทึกผลนัดหมาย" */
  const [contactApp, setContactApp] = useState<PublicApplication | null>(null);
  const { user } = useAuth();
  /** ล็อกโทรของแถวในหน้า (คีย์ = application id) — โชว์ 🔒 + กันกดซ้ำ */
  const [holdByRef, setHoldByRef] = useState<Record<string, CallHold>>({});
  const [holdingSelected, setHoldingSelected] = useState(false);
  /**
   * มุมมอง "คลังสำรอง (Lead)" — ใบที่ถูกปัดออกจากรายชื่อทำงาน
   * เก็บใน `?lead=1` เพื่อให้ refresh/แชร์ลิงก์แล้วยังอยู่มุมมองเดิม (แพตเทิร์นเดียวกับ ?tab=)
   * ⚠️ การกรองอยู่ฝั่ง server — ลิสต์ปกติไม่เคยมีแถว Lead ติดมาให้ต้องกรองซ้ำ
   */
  const leadView = searchParams.get('lead') === '1';
  const [leadBusy, setLeadBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    fetchAllJobApplications(leadView)
      .then(setRows)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'โหลดรายชื่อผู้สมัครไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [leadView]);

  /** สลับมุมมอง — ต้องคง query param อื่นไว้ (`?view=` ของบอร์ด · `?tab=` · `?list=`) */
  const setLeadView = (on: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (on) next.set('lead', '1');
    else next.delete('lead');
    setSearchParams(next, { replace: true });
    setSelectedIds([]);
    setPage(1);
    setNotice(null);
  };

  /**
   * เก็บ/ลบ Lead เป็นชุด — ยิงทีละใบแล้วสรุปผลรวม (ไม่มี endpoint bulk)
   * ⚠️ ล้มบางใบต้องรายงาน ไม่ใช่กลืน (summarizeLeadUpdate มีเทสต์คุม)
   */
  const applyLead = async (lead: boolean) => {
    if (selectedIds.length === 0 || leadBusy) return;
    setLeadBusy(true);
    setNotice(null);
    const results: LeadUpdateResult[] = await Promise.all(
      selectedIds.map((id) =>
        setJobApplicationLead(id, lead)
          .then((): LeadUpdateResult => ({ ok: true }))
          .catch(
            (e): LeadUpdateResult => ({
              ok: false,
              message: e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ',
            }),
          ),
      ),
    );
    setNotice(summarizeLeadUpdate(results, lead).message);
    setSelectedIds([]);
    setLeadBusy(false);
    load();
  };

  /**
   * บันทึกผลติดตามนัด มา/ไม่มา (แท็บนัดหมาย · migration 089) — append-only ล่าสุดชนะ
   * server เป็นด่านตัดสิน (ก่อนวันนัด = 400) · เสร็จแล้ว reload ให้ชิปบนแถวอัปเดต
   */
  const onAttendance = (row: PublicApplication, result: AttendanceResult) => {
    if (!row.appointment_at) return;
    setNotice(null);
    void recordAppointmentAttendance({
      applicationId: row.id,
      appointmentAt: row.appointment_at,
      result,
    })
      .then(() => {
        setNotice(`บันทึกผลนัดของ ${row.full_name}: ${ATTENDANCE_LABEL[result]} แล้ว`);
        load();
      })
      .catch((e) => setNotice(e instanceof Error ? e.message : 'บันทึกผลนัดไม่สำเร็จ'));
  };

  const provinces = useMemo(() => provincesFromApplications(rows), [rows]);

  /** จำนวนต่อแท็บ — นิยามเดียวกับตัวกรอง (isInRmTab) เลขบนแท็บจึงตรงกับที่เห็นเสมอ */
  const tabCounts = useMemo(() => {
    const out = {} as Record<RmTab, number>;
    for (const t of RM_TABS) out[t] = rows.filter((r) => isInRmTab(r, t)).length;
    return out;
  }, [rows]);

  const filtered = useMemo(() => {
    const base = filterApplications(rows, tab, filters, keyword);
    // มุมมองย่อยใช้เฉพาะแท็บรายชื่อผู้สมัคร — แท็บอื่นมีความหมายของตัวเองอยู่แล้ว
    if (tab !== 'candidates') return base;
    return base.filter((r) => isInRmListView(r, listView));
  }, [rows, tab, filters, keyword, listView]);

  /** เลขบนปุ่มมุมมองย่อย — นับหลังตัวกรอง/คำค้นเดียวกัน เลขจึงตรงกับที่เห็นเสมอ */
  const listViewCounts = useMemo(() => {
    const base = filterApplications(rows, 'candidates', filters, keyword);
    const out = {} as Record<RmListView, number>;
    for (const v of RM_LIST_VIEWS) out[v] = base.filter((r) => isInRmListView(r, v)).length;
    return out;
  }, [rows, filters, keyword]);

  const setListView = (next: RmListView) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('list');
    else params.set('list', next);
    setSearchParams(params, { replace: true });
    setSelectedIds([]);
    setPage(1);
  };

  const totalPages = getTotalPages(filtered.length, pageSize);
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  /**
   * โหลดสถานะล็อกของแถวในหน้านี้ — server จับคู่ด้วยเบอร์ E.164 แล้วคืน map คีย์ ref
   * อ่านไม่ได้ = ทุกแถวดูเป็น "ว่าง" ซึ่งยังปลอดภัย เพราะ server เป็นคนตัดสินตอนกดจริง
   */
  useEffect(() => {
    if (pageRows.length === 0) return;
    let cancelled = false;
    void fetchCallHoldsByPhones(pageRows.map((r) => r.phone)).then((map) => {
      if (cancelled) return;
      setHoldByRef((prev) => {
        // เขียนสถานะของ "แถวในหน้านี้" ใหม่ทั้งก้อน — มีล็อก = ตั้ง · ไม่มี = ลบคีย์ออก
        // ⚠️ ห้าม merge ทางเดียว: เดิมพอคืน/หมดอายุล็อก แถวยังโชว์ 📞 + ปุ่มโทร disabled
        // ค้างจนกว่าจะ reload ทั้งหน้า (กด "รีเฟรช" ก็ไม่ช่วยเพราะ load() ไม่แตะ holdByRef)
        // · map คีย์ด้วย candidateRef ของล็อก (= application id) → map.get(row.id)
        const next = { ...prev };
        for (const row of pageRows) {
          const hold = map.get(row.id);
          if (hold) next[row.id] = hold;
          else delete next[row.id];
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [pageRows]);

  const setTab = (next: RmTab) => {
    // ⚠️ ต่อยอดจาก params เดิมเสมอ — ?view= ของบอร์ดต้องรอด ไม่งั้นสลับแท็บแล้วเด้งกลับกล่องงาน
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
    // ล้างที่ติ๊กไว้ตอนสลับแท็บ — ปุ่ม action คนละชุด ติ๊กค้างข้ามแท็บแล้วสับสน
    setSelectedIds([]);
    setNotice(null);
    setPage(1);
  };

  /** ปุ่มแถวที่ยังไม่ต่อของจริง — ขึ้นข้อความ ดีกว่ากดแล้วเงียบ */
  const todo = (what: string) => setNotice(`${what} — ยังไม่ได้ต่อกับระบบจริง`);

  /** สร้าง HoldTarget จากใบสมัคร — source 'application' · ref = application id (แค่ display) */
  const toHoldTarget = (row: PublicApplication): HoldTarget => ({
    candidateRef: row.id,
    candidateName: row.full_name,
    phone: row.phone ?? null,
    jobId: row.job_id ?? null,
    requestNo: null,
    source: 'application',
  });

  /** ยิงจับล็อกเป็นชุด (sequential — DB ตัดสินการชนที่เบอร์) แล้วสรุปเป็น notice เดียว */
  const acquireTargets = async (targets: HoldTarget[]) => {
    const { ready, noPhone, noJob } = partitionHoldTargets(targets);
    const results: Array<{ target: HoldTarget; result: Awaited<ReturnType<typeof acquireCallHold>> }> = [];
    for (const t of ready) {
      const result = await acquireCallHold({
        phone: t.phone!,
        source: t.source,
        candidateRef: t.candidateRef,
        candidateName: t.candidateName,
        jobId: t.jobId!,
        requestNo: t.requestNo ?? null,
      });
      results.push({ target: t, result });
      const hold = result.ok ? result.hold : result.heldBy;
      if (hold) setHoldByRef((prev) => ({ ...prev, [t.candidateRef]: hold }));
    }
    const summary = summarizeAcquireResults({
      results,
      viewerName: user?.email ?? null,
      skippedNoPhone: noPhone.length,
      skippedNoJob: noJob.length,
    });
    setNotice(`${summary} — ไปโทร+บันทึกผลที่หน้า "โทรของฉัน"`);
  };

  const onRowAction = (action: RmRowAction, row: PublicApplication) => {
    if (action === 'call') {
      // ปุ่มถูก disable ไว้แล้วถ้าจับไม่ได้ — เช็คซ้ำกันหลุดจาก keyboard/สคริปต์
      if (!canHoldApplication(row).ok || holdByRef[row.id]) return;
      setNotice(null);
      void acquireTargets([toHoldTarget(row)]);
      return;
    }
    // ดูรายละเอียด/บันทึกผล → dialog ติดต่อสำเร็จ-ไม่สำเร็จ (ลิสต์ข้อ 7 · 14 ส.ค. 2569)
    if (action === 'view' || action === 'rule') {
      setContactApp(row);
      return;
    }
    todo(`"${RM_ROW_ACTION_LABEL[action]}" ของ ${row.full_name}`);
  };

  /** "ดึงเข้าถังโทร" จากแถวที่ติ๊ก — ทำงานได้ทุกแท็บ (นิยาม "ดึงเก็บไป" ที่เจ้าของเคาะ) */
  const holdSelectedForSelf = async () => {
    if (selectedIds.length === 0 || holdingSelected) return;
    setHoldingSelected(true);
    setNotice(null);
    try {
      const targets = pageRows.filter((r) => selectedIds.includes(r.id)).map(toHoldTarget);
      await acquireTargets(targets);
      setSelectedIds([]);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'ดึงเข้าถังโทรไม่สำเร็จ');
    } finally {
      setHoldingSelected(false);
    }
  };

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () =>
    setSelectedIds((prev) =>
      pageRows.every((r) => prev.includes(r.id))
        ? prev.filter((id) => !pageRows.some((r) => r.id === id))
        : [...new Set([...prev, ...pageRows.map((r) => r.id)])],
    );

  return (
    <div>
      {/* แถบแท็บย่อย — โผล่เฉพาะโหมดไม่ถูกคุมจากข้างนอก (ตอนนี้บอร์ดคุมด้วย ?view= แล้ว
          แถบนี้จึงไม่ขึ้นบนบอร์ด — คงไว้เผื่อ RmWorkspace ถูกใช้เดี่ยว ๆ ที่อื่น) */}
      {/* ⚠️ ป้าย "ข้อมูลผู้สมัคร · N รายการ" ถูกเอาออก (เจ้าของสั่ง 14 ส.ค. 2569) —
          ซ้ำกับ tab bar ระดับบอร์ดที่มีชื่อแท็บ+จำนวนอยู่แล้ว · เหลือแค่ปุ่มรีเฟรช */}
      {controlledTab ? (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={load} disabled={loading} className="jarvis-btn-secondary">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden /> รีเฟรช
          </button>
        </div>
      ) : (
        <div className={cn('flex flex-wrap items-center gap-1 border-b', DASH.divider)}>
          {RM_TABS.map((t) => {
            const active = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative px-4 py-2.5 text-sm font-semibold transition-colors',
                  active
                    ? cn(TONE.primary.value, 'border-b-2 border-current')
                    : cn(DASH.muted, 'border-b-2 border-transparent hover:text-foreground'),
                )}
              >
                {RM_TAB_LABEL[t]}
                <span className={cn('ml-1.5 font-mono text-[11px] tabular-nums', active ? '' : DASH.muted)}>
                  {loading ? '…' : tabCounts[t].toLocaleString('th-TH')}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="jarvis-btn-secondary ml-auto"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden /> รีเฟรช
          </button>
        </div>
      )}

      {/* แท็บย่อย 3 อันของ "รายชื่อผู้สมัคร" (เจ้าของสั่ง 13 ส.ค. 2569)
          แบ่งด้วย **ผลโทร** ไม่ใช่สถานะใบสมัคร · เห็นครบทั้ง 3 เสมอแม้ยอดเป็น 0
          (0 คือคำตอบ ไม่ใช่ช่องว่าง) · โผล่เฉพาะแท็บนี้ — แท็บอื่นมีความหมายของตัวเอง */}
      {tab === 'candidates' ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {RM_LIST_VIEWS.map((v) => {
            const active = v === listView;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setListView(v)}
                aria-pressed={active}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : cn('bg-muted hover:bg-muted/70', DASH.muted),
                )}
              >
                {RM_LIST_VIEW_LABEL[v]}
                <span className="ml-1.5 font-mono text-[11px] tabular-nums">
                  {loading ? '…' : listViewCounts[v].toLocaleString('th-TH')}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <RmFilterSidebar filters={filters} onChange={setFilters} provinces={provinces} />

        <div className="min-w-0 flex-1 space-y-3">
          {/* ⚠️ RmToolbar (ช่องทาง/สร้างลิงก์/เหตุผล) ถูกเอาออก (เจ้าของสั่ง 14 ส.ค. 2569:
              "กล่องช่องทาง ฯลฯ มีแค่หน้ากล่องงาน") — เครื่องมือพวกนี้เหลือที่ RecruitBoardTools
              บนกล่องงาน (view=board) เท่านั้น · เหลือแค่ค้นหา + เพิ่มผู้สมัคร + Lead */}
          <div className={cn('rounded-2xl border p-3', DASH.card)}>
            <RmSearchBar
              keyword={keyword}
              onKeywordChange={(v) => {
                setKeyword(v);
                setPage(1);
              }}
              onSearch={() => setPage(1)}
              showLeadTools={rmTabHasLeadTools(tab)}
              selectedCount={selectedIds.length}
              onSaveLead={() => void applyLead(true)}
              onDeleteLead={() => void applyLead(false)}
              leadBusy={leadBusy}
              leadView={leadView}
              onAddApplicant={() => setAddOpen(true)}
              onHoldSelected={() => void holdSelectedForSelf()}
              holdingSelected={holdingSelected}
            />
          </div>

          {notice ? (
            <p className={cn('rounded-xl border px-3 py-2 text-[12px]', TONE.warn.soft, TONE.warn.value)}>
              {notice}
            </p>
          ) : null}

          {/* อยู่คลังสำรองต้องบอกให้รู้ตัว ไม่งั้นอ่านว่า "รายชื่อหายไปไหนหมด" */}
          {leadView ? (
            <p className={cn('rounded-xl border px-3 py-2 text-[11px]', TONE.violet.soft, TONE.violet.value)}>
              {LEAD_VIEW_HINT}
            </p>
          ) : null}

          {tab === 'appointments' ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rm-appointments-head">
              {/* เจ้าของนิยาม 14 ส.ค. 2569: "ติดตามการนัดหมายเป็นแค่หน้าเอาไว้ดูว่านัดที่ไหน
                  วันไหน และกี่คน โหลดเป็น PDF ได้" — สรุปหัว + ปุ่มพิมพ์ (window.print
                  ฝั่งเบราว์เซอร์ — เจ้าของเคาะ ไม่เพิ่ม lib) · print CSS ซ่อนส่วนอื่นของหน้า */}
              <p className={cn('rounded-xl border px-3 py-2 text-[11px]', TONE.info.soft, TONE.info.value)}>
                นัดสัมภาษณ์ <b>{filtered.filter((r) => r.appointment_at).length.toLocaleString('th-TH')}</b> คน
                จากทั้งหมด {filtered.length.toLocaleString('th-TH')} คนที่รับเข้าทำงาน ·
                วันนัดมาจากผลโทร "สนใจ→นัดได้" หรือบันทึกผลติดต่อ "สำเร็จ→นัดได้"
              </p>
              <button type="button" onClick={() => window.print()} className="jarvis-btn-secondary shrink-0">
                🖨 โหลดเป็น PDF
              </button>
            </div>
          ) : null}

          {/* แท็บ "การโทรของฉัน" มี 2 ส่วนที่ **ทำงานคนละแบบ** (เจ้าของสั่ง 14 ส.ค. 2569):
              1. เก็บไปโทรเอง (call hold ผูกเบอร์ · มาจากหน้า Matching + ปุ่มโทรในแท็บนี้) — MyCallsSection
                 เจ้าของ pain: "เก็บไปโทรเองแล้วไปอยู่ไหนหาไม่เจอ" → ให้มีที่ถาวรตรงนี้
              2. เก็บไปติดต่อ (claim บนใบสมัคร) — RmTable ด้านล่าง
              ⚠️ MyCallsSection ซ่อนตัวเองเมื่อไม่มีงานโทรค้าง (holds=0) — hint จึงบอกไว้เสมอ */}
          {tab === 'contact' ? (
            <>
              <p className={cn('rounded-xl border px-3 py-2 text-[11px]', TONE.primary.soft, TONE.primary.value)}>
                <b>2 ส่วนที่ทำงานคนละแบบ:</b> ① เก็บไปโทรเอง (จากหน้า Matching — ผูกเบอร์
                มีเวลาโทร) โผล่ด้านบนตอนมีงานค้าง · ② เก็บไปติดต่อ (ใบที่คุณเก็บ) อยู่ในตารางด้านล่าง
              </p>
              <MyCallsSection />
            </>
          ) : null}

          {loadError ? (
            <p className={cn('rounded-xl border px-3 py-2 text-[12px]', TONE.danger.soft, TONE.danger.value)}>
              {loadError} —{' '}
              <button type="button" onClick={load} className="underline">
                ลองใหม่
              </button>
            </p>
          ) : loading ? (
            <p className={cn('rounded-xl border px-3 py-6 text-center text-sm', DASH.card, DASH.muted)}>
              กำลังโหลดใบสมัคร…
            </p>
          ) : (
            <>
              {/* rm-print-area: ตอนกด "โหลดเป็น PDF" print CSS จะโชว์เฉพาะก้อนนี้
                  (เฉพาะแท็บนัดหมาย — แท็บอื่นพิมพ์ทั้งหน้าตามปกติ) */}
              <div className={tab === 'appointments' ? 'rm-print-area' : undefined}>
              <RmTable
                tab={tab}
                rows={pageRows}
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                onAction={onRowAction}
                holdByRef={holdByRef}
                onAttendance={onAttendance}
              />
              </div>
              <ListPaginationBar
                page={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filtered.length}
                pageFrom={filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                pageTo={Math.min(currentPage * pageSize, filtered.length)}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            </>
          )}
        </div>
      </div>

      <AddApplicantDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setNotice('บันทึกผู้สมัครแล้ว');
          load(); // ใบใหม่ต้องโผล่ในตารางทันที ไม่ต้องให้กดรีเฟรชเอง
        }}
      />

      {/* dialog รายละเอียด + ติดต่อสำเร็จ/ไม่สำเร็จ + นัด (ลิสต์ข้อ 7 · 14 ส.ค. 2569) */}
      <ApplicantContactDialog
        application={contactApp}
        onClose={() => setContactApp(null)}
        onSaved={() => {
          setNotice('บันทึกผลติดต่อแล้ว');
          load(); // สถานะใบเปลี่ยน (นัดได้ = converted) แถวอาจย้ายแท็บ — โหลดใหม่ให้เห็นทันที
        }}
      />
    </div>
  );
};

export default RmWorkspace;
