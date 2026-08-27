/**
 * แถบเส้นทางงานบนหน้ากล่องงาน — **เส้นเดียว ไล่ซ้ายไปขวาจนจบ**
 * (เจ้าของสั่งรื้อ 27 ส.ค. 2569: *"ทำเป็นเส้นบอกเลย ... ตอนนี้เละเทะไปหมด"*)
 *
 * เส้นนี้ **แทนที่ของเดิม 3 ชุด**: กล่องสถานะ 6 กล่อง · แถบหน้าสาธารณะ · แถบผู้สมัคร
 * (ทั้งสามพูดเรื่องเดียวกันคนละมุม — เหตุผลเต็มอยู่หัวไฟล์ `src/lib/boardFlow.ts`)
 *
 * 🔴 กติกาบนจอ:
 * 1. **กดขั้นไหนก็กรองการ์ดข้างล่างในหน้าเดิม** ไม่เด้งไปหน้าอื่น · กดซ้ำ = ล้าง
 * 2. **ทุกใบอยู่ขั้นเดียว** ⇒ ผลรวมทุกขั้น = จำนวนใบทั้งหมด · มีบรรทัดสรุปบอกไว้ให้ตรวจได้
 * 3. ขั้นที่มีงานให้ลงมือ (รอตรวจ · รอปล่อย · มีคนสมัคร) เด่นกว่าขั้นที่แค่รอ/จบแล้ว
 * 4. ใบที่จบแล้ว (ปิด/ยกเลิก) อยู่ท้ายเส้นและจางลง — ยังกดดูได้ แต่ไม่แย่งสายตา
 */
import * as React from 'react';
import { ChevronRight } from 'lucide-react';

import { DASH, TONE } from '@/lib/designTokens';
import type { BoardStage, BoardStageKey } from '@/lib/boardFlow';
import { cn } from '@/lib/utils';

export type BoardFlowStripProps = {
  stages: BoardStage[];
  active: BoardStageKey | null;
  onPick: (stage: BoardStageKey | null) => void;
  /** ปุ่มลงมือที่แปะท้ายเส้น เช่น "ปล่อยขึ้นหน้าสมัคร (125)" */
  action?: React.ReactNode;
  className?: string;
};

const BoardFlowStrip: React.FC<BoardFlowStripProps> = ({
  stages,
  active,
  onPick,
  action,
  className,
}) => {
  const openTotal = stages.filter((s) => !s.done).reduce((n, s) => n + s.count, 0);
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
        {stages.map((stage, i) => {
          const on = active === stage.key;
          /* มีงานให้ทำ = โทนเตือน · แต่ 0 ใบไม่ต้องเตือน (ไม่มีอะไรให้ทำ) */
          const alert = Boolean(stage.actionable) && stage.count > 0;
          return (
            <React.Fragment key={stage.key}>
              {i > 0 ? (
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    stage.done ? 'text-slate-200 dark:text-slate-800' : 'text-slate-300 dark:text-slate-700',
                  )}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                onClick={() => onPick(on ? null : stage.key)}
                aria-pressed={on}
                title={stage.hint}
                className={cn(
                  'inline-flex items-baseline gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors',
                  on
                    ? 'border-primary bg-primary/10 text-foreground'
                    : cn(
                        'border-transparent',
                        alert
                          ? cn(TONE.warn.soft, TONE.warn.softHover)
                          : stage.done
                            ? 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800'
                            : 'bg-slate-100/70 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:hover:bg-slate-800',
                      ),
                )}
              >
                <span
                  className={cn(
                    'whitespace-nowrap font-medium',
                    alert ? TONE.warn.value : stage.done ? DASH.cellMuted : DASH.cell,
                  )}
                >
                  {stage.label}
                </span>
                <span
                  className={cn(
                    'font-mono text-sm font-bold tabular-nums',
                    alert ? TONE.warn.num : stage.done ? DASH.cellMuted : DASH.cellStrong,
                  )}
                >
                  {stage.count.toLocaleString('th-TH')}
                </span>
                {/* เลขรอง เช่น "(3 คน)" — ปลายทางต้องบอกผลลัพธ์เป็นหัวคนด้วย
                    (เจ้าของขอ: "บอกตัวเลขที่กรอกเข้ามาด้วยก็ดี") */}
                {stage.sub ? (
                  <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                    ({stage.sub})
                  </span>
                ) : null}
              </button>
            </React.Fragment>
          );
        })}
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>

      {/* 🔴 บรรทัดนี้คือสิ่งที่ทำให้คนใหม่เชื่อเลขได้ — ทุกใบอยู่ขั้นเดียว บวกกันแล้วครบพอดี
          (ของเดิมมีสี่ชั้นที่เลขซ้อนกัน บวกยังไงก็ไม่ลงตัว) */}
      <p className="text-[11px] text-muted-foreground">
        ใบขอที่เปิดอยู่ {openTotal.toLocaleString('th-TH')} ใบ กระจายอยู่ตามขั้นข้างบน —
        หนึ่งใบอยู่ได้ขั้นเดียว บวกทุกขั้นแล้วครบพอดี · กดขั้นไหนเพื่อดูเฉพาะใบในขั้นนั้น
      </p>
    </div>
  );
};

export default BoardFlowStrip;
