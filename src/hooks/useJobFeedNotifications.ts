import { useEffect, useRef } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { subscribeUnitRequestsFeed } from '@/lib/jobFeedBroadcast';
import { unitRequestPath } from '@/lib/jobNavigation';
import { JOB_TYPE_LABELS } from '@/types';
import type { JobRequest } from '@/types';
import { diffUnitRequestFeedNotifications } from '@/lib/unitRequestFeedNotifications';

export const MAX_NOTIFICATIONS = 50;

function jobLabel(job: JobRequest): string {
  return job.request_no ? `${job.unit_name} (${job.request_no})` : job.unit_name;
}

function jobSubtitle(job: JobRequest): string {
  return job.request_action_name || JOB_TYPE_LABELS[job.job_type] || 'ใบขอ';
}

/**
 * แจ้งเตือนเมื่อ feed มีใบขอใหม่ หรือสถานะเปลี่ยนเป็นปิดแล้ว (ไม่แจ้งรอบโหลดแรก)
 */
export function useJobFeedNotifications(): void {
  const { addNotification } = useNotifications();
  const snapshotRef = useRef<Map<string, string> | null>(null);
  const addRef = useRef(addNotification);
  addRef.current = addNotification;

  useEffect(() => {
    return subscribeUnitRequestsFeed((jobs, { loading }) => {
      if (loading) return;

      const { events, next } = diffUnitRequestFeedNotifications(snapshotRef.current, jobs);

      for (const event of events) {
        const job = event.job;
        if (event.type === 'new_job') {
          addRef.current({
            type: 'new_job',
            jobId: job.id,
            title: 'ใบขอใหม่',
            message: `${jobLabel(job)} — ${jobSubtitle(job)}`,
            link: unitRequestPath(job),
          });
        } else {
          addRef.current({
            type: 'job_closed',
            jobId: job.id,
            title: 'งานปิดแล้ว',
            message: `${jobLabel(job)} — ${jobSubtitle(job)}`,
            link: unitRequestPath(job),
          });
        }
      }

      snapshotRef.current = next;
    });
  }, []);
}
