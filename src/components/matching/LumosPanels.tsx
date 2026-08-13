import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import {
  lumosCallBadge,
  canCancelLumosCall,
  type LumosCallStatus,
  type LumosJobCallSummaryRow,
} from '@/lib/lumosDispatchApi';
import { lumosExtraStatChips, lumosFixedStatCells } from '@/lib/lumosStatCells';
import { ClipboardCheck, PhoneCall, Undo2, UserRound, X } from 'lucide-react';
import { formatDateTimeTh } from '@/lib/dateTh';
import { useEffect, useState } from 'react';
import { CALL_BATCH_UNDO_MINUTES, activeItemCount, undoMsLeft, type CallBatch } from '@/lib/callBatch';

// ─── แผงฝั่ง Lumos ในหน้า Matching — แยกออกจาก MatchingPage.tsx ตอนแตกไฟล์ ──────
// ไฟล์นี้ export แต่ component เท่านั้น (ฟังก์ชันล้วน `cardNextAction` อยู่ที่
// src/lib/matchingCardAction.ts) ไม่งั้น eslint เพิ่ม warning react-refresh

/**
 * ป้ายผลการโทร Lumos ต่อคน (ระดับ 1) — รอโทร → Lumos รับไปแล้ว → สนใจ/ปฏิเสธ/ไม่รับสาย
 * กดขยายเห็นสรุปบทสนทนา + ยกเลิกได้ถ้า Lumos ยังไม่ส่งผลกลับ
 */
