import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import PageHeader from '@/components/shared/PageHeader';
import JobBoardFilterBar from '@/components/jobs/JobBoardFilterBar';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { useJobBoardFilters } from '@/hooks/useJobBoardFilters';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import { unitRequestCardSubtitle, unitRequestCardTitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { MapPin, Briefcase, Calendar, Banknote, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const RETURN_TO = '/jobs/board';

function staffAssigneeLine(j: JobRequest): string | null {
  const parts = [
    j.opl_name ? `OPL ${j.opl_name}` : null,
    j.recruiter_name ? `สรรหา ${j.recruiter_name}` : null,
    j.screener_name ? `คัดสรร ${j.screener_name}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

const StaffJobBoardPage: React.FC = () => {
  const navigate = useNavigate();
  const { jobs, loading, refreshing, loadError, refetch } = useUnitRequestsFeed();
  const filters = useJobBoardFilters(jobs);

  return (
    <div className="relative">
      <PageHeader
        title="บอร์ดงานเปิดรับ"
        subtitle="มุมมองการ์ดสำหรับเจ้าหน้าที่ — ดูงานที่เปิดรับและไปยังรายละเอียดใบขอ"
        backPath="/"
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            รีเฟรช
          </button>
        }
      />

      <div className="px-4 md:px-6 pb-12">
        <JobBoardFilterBar
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
          subtypeFilter={filters.subtypeFilter}
          onSubtypeFilterChange={filters.setSubtypeFilter}
          provinceOptions={filters.provinceOptions}
          districtOptions={filters.districtOptions}
          positionOptions={filters.positionOptions}
          subtypeOptions={filters.subtypeOptions}
          loading={loading}
          searchPlaceholder="ค้นหาเลขที่ใบขอ, หน่วยงาน, ที่อยู่, ผู้รับผิดชอบ..."
        />

        {loadError && (
          <p className="mt-4 text-sm text-destructive">{loadError}</p>
        )}

        {loading && (
          <p className="mt-8 text-sm text-muted-foreground animate-pulse">กำลังโหลดรายการงาน...</p>
        )}

        {!loading && filters.usedRelatedFallback && filters.search.trim() && (
          <p className="mt-3 text-xs text-muted-foreground">
            ไม่พบผลที่ตรงคำค้นทั้งหมด เลยแสดงงานที่ใกล้เคียงให้แทน
          </p>
        )}

        {!loading && filters.filtered.length === 0 && (
          <div className="mt-12 jarvis-frost rounded-[1.5rem] border-dashed border-white/70 p-10 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="font-medium text-foreground">ยังไม่มีตำแหน่งที่ตรงกับตัวกรอง</p>
            <p className="mt-1 text-sm text-muted-foreground">ลองเปลี่ยนคำค้นหาหรือเลือก &quot;ทั้งหมด&quot;</p>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filters.filtered.map((job) => {
            const assignees = staffAssigneeLine(job);
            return (
              <Card
                key={job.id}
                className="group jarvis-interactive-card overflow-hidden rounded-[1.5rem] border-white/70 transition-all duration-300 hover:border-blue-300/40 cursor-pointer"
                onClick={() => navigateToUnitRequest(job, navigate, { returnTo: RETURN_TO })}
              >
                <CardHeader className="space-y-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {job.request_no ? (
                        <p className="text-[11px] font-mono text-muted-foreground mb-0.5">{job.request_no}</p>
                      ) : null}
                      <h2 className="text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {unitRequestCardTitle(job)}
                      </h2>
                      {unitRequestCardSubtitle(job) ? (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{unitRequestCardSubtitle(job)}</p>
                      ) : null}
                      {job.unit_name ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground/80">{job.unit_name}</p>
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
                  {assignees ? (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      ผู้รับผิดชอบ: {assignees}
                    </p>
                  ) : null}
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
                  <span className="w-full text-center text-xs font-semibold text-blue-600 group-hover:underline">
                    ดูรายละเอียดใบขอ
                  </span>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {!loading && filters.visibleCount > 0 && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            แสดง {filters.filtered.length} จาก {filters.visibleCount} งานที่เปิดรับ
          </p>
        )}
      </div>
    </div>
  );
};

export default StaffJobBoardPage;
