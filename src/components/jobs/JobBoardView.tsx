import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import { jobBoardCardTitle, unitRequestCardSubtitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { extractJobSubtypeLabel } from '@/lib/siamrajUnitFilters';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { inferProvinceFromAddress, inferSubdistrictFromAddress } from '@/lib/parseThaiJobAddress';
import { displayDistrictLine } from '@/lib/displayJobLocation';
import { resolveApplyPositionPreset } from '@/lib/jobBoardPositionPreset';
import JobBoardTopFilters from '@/components/jobs/JobBoardTopFilters';
import { useJobBoardFilters } from '@/hooks/useJobBoardFilters';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { MapPin, Sparkles, Briefcase, Calendar, Banknote, ExternalLink, RefreshCw, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOWORK_APPLY_URL =
  (import.meta.env.VITE_SOWORK_APPLY_URL as string | undefined)?.trim() ||
  'https://s.siamrajathanee.dev/u/m82prvg2';

function staffAssigneeLine(j: JobRequest): string | null {
  const parts = [
    j.opl_name ? `OPL ${j.opl_name}` : null,
    j.recruiter_name ? `สรรหา ${j.recruiter_name}` : null,
    j.screener_name ? `คัดสรร ${j.screener_name}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export type JobBoardViewProps = {
  jobs: JobRequest[];
  loading: boolean;
  loadError?: string | null;
  variant?: 'public' | 'staff';
  searchPlaceholder?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  detailReturnTo?: string;
};

const JobBoardView: React.FC<JobBoardViewProps> = ({
  jobs,
  loading,
  loadError,
  variant = 'public',
  searchPlaceholder,
  onRefresh,
  refreshing,
  detailReturnTo = '/jobs/board',
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<JobRequest | null>(null);
  const positionPreset = useMemo(
    () => (variant === 'public' ? resolveApplyPositionPreset(searchParams.get('pos')) : null),
    [variant, searchParams],
  );
  const filters = useJobBoardFilters(jobs, {
    initialPosition: positionPreset?.positionFilter,
    lockPosition: positionPreset?.locked,
    drivingPositionGroup: positionPreset?.isDrivingGroup,
  });
  const isStaff = variant === 'staff';

  const openApply = () => {
    window.open(SOWORK_APPLY_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative bg-gradient-to-b from-blue-100/35 via-blue-50/10 to-transparent">
      <div className="jarvis-page-orb -top-10 right-0 h-48 w-48 opacity-25" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-4 md:px-6 pt-8 pb-6 md:pt-12 md:pb-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              {isStaff ? 'บอร์ดงานเปิดรับ · เจ้าหน้าที่' : 'บอร์ดประกาศรับสมัคร'}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight">
              ค้นหางานที่เหมาะกับคุณ
            </h1>
            {!isStaff ? (
              <p className="mt-2.5 text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl">
                เลือกตำแหน่งที่สนใจ แล้วสมัครผ่านแอป{' '}
                <span className="font-medium text-foreground">SOWORK</span>
              </p>
            ) : null}
          </div>
          {isStaff && onRefresh ? (
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={loading || refreshing}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-white/80 bg-white/70 px-4 py-2.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-white disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              รีเฟรชข้อมูล
            </button>
          ) : null}
        </div>

        <JobBoardTopFilters
          search={filters.search}
          onSearchChange={filters.setSearch}
          chip={filters.chip}
          onChipChange={filters.setChip}
          provinceFilter={filters.provinceFilter}
          onProvinceFilterChange={filters.onProvinceFilterChange}
          districtFilter={filters.districtFilter}
          onDistrictFilterChange={filters.setDistrictFilter}
          positionFilter={filters.positionFilter}
          onPositionFilterChange={filters.setPositionFilter}
          lockPosition={filters.lockPosition}
          subtypeFilter={filters.subtypeFilter}
          onSubtypeFilterChange={filters.setSubtypeFilter}
          provinceOptions={filters.provinceOptions}
          districtOptions={filters.districtOptions}
          positionOptions={filters.positionOptions}
          subtypeOptions={filters.subtypeOptions}
          loading={loading}
          searchPlaceholder={searchPlaceholder}
          resultCount={loading ? undefined : filters.filtered.length}
          totalCount={loading ? undefined : filters.visibleCount}
        />

        {loadError ? <p className="mt-4 text-sm text-destructive">{loadError}</p> : null}

        {loading && (
          <p className="mt-10 text-sm text-muted-foreground animate-pulse text-center">กำลังโหลดประกาศงาน...</p>
        )}

        {!loading && filters.usedRelatedFallback && filters.search.trim() && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            ไม่พบผลที่ตรงคำค้นทั้งหมด — แสดงงานที่ใกล้เคียงแทน
          </p>
        )}

        {!loading && filters.filtered.length === 0 && (
          <div className="mt-10 jarvis-frost rounded-[1.5rem] border border-dashed border-white/70 p-10 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="font-medium text-foreground">ยังไม่มีตำแหน่งที่ตรงกับตัวกรอง</p>
            <p className="mt-1 text-sm text-muted-foreground">ลองเปลี่ยนคำค้นหาหรือกด &quot;ทั้งหมด&quot;</p>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 pb-10">
          {filters.filtered.map((job) => (
            <Card
              key={job.id}
              className="group jarvis-interactive-card overflow-hidden rounded-[1.5rem] border-white/70 transition-all duration-300 hover:border-blue-300/40"
            >
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {jobBoardCardTitle(job)}
                    </h2>
                    {unitRequestCardSubtitle(job) ? (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{unitRequestCardSubtitle(job)}</p>
                    ) : null}
                    {isStaff && job.request_no?.trim() ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/80 font-mono">{job.request_no.trim()}</p>
                    ) : null}
                  </div>
                  {job.urgency === 'urgent' && (
                    <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                      ด่วน
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {publicJobPositionLabel(job)}
                  </span>
                  {job.job_description_code_1 && job.job_type ? (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {JOB_TYPE_LABELS[job.job_type]}
                    </span>
                  ) : (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {JOB_CATEGORY_LABELS[job.job_category]}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <p className="flex items-start gap-2 text-xs text-muted-foreground line-clamp-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600/70" />
                  {job.location_address}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                    <Banknote className="h-3.5 w-3.5 text-success" />
                    ฿{job.total_income.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    ต้องการ {formatYmdDmyBe(job.required_date)}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/60 bg-muted/20 pt-3">
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(job)}
                    className="flex-1 rounded-lg border border-border bg-background py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    รายละเอียด
                  </button>
                  <button
                    type="button"
                    onClick={openApply}
                    className="jarvis-pill-btn flex-1 py-2.5 text-xs font-semibold"
                  >
                    สมัคร SOWORK
                    <ExternalLink className="h-3.5 w-3.5 opacity-90" />
                  </button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mx-auto max-w-md pb-14 pt-2 text-center">
          <div className="jarvis-frost rounded-2xl border border-white/70 px-6 py-8">
            <p className="text-sm font-medium text-foreground">พร้อมสมัครแล้ว?</p>
            <p className="mt-1 text-xs text-muted-foreground">เปิดแอป SOWORK เพื่อส่งใบสมัคร</p>
            <button
              type="button"
              onClick={openApply}
              className="jarvis-pill-btn mt-5 inline-flex w-full justify-center px-8 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              ไปที่แอปสมัครงาน SOWORK
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="flex max-h-[min(92dvh,820px)] w-[min(calc(100vw-1.25rem),32rem)] max-w-none flex-col gap-0 overflow-hidden border-border/80 p-0">
          <DialogHeader className="shrink-0 border-b border-border/50 px-5 pb-3 pt-5 text-left">
            <DialogTitle className="pr-8 text-base font-semibold leading-snug sm:text-lg break-words">
              {selected ? jobBoardCardTitle(selected) : ''}
            </DialogTitle>
            <DialogDescription className="sr-only">
              รายละเอียดตำแหน่งงาน
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 text-sm">
                <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium">
                  {publicJobPositionLabel(selected)}
                </span>
                {selected.job_description_code_1 ? (
                  <span className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                    {JOB_TYPE_LABELS[selected.job_type]}
                  </span>
                ) : (
                  <span className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                    {JOB_CATEGORY_LABELS[selected.job_category]}
                  </span>
                )}
                {selected.urgency === 'urgent' && (
                  <span className="rounded-lg bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
                    รับด่วน
                  </span>
                )}
              </div>
              <dl className="grid gap-0 text-xs sm:text-sm">
                {isStaff && selected.request_no ? (
                  <div className="border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">เลขที่ใบขอ</dt>
                    <dd className="mt-0.5 font-mono font-medium text-foreground">{selected.request_no}</dd>
                  </div>
                ) : null}
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">สถานที่</dt>
                  <dd className="mt-0.5 font-medium leading-relaxed text-foreground break-words">
                    {selected.location_address}
                  </dd>
                </div>
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">ตำบล / แขวง</dt>
                  <dd className="mt-0.5 font-medium text-foreground break-words">
                    {inferSubdistrictFromAddress(selected.location_address || '') ?? '—'}
                  </dd>
                </div>
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">อำเภอ / เขต</dt>
                  <dd className="mt-0.5 font-medium text-foreground break-words">
                    {displayDistrictLine(selected.location_address || '') ?? '—'}
                  </dd>
                </div>
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">จังหวัด</dt>
                  <dd className="mt-0.5 font-medium text-foreground break-words">
                    {inferProvinceFromAddress(selected.location_address || '') ?? '—'}
                  </dd>
                </div>
                {extractJobSubtypeLabel(selected) !== 'ไม่ระบุ' ? (
                  <div className="border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">ลักษณะงานย่อย</dt>
                    <dd className="mt-0.5 font-medium text-foreground break-words">
                      {extractJobSubtypeLabel(selected)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">รายได้รวม (โดยประมาณ)</dt>
                  <dd className="text-success font-semibold">฿{selected.total_income.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">วันที่ต้องการคน</dt>
                  <dd>{formatYmdDmyBe(selected.required_date)}</dd>
                </div>
                {(selected.age_range_min != null || selected.age_range_max != null) && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">ช่วงอายุ</dt>
                    <dd>
                      {selected.age_range_min ?? '—'} – {selected.age_range_max ?? '—'} ปี
                    </dd>
                  </div>
                )}
                {selected.gender_requirement && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">เพศ</dt>
                    <dd>{selected.gender_requirement}</dd>
                  </div>
                )}
                {selected.vehicle_required && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">รถที่ใช้</dt>
                    <dd className="text-right break-words">{selected.vehicle_required}</dd>
                  </div>
                )}
                {selected.work_schedule && (
                  <div className="border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">เวลาทำงาน</dt>
                    <dd className="mt-0.5 break-words">{selected.work_schedule}</dd>
                  </div>
                )}
                {isStaff && staffAssigneeLine(selected) ? (
                  <div className="py-2.5">
                    <dt className="text-muted-foreground">ผู้รับผิดชอบ</dt>
                    <dd className="mt-0.5 font-medium leading-relaxed text-foreground break-words">
                      {staffAssigneeLine(selected)}
                    </dd>
                  </div>
                ) : null}
              </dl>
              </div>
              <div className="flex shrink-0 flex-col gap-2 border-t border-border/50 px-5 py-4">
                {isStaff ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      navigateToUnitRequest(selected, navigate, { returnTo: detailReturnTo });
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold text-foreground hover:bg-secondary"
                  >
                    <FileText className="h-4 w-4" />
                    เปิดใบขอในระบบ
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openApply}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  สมัครผ่าน SOWORK
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobBoardView;
