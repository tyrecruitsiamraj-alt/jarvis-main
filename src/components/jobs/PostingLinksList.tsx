import React from 'react';
import { Check, ChevronDown, Copy, MousePointerClick, UserPlus } from 'lucide-react';
import EditPostingDialog from '@/components/jobs/EditPostingDialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { applyLinkPath, type RecruitPosting, type RecruitPostingLink } from '@/lib/recruitPostings';
import { formatDateTimeTh } from '@/lib/dateTh';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

/** ลิงก์เต็มที่ส่งให้ผู้สมัคร — โดเมนของหน้าที่เปิดอยู่ + เส้นทางสาธารณะของลิงก์ */
function postingLinkUrl(code: string, origin: string = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origin}${applyLinkPath(code)}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="iconXs"
      aria-label={copied ? 'คัดลอกแล้ว' : `คัดลอกลิงก์ ${label}`}
      title={copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* คัดลอกไม่ได้ — ลิงก์ยังเลือกคัดลอกเองได้ */
        }
      }}
    >
      {copied ? <Check className={TONE.success.value} aria-hidden /> : <Copy aria-hidden />}
    </Button>
  );
}

function LinkRow({ link }: { link: RecruitPostingLink }) {
  const url = postingLinkUrl(link.code);
  const label = link.channelLabel?.trim() || 'ลิงก์กลาง (ไม่ระบุช่องทาง)';
  return (
    <li className="space-y-1 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-foreground">{label}</p>
        <CopyButton text={url} label={label} />
      </div>
      <p className="select-all break-all text-xs text-muted-foreground">{url}</p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <MousePointerClick className="h-3.5 w-3.5" aria-hidden /> คนกด {NUM.format(link.hitCount)} ครั้ง
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <UserPlus className="h-3.5 w-3.5" aria-hidden /> สมัครเข้ามา {NUM.format(link.applicationCount ?? 0)} คน
        </span>
        <span>สร้าง {formatDateTimeTh(link.createdAt)}</span>
      </p>
    </li>
  );
}

/**
 * ═══ รายการลิงก์สมัครของใบขอ — กด "มีแล้ว N ลิงก์" แล้วกางออกมา (เจ้าของ 4 ต.ค. 2569: *"มีแล้ว 7 ต้องกดดูได้ว่า
 * แต่ละลิงก์เกี่ยวกับอะไร"* → Choice "ครบ") ═══
 *
 * ต่อลิงก์: ช่องทาง · ตัวลิงก์ (คัดลอกได้) · คนกดกี่ครั้ง · สมัครเข้ามากี่คน · สร้างเมื่อไหร่
 * ต่อประกาศ: หัวข้อ · ใครสร้าง · "แก้ข้อความประกาศ" (ย้ายมาจากท้ายหน้า 4 — หน้าสรุปแก้ไม่ได้ ⇒ แก้ได้ที่ประกาศของมันเอง)
 * ประกาศใหม่ขึ้นก่อน (API เรียงใหม่ → เก่ามาแล้ว)
 */
const PostingLinksList: React.FC<{
  postings: RecruitPosting[];
  onChanged?: () => void;
}> = ({ postings, onChanged }) => {
  const [editing, setEditing] = React.useState<string | null>(null);
  if (postings.length === 0) return <p className="text-sm text-muted-foreground">ยังไม่มีลิงก์</p>;
  return (
    <div className="space-y-3" data-testid="posting-links-list">
      {postings.map((p) => (
        <div key={p.id} className="rounded-xl border border-border/70 px-3 py-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-foreground">{p.title}</p>
              <p className="text-xs text-muted-foreground">
                {p.createdByName ? `สร้างโดย ${p.createdByName} · ` : ''}
                {formatDateTimeTh(p.createdAt)} · {NUM.format(p.links.length)} ลิงก์
              </p>
            </div>
          </div>
          <ul className={cn('divide-y divide-border/60')}>
            {p.links.map((l) => (
              <LinkRow key={l.id} link={l} />
            ))}
          </ul>
          <Collapsible open={editing === p.id} onOpenChange={(o) => setEditing(o ? p.id : null)}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="xs" className="-ml-2">
                แก้ข้อความประกาศ
                <ChevronDown className={cn('transition-transform', editing === p.id && 'rotate-180')} aria-hidden />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <EditPostingDialog
                embedded
                posting={p}
                onClose={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  onChanged?.();
                }}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      ))}
    </div>
  );
};

export default PostingLinksList;
