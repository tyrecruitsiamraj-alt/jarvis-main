/**
 * Command Deck — หน้าแรกทั้งผืนเป็นจอบัญชาการเดียว (เจ้าของสั่งรอบสอง 26 ส.ค. 2569)
 *
 * 🔴 บทเรียนจากรอบที่ถูกตีตก (*"รก ไม่สวย"*): การ์ดมืดใบเล็กหลายใบบนหน้าขาว = รก
 * ตัวอย่างที่เจ้าของให้ (cayla-flax.vercel.app) สวยเพราะเป็น**ผืนเดียวทั้งจอ**
 *
 * กติกาความสวยที่ยึดทั้งไฟล์:
 * 1. **ผืนเดียว** — ทุก section อยู่ใน canvas ink เดียว คั่นด้วยเส้น 1px เท่านั้น
 *    ห้ามมีกล่องมีเงาซ้อนข้างใน (ยกเว้นปุ่มกับ tile ขั้นซึ่งเป็นของกดได้)
 * 2. **โฟกัสเดียว** — หน้าปัดวงแหวน + งานถัดไป คือพระเอก ที่เหลือเป็นตัวประกอบ
 * 3. **mono เล็ก ตัวพิมพ์ห่าง** สำหรับป้ายทุกป้าย · ตัวเลขทุกตัว tabular
 * 4. **ที่ว่างคือของแพง** — padding กว้าง ไม่ยัด
 * 5. สี: **เบอร์กันดี + กรมท่า** (จานเดียวกับหน้า Login · เจ้าของสั่ง 5 ก.ย. 2569
 *    *"เอาโทนสี เอา Style ไปปรับใช้กับทั้งระบบ"*) · แดงเฉพาะของด่วนจริง · ที่เหลือ slate
 *    ⚠️ ของเดิมเป็น teal/sky ซึ่งเป็นคนละจานกับที่เจ้าของเคาะ ⇒ เปลี่ยนหมดแล้ว
 *    🔴 สีที่มีความหมาย (danger/warn/info ของงาน) ไม่ถูกแตะ — เป็นภาษาของตัวเลข
 *
 * โครง: แถบหัว (โลโก้+สถานะสด+นาฬิกา) → hero (หน้าปัด | งานถัดไป) →
 * คิวที่เหลือ → แถบ 6 ขั้น · ตรรกะอยู่ src/lib/homeDeck.ts + nextTask.ts (pure + เทสต์)
 */
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNowTick } from '@/hooks/useNowTick';
import { deckStatusLine } from '@/lib/homeDeck';
import { CONVEYOR_STEPS } from '@/lib/soRecruitNav';
import type { NextTask, NextTaskTone } from '@/lib/nextTask';

/** ⚠️ Intl ระดับโมดูลเสมอ — กติกาโปรเจกต์ (เคยทำหน้าช้า 4.7 วิ มีเทสต์คุม) */
const CLOCK_FMT = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const DATE_FMT = new Intl.DateTimeFormat('th-TH', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const TONE_TEXT: Record<NextTaskTone | 'ok', string> = {
  danger: 'text-red-700 dark:text-red-300',
  warn: 'text-amber-700 dark:text-amber-300',
  info: 'text-sky-700 dark:text-sky-300',
  ok: 'text-emerald-700 dark:text-emerald-300',
};

/** ป้าย mono ตัวพิมพ์ห่าง — ภาษาป้ายเดียวของทั้ง deck */
const eyebrow = 'font-mono text-[10px] font-semibold uppercase tracking-[0.22em]';

/* ── หน้าปัดวงแหวน — พระเอกของหน้า ────────────────────────────────────────── */

const DIAL = 420; // viewBox หน่วยเดียว (สเกลด้วย CSS width)
const C = DIAL / 2;

/** ขีดสเกลรอบนอก 72 ขีด — ทุกขีดที่ 6 ยาวและสว่างขึ้น (แบบหน้าปัดเครื่องมือวัดจริง) */
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 72 - Math.PI / 2;
  const major = i % 6 === 0;
  const r1 = major ? 186 : 192;
  const r2 = 199;
  return {
    x1: C + r1 * Math.cos(a),
    y1: C + r1 * Math.sin(a),
    x2: C + r2 * Math.cos(a),
    y2: C + r2 * Math.sin(a),
    major,
  };
});

const HEX_POINTS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  return `${C + 118 * Math.cos(a)},${C + 118 * Math.sin(a)}`;
}).join(' ');

