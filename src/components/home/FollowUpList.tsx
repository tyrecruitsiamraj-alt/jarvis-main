/** รายชื่อคนในกล่องผลโทรของป๊อป "ผลจากการโทร" — ย้ายมาจาก `HomePage.tsx` 29 ก.ย. 2569 (ใช้ใน `useHomeCallDialogs`) */
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import type { FlowFollowUpItem } from '@/lib/flowSummaryApi';
import { FOLLOW_UP_TONE, type FollowUpTone } from '@/lib/homeCallDigest';

/** สีของแถวบอกปลายทางเอง กดแล้วเปิดรายละเอียดคน */
export default function FollowUpList({
  items,
  tone,
  onOpen,
  max = 3,
}: {
  items: FlowFollowUpItem[];
  tone: FollowUpTone;
  onOpen: (item: FlowFollowUpItem) => void;
  /** จำนวนชื่อที่โชว์ก่อนยุบเป็น "…และอีก N" */
  max?: number;
}) {
  const t = FOLLOW_UP_TONE[tone];
  if (items.length === 0) {
    return <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">— ไม่มีรายชื่อ</p>;
  }
  return (
    <div className="mt-1.5 space-y-1">
      {items.slice(0, max).map((it) => (
        <button
          key={`${it.job_ref}:${it.person_ref}`}
          type="button"
          onClick={() => onOpen(it)}
          title={t.hint}
          className={cn(
            'w-full rounded-lg border px-2 py-1.5 text-left',
            TONE[t.tone].soft,
            TONE[t.tone].softHover,
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-foreground">
              <span aria-hidden>{t.dot}</span> {it.name || it.person_ref}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{it.request_no}</span>
          </div>
          {it.summary ? <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{it.summary}</p> : null}
        </button>
      ))}
      {items.length > max ? (
        <p className="text-[10px] text-muted-foreground">…และอีก {items.length - max} รายการ</p>
      ) : null}
    </div>
  );
}

