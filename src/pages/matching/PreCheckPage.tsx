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

const normalizeThaiText = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/^เขต/, '')
    .replace(/^อำเภอ/, '')
    .replace(/^แขวง/, '')
    .replace(/^ตำบล/, '');

function mergePreCheckJobs(): JobRequest[] {
  const map = new Map<string, JobRequest>();
  [...mockJobRequests, ...getJobs()].forEach((j) => map.set(j.id, j));
  return [...map.values()];
}

const similarityScore = (source: string, query: string) => {
  const s = normalizeThaiText(source);
  const q = normalizeThaiText(query);
  if (!q) return 100;
  if (s.includes(q)) return 100;
  const tokens = s.split(/[,/|\s-]+/).map((t) => t.trim()).filter(Boolean);
  for (const t of tokens) {
    if (t.includes(q) || q.includes(t)) return 95;
    if (q.length >= 2 && t.startsWith(q)) return 92;
  }
  let score = 0;
  const sourceParts = s.split(/[,/|-]/).map((p) => p.trim()).filter(Boolean);
  for (const part of sourceParts) {
    if (part.includes(q) || q.includes(part)) score = Math.max(score, 85);
    let matchedChars = 0;
    for (const ch of [...q]) {
      if (part.includes(ch)) matchedChars++;
    }
    if (q.length > 0) score = Math.max(score, Math.round((matchedChars / q.length) * 60));
  }
  return score;
};

type PreCheckRow = { job: JobRequest; distanceKm: number | null };

