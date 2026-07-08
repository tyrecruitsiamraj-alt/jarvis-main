import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import SearchField from '@/components/shared/SearchField';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { MapPin, Building2, ClipboardCheck, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { JobRequest, JOB_TYPE_LABELS, JOB_CATEGORY_LABELS, type ClientWorkplace } from '@/types';
import { apiFetch } from '@/lib/apiFetch';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { haversineKm } from '@/lib/geo';
import { jobLatLng } from '@/lib/jobCoords';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { unitRequestCardSubtitle, unitRequestCardTitle, unitRequestSearchBlob } from '@/lib/unitRequestDisplay';
import { Input } from '@/components/ui/input';

type PreCheckRow = { job: JobRequest; distanceKm: number | null; score: number };
type Center = { lat: number; lng: number; label: string };
type MatchingSuggestion = {
  score: number;
  level: 'high' | 'medium' | 'low';
  reasons: string[];
  candidate: {
    first_name: string | null;
    last_name: string | null;
    phone_number: string | null;
    age: number | null;
    sex: string | null;
    province_name: string | null;
    district_name: string | null;
    job_name_th: string | null;
    process_status_name: string;
    created_at: string;
    location_label: string | null;
  };
};
type MatchingSuggestionsPayload = {
  criteria: {
    roleHints: string[];
    genderRequirement: string | null;
    ageMin: number | null;
    ageMax: number | null;
  };
  totalCandidates: number;
  suggestions: MatchingSuggestion[];
};
type ParsedBranchDemandItem = {
  org_name: string | null;
  branch_name_raw: string;
  branch_name_clean: string;
  requested_qty: number;
  confidence: number;
};
type ParsedBranchDemandPayload = {
  parser_input: string;
  parsed: {
    org_name: string | null;
    items: ParsedBranchDemandItem[];
    unparsed_segments: string[];
  };
  branch_matches?: Array<{
    branch_name_clean: string;
    branch_name_raw: string;
    requested_qty: number;
    confidence: number;
    matched_count: number;
    suggestions: MatchingSuggestion[];
  }>;
};

function isLikelyThailandCoord(lat: number, lng: number): boolean {
  return lat >= 4 && lat <= 22.5 && lng >= 96 && lng <= 106.5;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

const PreCheckPage: React.FC = () => {
  const navigate = useNavigate();
  const [erpSearchQuery, setErpSearchQuery] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [radius, setRadius] = useState(10);
  const [jobDetail, setJobDetail] = useState<JobRequest | null>(null);
  const [apiClients, setApiClients] = useState<ClientWorkplace[]>([]);
  const { jobs: feedJobs, loading: loadingJobs, loadError: jobsLoadError, refetch: refetchJobs } = useUnitRequestsFeed();
  const [searching, setSearching] = useState(false);
  const [hint, setHint] = useState('');
  const [appliedCenter, setAppliedCenter] = useState<Center | null>(null);
  const [appliedTextQuery, setAppliedTextQuery] = useState('');
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingData, setMatchingData] = useState<MatchingSuggestionsPayload | null>(null);
  const [jobMatchCounts, setJobMatchCounts] = useState<Record<string, number>>({});
  const [branchParseLoading, setBranchParseLoading] = useState(false);
  const [branchParseData, setBranchParseData] = useState<ParsedBranchDemandPayload | null>(null);

  const openCandidatePrefill = (candidate: MatchingSuggestion['candidate']) => {
    const params = new URLSearchParams();
    if (candidate.first_name) params.set('first_name', candidate.first_name);
    if (candidate.last_name) params.set('last_name', candidate.last_name);
    if (candidate.phone_number) params.set('phone', candidate.phone_number);
    if (candidate.age !== null) params.set('age', String(candidate.age));
    if (candidate.sex) params.set('sex', candidate.sex);
    if (candidate.province_name) params.set('province', candidate.province_name);
    if (candidate.district_name) params.set('district', candidate.district_name);
    if (candidate.location_label) params.set('location_label', candidate.location_label);
    if (candidate.job_name_th) params.set('job_name', candidate.job_name_th);
    setJobDetail(null);
    navigate(`/matching/candidates/add?${params.toString()}`);
  };

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/clients?active_only=1')
      .then(async (clientsRes) => {
        const clientsJson = clientsRes.ok ? ((await clientsRes.json()) as unknown) : [];
        if (cancelled) return;
        setApiClients(Array.isArray(clientsJson) ? (clientsJson as ClientWorkplace[]) : []);
      })
      .catch(() => {
        if (!cancelled) setApiClients([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allJobs = feedJobs;
  const projectOptions = useMemo(
    () => Array.from(new Set(allJobs.map((j) => j.unit_name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allJobs],
  );

  const projectSelectOptions = useMemo(
    () => [
      { value: '', label: '— ทุกหน่วยงาน —' },
      ...projectOptions.map((name) => ({ value: name, label: name })),
    ],
    [projectOptions],
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

    const erpQuery = erpSearchQuery.trim().toLowerCase();
    if (erpQuery) {
      const byErpQuery = rowsBase.filter((j) => unitRequestSearchBlob(j).includes(erpQuery));
      rowsBase = byErpQuery;
    }

    if (appliedTextQuery) {
      const byText = rowsBase.filter((j) => unitRequestSearchBlob(j).includes(appliedTextQuery));
      if (byText.length > 0) rowsBase = byText;
    }

    const rowsForDistance = rowsBase.length > 0 ? rowsBase : activeRows;

    const rowsAll = rowsForDistance.map((j) => {
      let distanceKm: number | null = null;
      const jl = jobLatLng(j);
      if (appliedCenter && jl && isLikelyThailandCoord(jl.lat, jl.lng)) {
        distanceKm = haversineKm(appliedCenter.lat, appliedCenter.lng, jl.lat, jl.lng);
      }
      const searchMatched = Boolean(erpQuery || appliedTextQuery);
      const baseScore = (() => {
        if (distanceKm !== null) {
          // ใกล้มากได้คะแนนสูง และให้โบนัสงานด่วนเล็กน้อย
          return clampScore(100 - distanceKm * 4 + (j.urgency === 'urgent' ? 8 : 0));
        }
        if (appliedCenter) {
          return j.urgency === 'urgent' ? 55 : 40;
        }
        if (searchMatched) {
          return j.urgency === 'urgent' ? 85 : 72;
        }
        return j.urgency === 'urgent' ? 80 : 60;
      })();
      return { job: j, distanceKm, score: baseScore };
    });

    const sortRows = (rows: PreCheckRow[]) =>
      [...rows].sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.job.urgency !== b.job.urgency) {
          return a.job.urgency === 'urgent' ? -1 : 1;
        }
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
  }, [appliedCenter, appliedTextQuery, allJobs, erpSearchQuery, projectFilter, radius]);

  const filteredRows = precheckResult.rows;

  useEffect(() => {
    const rowsToFetch = filteredRows.slice(0, 30);
    if (rowsToFetch.length === 0) {
      setJobMatchCounts({});
      return;
    }

    let cancelled = false;
    Promise.all(
      rowsToFetch.map(async ({ job }) => {
        try {
          const r = await apiFetch(`/api/matching/suggestions?jobId=${encodeURIComponent(job.id)}&limit=10`);
          if (!r.ok) return [job.id, 0] as const;
          const data = (await r.json()) as MatchingSuggestionsPayload;
          return [job.id, data.suggestions.length] as const;
        } catch {
          return [job.id, 0] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setJobMatchCounts(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [filteredRows]);

  useEffect(() => {
    if (precheckResult.fallbackFromRadius) {
      setHint('ไม่เจอผลตรงเงื่อนไขทั้งหมด — แสดงงานที่ใกล้หรือเกี่ยวข้องที่สุดแทน');
    }
  }, [precheckResult.fallbackFromRadius]);

  const getClientInfo = (jobName: string): ClientWorkplace | undefined => {
    return apiClients.find((c) => c.name === jobName);
  };

  const detailDistance = (() => {
    if (!jobDetail || !appliedCenter) return null;
    const jl = jobLatLng(jobDetail);
    if (!jl || !isLikelyThailandCoord(jl.lat, jl.lng)) return null;
    return haversineKm(appliedCenter.lat, appliedCenter.lng, jl.lat, jl.lng);
  })();

  useEffect(() => {
    if (!jobDetail) {
      setMatchingLoading(false);
      setMatchingError(null);
      setMatchingData(null);
      setBranchParseLoading(false);
      setBranchParseData(null);
      return;
    }

    let cancelled = false;
    setMatchingLoading(true);
    setMatchingError(null);
    setMatchingData(null);

    apiFetch(`/api/matching/suggestions?jobId=${encodeURIComponent(jobDetail.id)}&limit=10`)
      .then(async (r) => {
        if (!r.ok) {
          const data = (await r.json().catch(() => ({}))) as { error?: string; detail?: string };
          throw new Error(data.detail || data.error || 'โหลดรายชื่อแนะนำไม่สำเร็จ');
        }
        return (await r.json()) as MatchingSuggestionsPayload;
      })
      .then((data) => {
        if (!cancelled) setMatchingData(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setMatchingError(e instanceof Error ? e.message : 'โหลดรายชื่อแนะนำไม่สำเร็จ');
        }
      })
      .finally(() => {
        if (!cancelled) setMatchingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobDetail]);

  useEffect(() => {
    if (!jobDetail) return;
    let cancelled = false;
    setBranchParseLoading(true);
    setBranchParseData(null);

    apiFetch(`/api/matching/parse-branch-demand-job?jobId=${encodeURIComponent(jobDetail.id)}`)
      .then(async (r) => {
        if (!r.ok) return null;
        return (await r.json()) as ParsedBranchDemandPayload;
      })
      .then((data) => {
        if (!cancelled) setBranchParseData(data);
      })
      .finally(() => {
        if (!cancelled) setBranchParseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobDetail]);

  return (
    <div>
      <PageHeader title="Pre-Check" subtitle="พิมพ์ที่อยู่ผู้สมัครแล้วขึ้นงานใกล้สุดก่อน" backPath="/matching" />
      <div className="px-4 md:px-6 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr,1fr] gap-4">
          <section className="glass-card rounded-[1.5rem] p-4 md:p-5 border border-white/70 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/12 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">ค้นหาตำแหน่งผู้สมัคร</h3>
                <p className="text-xs text-muted-foreground">เลือกงานจาก ERP ได้เลย หรือพิมพ์ที่อยู่ผู้สมัครเพื่อเรียงงานใกล้สุดก่อน</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">ค้นหา site / หน่วยงาน / สถานที่ทำงานจาก ERP</label>
              <SearchField
                type="text"
                placeholder='เช่น "กรุงศรี", "พระราม 3", "บางนา", "site A"'
                value={erpSearchQuery}
                onChange={(e) => setErpSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">ที่อยู่ผู้สมัคร</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <SearchField
                  type="text"
                  placeholder='เช่น "สำโรง", "สนามบินสุวรรณภูมิ"'
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSearch();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleSearch()}
                  disabled={searching}
                  className="shrink-0 px-5 py-2.5 jarvis-pill-btn text-sm disabled:opacity-60"
                >
                  {searching ? 'กำลังค้นหา…' : 'ค้นหา'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ละติจูด (ไม่บังคับ)</label>
                <Input value={latText} onChange={(e) => setLatText(e.target.value)} placeholder="13.6900" className="jarvis-soft-field" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ลองจิจูด (ไม่บังคับ)</label>
                <Input value={lngText} onChange={(e) => setLngText(e.target.value)} placeholder="100.7501" className="jarvis-soft-field" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">กรองหน่วยงาน (ไม่บังคับ)</label>
                <SearchableSelect
                  value={projectFilter}
                  onChange={setProjectFilter}
                  options={projectSelectOptions}
                  placeholder="— ทุกหน่วยงาน —"
                  searchPlaceholder="ค้นหาหน่วยงาน..."
                  emptyText="ไม่พบหน่วยงาน"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">รัศมี (กม.)</label>
                <div className="flex flex-wrap gap-1.5">
                  {[5, 10, 15, 20].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRadius(r)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                        radius === r
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white/50 text-muted-foreground border border-white/70 hover:border-blue-300/50',
                      )}
                    >
                      {r} กม.
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {hint ? (
              <p className="text-xs text-muted-foreground rounded-xl bg-white/40 border border-white/70 px-3 py-2">{hint}</p>
            ) : null}
          </section>

          <section className="glass-card rounded-[1.5rem] p-4 md:p-5 border border-white/70 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-500/12 flex items-center justify-center shrink-0">
                <Navigation className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">แผนที่</h3>
                <p className="text-xs text-muted-foreground">ตำแหน่งที่ใช้ค้นหางานใกล้เคียง</p>
              </div>
            </div>
            {appliedCenter ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground rounded-xl bg-white/40 border border-white/70 px-3 py-2">
                  <MapPin className="w-3 h-3 inline mr-1 text-blue-600" />
                  {appliedCenter.label}
                </div>
                <iframe
                  title="แผนที่ Pre-Check"
                  src={`https://maps.google.com/maps?q=${appliedCenter.lat},${appliedCenter.lng}&z=13&output=embed`}
                  className="w-full h-56 md:h-64 rounded-2xl border border-white/70"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/70 bg-white/30 p-8 text-center">
                <MapPin className="w-8 h-8 text-blue-400/50 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">ยังไม่มีตำแหน่งบนแผนที่</p>
                <p className="mt-1 text-xs text-muted-foreground">พิมพ์ที่อยู่ผู้สมัครแล้วกดค้นหา</p>
              </div>
            )}
          </section>
        </div>

        {loadingJobs && <div className="text-sm text-muted-foreground">กำลังโหลดรายการงาน…</div>}
        {jobsLoadError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>{jobsLoadError}</span>
            <button
              type="button"
              className="shrink-0 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              onClick={() => void refetchJobs()}
            >
              โหลดใหม่
            </button>
          </div>
        ) : null}
        <div className="glass-card rounded-[1.5rem] px-4 py-3 border border-white/70 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="text-sm text-muted-foreground">
            {appliedCenter || appliedTextQuery ? 'งานที่ใกล้/เกี่ยวข้อง' : 'งานเปิดจาก ERP'}{' '}
            <span className="text-blue-600 font-bold tabular-nums">{filteredRows.length}</span> รายการ
            {appliedCenter ? (
              <span className="text-muted-foreground"> · รัศมี {radius} กม.</span>
            ) : null}
          </p>
        </div>

        <div className="space-y-3">
          {!appliedCenter && !appliedTextQuery && filteredRows.length > 0 && (
            <div className="glass-card rounded-[1.5rem] p-4 border border-white/70">
              <p className="text-sm font-medium text-foreground">รายการด้านล่างคือใบงานเปิดจาก ERP</p>
              <p className="text-xs text-muted-foreground mt-1">
                เรียงงานด่วนขึ้นก่อน และสามารถกดเข้าไปดูรายละเอียดพร้อมรายชื่อคนที่ระบบแนะนำได้
              </p>
            </div>
          )}

          {!appliedCenter && !appliedTextQuery && filteredRows.length === 0 && (
            <div className="glass-card rounded-[1.5rem] p-8 border border-white/70 text-center">
              <ClipboardCheck className="w-8 h-8 text-amber-500/50 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">ยังไม่พบใบงาน</p>
              <p className="text-xs text-muted-foreground mt-1">ลองค้นหาด้วย site, หน่วยงาน หรือสถานที่ทำงานจาก ERP</p>
            </div>
          )}

          {filteredRows.map(({ job: j, distanceKm, score }) => (
            <div
              key={j.id}
              role="button"
              tabIndex={0}
              onClick={() => setJobDetail(j)}
              onKeyDown={(e) => e.key === 'Enter' && setJobDetail(j)}
              className="glass-card rounded-[1.5rem] p-4 border border-white/70 cursor-pointer hover:border-blue-300/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <div className="font-semibold text-blue-600 text-sm">{unitRequestCardTitle(j)}</div>
                  {unitRequestCardSubtitle(j) ? (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{unitRequestCardSubtitle(j)}</div>
                  ) : null}
                </div>
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    j.urgency === 'urgent' ? 'bg-destructive/15 text-destructive' : 'bg-info/15 text-info',
                  )}
                >
                  {j.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
                </span>
              </div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {appliedCenter
                    ? 'คะแนนงานจากระยะทางและความด่วน'
                    : erpSearchQuery || appliedTextQuery
                      ? 'คะแนนงานจากความเกี่ยวข้องและความด่วน'
                      : 'คะแนนงานเบื้องต้นจากความด่วน'}
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    ตรง {jobMatchCounts[j.id] ?? 0} คน
                  </div>
                  <div className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {score} คะแนน
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" /> {j.location_address}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                <span>
                  Income: {j.total_income.toLocaleString()} THB • Required: {formatYmdDmyBe(j.required_date)}
                </span>
                {distanceKm !== null ? (
                  <span className="text-foreground font-medium">~{distanceKm.toFixed(1)} กม. (ใกล้สุดก่อน)</span>
                ) : appliedCenter ? (
                  <span className="text-warning">งานนี้ไม่มีพิกัด</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!jobDetail} onOpenChange={(o) => !o && setJobDetail(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-foreground">รายละเอียดงาน</DialogTitle>
            <DialogDescription className="sr-only">รายละเอียดงานและหน่วยงาน</DialogDescription>
          </DialogHeader>
          {jobDetail &&
            (() => {
              const client = getClientInfo(jobDetail.unit_name);
              return (
                <div className="space-y-3 mt-2 max-h-[72vh] overflow-y-auto pr-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">{unitRequestCardTitle(jobDetail)}</div>
                      {unitRequestCardSubtitle(jobDetail) ? (
                        <div className="text-xs text-muted-foreground mt-0.5">{unitRequestCardSubtitle(jobDetail)}</div>
                      ) : null}
                      <div className="text-xs text-muted-foreground mt-1">{jobDetail.location_address}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <p className="text-sm font-semibold text-foreground">สถานที่ทำงาน</p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground shrink-0">หน่วยงาน</span>
                        <span className="text-right text-foreground">{jobDetail.unit_name || '-'}</span>
                      </div>
                      {jobDetail.site_code ? (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground shrink-0">Site Code</span>
                          <span className="text-right text-foreground">{jobDetail.site_code}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground shrink-0">ที่อยู่ปฏิบัติงาน</span>
                        <span className="text-right text-foreground">{jobDetail.location_address || '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-3 space-y-2">
                    <p className="text-sm font-semibold text-foreground">แตกสาขาจากข้อความ ERP</p>
                    {branchParseLoading ? (
                      <p className="text-xs text-muted-foreground">กำลังวิเคราะห์ข้อความจากใบงาน…</p>
                    ) : branchParseData?.parsed.items?.length ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          ใช้ข้อความ: {branchParseData.parser_input}
                        </p>
                        <div className="space-y-2">
                          {branchParseData.parsed.items.map((item, idx) => {
                            const branchMatch = branchParseData.branch_matches?.find(
                              (b) =>
                                b.branch_name_clean === item.branch_name_clean &&
                                b.requested_qty === item.requested_qty,
                            );
                            return (
                              <div key={`${item.branch_name_clean}-${idx}`} className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{item.branch_name_clean}</p>
                                    <p className="text-xs text-muted-foreground">ต้นฉบับ: {item.branch_name_raw}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-blue-700">ต้องการ {item.requested_qty} คน</p>
                                    <p className="text-[11px] text-muted-foreground">มั่นใจ {item.confidence}%</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                    ตรง {branchMatch?.matched_count ?? 0} คน
                                  </span>
                                </div>
                                {branchMatch && branchMatch.suggestions.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {branchMatch.suggestions.slice(0, 3).map((suggestion, sidx) => {
                                      const fullName =
                                        [suggestion.candidate.first_name, suggestion.candidate.last_name]
                                          .filter(Boolean)
                                          .join(' ') || 'ไม่ระบุชื่อ';
                                      return (
                                        <div
                                          key={`${item.branch_name_clean}-${fullName}-${sidx}`}
                                          className="rounded-lg border border-white/70 bg-white/70 px-2.5 py-2"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <button
                                              type="button"
                                              onClick={() => openCandidatePrefill(suggestion.candidate)}
                                              className="text-left text-xs font-medium text-blue-700 hover:underline"
                                            >
                                              {fullName}
                                            </button>
                                            <span className="text-[11px] rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                                              {suggestion.score} คะแนน
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-muted-foreground mt-1">
                                            {suggestion.candidate.location_label || 'ไม่ระบุพื้นที่'}
                                            {suggestion.candidate.age !== null ? ` · อายุ ${suggestion.candidate.age}` : ''}
                                          </div>
                                          {suggestion.reasons.length > 0 ? (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                              {suggestion.reasons.slice(0, 3).map((reason) => (
                                                <span
                                                  key={reason}
                                                  className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600"
                                                >
                                                  {reason}
                                                </span>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-muted-foreground">ยังไม่เจอคนที่ตรงกับสาขานี้</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {branchParseData.parsed.unparsed_segments.length > 0 ? (
                          <div className="text-xs text-amber-700 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            ยังแยกไม่สำเร็จบางส่วน: {branchParseData.parsed.unparsed_segments.join(' | ')}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        ยังไม่พบรูปแบบหลายสาขาจากข้อความของใบงานนี้
                      </p>
                    )}
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
                      <span>{formatYmdDmyBe(jobDetail.required_date)}</span>
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
                  <div className="border-t border-border pt-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">คนที่ระบบแนะนำ</p>
                        <p className="text-xs text-muted-foreground">
                          ใช้กติกาเบื้องต้นจากตำแหน่งงาน เพศ อายุ และจังหวัด/อำเภอ
                        </p>
                      </div>
                      {matchingData ? (
                        <span className="text-xs rounded-full bg-blue-50 text-blue-700 px-2 py-1 border border-blue-100">
                          เจอ {matchingData.suggestions.length} / {matchingData.totalCandidates}
                        </span>
                      ) : null}
                    </div>

                    {matchingLoading ? (
                      <div className="text-xs text-muted-foreground">กำลังหารายชื่อที่แนะนำ…</div>
                    ) : matchingError ? (
                      <div className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                        {matchingError}
                      </div>
                    ) : matchingData ? (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground rounded-lg bg-white/40 border border-white/70 px-3 py-2">
                          เงื่อนไข: {matchingData.criteria.roleHints.join(', ') || '—'}
                          {matchingData.criteria.genderRequirement ? ` • เพศ ${matchingData.criteria.genderRequirement}` : ''}
                          {matchingData.criteria.ageMin !== null || matchingData.criteria.ageMax !== null
                            ? ` • อายุ ${matchingData.criteria.ageMin ?? '—'}-${matchingData.criteria.ageMax ?? '—'}`
                            : ''}
                        </div>
                        {matchingData.suggestions.length === 0 ? (
                          <div className="text-xs text-muted-foreground rounded-lg border border-dashed border-white/70 px-3 py-3">
                            ยังไม่เจอคนที่เข้าเงื่อนไขเบื้องต้นสำหรับใบงานนี้
                          </div>
                        ) : (
                          matchingData.suggestions.map((item, idx) => {
                            const fullName = [item.candidate.first_name, item.candidate.last_name].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ';
                            const levelClass =
                              item.level === 'high'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : item.level === 'medium'
                                  ? 'bg-amber-50 text-amber-700 border-amber-100'
                                  : 'bg-slate-50 text-slate-700 border-slate-100';
                            return (
                              <div key={`${fullName}-${idx}`} className="rounded-xl border border-white/70 bg-white/40 px-3 py-3 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => openCandidatePrefill(item.candidate)}
                                      className="text-left text-sm font-medium text-blue-600 hover:underline underline-offset-2"
                                    >
                                      {fullName}
                                    </button>
                                    <p className="text-xs text-muted-foreground">
                                      {item.candidate.job_name_th || 'ไม่ระบุตำแหน่ง'} • {item.candidate.location_label || 'ไม่ระบุพื้นที่'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <div className={cn('inline-flex rounded-full border px-2 py-1 text-xs font-medium', levelClass)}>
                                      {item.score} คะแนน
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                      {item.candidate.process_status_name}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.reasons.map((reason) => (
                                    <span
                                      key={reason}
                                      className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700"
                                    >
                                      {reason}
                                    </span>
                                  ))}
                                </div>
                                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                                  {item.candidate.phone_number ? <span>โทร: {item.candidate.phone_number}</span> : null}
                                  {item.candidate.age !== null ? <span>อายุ: {item.candidate.age}</span> : null}
                                  {item.candidate.sex ? <span>เพศ: {item.candidate.sex}</span> : null}
                                </div>
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => openCandidatePrefill(item.candidate)}
                                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                  >
                                    ดู/ลงข้อมูลต่อ
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    ) : null}
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
                      className="flex-1 text-center py-2 jarvis-pill-btn text-sm font-medium"
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
