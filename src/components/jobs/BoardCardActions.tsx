/**
 * ส่วน "ทำอะไรไปแล้ว" บนการ์ดหน้าโพสต์ประกาศ (เจ้าของ 13 พ.ย. 2569 · แบบร่าง SQ6909009 ที่เจ้าของเคาะ)
 * 3 กล่องเรียงเท่ากันทุกใบ: Autopost · โพสต์เอง · Scrap — ตัวเลขอยู่ในช่องตายตัว (ไม่ห่อเป็นป้ายสะเปะสะปะ)
 * กดกล่อง = เปิดป๊อปของใบนี้ที่แท็บนั้น · ยังไม่เคยทำ = กล่องยังอยู่ บอก "ยังไม่สั่ง" (ว่างแล้วห้ามหาย)
 * 🔴 ทุกกล่องสูงเท่ากันเสมอ (เจ้าของ 13 พ.ย. 2569 "ทำช่องไว้รอให้เท่าๆกันเลย ไม่งั้นอันไหนไม่สั่งกล่องก็ยุบ") —
 *   หัว + แถวช่องตัวเลข (ไม่มีข้อมูล = 0 · ยังโหลดไม่มา = —) + บรรทัดล่าง 1 บรรทัด (ว่าง = เว้นที่ไว้) · Scrap ช่องเดียวบอกสถานะล่าสุด
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import type { JobPostingRequest } from '@/lib/jobPostingRequestsApi';
import { soStatusView, soStuckLine } from '@/lib/soScraping';
import { postGroupBuckets, type JobPostActionsSummary } from '@/lib/jobPostActions';

export type BoardActionTab = 'autopost' | 'manual' | 'scrap';

const th = (n: number) => n.toLocaleString('th-TH');

function Box({ title, right, onClick, children, testId }: { title: string; right: string; onClick: () => void; children?: React.ReactNode; testId: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex w-full flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex w-full items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">{title}</span>
        <span className="truncate text-xs tabular-nums text-muted-foreground">{right}</span>
      </span>
      {children}
    </button>
  );
}

/** 3 ช่องตัวเลขขนาดเท่ากัน เลขบน คำล่าง · `value` null = ยังโหลดไม่มา (ขีด) */
function Cells({ cells }: { cells: Array<{ label: string; value: number | null; tone?: 'success' | 'warn' | 'danger' }> }) {
  return (
    <span className="grid w-full grid-cols-3 divide-x divide-border rounded-lg bg-muted/40 py-1">
      {cells.map((c) => (
        <span key={c.label} className="flex min-w-0 flex-col items-center px-1">
          <span className={cn('text-base font-medium tabular-nums', c.value && c.tone ? TONE[c.tone].value : c.value ? 'text-foreground' : 'text-muted-foreground')}>
            {c.value === null ? '—' : th(c.value)}
          </span>
          <span className="truncate text-xs text-muted-foreground">{c.label}</span>
        </span>
      ))}
    </span>
  );
}

/** ช่องเดียวความสูงเท่า `Cells` — Scrap บอกสถานะล่าสุด (เจ้าของเลือก "สถานะอย่างเดียว") */
function StatusCell({ label, toneClass }: { label: string; toneClass: string }) {
  return (
    <span className="flex w-full flex-col items-center rounded-lg bg-muted/40 py-1">
      <span className={cn('max-w-full truncate px-2 text-base font-medium', toneClass)}>{label}</span>
      <span className="text-xs text-muted-foreground">สถานะล่าสุด</span>
    </span>
  );
}

/** บรรทัดล่างของกล่อง — มีหรือไม่มีก็กินที่ 1 บรรทัดเท่ากัน */
function Foot({ text, className }: { text: string | null; className?: string }) {
  return <span className={cn('line-clamp-1 min-h-4 text-xs tabular-nums', className ?? 'text-muted-foreground')}>{text ?? '\u00a0'}</span>;
}

