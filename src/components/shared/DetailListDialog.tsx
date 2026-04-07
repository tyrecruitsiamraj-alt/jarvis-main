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
  default: 'bg-secondary text-muted-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
  info: 'bg-info/15 text-info',
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
                  'rounded-lg p-3 border border-border bg-secondary/30 flex items-center justify-between gap-3',
                  item.onClick && 'cursor-pointer hover:bg-secondary/60 transition-colors',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground text-sm truncate">{item.title}</div>
                  {item.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</div>}
                  {item.extra}
                </div>

                {item.badge && (
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
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