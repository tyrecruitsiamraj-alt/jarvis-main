import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Bell, Briefcase, CheckCircle2, CheckCheck, PhoneCall, Flag, ClipboardCheck, Megaphone, FileCheck2 } from 'lucide-react';
import {
  DOCUMENT_NOTIFICATION_TYPE,
  NOTIFICATION_TABS,
  NOTIFICATION_TAB_LABEL,
  SO_NOTIFICATION_TYPE,
  notificationsOfTab,
  type NotificationTab,
} from '@/lib/notificationTabs';
import { apiFetch } from '@/lib/apiFetch';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationType, type Notification } from '@/types/notification';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

/** ชนิดใหม่จาก server ที่ยังไม่มีในตารางนี้ → ตกไปใช้ไอคอนกระดิ่งกลาง ไม่พัง */
const typeConfig: Partial<Record<NotificationType, { icon: React.ElementType; color: string }>> = {
  new_job: { icon: Briefcase, color: 'text-blue-600 bg-blue-500/10 dark:text-blue-300' },
  job_closed: { icon: CheckCircle2, color: 'text-success bg-success/10' },
  call_confirmed: { icon: PhoneCall, color: 'text-success bg-success/10' },
  needs_human: { icon: Flag, color: 'text-destructive bg-destructive/10' },
  batch_pending: { icon: ClipboardCheck, color: 'text-amber-600 bg-amber-500/10 dark:text-amber-300' },
  [SO_NOTIFICATION_TYPE]: { icon: Megaphone, color: 'text-primary bg-primary/10' },
  [DOCUMENT_NOTIFICATION_TYPE]: { icon: FileCheck2, color: 'text-primary bg-primary/10' },
};

type HistoryRow = { id: number; type: string; title: string; body: string | null; link: string | null; createdAt: string; readAt: string | null };

const fallbackType = { icon: Bell, color: 'text-muted-foreground bg-secondary' };

