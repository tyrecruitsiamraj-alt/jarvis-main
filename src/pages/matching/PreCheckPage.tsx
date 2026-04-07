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

const PreCheckPage: React.FC = () => {
  const navigate = useNavigate();
  const [district, setDistrict] = useState('');
  const [radius, setRadius] = useState(10);
  const [jobDetail, setJobDetail] = useState<JobRequest | null>(null);
  const [apiJobs, setApiJobs] = useState<JobRequest[]>([]);
  const [apiClients, setApiClients] = useState<ClientWorkplace[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(() => !isDemoMode());

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

  const filteredJobs = useMemo(() => {
    const allJobs = isDemoMode() ? mergePreCheckJobs() : apiJobs;
    return allJobs
      .filter((j) => j.status !== 'closed' && j.status !== 'cancelled')
      .map((j) => ({
        job: j,
        score: district ? similarityScore(j.location_address, district) : 100,
      }))
      .filter(({ score }) => !district || score >= 30)
      .sort((a, b) => {
        if (a.job.urgency === 'urgent' && b.job.urgency !== 'urgent') return -1;
        if (a.job.urgency !== 'urgent' && b.job.urgency === 'urgent') return 1;
        return b.score - a.score;
      })
      .map(({ job }) => job);
  }, [district, apiJobs]);

  const getClientInfo = (jobName: string): ClientWorkplace | undefined => {
    const list = isDemoMode() ? mockClients : apiClients;
    return list.find((c) => c.name === jobName);
  };

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
            <label className="text-xs font-medium text-muted-foreground mb-1 block">รัศมี (กม.)</label>
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
        {loadingJobs && <div className="text-sm text-muted-foreground">กำลังโหลดรายการงาน...</div>}
        <div className="text-sm text-muted-foreground">
          งานที่เปิดอยู่ใกล้พื้นที่: <span className="text-primary font-semibold">{filteredJobs.length}</span> งาน
        </div>
        <div className="space-y-2">
          {filteredJobs.map((j) => (
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
              <div className="text-xs text-muted-foreground mt-1">
                รายได้: ฿{j.total_income.toLocaleString()} • ต้องการ: {j.required_date}
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