export function LumosCallBadgeRow({
  row,
  expanded,
  onToggle,
  onCancel,
  cancelling,
}: {
  row: LumosCallStatus;
  expanded: boolean;
  onToggle: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const badge = lumosCallBadge(row);
  const hasDetail = Boolean(row.summary) || canCancelLumosCall(row);
  return (
    <div className="mt-1.5 border-t border-white/70 pt-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onToggle}
          disabled={!hasDetail}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
            badge.cls,
            hasDetail ? 'hover:brightness-95' : 'cursor-default',
          )}
        >
          {badge.label}
          {hasDetail ? <span aria-hidden>{expanded ? '▴' : '▾'}</span> : null}
        </button>
        <span className="text-[10px] text-muted-foreground">ส่งเมื่อ {formatDateTimeTh(row.sent_at)}</span>
        {row.delivery_count > 1 ? (
          <span className="text-[10px] text-muted-foreground">· ส่งซ้ำ {row.delivery_count} ครั้ง</span>
        ) : null}
      </div>
      {expanded ? (
        <div className="mt-1.5 space-y-1.5 rounded-lg border border-slate-200 bg-white/85 dark:border-white/10 dark:bg-white/5 px-2.5 py-1.5">
          {row.summary ? (
            <p className="text-[10px] leading-relaxed text-slate-700 dark:text-slate-200">
              <span className="font-semibold">สรุปบทสนทนา:</span> {row.summary}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">ยังไม่มีสรุปบทสนทนาจาก AI</p>
          )}
          <p className="text-[10px] text-muted-foreground">อัปเดตล่าสุด {formatDateTimeTh(row.updated_at)}</p>
          {canCancelLumosCall(row) ? (
            <button
              type="button"
              disabled={cancelling}
              onClick={onCancel}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold disabled:opacity-60',
                TONE.danger.outline,
              )}
            >
              <X className="h-2.5 w-2.5" /> {cancelling ? 'กำลังยกเลิก…' : 'ยกเลิกการส่ง'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * กล่องสรุปผลโทรของใบขอ 1 ใบ — อ่านซ้ายไปขวาตามลำดับที่งานเดินจริง:
 * ส่ง → โทรแล้ว → เหลือ → โอเค / ไม่ไป / ไม่รับ
 * โทรแล้ว = มีผลกลับจริง (ไม่นับสายที่ระบบยกเลิกเอง)
 *
 * ⚠️ **6 ช่องเสมอทุกใบ ทุกกรณี — component นี้ต้องไม่มีทางคืน null**
 * เจ้าของสั่ง 13 ส.ค. 2569: "ทุกใบก็ต้องเหมือนกันสิกันงง" · ใบที่ยังไม่เคยส่งโทรโชว์ 0
 * เดิมประกอบช่องตามข้อมูล (5–8 ช่อง) แต่ละช่อง flex-1 หารตามจำนวนช่องจริง
 * → เลขของสองใบไม่ตรงคอลัมน์กัน · และเดิมคืน null เมื่อ sent=0 ทำให้การ์ดขึ้นหัวข้อ
 * "ผลโทรในใบนี้" แล้วใต้หัวข้อว่างเปล่า
 * ช่องพิเศษ (รออนุมัติ/ขอเลื่อน/ต้องคนตาม) ย้ายไป <LumosJobStatChips /> ในแถวที่จองไว้
 * ตัวเลือกช่องอยู่ที่ src/lib/lumosStatCells.ts ที่เดียว (มีเทสต์บังคับว่าต้อง 6 ตัวเสมอ)
 */
export function LumosJobSummaryStats({
  s,
  className,
  variant = 'pill',
}: {
  /** ไม่มีแถวสรุป (ใบที่ยังไม่เคยเข้าคิว) ก็ส่ง undefined มาได้ — ได้ 6 ช่องเป็น 0 */
  s?: LumosJobCallSummaryRow;
  className?: string;
  /** pill = ก้อนลอยพื้นจาง (ในใบขอ/หน้ารายละเอียด) · column = เต็มความกว้างคอลัมน์ขวาของการ์ด */
  variant?: 'pill' | 'column';
}) {
  // สีของแต่ละช่องมาจาก token กลางผ่าน tone key: ส่ง=กลาง · โทรแล้ว=กำลังดำเนินการ ·
  // เหลือ/ไม่รับ=รอคนทำต่อ · โอเค=สนใจงาน (หาได้แล้ว) · ไม่ไป=ติดขัด
  const cells = lumosFixedStatCells(s);
  // สไตล์เรียบแบบ Apple: พื้นจางชิ้นเดียว ไม่มีเส้นแบ่ง เลขน้ำหนักกลางตัวใหญ่ขึ้นเล็กน้อย
  // ป้ายตัวจิ๋วโทนเทา ค่า 0 จางลงทั้งช่องให้ตาไหลผ่านไปหาช่องที่มีค่า
  return (
    <div
      className={cn(
        'flex items-center gap-0.5',
        variant === 'pill'
          ? 'shrink-0 rounded-2xl bg-slate-900/[0.04] px-2 py-1.5 dark:bg-white/[0.07]'
          : 'mt-0.5 w-full justify-between',
        className,
      )}
    >
      {cells.map((c) => (
        <div
          key={c.key}
          title={c.title}
          className={cn(
            'px-1 text-center',
            // basis-0 คู่กับ flex-1 — ไม่งั้นช่องป้ายยาว ("โทรแล้ว") กินความกว้างไปจาก
            // ช่องป้ายสั้น ("ส่ง") แล้วเลขของสองการ์ดไม่ตรงคอลัมน์กันทั้งที่ช่องเท่ากันแล้ว
            variant === 'pill' ? 'min-w-[42px]' : 'min-w-0 flex-1 basis-0',
            c.value === 0 && 'opacity-35',
          )}
        >
          <div
            className={cn(
              'text-[15px] font-semibold leading-tight tabular-nums tracking-tight',
              c.value === 0 ? DASH.muted : TONE[c.tone].value,
            )}
          >
            {c.value}
          </div>
          <div className={cn('text-[9px] font-medium leading-tight tracking-wide', DASH.muted)}>
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * ชิปของช่องพิเศษ (รออนุมัติ / ขอเลื่อน / ต้องคนตาม) — เดิมเบียดเข้าไปในแถบ 6 ช่อง
 * ทำให้ความกว้างต่อช่องของแต่ละการ์ดไม่เท่ากัน · ตอนนี้ออกมาอยู่ในแถวที่จองที่ไว้แล้ว
 * คืน null ได้ (แถวแม่จองความสูงไว้เอง จึงไม่ทำให้การ์ดสูงไม่เท่ากัน)
 */
export function LumosJobStatChips({ s, className }: { s?: LumosJobCallSummaryRow; className?: string }) {
  const chips = lumosExtraStatChips(s);
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((c) => (
        <span
          key={c.key}
          title={c.title}
          className={cn('shrink-0 whitespace-nowrap tabular-nums', TONE[c.tone].chip, className)}
        >
          {c.label} {c.value}
        </span>
      ))}
    </>
  );
}

/** แถบ "ส่งให้ Lumos โทร" — โผล่เมื่อติ๊กเลือกอย่างน้อย 1 คน (ใช้ทั้งฝั่งคนของเราและ iRecruit) */
export function LumosSendBar({
  count,
  onSend,
  onCreateBatch,
  onClear,
  busy,
  creatingBatch,
  onHoldSelf,
  holdingSelf = false,
}: {
  count: number;
  onSend: () => void;
  /** ตั้งเป็นชุดที่หน่วงไว้ก่อน — เข้าคิวเองเมื่อพ้นช่วงถอนคำ */
  onCreateBatch: () => void;
  onClear: () => void;
  busy: boolean;
  creatingBatch: boolean;
  /**
   * "เก็บไปโทรเอง" — จับ call hold ให้ตัวเองแทนส่ง AI (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก:
   * "matching เสร็จก็เลือกได้ว่าอนุมัติให้ ai โทรหรือเก็บไปโทรเอง")
   */
  onHoldSelf?: () => void;
  holdingSelf?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-300 bg-sky-50/80 px-3 py-2 dark:border-sky-700 dark:bg-sky-950/50">
      <p className="text-[11px] font-semibold text-sky-900 dark:text-sky-200">ติ๊กเลือกไว้ {count} คน</p>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onClear}
          className="jarvis-btn-ghost"
        >
          ล้างที่เลือก
        </button>
        {/* ทางเลือกที่ 2: ไม่ยิงเข้าคิวทันที แต่หน่วงไว้ก่อน — ระหว่างหน่วงยังถอนคำได้
            เดิมปุ่มนี้ตั้งเป็น "ชุดรออนุมัติ" ซึ่งกลายเป็นทางตันตอนแผงอนุมัติถูกเอาออก
            เจ้าของเคาะ 11 ส.ค. 2569: ข้ามขั้นอนุมัติ แต่คงช่วงถอนคำไว้เป็นตัวกันพลาด */}
        <button
          type="button"
          disabled={busy || creatingBatch}
          onClick={onCreateBatch}
          title={`ตั้งคิวไว้ก่อน — เข้าคิวจริงอีก ${CALL_BATCH_UNDO_MINUTES} นาที ระหว่างนี้กดยกเลิกได้`}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50',
            TONE.warn.outline,
          )}
        >
          <ClipboardCheck className="h-3 w-3" />
          {creatingBatch ? 'กำลังตั้งคิว…' : `ตั้งคิวโทร (${count})`}
        </button>
        {/* ⚠️ เคยซ่อนปุ่มนี้ตอนจุดนั้นเปิดโหมด assist — assist ถูกถอดทิ้ง 11 ส.ค. 2569
            พร้อมลูปอนุมัติ · สองปุ่มไม่ขัดนโยบายกันเองแล้ว: อันนี้เข้าคิวทันที
            อีกอันหน่วง 10 นาทีแล้วถอนคำได้ */}
        {onHoldSelf ? (
          <button
            type="button"
            disabled={busy || creatingBatch || holdingSelf}
            onClick={onHoldSelf}
            title="ล็อกคนที่เลือกเข้าถังโทรของคุณ — AI จะไม่โทรทับ · ไปโทร+บันทึกผลที่หน้าโทรของฉัน"
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50',
              TONE.success.outline,
            )}
          >
            <UserRound className="h-3 w-3" />
            {holdingSelf ? 'กำลังเก็บ…' : `เก็บไปโทรเอง (${count})`}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || creatingBatch || holdingSelf}
          onClick={onSend}
          className="jarvis-btn-primary"
        >
          <PhoneCall className="h-3 w-3" /> ส่ง AI โทร ({count} คน)
        </button>
      </div>
    </div>
  );
}

/** เหลือเวลา → "9:58" (ไม่ใช้ Intl/toLocaleString — ตัวนี้เดินทุกวินาที ดูกติกาข้อ 10) */
function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const s = total % 60;
  return `${Math.floor(total / 60)}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * แถบ "ถอนคำ" ของชุดที่เพิ่งตั้งคิวไป — นับถอยหลังจนถึงเวลาเข้าคิวจริง
 *
 * ⚠️ **แถบนี้คือเหตุผลที่ช่วงถอนคำยังมีความหมาย** — ปุ่ม "ตั้งคิวโทร" ข้ามขั้นอนุมัติแล้ว
 * (เจ้าของเคาะ 11 ส.ค. 2569) ถ้าไม่มีที่กดยกเลิก ช่วง 10 นาทีจะเป็นแค่การหน่วงเฉย ๆ
 * ที่ไม่มีใครถอนได้ = ทางตันแบบเดียวกับแผงอนุมัติที่เพิ่งเอาออก
 *
 * นี่ **ไม่ใช่แผงอนุมัติที่เจ้าของสั่งเอาออก** — ไม่มีปุ่มอนุมัติ ไม่ดึงรายการชุดของคนอื่น
 * โผล่เฉพาะชุดที่ผู้ใช้คนนี้เพิ่งกดในหน้านี้ แล้วหายไปเองเมื่อหมดเวลา
 */
export function CallBatchUndoStrip({
  batches,
  onCancel,
  cancellingId,
}: {
  batches: CallBatch[];
  onCancel: (batchId: string) => void;
  cancellingId: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  // เดินนาฬิกาเฉพาะตอนมีชุดค้างอยู่จริง — ไม่มีชุดก็ไม่ต้องมี interval ลอยอยู่เบื้องหลัง
  useEffect(() => {
    if (batches.length === 0) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [batches.length]);

  const live = batches.filter((b) => undoMsLeft(b, now) > 0);
  if (live.length === 0) return null;

  return (
    <div className={cn('space-y-1.5 rounded-xl border px-3 py-2', TONE.warn.soft)}>
      {live.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            ตั้งคิวโทร {activeItemCount(b)} คน ·{' '}
            <span className={TONE.warn.num}>เข้าคิวจริงในอีก {mmss(undoMsLeft(b, now))}</span>{' '}
            <span className="font-medium text-slate-500 dark:text-slate-400">
              (ยกเลิกได้จนกว่าจะครบ {CALL_BATCH_UNDO_MINUTES} นาที)
            </span>
          </p>
          <button
            type="button"
            disabled={cancellingId === b.id}
            onClick={() => onCancel(b.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold disabled:opacity-50',
              TONE.danger.outline,
            )}
          >
            <Undo2 className="h-3 w-3" />
            {cancellingId === b.id ? 'กำลังยกเลิก…' : 'ยกเลิกชุดนี้'}
          </button>
        </div>
      ))}
    </div>
  );
}
