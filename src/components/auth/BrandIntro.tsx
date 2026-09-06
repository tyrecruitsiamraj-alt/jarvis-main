import * as React from 'react';

import { INTRO_SCENE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * **ฉากเปิด — ตัวอักษร "SO RECRUIT" พุ่งเข้าทีละตัว** แล้วค่อยเผยหน้าเข้าสู่ระบบ
 * (เทคนิคนี้เรียก *staggered text reveal* · ฉากที่คลุมก่อนเข้าหน้าจริงเรียก *splash/intro*)
 *
 * เจ้าของสั่ง 6 ก.ย. 2569: *"ตอนเข้า Web ไม่เห็นคำว่า So Recruit เด้งก่อนแล้วค่อยไปหน้า Login"*
 * ⇒ เปลี่ยนจาก "โชว์ครั้งเดียวต่อการเปิดเบราว์เซอร์" เป็น **เล่นทุกครั้งที่เข้าหน้านี้**
 * (ความกังวลเรื่องน่ารำคาญที่เคยมีตอน 4 ก.ย. 2569 ตกไป เพราะพนักงานที่ล็อกอินค้างไว้แล้ว
 * ไม่ผ่านหน้านี้อยู่แล้ว — เห็นฉากนี้เฉพาะตอนต้องกรอกฟอร์มเข้าสู่ระบบจริง ๆ)
 *
 * 🔴 กติกาที่ยึดไว้:
 * 1. **สั้น** — ตัวอักษรพุ่งครบใน ~0.62 วิ · ฉากจางหมดที่ ~0.95 วิ
 * 2. **ข้ามได้ทุกทาง** — แตะ/คลิก/กดคีย์/เริ่มพิมพ์ = จางทันที
 * 3. **เล่นทุกครั้งที่ component mount** (ไม่มี sessionStorage จำการดูอีกต่อไป)
 * 4. **ไม่หน่วงของจริง** — ฟอร์มล็อกอินเรนเดอร์อยู่ข้างหลังแล้ว ฉากนี้เป็นแค่ผ้าคลุมที่จางออก
 * 5. เครื่องที่ตั้ง "ลดการเคลื่อนไหว" = ไม่โชว์เลย (ยกเว้นบังคับด้วย `?intro=1`)
 * 6. **ไม่มี CSS ใหม่** (กฎเจ้าของ 4 ก.ย. 2569) — ใช้ `animate-in` ของ tailwindcss-animate
 *    + `transition` + `animationDelay` แบบ inline
 */
const WORDS = ['SO', 'RECRUIT'] as const;
const STEP_MS = 45;
const HOLD_MS = 620;
const FADE_MS = 320;

/**
 * `?intro=1` = บังคับเล่นแม้เครื่องตั้ง "ลดการเคลื่อนไหว" ไว้ (ฉากเล่นทุกครั้งอยู่แล้ว
 * ไม่ต้องบังคับเรื่องความถี่อีก — เหลือไว้ให้เจ้าของดูฉากได้แม้เปิด reduced-motion)
 */
function introParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('intro');
  } catch {
    return null;
  }
}

/** `?intro=1` = บังคับเล่นแม้ตั้งลดการเคลื่อนไหว · `?intro=hold` = **ค้างฉากไว้** ให้ดูสี/จัดวางได้ทัน (ยังกดข้ามได้) */
function forcedByUrl(): boolean {
  const v = introParam();
  return v === '1' || v === 'hold';
}

function heldByUrl(): boolean {
  return introParam() === 'hold';
}

export const BrandIntro: React.FC = () => {
  const [phase, setPhase] = React.useState<'hidden' | 'in' | 'out'>(() => {
    if (typeof window === 'undefined') return 'hidden';
    const forced = forcedByUrl();
    // ตั้งลดการเคลื่อนไหวไว้ = ไม่โชว์ ยกเว้นสั่งดูเองด้วย ?intro=1
    if (!forced && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'hidden';
    return 'in';
  });

  React.useEffect(() => {
    if (phase === 'hidden') return;

    const startFade = () => setPhase((p) => (p === 'in' ? 'out' : p));
    // โหมดค้าง: ไม่ตั้งเวลาจางเอง รอให้คนกดข้าม (ใช้ตอนตรวจสี/จัดวางเท่านั้น)
    const holdTimer = heldByUrl() ? 0 : window.setTimeout(startFade, HOLD_MS);

    // ข้ามได้ทุกทาง — แตะ/คลิก/กดคีย์ (รวมตอนเริ่มพิมพ์อีเมล)
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    for (const e of events) window.addEventListener(e, startFade, { once: true, passive: true });

    return () => {
      window.clearTimeout(holdTimer);
      for (const e of events) window.removeEventListener(e, startFade);
    };
  }, [phase]);

  React.useEffect(() => {
    if (phase !== 'out') return;
    const t = window.setTimeout(() => setPhase('hidden'), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === 'hidden') return null;

  let seq = 0;
  return (
    <div
      /* จับได้แน่นอนตอนตรวจบนจอ (หน้านี้มีชั้น fixed อื่นด้วย) */
      data-brand-intro=""
      aria-hidden
      /* 🔴 `pointer-events-none` ตั้งแต่ต้น — ผ้าคลุมนี้ห้ามกินคลิกของฟอร์มข้างหลัง
         (ปุ่มข้ามใช้ event ที่ window จับ ไม่ต้องให้ชั้นนี้รับคลิกเอง) */
      className={cn(
        'pointer-events-none fixed inset-0 z-[60] flex items-center justify-center transition-opacity',
        phase === 'out' ? 'opacity-0' : 'opacity-100',
      )}
      style={{
        transitionDuration: `${FADE_MS}ms`,
        /* กรมท่าไล่เฉดเล็กน้อย — พื้นเรียบสีเดียวบนจอใหญ่จะดูแบน */
        background: `radial-gradient(120% 120% at 50% 40%, ${INTRO_SCENE.navy2}, ${INTRO_SCENE.navy})`,
      }}
    >
      <p className="flex flex-wrap items-baseline justify-center gap-x-3 px-6">
        {WORDS.map((word, wi) => (
          <span key={word} className="flex">
            {word.split('').map((ch) => {
              const delay = seq++ * STEP_MS;
              return (
                <span
                  key={`${word}-${ch}-${delay}`}
                  className={cn(
                    'inline-block animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out',
                    'text-[clamp(28px,6vw,64px)] font-[650] tracking-[-0.01em]',
                  )}
                  style={{
                    animationDelay: `${delay}ms`,
                    animationFillMode: 'backwards',
                    /* SO = เบอร์กันดี · RECRUIT = ขาวกระดาษ (เจ้าของสั่ง 4 ก.ย. 2569) */
                    color: wi === 0 ? INTRO_SCENE.burgundyLight : INTRO_SCENE.paper,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        ))}
      </p>
    </div>
  );
};

export default BrandIntro;
