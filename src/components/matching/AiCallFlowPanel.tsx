import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import {
  EMPTY_FUNNEL,
  fetchCallFunnel,
  type CallFunnel,
  type CallFunnelSource,
} from '@/lib/callFunnelApi';
import { aiCallFlowCells, type CallFlowCell } from '@/lib/aiCallFlowCells';
import { RefreshCw, Bot, UserRound } from 'lucide-react';
import PageHeroStrip, { heroButton } from '@/components/shared/PageHeroStrip';

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
function CallCell({ cell, side }: { cell: CallFlowCell; side: 'ai' | 'human' }) {
  const t = TONE[cell.tone];
  const value = side === 'ai' ? cell.ai : cell.human;
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border border-white/[0.14] bg-white/[0.07] px-2.5 py-2 !border-t-[3px]',
        t.bar,
      )}
    >
      <div className="truncate text-[10px] font-medium leading-tight text-slate-400" title={cell.label}>
        {cell.label}
      </div>
      <div className={cn('mt-0.5 text-xl font-bold leading-none tabular-nums tracking-tight', t.onDark)}>
        {/* null = ฝั่งนั้นไม่มีข้อมูลช่องนี้ → ขีด (ต่างจาก 0 ที่เป็นคำตอบจริง) */}
        {value === null ? <span className="text-slate-500">—</span> : value.toLocaleString('th-TH')}
      </div>
    </div>
  );
}

/**
 * ช่องจัดเป็น **สองกลุ่มติดหัว** (แผนแก้จุดงงข้อ 1 · 2 ก.ย. 2569) — Haiku ทดสอบแล้ว
 * เอาทุกช่องมาบวกเทียบ "ทั้งหมด" แล้วเลิกเชื่อ · กลุ่มบอกว่าตอบคนละคำถาม
 * คอลัมน์สองแถว (AI/คน) ยังตรงกันเพราะ template เดียวกันต่อกลุ่ม
 */
const WHERE_GRID = 'grid grid-cols-3 gap-1.5';
const RESULT_GRID = 'grid grid-cols-2 gap-1.5 sm:grid-cols-5';

/** แถวหนึ่งฝั่ง (AI หรือ คน) — สองกลุ่มวางคู่กัน จอแคบซ้อนเป็นสองชั้น */
function CellRow({ cells, side }: { cells: CallFlowCell[]; side: 'ai' | 'human' }) {
  const where = cells.filter((c) => c.group === 'where');
  const result = cells.filter((c) => c.group === 'result');
  return (
    <div className="mt-2 grid gap-2 lg:grid-cols-[3fr_5fr]">
      <div>
        <p className="mb-1 text-[10px] font-semibold text-slate-400">สายอยู่ตรงไหน</p>
        <div className={WHERE_GRID}>
          {cells.length === 0
            ? null
            : where.map((c) => <CallCell key={`${side}-${c.key}`} cell={c} side={side} />)}
        </div>
      </div>
      <div>
        <p className="mb-1 text-[10px] font-semibold text-slate-400">คุยแล้วผลเป็นยังไง</p>
        <div className={RESULT_GRID}>
          {result.map((c) => (
            <CallCell key={`${side}-${c.key}`} cell={c} side={side} />
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

  return (
    <PageHeroStrip
      eyebrow={`AI โทร · ${SOURCE_TABS.find((t) => t.id === source)?.label ?? 'ทั้งหมด'}`}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          {SOURCE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              onClick={() => setSource(t.id)}
              className={cn(
                heroButton,
                source === t.id && 'bg-white/25',
              )}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={cn(heroButton, 'disabled:opacity-50')}
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> รีเฟรช
          </button>
        </div>
      }
    >
      {/* แถว AI */}
      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
        <Bot className="h-3.5 w-3.5" aria-hidden /> ส่ง AI โทร
      </div>
      <CellRow cells={cells} side="ai" />

      {/* แถวคนเก็บไปโทร — กลุ่ม/คอลัมน์เดียวกันเป๊ะ (template เดียวกัน) */}
      <div className="mt-3 flex items-center gap-1.5 border-t border-white/10 pt-3 text-[11px] font-semibold text-slate-300">
        <UserRound className="h-3.5 w-3.5" aria-hidden /> คนเก็บไปโทรเอง
      </div>
      <CellRow cells={cells} side="human" />

      {/* 🔴 บรรทัดกันคนบวกเลขเอง — สองกลุ่มตอบคนละคำถาม ช่องซ้อนกันได้ */}
      <p className="mt-2 text-[10px] text-slate-500">
        คนเดียวอยู่ได้หลายช่อง (รับสายแล้ว &ldquo;สนใจ&rdquo; นับทั้งสองช่อง) —
        เลขพวกนี้ไม่ได้บวกกันเป็น &ldquo;ทั้งหมด&rdquo;
      </p>
    </PageHeroStrip>
  );
}
