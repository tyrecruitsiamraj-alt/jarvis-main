import { cn } from '@/lib/utils';

type Props = {
  label: string;
  className?: string;
};

/** แถบโหลดแบบวิ่ง (indeterminate) สำหรับงานที่ไม่รู้เวลาแน่นอน เช่น รอ AI แมท 1–3 นาที */
export default function MatchLoadingBar({ label, className }: Props) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-xs text-blue-700">{label}</p>
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-100"
        role="progressbar"
        aria-label={label}
      >
        <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-blue-500 animate-indeterminate-bar" />
      </div>
    </div>
  );
}
