import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { mockJobRequests, mockClients } from '@/data/mockData';
import { MapPin, Search, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { JobRequest, JOB_TYPE_LABELS, JOB_CATEGORY_LABELS, type ClientWorkplace } from '@/types';
import { getJobs } from '@/lib/demoStorage';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';
import { haversineKm } from '@/lib/geo';
import { jobLatLng, parseJobsPayload, mergeJobsForPrecheck } from '@/lib/jobCoords';
import { Input } from '@/components/ui/input';

function mergePreCheckJobs(): JobRequest[] {
  const map = new Map<string, JobRequest>();
  [...mockJobRequests, ...getJobs()].forEach((j) => map.set(j.id, j));
  return [...map.values()];
}

type PreCheckRow = { job: JobRequest; distanceKm: number | null };
type Center = { lat: number; lng: number; label: string };

function isLikelyThailandCoord(lat: number, lng: number): boolean {
  return lat >= 4 && lat <= 22.5 && lng >= 96 && lng <= 106.5;
}

const PreCheckPage: React.FC = () => {
  const navigate = useNavigate();
  const [placeQuery, setPlaceQuery] = useState('');
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [radius, setRadius] = useState(10);
  const [jobDetail, setJobDetail] = useState<JobRequest | null>(null);
  const [apiJobs, setApiJobs] = useState<JobRequest[]>([]);
  const [apiClients, setApiClients] = useState<ClientWorkplace[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(() => !isDemoMode());
  const [jobsLoadError, setJobsLoadError] = useState('');
  const [searching, setSearching] = useState(false);
  const [hint, setHint] = useState('');
  const [appliedCenter, setAppliedCenter] = useState<Center | null>(null);
  const [appliedTextQuery, setAppliedTextQuery] = useState('');

  useEffect(() => {
    if (isDemoMode()) return;
    let cancelled = false;
    setLoadingJobs(true);
    setJobsLoadError('');
    Promise.all([apiFetch('/api/jobs?limit=500'), apiFetch('/api/clients?active_only=1')])
      .then(async ([jobsRes, clientsRes]) => {
        const jobsJson = jobsRes.ok ? ((await jobsRes.json()) as unknown) : [];
        const clientsJson = clientsRes.ok ? ((await clientsRes.json()) as unknown) : [];
        if (cancelled) return;
        if (!jobsRes.ok) {
          setJobsLoadError(
            jobsRes.status === 401
              ? 'เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่เพื่อโหลดรายการงาน'
              : `โหลดรายการงานไม่สำเร็จ (HTTP ${jobsRes.status})`,
          );
          setApiJobs([]);
        } else {
          setApiJobs(parseJobsPayload(jobsJson));
        }
        setApiClients(Array.isArray(clientsJson) ? (clientsJson as ClientWorkplace[]) : []);
      })
      .catch(() => {
        if (!cancelled) {
          setApiJobs([]);
          setApiClients([]);
          setJobsLoadError('โหลดรายการงานไม่สำเร็จ — ลองใหม่อีกครั้ง');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingJobs(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const usingSampleJobsFallback = !isDemoMode() && !loadingJobs && apiJobs.length === 0;

  const allJobs = useMemo(() => {
    if (isDemoMode()) return mergePreCheckJobs();
    return mergeJobsForPrecheck(apiJobs, mergePreCheckJobs());
  }, [apiJobs]);
  const projectOptions = useMemo(
    () => Array.from(new Set(allJobs.map((j) => j.unit_name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allJobs],
  );

  const handleSearch = async () => {
    const text = placeQuery.trim();
    let lat = Number.NaN;
    let lng = Number.NaN;

    if (!text && (!Number.isFinite(Number(latText)) || !Number.isFinite(Number(lngText)))) {
      setHint('กรุณาพิมพ์ที่อยู่ผู้สมัคร');
      return;
    }

    setSearching(true);

    if (text) {
      const geoQuery = /ประเทศไทย|Thailand/i.test(text) ? text : `${text}, Thailand`;
      try {
        const r = await apiFetch(`/api/geocode?address=${encodeURIComponent(geoQuery)}`);
        if (r.ok) {
          const data = (await r.json()) as { lat?: number | string; lng?: number | string; formatted_address?: string };
          const latN = typeof data.lat === 'number' ? data.lat : Number(data.lat);
          const lngN = typeof data.lng === 'number' ? data.lng : Number(data.lng);
          if (Number.isFinite(latN) && Number.isFinite(lngN)) {
            if (isLikelyThailandCoord(latN, lngN)) {
              lat = latN;
              lng = lngN;
              setLatText(String(lat));
              setLngText(String(lng));
              setHint(`เจอพิกัดแล้ว: ${data.formatted_address || text}`);
            } else {
              setHint('พิกัดที่ค้นหาอยู่นอกประเทศไทย เลยสลับเป็นค้นหาจากข้อความแทน');
            }
          }
        }
      } catch {
        /* manual fallback below */
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const mLat = Number(latText);
      const mLng = Number(lngText);
      if (Number.isFinite(mLat) && Number.isFinite(mLng)) {
        lat = mLat;
        lng = mLng;
      }
    }

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      if (!isLikelyThailandCoord(lat, lng)) {
        setHint('พิกัดที่ใช้ค้นหาอยู่นอกประเทศไทย กรุณาระบุที่อยู่ในไทย');
        setSearching(false);
        return;
      }
      setAppliedTextQuery('');
      setAppliedCenter({
        lat,
        lng,
        label: text || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });
      setHint(`เรียงงานใกล้สุดก่อน (ตั้งรัศมี ${radius} กม.)`);
      setSearching(false);
      return;
    }

    if (text) {
      setAppliedCenter(null);
      setAppliedTextQuery(text.toLowerCase());
      setHint('ยังหา lat/lng ไม่ได้ เลยใช้ค้นหาจากข้อความที่อยู่แทน');
      setSearching(false);
      return;
    }

    setHint('กรุณากรอกข้อมูลให้ครบ');
    setSearching(false);
  };

  const precheckResult = useMemo(() => {
    if (!appliedCenter && !appliedTextQuery) {
      return { rows: [] as PreCheckRow[], fallbackFromRadius: false };
    }

    const isOpenish = (j: JobRequest) => j.status === 'open' || j.status === 'in_progress';
    let activeRows = allJobs.filter(isOpenish);
    if (activeRows.length === 0) {
      activeRows = allJobs.filter((j) => j.status !== 'cancelled');
    }
    if (activeRows.length === 0) {
      activeRows = allJobs;
    }
    let rowsBase = activeRows;
    if (projectFilter) {
      const byProject = rowsBase.filter((j) => j.unit_name === projectFilter);
      if (byProject.length > 0) rowsBase = byProject;
    }

    if (appliedTextQuery) {
      const byText = rowsBase.filter((j) =>
        `${j.unit_name} ${j.location_address}`.toLowerCase().includes(appliedTextQuery),
      );
      if (byText.length > 0) rowsBase = byText;
    }

    const rowsForDistance = rowsBase.length > 0 ? rowsBase : activeRows;

    const rowsAll = rowsForDistance.map((j) => {
      let distanceKm: number | null = null;
      const jl = jobLatLng(j);
      if (appliedCenter && jl && isLikelyThailandCoord(jl.lat, jl.lng)) {
        distanceKm = haversineKm(appliedCenter.lat, appliedCenter.lng, jl.lat, jl.lng);
      }
      return { job: j, distanceKm };
    });

    const sortRows = (rows: PreCheckRow[]) =>
      [...rows].sort((a, b) => {
        const da = a.distanceKm;
        const db = b.distanceKm;
        if (da !== null && db !== null) return da - db;
        if (da !== null) return -1;
        if (db !== null) return 1;
        return (a.job.required_date || '').localeCompare(b.job.required_date || '');
      });

    if (!appliedCenter) return { rows: sortRows(rowsAll), fallbackFromRadius: false };

    const rowsInRadius = rowsAll.filter((row) => row.distanceKm === null || row.distanceKm <= radius);
    if (rowsInRadius.length > 0) return { rows: sortRows(rowsInRadius), fallbackFromRadius: false };

    // If radius is too strict and no rows match, show nearest rows anyway.
    return { rows: sortRows(rowsAll), fallbackFromRadius: true };
  }, [appliedCenter, appliedTextQuery, allJobs, projectFilter, radius]);

  const filteredRows = precheckResult.rows;

  useEffect(() => {
    if (precheckResult.fallbackFromRadius) {
      setHint('ไม่เจอผลตรงเงื่อนไขทั้งหมด — แสดงงานที่ใกล้หรือเกี่ยวข้องที่สุดแทน');
    }
  }, [precheckResult.fallbackFromRadius]);

  const getClientInfo = (jobName: string): ClientWorkplace | undefined => {
    const list = isDemoMode() ? mockClients : apiClients;
    return list.find((c) => c.name === jobName);
  };

  const detailDistance = (() => {
    if (!jobDetail || !appliedCenter) return null;
    const jl = jobLatLng(jobDetail);
    if (!jl || !isLikelyThailandCoord(jl.lat, jl.lng)) return null;
    return haversineKm(appliedCenter.lat, appliedCenter.lng, jl.lat, jl.lng);
  })();

  return (
    <div>
      <PageHeader title="Pre-Check" subtitle="พิมพ์ที่อยู่ผู้สมัครแล้วขึ้นงานใกล้สุดก่อน" backPath="/matching" />
      <div className="px-4 md:px-6 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr,1fr] gap-4">
          <section className="glass-card rounded-xl p-4 border border-border space-y-3">
            <h3 className="text-sm font-semibold">Pre-Check Location</h3>
            <p className="text-xs text-muted-foreground">พิมพ์ที่อยู่ผู้สมัคร แล้วกด Search ครั้งเดียว</p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Candidate Address</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder='เช่น "สำโรง", "สนามบินสุวรรณภูมิ"'
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSearch();
                      }
                    }}
                    className="pl-9"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleSearch()}
                  disabled={searching}
                  className="px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 disabled:opacity-60"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Latitude (optional)</label>
                <Input value={latText} onChange={(e) => setLatText(e.target.value)} placeholder="13.6900" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Longitude (optional)</label>
                <Input value={lngText} onChange={(e) => setLngText(e.target.value)} placeholder="100.7501" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Project (Optional)</label>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- All Projects --</option>
                  {projectOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Radius (km)</label>
                <div className="flex gap-1.5">
                  {[5, 10, 15, 20].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRadius(r)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-sm font-medium',
                        radius === r ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </section>

          <section className="glass-card rounded-xl p-4 border border-border space-y-3">
            <h3 className="text-sm font-semibold">Map</h3>
            {appliedCenter ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Pin: {appliedCenter.label}</div>
                <iframe
                  title="Precheck map"
                  src={`https://maps.google.com/maps?q=${appliedCenter.lat},${appliedCenter.lng}&z=13&output=embed`}
                  className="w-full h-56 rounded-lg border border-border"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No map data yet.
                <p className="mt-1 text-xs">Type address and press Search.</p>
              </div>
            )}
          </section>
        </div>

        {loadingJobs && <div className="text-sm text-muted-foreground">Loading jobs...</div>}
        {jobsLoadError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>{jobsLoadError}</span>
            <button
              type="button"
              className="shrink-0 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              onClick={() => {
                if (isDemoMode()) return;
                setJobsLoadError('');
                setLoadingJobs(true);
                void Promise.all([apiFetch('/api/jobs?limit=500'), apiFetch('/api/clients?active_only=1')])
                  .then(async ([jobsRes, clientsRes]) => {
                    if (!jobsRes.ok) {
                      setJobsLoadError(
                        jobsRes.status === 401
                          ? 'เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่เพื่อโหลดรายการงาน'
                          : `โหลดรายการงานไม่สำเร็จ (HTTP ${jobsRes.status})`,
                      );
                      setApiJobs([]);
                    } else {
                      const raw = (await jobsRes.json()) as unknown;
                      setApiJobs(parseJobsPayload(raw));
                      setJobsLoadError('');
                    }
                    const clientsJson = clientsRes.ok ? ((await clientsRes.json()) as unknown) : [];
                    setApiClients(Array.isArray(clientsJson) ? (clientsJson as ClientWorkplace[]) : []);
                  })
                  .catch(() => {
                    setApiJobs([]);
                    setJobsLoadError('โหลดรายการงานไม่สำเร็จ — ลองใหม่อีกครั้ง');
                  })
                  .finally(() => setLoadingJobs(false));
              }}
            >
              Retry load
            </button>
          </div>
        ) : null}
        {usingSampleJobsFallback ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
ยังไม่มีงานจากเซิร์ฟเวอร์ — รวมงานตัวอย่างไว้ในรายการด้านล่างเพื่อให้ค้นหาได้ทันที
          </div>
        ) : null}
        <div className="text-sm text-muted-foreground">
          Suitable projects: <span className="text-primary font-semibold">{filteredRows.length}</span>
        </div>

        <div className="space-y-2">
          {!appliedCenter && !appliedTextQuery && (
            <div className="glass-card rounded-xl p-5 border border-border text-center text-muted-foreground">
              Type candidate address, then press Search once.
            </div>
          )}

          {filteredRows.map(({ job: j, distanceKm }) => (
            <div
              key={j.id}
              role="button"
              tabIndex={0}
              onClick={() => setJobDetail(j)}
              onKeyDown={(e) => e.key === 'Enter' && setJobDetail(j)}
              className="glass-card rounded-xl p-4 border border-border cursor-pointer hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-primary text-sm">{j.unit_name}</div>
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    j.urgency === 'urgent' ? 'bg-destructive/15 text-destructive' : 'bg-info/15 text-info',
                  )}
                >
                  {j.urgency === 'urgent' ? 'Urgent' : 'Advance'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" /> {j.location_address}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                <span>
                  Income: {j.total_income.toLocaleString()} THB • Required: {j.required_date}
                </span>
                {distanceKm !== null ? (
                  <span className="text-foreground font-medium">~{distanceKm.toFixed(1)} km (nearest first)</span>
                ) : appliedCenter ? (
                  <span className="text-warning">No job coordinates</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!jobDetail} onOpenChange={(o) => !o && setJobDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Project Details</DialogTitle>
            <DialogDescription className="sr-only">Project and client details</DialogDescription>
          </DialogHeader>
          {jobDetail &&
            (() => {
              const client = getClientInfo(jobDetail.unit_name);
              return (
                <div className="space-y-3 mt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">{jobDetail.unit_name}</div>
                      <div className="text-xs text-muted-foreground">{jobDetail.location_address}</div>
                    </div>
                  </div>
                  {detailDistance !== null ? (
                    <p className="text-xs text-muted-foreground">
                      Distance from selected point: <span className="font-medium text-foreground">{detailDistance.toFixed(1)} km</span>
                    </p>
                  ) : null}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Job Type</span>
                      <span>{JOB_TYPE_LABELS[jobDetail.job_type as keyof typeof JOB_TYPE_LABELS]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span>{JOB_CATEGORY_LABELS[jobDetail.job_category as keyof typeof JOB_CATEGORY_LABELS]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Urgency</span>
                      <span className={jobDetail.urgency === 'urgent' ? 'text-destructive' : 'text-info'}>
                        {jobDetail.urgency === 'urgent' ? 'Urgent' : 'Advance'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Income</span>
                      <span className="text-success font-medium">{jobDetail.total_income.toLocaleString()} THB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Required Date</span>
                      <span>{jobDetail.required_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Penalty / day</span>
                      <span className="text-destructive">{jobDetail.penalty_per_day.toLocaleString()} THB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recruiter</span>
                      <span>{jobDetail.recruiter_name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Screener</span>
                      <span>{jobDetail.screener_name || '-'}</span>
                    </div>
                    {client && (
                      <>
                        <div className="border-t border-border pt-2 mt-2" />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Contact</span>
                          <span>{client.contact_person}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone</span>
                          <a href={`tel:${client.contact_phone}`} className="text-primary font-medium">
                            {client.contact_phone}
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    {client?.contact_phone && (
                      <a
                        href={`tel:${client.contact_phone}`}
                        className="flex-1 text-center py-2 rounded-lg bg-success text-white text-sm font-medium"
                      >
                        Call Client
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setJobDetail(null);
                        navigate(`/jobs/${jobDetail.id}`);
                      }}
                      className="flex-1 text-center py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                    >
                      View Job
                    </button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PreCheckPage;
