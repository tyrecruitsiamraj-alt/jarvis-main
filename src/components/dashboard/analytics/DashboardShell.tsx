import React, { useState } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import type { DashboardData, DashboardFilters, DashboardKpi, DashboardResponsibleRole, DashboardStatusFilter } from '@/lib/dashboard/types';
import type { UnitRequestFilterState } from '@/hooks/useSiamrajUnitRequestFilters';
import type { DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import DashboardFilterBar from './DashboardFilterBar';
import DashboardKpiCard from './DashboardKpiCard';
import DashboardChartSection from './DashboardChartSection';
import DashboardHeroStrip from './DashboardHeroStrip';
import DashboardUnitOverviewChart from './DashboardUnitOverviewChart';
import DashboardDriverOverview from './DashboardDriverOverview';
import DashboardExpandablePanel from './DashboardExpandablePanel';
import DashboardExecutiveInsightsCard from './DashboardExecutiveInsights';
import DashboardFlowViewCard from './DashboardFlowView';
import DashboardCohortSummaryCard from './DashboardCohortSummary';
import DashboardClosedBreakdownCard from './DashboardClosedBreakdown';
import type { DashboardWorkItem } from '@/lib/dashboard/types';

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
  onCohortClick?: (rowId: string, label: string) => void;
  onFilledBreakdownClick?: (segment: 'same' | 'backlog', label: string) => void;
  onFullyClosedBreakdownClick?: (segment: 'same' | 'backlog', label: string) => void;
  onAgeBucketClick?: (bucket: DashboardData['ageDaysBreakdown'][number]['bucket'], label: string) => void;
  onSiteClick?: (siteCode: string | undefined, label: string) => void;
  /** false = ยังไม่ได้ดึงชุดใบปิด (โหมด "ทั้งหมด") → ช่อง "ปิด" ต่อคนต้องโชว์ "—" ไม่ใช่ 0 */
  closedTotalsAvailable?: boolean;
  /** โหมด "ทั้งหมด" ใบปิดถูกดึงตอนกางแผงผู้รับผิดชอบเท่านั้น (ช่วงเต็มใช้เวลานาน) */
  onRecruiterPanelOpen?: () => void;
  closedTotalsLoading?: boolean;
  onRecruiterClick?: (name: string, role: DashboardResponsibleRole) => void;
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
  onCohortClick,
  onFilledBreakdownClick,
  onFullyClosedBreakdownClick,
  onAgeBucketClick,
  onSiteClick,
  closedTotalsAvailable = true,
  onRecruiterPanelOpen,
  closedTotalsLoading = false,
  onRecruiterClick,
}) => {
  const [showControlDetail, setShowControlDetail] = useState(false);
  const [showUnitOverview, setShowUnitOverview] = useState(false);
  const [showRecruiterOverview, setShowRecruiterOverview] = useState(false);
  const [showExecInsights, setShowExecInsights] = useState(false);
  const [showLifecycle, setShowLifecycle] = useState(false);

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


  return (
    <div className="min-h-full bg-slate-100/60 dark:bg-transparent pb-24">
      <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[1760px] px-3 md:px-5 py-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-slate-100">Request Control Tower</h1>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:min-w-[420px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  value={filters.search}
                  onChange={(e) => onFiltersChange({ search: e.target.value })}
                  placeholder="ค้นหาใบงาน, คน, ปลายทาง..."
                  className="w-full rounded-full border-0 bg-slate-100 dark:bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 shadow-inner placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
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
          <p className="text-sm text-slate-600 dark:text-slate-400 py-8 text-center">กำลังโหลดข้อมูล…</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] gap-5">
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
                      <>
                        <span className="font-medium text-slate-600 dark:text-slate-400">คงเหลือ = อัตราที่ยังต้องหาจากใบเปิดทั้งหมด</span>
                        {' · '}
                        เข้ามา/ปิดแล้ว/ยกเลิก = ของใบที่กรอกในช่วงแนวโน้ม
                      </>
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
                      <DashboardKpiCard
                        key={kpi.id}
                        kpi={kpi}
                        progressPercent={kpiProgress(kpi)}
                        onClick={onKpiClick ? () => onKpiClick(kpi.id, kpi.label, kpi.secondaryCount ?? null) : undefined}
                      />
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
                title="แนวโน้มรายเดือน & Life Cycle"
                subtitle="เข้ามา/ปิดแล้ว/ยกเลิก/คงเหลือ · ลาออก/เปลี่ยนตัว/เพิ่มอัตรา/เปิดไซต์ — กดเพื่อดู"
                open={showLifecycle}
                onOpenChange={setShowLifecycle}
              >
                <DashboardChartSection data={data} />
              </DashboardExpandablePanel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardShell;
