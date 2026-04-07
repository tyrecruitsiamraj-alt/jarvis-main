import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, RefreshCw, UserCheck, AlertCircle, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationType } from '@/types/notification';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  urgent_job: { icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
  status_update: { icon: RefreshCw, color: 'text-info bg-info/10' },
  assignment: { icon: UserCheck, color: 'text-success bg-success/10' },
  alert: { icon: AlertCircle, color: 'text-warning bg-warning/10' },
};

const NotificationPanel: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (id: string, link?: string) => {
    markAsRead(id);
    if (link) navigate(link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 md:w-96 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">การแจ้งเตือน</h3>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-xs text-primary hover:underline flex items-center gap-1">
              <CheckCheck className="w-3 h-3" /> อ่านทั้งหมด
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">ไม่มีการแจ้งเตือน</div>
          ) : (
            notifications.map(n => {
              const config = typeConfig[n.type];
              const Icon = config.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n.id, n.link)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors flex gap-3',
                    !n.read && 'bg-primary/5'
                  )}
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', config.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-medium truncate', !n.read ? 'text-foreground' : 'text-muted-foreground')}>
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
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationPanel;
