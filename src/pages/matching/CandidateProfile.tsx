import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { CandidateEditDialog } from '@/components/candidates/CandidateEditDialog';
import { mockCandidates, mockCandidateInterviews, mockCandidateWorkHistory } from '@/data/mockData';
import { formatCandidateDisplayName } from '@/lib/formatCandidateName';
import { User, Phone, MapPin, AlertTriangle, Briefcase, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';
import { candidateStaffingLabel } from '@/lib/candidateStaffing';
import { getCandidates, hydrateCandidateStaffing } from '@/lib/demoStorage';
import { wlEmployeeIdFromCandidateId } from '@/lib/wlFromCandidate';
import { useAuth } from '@/contexts/AuthContext';
import type { Candidate, CandidateInterview, CandidateWorkHistory } from '@/types';

const CandidateProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEditCandidate = hasPermission('supervisor');
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [apiInterviews, setApiInterviews] = useState<CandidateInterview[]>([]);
  const [apiWorkHistory, setApiWorkHistory] = useState<CandidateWorkHistory[]>([]);

  useEffect(() => {
    if (!id) {
      setCandidate(null);
      setLoading(false);
      return;
    }
    if (isDemoMode()) {
      const fromLocal = getCandidates().find((c) => c.id === id);
      const fromMock = mockCandidates.find((c) => c.id === id);
      const raw = fromLocal ?? fromMock ?? null;
      setCandidate(raw ? hydrateCandidateStaffing(raw) : null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/candidates?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<Candidate>;
      })
      .then((data) => {
        if (!cancelled) setCandidate(data && data.id ? hydrateCandidateStaffing(data) : null);
      })
      .catch(() => {
        if (!cancelled) setCandidate(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || isDemoMode()) {
      setApiInterviews([]);
      setApiWorkHistory([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      apiFetch(`/api/candidate-interviews?candidate_id=${encodeURIComponent(id)}`).then(async (r) =>
        r.ok ? ((await r.json()) as CandidateInterview[]) : [],
      ),
      apiFetch(`/api/candidate-work-history?candidate_id=${encodeURIComponent(id)}`).then(async (r) =>
        r.ok ? ((await r.json()) as CandidateWorkHistory[]) : [],
      ),
    ]).then(([i, w]) => {
      if (!cancelled) {
        setApiInterviews(Array.isArray(i) ? i : []);
        setApiWorkHistory(Array.isArray(w) ? w : []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const interviews = isDemoMode()
    ? mockCandidateInterviews.filter((i) => i.candidate_id === id)
    : apiInterviews;
  const workHistory = isDemoMode()
    ? mockCandidateWorkHistory.filter((w) => w.candidate_id === id)
    : apiWorkHistory;

  if (loading) return <div className="p-6 text-muted-foreground">กำลังโหลดข้อมูลผู้สมัคร...</div>;
  if (!candidate) return <div className="p-6 text-muted-foreground">ไม่พบข้อมูลผู้สมัคร</div>;

  const attendedCount = interviews.filter((i) => i.attended).length;
  const notAttendedCount = interviews.filter((i) => !i.attended).length;

  return (
    <div>
      <PageHeader
        title={formatCandidateDisplayName(candidate)}
        backPath="/matching/candidates"
        actions={
          canEditCandidate ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-medium text-foreground hover:bg-secondary/80"
            >
              <Pencil className="w-4 h-4" />
              แก้ไขข้อมูล
            </button>
          ) : undefined
        }
      />

      <CandidateEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        candidate={candidate}
        onSaved={(c) => setCandidate(c)}
      />
      <div className="px-4 md:px-6 space-y-6">
        <div className="glass-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-foreground">{formatCandidateDisplayName(candidate)}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="w-3 h-3" /> {candidate.phone}
              </div>
            </div>
            <StatusBadge status={candidate.status} type="candidate" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm pb-2 border-b border-border/60">
            <span className="text-muted-foreground">ประเภทบุคลากร:</span>
            <span className="text-foreground font-medium">
              {candidateStaffingLabel(candidate.staffing_track)}
            </span>
            {(candidate.staffing_track ?? 'regular') === 'wl' && (
              <button
                type="button"
                onClick={() => navigate(`/wl/employees/${wlEmployeeIdFromCandidateId(candidate.id)}`)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-info/15 text-info hover:bg-info/25"
              >
                <Briefcase className="w-3.5 h-3.5" /> ดูในรายชื่อพนักงาน WL
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">อายุ:</span>{' '}
              <span className="text-foreground">{candidate.age} ปี</span>
            </div>
            <div>
              <span className="text-muted-foreground">เพศ:</span>{' '}
              <span className="text-foreground">
                {candidate.gender === 'male' ? 'ชาย' : candidate.gender === 'female' ? 'หญิง' : 'อื่นๆ'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">ดื่ม:</span>{' '}
              <span className="text-foreground">{candidate.drinking === 'yes' ? 'ดื่ม' : 'ไม่ดื่ม'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">สูบ:</span>{' '}
              <span className="text-foreground">{candidate.smoking === 'yes' ? 'สูบ' : 'ไม่สูบ'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">รอยสัก:</span>{' '}
              <span className="text-foreground">{candidate.tattoo === 'yes' ? 'มี' : 'ไม่มี'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ขับรถตู้:</span>{' '}
              <span className="text-foreground">
                {candidate.van_driving === 'passed'
                  ? 'ผ่าน'
                  : candidate.van_driving === 'failed'
                    ? 'ไม่ผ่าน'
                    : 'ยังไม่สอบ'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">ขับรถเก๋ง:</span>{' '}
              <span className="text-foreground">
                {candidate.sedan_driving === 'passed'
                  ? 'ผ่าน'
                  : candidate.sedan_driving === 'failed'
                    ? 'ไม่ผ่าน'
                    : 'ยังไม่สอบ'}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-3 h-3" /> {candidate.address}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Risk"
            value={`${candidate.risk_percentage}%`}
            icon={AlertTriangle}
            variant={
              candidate.risk_percentage <= 20
                ? 'success'
                : candidate.risk_percentage <= 50
                  ? 'warning'
                  : 'destructive'
            }
          />
          <StatCard title="สัมภาษณ์ (ไป)" value={attendedCount} variant="success" />
          <StatCard title="สัมภาษณ์ (ไม่ไป)" value={notAttendedCount} variant="destructive" />
          <StatCard title="ประวัติงาน" value={workHistory.length} variant="info" />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">ประวัติสัมภาษณ์</h3>
          <div className="space-y-2">
            {interviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>
            ) : (
              interviews.map((i) => (
                <div
                  key={i.id}
                  className="glass-card rounded-lg p-3 border border-border flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{i.client_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.interview_date} • {i.location}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      i.attended ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
                    )}
                  >
                    {i.attended ? 'ไป' : 'ไม่ไป'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">ประวัติการถูกส่งไปทำงาน</h3>
          <div className="space-y-2">
            {workHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>
            ) : (
              workHistory.map((w) => (
                <div
                  key={w.id}
                  className="glass-card rounded-lg p-3 border border-border flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{w.client_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {w.start_date} - {w.end_date || 'ปัจจุบัน'}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      w.work_type === 'start' ? 'bg-primary/15 text-primary' : 'bg-warning/15 text-warning',
                    )}
                  >
                    {w.work_type === 'start' ? 'เริ่มงาน' : 'แทนงาน'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateProfile;
