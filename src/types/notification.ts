export type NotificationType =
  | 'new_job'
  | 'job_closed'
  // ชนิดจากฝั่ง server (ตาราง app_notifications) — ค่าใหม่เพิ่มได้โดยไม่ต้องแตะ client
  | 'call_confirmed'
  | 'needs_human'
  | 'batch_pending'
  | (string & {});

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
