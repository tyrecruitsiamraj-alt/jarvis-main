/**
 * ═══ หน้าแรกโฉมใหม่ (เฟส 2) — ชั้นขนานของ `CommandDeck` ═══
 *
 * เจ้าของสั่ง 5 ก.ย. 2569: *"ออกแบบใหม่เลย รื้อแบบเดิมได้"* + *"ไม่เอาทางเทคแล้ว"*
 * และย้ำว่าอยู่บน production: *"ถ้าข้อมูลไม่ครบก็ตายกันพอดี"*
 *
 * 🔴 **กติกาของไฟล์นี้**
 * 1. รับ props **ชุดเดียวกับ `CommandDeck` เป๊ะ** และต้องแสดง **ข้อมูลครบทุกชิ้น**
 *    ที่ของเดิมแสดง — ไล่ทีละอย่าง: วันที่ · นาฬิกา · คำทักทาย+ชื่อคน · หัวข้องานถัดไป ·
 *    เหตุผล · ป้ายสถานะ · ปุ่มไปทำงาน · จำนวนที่รอต่อคิว · ข้อความตอนไม่มีงาน ·
 *    บรรทัดอธิบายว่างานอยู่หน้าไหน · แผนที่สายพาน 4 ขั้น · คิวที่เหลือทุกแถว
 *    (มีเทสต์ `tests/api/homeDeckV2Parity.test.ts` คุมว่าไม่มีอะไรหาย)
 * 2. **ของเดิมไม่ถูกแตะ** — `CommandDeck.tsx` ยังอยู่ครบ เป็นทางถอยเมื่อปิดสวิตช์
 * 3. ไม่มี CSS ใหม่ · ไม่มีแอนิเมชันวนไม่จบ · ไม่มี backdrop-filter (กฎ perf 5 ก.ย. 2569)
 *
 * **ต่างจากของเดิมตรงไหน (คือ "การรื้อ"):**
 *   - ผืนขาวเรียบ ไม่มีกริดจุด/เส้นเรือง/มุมวงเล็บ · ไม่มีป้าย mono ช่องไฟกว้าง
 *   - แถบหัวพูดภาษาคน: "งานถัดไปของคุณ" + "อัปเดตล่าสุด HH:MM" (แทน "สถานะสด")
 *   - วงตัวเลขบางลง อยู่ขวามือคู่กับหุ่นยนต์ · หัวข้องานเป็นพระเอกฝั่งซ้าย
 *   - สายพานเป็นแถวเดียวคั่นเส้นบาง ขั้นปัจจุบันเป็นเบอร์กันดี
 */
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet2, SheetHead2, Rule2 } from '@/components/shared/ui-v2/Sheet2';
import { useNowTick } from '@/hooks/useNowTick';
import { deckStatusLine } from '@/lib/homeDeck';
import { CONVEYOR_STEPS } from '@/lib/soRecruitNav';
import type { NextTask, NextTaskTone } from '@/lib/nextTask';
import { cn } from '@/lib/utils';

