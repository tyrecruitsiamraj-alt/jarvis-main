export type NotificationType = 'urgent_job' | 'status_update' | 'assignment' | 'alert';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}
