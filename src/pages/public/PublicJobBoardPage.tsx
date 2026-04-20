import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import { mergeJobSources, getMergedJobsInitial } from '@/lib/mergeJobs';
import { DEMO_JOBS_CHANGED_EVENT, getJobs } from '@/lib/demoStorage';
import { isConfiguredDemoMode } from '@/lib/demoMode';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';
import { displayDistrictLine } from '@/lib/displayJobLocation';
import { districtMatchesFilter } from '@/lib/districtMatch';
import { getDistrictOptionsForProvince } from '@/lib/thaiDistricts';
import { THAI_PROVINCE_NAMES_SORTED } from '@/lib/thaiProvinces';
import LocationFilterSelect from '@/components/public/LocationFilterSelect';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { MapPin, Search, Sparkles, Briefcase, Calendar, Banknote, ExternalLink } from 'lucide-react';

const SOWORK_APPLY_URL =
  (import.meta.env.VITE_SOWORK_APPLY_URL as string | undefined)?.trim() ||
  'https://sowork.glide.page/dl/MapWork';

type PublicFilter = 'all' | 'urgent';

const isPublicVisible = (j: JobRequest) => j.status === 'open' || j.status === 'in_progress';

function normSearch(s: string): string {
  return s.normalize('NFC').toLowerCase().trim();
}

/** ให้คำว่า "กรุงเทพ" / "กทม" ค้นเจองานที่อยู่ กรุงเทพมหานคร */
function jobSearchBlob(j: JobRequest): string {
  const addr = j.location_address || '';
  const prov = inferProvinceFromAddress(addr);
  let extra = '';
  if (prov === 'กรุงเทพมหานคร' || /กรุงเทพ|กทม\.?|bangkok/i.test(addr)) {
    extra = ' กรุงเทพ กรุงเทพฯ กทม กทม. bangkok';
  }
  if (prov) extra += ` ${prov}`;
  return normSearch(
    `${j.unit_name} ${addr} ${JOB_TYPE_LABELS[j.job_type]} ${JOB_CATEGORY_LABELS[j.job_category]} ${j.work_schedule || ''}${extra}`,
  );
}

