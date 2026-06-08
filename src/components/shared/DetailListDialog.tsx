import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface DetailItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  onClick?: () => void;
  extra?: React.ReactNode;
}

interface DetailListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: DetailItem[];
  emptyMessage?: string;
}

const badgeStyles: Record<string, string> = {
  default: 'bg-white/60 text-muted-foreground border border-white/80',
  success: 'bg-emerald-500/12 text-emerald-700 border border-emerald-200/50',
  warning: 'bg-amber-500/12 text-amber-800 border border-amber-200/50',
  destructive: 'bg-red-500/12 text-red-700 border border-red-200/50',
  info: 'bg-sky-500/12 text-sky-700 border border-sky-200/50',
};

const DetailListDialog: React.FC<DetailListDialogProps> = ({
  open,
  onOpenChange,
  title,
  items,
  emptyMessage = 'ไม่มีข้อมูล',
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            แสดงรายการรายละเอียดที่เลือก พร้อมข้อมูลสรุปและสถานะของแต่ละรายการ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  'rounded-2xl p-3 border border-white/70 bg-white/45 flex items-center justify-between gap-3',
                  item.onClick && 'cursor-pointer hover:bg-white/70 transition-colors',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground text-sm truncate">{item.title}</div>
                  {item.subtitle && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.subtitle}</div>
                  )}
                  {item.extra}
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full shrink-0 font-medium',
                      badgeStyles[item.badgeVariant || 'default'],
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DetailListDialog;