export default function BoardCardActions({
  actions,
  postGroups,
  so,
  onOpen,
}: {
  /** null = ยังโหลดไม่มา/โหลดไม่ได้ (ขึ้นขีด ไม่ขึ้น 0 ปลอม) */
  actions: JobPostActionsSummary | null;
  /** ผลรายกลุ่มจาก So Scraping ของใบนี้ (ตัวเดียวกับหน้าภาพรวม) · null = ยังไม่มี/อ่านไม่ได้ */
  postGroups: { total: number; counts: Record<string, number> } | null;
  /** คำสั่งล่าสุดต่อประเภท (ป้ายสถานะเดิม) */
  so: readonly JobPostingRequest[] | null;
  onOpen: (tab: BoardActionTab) => void;
}) {
  const dash = actions === null;
  const a = actions;
  const content = so?.find((r) => r.request_type === 'content') ?? null;
  const scrap = so?.find((r) => r.request_type === 'scraping') ?? null;
  const b = postGroups ? postGroupBuckets(postGroups.total, postGroups.counts) : null;
  const contentWhy = content ? soStuckLine(content) : null;
  const scrapWhy = scrap ? soStuckLine(scrap) : null;
  const scrapView = scrap ? soStatusView(scrap) : null;

  return (
    <div className="space-y-1.5" data-testid="board-card-actions">
      <p className="text-xs text-muted-foreground">ทำอะไรไปแล้ว</p>
      <Box
        testId="board-action-autopost"
        title="Autopost"
        right={dash ? '—' : a!.autopost.orders === 0 ? 'ยังไม่สั่ง' : `สั่ง ${th(a!.autopost.orders)} ครั้ง${postGroups ? ` · ${th(postGroups.total)} กลุ่ม` : ''}`}
        onClick={() => onOpen('autopost')}
      >
        <Cells
          cells={[
            { label: 'เผยแพร่แล้ว', value: b ? b.posted : dash ? null : 0, tone: 'success' },
            { label: 'รอ', value: b ? b.waiting : dash ? null : 0, tone: 'warn' },
            { label: 'ไม่สำเร็จ', value: b ? b.failed : dash ? null : 0, tone: 'danger' },
          ]}
        />
        {contentWhy ? (
          <Foot text={contentWhy} className={content?.status === 'rejected' ? TONE.danger.value : TONE.warn.value} />
        ) : (
          <Foot text={dash ? null : `คลิก ${th(a!.autopost.clicks)} · กรอก ${th(a!.autopost.applicants)}`} />
        )}
      </Box>
      {/* โพสต์แล้ว = มีลิงก์โพสต์วางกลับมา · Gen link = ยังไม่มี (เจ้าของ 13 พ.ย. 2569) · สองช่องรวม = ลิงก์ทั้งหมด */}
      <Box testId="board-action-manual" title="โพสต์เอง" right={dash ? '—' : a!.manual.links === 0 ? 'ยังไม่มีลิงก์' : `${th(a!.manual.links)} ลิงก์`} onClick={() => onOpen('manual')}>
        <Cells
          cells={[
            { label: 'โพสต์แล้ว', value: dash ? null : a!.manual.posted, tone: 'success' },
            { label: 'Gen link', value: dash ? null : a!.manual.links - a!.manual.posted },
            { label: 'กรอก', value: dash ? null : a!.manual.applicants, tone: 'success' },
          ]}
        />
        <Foot text={dash ? null : `คลิก ${th(a!.manual.clicks)}`} />
      </Box>
      <Box testId="board-action-scrap" title="Scrap" right={dash ? '—' : a!.scrap.orders === 0 ? 'ยังไม่สั่ง' : `สั่ง ${th(a!.scrap.orders)} ครั้ง`} onClick={() => onOpen('scrap')}>
        <StatusCell label={scrapView ? scrapView.label : dash ? '—' : 'ยังไม่สั่ง'} toneClass={scrapView ? TONE[scrapView.tone].value : 'text-muted-foreground'} />
        <Foot text={scrapWhy} className={scrap?.status === 'rejected' ? TONE.danger.value : TONE.warn.value} />
      </Box>
    </div>
  );
}