const Dial: React.FC<{ tasksLeft: number | null; status: { text: string; tone: string } }> = ({
  tasksLeft,
  status,
}) => (
  <div className="relative mx-auto w-72 shrink-0 lg:w-80">
    <svg viewBox={`0 0 ${DIAL} ${DIAL}`} className="block w-full" role="presentation" aria-hidden>
      <defs>
        <radialGradient id="deck-core-glow">
          <stop offset="0%" stopColor="rgb(94 234 212 / 0.20)" />
          <stop offset="60%" stopColor="rgb(56 189 248 / 0.07)" />
          <stop offset="100%" stopColor="rgb(94 234 212 / 0)" />
        </radialGradient>
      </defs>

      <circle cx={C} cy={C} r={190} fill="url(#deck-core-glow)" />

      {/* สเกลขีดนิ่งรอบนอก */}
      {TICKS.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          strokeWidth={t.major ? 2 : 1}
          className={t.major ? 'stroke-slate-500/50 dark:stroke-slate-300/40' : 'stroke-slate-400/40 dark:stroke-slate-500/30'}
        />
      ))}

      {/* วงหมุน 3 ชั้น คนละทิศคนละความเร็ว */}
      <g className="jarvis-core-spin-slow">
        <circle
          cx={C}
          cy={C}
          r={172}
          fill="none"
          strokeWidth="1"
          className="stroke-rose-900/35 dark:stroke-rose-300/35"
          strokeDasharray="2 9"
        />
      </g>
      <g className="jarvis-core-spin-rev">
        <circle
          cx={C}
          cy={C}
          r={150}
          fill="none"
          strokeWidth="3"
          className="stroke-slate-500/45 dark:stroke-slate-300/35"
          strokeDasharray="70 34 16 34 8 46"
          strokeLinecap="round"
        />
      </g>
      <g className="jarvis-core-spin-fast">
        <circle
          cx={C}
          cy={C}
          r={128}
          fill="none"
          strokeWidth="1.5"
          className="stroke-rose-900/50 dark:stroke-rose-300/50"
          strokeDasharray="1 7"
        />
        <line
          x1={C}
          y1={C - 133}
          x2={C}
          y2={C - 119}
          strokeWidth="3"
          className="stroke-rose-900 dark:stroke-rose-300"
          strokeLinecap="round"
        />
      </g>

      <polygon points={HEX_POINTS} fill="none" strokeWidth="1" className="stroke-slate-500/30 dark:stroke-slate-300/25" />
      <circle cx={C} cy={C} r={96} fill="none" strokeWidth="1" className="stroke-slate-900/15 dark:stroke-white/12" />
      <circle cx={C} cy={C} r={78} className="fill-rose-900/5 dark:fill-rose-300/5 jarvis-core-breathe" />
    </svg>

    {/* ใจกลาง: ตัวเลขเดียว — เหลือกี่เรื่องที่ต้องลงมือ */}
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <span className={cn(eyebrow, 'text-slate-500 dark:text-slate-400')}>ต้องลงมือ</span>
      <span className="font-mono text-6xl font-semibold tabular-nums leading-none text-slate-900 dark:text-white">
        {tasksLeft === null ? '—' : tasksLeft}
      </span>
      <span className={cn(eyebrow, 'mt-1 text-slate-500 dark:text-slate-500')}>เรื่อง</span>
    </div>

    {/* บรรทัดสถานะใต้หน้าปัด */}
    <p className={cn('mt-1 text-center text-xs', TONE_TEXT[status.tone as NextTaskTone | 'ok'])}>
      {status.text}
    </p>
  </div>
);



/**
 * 🔴 **นาฬิกาต้องอยู่ component ของตัวเอง** (5 ก.ย. 2569 — เจ้าของแจ้ง *"เว็บกระตุก"*)
 * ของเดิมเรียก `useNowTick` ไว้ที่ตัว deck ⇒ **ทั้งแผงเรนเดอร์ใหม่ทุก 1 วินาที**
 * รวมหน้าปัด SVG ที่มีขีด 72 เส้น + วงแหวน + รายการงาน ทั้งที่มีแค่ตัวเลขวินาทีที่เปลี่ยน
 * ⇒ แยกออกมา เรนเดอร์ใหม่เฉพาะสองบรรทัดนี้
 */
const DeckClock: React.FC = () => {
  const now = useNowTick(true);
  return (
    <>
      <span className="hidden font-mono text-[11px] text-slate-500 dark:text-slate-500 sm:block">
        {DATE_FMT.format(now)}
      </span>
      <span className="font-mono text-sm font-medium tabular-nums text-slate-800 dark:text-slate-200">
        {CLOCK_FMT.format(now)}
      </span>
    </>
  );
};

