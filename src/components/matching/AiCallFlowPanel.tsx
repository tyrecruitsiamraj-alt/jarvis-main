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
import PageHeroStrip from '@/components/shared/PageHeroStrip';
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
 * 1 ช่องสถานะบนพื้นเข้ม — เล็กกว่า FlowStage ของ funnel เพราะมี 8 ช่อง/แถว
 * เน้นความหมายด้วย **ขีดบน (bar) + สีตัวเลข** ไม่ใช่พื้นสว่าง (หลัก "หมึกกับกระดาษ")
 */
function CallCell({
  cell,
  side,
  onOpen,
}: {
  cell: CallFlowCell;
  side: 'ai' | 'human';
  /** กดเพื่อดูรายชื่อ — `null` = ช่องนี้ยังกดดูชื่อไม่ได้ (ฝั่งคนยังไม่มีเส้น) */
  onOpen: (() => void) | null;
}) {
  const t = TONE[cell.tone];
  /**
   * 🔴 โฉมใหม่ (5 ก.ย. 2569): แผงนี้ย้ายมาอยู่บน **พื้นขาว** ⇒ สีที่เขียนไว้สำหรับพื้นเข้ม
   * (`t.onDark` · `bg-white/[0.07]` · `text-slate-400`) จะจมหายไปกับพื้น
   * ⇒ สลับเป็นสีของธีม · **ตัวเลข/ความหมาย/การกดดูรายชื่อ เหมือนเดิมทุกอย่าง**
   */
  const v2 = useUiV2();
  const value = side === 'ai' ? cell.ai : cell.human;
  const body = (
    <>
      <div
        className={cn(
          'truncate text-[10px] font-medium leading-tight',
          v2 ? 'text-muted-foreground' : 'text-slate-400',
        )}
        title={cell.label}
      >
        {cell.label}
      </div>
      <div
        className={cn(
          'mt-0.5 text-xl font-bold leading-none tabular-nums tracking-tight',
          v2 ? t.value : t.onDark,
        )}
      >
        {/* null = ฝั่งนั้นไม่มีข้อมูลช่องนี้ → ขีด (ต่างจาก 0 ที่เป็นคำตอบจริง) */}
        {value === null ? (
          <span className={v2 ? 'text-muted-foreground' : 'text-slate-500'}>—</span>
        ) : (
          value.toLocaleString('th-TH')
        )}
      </div>
    </>
  );
  const shell = cn(
    'min-w-0 rounded-xl border px-2.5 py-2 !border-t-[3px] text-left',
    v2 ? 'border-border bg-background/60' : 'border-white/[0.14] bg-white/[0.07]',
    t.bar,
  );
  /**
   * 🔴 **เลขต้องกดดูชื่อได้** (เจ้าของสั่ง 3 ก.ย. 2569 ให้ดันทุกหน้าถึง 8 คะแนน)
   * พนักงานใหม่ให้หน้านี้ 4/10 ด้วยเหตุผลว่า *"ไม่เห็นรายชื่อจริง แค่ตัวเลขรวม"*
   * — เลขที่พิสูจน์ไม่ได้ คนก็ไม่เชื่อ (ท่าเดียวกับหน้าติดตามที่กดกล่องแล้วเห็นชื่อ)
   */
  if (!onOpen || value === null || value === 0) {
    return <div className={shell}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(shell, 'transition', v2 ? 'hover:bg-accent' : 'hover:bg-white/[0.14]')}
    >
      {body}
      <span className={cn('mt-0.5 block text-[9px]', v2 ? 'text-muted-foreground' : 'text-slate-500')}>
        กดดูรายชื่อ (เปิดในหน้านี้)
      </span>
    </button>
  );
}

/**
 * ช่องจัดเป็น **สองกลุ่มติดหัว** (แผนแก้จุดงงข้อ 1 · 2 ก.ย. 2569) — Haiku ทดสอบแล้ว
 * เอาทุกช่องมาบวกเทียบ "ทั้งหมด" แล้วเลิกเชื่อ · กลุ่มบอกว่าตอบคนละคำถาม
 * คอลัมน์สองแถว (AI/คน) ยังตรงกันเพราะ template เดียวกันต่อกลุ่ม
 */
/**
 * Wave 2.2 (5 ก.ย. 2569): บนจอ < sm ทั้งสองกลุ่มเรียง **2 คอลัมน์** ช่องจึงกว้างพอ
 * ให้ป้ายอ่านจบ (เดิมกลุ่มซ้ายบังคับ 3 คอลัมน์ตลอด บน 375px ป้ายถูกตัดเป็น
 * "กำลังโทร / ถึ…") · จำนวนช่อง/ตัวเลข/ปุ่มกดดูรายชื่อ เท่าเดิมทุกช่อง
 */
