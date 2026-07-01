export type NotificationType = 'new_job' | 'job_closed';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  jobId?: string;
}
