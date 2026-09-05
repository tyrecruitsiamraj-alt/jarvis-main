import React, { useState } from 'react';
import { UserSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { fetchSelectionRecall, selectionRecallPoolSummary } from '@/lib/recruitLaneApi';

/**
 * "หาคน" จากกองคนที่เคยตอบไม่สนใจงานอื่น (เจ้าของสั่ง 17 ส.ค. 2569 ข้อ 4 ของงานคัดสรร:
 * *"เมื่อหมดรายชื่อให้กดปุ่มหาคน ระบบจะไปหาจากคนที่ไม่สนใจงานมาให้"*)
 *
 * ⚠️ ของหลังบ้านมีครบตั้งแต่ 16 ส.ค. (`/api/matching/selection-recall`) แต่**ไม่มีปุ่มไหน
 * เรียกมันเลย** — ตรวจ 17 ส.ค. เจอว่าเรียกได้เฉพาะยิง API ตรง ๆ ปุ่มนี้คือทางเข้าจากหน้าจอ
 *
 * ⚠️ กดแล้ว **ส่ง AI โทรทันที** (`send: true`) ตามนิยามของเส้นนี้ — คนกลุ่มนี้สมัครไว้แล้ว
 * ไม่ต้องเก็บใบสมัครใหม่ · ยืนยันก่อนหนึ่งชั้นเพราะมันคือการสั่งโทรจริง
 */
const SelectionRecallButton: React.FC<{
  jobId: string;
  onDone?: () => void;
}> = ({ jobId, onDone }) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    if (!window.confirm('ค้นคนที่เคยตอบไม่สนใจงานอื่น แล้วส่งคนที่ AI แนะนำให้โทรทันที?')) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetchSelectionRecall(jobId, { send: true });
      setResult(selectionRecallPoolSummary(r));
      onDone?.();
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'ค้นไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void run();
        }}
        title="ค้นจากคนที่สมัครไว้แล้วแต่เคยตอบไม่สนใจงานอื่น แล้วส่ง AI โทรทันที"
        className={cn(
          // Wave 2.2: มือถือสูงอย่างน้อย 36px (min-h-9) แตะติดง่าย · เดสก์ท็อปเท่าเดิม
          'inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50 sm:min-h-0',
          TONE.violet.outline,
        )}
      >
        <UserSearch className="h-3 w-3 shrink-0" />
        <span className="truncate">{busy ? 'กำลังค้น…' : 'หาคนจากกองไม่สนใจ'}</span>
      </button>
      {result ? (
        <p className="text-right text-[10px] leading-tight text-muted-foreground">{result}</p>
      ) : null}
    </div>
  );
};

export default SelectionRecallButton;
