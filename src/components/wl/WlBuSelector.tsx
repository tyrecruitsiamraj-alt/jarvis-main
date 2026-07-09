import React from 'react';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WL_BU_CODES, wlBuLabel, type WlBuCode } from '@/lib/wlBuState';

type WlBuSelectorProps = {
  selected: WlBuCode;
  onChange: (bu: WlBuCode) => void;
  counts?: Partial<Record<WlBuCode, number>>;
  variant?: 'cards' | 'pills';
  className?: string;
};

const WlBuSelector: React.FC<WlBuSelectorProps> = ({
  selected,
  onChange,
  counts,
  variant = 'cards',
  className,
}) => {
  if (variant === 'pills') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {WL_BU_CODES.map((bu) => {
          const active = selected === bu;
          const count = counts?.[bu];
          return (
            <button
              key={bu}
              type="button"
              onClick={() => onChange(bu)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {wlBuLabel(bu)}
              {count != null ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {WL_BU_CODES.map((bu, i) => {
        const active = selected === bu;
        const count = counts?.[bu];
        return (
          <motion.button
            key={bu}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onChange(bu)}
            className={cn(
              'jarvis-menu-card rounded-[1.5rem] p-4 border text-left touch-manipulation transition-all',
              active
                ? 'border-blue-400/80 bg-blue-500/10 ring-2 ring-blue-400/40'
                : 'border-white/70 hover:border-blue-300/50',
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-2xl flex items-center justify-center mb-3',
                active ? 'text-blue-700 bg-blue-500/20' : 'text-blue-600 bg-blue-500/12',
              )}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div className="font-semibold text-foreground text-base">{wlBuLabel(bu)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {count != null ? `พนักงาน ${count} คน` : 'เลือก BU นี้'}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default WlBuSelector;