/** ⚠️ Intl ระดับโมดูลเสมอ — กติกาโปรเจกต์ (เคยทำหน้าช้า 4.7 วิ มีเทสต์คุม) */
const CLOCK_FMT = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const DATE_FMT = new Intl.DateTimeFormat('th-TH', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** สีของป้ายสถานะ — ความหมายเดิมทั้งหมด (ไม่ใช่สีแบรนด์ จึงไม่ถูกเปลี่ยน) */
const TONE_TEXT: Record<NextTaskTone | 'ok', string> = {
  danger: 'text-red-700 dark:text-red-300',
  warn: 'text-amber-700 dark:text-amber-300',
  info: 'text-sky-700 dark:text-sky-300',
  ok: 'text-emerald-700 dark:text-emerald-300',
};

/**
 * นาฬิกาอยู่ component ของตัวเอง — ของเดิมเคยลากทั้งแผงเรนเดอร์ใหม่ทุกวินาที
 * (บทเรียน perf 5 ก.ย. 2569) · โฉมใหม่เขียนเป็น "วันที่ · อัปเดตล่าสุด HH:MM"
 */
const DeckStamp: React.FC = () => {
  const now = useNowTick(true);
  return (
    <>
      <span className="hidden sm:inline">{DATE_FMT.format(now)} · </span>
      อัปเดตล่าสุด <span className="tabular-nums">{CLOCK_FMT.format(now)}</span>
    </>
  );
};

/** หุ่นยนต์ผู้ช่วย — ไฟล์เดียวกับของเดิม (พื้นหลังถูกลบออกจากตัวไฟล์แล้ว) */
const Mascot: React.FC = () => (
  <img
    src="/robot-mascot.webp"
    alt=""
    aria-hidden
    className="pointer-events-none hidden w-[132px] select-none xl:block"
  />
);

const HomeDeckV2: React.FC<{
  greeting: string;
  userName: string;
  tasks: NextTask[];
  statusInput: Parameters<typeof deckStatusLine>[0];
  loading?: boolean;
  className?: string;
}> = ({ greeting, userName, tasks, statusInput, loading, className }) => {
  const [head, ...rest] = tasks;
  /** งานถัดไปอยู่ที่หน้าไหนของลำดับงาน — หาด้วย **คีย์** ไม่ใช่เลขขั้น (กติกาเดิม) */
  const headAt = head ? CONVEYOR_STEPS.findIndex((s) => s.key === head.stepKey) : -1;
  const headLabel = headAt >= 0 ? CONVEYOR_STEPS[headAt].label : '';
  const status = loading
    ? ({ text: 'กำลังโหลดข้อมูล…', tone: 'ok' } as const)
    : deckStatusLine(statusInput);

  return (
    <Sheet2 className={className} aria-label="งานถัดไปของคุณ">
      <SheetHead2 eyebrow="งานถัดไปของคุณ" stamp={<DeckStamp />} />

      {/* ── หัวเรื่องงาน + วงตัวเลข + หุ่นยนต์ ── */}
      <div className="flex flex-wrap items-center gap-8 px-6 pb-7 pt-4 lg:px-8">
        <div className="min-w-[16rem] flex-1">
          <p className="text-[12.5px] text-muted-foreground">
            {greeting}
            {userName ? `, ${userName}` : ''}
          </p>

          {loading ? (
            <div className="mt-3 space-y-3" aria-busy="true">
              <div className="h-8 w-3/4 animate-pulse rounded-lg bg-foreground/5" />
              <div className="h-4 w-1/2 animate-pulse rounded-lg bg-foreground/5" />
            </div>
          ) : head ? (
            <>
              <h1 className="mt-1.5 text-[26px] font-semibold leading-snug tracking-tight lg:text-[32px]">
                {head.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {head.reason}
                <span className={cn('ml-2 text-xs font-medium', TONE_TEXT[head.tone])}>
                  ● {head.badge}
                </span>
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <Button asChild size="lg" className="rounded-full px-7 text-sm font-medium">
                  <Link to={head.path}>
                    {head.action}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                {rest.length > 0 ? (
                  <span className="text-[12.5px] text-muted-foreground">
                    +{rest.length} เรื่องรอต่อคิว
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-1.5 text-[26px] font-semibold leading-snug tracking-tight lg:text-[32px]">
                ไม่มีงานค้างที่ต้องลงมือตอนนี้
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                ถังที่ระบบเฝ้าอยู่ว่างหมด — เปิดภาพรวมด้านล่างเพื่อดูตัวเลขวันนี้
              </p>
            </>
          )}
        </div>

        {/* วงตัวเลข "ต้องลงมือ" — บางลง ไม่หมุน ไม่เรือง */}
        <div className="mx-auto shrink-0 sm:mx-0">
          <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full border border-primary/20 bg-primary/[0.04] text-center">
            <span className="text-[44px] font-semibold leading-none tabular-nums">
              {loading ? '—' : tasks.length}
            </span>
            <span className="mt-1 text-[11.5px] text-muted-foreground">เรื่องต้องลงมือ</span>
          </div>
          <p className={cn('mt-2.5 max-w-36 text-center text-[11.5px]', TONE_TEXT[status.tone as NextTaskTone | 'ok'])}>
            {status.text}
          </p>
        </div>

        <Mascot />
      </div>

      {/* ── แผนที่สายพาน — บอกตำแหน่ง ไม่ใช่แถบความคืบหน้า (กติกาเดิม ห้ามติ๊กถูก) ── */}
      {head ? (
        <>
          <Rule2 />
          <div className="px-6 py-4 lg:px-8">
            <p className="text-[11.5px] text-muted-foreground">
              งานข้างบนอยู่ที่หน้า{' '}
              <span className="font-medium text-foreground">{headLabel}</span> — กดปุ่มข้างบนเพื่อไป
              ทำได้เลย · แถบข้างล่างคือแผนที่สายพานไว้ดูว่าหน้านั้นอยู่ตรงไหน
            </p>
            <ol className="mt-3 flex items-center" aria-label={`งานถัดไปอยู่ที่ ${headLabel}`}>
              {CONVEYOR_STEPS.map((s, i) => {
                const nowStep = i === headAt;
                const Icon = s.icon;
                return (
                  <React.Fragment key={s.key}>
                    {i > 0 ? (
                      <span className="h-px min-w-3 flex-1 bg-border" aria-hidden />
                    ) : null}
                    <li className="flex flex-col items-center gap-1.5 px-1">
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full border',
                          nowStep
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span
                        className={cn(
                          'hidden whitespace-nowrap text-[11px] md:block',
                          nowStep ? 'font-medium text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {s.label}
                      </span>
                    </li>
                  </React.Fragment>
                );
              })}
            </ol>
          </div>
        </>
      ) : null}

      {/* ── คิวที่เหลือ — แถวคั่นเส้นบาง ไม่มีกล่อง ── */}
      {rest.length > 0 ? (
        <>
          <Rule2 />
          <div className="flex items-baseline justify-between px-6 pb-1 pt-4 lg:px-8">
            <span className="text-[12.5px] font-medium text-foreground">คิวของคุณวันนี้</span>
            <span className="text-[11.5px] tabular-nums text-muted-foreground">
              เหลือ {rest.length}
            </span>
          </div>
          <ol>
            {rest.map((t, i) => (
              <li key={t.key} className="border-t border-border/50 first:border-t-0">
                <Link
                  to={t.path}
                  className="group flex items-center gap-4 px-6 py-3 transition-colors hover:bg-accent lg:px-8"
                >
                  <span className="text-xs tabular-nums text-primary/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {t.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{t.reason}</span>
                  </span>
                  <span className={cn('hidden text-[11.5px] sm:block', TONE_TEXT[t.tone])}>
                    {t.badge}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </Sheet2>
  );
};

export default HomeDeckV2;
