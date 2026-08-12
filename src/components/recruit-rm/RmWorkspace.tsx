import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { getTotalPages, type PageSizeOption } from '@/lib/pagination';
import RmFilterSidebar from '@/components/recruit-rm/RmFilterSidebar';
import RmToolbar from '@/components/recruit-rm/RmToolbar';
import ReasonManagerDialog from '@/components/recruit-rm/ReasonManagerDialog';
import RmSearchBar from '@/components/recruit-rm/RmSearchBar';
import RmTable from '@/components/recruit-rm/RmTable';
import AddApplicantDialog from '@/components/recruit-rm/AddApplicantDialog';
import {
  EMPTY_RM_FILTERS,
  RM_ROW_ACTION_LABEL,
  RM_TABS,
  RM_TAB_LABEL,
  RM_TAB_STATUSES,
  RM_TOOLBAR_LABEL,
  filterApplications,
  provincesFromApplications,
  rmTabHasLeadTools,
  type RmFilters,
  type RmRowAction,
  type RmTab,
  type RmToolbarKey,
} from '@/lib/recruitRm';
import {
  fetchAllJobApplications,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';

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
 * TODO(api) วันนัดจริงในแท็บติดตามนัดหมาย — ต้องมี GET /api/candidate-interviews?all=1
 * TODO(api) ปุ่ม "ช่องทาง"/"สร้างลิงก์" บนแถบนี้ — ของจริงอยู่ที่แถบบอร์ด (มุมมองกล่องงาน)
 */

const PAGE_SIZE_DEFAULT: PageSizeOption = 20;

function isRmTab(v: string | null): v is RmTab {
  return !!v && (RM_TABS as readonly string[]).includes(v);
}

const RmWorkspace: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: RmTab = isRmTab(tabParam) ? tabParam : 'candidates';

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
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    fetchAllJobApplications()
      .then(setRows)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'โหลดรายชื่อผู้สมัครไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const provinces = useMemo(() => provincesFromApplications(rows), [rows]);

  /** จำนวนต่อแท็บ — โชว์บนหัวแท็บให้เห็นงานค้างโดยไม่ต้องกดเข้าไปดู */
  const tabCounts = useMemo(() => {
    const out = {} as Record<RmTab, number>;
    for (const t of RM_TABS) {
      const st = RM_TAB_STATUSES[t];
      out[t] = st ? rows.filter((r) => st.includes(r.status)).length : rows.length;
    }
    return out;
  }, [rows]);

  const filtered = useMemo(
    () => filterApplications(rows, tab, filters, keyword),
    [rows, tab, filters, keyword],
  );

  const totalPages = getTotalPages(filtered.length, pageSize);
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

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

  const todo = (what: string) => setNotice(`${what} — ยังไม่ได้ต่อกับระบบจริง`);
  const onToolbar = (key: RmToolbarKey) => {
    setNotice(null);
    if (key === 'reasons') return setReasonsOpen(true);
    todo(`ปุ่ม "${RM_TOOLBAR_LABEL[key]}"`);
  };
  const onRowAction = (action: RmRowAction, row: PublicApplication) =>
    todo(`"${RM_ROW_ACTION_LABEL[action]}" ของ ${row.full_name}`);

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
      {/* แถบแท็บ — ระบบเดิมใช้ radio+CSS · ที่นี่ผูกกับ ?tab= เพื่อแชร์ลิงก์/กด back ได้ */}
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

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <RmFilterSidebar filters={filters} onChange={setFilters} provinces={provinces} />

        <div className="min-w-0 flex-1 space-y-3">
          <div className={cn('space-y-3 rounded-2xl border p-3', DASH.card)}>
            <RmToolbar onOpen={onToolbar} />
            <div className={cn('border-t pt-3', DASH.divider)}>
              <RmSearchBar
                keyword={keyword}
                onKeywordChange={(v) => {
                  setKeyword(v);
                  setPage(1);
                }}
                onSearch={() => setPage(1)}
                showLeadTools={rmTabHasLeadTools(tab)}
                selectedCount={selectedIds.length}
                onSaveLead={() => todo(`เก็บ ${selectedIds.length} รายการเข้า Lead`)}
                onDeleteLead={() => todo(`ลบ ${selectedIds.length} รายการออกจาก Lead`)}
                onAddApplicant={() => setAddOpen(true)}
              />
            </div>
          </div>

          {notice ? (
            <p className={cn('rounded-xl border px-3 py-2 text-[12px]', TONE.warn.soft, TONE.warn.value)}>
              {notice}
            </p>
          ) : null}

          {tab === 'appointments' ? (
            <p className={cn('rounded-xl border px-3 py-2 text-[11px]', TONE.info.soft, TONE.info.value)}>
              แท็บนี้คือคนที่สถานะ "รับเข้าทำงาน" แล้ว — วันนัดสัมภาษณ์จริงจะโชว์ได้เมื่อต่อ
              API รวมของนัดหมาย (ตอนนี้ระบบดึงนัดได้ทีละคน)
            </p>
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
              <RmTable
                tab={tab}
                rows={pageRows}
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                onAction={onRowAction}
              />
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

      <ReasonManagerDialog open={reasonsOpen} onClose={() => setReasonsOpen(false)} />
    </div>
  );
};

export default RmWorkspace;
