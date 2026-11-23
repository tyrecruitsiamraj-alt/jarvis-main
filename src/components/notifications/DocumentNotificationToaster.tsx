import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useNotifications } from '@/contexts/NotificationContext';
import { freshDocumentNotifications } from '@/lib/notificationTabs';

/**
 * เด้ง toast เมื่อผู้สมัครส่งเอกสารแล้ว (22 พ.ย. 2569) — อ่านจากกล่องขาเข้าที่ถามอยู่แล้ว ไม่ยิงเส้นใหม่
 * เฉพาะที่เข้ามาหลังเปิดหน้า (ของที่ค้างตอนเปิดหน้าอยู่ในกระดิ่ง ไม่เด้งซ้ำ) · 1 แจ้งเตือน = 1 toast
 * กด "เปิดเอกสาร" = เปิดชุดนั้นในแท็บเอกสาร · อ่านแล้ว ≠ ตรวจเอกสารแล้ว (ไม่เปลี่ยนสถานะเอกสาร)
 */
const DocumentNotificationToaster: React.FC = () => {
  const { notifications, markAsRead, serverReady } = useNotifications();
  const navigate = useNavigate();
  const seen = React.useRef<Set<string> | null>(null);

  React.useEffect(() => {
    if (!serverReady) return;
    if (!seen.current) {
      seen.current = new Set(notifications.map((n) => n.id));
      return;
    }
    for (const n of freshDocumentNotifications(notifications, seen.current)) {
      seen.current.add(n.id);
      toast(n.title, {
        id: n.id,
        description: n.message,
        duration: 20_000,
        action: n.link
          ? {
              label: 'เปิดเอกสาร',
              onClick: () => {
                markAsRead(n.id);
                navigate(n.link!);
              },
            }
          : undefined,
      });
    }
    for (const n of notifications) seen.current.add(n.id);
  }, [notifications, serverReady, markAsRead, navigate]);

  return null;
};

export default DocumentNotificationToaster;
