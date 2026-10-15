import React from 'react';
import { LoaderCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import {
  composeJobSnapshot,
  createJobPostingRequest,
  jobPostingStatusLabel,
  listActiveJobPostingsForJob,
  type JobPostingRequest,
} from '@/lib/jobPostingRequestsApi';

/**
 * ═══ ปุ่ม "สั่งโพสต์" ใต้การ์ดตัวอย่างในป๊อปประกาศ (เจ้าของ 15 ต.ค. 2569) ═══
 * > *"ขอคำว่าสั่งโพสต์แล้วให้ยิง Api ไปหา โปรเจค Api Scraping เพื่อไป Autopost facebook"*
 * Choice: "ผ่านศูนย์งาน api-scraper เดิม" — สร้างคำขอ Content (`job_posting_requests` · ตัวเดียวกับปุ่ม "ให้สร้าง Content"
 * ในหน้าจับคู่งาน) → api-scraper: AI ร่างโพสต์ → คนอนุมัติ → Auto-Post เฟซบุ๊ก · สถานะเขียนกลับมาที่คำขอ
 * ใบที่มีคำขอ Content ค้างอยู่แล้ว = ปุ่มกดไม่ได้ บอกสถานะแทน (ไม่สั่งซ้ำ)
 */
export default function OrderPostButton({ job }: { job: JobRequest }) {
  const [active, setActive] = React.useState<JobPostingRequest | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoaded(false);
    listActiveJobPostingsForJob(job.id)
      .then((list) => {
        if (alive) setActive(list.find((p) => p.request_type === 'content') ?? null);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [job.id]);

  const order = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const item = await createJobPostingRequest({
        jobId: job.id,
        requestNo: job.request_no,
        reason: 'สั่งโพสต์จากป๊อปประกาศ',
        requestType: 'content',
        jobSnapshot: composeJobSnapshot(job),
      });
      setActive(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สั่งโพสต์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1" data-testid="order-post">
      <Button
        type="button"
        className="w-full rounded-full text-sm font-medium"
        disabled={!loaded || busy || active !== null}
        onClick={() => void order()}
      >
        {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {active ? `สั่งโพสต์แล้ว · ${jobPostingStatusLabel(active.status)}` : busy ? 'กำลังสั่งโพสต์…' : 'สั่งโพสต์'}
      </Button>
      {error ? (
        <p role="alert" className={cn('text-xs', TONE.danger.value)}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
