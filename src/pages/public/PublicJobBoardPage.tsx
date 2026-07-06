import React, { useEffect, useState } from 'react';
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import { unitRequestCardSubtitle, unitRequestCardTitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { enrichJobsWithUrgency } from '@/lib/jobUrgency';
import { apiFetch } from '@/lib/apiFetch';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';
import { displayDistrictLine } from '@/lib/displayJobLocation';
import JobBoardFilterBar from '@/components/jobs/JobBoardFilterBar';
import { useJobBoardFilters } from '@/hooks/useJobBoardFilters';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { MapPin, Sparkles, Briefcase, Calendar, Banknote, ExternalLink } from 'lucide-react';

const SOWORK_APPLY_URL =
  (import.meta.env.VITE_SOWORK_APPLY_URL as string | undefined)?.trim() ||
  'https://s.siamrajathanee.dev/u/m82prvg2';

const PublicJobBoardPage: React.FC = () => {
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<JobRequest | null>(null);
  const filters = useJobBoardFilters(jobs);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch('/api/public/jobs?limit=200')
      .then(async (r) => {
        if (!r.ok) throw new Error('fail');
        return r.json() as Promise<JobRequest[]>;
      })
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? enrichJobsWithUrgency(data) : [];
        setJobs(arr);
      })
      .catch(() => {
        if (cancelled) return;
        setJobs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openApply = () => {
    window.open(SOWORK_APPLY_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative border-b border-white/50 bg-gradient-to-b from-blue-100/30 via-transparent to-transparent">
      <div className="mx-auto max-w-6xl px-4 md:px-6 pt-10 pb-4 md:pt-14 md:pb-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            บอร์ดประกาศรับสมัคร
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight">
            ค้นหางานที่เหมาะกับคุณ
          </h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed">
            ดูตำแหน่งจากระบบ So Recruit แบบเรียลไทม์ จากนั้นสมัครผ่านแอป{' '}
            <span className="text-foreground font-medium">SOWORK</span> ตามลิงก์ด้านล่าง
          </p>
        </div>

        <div className="relative z-10">
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
            provinceOptions={filters.provinceOptions}
            districtOptions={filters.districtOptions}
            positionOptions={filters.positionOptions}
            loading={loading}
          />
        </div>

        {loading && (
          <p className="mt-8 text-sm text-muted-foreground animate-pulse">กำลังโหลดประกาศงาน...</p>
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

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pb-12">
          {filters.filtered.map((job) => (
            <Card
              key={job.id}
              className="group jarvis-interactive-card overflow-hidden rounded-[1.5rem] border-white/70 transition-all duration-300 hover:border-blue-300/40"
            >
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {unitRequestCardTitle(job)}
                    </h2>
                    {unitRequestCardSubtitle(job) ? (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{unitRequestCardSubtitle(job)}</p>
                    ) : null}
                    {job.unit_name && job.request_no ? (
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

        <div className="mx-auto max-w-lg pb-16 text-center">
          <p className="text-sm text-muted-foreground mb-3">พร้อมสมัครแล้ว?</p>
          <button
            type="button"
            onClick={openApply}
            className="jarvis-pill-btn inline-flex w-full sm:w-auto px-8 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            ไปที่แอปสมัครงาน SOWORK
            <ExternalLink className="h-4 w-4" />
          </button>
          <p className="mt-3 text-[11px] text-muted-foreground break-all">{SOWORK_APPLY_URL}</p>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md sm:max-w-lg border-border/80">
          <DialogHeader>
            <DialogTitle className="text-left text-lg pr-8">{selected ? unitRequestCardTitle(selected) : ''}</DialogTitle>
            <DialogDescription className="sr-only">
              รายละเอียดตำแหน่งงานสำหรับผู้สมัคร
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
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
              <dl className="grid gap-2 text-xs sm:text-sm">
                <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                  <dt className="text-muted-foreground">สถานที่</dt>
                  <dd className="text-right font-medium text-foreground max-w-[65%]">{selected.location_address}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                  <dt className="text-muted-foreground">อำเภอ / เขต</dt>
                  <dd className="text-right font-medium text-foreground max-w-[65%]">
                    {displayDistrictLine(selected.location_address || '') ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                  <dt className="text-muted-foreground">จังหวัด</dt>
                  <dd className="text-right font-medium text-foreground max-w-[65%]">
                    {inferProvinceFromAddress(selected.location_address || '') ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                  <dt className="text-muted-foreground">รายได้รวม (โดยประมาณ)</dt>
                  <dd className="text-success font-semibold">฿{selected.total_income.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                  <dt className="text-muted-foreground">วันที่ต้องการคน</dt>
                  <dd>{formatYmdDmyBe(selected.required_date)}</dd>
                </div>
                {(selected.age_range_min != null || selected.age_range_max != null) && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                    <dt className="text-muted-foreground">ช่วงอายุ</dt>
                    <dd>
                      {selected.age_range_min ?? '—'} – {selected.age_range_max ?? '—'} ปี
                    </dd>
                  </div>
                )}
                {selected.gender_requirement && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                    <dt className="text-muted-foreground">เพศ</dt>
                    <dd>{selected.gender_requirement}</dd>
                  </div>
                )}
                {selected.vehicle_required && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                    <dt className="text-muted-foreground">รถที่ใช้</dt>
                    <dd>{selected.vehicle_required}</dd>
                  </div>
                )}
                {selected.work_schedule && (
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">เวลาทำงาน</dt>
                    <dd className="text-right max-w-[60%]">{selected.work_schedule}</dd>
                  </div>
                )}
              </dl>
              <button
                type="button"
                onClick={openApply}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
              >
                สมัครผ่าน SOWORK
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicJobBoardPage;
