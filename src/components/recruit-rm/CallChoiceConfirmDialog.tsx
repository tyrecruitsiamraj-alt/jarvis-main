import React from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * ยืนยันก่อน **ส่ง AI โทรจริง** — เจ้าของสั่งไว้ว่าปุ่มที่ยิงสายจริงต้องมี popup ทุกตัว
 * และต้อง **เห็นรายชื่อ** ก่อนกด (Phase 5.12: "popup ยืนยันรายชื่อ")
 *
 * ⚠️ ใช้ `AlertDialog` ของ shadcn — ห้ามสร้าง Dialog เอง · ห้ามซ้อน Dialog ใน Dialog
 * ⚠️ ปุ่มยืนยันต้องบอกผลลัพธ์ ("ส่ง N คนเข้าคิวโทร") ไม่ใช่คำว่า "ตกลง"
 *
 * 🔴 เรียกจาก**ในป๊อปอื่น** ต้องส่ง `embedded` — จะได้เนื้อล้วนไม่ห่อ AlertDialog
 * (แพทเทิร์นเดียวกับ `GenApplyLinkDialog` · `EditPostingDialog`) ห้ามซ้อนป๊อป
 */
export type CallChoiceConfirmDialogProps = {
  open: boolean;
  /** รายชื่อที่จะถูกโทร — ถ้าว่าง ปุ่มยืนยันถูกปิด (ไม่มีอะไรให้ส่ง) */
  names: string[];
  /** กำลังยิงอยู่ — กันกดซ้อน */
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** ฝังในป๊อปที่เปิดอยู่แล้ว — คืนเนื้อล้วน ไม่ห่อ AlertDialog (ห้าม Dialog ซ้อน Dialog) */
  embedded?: boolean;
};

/** จำนวนชื่อที่โชว์ก่อนยุบ — ยาวกว่านี้ป๊อปสูงเกินจอมือถือ */
const NAMES_SHOWN = 12;

const CallChoiceConfirmDialog: React.FC<CallChoiceConfirmDialogProps> = ({
  open,
  names,
  busy = false,
  onCancel,
  onConfirm,
  embedded = false,
}) => {
  const shown = names.slice(0, NAMES_SHOWN);
  const more = names.length - shown.length;

  /** รายชื่อ + คำเตือน — ชิ้นเดียวใช้ทั้งสองโหมด ห้ามก๊อปสองที่ */
  const namesBlock = (
    <div className={cn('max-h-48 overflow-y-auto rounded-xl border px-3 py-2', DASH.card)}>
      {names.length === 0 ? (
        <p className={cn('text-xs', DASH.muted)}>ไม่มีรายชื่อที่ส่งได้ — ปิดหน้าต่างนี้ได้เลย</p>
      ) : (
        <ul className="space-y-0.5 text-xs">
          {shown.map((n, i) => (
            <li key={`${n}-${i}`} className={DASH.cell}>
              {i + 1}. {n}
            </li>
          ))}
          {more > 0 ? <li className={cn('pt-1 text-[11px]', DASH.muted)}>และอีก {more} คน</li> : null}
        </ul>
      )}
    </div>
  );

  if (embedded) {
    if (!open) return null;
    return (
      <div className={cn('space-y-2 rounded-xl border p-3', DASH.card)}>
        <p className="text-sm font-semibold">ให้ AI โทรหา {names.length} คนนี้?</p>
        <p className={cn('text-xs', DASH.muted)}>
          AI จะโทรออกหาคนในรายชื่อนี้จริง (เว้นช่วง 20:00–08:00 น. ระบบเลื่อนให้เอง) · คนที่มี
          เจ้าหน้าที่ถือไปโทรอยู่ · เบอร์ที่พักไว้ · คนที่เคยปฏิเสธงานใบนี้ ระบบจะข้ามให้เองและรายงานกลับ
        </p>
        {namesBlock}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-semibold disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={busy || names.length === 0}
            onClick={onConfirm}
            className={cn(
              'inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold disabled:opacity-50',
              TONE.primary.solid,
            )}
          >
            {busy ? 'กำลังส่ง…' : `ส่ง ${names.length} คนเข้าคิวโทร`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ให้ AI โทรหา {names.length} คนนี้?</AlertDialogTitle>
          <AlertDialogDescription>
            AI จะโทรออกหาคนในรายชื่อนี้จริง (เว้นช่วง 20:00–08:00 น. ระบบเลื่อนให้เอง) ·
            คนที่มีเจ้าหน้าที่ถือไปโทรอยู่ · เบอร์ที่พักไว้ · คนที่เคยปฏิเสธงานใบนี้
            ระบบจะข้ามให้เองและรายงานกลับ
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* รายชื่อ — กล่องเลื่อนของตัวเอง ไม่ให้ป๊อปยืดจนปุ่มหลุดจอ */}
        {namesBlock}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || names.length === 0}
            onClick={onConfirm}
            className={TONE.primary.solid}
          >
            {busy ? 'กำลังส่ง…' : `ส่ง ${names.length} คนเข้าคิวโทร`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CallChoiceConfirmDialog;