const PreCheckPage: React.FC = () => {
  const navigate = useNavigate();
  const [district, setDistrict] = useState('');
  const [radius, setRadius] = useState(10);
  const [jobDetail, setJobDetail] = useState<JobRequest | null>(null);
  const [apiJobs, setApiJobs] = useState<JobRequest[]>([]);
  const [apiClients, setApiClients] = useState<ClientWorkplace[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(() => !isDemoMode());
  const [centerLat, setCenterLat] = useState<number | null>(null);
  const [centerLng, setCenterLng] = useState<number | null>(null);
  const [geoHint, setGeoHint] = useState<string>('');

  useEffect(() => {
    if (isDemoMode()) return;
    let cancelled = false;
    setLoadingJobs(true);
    Promise.all([apiFetch('/api/jobs?limit=500'), apiFetch('/api/clients?active_only=1')])
      .then(async ([jobsRes, clientsRes]) => {
        const jobsJson = jobsRes.ok ? ((await jobsRes.json()) as unknown) : [];
        const clientsJson = clientsRes.ok ? ((await clientsRes.json()) as unknown) : [];
        if (cancelled) return;
        setApiJobs(Array.isArray(jobsJson) ? jobsJson : []);
        setApiClients(Array.isArray(clientsJson) ? (clientsJson as ClientWorkplace[]) : []);
      })
      .catch(() => {
        if (!cancelled) {
          setApiJobs([]);
          setApiClients([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingJobs(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isDemoMode()) {
      setCenterLat(null);
      setCenterLng(null);
      setGeoHint('');
      return;
    }
    const q = district.trim();
    if (!q) {
      setCenterLat(null);
      setCenterLng(null);
      setGeoHint('');
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setGeoHint('กำลังหาพิกัดจาก Google…');
        try {
          const r = await apiFetch(`/api/geocode?address=${encodeURIComponent(`${q}, Thailand`)}`);
          if (!r.ok) {
            if (r.status === 503) {
              setGeoHint('ยังไม่ตั้ง GOOGLE_MAPS_API_KEY — ใช้แค่ค้นหาจากข้อความที่อยู่ (รัศมีไม่ทำงาน)');
            } else {
              setGeoHint('หาพิกัดไม่สำเร็จ — ใช้แค่ค้นหาข้อความ');
            }
            setCenterLat(null);
            setCenterLng(null);
            return;
          }
          const data = (await r.json()) as { lat?: number; lng?: number; formatted_address?: string };
          if (typeof data.lat !== 'number' || typeof data.lng !== 'number') {
            setGeoHint('ไม่พบพิกัดสำหรับคำนี้');
            setCenterLat(null);
            setCenterLng(null);
            return;
          }
          setCenterLat(data.lat);
          setCenterLng(data.lng);
          setGeoHint(
            `จุดอ้างอิง: ${data.formatted_address || q} — ระยะทางเป็นเส้นตรงบนโลก (ไม่ใช่ระยะขับรถ) ภายในรัศมี ${radius} กม.`,
          );
        } catch {
          setGeoHint('เครือข่ายผิดพลาด — ใช้แค่ค้นหาข้อความ');
          setCenterLat(null);
          setCenterLng(null);
        }
      })();
    }, 450);
    return () => window.clearTimeout(t);
  }, [district, radius]);

  const filteredRows = useMemo((): PreCheckRow[] => {
    const allJobs = isDemoMode() ? mergePreCheckJobs() : apiJobs;
    const open = allJobs.filter((j) => j.status !== 'closed' && j.status !== 'cancelled');

    const textMatched = open
      .map((j) => ({
        job: j,
        score: district.trim() ? similarityScore(j.location_address, district) : 100,
      }))
      .filter(({ score }) => !district.trim() || score >= 30)
      .map(({ job }) => job);

    const withDist: PreCheckRow[] = textMatched.map((j) => {
      let distanceKm: number | null = null;
      if (
        centerLat !== null &&
        centerLng !== null &&
        typeof j.lat === 'number' &&
        typeof j.lng === 'number'
      ) {
        distanceKm = haversineKm(centerLat, centerLng, j.lat, j.lng);
      }
      return { job: j, distanceKm };
    });

    let rows = withDist;
    if (centerLat !== null && centerLng !== null) {
      rows = withDist.filter(
        (row) => row.distanceKm === null || row.distanceKm <= radius,
      );
    }

    rows.sort((a, b) => {
      if (a.job.urgency === 'urgent' && b.job.urgency !== 'urgent') return -1;
      if (a.job.urgency !== 'urgent' && b.job.urgency === 'urgent') return 1;
      const da = a.distanceKm;
      const db = b.distanceKm;
      if (da !== null && db !== null) return da - db;
      if (da !== null) return -1;
      if (db !== null) return 1;
      return 0;
    });

    return rows;
  }, [district, apiJobs, centerLat, centerLng, radius]);

  const getClientInfo = (jobName: string): ClientWorkplace | undefined => {
    const list = isDemoMode() ? mockClients : apiClients;
    return list.find((c) => c.name === jobName);
  };

  const detailDistance =
    jobDetail && centerLat !== null && centerLng !== null && jobDetail.lat != null && jobDetail.lng != null
      ? haversineKm(centerLat, centerLng, jobDetail.lat, jobDetail.lng)
      : null;

  return (
    <div>
      <PageHeader title="Pre-Check" subtitle="เช็กงานใกล้ผู้สมัครใหม่" backPath="/matching" />
      <div className="px-4 md:px-6 space-y-4">
        <div className="glass-card rounded-xl p-4 border border-border space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">พิมพ์อำเภอ / เขต</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="เช่น บางนา, สีลม, จตุจักร..."
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">รัศมี (กม.) — ใช้เมื่อหาพิกัดได้</label>
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
          {geoHint ? <p className="text-[11px] text-muted-foreground leading-snug">{geoHint}</p> : null}
        </div>
        {loadingJobs && <div className="text-sm text-muted-foreground">กำลังโหลดรายการงาน...</div>}
        <div className="text-sm text-muted-foreground">
          งานที่ตรงเงื่อนไข: <span className="text-primary font-semibold">{filteredRows.length}</span> งาน
        </div>
        <div className="space-y-2">
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
                  {j.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" /> {j.location_address}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                <span>
                  รายได้: ฿{j.total_income.toLocaleString()} • ต้องการ: {j.required_date}
                </span>
                {distanceKm !== null ? (
                  <span className="text-foreground font-medium">~{distanceKm.toFixed(1)} กม. (เส้นตรง)</span>
                ) : centerLat !== null ? (
                  <span className="text-warning">ไม่มีพิกัดงาน — แสดงเพราะข้อความตรง</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Dialog open={!!jobDetail} onOpenChange={(o) => !o && setJobDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">รายละเอียดหน่วยงาน</DialogTitle>
            <DialogDescription className="sr-only">รายละเอียดงานและลูกค้า</DialogDescription>
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
                      ระยะประมาณจากจุดค้นหา: <span className="font-medium text-foreground">{detailDistance.toFixed(1)} กม.</span> (เส้นตรงบนพื้นผิวโลก ไม่ใช่เส้นทางรถ)
                    </p>
                  ) : null}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ลักษณะงาน</span>
                      <span>{JOB_TYPE_LABELS[jobDetail.job_type as keyof typeof JOB_TYPE_LABELS]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ประเภท</span>
                      <span>{JOB_CATEGORY_LABELS[jobDetail.job_category as keyof typeof JOB_CATEGORY_LABELS]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ความเร่งด่วน</span>
                      <span className={jobDetail.urgency === 'urgent' ? 'text-destructive' : 'text-info'}>
                        {jobDetail.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">รายได้</span>
                      <span className="text-success font-medium">฿{jobDetail.total_income.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">วันที่ต้องการ</span>
                      <span>{jobDetail.required_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ค่าปรับ/วัน</span>
                      <span className="text-destructive">฿{jobDetail.penalty_per_day.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">สรรหา</span>
                      <span>{jobDetail.recruiter_name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">คัดสรร</span>
                      <span>{jobDetail.screener_name || '-'}</span>
                    </div>
                    {client && (
                      <>
                        <div className="border-t border-border pt-2 mt-2" />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ผู้ติดต่อ</span>
                          <span>{client.contact_person}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">โทร</span>
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
                        📞 โทรลูกค้า
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
                      ดูรายละเอียดงาน
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
