import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatCandidateDisplayName } from '@/lib/formatCandidateName';
import { Phone, MapPin, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Candidate, CANDIDATE_STATUS_LABELS } from '@/types';
import { useDemoAwareJobs } from '@/hooks/useDemoAwareJobs';
import { useDemoAwareCandidates } from '@/hooks/useDemoAwareCandidates';

type CandidateWithMatchScore = Candidate & { distance: number; matchScore: number };

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
          job && c.lat && c.lng && job.lat && job.lng
            ? Math.sqrt(
                Math.pow((c.lat - job.lat) * 111, 2) + Math.pow((c.lng - job.lng) * 111, 2),
              )
            : Math.random() * 25;
        const matchScore = Math.max(0, Math.min(100, Math.round(100 - dist * 3 - c.risk_percentage)));
        return { ...c, distance: Math.round(dist * 10) / 10, matchScore };
      })
      .filter((c) => c.distance <= radius)
      .sort((a, b) => b.matchScore - a.matchScore);
  };

  const matched = getCandidatesInRadius();

  return (
    <div>
      <PageHeader title="Matching" subtitle="จับคู่ผู้สมัครกับงาน" backPath="/matching" />
      <div className="px-4 md:px-6 space-y-4">
        {(loadingJobs || loadingCandidates) && (
          <div className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</div>
        )}
        <div className="glass-card rounded-xl p-4 border border-border space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">หน่วยงาน / งาน</label>
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {jobs.length === 0 ? (
                <option value="">ไม่มีงาน</option>
              ) : (
                jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.unit_name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">รัศมี (กม.)</label>
              <div className="flex gap-1.5">
                {radiusOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadius(r)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      radius === r ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {r} กม.
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะ</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="inprocess">In Process</option>
                <option value="all">ทั้งหมด</option>
                <option value="waiting_to_start">รอเริ่มงาน</option>
                <option value="no_job">ไม่มีงาน</option>
              </select>
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          พบผู้สมัคร <span className="text-primary font-semibold">{matched.length}</span> คนในรัศมี {radius} กม.
        </div>

        <div className="space-y-2">
          {matched.map((c) => (
            <div key={c.id} className="glass-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setCandidateDetail(c)}
                  className="font-semibold text-primary text-sm hover:underline text-left"
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
                  <MapPin className="w-3 h-3" /> {c.distance} กม.
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
                  className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs"
                >
                  ดูรายละเอียด
                </button>
                <button type="button" className="px-3 py-1.5 rounded-lg bg-warning/10 text-warning text-xs">
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
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
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
                  <span>{candidateDetail.distance} กม.</span>
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
                  className="flex-1 text-center py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
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
