/**
 * ═══ "วันนี้ต้องตามใครบ้าง" — โฉมใหม่ของหน้าติดตาม (เจ้าของส่งแบบมา 20 ก.ย. 2569) ═══
 *
 * > *"หน้าการติดตามตอนนี้มันงงมาก ฉันจะรีใหม่"* แล้วส่งแบบ Follow-up Workbench มาให้
 * > *"แต่ฉันกลัวนายทำ Function ต่าง ๆ หาย"*
 *
 * โครงสามชั้นตามแบบ:
 *   ① การ์ดตัวเลข 4 ใบ ที่ **กดแล้วกรองลิสต์** (ไม่ใช่ตัวเลขประดับ)
 *   ② คิวงาน — หนึ่งแถวหนึ่งคน มีคอลัมน์ **"สิ่งที่ต้องทำต่อ"**
 *   ③ แผงขวา — รายละเอียดคนที่เลือก + ปุ่มลงมือทั้งหมด
 *
 * 🔴 **ของเดิมไม่หายสักอย่าง** — ปฏิทิน · แผงรอบโทร · 7 กล่องสถานะ · สรุปผลรายเดือน
 * ย้ายไปอยู่หลังปุ่ม "ปฏิทิน & แผนการโทร" ทั้งก้อน (หน้าเรียกเป็นคนเปิดให้)
 *
 * 🔴 **กติกา UI ของบ้านนี้** (เจ้าของย้ำ 21 ก.ย. 2569: *"ต้องคุมด้วย Shadcn ห้ามสร้าง css
 * หรือ Component เอง"*) — ไฟล์นี้ประกอบจาก `@/components/ui/*` + utility ของ Tailwind
 * + โทเคนสีจาก `designTokens` เท่านั้น **ไม่มี CSS ใหม่ ไม่มี primitive ใหม่**
 */