const WHERE_GRID = 'grid grid-cols-2 gap-1.5 sm:grid-cols-3';
const RESULT_GRID = 'grid grid-cols-2 gap-1.5 sm:grid-cols-5';

/** แถวหนึ่งฝั่ง (AI หรือ คน) — สองกลุ่มวางคู่กัน จอแคบซ้อนเป็นสองชั้น */
function CellRow({
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
  const v2 = useUiV2();
  const groupLabel = cn('mb-1 text-[10px] font-semibold', v2 ? 'text-muted-foreground' : 'text-slate-400');
  return (
    <div className="mt-2 grid gap-2 lg:grid-cols-[3fr_5fr]">
      <div>
        <p className={groupLabel}>ตอนนี้สายไปถึงขั้นไหน</p>
        <div className={WHERE_GRID}>
          {cells.length === 0
            ? null
            : where.map((c) => (
                <CallCell
                  key={`${side}-${c.key}`}
                  cell={c}
                  side={side}
                  onOpen={side === 'ai' ? () => onOpenCell(c) : null}
                />
              ))}
        </div>
      </div>
      <div>
        <p className={groupLabel}>ผลจากคนที่คุยแล้ว</p>
        <div className={RESULT_GRID}>
          {result.map((c) => (
            <CallCell
              key={`${side}-${c.key}`}
              cell={c}
              side={side}
              onOpen={side === 'ai' ? () => onOpenCell(c) : null}
            />
          ))}
        </div>
      </div>
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
  /** โฉมใหม่: แผงย้ายมาอยู่บนพื้นขาว ⇒ ตัวหนังสือ/เส้นคั่นที่เขียนไว้สำหรับพื้นเข้มต้องสลับ */
  const v2 = useUiV2();
  const rowHead = cn(
    'mt-3 flex items-center gap-1.5 text-[11px] font-semibold',
    v2 ? 'text-foreground' : 'text-slate-300',
  );

  return (
    <PageHeroStrip
      eyebrow={`AI โทร · ${SOURCE_TABS.find((t) => t.id === source)?.label ?? 'ทั้งหมด'}`}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          {SOURCE_TABS.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant="hero"
              size="sm"
              title={t.hint}
              onClick={() => setSource(t.id)}
              className={cn(source === t.id && (v2 ? 'bg-accent text-accent-foreground' : 'bg-white/25'))}
            >
              {t.label}
            </Button>
          ))}
          <Button type="button" variant="hero" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn(loading && 'animate-spin')} /> รีเฟรช
          </Button>
        </div>
      }
    >
      {/* แถว AI */}
      <div className={rowHead}>
        <Bot className="h-3.5 w-3.5" aria-hidden /> ส่ง AI โทร
      </div>
      <CellRow cells={cells} side="ai" onOpenCell={openPeople} />

      {/* แถวคนเก็บไปโทร — กลุ่ม/คอลัมน์เดียวกันเป๊ะ (template เดียวกัน) */}
      <div className={cn(rowHead, 'border-t pt-3', v2 ? 'border-border' : 'border-white/10')}>
        <UserRound className="h-3.5 w-3.5" aria-hidden /> คนเก็บไปโทรเอง
      </div>
      <CellRow cells={cells} side="human" onOpenCell={openPeople} />

      {/* 🔴 บรรทัดกันคนบวกเลขเอง — ต้องครอบ **ทุก** ช่อง ไม่ใช่ยกตัวอย่างเดียว
          (Haiku รอบสองยังบวก "กำลังโทร 40 + รอใหม่ 39 = 79 ≠ 77" เพราะตัวอย่างเดิม
          พูดถึงแต่ฝั่งผล เลยเข้าใจว่าฝั่ง "ตอนนี้สายไปถึงขั้นไหน" ต้องบวกลงตัว) */}
      <p className={cn('mt-2 text-[10px]', v2 ? 'text-muted-foreground' : 'text-slate-500')}>
        ทุกช่องนับคนซ้ำกันได้ — กำลังโทรอยู่ก็ถูกนัดให้ AI โทรใหม่ได้ · รับสายแล้ว
        &ldquo;สนใจ&rdquo; นับทั้งสองช่อง ⇒ <b>ห้ามเอาช่องไหนบวกกันเทียบ &ldquo;ทั้งหมด&rdquo;</b>{' '}
        (ทั้งหมด = จำนวนคนที่ส่งเข้าคิว นับหัวละครั้ง)
      </p>
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
    </PageHeroStrip>
  );
}