const NotificationPanel: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  /** แท็บ "สั่งโพสต์ · Scrap" แยกแจ้งเตือน So Scraping ไม่ให้จมใต้ "AI ยังไม่โทร" (เจ้าของ 20 ต.ค. 2569) */
  const [tab, setTab] = React.useState<NotificationTab>('all');
  /**
   * แท็บ "เอกสาร" (22 พ.ย. 2569) — ขึ้นเมื่อมีแจ้งเตือนผู้สมัครส่งเอกสาร · แจ้งเตือนเก่ากว่าที่แผงโชว์ กด "ดูก่อนหน้านี้" ดึงทีละหน้า
   * (ยังไม่อ่านอยู่ครบเสมอ — เซิร์ฟเวอร์ดึงแยกให้ ไม่ถูกแจ้งเตือนอื่นดันตก)
   */
  const tabs = NOTIFICATION_TABS.filter((t) => t !== 'docs' || tab === 'docs' || notifications.some((n) => n.type === DOCUMENT_NOTIFICATION_TYPE));
  const [history, setHistory] = React.useState<{ items: Notification[]; nextBefore: number | null; loading: boolean; error: boolean }>({ items: [], nextBefore: null, loading: false, error: false });
  const loaded = notificationsOfTab(notifications, tab);
  const shown = tab === 'docs' ? [...loaded, ...history.items.filter((h) => !loaded.some((n) => n.id === h.id))] : loaded;
  const unreadOf = (t: NotificationTab) => notificationsOfTab(notifications, t).filter((n) => !n.read).length;
  const oldestLoadedId = () => {
    const ids = shown.map((n) => Number(n.id.replace(/^srv-/, ''))).filter((v) => Number.isInteger(v) && v > 0);
    return ids.length ? Math.min(...ids) : null;
  };
  const loadOlder = async () => {
    const before = history.nextBefore ?? oldestLoadedId();
    setHistory((h) => ({ ...h, loading: true, error: false }));
    try {
      const r = await apiFetch(`/api/notifications?history=${DOCUMENT_NOTIFICATION_TYPE}&limit=20${before ? `&before=${before}` : ''}`);
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as { items: HistoryRow[]; nextBefore: number | null };
      setHistory((h) => ({
        items: [
          ...h.items,
          ...data.items.map((it) => ({ id: `srv-${it.id}`, type: it.type, title: it.title, message: it.body || '', timestamp: it.createdAt, read: Boolean(it.readAt), link: it.link || undefined })),
        ],
        nextBefore: data.nextBefore,
        loading: false,
        error: false,
      }));
    } catch {
      setHistory((h) => ({ ...h, loading: false, error: true }));
    }
  };

  /**
   * 🔴 ปิดแผงก่อนพาไป (20 ต.ค. 2569) — เดิมแผงค้างเปิด แล้วตอนป๊อปปลายทาง (เช่น ป๊อปประกาศจาก `?posting=`) เปิด
   * แผงปิดตามแล้วคืนโฟกัสไปที่ปุ่มกระดิ่ง = "แตะนอกป๊อป" ⇒ ป๊อปปลายทางปิดทันที (เจอตอนกดแจ้งเตือน So Scraping บนเว็บจริง)
   */
  const handleClick = (id: string, link?: string) => {
    markAsRead(id);
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* ปุ่มกระดิ่งใช้ Button ทรง icon — ขนาดเท่ากับปุ่มไอคอนอื่นบนแถบหัว (4 ก.ย. 2569) */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="การแจ้งเตือน"
        >
          <Bell />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-medium rounded-full flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 md:w-96 p-0"
        align="end"
        sideOffset={8}
        // ไม่คืนโฟกัสไปที่กระดิ่งตอนปิด — ไม่งั้นป๊อปที่เพิ่งเปิดจากลิงก์แจ้งเตือนจะนับว่าโดนแตะนอกกรอบแล้วปิด
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-medium text-sm text-foreground">การแจ้งเตือน</h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" /> อ่านทั้งหมด
            </button>
          )}
        </div>
        <div className="flex gap-2 border-b border-border px-4 py-2" role="tablist" aria-label="ชนิดการแจ้งเตือน">
          {tabs.map((t) => {
            const unread = unreadOf(t);
            return (
              <Button
                key={t}
                type="button"
                size="xs"
                role="tab"
                aria-selected={tab === t}
                variant={tab === t ? 'default' : 'outline'}
                onClick={() => setTab(t)}
                data-testid={`notif-tab-${t}`}
              >
                {NOTIFICATION_TAB_LABEL[t]}
                {unread > 0 ? <span className="tabular-nums">{unread}</span> : null}
              </Button>
            );
          })}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {shown.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              {tab === 'so' ? 'ยังไม่มีแจ้งเตือนจาก So Scraping' : tab === 'docs' ? 'ยังไม่มีแจ้งเตือนเอกสาร' : 'ไม่มีการแจ้งเตือน — จะแจ้งเมื่อมีใบขอใหม่หรืองานปิดแล้ว'}
            </div>
          ) : (
            shown.map((n) => {
              const config = typeConfig[n.type] ?? fallbackType;
              const Icon = config.icon;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n.id, n.link)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors flex gap-3',
                    !n.read && 'bg-primary/5',
                  )}
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', config.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-sm font-medium truncate',
                          !n.read ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {n.title}
                      </span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true, locale: th })}
                    </span>
                  </div>
                </button>
              );
            })
          )}
          {tab === 'docs' && (history.nextBefore !== null || history.items.length === 0) ? (
            <div className="px-4 py-3">
              <Button type="button" variant="outline" size="xs" disabled={history.loading} onClick={() => void loadOlder()} data-testid="notif-docs-older">
                {history.loading ? 'กำลังโหลด…' : history.error ? 'โหลดไม่ได้ ลองอีกครั้ง' : 'ดูก่อนหน้านี้'}
              </Button>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationPanel;