const PublicJobBoardPage: React.FC = () => {
  const [jobs, setJobs] = useState<JobRequest[]>(getMergedJobsInitial);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [chip, setChip] = useState<PublicFilter>('all');
  const [selected, setSelected] = useState<JobRequest | null>(null);
  const apiJobsRef = useRef<JobRequest[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch('/api/public/jobs')
      .then(async (r) => {
        if (!r.ok) throw new Error('fail');
        return r.json() as Promise<JobRequest[]>;
      })
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        apiJobsRef.current = arr;
        setJobs(isConfiguredDemoMode() ? mergeJobSources(arr, getJobs()) : arr);
      })
      .catch(() => {
        if (cancelled) return;
        apiJobsRef.current = [];
        setJobs(isConfiguredDemoMode() ? mergeJobSources([], getJobs()) : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isConfiguredDemoMode()) return;
    const sync = () => setJobs(mergeJobSources(apiJobsRef.current, getJobs()));
    window.addEventListener(DEMO_JOBS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DEMO_JOBS_CHANGED_EVENT, sync);
  }, []);

  const visible = useMemo(() => {
    return jobs.filter(isPublicVisible);
  }, [jobs]);

  const provinceOptions = THAI_PROVINCE_NAMES_SORTED;

  const districtOptions = useMemo(() => {
    if (!provinceFilter) return [];
    return [...getDistrictOptionsForProvince(provinceFilter)];
  }, [provinceFilter]);

  useEffect(() => {
    if (!districtFilter) return;
    if (!districtOptions.includes(districtFilter)) setDistrictFilter('');
  }, [districtFilter, districtOptions]);

  const filtered = useMemo(() => {
    const q = normSearch(search);
    return visible
      .filter((j) => {
        if (chip === 'urgent') return j.urgency === 'urgent';
        return true;
      })
      .filter((j) => {
        const jobProv = inferProvinceFromAddress(j.location_address);
        if (provinceFilter && jobProv !== provinceFilter) return false;
        if (districtFilter && !districtMatchesFilter(j.location_address, districtFilter)) return false;
        return true;
      })
      .filter((j) => {
        if (!q) return true;
        return jobSearchBlob(j).includes(q);
      });
  }, [visible, search, chip, provinceFilter, districtFilter]);

  const openApply = () => {
    window.open(SOWORK_APPLY_URL, '_blank', 'noopener,noreferrer');
  };

  const onProvinceFilterChange = useCallback((next: string) => {
    setProvinceFilter(next);
    setDistrictFilter('');
  }, []);

  return (
    <div className="relative border-b border-border/40 bg-gradient-to-b from-primary/[0.07] via-background to-background">
      <div className="mx-auto max-w-6xl px-4 md:px-6 pt-10 pb-4 md:pt-14 md:pb-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-4">
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

        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="ค้นหาจากชื่อหน่วยงาน, ที่อยู่, ประเภทงาน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'all' as const, label: 'ทั้งหมด' },
                { id: 'urgent' as const, label: 'ด่วน' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setChip(f.id)}
                className={cn(
                  'rounded-full px-4 py-2 text-xs font-semibold transition-all',
                  chip === f.id
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/80',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <LocationFilterSelect
            label="จังหวัด"
            placeholder="เลือกจังหวัด"
            value={provinceFilter}
            onChange={onProvinceFilterChange}
            options={provinceOptions}
            disabled={loading}
          />
          <LocationFilterSelect
            label="อำเภอ / เขต"
            placeholder={provinceFilter ? 'เลือกอำเภอ/เขต' : 'เลือกจังหวัดก่อน'}
            value={districtFilter}
            onChange={setDistrictFilter}
            options={districtOptions}
            disabled={loading || !provinceFilter}
          />
        </div>

        {loading && (
          <p className="mt-8 text-sm text-muted-foreground animate-pulse">กำลังโหลดประกาศงาน...</p>
        )}

        {!loading && filtered.length === 0 && (
          <div className="mt-12 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="font-medium text-foreground">ยังไม่มีตำแหน่งที่ตรงกับตัวกรอง</p>
            <p className="mt-1 text-sm text-muted-foreground">ลองเปลี่ยนคำค้นหาหรือเลือก &quot;ทั้งหมด&quot;</p>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pb-12">
          {filtered.map((job) => (
            <Card
              key={job.id}
              className="group overflow-hidden border-border/80 bg-card/95 shadow-sm transition-all duration-200 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5"
            >
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {job.unit_name}
                  </h2>
                  {job.urgency === 'urgent' && (
                    <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                      ด่วน
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {JOB_TYPE_LABELS[job.job_type]}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {JOB_CATEGORY_LABELS[job.job_category]}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <p className="flex items-start gap-2 text-xs text-muted-foreground line-clamp-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                  {job.location_address}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                    <Banknote className="h-3.5 w-3.5 text-success" />
                    ฿{job.total_income.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    ต้องการ {job.required_date}
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
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
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
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
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
            <DialogTitle className="text-left text-lg pr-8">{selected?.unit_name}</DialogTitle>
            <DialogDescription className="sr-only">
              รายละเอียดตำแหน่งงานสำหรับผู้สมัคร
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium">
                  {JOB_TYPE_LABELS[selected.job_type]}
                </span>
                <span className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                  {JOB_CATEGORY_LABELS[selected.job_category]}
                </span>
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
                  <dd>{selected.required_date}</dd>
                </div>
                {(selected.age_range_min != null || selected.age_range_max != null) && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                    <dt className="text-muted-foreground">ช่วงอายุ</dt>
                    <dd>
                      {selected.age_range_min ?? '—'} – {selected.age_range_max ?? '—'} ปี
                    </dd>
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
