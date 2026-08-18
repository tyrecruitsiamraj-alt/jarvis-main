import React, { useEffect, useState } from 'react';
import { LoaderCircle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * dialog จัดการ **ลิสต์กลางของหน้า Follow** — เปิดจากปุ่มข้างไอคอนปฏิทินบนแผงการโทร
 * (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-5: *"เพิ่มเรื่อง / เพิ่มชื่อ เบอร์โทรเจ้าหน้าที่
 * ย้ายไปไว้ข้างๆปฏิทิน แล้วทำให้เพิ่มได้เฉพาะคนที่มีสิทธิระดับ supervisor"*)
 *
 * ใช้สองที่: "เพิ่มเรื่อง" (follow_topics) และ "เพิ่มเจ้าหน้าที่" (follow_staff_contacts)
 * — โชว์ลิสต์ที่มีทั้งหมด + ฟอร์มเพิ่ม · **ปุ่มที่เปิด dialog นี้โผล่เฉพาะ supervisor+
 * (คุมที่หน้าแม่)** และ server กันอีกชั้นที่ rbac ไม่ใช่แค่ซ่อนปุ่ม
 *
 * 🔴 เพิ่มสำเร็จต้องเรียก `onChanged` — dropdown ในฟอร์มที่ mount อยู่จะโหลดลิสต์ใหม่
 * ผ่าน reloadSignal ไม่งั้นของใหม่ไม่โผล่จนกว่าจะรีเฟรชหน้า
 */
export type ManagerField = {
  key: string;
  placeholder: string;
  inputMode?: 'tel' | 'text';
};

export default function FollowMasterManagerDialog<T>({
  open,
  onClose,
  title,
  description,
  fields,
  load,
  create,
  toChip,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** ช่องที่ต้องกรอกตอนเพิ่ม — key ต้องตรงกับที่ `create` คาดหวัง */
  fields: ManagerField[];
  load: () => Promise<T[]>;
  create: (input: Record<string, string>) => Promise<T>;
  /** ข้อความบนชิปของแต่ละรายการในลิสต์ */
  toChip: (item: T) => string;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<T[]>([]);
  /** null = ยังโหลดอยู่ · false = โหลดพัง */
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // โหลดใหม่ทุกครั้งที่เปิด — คนอื่นอาจเพิ่งเพิ่มไว้จากเครื่องอื่น
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoaded(null);
    setError(null);
    setOkMsg(null);
    void load()
      .then((v) => {
        if (!cancelled) {
          setItems(v);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(false);
      });
    return () => {
      cancelled = true;
    };
    // `load` เป็นฟังก์ชันคงที่จากไฟล์ api ไม่ต้องเฝ้า
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filled = fields.every((f) => (form[f.key] ?? '').trim());

  const add = async () => {
    if (!filled || busy) return;
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const created = await create(form);
      setItems((prev) => [...prev, created]);
      setForm({});
      setOkMsg(`เพิ่ม "${toChip(created)}" แล้ว`);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {loaded === null ? (
            <p className="text-xs text-muted-foreground">กำลังโหลด…</p>
          ) : loaded === false ? (
            <p className="text-xs text-muted-foreground">
              โหลดลิสต์ไม่ได้ตอนนี้ — ยังพิมพ์ค่าเองในฟอร์มได้ตามปกติ
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {items.length > 0 ? (
                items.map((it, i) => (
                  <span key={i} className="jarvis-chip jarvis-chip-neutral">
                    {toChip(it)}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">ยังไม่มีข้อมูลในลิสต์</span>
              )}
            </div>
          )}

          <div className="space-y-2">
            {fields.map((f) => (
              <input
                key={f.key}
                value={form[f.key] ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                onKeyDown={(e) => {
                  // Enter = เพิ่ม (dialog นี้ไม่มี <form> ครอบ จึงไม่ยิง submit ไปหน้าอื่น)
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void add();
                  }
                }}
                inputMode={f.inputMode}
                placeholder={f.placeholder}
                aria-label={f.placeholder}
                maxLength={120}
                className="jarvis-soft-field min-h-[44px] w-full"
              />
            ))}
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy || !filled}
              className={cn(
                'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 text-xs font-semibold disabled:opacity-50',
                TONE.info.outline,
              )}
            >
              {busy ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-3.5 w-3.5" aria-hidden />
              )}
              เพิ่มเข้าลิสต์
            </button>
          </div>

          {error ? (
            <p className={cn('rounded-lg px-2 py-1 text-[11px]', TONE.danger.soft, TONE.danger.value)}>
              {error}
            </p>
          ) : null}
          {okMsg ? (
            <p className={cn('rounded-lg px-2 py-1 text-[11px]', TONE.success.soft, TONE.success.value)}>
              {okMsg}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
