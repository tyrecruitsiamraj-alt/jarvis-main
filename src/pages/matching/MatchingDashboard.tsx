import React, { useEffect, useMemo, useState } from 'react';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS, type JobRequest } from '@/types';
import { Users, Search, ClipboardCheck, Briefcase, ArrowRight, Megaphone, BookmarkCheck, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDemoAwareJobs } from '@/hooks/useDemoAwareJobs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { unitRequestCardSubtitle, unitRequestCardTitle } from '@/lib/unitRequestDisplay';

const TOP_N = 10;


function sortByRequiredDate(a: JobRequest, b: JobRequest) {
  return new Date(a.required_date).getTime() - new Date(b.required_date).getTime();
}

function JobRow({ job, onOpen }: { job: JobRequest; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-2xl border border-white/70 bg-white/40 hover:bg-blue-50/40 hover:border-blue-300/40 px-3 py-2 transition-colors"
    >
      <div className="font-medium text-foreground text-sm line-clamp-1">{unitRequestCardTitle(job)}</div>
      {unitRequestCardSubtitle(job) ? (
        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{unitRequestCardSubtitle(job)}</div>
      ) : null}
      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
        <span>ต้องการ {formatYmdDmyBe(job.required_date)}</span>
        <span className={cn(job.urgency === 'urgent' ? 'text-destructive' : 'text-info')}>
          {job.urgency === 'urgent' ? 'ด่วน' : 'ล่วงหน้า'}
        </span>
        <span>{JOB_TYPE_LABELS[job.job_type]}</span>
      </div>
    </button>
  );
}

/** ยอดการ์ด active ต่อถังบนบอร์ด iRecruit (To do / ไม่มีงาน / Re Use) */
type BoardBucket = { column_id: number; label: string | null; count: number };

const BUCKET_DISPLAY: Record<string, { title: string; desc: string; cls: string }> = {
  'to do': { title: 'รอลงงาน (To do)', desc: 'ผ่านสัมภาษณ์ พร้อมลงงาน — AI แมทถังนี้ก่อนเสมอ', cls: 'text-emerald-700' },
  'ไม่มีงาน': { title: 'รองาน (ไม่มีงาน)', desc: 'ผ่านคัดเลือกแต่ยังไม่มีตำแหน่ง — AI ค้นต่อเมื่อ To do ไม่ถึงเป้า', cls: 'text-amber-700' },
  're use': { title: 'คนเก่า (Re Use)', desc: 'เคยผ่านงาน — เลือกส่ง AI โทรเองได้ ไม่เข้า auto', cls: 'text-violet-700' },
};

const MatchingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { jobs, loading: loadingJobs } = useDemoAwareJobs();
  const [allJobsOpen, setAllJobsOpen] = useState(false);

  const [buckets, setBuckets] = useState<BoardBucket[] | null>(null);
  const [bucketsLoading, setBucketsLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/matching/board-candidates?buckets=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.buckets)) setBuckets(d.buckets);
      })
      .catch(() => {})
      .finally(() => setBucketsLoading(false));
  }, []);

  const urgentTop = useMemo(
    () =>
      jobs
        .filter((j) => j.urgency === 'urgent' && j.status !== 'cancelled')
        .sort(sortByRequiredDate)
        .slice(0, TOP_N),
    [jobs],
  );

  const nearDueTop = useMemo(
    () =>
      jobs
        .filter((j) => j.status === 'open' || j.status === 'in_progress')
        .sort(sortByRequiredDate)
        .slice(0, TOP_N),
    [jobs],
  );

  const allJobsSorted = useMemo(() => [...jobs].sort(sortByRequiredDate), [jobs]);

  const toolMenus: {
    path: string;
    label: string;
    desc: string;
    icon: LucideIcon;
    accent: string;
  }[] = [
    {
      path: '/matching/match',
      label: 'Matching',
      desc: 'จับคู่ผู้สมัครกับงานตามรัศมีและคะแนน Match',
      icon: Search,
      accent: 'text-blue-700 bg-blue-500/12',
    },
    {
      path: '/matching/pre-check',
      label: 'Pre-Check',
      desc: 'ค้นหางานใกล้ที่อยู่ผู้สมัครก่อนสมัคร',
      icon: ClipboardCheck,
      accent: 'text-amber-700 bg-amber-500/12',
    },
    {
      path: '/matching/reservations',
      label: 'รายชื่อคนจอง',
      desc: 'ดูคนที่กำลังจอง/ลงงานอยู่ ยกเลิกจองได้',
      icon: BookmarkCheck,
      accent: 'text-emerald-700 bg-emerald-500/12',
    },
    {
      path: '/matching/job-postings',
      label: 'คำขอโพสหางานใหม่',
      desc: 'ใบขอที่หาคนของเราไม่ได้ — ให้ทีมคอนเทนต์รับไปโพสต่อ',
      icon: Megaphone,
      accent: 'text-rose-700 bg-rose-500/12',
    },
  ];

  const openJob = (id: string) => {
    navigate(`/jobs/${id}`);
  };

  return (
    <div className="relative">
      <div className="jarvis-page-orb top-0 right-4 h-32 w-32" aria-hidden />
      <PageHeader title="Matching Module" subtitle="จับคู่กับงาน" />
      <div className="px-4 md:px-6 space-y-6">
        {loadingJobs && <div className="text-sm text-muted-foreground">กำลังโหลดข้อมูลงาน...</div>}

        {/* Matching + Pre-Check */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {toolMenus.map((item, i) => (
            <motion.button
              key={item.path}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(item.path)}
              className="jarvis-menu-card rounded-[1.5rem] p-4 md:p-5 border border-white/70 group touch-manipulation text-left"
            >
              <div
                className={cn(
                  'w-11 h-11 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105',
                  item.accent,
                )}
              >
                <item.icon className="w-5 h-5" />
              </div>
              <div className="font-semibold text-foreground text-sm md:text-base">{item.label}</div>
              <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{item.desc}</div>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                เปิด
                <ArrowRight className="h-3 w-3" aria-hidden />
              </div>
            </motion.button>
          ))}
        </div>

        {/* คนของเรา · ตามถังบนบอร์ด iRecruit — ยอดจริง ณ ตอนนี้ */}
        <div className="glass-card rounded-[1.5rem] border border-white/70 p-3 md:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              คนของเรา · ตามถังบนบอร์ด
            </h3>
            {bucketsLoading ? (
              <span className="text-xs text-muted-foreground">กำลังโหลด…</span>
            ) : buckets ? (
              <span className="text-xs text-muted-foreground">
                รวม {buckets.reduce((s, b) => s + b.count, 0)} คน
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">โหลดไม่สำเร็จ</span>
            )}
          </div>
          {buckets ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {buckets.map((b) => {
                const meta = BUCKET_DISPLAY[(b.label || '').trim().toLowerCase()] ?? {
                  title: b.label || `คอลัมน์ ${b.column_id}`,
                  desc: '',
                  cls: 'text-foreground',
                };
                return (
                  <button
                    key={b.column_id}
                    type="button"
                    onClick={() => navigate('/matching/match')}
                    className="jarvis-stat-tile"
                  >
                    <div className="jarvis-stat-label">{meta.title}</div>
                    <div className={cn('jarvis-stat-value', meta.cls)}>{b.count}</div>
                    {meta.desc ? (
                      <div className="jarvis-stat-sub leading-snug">{meta.desc}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Job Request Summary — 10 ด่วน + 10 ใกล้กำหนด */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-600" />
              Job Request Summary
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={() => setAllJobsOpen(true)}>
              ดูงานทั้งหมด ({jobs.length})
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            แสดงงานด่วนและงานที่ใกล้ถึงวันที่ต้องการ อย่างละ {TOP_N} รายการแรก (เรียงตามวันที่ต้องการ)
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-destructive uppercase tracking-wide">งานด่วน</h4>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {urgentTop.length === 0 ? (
                  <p className="text-xs text-muted-foreground">ไม่มีงานด่วน</p>
                ) : (
                  urgentTop.map((job) => <JobRow key={job.id} job={job} onOpen={() => openJob(job.id)} />)
                )}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-info uppercase tracking-wide">ใกล้ถึงวันที่ต้องการ</h4>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {nearDueTop.length === 0 ? (
                  <p className="text-xs text-muted-foreground">ไม่มีงานที่เปิดอยู่</p>
                ) : (
                  nearDueTop.map((job) => <JobRow key={job.id} job={job} onOpen={() => openJob(job.id)} />)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={allJobsOpen} onOpenChange={setAllJobsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground">งานทั้งหมด</DialogTitle>
            <DialogDescription>เรียงตามวันที่ต้องการ — กดรายการเพื่อเปิดรายละเอียด</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {allJobsSorted.map((job) => (
              <JobRow key={job.id} job={job} onOpen={() => { setAllJobsOpen(false); openJob(job.id); }} />
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground pt-2 border-t border-border">
            สรุปตามประเภท:{' '}
            {(Object.keys(JOB_TYPE_LABELS) as Array<keyof typeof JOB_TYPE_LABELS>)
              .map((t) => `${JOB_TYPE_LABELS[t]} ${jobs.filter((j) => j.job_type === t).length}`)
              .join(' · ')}
          </div>
          <div className="text-[10px] text-muted-foreground">
            หมวด:{' '}
            {(Object.keys(JOB_CATEGORY_LABELS) as Array<keyof typeof JOB_CATEGORY_LABELS>)
              .map((c) => `${JOB_CATEGORY_LABELS[c]} ${jobs.filter((j) => j.job_category === c).length}`)
              .join(' · ')}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchingDashboard;
