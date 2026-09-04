import React from 'react';
import { TONE } from '@/lib/designTokens';
import { motion } from 'framer-motion';
import { Building2, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  WL_BU_CODES,
  WL_BU_UNASSIGNED,
  wlBuViewLabel,
  type WlBuView,
} from '@/lib/wlBuState';

type WlBuSelectorProps = {
  selected: WlBuView;
  onChange: (bu: WlBuView) => void;
  counts?: Partial<Record<WlBuView, number>>;
  variant?: 'cards' | 'pills';
  className?: string;
  /** โชว์ถัง "ยังไม่ระบุ BU" ด้วย (เฉพาะเมื่อมีคนอยู่ในถังนั้นจริง) */
  showUnassigned?: boolean;
};

const WlBuSelector: React.FC<WlBuSelectorProps> = ({
  selected,
  onChange,
  counts,
  variant = 'cards',
  className,
  showUnassigned = false,
}) => {
  const unassignedCount = counts?.[WL_BU_UNASSIGNED] ?? 0;
  const views: WlBuView[] = [
    ...WL_BU_CODES,
    ...(showUnassigned && unassignedCount > 0 ? [WL_BU_UNASSIGNED] : []),
  ];

  if (variant === 'pills') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {views.map((bu) => {
          const active = selected === bu;
          const count = counts?.[bu];
          const unassigned = bu === WL_BU_UNASSIGNED;
          return (
            <button
              key={bu}
              type="button"
              onClick={() => onChange(bu)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                active
                  ? unassigned
                    ? 'bg-amber-500 text-white'
                    : 'bg-primary text-primary-foreground'
                  : unassigned
                    ? cn(TONE.warn.soft, TONE.warn.value, TONE.warn.softHover)
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {wlBuViewLabel(bu)}
              {count != null ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {views.map((bu, i) => {
        const active = selected === bu;
        const count = counts?.[bu];
        const unassigned = bu === WL_BU_UNASSIGNED;
        return (
          <motion.button
            key={bu}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onChange(bu)}
            className={cn(
              'jarvis-menu-card rounded-3xl p-4 border text-left touch-manipulation transition-all',
              active
                ? unassigned
                  ? 'border-amber-400/80 bg-amber-500/10 ring-2 ring-amber-400/40'
                  : 'border-blue-400/80 bg-blue-500/10 ring-2 ring-blue-400/40'
                : 'border-white/70 hover:border-blue-300/50',
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-2xl flex items-center justify-center mb-3',
                unassigned
                  ? 'text-amber-700 bg-amber-500/15'
                  : active
                    ? 'text-blue-700 bg-blue-500/20'
                    : 'text-blue-600 bg-blue-500/12',
              )}
            >
              {unassigned ? <HelpCircle className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div className="font-semibold text-foreground text-base">{wlBuViewLabel(bu)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {count != null ? `พนักงาน ${count} คน` : 'เลือก BU นี้'}
              {unassigned && count ? ' · ตั้ง BU ให้ได้ในหน้าพนักงาน' : ''}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default WlBuSelector;
