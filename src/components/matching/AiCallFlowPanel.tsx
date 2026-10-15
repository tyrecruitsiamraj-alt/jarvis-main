import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import {
  EMPTY_FUNNEL,
  fetchCallFunnel,
  fetchCallFunnelPeople,
  type CallFunnel,
  type CallFunnelPerson,
  type CallFunnelSource,
} from '@/lib/callFunnelApi';
import { CALL_OUTCOME_LABEL } from '@/lib/callOutcomeTone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { aiCallFlowCells, type CallFlowCell } from '@/lib/aiCallFlowCells';
import { RefreshCw, Bot, UserRound } from 'lucide-react';
import { useUiV2 } from '@/lib/uiV2';

/**
 * แผง "AI โทร" หน้า Matching — 2 แถวสถานะเดียวกัน (AI · คนเก็บไปโทร) ในกรอบเดียว
 * (เจ้าของสั่ง 14 ส.ค. 2569: "ส่ง AI ทั้งหมดเท่าไหร่ กำลังโทร รับสาย สนใจ ไม่สนใจ
 * ไม่รับสาย ไม่สะดวกคุย ไม่สะดวกคุยรอ AI โทรใหม่ · เพิ่มคนเก็บไปโทรทั้งหมด และ
 * สถานะแบบเดียวกัน 2 อย่างนี้นะเส้นแต่อยู่ในกรอบเดียวกัน")
 *
 * ต่างจาก CallFunnelPanel (หน้า Follow): ไม่มีขั้น "ฝั่งงาน" · ไม่มี byAttempt bar ·
 * ขั้นการโทรเป็น 8 ช่อง 2 แถวคอลัมน์ตรงกัน แทน funnel 4 ช่องเชิงเส้น
 *
 * ⚠️ ตัวเลข/ป้าย/ความหมายช่องมาจาก `src/lib/aiCallFlowCells.ts` ที่เดียว (เทสต์คุม)
 * โทน "สบายตาแต่ luxury" = จานสีแบบ B (กรมท่า/ทองเก่า) — พื้นเป็นกลาง สีอยู่ที่ขีดบน+ตัวเลข
 */

/** ปุ่มสลับต้นทาง — คัดลอกจาก CallFunnelPanel (ไม่ export ข้ามไฟล์เพื่อเลี่ยง react-refresh warning) */
const SOURCE_TABS: Array<{ id: CallFunnelSource; label: string; hint: string }> = [
  { id: 'board', label: 'Job Offer', hint: 'ที่ส่งจากหน้า Matching (คนบนบอร์ด)' },
  { id: 'irecruit', label: 'iRecruit', hint: 'ที่ส่งจากผลค้นหาคนที่ยังไม่สมัคร' },
  { id: 'all', label: 'ทั้งหมด', hint: 'รวมทุกต้นทาง' },
];

/**
 * ═══ ชิปตัวเลข 1 ช่อง — โฉมแถวชิปแบบหน้าโพสต์ประกาศ (เจ้าของสั่ง 15 ต.ค. 2569 "หน้าจับคู่งานไม่เข้ากับอันอื่นเลย") ═══
 * เดิมเป็นกล่อง 16 ใบ (2 แถว × 8 ช่อง) ขีดสีบน ตัวหนังสือเล็ก · ตอนนี้แถวละหนึ่งบรรทัด
 * ตัวเลข/ป้าย/สีมาจาก `aiCallFlowCells.ts` ที่เดียวเหมือนเดิม · ฝั่ง AI กดดูรายชื่อได้เหมือนเดิม
 */
function FlowChip({
  cell,
  side,
  onOpen,
}: {
  cell: CallFlowCell;
  side: 'ai' | 'human';
  /** กดเพื่อดูรายชื่อ — `null` = ช่องนี้ยังกดดูชื่อไม่ได้ (ฝั่งคนยังไม่มีเส้น) */
  onOpen: (() => void) | null;
}) {
  const value = side === 'ai' ? cell.ai : cell.human;
  const body = (
    <>
      <span className="text-muted-foreground">{cell.label}</span>
      {/* null = ฝั่งนั้นไม่มีข้อมูลช่องนี้ → ขีด (ต่างจาก 0 ที่เป็นคำตอบจริง) */}
      <span className={cn('font-medium tabular-nums', value ? TONE[cell.tone].value : 'text-muted-foreground')}>
        {value === null ? '—' : value.toLocaleString('th-TH')}
      </span>
    </>
  );
  // 🔴 เลขต้องกดดูชื่อได้ (เจ้าของสั่ง 3 ก.ย. 2569) — ช่องที่เป็น 0/ไม่มีข้อมูล ไม่มีอะไรให้ดู
  if (!onOpen || value === null || value === 0) {
    return (
      <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-transparent px-2 text-xs">
        {body}
      </span>
    );
  }
  return (
    <Button type="button" size="xs" variant="ghost" onClick={onOpen} title="กดดูรายชื่อ" className="shrink-0">
      {body}
    </Button>
  );
}

/**
 * แถวหนึ่งฝั่ง (AI หรือ คน) — "สายไปถึงไหน" | "ผลจากคนที่คุยแล้ว" คั่นด้วยเส้นตั้ง
 * 🔴 ช่องนับคนซ้ำกันได้ (Haiku เคยบวกเทียบ "ทั้งหมด" แล้วเลิกเชื่อ · 2 ก.ย. 2569) — บอกไว้ที่ title ของแถว
 */
