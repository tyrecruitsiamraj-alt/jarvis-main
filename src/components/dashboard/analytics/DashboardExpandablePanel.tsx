import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DASH } from '@/lib/designTokens';

type Props = {
  title: string;
  subtitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

const DashboardExpandablePanel: React.FC<Props> = ({ title, subtitle, open, onOpenChange, children }) => {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        {/* โฉมการ์ดเดียวกับหน้าหลัก (9 พ.ย. 2569) · ปุ่มของ shadcn */}
        <Button
          type="button"
          variant="ghost"
          className={cn(DASH.panel, 'h-auto w-full justify-between gap-3 whitespace-normal px-5 py-4 text-left font-normal hover:bg-muted/50 sm:px-6')}
        >
          <span className="min-w-0">
            <span className="block text-lg font-medium text-foreground">{title}</span>
            {subtitle ? <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span> : null}
          </span>
          <ChevronDown className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
};

export default DashboardExpandablePanel;
