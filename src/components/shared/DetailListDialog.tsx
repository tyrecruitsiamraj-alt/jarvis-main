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
  const listScrolls = items.length > 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          'w-[min(calc(100vw-1.25rem),44rem)] max-w-none',
          listScrolls ? 'max-h-[min(92dvh,900px)]' : 'max-h-none',
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/50 px-5 pb-3 pt-5 text-left">
          <DialogTitle className="pr-8 text-base font-semibold leading-snug text-foreground sm:text-lg break-words">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            แสดงรายการรายละเอียดที่เลือก พร้อมข้อมูลสรุปและสถานะของแต่ละรายการ
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'px-5 py-4',
            listScrolls && 'min-h-0 flex-1 overflow-y-auto overscroll-contain',
          )}
        >
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={item.onClick}
                  className={cn(
                    'flex flex-col gap-2 rounded-2xl border border-white/70 bg-white/45 p-3.5 sm:flex-row sm:items-start sm:justify-between',
                    item.onClick && 'cursor-pointer transition-colors hover:bg-white/70',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug text-foreground break-words">
                      {item.title}
                    </div>
                    {item.subtitle ? (
                      <div className="mt-1 text-xs leading-relaxed text-muted-foreground break-words whitespace-normal">
                        {item.subtitle}
                      </div>
                    ) : null}
                    {item.extra}
                  </div>
                  {item.badge ? (
                    <span
                      className={cn(
                        'shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-medium',
                        badgeStyles[item.badgeVariant || 'default'],
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DetailListDialog;
