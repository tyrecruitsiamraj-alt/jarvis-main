import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { formatCandidateDisplayName } from '@/lib/formatCandidateName';
import { Phone, MapPin, User, Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Candidate, CANDIDATE_STATUS_LABELS } from '@/types';
import { useDemoAwareJobs } from '@/hooks/useDemoAwareJobs';
import { useDemoAwareCandidates } from '@/hooks/useDemoAwareCandidates';
import { haversineKm } from '@/lib/geo';

type CandidateWithMatchScore = Candidate & { distance: number | null; matchScore: number };

const radiusOptions = [10, 15, 20];

const MatchingPage: React.FC = () => {
  const navigate = useNavigate();
  const { jobs, loading: loadingJobs } = useDemoAwareJobs();
  const { candidates, loading: loadingCandidates } = useDemoAwareCandidates();
  const [selectedJob, setSelectedJob] = useState('');
  const [radius, setRadius] = useState(15);
  const [statusFilter, setStatusFilter] = useState<string>('inprocess');
  const [candidateDetail, setCandidateDetail] = useState<CandidateWithMatchScore | null>(null);

  useEffect(() => {
    if (jobs.length === 0) return;
    setSelectedJob((prev) => {
      if (prev && jobs.some((j) => j.id === prev)) return prev;
      return jobs[0].id;
    });
  }, [jobs]);

  const job = jobs.find((j) => j.id === selectedJob);

  const getCandidatesInRadius = () => {
    return candidates
      .filter((c) => statusFilter === 'all' || c.status === statusFilter)
      .map((c) => {
        const dist =
          job && c.lat != null && c.lng != null && job.lat != null && job.lng != null
            ? haversineKm(job.lat, job.lng, c.lat, c.lng)
            : null;
        const distRounded = dist !== null ? Math.round(dist * 10) / 10 : null;
        const matchScore =
          dist !== null
            ? Math.max(0, Math.min(100, Math.round(100 - dist * 3 - c.risk_percentage)))
            : Math.max(0, Math.min(55, Math.round(55 - c.risk_percentage)));
        return { ...c, distance: distRounded, matchScore };
      })
      .filter((c) => c.distance === null || c.distance <= radius)
      .sort((a, b) => b.matchScore - a.matchScore);
  };

  const matched = getCandidatesInRadius();

  const jobOptions = useMemo(
    () =>
      jobs.map((j) => ({
        value: j.id,
        label: j.unit_name,
        keywords: [j.location_address, j.job_type, j.job_category].filter(Boolean).join(' '),
      })),
    [jobs],
  );

  return (
    <div>
      <PageHeader title="Matching" subtitle="จับคู่ผู้สมัครกับงาน" backPath="/matching" />
      <div className="px-4 md:px-6 space-y-4">
        {(loadingJobs || loadingCandidates) && (
          <div className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</div>
        )}
        <div className="glass-card rounded-[1.5rem] p-4 md:p-5 border border-white/70 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/12 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">ตั้งค่าการจับคู่</h2>
              <p className="text-xs text-muted-foreground">เลือกงาน รัศมี และสถานะผู้สมัคร</p>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">หน่วยงาน / งาน</label>
            <SearchableSelect
              value={selectedJob}
              onChange={setSelectedJob}
              options={jobOptions}
              placeholder={jobs.length === 0 ? 'ไม่มีงาน' : 'เลือกหน่วยงาน / งาน'}
              searchPlaceholder="ค้นหาหน่วยงาน..."
              emptyText="ไม่พบงาน"
              disabled={jobs.length === 0}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">รัศมี (กม.)</label>
              <div className="flex flex-wrap gap-1.5">
                {radiusOptions.map((r) => (
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
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะผู้สมัคร</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="jarvis-soft-field"
              >
                <option value="inprocess">กำลังดำเนินการ</option>
                <option value="all">ทั้งหมด</option>
                <option value="waiting_to_start">รอเริ่มงาน</option>
                <option value="no_job">ไม่มีงาน</option>
              </select>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-[1.5rem] px-4 py-3 border border-white/70 flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="text-sm text-muted-foreground">
            พบผู้สมัคร{' '}
            <span className="text-blue-600 font-bold tabular-nums">{matched.length}</span> คน
            <span className="text-muted-foreground"> · รัศมี {radius} กม.</span>
            {job ? (
              <span className="hidden sm:inline text-muted-foreground"> · {job.unit_name}</span>
            ) : null}
          </p>
        </div>

        <div className="space-y-3">
          {matched.length === 0 && !loadingJobs && !loadingCandidates ? (
            <div className="glass-card rounded-[1.5rem] p-8 border border-white/70 text-center text-muted-foreground">
              <Search className="w-8 h-8 text-blue-400/60 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">ไม่พบผู้สมัครในรัศมีที่เลือก</p>
              <p className="text-xs mt-1">ลองขยายรัศมีหรือเปลี่ยนสถานะผู้สมัคร</p>
            </div>
          ) : null}
          {matched.map((c) => (
            <div key={c.id} className="glass-card rounded-[1.5rem] p-4 border border-white/70 hover:border-blue-300/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setCandidateDetail(c)}
                  className="font-semibold text-blue-600 text-sm hover:underline text-left"
                >
                  {formatCandidateDisplayName(c)}
                </button>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-bold',
                      c.matchScore >= 70 ? 'text-success' : c.matchScore >= 40 ? 'text-warning' : 'text-destructive',
                    )}
                  >
                    {c.matchScore}%
                  </span>
                  <StatusBadge status={c.status} type="candidate" />
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{' '}
                  {c.distance !== null ? `${c.distance} กม. (เส้นตรง)` : 'ไม่มีพิกัด'}
                </span>
                <span>อายุ {c.age} ปี</span>
                <span>Risk: {c.risk_percentage}%</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${c.phone}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs"
                >
                  <Phone className="w-3 h-3" /> โทร
                </a>
                <button
                  type="button"
                  onClick={() => navigate(`/matching/candidates/${c.id}`)}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/12 text-blue-600 text-xs"
                >
                  ดูรายละเอียด
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-white/50 border border-white/70 text-muted-foreground text-xs hover:border-blue-300/50"
                >
                  อัปเดตสถานะ
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!candidateDetail} onOpenChange={(o) => !o && setCandidateDetail(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">ข้อมูลผู้สมัคร</DialogTitle>
            <DialogDescription className="sr-only">สรุปข้อมูลสมัครและคะแนนจับคู่</DialogDescription>
          </DialogHeader>
          {candidateDetail && (
            <div className="space-y-3 mt-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-foreground">{formatCandidateDisplayName(candidateDetail)}</div>
                  <div className="text-xs text-muted-foreground">{candidateDetail.address}</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">โทรศัพท์</span>
                  <a href={`tel:${candidateDetail.phone}`} className="text-primary font-medium">
                    {candidateDetail.phone}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">อายุ</span>
                  <span>{candidateDetail.age} ปี</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">สถานะ</span>
                  <span>
                    {CANDIDATE_STATUS_LABELS[candidateDetail.status as keyof typeof CANDIDATE_STATUS_LABELS]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ขับรถตู้</span>
                  <span>
                    {candidateDetail.van_driving === 'passed'
                      ? '✅ ผ่าน'
                      : candidateDetail.van_driving === 'failed'
                        ? '❌ ไม่ผ่าน'
                        : '⏳ ยังไม่ทดสอบ'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ขับรถเก๋ง</span>
                  <span>
                    {candidateDetail.sedan_driving === 'passed'
                      ? '✅ ผ่าน'
                      : candidateDetail.sedan_driving === 'failed'
                        ? '❌ ไม่ผ่าน'
                        : '⏳ ยังไม่ทดสอบ'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ระยะทาง</span>
                  <span>
                    {candidateDetail.distance !== null
                      ? `${candidateDetail.distance} กม. (เส้นตรง)`
                      : 'ไม่มีพิกัดผู้สมัคร/งาน'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Match Score</span>
                  <span
                    className={cn(
                      'font-bold',
                      candidateDetail.matchScore >= 70 ? 'text-success' : 'text-warning',
                    )}
                  >
                    {candidateDetail.matchScore}%
                  </span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <a
                  href={`tel:${candidateDetail.phone}`}
                  className="flex-1 text-center py-2 rounded-lg bg-success text-white text-sm font-medium"
                >
                  📞 โทรเลย
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setCandidateDetail(null);
                    navigate(`/matching/candidates/${candidateDetail.id}`);
                  }}
                  className="flex-1 text-center py-2 jarvis-pill-btn text-sm font-medium"
                >
                  ดูโปรไฟล์เต็ม
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchingPage;
