import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import {
  lumosCallBadge,
  canCancelLumosCall,
  type LumosCallStatus,
  type LumosJobCallSummaryRow,
} from '@/lib/lumosDispatchApi';
import { ClipboardCheck, PhoneCall, X } from 'lucide-react';
import { formatDateTimeTh } from '@/lib/dateTh';

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
 * กล่องสรุปผลโทรของใบขอ 1 ใบ — ตัวเลข 6 ช่องอ่านปราดเดียวรู้:
 * ส่ง / โทรแล้ว / เหลือ (ยังไม่ได้โทร) / โอเค / ไม่ไป / ไม่รับ
 * โทรแล้ว = มีผลกลับจริง (ไม่นับสายที่ระบบยกเลิกเอง)
 */
export function LumosJobSummaryStats({
  s,
  className,
  variant = 'pill',
}: {
  s: LumosJobCallSummaryRow;
  className?: string;
  /** pill = ก้อนลอยพื้นจาง (ในใบขอ/หน้ารายละเอียด) · column = เต็มความกว้างคอลัมน์ขวาของการ์ด */
  variant?: 'pill' | 'column';
}) {
  if (s.sent === 0) return null;
  const waiting = Math.max(0, s.sent - s.called);
  const cells = [
    // สีของแต่ละช่องมาจาก token กลาง: ส่ง=กลาง · โทรแล้ว=กำลังดำเนินการ · เหลือ/ไม่รับ=รอคนทำต่อ ·
    // โอเค=สนใจงาน (หาได้แล้ว) · ไม่ไป=ติดขัด
    { label: 'ส่ง', value: s.sent, cls: TONE.neutral.value, title: 'ส่งเข้าคิว AI โทรแล้ว (ไม่นับที่ยกเลิก)' },
    { label: 'โทรแล้ว', value: s.called, cls: TONE.primary.value, title: 'มีผลโทรกลับมาจริง' },
    { label: 'เหลือ', value: waiting, cls: TONE.warn.value, title: 'รอ AI โทร (ส่งแล้วยังไม่มีผลกลับ)' },
    { label: 'โอเค', value: s.confirmed, cls: TONE.success.value, title: 'สนใจงาน' },
    { label: 'ไม่ไป', value: s.declined, cls: TONE.danger.value, title: 'ไม่สนใจ/ปฏิเสธ' },
    { label: 'ไม่รับ', value: s.no_answer, cls: TONE.warn.value, title: 'ไม่รับสาย — ควรโทรซ้ำ' },
  ];
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
          key={c.label}
          title={c.title}
          className={cn(
            'px-1 text-center',
            variant === 'pill' ? 'min-w-[42px]' : 'min-w-0 flex-1',
            c.value === 0 && 'opacity-35',
          )}
        >
          <div
            className={cn(
              'text-[15px] font-semibold leading-tight tabular-nums tracking-tight',
              c.value === 0 ? DASH.muted : c.cls,
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

/** แถบ "ส่งให้ Lumos โทร" — โผล่เมื่อติ๊กเลือกอย่างน้อย 1 คน (ใช้ทั้งฝั่งคนของเราและ iRecruit) */
export function LumosSendBar({
  count,
  onSend,
  onCreateBatch,
  onClear,
  busy,
  creatingBatch,
  assistOnly,
}: {
  count: number;
  onSend: () => void;
  /** สร้างชุดรออนุมัติแทนการส่งเข้าคิวทันที — คนอนุมัติที่หน้า Follow */
  onCreateBatch: () => void;
  onClear: () => void;
  busy: boolean;
  creatingBatch: boolean;
  /** จุดนี้อยู่ใต้โหมด assist — ของใหม่ต้องผ่านอนุมัติเสมอ จึงไม่มีปุ่มส่งเข้าคิวตรง */
  assistOnly: boolean;
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
        {/* ทางเลือกที่ 2: ไม่ส่งเข้าคิวทันที แต่ตั้งเป็นชุดให้หัวหน้าอนุมัติก่อน
            เดิมชุดเกิดได้จากโหมด assist อย่างเดียว ทั้งที่ API รองรับสร้างเองมาตั้งแต่แรก */}
        <button
          type="button"
          disabled={busy || creatingBatch}
          onClick={onCreateBatch}
          title="ตั้งเป็นชุดรออนุมัติ — ยังไม่โทร จนกว่าหัวหน้าจะกดอนุมัติที่หน้า Follow"
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50',
            TONE.warn.outline,
          )}
        >
          <ClipboardCheck className="h-3 w-3" />
          {creatingBatch ? 'กำลังสร้างชุด…' : `ตั้งชุดรออนุมัติ (${count})`}
        </button>
        {/* จุดที่เปิด assist: ของใหม่ต้องผ่านอนุมัติเสมอ — ซ่อนปุ่มส่งตรง
            ไม่งั้นมีสองปุ่มที่ขัดนโยบายกันเองให้คนงงว่ากดอันไหน */}
        {assistOnly ? null : (
          <button
            type="button"
            disabled={busy || creatingBatch}
            onClick={onSend}
            className="jarvis-btn-primary"
          >
            <PhoneCall className="h-3 w-3" /> ส่ง AI โทร ({count} คน)
          </button>
        )}
      </div>
    </div>
  );
}