import * as React from 'react';
import {
  CalendarDays,
  ChevronRight,
  LoaderCircle,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import FollowCompleteControls from '@/components/follow/FollowCompleteControls';
import FollowDispatchBadge from '@/components/follow/FollowDispatchBadge';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { FollowEntry } from '@/lib/followApi';
import type { FollowOutcome } from '@/lib/followOutcome';
import { FOLLOW_MICRO_LABEL, FOLLOW_MICRO_TONE } from '@/lib/followCallMicro';
import {
  buildWorkbenchRows,
  countWorkbenchLanes,
  countWorkbenchOwners,
  filterWorkbenchRows,
  type WorkbenchLane,
  type WorkbenchOwnerKind,
  type WorkbenchRow,
} from '@/lib/followWorkbench';

/** ถังกลาง → คำของงานติดตาม (แปลที่ `followCallMicro` ที่เดียว ห้ามตั้งคำใหม่ที่นี่) */
const RESULT_LABEL: Record<string, string> = {
  said_yes: FOLLOW_MICRO_LABEL.said_going,
  said_no: FOLLOW_MICRO_LABEL.said_not_going,
  not_yet: FOLLOW_MICRO_LABEL.getting_ready,
  no_pickup: FOLLOW_MICRO_LABEL.no_pickup,
  wrong_person: FOLLOW_MICRO_LABEL.wrong_person,
  picked_silent: FOLLOW_MICRO_LABEL.picked_silent,
  talked_unclear: FOLLOW_MICRO_LABEL.talked_unclear,
};
const RESULT_TONE: Record<string, ToneKey> = {
  said_yes: FOLLOW_MICRO_TONE.said_going,
  said_no: FOLLOW_MICRO_TONE.said_not_going,
  not_yet: FOLLOW_MICRO_TONE.getting_ready,
  no_pickup: FOLLOW_MICRO_TONE.no_pickup,
  wrong_person: FOLLOW_MICRO_TONE.wrong_person,
  picked_silent: FOLLOW_MICRO_TONE.picked_silent,
  talked_unclear: FOLLOW_MICRO_TONE.talked_unclear,
};

/** ป้ายของการ์ดตัวเลข — คำต้องบอก **ฐาน** ของตัวเอง ไม่ใช่คำลอย ๆ */
const LANE_CARD: Array<{
  id: WorkbenchLane | 'open';
  label: string;
  hint: string;
  tone: ToneKey;
}> = [
  { id: 'open', label: 'งานที่ยังไม่จบ', hint: 'ทุกคนที่ยังต้องตาม', tone: 'neutral' },
  { id: 'urgent', label: 'ต้องลงมือวันนี้', hint: 'เลยเวลา · ตอบว่าไม่ไป · ส่งไม่ออก', tone: 'danger' },
  { id: 'waiting', label: 'รอผล', hint: 'ตั้งไว้แล้ว ยังไม่รู้คำตอบ', tone: 'warn' },
  { id: 'confirmed', label: 'ตอบว่าไปแล้ว', hint: 'ได้คำตอบแล้ว รอปิดงาน', tone: 'success' },
];

const OWNER_LABEL: Record<WorkbenchOwnerKind | 'all', string> = {
  all: 'ทั้งหมด',
  ai: 'AI ดูแล',
  staff: 'เราโทรเอง',
  none: 'ยังไม่มีใครถือ',
};

const timeLabel = (iso: string | null): string => {
  if (!iso) return 'ไม่ได้ตั้งเวลา';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ไม่ได้ตั้งเวลา';
  return d.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const initials = (name: string): string => name.trim().slice(0, 2) || '—';

export type FollowWorkbenchProps = {
  entries: FollowEntry[];
  loading: boolean;
  busyId: string | null;
  /** admin เท่านั้น — `null` = ไม่มีสิทธิ์ลบถาวร */
  onPurge: ((id: string) => void) | null;
  onReload: () => void;
  onAdd: () => void;
  onOpenPlanner: () => void;
  onEdit: (entry: FollowEntry) => void;
  onCancel: (id: string) => void;
  onComplete: (id: string, outcome: FollowOutcome, note?: string) => void;
  onReopen: (id: string) => void;
};

export const FollowWorkbench: React.FC<FollowWorkbenchProps> = ({
  entries,
  loading,
  busyId,
  onPurge,
  onReload,
  onAdd,
  onOpenPlanner,
  onEdit,
  onCancel,
  onComplete,
  onReopen,
}) => {
  const [lane, setLane] = React.useState<WorkbenchLane | 'open'>('open');
  const [owner, setOwner] = React.useState<WorkbenchOwnerKind | 'all'>('all');
  const [q, setQ] = React.useState('');
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  const rows = React.useMemo(() => buildWorkbenchRows(entries), [entries]);
  const counts = React.useMemo(() => countWorkbenchLanes(rows), [rows]);
  const owners = React.useMemo(() => countWorkbenchOwners(rows), [rows]);
  const shown = React.useMemo(
    () => filterWorkbenchRows(rows, { lane, owner, q }),
    [rows, lane, owner, q],
  );

  /** แถวที่เลือกอยู่ — ของหายจากตัวกรองเมื่อไหร่ ให้เลื่อนไปแถวแรกแทน ไม่ปล่อยแผงว่าง */
  const selected = React.useMemo(
    () => shown.find((r) => r.group.key === selectedKey) ?? shown[0] ?? null,
    [shown, selectedKey],
  );

  const countOf = (id: WorkbenchLane | 'open'): number =>
    id === 'open' ? counts.open : counts[id];

  return (
    <div className="space-y-4">
      {/**
       * ── แถวปุ่มหลัก ──
       * 🔴 หัวเรื่องสามบรรทัด ("คิวงานติดตาม / วันนี้ต้องตามใครบ้าง / เรียงให้แล้ว…")
       * **ถูกถอดออก 21 ก.ย. 2569** (เจ้าของสั่ง *"เอาออกมันเกะกะ"*) — ชื่อหน้าอยู่บน
       * `PageHeader` แล้ว เขียนซ้ำอีกชั้นคือกินที่เปล่า ๆ เหนือของที่ต้องใช้จริง
       */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onReload} disabled={loading}>
            {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            โหลดใหม่
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onOpenPlanner}>
            <CalendarDays aria-hidden />
            ปฏิทิน &amp; แผนการโทร
          </Button>
          <Button type="button" size="sm" onClick={onAdd}>
            <Plus aria-hidden />
            เพิ่มคนที่ต้องติดตาม
          </Button>
        </div>
      </div>

      {/* ── ① การ์ดตัวเลข = ตัวกรอง (กดแล้วลิสต์ข้างล่างเปลี่ยนทันที) ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {LANE_CARD.map((c) => {
          const on = lane === c.id;
          return (
            <Card
              key={c.id}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              onClick={() => setLane(c.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setLane(c.id);
                }
              }}
              className={cn(
                'cursor-pointer transition-colors hover:bg-accent/40',
                on && 'border-primary bg-accent/30',
              )}
            >
              <CardContent className="p-4">
                <p className={cn('text-3xl font-medium tabular-nums', TONE[c.tone].value)}>
                  {countOf(c.id).toLocaleString('th-TH')}
                </p>
                <p className="mt-1 text-sm text-foreground">{c.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ── ② คิวงาน ── */}
        <Card className="overflow-hidden">
          <CardHeader className="gap-3 space-y-0 border-b p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหาชื่อ เบอร์โทร หน่วยงาน หรือเรื่องที่ตาม"
                  className="pl-9"
                  aria-label="ค้นหาในคิวงาน"
                />
              </div>
              <ToggleGroup
                type="single"
                value={owner}
                onValueChange={(v) => v && setOwner(v as WorkbenchOwnerKind | 'all')}
                variant="outline"
                size="sm"
                aria-label="กรองตามคนที่ถือสายอยู่"
              >
                {(['all', 'ai', 'staff', 'none'] as const).map((o) => (
                  <ToggleGroupItem key={o} value={o} className="gap-1.5 text-xs">
                    {OWNER_LABEL[o]}
                    <span className="tabular-nums text-muted-foreground">{owners[o]}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {/* 🔴 ของที่ปิดไปแล้วต้อง **เปิดดูได้เสมอ** — แบบที่เจ้าของส่งมาไม่มีทางเข้า */}
              <Button
                type="button"
                variant={lane === 'closed' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setLane(lane === 'closed' ? 'open' : 'closed')}
                className="text-xs"
              >
                ปิด/ยกเลิกแล้ว
                <span className="tabular-nums">{counts.closed.toLocaleString('th-TH')}</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* หัวตาราง — ซ่อนบนจอแคบ (แถวอ่านเองได้อยู่แล้ว) */}
            <div className="hidden grid-cols-[3rem_1.6fr_1.1fr_1.2fr_7rem] gap-3 border-b bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground md:grid">
              <span>ลำดับ</span>
              <span>คนที่ตาม</span>
              <span>หน่วยงาน / เรื่อง</span>
              <span>สิ่งที่ต้องทำต่อ</span>
              <span className="text-right">เวลานัด</span>
            </div>

            {loading && shown.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> กำลังโหลด…
              </p>
            ) : shown.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-foreground">ไม่มีงานในมุมมองนี้</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ลองกดการ์ด “งานที่ยังไม่จบ” หรือล้างคำค้น
                </p>
              </div>
            ) : (
              <ul aria-label="คิวงานติดตาม" className="divide-y">
                {shown.map((row, i) => (
                  <QueueRow
                    key={row.group.key}
                    row={row}
                    rank={i + 1}
                    selected={selected?.group.key === row.group.key}
                    onSelect={() => setSelectedKey(row.group.key)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── ③ แผงรายละเอียด + ปุ่มลงมือ ── */}
        <DetailPanel
          row={selected}
          busyId={busyId}
          onPurge={onPurge}
          onEdit={onEdit}
          onCancel={onCancel}
          onComplete={onComplete}
          onReopen={onReopen}
        />
      </div>
    </div>
  );
};

/** หนึ่งแถว = หนึ่งคน */
const QueueRow: React.FC<{
  row: WorkbenchRow;
  rank: number;
  selected: boolean;
  onSelect: () => void;
}> = ({ row, rank, selected, onSelect }) => {
  const tone: ToneKey =
    row.lane === 'urgent' ? 'danger' : row.lane === 'confirmed' ? 'success' : 'warn';

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'grid w-full grid-cols-[3rem_1fr] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 md:grid-cols-[3rem_1.6fr_1.1fr_1.2fr_7rem]',
          selected && 'bg-accent/50',
        )}
      >
        <span
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium tabular-nums',
            TONE[tone].chip,
          )}
        >
          {String(rank).padStart(2, '0')}
        </span>

        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">
            {row.group.name}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {row.group.phone}
            {row.group.activeCount > 1 ? ` · ${row.group.activeCount} รอบ` : ''}
          </span>
        </span>

        <span className="hidden min-w-0 md:block">
          <span className="block truncate text-xs text-foreground">
            {row.group.unitName ?? 'ไม่ได้ระบุหน่วยงาน'}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{row.group.topic}</span>
        </span>

        <span className="min-w-0 md:col-auto">
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn('font-medium', TONE[tone].chip)}>
              {row.action.text}
            </Badge>
            {row.ownerKind === 'staff' ? (
              <Badge variant="outline" className="font-medium">
                เราโทรเอง
              </Badge>
            ) : null}
            {row.ownerKind === 'none' ? (
              <Badge variant="outline" className={cn('font-medium', TONE.danger.chip)}>
                ยังไม่มีใครถือ
              </Badge>
            ) : null}
          </span>
          {row.result ? (
            <span className={cn('mt-1 block truncate text-[11px]', TONE[RESULT_TONE[row.result]].value)}>
              {RESULT_LABEL[row.result]}
            </span>
          ) : null}
        </span>

        <span className="hidden text-right md:block">
          <span
            className={cn(
              'block text-xs tabular-nums',
              row.lateMinutes != null ? TONE.danger.value : 'text-foreground',
            )}
          >
            {timeLabel(row.dueIso)}
          </span>
          {row.lateMinutes != null ? (
            <span className={cn('block text-[11px]', TONE.danger.value)}>
              เลยมา {row.lateMinutes.toLocaleString('th-TH')} นาที
            </span>
          ) : row.keyedBy ? (
            <span className="block truncate text-[11px] text-muted-foreground">{row.keyedBy}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
};

/** แผงขวา — ทุกปุ่มที่ทำอะไรกับคนนี้ได้ อยู่ในนี้ที่เดียว */
const DetailPanel: React.FC<{
  row: WorkbenchRow | null;
  busyId: string | null;
  onPurge: ((id: string) => void) | null;
  onEdit: (entry: FollowEntry) => void;
  onCancel: (id: string) => void;
  onComplete: (id: string, outcome: FollowOutcome, note?: string) => void;
  onReopen: (id: string) => void;
}> = ({ row, busyId, onPurge, onEdit, onCancel, onComplete, onReopen }) => {
  if (!row) {
    return (
      <Card className="h-max">
        <CardContent className="px-4 py-12 text-center">
          <p className="text-sm font-medium text-foreground">ยังไม่ได้เลือกใคร</p>
          <p className="mt-1 text-xs text-muted-foreground">กดที่แถวในคิวงานเพื่อดูรายละเอียด</p>
        </CardContent>
      </Card>
    );
  }

  const round = row.round;
  const busy = Boolean(round && busyId === round.id);
  const closed = row.lane === 'closed';

  return (
    <Card className="h-max xl:sticky xl:top-4">
      <CardHeader className="gap-3 space-y-0 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground">
              {initials(row.group.name)}
            </span>
            <div className="min-w-0">
              <CardTitle className="truncate text-base font-medium">{row.group.name}</CardTitle>
              <p className="truncate text-xs text-muted-foreground">
                {row.group.unitName ?? 'ไม่ได้ระบุหน่วยงาน'} · {row.group.topic}
              </p>
              <p className="text-xs text-muted-foreground">{row.group.phone}</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="คำสั่งอื่น">
                <MoreVertical aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>จัดการรอบนี้</DropdownMenuLabel>
              <DropdownMenuItem disabled={!round} onSelect={() => round && onEdit(round)}>
                <Pencil aria-hidden /> แก้ไขรอบ / เพิ่มรอบ
              </DropdownMenuItem>
              {closed ? (
                <DropdownMenuItem disabled={!round} onSelect={() => round && onReopen(round.id)}>
                  <RotateCcw aria-hidden /> ย้อนสถานะกลับมาตามต่อ
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled={!round} onSelect={() => round && onCancel(round.id)}>
                  <X aria-hidden /> ยกเลิกรอบนี้ (ถอนออกจากคิว AI)
                </DropdownMenuItem>
              )}
              {onPurge && round ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onPurge(round.id)}
                    className={TONE.danger.value}
                  >
                    <Trash2 aria-hidden /> ลบถาวร (admin)
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-0">
        {/* สิ่งที่ต้องทำตอนนี้ — ประโยคเดียว อ่านแล้วลงมือได้ */}
        <div
          className={cn(
            'rounded-xl border px-3 py-2.5 text-xs',
            row.action.needsHuman ? TONE.danger.soft : TONE.success.soft,
          )}
        >
          <p className={cn('font-medium', row.action.needsHuman ? TONE.danger.value : TONE.success.value)}>
            {row.action.text}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {row.lateMinutes != null
              ? `เลยเวลานัดมา ${row.lateMinutes.toLocaleString('th-TH')} นาทีแล้ว`
              : `เวลานัด ${timeLabel(row.dueIso)}`}
          </p>
        </div>

        {/* 🔴 สายที่ส่งไม่ออก — ต้องเห็นก่อนอย่างอื่น ไม่งั้นนั่งรอสายที่ไม่มีวันมา */}
        {round ? <FollowDispatchBadge entry={round} /> : null}

        {/* ผลจากสาย + คำที่เขาพูดเอง */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            ผลจากสาย
          </p>
          {row.result ? (
            <>
              <Badge
                variant="outline"
                className={cn('mt-1.5 font-medium', TONE[RESULT_TONE[row.result]].chip)}
              >
                {RESULT_LABEL[row.result]}
              </Badge>
              {row.said ? (
                <p className="mt-1.5 text-xs leading-relaxed text-foreground">“{row.said}”</p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">ไม่มีคำพูดที่บันทึกไว้</p>
              )}
            </>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">ยังไม่มีผลกลับ</p>
          )}
        </div>

        <Separator />

        {/* รอบทั้งหมดของคนนี้ */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            รอบทั้งหมด ({row.group.rounds.length.toLocaleString('th-TH')})
          </p>
          <ul aria-label="รอบทั้งหมดของคนนี้" className="mt-1.5 space-y-1">
            {row.group.rounds.map((r) => (
              <li
                key={r.id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]',
                  round?.id === r.id && 'border-primary',
                )}
              >
                <span className="truncate text-foreground">{timeLabel(r.scheduled_at)}</span>
                <span className="shrink-0 text-muted-foreground">
                  {r.cancelled
                    ? 'ยกเลิกแล้ว'
                    : r.completed_at
                      ? 'ปิดงานแล้ว'
                      : r.call_mode === 'manual'
                        ? 'เราโทรเอง'
                        : (r.call_status ?? 'ยังไม่ส่ง')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {/* ลงมือ */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            ลงมือทำ
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild className="w-full">
                  <a href={`tel:${row.group.phone}`}>
                    <Phone aria-hidden /> โทรเองตอนนี้
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>เปิดแอปโทรของเครื่อง — ไม่ได้สั่งให้ AI โทร</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {closed ? (
            <p className="text-[11px] text-muted-foreground">
              งานนี้ปิดแล้ว — ถ้าต้องตามต่อ ให้กดย้อนสถานะจากเมนู •••
            </p>
          ) : (
            <>
              {/* 🔴 ปุ่มปิดงานใช้ตัวเดิมทั้งก้อน — ผล 5 แบบเดิม สถิติทั้งระบบผูกกับรหัสชุดนี้ */}
              <FollowCompleteControls
                busy={busy}
                onComplete={(outcome, note) => round && onComplete(round.id, outcome, note)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!round || busy}
                onClick={() => round && onEdit(round)}
                className="w-full"
              >
                <Pencil aria-hidden /> แก้เวลา / เพิ่มรอบ
                <ChevronRight className="ml-auto" aria-hidden />
              </Button>
            </>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          คนคีย์รายการนี้: {row.keyedBy ?? 'ไม่ทราบ'}
        </p>
      </CardContent>
    </Card>
  );
};

export default FollowWorkbench;
