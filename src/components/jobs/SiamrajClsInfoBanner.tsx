import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SIAMRAJ_CLS_INFO, SIAMRAJ_CONTRACT_TYPES } from '@/lib/siamrajContractTypes';

const SiamrajClsInfoBanner: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/8 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          {SIAMRAJ_CLS_INFO.title}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open ? (
        <div className="px-4 pb-4 pt-0 space-y-3 text-sm text-muted-foreground border-t border-blue-500/10">
          <p>{SIAMRAJ_CLS_INFO.summary}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              ฟิลด์: <span className="text-foreground font-mono text-xs">{SIAMRAJ_CLS_INFO.field}</span>
            </li>
            <li>
              ตารางอ้างอิง: <span className="text-foreground font-mono text-xs">{SIAMRAJ_CLS_INFO.masterTable}</span>
            </li>
            <li>{SIAMRAJ_CLS_INFO.jarvisPolicy}</li>
          </ul>

          <div>
            <p className="text-xs font-medium text-foreground mb-2">ประเภทสัญญาในระบบ</p>
            <div className="flex flex-wrap gap-2">
              {SIAMRAJ_CONTRACT_TYPES.map((t) => (
                <span
                  key={t.code}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border',
                    t.code === 'C'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-800'
                      : 'border-border bg-secondary/50 text-foreground',
                  )}
                >
                  {t.code} — {t.name}
                  {t.code === 'C' ? ' (Cls)' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SiamrajClsInfoBanner;
