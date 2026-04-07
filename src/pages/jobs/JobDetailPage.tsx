import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { mockJobAssignments, mockJobRequests, mockCandidates } from '@/data/mockData';
import type {
  Candidate,
  JobAssignment,
  JobRequest,
  JobCategory,
  JobStatus,
  JobType,
  JobUrgency,
} from '@/types';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import {
  MapPin,
  AlertTriangle,
  Users,
  CheckCircle,
  XCircle,
  Play,
  Search,
  Pencil,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  appendJobAssignment,
  getCandidates,
  getJobAssignments,
  getJobs,
  JOB_STAFF_ROSTER_CHANGED_EVENT,
  upsertJobInDemoStorage,
} from '@/lib/demoStorage';
import { buildRecruiterNameOptions, buildScreenerNameOptions } from '@/lib/jobStaffNames';
import { RosterBackedStaffSelect } from '@/components/jobs/RosterBackedStaffSelect';
import { formatCandidateDisplayName } from '@/lib/formatCandidateName';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';

const mergeJobsForFallback = (localItems: JobRequest[]) => {
  const map = new Map<string, JobRequest>();
  [...mockJobRequests, ...localItems].forEach((item) => {
    map.set(item.id, item);
  });
  return [...map.values()];
};

function mergeAssignmentsForJob(
  jobId: string | undefined,
  includeMock: boolean,
  fromApi: JobAssignment[],
): JobAssignment[] {
  if (!jobId) return [];
  const map = new Map<string, JobAssignment>();
  if (includeMock) {
    mockJobAssignments.filter((a) => a.job_id === jobId).forEach((a) => map.set(a.id, a));
  }
  getJobAssignments()
    .filter((a) => a.job_id === jobId)
    .forEach((a) => map.set(a.id, a));
  fromApi.filter((a) => a.job_id === jobId).forEach((a) => map.set(a.id, a));
  return [...map.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

type JobEditForm = {
  unit_name: string;
  location_address: string;
  request_date: string;
  required_date: string;
  urgency: JobUrgency;
  job_type: JobType;
  job_category: JobCategory;
  total_income: string;
  recruiter_name: string;
  screener_name: string;
  age_min: string;
  age_max: string;
  vehicle_required: string;
  work_schedule: string;
  penalty_per_day: string;
  days_without_worker: string;
  status: JobStatus;
  closed_date: string;
};

function jobToEditForm(j: JobRequest): JobEditForm {
  return {
    unit_name: j.unit_name,
    location_address: j.location_address,
    request_date: j.request_date,
    required_date: j.required_date,
    urgency: j.urgency,
    job_type: j.job_type,
    job_category: j.job_category,
    total_income: String(j.total_income),
    recruiter_name: j.recruiter_name ?? '',
    screener_name: j.screener_name ?? '',
    age_min: j.age_range_min != null ? String(j.age_range_min) : '',
    age_max: j.age_range_max != null ? String(j.age_range_max) : '',
    vehicle_required: j.vehicle_required ?? '',
    work_schedule: j.work_schedule ?? '',
    penalty_per_day: String(j.penalty_per_day),
    days_without_worker: String(j.days_without_worker),
    status: j.status,
    closed_date: j.closed_date ?? '',
  };
}

function editFormToJob(base: JobRequest, f: JobEditForm): JobRequest {
  const penalty = Math.max(0, parseInt(f.penalty_per_day, 10) || 0);
  const days = Math.max(0, parseInt(f.days_without_worker, 10) || 0);
  return {
    ...base,
    unit_name: f.unit_name.trim(),
    location_address: f.location_address.trim(),
    request_date: f.request_date,
    required_date: f.required_date,
    urgency: f.urgency,
    job_type: f.job_type,
    job_category: f.job_category,
    total_income: Math.max(0, parseInt(f.total_income, 10) || 0),
    recruiter_name: f.recruiter_name.trim() || undefined,
    screener_name: f.screener_name.trim() || undefined,
    age_range_min: f.age_min.trim() ? parseInt(f.age_min, 10) : undefined,
    age_range_max: f.age_max.trim() ? parseInt(f.age_max, 10) : undefined,
    vehicle_required: f.vehicle_required.trim() || undefined,
    work_schedule: f.work_schedule.trim() || undefined,
    penalty_per_day: penalty,
    days_without_worker: days,
    total_penalty: penalty * days,
    status: f.status,
    closed_date:
      f.status === 'closed' && f.closed_date.trim() ? f.closed_date.trim() : undefined,
  };
}

const JobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const [job, setJob] = useState<JobRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCandidates, setPickerCandidates] = useState<Candidate[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [assignRev, setAssignRev] = useState(0);
  const [assignmentType, setAssignmentType] = useState<JobAssignment['assignment_type']>('trial');
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<JobEditForm | null>(null);
  const [staffRosterRev, setStaffRosterRev] = useState(0);
  const [staffJobsForNames, setStaffJobsForNames] = useState<JobRequest[]>([]);
  const [apiAssignments, setApiAssignments] = useState<JobAssignment[]>([]);

  const recruiterNameOptions = useMemo(() => {
    void staffRosterRev;
    return buildRecruiterNameOptions(isDemoMode() ? undefined : staffJobsForNames);
  }, [staffRosterRev, staffJobsForNames]);
  const screenerNameOptions = useMemo(() => {
    void staffRosterRev;
    return buildScreenerNameOptions(isDemoMode() ? undefined : staffJobsForNames);
  }, [staffRosterRev, staffJobsForNames]);

  useEffect(() => {
    const fn = () => setStaffRosterRev((x) => x + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
  }, []);

  const openJobEdit = () => {
    if (!job) return;
    setEditForm(jobToEditForm(job));
    setEditError(null);
    setEditOpen(true);
  };

  const saveJobEdit = async () => {
    if (!job || !editForm || !id) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = editFormToJob(job, editForm);

      if (isDemoMode()) {
        upsertJobInDemoStorage(updated);
        setJob(updated);
        setEditOpen(false);
        setEditForm(null);
        return;
      }

      const r = await apiFetch('/api/jobs', {
        method: 'PATCH',
        body: JSON.stringify({
          id: job.id,
          unit_name: updated.unit_name,
          location_address: updated.location_address,
          request_date: updated.request_date,
          required_date: updated.required_date,
          urgency: updated.urgency,
          job_type: updated.job_type,
          job_category: updated.job_category,
          total_income: updated.total_income,
          recruiter_name: updated.recruiter_name ?? '',
          screener_name: updated.screener_name ?? '',
          age_range_min: updated.age_range_min ?? null,
          age_range_max: updated.age_range_max ?? null,
          vehicle_required: updated.vehicle_required ?? null,
          work_schedule: updated.work_schedule ?? null,
          penalty_per_day: updated.penalty_per_day,
          days_without_worker: updated.days_without_worker,
          status: updated.status,
          closed_date:
            updated.status === 'closed' && updated.closed_date ? updated.closed_date : null,
          lat: job.lat ?? null,
          lng: job.lng ?? null,
        }),
      });
      let data: unknown = {};
      try {
        data = await r.json();
      } catch {
        /* ignore */
      }
      if (!r.ok) {
        const rec = data as { message?: string };
        const msg =
          typeof rec.message === 'string'
            ? rec.message
            : r.status === 403
              ? 'ไม่มีสิทธิ์แก้ไข (เฉพาะผู้ดูแลระบบ)'
              : 'บันทึกไม่สำเร็จ';
        throw new Error(msg);
      }
      setJob(data as JobRequest);
      setEditOpen(false);
      setEditForm(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);

    const findLocal = (): JobRequest | null => {
      if (!isDemoMode()) return null;
      const merged = mergeJobsForFallback(getJobs());
      return merged.find((j) => j.id === id) || null;
    };

    apiFetch(`/api/jobs?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`API_${r.status}`);
        }
        return r.json() as Promise<JobRequest>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data && typeof data === 'object' && 'id' in data && data.id) {
          setJob(data);
        } else {
          setJob(findLocal());
        }
      })
      .catch(() => {
        if (cancelled) return;
        setJob(findLocal());
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || isDemoMode()) return;
    let cancelled = false;
    apiFetch('/api/jobs?limit=500')
      .then(async (r) => (r.ok ? ((await r.json()) as JobRequest[]) : []))
      .then((data) => {
        if (!cancelled) setStaffJobsForNames(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setStaffJobsForNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || isDemoMode()) {
      setApiAssignments([]);
      return;
    }
    let cancelled = false;
    apiFetch(`/api/job-assignments?job_id=${encodeURIComponent(id)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as JobAssignment[]) : []))
      .then((data) => {
        if (!cancelled) setApiAssignments(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setApiAssignments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const assignments = useMemo(() => {
    void assignRev;
    return mergeAssignmentsForJob(id, isDemoMode(), apiAssignments);
  }, [id, assignRev, apiAssignments]);

  useEffect(() => {
    if (!addOpen) return;
    setPickerSearch('');
    if (isDemoMode()) {
      const map = new Map<string, Candidate>();
      [...mockCandidates, ...getCandidates()].forEach((c) => map.set(c.id, c));
      setPickerCandidates([...map.values()]);
      setPickerLoading(false);
      return;
    }
    let cancelled = false;
    setPickerLoading(true);
    apiFetch('/api/candidates?limit=500')
      .then(async (r) => (r.ok ? ((await r.json()) as Candidate[]) : []))
      .then((data) => {
        if (!cancelled) setPickerCandidates(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setPickerCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addOpen]);

  const assignedCandidateIds = useMemo(
    () => new Set(assignments.map((a) => a.candidate_id)),
    [assignments],
  );

  const pickerFiltered = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    return pickerCandidates
      .filter((c) => !assignedCandidateIds.has(c.id))
      .filter((c) => {
        if (!q) return true;
        const name = formatCandidateDisplayName(c).toLowerCase();
        return name.includes(q) || (c.phone || '').toLowerCase().includes(q);
      });
  }, [pickerCandidates, pickerSearch, assignedCandidateIds]);

  const addCandidateToJob = async (c: Candidate) => {
    if (!id || !job) return;
    const row: JobAssignment = {
      id: crypto.randomUUID(),
      job_id: id,
      candidate_id: c.id,
      candidate_name: formatCandidateDisplayName(c),
      assignment_type: assignmentType,
      start_date: job.required_date,
      status: 'sent',
      trial_days: assignmentType === 'trial' ? 3 : 0,
      created_at: new Date().toISOString(),
    };
    if (isDemoMode()) {
      appendJobAssignment(row);
      setAssignRev((n) => n + 1);
      setAddOpen(false);
      return;
    }
    const r = await apiFetch('/api/job-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: id,
        candidate_id: c.id,
        candidate_name: row.candidate_name,
        assignment_type: row.assignment_type,
        start_date: row.start_date,
        end_date: row.end_date ?? null,
        status: row.status,
        trial_days: row.trial_days,
      }),
    });
    let data: unknown = {};
    try {
      data = await r.json();
    } catch {
      /* ignore */
    }
    if (!r.ok) {
      const rec = data as { message?: string };
      window.alert(
        typeof rec.message === 'string' ? rec.message : 'บันทึกการมอบหมายไม่สำเร็จ',
      );
      return;
    }
    const created = data as JobAssignment;
    if (created && typeof created.id === 'string') {
      setApiAssignments((prev) => [created, ...prev]);
    }
    setAddOpen(false);
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">กำลังโหลดข้อมูลงาน...</div>;
  }

  if (!job) {
    return <div className="p-6 text-muted-foreground">ไม่พบข้อมูลงาน</div>;
  }

  const sent = assignments.length;
  const passed = assignments.filter((a) => a.status === 'passed').length;
  const failed = assignments.filter((a) => a.status === 'failed').length;
  const started = assignments.filter((a) => a.status === 'started').length;

  return (
    <div>
      <PageHeader
        title={job.unit_name}
        backPath="/jobs/list"
        actions={
          hasPermission('admin') ? (
            <button
              type="button"
              onClick={openJobEdit}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-medium text-foreground hover:bg-secondary/80"
            >
              <Pencil className="w-4 h-4" />
              แก้ไขรายละเอียด
            </button>
          ) : undefined
        }
      />

      <div className="px-4 md:px-6 space-y-6">
        <div className="glass-card rounded-xl p-4 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <StatusBadge status={job.status} type="job" />
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                job.urgency === 'urgent' ? 'bg-destructive/15 text-destructive' : 'bg-info/15 text-info',
              )}
            >
              {job.urgency === 'urgent' ? '🔴 ด่วน' : '🔵 ล่วงหน้า'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">ลักษณะงาน:</span>{' '}
              <span className="text-foreground">{JOB_TYPE_LABELS[job.job_type]}</span>
            </div>

            <div>
              <span className="text-muted-foreground">ประเภท:</span>{' '}
              <span className="text-foreground">{JOB_CATEGORY_LABELS[job.job_category]}</span>
            </div>

            <div>
              <span className="text-muted-foreground">วันที่ขอ:</span>{' '}
              <span className="text-foreground">{job.request_date}</span>
            </div>

            <div>
              <span className="text-muted-foreground">วันที่ต้องการ:</span>{' '}
              <span className="text-foreground">{job.required_date}</span>
            </div>

            <div>
              <span className="text-muted-foreground">สรรหา:</span>{' '}
              <span className="text-foreground">{job.recruiter_name || '-'}</span>
            </div>

            <div>
              <span className="text-muted-foreground">คัดสรร:</span>{' '}
              <span className="text-foreground">{job.screener_name || '-'}</span>
            </div>

            <div>
              <span className="text-muted-foreground">รายได้รวม:</span>{' '}
              <span className="text-success">฿{job.total_income.toLocaleString()}</span>
            </div>

            <div>
              <span className="text-muted-foreground">ช่วงอายุ:</span>{' '}
              <span className="text-foreground">
                {job.age_range_min || '-'} - {job.age_range_max || '-'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {job.location_address}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard title="ค่าปรับ/วัน" value={`฿${job.penalty_per_day.toLocaleString()}`} variant="warning" />
          <StatCard title="วันไม่มีคน" value={job.days_without_worker} variant="destructive" />
          <StatCard
            title="ค่าปรับรวม"
            value={`฿${job.total_penalty.toLocaleString()}`}
            icon={AlertTriangle}
            variant={job.total_penalty > 0 ? 'destructive' : 'success'}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="ส่งไป" value={sent} icon={Users} variant="info" />
          <StatCard title="ผ่าน" value={passed} icon={CheckCircle} variant="success" />
          <StatCard title="ไม่ผ่าน" value={failed} icon={XCircle} variant="destructive" />
          <StatCard title="เริ่มงาน" value={started} icon={Play} variant="primary" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">รายชื่อที่ส่ง</h3>

            {hasPermission('supervisor') && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-95"
              >
                + เพิ่มคน
              </button>
            )}
          </div>

          <div className="space-y-2">
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีการส่งคน</p>
            ) : (
              assignments.map((a) => (
                <div
                  key={a.id}
                  className="glass-card rounded-lg p-3 border border-border flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{a.candidate_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.assignment_type === 'start'
                        ? 'เริ่มงาน'
                        : a.assignment_type === 'replacement'
                          ? 'แทนงาน'
                          : 'จุ่ม'}{' '}
                      • เริ่ม {a.start_date}
                      {a.trial_days ? ` • จุ่ม ${a.trial_days} วัน` : ''}
                    </div>
                  </div>

                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      a.status === 'started'
                        ? 'bg-success/15 text-success'
                        : a.status === 'passed'
                          ? 'bg-primary/15 text-primary'
                          : a.status === 'failed'
                            ? 'bg-destructive/15 text-destructive'
                            : a.status === 'sent'
                              ? 'bg-warning/15 text-warning'
                              : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {a.status === 'started'
                      ? 'เริ่มงานแล้ว'
                      : a.status === 'passed'
                        ? 'ผ่าน'
                        : a.status === 'failed'
                          ? 'ไม่ผ่าน'
                          : a.status === 'sent'
                            ? 'ส่งแล้ว'
                            : 'ยกเลิก'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[min(85vh,640px)] flex flex-col gap-0 p-0 overflow-hidden sm:max-w-lg">
          <div className="p-6 pb-3 border-b border-border shrink-0">
            <DialogHeader>
              <DialogTitle>เพิ่มผู้สมัครเข้างานนี้</DialogTitle>
              <DialogDescription>เลือกชื่อจากรายการด้านล่าง (ค้นหาได้จากชื่อหรือเบอร์โทร)</DialogDescription>
            </DialogHeader>
            <div className="mt-3 space-y-2">
              <label className="text-xs text-muted-foreground block">ประเภทการส่ง</label>
              <select
                value={assignmentType}
                onChange={(e) => setAssignmentType(e.target.value as JobAssignment['assignment_type'])}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="trial">จุ่ม</option>
                <option value="start">เริ่มงาน</option>
                <option value="replacement">แทนงาน</option>
              </select>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="ค้นหาชื่อหรือเบอร์..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
            {pickerLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">กำลังโหลดรายชื่อผู้สมัคร…</p>
            ) : pickerFiltered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {pickerCandidates.length === 0
                  ? 'ยังไม่มีข้อมูลผู้สมัคร'
                  : 'ไม่พบชื่อที่ค้น หรือส่งครบทุกคนในรายการแล้ว'}
              </p>
            ) : (
              <ul className="space-y-1">
                {pickerFiltered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => void addCandidateToJob(c)}
                      className="w-full text-left rounded-lg border border-border bg-card/50 px-3 py-2.5 text-sm hover:bg-secondary hover:border-primary/30 transition-colors"
                    >
                      <span className="font-medium text-foreground">{formatCandidateDisplayName(c)}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{c.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) {
            setEditForm(null);
            setEditError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[min(90vh,720px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขรายละเอียดงาน</DialogTitle>
            <DialogDescription>
              เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่แก้ไขได้
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3 pt-1">
              {editError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{editError}</p>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">หน่วยงาน</label>
                <input
                  value={editForm.unit_name}
                  onChange={(e) => setEditForm({ ...editForm, unit_name: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ที่อยู่ / สถานที่</label>
                <textarea
                  value={editForm.location_address}
                  onChange={(e) => setEditForm({ ...editForm, location_address: e.target.value })}
                  rows={2}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm resize-y min-h-[60px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่ขอ</label>
                  <input
                    type="date"
                    value={editForm.request_date}
                    onChange={(e) => setEditForm({ ...editForm, request_date: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่ต้องการ</label>
                  <input
                    type="date"
                    value={editForm.required_date}
                    onChange={(e) => setEditForm({ ...editForm, required_date: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ความเร่งด่วน</label>
                  <select
                    value={editForm.urgency}
                    onChange={(e) => setEditForm({ ...editForm, urgency: e.target.value as JobUrgency })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="urgent">ด่วน</option>
                    <option value="advance">ล่วงหน้า</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะงาน</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as JobStatus })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="open">เปิด</option>
                    <option value="in_progress">ดำเนินการ</option>
                    <option value="closed">ปิดแล้ว</option>
                    <option value="cancelled">ยกเลิก</option>
                  </select>
                </div>
              </div>
              {editForm.status === 'closed' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่ปิด</label>
                  <input
                    type="date"
                    value={editForm.closed_date}
                    onChange={(e) => setEditForm({ ...editForm, closed_date: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ลักษณะงาน</label>
                  <select
                    value={editForm.job_type}
                    onChange={(e) => setEditForm({ ...editForm, job_type: e.target.value as JobType })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    {(Object.keys(JOB_TYPE_LABELS) as JobType[]).map((k) => (
                      <option key={k} value={k}>
                        {JOB_TYPE_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเภท</label>
                  <select
                    value={editForm.job_category}
                    onChange={(e) => setEditForm({ ...editForm, job_category: e.target.value as JobCategory })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    {(Object.keys(JOB_CATEGORY_LABELS) as JobCategory[]).map((k) => (
                      <option key={k} value={k}>
                        {JOB_CATEGORY_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">รายได้รวม (บาท)</label>
                <input
                  type="number"
                  min={0}
                  value={editForm.total_income}
                  onChange={(e) => setEditForm({ ...editForm, total_income: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <RosterBackedStaffSelect
                  role="recruiter"
                  label="เจ้าหน้าที่สรรหา"
                  value={editForm.recruiter_name}
                  onChange={(v) => setEditForm({ ...editForm, recruiter_name: v })}
                  optionNames={recruiterNameOptions}
                  canManageRoster={hasPermission('admin')}
                  rosterRev={staffRosterRev}
                />
                <RosterBackedStaffSelect
                  role="screener"
                  label="เจ้าหน้าที่คัดสรร"
                  value={editForm.screener_name}
                  onChange={(v) => setEditForm({ ...editForm, screener_name: v })}
                  optionNames={screenerNameOptions}
                  canManageRoster={hasPermission('admin')}
                  rosterRev={staffRosterRev}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">อายุต่ำสุด</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.age_min}
                    onChange={(e) => setEditForm({ ...editForm, age_min: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">อายุสูงสุด</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.age_max}
                    onChange={(e) => setEditForm({ ...editForm, age_max: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">รถที่ต้องการ</label>
                <input
                  value={editForm.vehicle_required}
                  onChange={(e) => setEditForm({ ...editForm, vehicle_required: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ตารางเวลางาน</label>
                <input
                  value={editForm.work_schedule}
                  onChange={(e) => setEditForm({ ...editForm, work_schedule: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ค่าปรับ/วัน</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.penalty_per_day}
                    onChange={(e) => setEditForm({ ...editForm, penalty_per_day: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">วันไม่มีคน</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.days_without_worker}
                    onChange={(e) => setEditForm({ ...editForm, days_without_worker: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ค่าปรับรวม = ค่าปรับ/วัน × วันไม่มีคน (คำนวณตอนบันทึก)
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditForm(null);
                  }}
                  className="px-3 py-2 rounded-lg text-sm border border-border bg-secondary"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => void saveJobEdit()}
                  className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {editSaving ? 'กำลังบันทึก…' : 'บันทึก'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobDetailPage;
