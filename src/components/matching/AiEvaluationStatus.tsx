import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { Clock3, LoaderCircle } from 'lucide-react';

// ─── "กำลังรอ AI ประเมิน" — แยกจาก MatchingPage.tsx ตอนแตกไฟล์ ──────────────────
// ไฟล์นี้ export แต่ component (formatElapsed ใช้แต่ในไฟล์นี้ จึงไม่ export)

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

export default function AiEvaluationStatus({ source }: { source: 'board' | 'irecruit' }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isBoard = source === 'board';
  const estimate = isBoard ? 'ปกติประมาณ 30–90 วินาที' : 'ปกติประมาณ 1–3 นาที';
  const stage = isBoard
    ? elapsedSeconds < 15
      ? 'กำลังอ่านสเปกใบขอ'
      : elapsedSeconds < 60
        ? 'กำลังเทียบสกิล พื้นที่ และเงื่อนไข'
        : 'AI ยังประเมินและจัดอันดับอยู่'
    : elapsedSeconds < 20
      ? 'กำลังค้นหาผู้สมัครในฐาน iRecruit'
      : elapsedSeconds < 60
        ? 'กำลังคัดคนที่อยู่ในสายงานใกล้เคียง'
        : 'AI กำลังประเมินและจัดอันดับผู้สมัคร';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-xl border px-3 py-3 shadow-sm',
        isBoard ? TONE.info.soft : TONE.primary.soft,
      )}
    >
      <div className="flex items-start gap-2.5">
        <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-300" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <p className={cn('text-xs font-semibold', TONE.primary.num)}>กำลังรอ AI ประเมิน — ระบบไม่ได้ค้าง</p>
            <span className={cn('inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 dark:bg-slate-800 text-[10px] font-semibold tabular-nums', TONE.primary.value)}>
              <Clock3 className="h-3 w-3" /> {formatElapsed(elapsedSeconds)}
            </span>
          </div>
          <p className={cn('mt-1 text-[11px]', TONE.primary.num)}>{stage}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/40">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-blue-400 via-sky-500 to-blue-400" />
          </div>
          <p className={cn('mt-1.5 text-[10px]', TONE.primary.value)}>{estimate} · ไม่ต้องกดซ้ำ สามารถรอหน้านี้ได้</p>
        </div>
      </div>
    </div>
  );
}
