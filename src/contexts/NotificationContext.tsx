import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Notification } from '@/types/notification';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

const initialNotifications: Notification[] = [
  { id: 'n1', type: 'urgent_job', title: 'งานด่วน: ธนาคารกรุงเทพ', message: 'ต้องการคนภายในวันนี้ - ยังไม่มีคนรับงาน', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), read: false, link: '/jobs/j1' },
  { id: 'n2', type: 'status_update', title: 'สถานะเปลี่ยน: สมศักดิ์', message: 'เปลี่ยนสถานะเป็น "มาสาย" ที่สถานทูตญี่ปุ่น', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), read: false, link: '/wl/employees/e3' },
  { id: 'n3', type: 'alert', title: 'พนักงานยกเลิก', message: 'สมหญิง ยกเลิกงานวันพรุ่งนี้ที่ SCG', timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), read: false, link: '/wl/daily-assignment' },
  { id: 'n4', type: 'assignment', title: 'มอบหมายงานใหม่', message: 'วิไล ถูกมอบหมายงานที่โรงแรมแมนดาริน', timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), read: true },
  { id: 'n5', type: 'urgent_job', title: 'งานด่วน: สถานทูตญี่ปุ่น', message: 'งานปิดสำเร็จ - ส่งคนครบแล้ว', timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(), read: true, link: '/jobs/j3' },
];

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => [{
      ...n,
      id: `n${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    }, ...prev]);
  }, []);

  // Simulate real-time notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const rand = Math.random();
      if (rand < 0.15) {
        addNotification({
          type: 'status_update',
          title: 'อัปเดตสถานะ',
          message: `พนักงาน check-in เรียบร้อย เวลา ${new Date().toLocaleTimeString('th-TH')}`,
          link: '/wl',
        });
      }
    }, 45000);
    return () => clearInterval(interval);
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
