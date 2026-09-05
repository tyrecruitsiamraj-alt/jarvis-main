import React, { useState } from 'react';
import { ChevronDown, Download, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import type { DashboardData, DashboardFilters, DashboardKpi, DashboardResponsibleRole, DashboardStatusFilter } from '@/lib/dashboard/types';
import type { UnitRequestFilterState } from '@/hooks/useSiamrajUnitRequestFilters';
import type { DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import DashboardFilterBar from './DashboardFilterBar';
import DashboardKpiCard from './DashboardKpiCard';
import DashboardChartSection from './DashboardChartSection';
import DashboardHeroStrip from './DashboardHeroStrip';
import DashboardLeadKindChart from './DashboardLeadKindChart';
import DashboardSlaByLeadKind from './DashboardSlaByLeadKind';
import DashboardUnitOverviewChart from './DashboardUnitOverviewChart';
import DashboardDriverOverview from './DashboardDriverOverview';
import DashboardExpandablePanel from './DashboardExpandablePanel';
import DashboardExecutiveInsightsCard from './DashboardExecutiveInsights';
import DashboardFlowViewCard from './DashboardFlowView';
import DashboardCohortSummaryCard from './DashboardCohortSummary';
import DashboardClosedBreakdownCard from './DashboardClosedBreakdown';
import type { DashboardWorkItem } from '@/lib/dashboard/types';
import type { LeadKindBreakdown } from '@/lib/dashboard/leadKindBreakdown';
import type { RequestLeadKind } from '@/lib/requestLeadKind';
import type { SlaByLeadKind, SlaCellKey } from '@/lib/dashboard/slaByLeadKind';

type FilterOptions = {
  departmentOptions: { value: string; label: string }[];
  jobSubtypeOptions: { value: string; label: string }[];
  unitOptions: string[];
  recruiters: string[];
  screeners: string[];
  opls: string[];
  unassignedRecruiterCount: number;
  unassignedScreenerCount: number;
  unassignedOplCount: number;
};

type Props = {
  data: DashboardData;
  filters: DashboardFilters;
  onFiltersChange: (patch: Partial<DashboardFilters>) => void;
  dateRange: DateRangeYmd | null;
  /** กดแท่ง "เข้ามารายเดือน" → กรองทั้งหน้าเป็นเดือนนั้น */
  onMonthClick?: (monthStartYmd: string, label: string) => void;
  selectedMonth?: string | null;
  onDateRangeChange: (range: DateRangeYmd | null) => void;
  unitFilters: UnitRequestFilterState;
  onUnitFiltersChange: (patch: Partial<UnitRequestFilterState>) => void;
  siamrajPrimary: boolean;
  filterOptions: FilterOptions;
  lockedDepartmentCode?: string | null;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  onViewItem: (item: DashboardWorkItem) => void;
  /**
   * กดการ์ด KPI · ส่ง `expectedRequests` (ยอด "ใบขอ" ที่การ์ดโชว์) ไปด้วย เพื่อให้
   * ตัวเปิดลิสต์บอกได้ว่ารายการที่ดึงมาได้ครบตามเลขบนการ์ดหรือไม่ — ยอดบางตัวนับจาก
   * ยอดรวมฝั่ง ERP ซึ่ง**รวมใบที่อยู่นอก feed ของกล่องงาน** ลิสต์จึงน้อยกว่าได้เป็นปกติ
   */
  onKpiClick?: (kpiId: string, label: string, expectedRequests?: number | null) => void;
  /** กราฟ ทั้งหมด/ฉุกเฉิน/ล่วงหน้า (18 ส.ค. 2569) — ไม่ส่ง = ไม่แสดงกราฟ (เช่นโหมด demo) */
  leadKindBreakdown?: LeadKindBreakdown | null;
  leadKindMismatch?: string | null;
  onLeadKindClick?: (kind: RequestLeadKind, label: string) => void;
  onCohortClick?: (rowId: string, label: string) => void;
  onFilledBreakdownClick?: (segment: 'same' | 'backlog', label: string) => void;
  onFullyClosedBreakdownClick?: (segment: 'same' | 'backlog', label: string) => void;
  onAgeBucketClick?: (bucket: DashboardData['ageDaysBreakdown'][number]['bucket'], label: string) => void;
  onSiteClick?: (siteCode: string | undefined, label: string) => void;
  /**
   * ตาราง "ปิดทัน / ไม่ทัน ตามชนิดใบขอ" (เจ้าของสั่ง 22 ส.ค. 2569)
   * ไม่ส่ง `slaByLeadKind` = ไม่แสดงตาราง (โหมด demo / ยังโหลดไม่เสร็จ)
   */
  slaByLeadKind?: SlaByLeadKind | null;
  /** ชุดใบปิดของช่วงที่กำลังดูถูกดึงมาแล้วหรือยัง (ดูเหตุผลใน DashboardSlaByLeadKind) */
  slaClosedLoaded?: boolean;
  /** ปุ่มดึงชุดใบปิดจากในตาราง SLA — โหมด "ทั้งหมด" เท่านั้น */
  onLoadClosedForSla?: () => void;
  onSlaCellClick?: (kind: RequestLeadKind, cell: SlaCellKey, label: string) => void;
  onSlaRowClick?: (kind: RequestLeadKind, label: string) => void;
  /** false = ยังไม่ได้ดึงชุดใบปิด (โหมด "ทั้งหมด") → ช่อง "ปิด" ต่อคนต้องโชว์ "—" ไม่ใช่ 0 */
  closedTotalsAvailable?: boolean;
  /** โหมด "ทั้งหมด" ใบปิดถูกดึงตอนกางแผงผู้รับผิดชอบเท่านั้น (ช่วงเต็มใช้เวลานาน) */
  onRecruiterPanelOpen?: () => void;
  closedTotalsLoading?: boolean;
  onRecruiterClick?: (name: string, role: DashboardResponsibleRole) => void;
  /** แผงเสริมท้ายคอลัมน์ขวา (เช่น Rate ผลการโทร Lumos) — จัดการข้อมูลของตัวเอง ไม่ผูกกับ filter ของหน้า */
  extraPanels?: React.ReactNode;
};

const DashboardShell: React.FC<Props> = ({
  data,
  filters,
  onFiltersChange,
  dateRange,
  onMonthClick,
  selectedMonth,
  onDateRangeChange,
  unitFilters,
  onUnitFiltersChange,
  siamrajPrimary,
  filterOptions,
  lockedDepartmentCode = null,
  loading,
  refreshing,
  onRefresh,
  onExport,
  onViewItem,
  onKpiClick,
  leadKindBreakdown,
  leadKindMismatch,
  onLeadKindClick,
  onCohortClick,
  onFilledBreakdownClick,
  onFullyClosedBreakdownClick,
  onAgeBucketClick,
  onSiteClick,
  slaByLeadKind,
  slaClosedLoaded,
  onLoadClosedForSla,
  onSlaCellClick,
  onSlaRowClick,
  closedTotalsAvailable = true,
  onRecruiterPanelOpen,
  closedTotalsLoading = false,
  onRecruiterClick,
  extraPanels,
}) => {
  const [showControlDetail, setShowControlDetail] = useState(false);
  const [showUnitOverview, setShowUnitOverview] = useState(false);
  const [showRecruiterOverview, setShowRecruiterOverview] = useState(false);
  const [showExecInsights, setShowExecInsights] = useState(false);
  const [showLifecycle, setShowLifecycle] = useState(false);
  /**
   * Wave 2.3 (5 ก.ย. 2569): บนมือถือแผงตัวกรองกินจอแรกทั้งจอ — คนใหม่เปิดหน้ามา
   * เห็นแต่ dropdown ยังไม่เห็นตัวเลขสักตัว ⇒ **พับไว้ ค่าตั้งต้นปิด**
   * ⚠️ ตัวกรองทุกช่องยังอยู่ครบ ไม่มีตัวไหนถูกถอด · เดสก์ท็อป (md ขึ้นไป) เหมือนเดิมทุกอย่าง
   */
  const isMobile = useIsMobile();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeSiteCount = data.unitOverview.filter((u) => u.open > 0).length;
  const siteOpenTotal = data.unitOverview.reduce((sum, u) => sum + u.open, 0);
  const recruiterRemainingTotal = data.recruiterOverview.reduce((sum, r) => sum + r.remaining, 0);
  const remainingKpiValue = data.kpis.find((k) => k.id === 'remaining')?.value ?? 0;

  /**
   * แถบสัดส่วนใต้ตัวเลข KPI (mockup rev.3) — เทียบกับ "เข้ามา" ของช่วงเดียวกัน
   * รองรับทั้งชุด stock (total_requests/closed/…) และชุด throughput (total/completed/…)
   * แสดงเฉพาะเมื่อฐานเป็นบวก · การ์ด % ไม่ใส่ (ตัวเลขเป็น % อยู่แล้ว)
   */
  const kpiDenominator =
    data.kpis.find((k) => k.id === 'total_requests' || k.id === 'total')?.value ?? 0;
  const kpiProgress = (kpi: DashboardKpi): number | null => {
    if (kpiDenominator <= 0 || kpi.format === 'percent') return null;
    if (kpi.id === 'total_requests' || kpi.id === 'total') return 100;
    if (['closed', 'completed', 'cancelled', 'remaining'].includes(kpi.id)) {
      return Math.min(100, Math.round((kpi.value / kpiDenominator) * 100));
    }
    return null;
  };

  /** แผงตัวกรองชุดเดียว — มือถือเอาไปใส่ Collapsible · เดสก์ท็อปวางตรง ๆ เหมือนเดิม */
  const filterBar = (
    <DashboardFilterBar
      dateRange={dateRange}
      onDateRangeChange={onDateRangeChange}
      unitFilters={unitFilters}
      onUnitFiltersChange={onUnitFiltersChange}
      siamrajPrimary={siamrajPrimary}
      filterOptions={filterOptions}
      queueStatus={filters.queueStatus}
      onQueueStatusChange={(queueStatus: DashboardStatusFilter) => onFiltersChange({ queueStatus })}
      lockedDepartmentCode={lockedDepartmentCode}
    />
  );

  return (
    <div className="min-h-full bg-slate-100/60 dark:bg-transparent pb-24">
      <div className="bg-white/95 dark:bg-slate-900/90">
        <div className="mx-auto w-full max-w-[1760px] px-3 md:px-5 py-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              {/* หัวหลักเป็นไทย + คง EN เดิมเป็นบรรทัดรองตัวเล็กจาง (เจ้าของเคาะ 5 ก.ย. 2569) */}
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-slate-100">ศูนย์ควบคุมใบขอ</h1>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Request Control Tower</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:min-w-[420px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                {/**
                 * 🔴 ช่องนี้กรอง **เฉพาะไฟล์ CSV** — ไม่มีผลกับตัวเลข/กราฟบนหน้านี้
                 * (`filters.search` ถูกใช้ที่ `applyDashboardFilters` → `data.workQueue`
                 * ซึ่งมีผู้ใช้เดียวคือปุ่ม Export CSV · ตารางที่ควรแสดงเป็น dead code)
                 * เจ้าของเคาะ 23 ส.ค. 2569: เขียนกำกับให้ชัด ไม่ถอดช่องออก
                 */}
                <input
                  value={filters.search}
                  onChange={(e) => onFiltersChange({ search: e.target.value })}
                  placeholder="ค้นหาเพื่อกรองไฟล์ CSV (ไม่เปลี่ยนตัวเลขบนหน้า)"
                  title="ช่องนี้กรองข้อมูลในไฟล์ที่กด Export CSV เท่านั้น — ตัวเลขและกราฟบนหน้านี้ไม่เปลี่ยน"
                  className="w-full rounded-full border-0 bg-slate-100 dark:bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 shadow-inner placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div className="flex gap-2">
                {onRefresh ? (
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/40 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                    รีเฟรช
                  </button>
                ) : null}
                {onExport ? (
                  <button
                    type="button"
                    onClick={onExport}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/40 dark:hover:bg-slate-800"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1760px] px-3 md:px-5 py-5">
        {loading ? (
          /**
           * Wave 2.3: โหลดครั้งแรกเคยเป็นจอเปล่า + บรรทัด "กำลังโหลดข้อมูล…" บรรทัดเดียว
           * ⇒ คนอ่านไม่รู้ว่าหน้านี้จะมีอะไร (หรือพังไปแล้ว) · ใส่โครงกระดูกทรงเดียวกับ
           * ของจริง (ตัวกรอง + hero + การ์ด KPI) — **ไม่มีตัวเลขปลอมสักตัว**
           */
          <div
            className="grid grid-cols-1 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] gap-5"
            aria-busy="true"
          >
            <Skeleton className="hidden h-[28rem] w-full rounded-2xl lg:block" />
            <div className="space-y-5 min-w-0">
              <p className="text-sm text-slate-600 dark:text-slate-400">กำลังโหลดข้อมูล…</p>
              <Skeleton className="h-40 w-full rounded-2xl" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] gap-5">
            {isMobile ? (
              <Collapsible open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      DASH.card,
                      'flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4" aria-hidden />
                      ตัวกรอง
                    </span>
                    <span className="flex items-center gap-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                      {mobileFiltersOpen ? 'ซ่อน' : 'กดเพื่อกรอง'}
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform', mobileFiltersOpen && 'rotate-180')}
                        aria-hidden
                      />
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">{filterBar}</CollapsibleContent>
              </Collapsible>
            ) : (
              filterBar
            )}

            <div className="space-y-5 min-w-0">
              {/* hero เข้ม "ต้องลงมือตอนนี้" — ถังอายุเดิมยกขึ้นมาไว้บนสุด + แท่งเข้ามารายเดือน */}
              <DashboardHeroStrip
                items={data.ageDaysBreakdown}
                requestTotal={data.ageDaysRequestTotal}
                positionTotal={data.ageDaysPositionTotal}
                remainingPositions={remainingKpiValue}
                siteCount={activeSiteCount}
                trend={data.activityTrend}
                trendLabel={data.activityTrendLabel || data.periodLabel}
                onBucketClick={onAgeBucketClick}
                onMonthClick={onMonthClick}
                selectedMonth={selectedMonth}
              />

              <div className="space-y-3">
                <div>
                  <p className={cn(DASH.eyebrow, 'mb-1')}>สรุปอัตราในช่วงที่เลือก</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                    {dateRange == null ? (
                      /**
                       * 🔴 สมการต้องขึ้นเสมอ ไม่ใช่เฉพาะตอนเลือกช่วงวัน (แผนแก้จุดงงข้อ 2
                       * · 2 ก.ย. 2569) — Haiku ทดสอบแล้วเอา เข้ามา−ปิด−ยกเลิก ได้ 350
                       * แล้วถามว่า "หายไปไหน" เพราะจอไม่พิมพ์บรรทัดผลลัพธ์ให้
                       * ⚠️ ตัวเลขชุดเดิมทั้งหมด ไม่มีนิยามใหม่ — แค่พิมพ์ผลบวกลบให้เห็น
                       */
                      (() => {
                        const intake = data.kpis.find((k) => k.id === 'total_requests')?.value ?? 0;
                        const closed = data.kpis.find((k) => k.id === 'closed')?.value ?? 0;
                        const cancelled = data.kpis.find((k) => k.id === 'cancelled')?.value ?? 0;
                        const stillOpen = intake - closed - cancelled;
                        return (
                          <>
                            เข้ามา − ปิดแล้ว − ยกเลิก = <b>ยังเปิดหาอยู่ {stillOpen.toLocaleString('th-TH')} อัตรา</b>{' '}
                            ({intake.toLocaleString('th-TH')} − {closed.toLocaleString('th-TH')} −{' '}
                            {cancelled.toLocaleString('th-TH')}) · สามตัวนี้นับเฉพาะใบในช่วงแนวโน้ม —
                            ส่วน <span className="font-medium">คงเหลือ = ใบเปิดทั้งหมดทั้งระบบ</span> จึงเป็นคนละเลขกัน
                          </>
                        );
                      })()
                    ) : (
                      (() => {
                        const intake = data.kpis.find((k) => k.id === 'total_requests')?.value ?? 0;
                        const closed = data.kpis.find((k) => k.id === 'closed')?.value ?? 0;
                        const cancelled = data.kpis.find((k) => k.id === 'cancelled')?.value ?? 0;
                        const remaining = data.kpis.find((k) => k.id === 'remaining')?.value ?? 0;
                        return (
                          <>
                            เข้ามา − ปิดแล้ว − ยกเลิก = คงเหลือ · ตอนนี้ {intake.toLocaleString('th-TH')} −{' '}
                            {closed.toLocaleString('th-TH')} − {cancelled.toLocaleString('th-TH')} ={' '}
                            {remaining.toLocaleString('th-TH')}
                          </>
                        );
                      })()
                    )}
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {data.kpis.map((kpi) => (
                      <div key={kpi.id} className="flex flex-col gap-1">
                        <DashboardKpiCard
                          kpi={kpi}
                          progressPercent={kpiProgress(kpi)}
                          onClick={onKpiClick ? () => onKpiClick(kpi.id, kpi.label, kpi.secondaryCount ?? null) : undefined}
                        />
                        {/*
                         * ตำหนิ QA รอบสอง (6 ก.ย. 2569): ประโยค "คงเหลือ = ใบเปิดทั้งระบบ
                         * คนละเลขกับสามตัวแรก" จมอยู่ในย่อหน้ายาวด้านบน — ย้ายมาติดการ์ด
                         * "คงเหลือ" เองเป็นบรรทัดรอง (เฉพาะตอนไม่ได้เลือกช่วงวัน ซึ่งเป็น
                         * กรณีเดียวที่คงเหลือคนละที่มากับสามตัวแรก — ไม่แตะวิธีคำนวณ)
                         */}
                        {kpi.id === 'remaining' && dateRange == null ? (
                          <p className="px-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                            ทั้งระบบ ไม่ใช่เฉพาะช่วงที่เลือก
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className={cn(DASH.eyebrow, 'mb-2')}>สถานะทำงาน (นับอัตรา) — กดเพื่อกรอง</p>
                  {/* ใช้การ์ดทรงเดียวกับ "สรุปอัตราในช่วงที่เลือก" ตามที่เจ้าของสั่ง — กวาดตาอ่านง่ายกว่าชิป
                      ครบทุกสถานะเท่าเดิม (ตัวเลข 0 ก็ยังอยู่ ไม่ซ่อน) · กดแล้วเปิดลิสต์ใบขอสถานะนั้นเหมือนเดิม */}
                  {/* เจ้าของสั่ง 10 ส.ค. 2569: "แถวละ 5 จะได้พอดีกัน" และ "ไม่เป็น visual control เลย"
                      → ใส่แถบสัดส่วนเทียบยอดรวมของทุกสถานะ ทำให้กวาดตาแล้วเห็นทันทีว่าอัตรา
                      ไปกองอยู่สถานะไหน ไม่ต้องอ่านเลขทีละใบแล้วเทียบในหัวเอง
                      (การ์ดตัวเดียวกับ KPI ด้านบนอยู่แล้ว — มันรองรับ `progressPercent` มาแต่แรก
                      แค่ไม่เคยถูกส่งค่าให้) */}
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                    {(() => {
                      const list = data.workStatusKpis ?? [];
                      const total = list.reduce((sum, k) => sum + (k.value || 0), 0);
                      return list.map((kpi) => (
                        <DashboardKpiCard
                          key={kpi.id}
                          kpi={kpi}
                          progressPercent={total > 0 ? Math.round((kpi.value / total) * 100) : 0}
                          progressBaseLabel="ของทุกสถานะ"
                          onClick={onKpiClick ? () => onKpiClick(kpi.id, kpi.label, kpi.secondaryCount ?? null) : undefined}
                        />
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* กราฟ ทั้งหมด/ฉุกเฉิน/ล่วงหน้า — วางใต้การ์ด KPI ให้เห็นทันทีโดยไม่ต้องกางแผง
                  (เจ้าของสั่ง 18 ส.ค. 2569) · เลขชุดเดียวกับการ์ด「เข้ามา」 เปลี่ยนตามตัวกรองเอง */}
              {leadKindBreakdown ? (
                <DashboardLeadKindChart
                  breakdown={leadKindBreakdown}
                  scopeLabel={data.activityTrendLabel || data.periodLabel}
                  mismatchNote={leadKindMismatch ?? null}
                  onSliceClick={onLeadKindClick}
                />
              ) : null}

              {/* ต่อจากกราฟชนิดใบขอทันที — คนอ่านเพิ่งเห็นว่า "ฉุกเฉิน/ล่วงหน้ามีกี่ใบ"
                  คำถามถัดไปคือ "แล้วปิดทันไหม" (เจ้าของสั่งตรง 22 ส.ค. 2569) */}
              {slaByLeadKind ? (
                <DashboardSlaByLeadKind
                  table={slaByLeadKind}
                  onCellClick={onSlaCellClick}
                  onRowClick={onSlaRowClick}
                  closedLoaded={slaClosedLoaded}
                  onLoadClosed={onLoadClosedForSla}
                  loadingClosed={closedTotalsLoading}
                />
              ) : null}

              {/* ⚠️ การ์ด "ต้องแก้วันนี้" (DashboardPriorityQueue) ถูกเอาออก 10 ส.ค. 2569 ตามที่เจ้าของสั่ง
                  — ตัวคำนวณ `priorityWorkQueue` ยังอยู่ใน buildDashboardData และยังมีเทสต์คุม
                  เผื่อเอากลับมา · เหลือ "สมการงานค้าง" เต็มความกว้าง */}
              {data.flowView ? (
                <div className="grid gap-3">
                  <DashboardFlowViewCard flow={data.flowView} summary={data.requestControlSummary} />
                </div>
              ) : null}

              {/* แผงรองทั้งหมดยุบเป็นแถวกดขยาย — ข้อมูลครบทุกแผง ไม่มีตัวไหนหาย (กติกา mockup ข้อ 02) */}
              {data.executiveInsights && data.executiveInsights.sentences.length > 0 ? (
                <DashboardExpandablePanel
                  title="สรุปผู้บริหาร"
                  subtitle={`${data.executiveInsights.sentences.length.toLocaleString('th-TH')} ข้อสรุปอัตโนมัติ — กดเพื่อดู`}
                  open={showExecInsights}
                  onOpenChange={setShowExecInsights}
                >
                  <DashboardExecutiveInsightsCard insights={data.executiveInsights} />
                </DashboardExpandablePanel>
              ) : null}
              {data.requestCohortSummary || data.fulfillmentBreakdown ? (
                <DashboardExpandablePanel
                  title="รายละเอียด Control Tower"
                  subtitle="ยอดค้างจากงวดก่อน vs ขอใหม่ · แยกที่มาของยอดหาได้/ปิดครบ — กดเพื่อดู"
                  open={showControlDetail}
                  onOpenChange={setShowControlDetail}
                >
                  <div className="space-y-3">
                    {data.requestCohortSummary ? (
                      <DashboardCohortSummaryCard
                        summary={data.requestCohortSummary}
                        onRowClick={onCohortClick}
                      />
                    ) : null}
                    {data.fulfillmentBreakdown ? (
                      <DashboardClosedBreakdownCard
                        breakdown={data.fulfillmentBreakdown}
                        filledTotal={
                          data.fulfillmentBreakdown.filledSamePeriod + data.fulfillmentBreakdown.filledBacklog
                        }
                        fullyClosedTotal={
                          data.fulfillmentBreakdown.fullyClosedSamePeriod +
                          data.fulfillmentBreakdown.fullyClosedBacklog
                        }
                        onFilledClick={onFilledBreakdownClick}
                        onFullyClosedClick={onFullyClosedBreakdownClick}
                      />
                    ) : null}
                  </div>
                </DashboardExpandablePanel>
              ) : null}

              <DashboardExpandablePanel
                title="ภาระงานตามรหัสไซต์"
                subtitle={
                  activeSiteCount > 0
                    ? `คงเหลือ ${siteOpenTotal.toLocaleString('th-TH')} อัตรา · ${activeSiteCount.toLocaleString('th-TH')} ไซต์ · กดเพื่อดู`
                    : 'กดเพื่อดูรายละเอียด'
                }
                open={showUnitOverview}
                onOpenChange={setShowUnitOverview}
              >
                <DashboardUnitOverviewChart
                  items={data.unitOverview}
                  periodLabel={data.periodLabel}
                  onSiteClick={onSiteClick}
                  hideHeader
                />
              </DashboardExpandablePanel>
              <DashboardExpandablePanel
                title="ภาระงานตามผู้รับผิดชอบ"
                subtitle={
                  data.recruiterOverview.length > 0
                    ? `${data.recruiterOverview.length.toLocaleString('th-TH')} คน · คงเหลือ ${recruiterRemainingTotal.toLocaleString('th-TH')} · กดเพื่อดู`
                    : 'กดเพื่อดูรายละเอียด'
                }
                open={showRecruiterOverview}
                onOpenChange={(open) => {
                  setShowRecruiterOverview(open);
                  if (open) onRecruiterPanelOpen?.();
                }}
              >
                <DashboardDriverOverview
                  items={data.recruiterOverview}
                  closedTotalsLoading={closedTotalsLoading}
                  onRecruiterClick={onRecruiterClick}
                  hideHeader
                  closedTotalsAvailable={closedTotalsAvailable}
                />
              </DashboardExpandablePanel>
              <DashboardExpandablePanel
                title="แนวโน้มรายเดือน"
                subtitle="เข้ามา / ปิดแล้ว / ยกเลิก / คงเหลือ — กดเพื่อดู"
                open={showLifecycle}
                onOpenChange={setShowLifecycle}
              >
                <DashboardChartSection data={data} />
              </DashboardExpandablePanel>
              {/* แผงเสริมท้ายคอลัมน์ (เช่น Rate ผลการโทร Lumos) — เรื่องการโทร ไม่ใช่เลขใบขอ
                  จึงส่งเข้ามาจากข้างนอกแทนการผูกกับ data ของแดชบอร์ด · ไม่โดน filter/dateRange ของหน้า */}
              {extraPanels}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardShell;
