import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Notification } from '@/types/notification';
import { MAX_NOTIFICATIONS } from '@/hooks/useJobFeedNotifications';
import { apiFetch } from '@/lib/apiFetch';

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

/** id ฝั่ง server ขึ้นต้น srv- — ไว้แยกว่า mark อ่านแล้วต้องยิง PATCH กลับไปด้วย */
const SERVER_PREFIX = 'srv-';

type ServerNotification = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  readAt: string | null;
};

function fromServer(it: ServerNotification): Notification {
  return {
    id: `${SERVER_PREFIX}${it.id}`,
    type: it.type,
    title: it.title,
    message: it.body || '',
    timestamp: it.createdAt,
    read: !!it.readAt,
    link: it.link || undefined,
  };
}

/** ดึงกล่องขาเข้าจาก server ทุก 1 นาที — เหตุการณ์ฝั่ง server (ผลโทร AI · ชุดรออนุมัติ)
 *  เกิดตอนไม่มีใครเปิดหน้าจอ ต้องมีคนไปเก็บมาเด้งเอง ไม่งั้นจบเงียบเหมือนเดิม */
const POLL_MS = 60_000;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  /** ผสานของ server เข้าลิสต์ — ของ client (job feed) อยู่ต่อ ของ server แทนที่ด้วยชุดล่าสุด */
  const mergeServer = useCallback((items: ServerNotification[]) => {
    setNotifications((prev) => {
      const clientOnly = prev.filter((n) => !n.id.startsWith(SERVER_PREFIX));
      const merged = [...clientOnly, ...items.map(fromServer)];
      merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return merged.slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  useEffect(() => {
    let stopped = false;
    const pull = async () => {
      try {
        const r = await apiFetch('/api/notifications');
        if (!r.ok) return; // ยังไม่ล็อกอิน/ตารางยังไม่มี — เงียบไว้ รอบหน้าค่อยลอง
        const data = (await r.json()) as { items?: ServerNotification[] };
        if (!stopped && Array.isArray(data.items)) mergeServer(data.items);
      } catch {
        /* เครือข่ายสะดุด — รอบหน้าค่อยลอง */
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [mergeServer]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (id.startsWith(SERVER_PREFIX)) {
      const num = Number(id.slice(SERVER_PREFIX.length));
      if (Number.isInteger(num)) {
        void apiFetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [num] }),
        }).catch(() => undefined);
      }
    }
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    // ไม่ส่ง ids = อ่านหมดทุกแถวของฉันฝั่ง server
    void apiFetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => undefined);
  }, []);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications((prev) => {
      const key = n.jobId && n.type ? `${n.type}:${n.jobId}` : null;
      if (key && prev.some((x) => `${x.type}:${x.jobId}` === key && !x.read)) {
        return prev;
      }
      const item: Notification = {
        ...n,
        id: `n${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      return [item, ...prev].slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
