/**
 * แถบ "ใบนี้อยู่ขั้นไหน" บนการ์ดกล่องงาน
 *
 * เจ้าของสั่ง 31 ส.ค. 2569 (ส่งภาพบอร์ดงานแปลเกมมาเป็นตัวอย่าง):
 * > *"หน้ากล่องงานทำแบบนี้ก็ดี จะได้รู้ว่าใบไหนอยู่ขั้นตอนไหน
 * >  100% คือถึงแค่ส่งประกาศไปหน้าสาธารณะ ก็พอนะ"*
 *
 * 🔴 **เจ้าหน้าที่เท่านั้น** — คนนอกที่เปิดหน้าสมัครงานไม่ต้องรู้ว่าเราทำงานถึงขั้นไหน
 * (การ์ดตัวเดียวกันถูกใช้ทั้งบอร์ดเจ้าหน้าที่และหน้าสาธารณะ ผ่าน `variant`)
 *
 * 🔴 **ห้ามใส่เครื่องหมายถูก** — บ้านนี้ถอดติ๊กถูกออกไปสองรอบแล้ว (ติ๊กถูก = อ้างว่าเสร็จ
 * ทั้งที่ระบบไม่มีหลักฐานว่าใครทำ) ⇒ โชว์ **เลขขั้น** เสมอ ขั้นที่ทำแล้วใช้ "สีเข้ม" บอกแทน
 *
 * เลข % กับขั้นมาจาก `releaseProgressOf()` ที่เดียว — ห้ามคำนวณซ้ำในไฟล์นี้
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { RELEASE_STEP_ORDER, type ReleaseProgress } from '@/lib/boardRelease';

type Props = {
  progress: ReleaseProgress;
  className?: string;
};

const BoardCardProgress: React.FC<Props> = ({ progress, className }) => {
  const { currentStep, doneSteps, totalSteps, released, percent, label } = progress;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* แถวเลขขั้น — เส้นเชื่อมบอกว่าเป็นลำดับ ไม่ใช่ป้ายลอย ๆ */}
      <div className="flex items-center gap-1" aria-hidden>
        {RELEASE_STEP_ORDER.map((key, i) => {
          const no = i + 1;
          const done = no <= doneSteps;
          const current = !released && no === currentStep;
          return (
            <React.Fragment key={key}>
              {i > 0 ? (
                <span
                  className={cn(
                    'h-px flex-1 rounded-full',
                    no <= doneSteps ? TONE.success.dot : 'bg-slate-200 dark:bg-slate-700',
                  )}
                />
              ) : null}
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
                  done
                    ? cn(TONE.success.dot, 'text-white')
                    : current
                      ? cn(
                          'bg-white text-blue-800 ring-2 ring-blue-500',
                          'dark:bg-slate-900 dark:text-blue-300 dark:ring-blue-400',
                        )
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
                )}
              >
                {no}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* บรรทัดคำ — บอกว่าอยู่ขั้นไหนและต้องทำอะไร (ป้ายเป็นคำกริยาอยู่แล้วใน RELEASE_STEP_TEXT) */}
      <p className={cn('text-[11px] leading-4', DASH.muted)}>
        {released ? (
          <span className={cn('font-semibold', TONE.success.value)}>{label}</span>
        ) : (
          <>
            <span className="font-semibold">
              ขั้น {currentStep}/{totalSteps}
            </span>
            {' · '}
            <span>{label}</span>
          </>
        )}
      </p>

      {/* แถบความคืบหน้า — ปลายทาง 100% คือ "ปล่อยขึ้นหน้าสาธารณะ" ไม่ใช่ "หาคนได้" */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={cn('h-full rounded-full transition-all', TONE.success.dot)}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className={cn('shrink-0 text-[11px] font-bold tabular-nums', DASH.muted)}>
          {percent}%
        </span>
      </div>
    </div>
  );
};

export default BoardCardProgress;
