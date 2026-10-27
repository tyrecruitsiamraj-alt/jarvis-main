import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { enrichJobsWithUrgency } from '@/lib/jobUrgency';
import { apiFetch } from '@/lib/apiFetch';
import JobBoardView from '@/components/jobs/JobBoardView';

const PublicJobBoardPage: React.FC = () => {
  /** ลิงก์แยก BU (`?bu=LBD` · สร้างที่ ตั้งค่า › ลิงก์หน้าสมัคร · 27 ต.ค. 2569) — server กรองให้ */
  const [searchParams] = useSearchParams();
  const bu = (searchParams.get('bu') ?? '').trim().toUpperCase();
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  /** โหลดล้ม — QA 17 ต.ค. 2569: เดิมกลายเป็นรายการว่าง แล้วบอกผู้สมัครว่า "ไม่มีตำแหน่งตรงตัวกรอง" */
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    // 500 = ครอบใบเปิดทั้งหมด (เดิม 200 ใบเก่าตกขอบ — เคสกันยงอีเลคทริกหาย 20 ส.ค. 2569)
    apiFetch(`/api/public/jobs?limit=500${/^[A-Z]{2,4}$/.test(bu) ? `&bu=${bu}` : ''}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('fail');
        return r.json() as Promise<JobRequest[]>;
      })
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? enrichJobsWithUrgency(data) : [];
        setJobs(arr);
      })
      .catch(() => {
        if (cancelled) return;
        setJobs([]);
        setLoadError('โหลดตำแหน่งงานไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bu]);

  return <JobBoardView jobs={jobs} loading={loading} loadError={loadError} variant="public" />;
};

export default PublicJobBoardPage;