/* ── หุ่นยนต์ผู้ช่วย ────────────────────────────────────────────────────────
 * เจ้าของสั่ง 5 ก.ย. 2569: *"หุ่นยนต์เอาไปใส่ในหน้าหลัก แล้วเอาพื้นหลังหุ่นออก
 * จะได้ดูไม่เอามาวางเฉย ๆ ดูมีชีวิตขึ้นหน่อย"*
 *
 * 🔴 **พื้นหลังถูกลบออกจากตัวไฟล์แล้ว** (ไม่ใช่ซ่อนด้วย CSS) — ไฟล์ต้นทางเป็นวิดีโอ
 * พื้นขาว วางบน deck พื้นเข้มแล้วเป็นสี่เหลี่ยมขาวโพลน · แปลงเป็น **WebP เคลื่อนไหว
 * ที่มีช่องโปร่งใส** `public/robot-mascot.webp` (0.66 MB · เล็กกว่าวิดีโอเดิม 4 เท่า)
 * · `public/robot-mascot.png` เป็นภาพนิ่งสำหรับเครื่องที่ตั้ง "ลดการเคลื่อนไหว"
 * · เก็บไฟล์เอง ไม่ดึงจาก CDN คนอื่น — เว็บนอกล่มแล้วหน้าหลักต้องไม่พัง
 * 🔴 เป็นของประดับล้วน ๆ (`aria-hidden`) ไม่กินคลิก และซ่อนบนจอแคบ
 */