function ChipRow({
  cells,
  side,
  onOpenCell,
}: {
  cells: CallFlowCell[];
  side: 'ai' | 'human';
  onOpenCell: (cell: CallFlowCell) => void;
}) {
  const where = cells.filter((c) => c.group === 'where');
  const result = cells.filter((c) => c.group === 'result');
  const chip = (c: CallFlowCell) => (
    <FlowChip key={`${side}-${c.key}`} cell={c} side={side} onOpen={side === 'ai' ? () => onOpenCell(c) : null} />
  );
  return (
    <div
      className="flex flex-wrap items-center gap-1"
      title="ทุกช่องนับคนซ้ำกันได้ ห้ามบวกรวมเทียบ ทั้งหมด (ทั้งหมด = จำนวนคนที่ส่งเข้าคิว นับหัวละครั้ง)"
      data-testid={`ai-call-flow-${side}`}
    >
      <span className="inline-flex w-28 shrink-0 items-center gap-1.5 text-xs font-medium text-foreground">
        {side === 'ai' ? <Bot className="size-3.5" aria-hidden /> : <UserRound className="size-3.5" aria-hidden />}
        {side === 'ai' ? 'ส่ง AI โทร' : 'เก็บไปโทรเอง'}
      </span>
      {where.map(chip)}
      <span className="mx-1 hidden h-5 border-l border-border sm:block" aria-hidden />
      {result.map(chip)}
    </div>
  );
}

export default function AiCallFlowPanel({
  defaultSource = 'all',
}: {
  defaultSource?: CallFunnelSource;
}) {
  const [source, setSource] = useState<CallFunnelSource>(defaultSource);
  const [funnel, setFunnel] = useState<CallFunnel>(EMPTY_FUNNEL);
  const [loading, setLoading] = useState(false);
  /** ป๊อปรายชื่อของช่องที่กด — เจ้าของสั่งให้ทุกเลขพิสูจน์ได้ด้วยชื่อ (3 ก.ย. 2569) */
  const [peopleCell, setPeopleCell] = useState<CallFlowCell | null>(null);
  const [people, setPeople] = useState<CallFunnelPerson[] | null>(null);
  const [peopleError, setPeopleError] = useState<string | null>(null);

  const openPeople = useCallback(
    (cell: CallFlowCell) => {
      setPeopleCell(cell);
      setPeople(null);
      setPeopleError(null);
      void fetchCallFunnelPeople(cell.key, undefined, source)
        .then(setPeople)
        // 🔴 โหลดพลาดต้องบอกว่าโหลดพลาด ห้ามขึ้นลิสต์ว่าง (อ่านเหมือน "ไม่มีใคร")
        .catch((e) => setPeopleError(e instanceof Error ? e.message : 'โหลดรายชื่อไม่ได้'));
    },
    [source],
  );

  const load = useCallback(() => {
    setLoading(true);
    void fetchCallFunnel(undefined, source)
      .then((d) => setFunnel(d.funnel))
      .finally(() => setLoading(false));
  }, [source]);

  useEffect(() => {
    load();
  }, [load]);

  const cells = aiCallFlowCells(funnel);
  const v2 = useUiV2();

  return (
    <div className="space-y-1.5" data-testid="ai-call-flow">
      <ChipRow cells={cells} side="ai" onOpenCell={openPeople} />
      {/* แถวคนเก็บไปโทร — ช่องเดียวกันเป๊ะ (template เดียวกัน) · ปุ่มต้นทางชิดขวาแถวนี้ (แถวสั้นกว่า) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChipRow cells={cells} side="human" onOpenCell={openPeople} />
        <div className="flex flex-wrap items-center gap-1">
          {SOURCE_TABS.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant="outline"
              size="xs"
              title={t.hint}
              onClick={() => setSource(t.id)}
              aria-pressed={source === t.id}
              /* 🔴 ตัวที่ถูกเลือกต้องแยกจากตัวที่ไม่ถูกเลือกให้ออก (audit 7 ก.ย. 2569 · งง-5) */
              className={cn(source === t.id && (v2 ? 'border-primary/50 bg-primary/10 font-medium text-primary' : 'bg-accent font-medium text-foreground'))}
            >
              {t.label}
            </Button>
          ))}
          <Button type="button" variant="ghost" size="iconXs" onClick={load} disabled={loading} aria-label="รีเฟรช" title="รีเฟรช">
            <RefreshCw className={cn(loading && 'animate-spin')} />
          </Button>
        </div>
      </div>
      <Dialog open={Boolean(peopleCell)} onOpenChange={(o) => (o ? undefined : setPeopleCell(null))}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {peopleCell?.label} · {people ? `${people.length.toLocaleString('th-TH')} คน` : 'กำลังโหลด…'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              รายชื่อจากคิวโทรจริง (ใหม่สุดก่อน · สูงสุด 200 คน)
            </DialogDescription>
          </DialogHeader>
          {peopleError ? (
            <p className="rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive">
              {peopleError} — ลองกดช่องนั้นอีกครั้ง
            </p>
          ) : people === null ? (
            <p className="text-xs text-muted-foreground">กำลังอ่านรายชื่อ…</p>
          ) : people.length === 0 ? (
            <p className="text-xs text-muted-foreground">ไม่มีใครในช่องนี้</p>
          ) : (
            <ul className="space-y-1">
              {people.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs"
                >
                  <span className="min-w-0">
                    <b>{p.name ?? 'ไม่มีชื่อในคิว'}</b>
                    <span className="text-muted-foreground"> · {p.phone ?? '—'}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {p.outcome
                      ? (CALL_OUTCOME_LABEL[p.outcome as keyof typeof CALL_OUTCOME_LABEL] ?? p.outcome)
                      : 'ยังไม่มีผล'}
                    {p.attempt > 1 ? ` · สายที่ ${p.attempt}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
