/**
 * ═══ ฉากของหน้าด่านหน้า — **ยกมาจาก `tundralogin_v3.html` ที่เจ้าของส่งมา** ═══
 *
 * เจ้าของสั่ง 27 ส.ค. 2569: *"ถ้าใช้ได้ก็ใช้ แต่อยากให้มีแค่แบบของเรา เหมือนอยากได้
 * ค่าภาพกับอะไรต่าง ๆ ของเขา แต่การทำงานเป็นแบบเรา"* — แล้วย้ำอีกรอบตอนผมไปสลับภาพ
 * เป็นฉากออฟฟิศของเราเอง: *"บ้าหรอ จะเอาแบบไฟล์ HTML ที่ส่งให้ดิ"*
 *
 * 🔴 **ชั้นของฉากตรงตาม mockup ทุกชั้น ห้ามสลับลำดับ** (ล่างขึ้นบน):
 *   1. ภาพป่า (ขยับตามเมาส์) + ฟิลเตอร์ลดความจัดของสี
 *   2. ผ้าไล่แสงบนตัวภาพ — เรืองซ้ายบน · สว่างซ้าย → เข้มขวา · ใสบน → จมล่าง
 *   3. หมอกลึก (`depth-haze` · screen blend)
 *   4. แสงนวลที่หายใจ 12 วิ
 *   5. เงาขอบจอ
 *   6. เกรนฟิล์ม
 *
 * ⚠️ **สองอย่างที่ไม่ยกตามของเขา เพราะเป็นบั๊กไม่ใช่ดีไซน์:**
 * - เกรนของเขาขยับทุก 0.8 วินาทีไม่หยุด → วาดจอใหม่ตลอดเวลา กินแบต · ของเราเป็นภาพนิ่ง
 * - ของเขาใส่ `overflow:hidden` ที่ body → บนมือถือคีย์บอร์ดเด้งแล้วช่องรหัสตกจอ
 *   เลื่อนตามไม่ได้ = เข้าระบบไม่ได้ · ฉากนี้เป็น `fixed` อยู่ข้างหลัง เนื้อหาเลื่อนได้
 *
 * ⚠️ ภาพดึงจาก Unsplash เหมือน mockup — เน็ตอืด/ถูกกั้นจะเห็นพื้นสีรองแทน
 * (`FRONT_SCENE.base`) การ์ดยังอ่านออกอยู่ · อยากให้ชัวร์กว่านี้ต้องเอาภาพมาเก็บใน repo
 */
import * as React from 'react';

import { FRONT_SCENE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/** เกรนฟิล์ม — SVG ฝังในตัว ไม่ต้องโหลดไฟล์ (ตัวเดียวกับ mockup) */
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.62'/%3E%3C/svg%3E\")";

export type PhotoSceneProps = {
  /** URL ภาพ — ค่าตั้งต้นคือภาพเดียวกับ mockup */
  image?: string;
  /** ปิดการขยับตามเมาส์ */
  still?: boolean;
  className?: string;
};

const PhotoScene: React.FC<PhotoSceneProps> = ({
  image = FRONT_SCENE.photo,
  still = false,
  className,
}) => {
  const photoRef = React.useRef<HTMLDivElement | null>(null);

  /**
   * ขยับภาพตามเมาส์ (สูตรเดียวกับ mockup: translate 10px/5px · background-position .75/.35)
   * 🔴 เขียนลง style ผ่าน ref ไม่ผ่าน state — ไม่งั้น render ใหม่ทั้งหน้าทุกพิกเซลที่เมาส์ขยับ
   */
  React.useEffect(() => {
    if (still) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    /** จอสัมผัสไม่มีเมาส์ให้ตาม — ผูก listener ไปก็เปลืองเปล่า */
    if (!window.matchMedia('(hover: hover)').matches) return;

    let frame = 0;
    let dx = 0;
    let dy = 0;

    const apply = () => {
      frame = 0;
      const el = photoRef.current;
      if (!el) return;
      el.style.transform = `scale(1.055) translate(${dx * 10}px, ${dy * 5}px)`;
      el.style.backgroundPosition = `${50 + dx * 0.75}% ${52 + dy * 0.35}%`;
    };

    const onMove = (e: MouseEvent) => {
      dx = -(e.clientX / window.innerWidth - 0.5);
      dy = -(e.clientY / window.innerHeight - 0.5);
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [still]);

  return (
    <div
      className={cn('pointer-events-none fixed inset-0 overflow-hidden', className)}
      style={{ background: FRONT_SCENE.base }}
      aria-hidden
    >
      {/* 1. ภาพป่า */}
      <div
        ref={photoRef}
        className="absolute -inset-[3%] bg-cover bg-[50%_52%] will-change-transform motion-safe:transition-transform motion-safe:duration-[1800ms] motion-safe:ease-out"
        style={{
          backgroundImage: `url('${image}')`,
          transform: 'scale(1.035)',
          filter: FRONT_SCENE.photoFilter,
        }}
      />

      {/* 2. ผ้าไล่แสงบนตัวภาพ — สามชั้นตาม mockup */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(90% 70% at 28% 20%, rgba(255,237,203,.24), transparent 58%)',
            'linear-gradient(90deg, rgba(247,243,233,.24) 0%, rgba(247,243,233,.06) 35%, rgba(19,40,28,.04) 68%, rgba(12,27,19,.20) 100%)',
            'linear-gradient(180deg, rgba(252,248,238,.09) 0%, rgba(227,235,226,.04) 42%, rgba(12,28,20,.18) 100%)',
          ].join(','),
        }}
      />

      {/* 3. หมอกลึก */}
      <div
        className="absolute inset-0 mix-blend-screen opacity-60"
        style={{
          background:
            'linear-gradient(180deg, rgba(245,246,241,.05) 0%, rgba(235,240,233,.13) 42%, rgba(234,239,232,.20) 58%, rgba(18,37,26,.08) 100%)',
        }}
      />

      {/* 4. แสงนวลที่หายใจ — ของชิ้นเดียวในฉากที่ขยับ */}
      <div
        className="absolute left-[18%] top-[10%] aspect-square w-[42vw] max-w-3xl rounded-full blur-lg motion-safe:animate-[jarvis-breathe_12s_ease-in-out_infinite]"
        style={{
          background:
            'radial-gradient(circle, rgba(255,241,208,.42) 0%, rgba(255,241,208,.13) 34%, transparent 70%)',
        }}
      />

      {/* 5. เงาขอบจอ */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 105% at 50% 40%, transparent 52%, rgba(14,31,22,.16) 100%)',
        }}
      />

      {/* 6. เกรนฟิล์ม — ภาพนิ่ง (ของเขาขยับไม่หยุด กินแบต) */}
      <div
        className="absolute -inset-[40%] mix-blend-multiply"
        style={{ backgroundImage: GRAIN_URL, opacity: 0.055 }}
      />
    </div>
  );
};

export default PhotoScene;
