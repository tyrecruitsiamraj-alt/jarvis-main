import React from 'react';
import { useJobFeedNotifications } from '@/hooks/useJobFeedNotifications';

/** ซิงก์ feed ใบขอ → การแจ้งเตือน (งานใหม่ / ปิดแล้ว) */
const JobNotificationWatcher: React.FC = () => {
  useJobFeedNotifications();
  return null;
};

export default JobNotificationWatcher;
