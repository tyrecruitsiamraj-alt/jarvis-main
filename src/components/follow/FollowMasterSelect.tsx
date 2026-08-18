import React, { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { useAuth } from '@/contexts/AuthContext';

/**
 * ช่องเลือกค่าจาก **ลิสต์กลางที่แก้เองได้** บนหน้า Follow —
 * ใช้ร่วมกันสองที่: เบอร์เจ้าหน้าที่ผู้ติดตาม (099) และเรื่องที่จะให้โทรติดตาม (100)
 *
 * ทางถอยที่ต้องมีเสมอ (เจ้าของทำงานจริงต่อได้แม้ของกลางพัง):
 * - โหลดลิสต์ไม่ได้ / ตารางยังไม่ migrate → ถอยเป็นช่องพิมพ์เองแบบเดิม **ห้ามบล็อกงาน**
 * - ค่าเดิมของรายการเก่าที่ไม่ตรงกับใครในลิสต์ → โชว์เป็นตัวเลือก "ค่าที่กรอกไว้เดิม"
 *   (หายเงียบเมื่อไหร่ = เปิดแก้รายการเก่าแล้วค่าหลุดโดยไม่มีใครรู้)
 * - ปุ่มเพิ่มค่าใหม่โผล่เฉพาะ supervisor ขึ้นไป (server กันอีกชั้นที่ rbac ไม่ใช่แค่ซ่อนปุ่ม)
 */
export type MasterAddField = {
  key: string;
  label: string;
  placeholder: string;
  inputMode?: 'tel' | 'text';
};

export default function FollowMasterSelect<T>({
  id,
  label,
  value,
  onChange,
  emptyOptionLabel,
  manualPlaceholder,
  hint,
  addTitle,
  addFields,
  load,
  create,
  toValue,
  toLabel,
  reloadSignal,
}: {
  id: string;
  label: string;
  /** ค่าที่เก็บจริงในฟอร์ม — '' = ไม่ระบุ */
  value: string;
  onChange: (next: string) => void;
  emptyOptionLabel: string;
  manualPlaceholder: string;
  hint?: string;
  addTitle: string;
  /** ช่องที่ต้องกรอกตอนเพิ่มค่าใหม่ — key ต้องตรงกับที่ `create` คาดหวัง */
  addFields: MasterAddField[];
  load: () => Promise<T[]>;
  create: (input: Record<string, string>) => Promise<T>;
  /** ค่าที่จะถูกเก็บลงฟอร์มเมื่อเลือกตัวนี้ */
  toValue: (item: T) => string;
  /** ข้อความบน dropdown */
  toLabel: (item: T) => string;
  /**
   * เลขที่เปลี่ยนเมื่อไหร่ = **โหลดลิสต์ใหม่** — ใช้ตอนมีคนเพิ่มค่าจากที่อื่น
   * (เช่นกล่องจัดการเรื่องบนหน้า Follow) ขณะที่ dropdown นี้ mount อยู่แล้ว
   * ค่าเริ่มต้น/ไม่ส่ง = โหลดครั้งเดียวตอน mount เหมือนเดิม
   */
  reloadSignal?: number;
}) {
  const { user } = useAuth();
  const canAdd = user?.role === 'supervisor' || user?.role === 'admin';

  const [items, setItems] = useState<T[]>([]);
  /** null = ยังโหลดอยู่ · false = โหลดพัง (ถอยเป็นช่องพิมพ์เอง) */
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void load()
      .then((v) => {
        if (cancelled) return;
        setItems(v);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(false);
      });
    return () => {
      cancelled = true;
    };
    // โหลดใหม่เมื่อ mount หรือเมื่อ reloadSignal เปลี่ยน (มีคนเพิ่มค่าจากที่อื่น)
    // `load` เป็นฟังก์ชันคงที่จากไฟล์ api ไม่ต้องเฝ้า
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadSignal]);

  const matchedIndex = useMemo(
    () => items.findIndex((it) => toValue(it).trim() === value.trim()),
    [items, value, toValue],
  );

  const saveNew = async () => {
    setAddError(null);
    setAddBusy(true);
    try {
      const created = await create(form);
      setItems((prev) => [...prev, created]);
      // เพิ่มแล้วเลือกให้เลย — คนกดเพิ่มเพราะจะใช้กับรายการนี้แหละ
      onChange(toValue(created));
      setAddOpen(false);
      setForm({});
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'เพิ่มไม่สำเร็จ');
    } finally {
      setAddBusy(false);
    }
  };

  const showManualInput = loaded === false || manualMode;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="ml-1 text-xs font-medium text-muted-foreground">
        {label}
      </label>

      {showManualInput ? (
        <>
          <input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode={addFields[0]?.inputMode}
            placeholder={manualPlaceholder}
            className="jarvis-soft-field min-h-[46px] w-full"
          />
          {loaded !== false ? (
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="ml-1 text-[11px] text-primary underline"
            >
              กลับไปเลือกจากลิสต์
            </button>
          ) : null}
        </>
      ) : (
        <>
          <select
            id={id}
            value={matchedIndex >= 0 ? String(matchedIndex) : value ? '__manual__' : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                onChange('');
                return;
              }
              if (v === '__manual__') return;
              const it = items[Number(v)];
              if (it) onChange(toValue(it));
            }}
            disabled={loaded === null}
            className="jarvis-soft-field min-h-[46px] w-full disabled:opacity-60"
          >
            <option value="">{loaded === null ? 'กำลังโหลด…' : emptyOptionLabel}</option>
            {/* ค่าเดิมของรายการเก่าที่คีย์ก่อนมีลิสต์กลาง — ห้ามหายเงียบตอนเปิดแก้ */}
            {value && matchedIndex < 0 ? (
              <option value="__manual__">ค่าที่กรอกไว้เดิม: {value}</option>
            ) : null}
            {items.map((it, i) => (
              <option key={i} value={String(i)}>
                {toLabel(it)}
              </option>
            ))}
          </select>
          <p className="ml-1 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
            {hint}
            <button
              type="button"
              onClick={() => setManualMode(true)}
              className="underline hover:text-foreground"
            >
              พิมพ์เอง
            </button>
            {canAdd ? (
              <button
                type="button"
                onClick={() => {
                  setAddOpen((v) => !v);
                  setAddError(null);
                }}
                className="inline-flex items-center gap-0.5 font-medium text-primary underline"
              >
                <Plus className="h-3 w-3" aria-hidden /> {addTitle}
              </button>
            ) : null}
          </p>
        </>
      )}

      {/* ฟอร์มเพิ่มค่าใหม่ (supervisor+) — inline ไม่เปิด dialog ซ้อน (ฟอร์มแม่เป็น dialog อยู่แล้ว) */}
      {addOpen && !showManualInput ? (
        <div className={cn('space-y-2 rounded-xl border p-3', TONE.neutral.soft)}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">{addTitle}</span>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              aria-label={`ปิดฟอร์ม${addTitle}`}
              className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          {addFields.map((f) => (
            <input
              key={f.key}
              value={form[f.key] ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              inputMode={f.inputMode}
              placeholder={f.placeholder}
              aria-label={f.label}
              className="jarvis-soft-field min-h-[44px] w-full"
            />
          ))}
          {addError ? (
            <p className={cn('rounded-lg px-2 py-1 text-[11px]', TONE.danger.soft, TONE.danger.value)}>
              {addError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void saveNew()}
            disabled={addBusy}
            className={cn(
              'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-4 text-xs font-semibold disabled:opacity-50',
              TONE.info.outline,
            )}
          >
            {addBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            บันทึกเข้าลิสต์
          </button>
        </div>
      ) : null}
    </div>
  );
}