const RobotMascot: React.FC = () => {
  const reduceMotion = useReducedMotion();
  return (
    <div className="pointer-events-none relative hidden w-[170px] shrink-0 justify-self-end xl:block">
      {/* แสงนวลหนุนหลัง — ไม่ให้ตัวหุ่นลอยอยู่บนความว่าง */}
      <span
        className="absolute inset-x-2 bottom-2 top-8 rounded-full bg-rose-300/10 blur-2xl"
        aria-hidden
      />
      <motion.img
        src={reduceMotion ? '/robot-mascot.png' : '/robot-mascot.webp'}
        alt=""
        aria-hidden
        className="relative block w-full select-none"
        animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
        transition={reduceMotion ? undefined : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
};

/* ── Deck ─────────────────────────────────────────────────────────────────── */

const CommandDeck: React.FC<{
  greeting: string;
  userName: string;
  tasks: NextTask[];
  statusInput: Parameters<typeof deckStatusLine>[0];
  loading?: boolean;
  className?: string;
}> = ({ greeting, userName, tasks, statusInput, loading, className }) => {
  const [head, ...rest] = tasks;
  /**
   * งานถัดไปอยู่ที่หน้าไหนของลำดับงาน — หาด้วย **คีย์** ไม่ใช่เลขขั้น
   * (เจ้าของสั่งเลิกใช้เลขขั้น 28 ส.ค. 2569 · `-1` = ถังนี้ไม่ได้อยู่ในลำดับ)
   */
  const headAt = head ? CONVEYOR_STEPS.findIndex((s) => s.key === head.stepKey) : -1;
  const headLabel = headAt >= 0 ? CONVEYOR_STEPS[headAt].label : '';
  const status = loading
    ? ({ text: 'กำลังเชื่อมข้อมูล…', tone: 'ok' } as const)
    : deckStatusLine(statusInput);

  return (
    /**
     * 🔴 **เปลือกเป็น `Card` ของ shadcn** (4 ก.ย. 2569 — เจ้าของสั่งปรับหน้าหลัก
     * ให้เป็นมาตรฐานโดยใช้ shadcn คุม) · สกินพื้นเข้มยังเป็นคลาสเดิมที่เจ้าของเคาะไว้
     * ⚠️ **ห้ามเขียน CSS ใหม่** (สั่ง 4 ก.ย. 2569) — ที่นี่แค่ใช้คลาสที่มีอยู่แล้วต่อไป
     */
    <Card
      className={cn('jarvis-deck overflow-hidden rounded-2xl', className)}
      aria-label="ศูนย์บัญชาการงานวันนี้"
    >
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <span key={c} className="jarvis-hud-corner" data-c={c} aria-hidden />
      ))}
      <div className="jarvis-hud-scan" aria-hidden />

      {/* ── แถบหัว: ระบบ · สถานะสด · วันเวลาเดินวินาที ── */}
      <div className="relative flex items-center gap-3 border-b border-slate-900/10 px-6 py-3.5 dark:border-white/10 lg:px-9">
        <span className={cn(eyebrow, 'text-rose-900 dark:text-rose-300')}>SO RECRUIT</span>
        {/* ชิปสถานะ = Badge ของ shadcn (เดิมวาดกรอบ/มุมเอง) */}
        {/* ⚠️ จุด "สถานะสด" ยังเป็น**เขียว** — เป็นความหมาย (ระบบยังเดินอยู่) ไม่ใช่สีแบรนด์ */}
        <Badge variant="outline" className="gap-1.5 px-2.5 py-0.5">
          <span
            className="jarvis-core-breathe h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
            aria-hidden
          />
          <span className={cn(eyebrow, 'text-muted-foreground')}>สถานะสด</span>
        </Badge>
        <span className="flex-1" />
        <DeckClock />
      </div>

      {/* ── Hero: หน้าปัด | งานถัดไป ── */}
      {/* 🔴 หุ่นยนต์เป็น **คอลัมน์จริง** ของ grid (ไม่ใช่ absolute ทับของเดิม) —
          จอ xl ขึ้นไปถึงจะขึ้น ไม่งั้นเบียดหัวเรื่องงานถัดไป */}
      <div className="relative grid items-center gap-8 px-6 py-8 lg:grid-cols-[auto,1fr] lg:gap-16 lg:px-9 lg:py-10 xl:grid-cols-[auto,1fr,auto]">
        <Dial tasksLeft={loading ? null : tasks.length} status={status} />

        <div className="min-w-0">
          <p className={cn(eyebrow, 'text-slate-500 dark:text-slate-400')}>
            {greeting}, {userName} — งานถัดไปของคุณ
          </p>

          {loading ? (
            <div className="mt-4 space-y-3" aria-busy="true">
              <div className="h-9 w-3/4 animate-pulse rounded-lg bg-slate-900/5 dark:bg-white/5" />
              <div className="h-4 w-1/2 animate-pulse rounded-lg bg-slate-900/5 dark:bg-white/5" />
            </div>
          ) : head ? (
            <>
              <h1 className="mt-3 text-2xl font-bold leading-snug tracking-tight lg:text-[34px] lg:leading-[1.25]">
                {head.title}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {head.reason}
                <span className={cn('ml-2 font-mono text-xs', TONE_TEXT[head.tone])}>
                  ● {head.badge}
                </span>
              </p>
              <div className="mt-6 flex items-center gap-4">
                <Button
                  asChild
                  /* 🔴 ใช้ปุ่มมาตรฐานของธีม (สีหลัก = เบอร์กันดี) ไม่ปั้นไล่เฉดเอง
                     — ของเดิมเป็นไล่เฉดฟ้า→เขียวพร้อมเงาสีที่เขียน rgba ดิบในคลาส */
                  size="lg"
                  className="rounded-xl px-6 text-sm font-semibold"
                >
                  <Link to={head.path}>
                    {head.action}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                {rest.length > 0 ? (
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-500">
                    +{rest.length} เรื่องรอต่อคิว
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-3 text-2xl font-bold leading-snug tracking-tight lg:text-[34px]">
                ไม่มีงานค้างที่ต้องลงมือตอนนี้
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                ถังที่ระบบเฝ้าอยู่ว่างหมด — เปิดภาพรวมด้านล่างเพื่อดูตัวเลขวันนี้
              </p>
            </>
          )}

          {/* งานนี้อยู่ขั้นไหนของสายพาน — **แผนที่บอกตำแหน่ง ไม่ใช่แถบความคืบหน้า**
              🔴 เดิมติ๊กถูก (✓) ทุกขั้นก่อนหน้า เพราะคิดว่าเป็น stepper ⇒ คนใหม่อ่านว่า
              "ใบขอ/ประกาศรับ/ผู้สมัคร/จับคู่ เสร็จหมดแล้ว" ทั้งที่บอร์ดใต้ลงมาบอกว่า
              ยังไม่ประกาศ 123 ใบ · ยังไม่มีใครสมัคร 298 ใบ (audit คนใหม่ 26 ส.ค. 2569)
              ตอนนี้ขั้นก่อนหน้าเป็นเลขจาง ๆ เฉย ๆ — ไม่มีอะไรอ้างว่าเสร็จแล้ว */}
          {/* 🔴 เขียนแบบ "อ่านแล้วรู้ว่าทำอะไร" (แผนแก้จุดงงข้อ 5 · 2 ก.ย. 2569)
              ประโยคเดิม "งานถัดไป: ติดตาม — ไม่ได้แปลว่าอันก่อนหน้าทำเสร็จ" ทำ Haiku
              ถามกลับว่า "ต้องกดไปเลยไหม? อันก่อนหน้าคืออะไร?" — ประโยคปฏิเสธซ้อนอ่านยาก */}
          {head ? (
            <p className="mt-8 text-[10px] text-slate-500 dark:text-slate-500">
              งานข้างบนอยู่ที่หน้า <span className="font-medium text-slate-700 dark:text-slate-300">{headLabel}</span>{' '}
              — กดปุ่มข้างบนเพื่อไปทำได้เลย · แถบข้างล่างคือแผนที่สายพานไว้ดูว่าหน้านั้นอยู่ตรงไหน
            </p>
          ) : null}
          {head ? (
            <ol className="mt-2 flex items-center" aria-label={`งานถัดไปอยู่ที่ ${headLabel}`}>
              {CONVEYOR_STEPS.map((s, i) => {
                const before = i < headAt;
                const nowStep = i === headAt;
                return (
                  <React.Fragment key={s.key}>
                    {i > 0 ? (
                      /* เส้นเชื่อมเป็นเส้นจาง ๆ เท่ากันหมด — เส้นที่ "ทึบถึงขั้นนี้"
                         คือภาษาของแถบความคืบหน้า ซึ่งไม่ใช่สิ่งที่แถบนี้บอก */
                      <span className="h-px min-w-3 flex-1 bg-slate-900/10 dark:bg-white/10" aria-hidden />
                    ) : null}
                    <li className="flex flex-col items-center gap-1.5 px-1">
                      {/* 🔴 ไอคอนแทนเลขขั้น (เจ้าของสั่ง 28 ส.ค. 2569) */}
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-full border',
                          nowStep
                            ? 'border-rose-900 text-rose-900 dark:border-rose-300 dark:text-rose-200'
                            : before
                              ? 'border-slate-900/15 text-slate-400 dark:border-white/15 dark:text-slate-600'
                              : 'border-slate-900/15 text-slate-500 dark:border-white/15 dark:text-slate-500',
                        )}
                      >
                        <s.icon className="h-3 w-3" aria-hidden />
                      </span>
                      <span
                        className={cn(
                          'hidden whitespace-nowrap text-[10px] md:block',
                          nowStep ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-500',
                        )}
                      >
                        {s.label}
                      </span>
                    </li>
                  </React.Fragment>
                );
              })}
            </ol>
          ) : null}
        </div>

        <RobotMascot />
      </div>

      {/* ── คิวที่เหลือ — แถวบาง คั่นเส้น ไม่มีกล่อง ── */}
      {rest.length > 0 ? (
        <div className="relative border-t border-slate-900/10 dark:border-white/10">
          <div className="flex items-baseline justify-between px-6 pb-1 pt-4 lg:px-9">
            <span className={cn(eyebrow, 'text-slate-500 dark:text-slate-400')}>คิวของคุณวันนี้</span>
            <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-500">
              เหลือ {rest.length}
            </span>
          </div>
          <ol>
            {rest.map((t, i) => (
              <li key={t.key}>
                <Link
                  to={t.path}
                  className="group flex items-center gap-4 px-6 py-3 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/5 lg:px-9"
                >
                  <span className="font-mono text-xs tabular-nums text-rose-900/70 dark:text-rose-300/60">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {t.title}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-500">{t.reason}</span>
                  </span>
                  <span className={cn('hidden font-mono text-[11px] sm:block', TONE_TEXT[t.tone])}>
                    {t.badge}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-rose-900 dark:text-slate-600 dark:group-hover:text-rose-300"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* 🔴 แถบ tile 6 ขั้นเคยอยู่ตรงนี้ — **เจ้าของสั่งถอด 26 ส.ค. 2569**
          เหตุ: หน้าแรกมีปุ่มนำทาง **สองชุดพาไปหน้าเดียวกัน** (tile 6 ขั้น กับ
          ก้อนทีม 4 ใบใต้ deck) กด "ทีมสรรหา" กับกด tile "ผู้สมัคร" ได้หน้าเดียวกันเป๊ะ
          แถมชื่อที่กดไม่ตรงชื่อหน้าปลายทาง ⇒ เจ้าของกดแล้วงง
          👉 เคาะว่า **เก็บก้อนทีม เอาตัวเลขจาก tile ไปใส่ในก้อนทีมแทน**
          ⚠️ เลขทั้ง 6 ขั้นไม่หาย — เมนูสายพานซ้ายมือมี badge ครบอยู่แล้ว
          และเลขที่ใช้บ่อยถูกยกไปอยู่บนก้อนทีม (ดู TeamNavRow) */}
    </Card>
  );
};

export default CommandDeck;
