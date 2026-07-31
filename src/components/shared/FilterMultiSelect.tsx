import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Option = { value: string; label: string };

type FilterMultiSelectProps = {
  id: string;
  label: string;
  options: Option[];
  /** ค่าที่เลือกอยู่ — [] = ทั้งหมด */
  values: string[];
  onChange: (values: string[]) => void;
  allLabel?: string;
  /** คำนามในสรุป เช่น "เลือก 3 สถานะ" (default: "รายการ") */
  summaryNoun?: string;
  disabled?: boolean;
  className?: string;
};

type PanelPos = { left: number; top: number; width: number; maxHeight: number };

const PANEL_GAP = 4;
const VIEWPORT_MARGIN = 12;
const MIN_PANEL_HEIGHT = 160;

/** dropdown ติ๊กหลายค่าให้หน้าตาเข้าชุด FilterSelect — [] = ทั้งหมด
 *  panel render ผ่าน portal + position: fixed เพราะการ์ดฟิลเตอร์ใช้ backdrop-blur
 *  ซึ่งสร้าง stacking context ใหม่ — ถ้าวางแบบ absolute ปกติ panel จะโดนการ์ดถัดไปทับ */
export function FilterMultiSelect({
  id,
  label,
  options,
  values,
  onChange,
  allLabel = 'ทั้งหมด',
  summaryNoun = 'รายการ',
  disabled = false,
  className,
}: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  /** คำนวณตำแหน่ง panel จากปุ่ม — เปิดขึ้นบนถ้าที่ด้านล่างไม่พอ และไม่ให้ล้นขอบจอ */
  const measure = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    // บาง embed/หน้าต่างที่ถูกซ่อนรายงานขนาด viewport เป็น 0 — อย่าคำนวณจากค่าเพี้ยน
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    if (vh <= 0 || vw <= 0) {
      setPos({ left: rect.left, top: rect.bottom + PANEL_GAP, width: rect.width, maxHeight: 256 });
      return;
    }

    const below = vh - rect.bottom - VIEWPORT_MARGIN;
    const above = rect.top - VIEWPORT_MARGIN;
    const up = below < 200 && above > below;
    const maxHeight = Math.max(MIN_PANEL_HEIGHT, Math.floor(up ? above : below));

    const width = Math.min(Math.max(rect.width, 180), Math.min(320, vw - VIEWPORT_MARGIN * 2));
    const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN), vw - width - VIEWPORT_MARGIN);
    const panelH = Math.min(maxHeight, panelRef.current?.scrollHeight ?? maxHeight);
    const top = up ? Math.max(VIEWPORT_MARGIN, rect.top - PANEL_GAP - panelH) : rect.bottom + PANEL_GAP;

    setPos({ left, top, width, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      // panel อยู่นอก rootRef (portal) — ต้องเช็คแยก ไม่งั้นคลิกตัวเลือกแล้วเมนูปิดก่อน
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onReflow = () => measure();

    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    // capture: true — จับ scroll ของ container ด้านในด้วย ไม่ใช่แค่หน้าต่าง
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, measure]);

  /** ค่าที่ "ส่งออกไปล่าสุด" — กันกดรัว ๆ แล้วค่าหาย เพราะ prop values กว่าจะกลับมาต้องผ่าน URL ก่อน */
  const latestRef = useRef(values);
  useEffect(() => {
    latestRef.current = values;
  }, [values]);

  const toggle = (value: string) => {
    const base = latestRef.current;
    const next = base.includes(value) ? base.filter((v) => v !== value) : [...base, value];
    latestRef.current = next;
    onChange(next);
  };

  const clearAll = () => {
    latestRef.current = [];
    onChange([]);
    setOpen(false);
  };

  const summary =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? values[0])
        : `เลือก ${values.length} ${summaryNoun}`;

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-multiselectable
            style={{
              position: 'fixed',
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              width: pos?.width,
              maxHeight: pos?.maxHeight ?? 256,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className="z-[300] overflow-y-auto rounded-xl border border-border bg-background p-1 shadow-lg"
          >
            <button
              type="button"
              role="option"
              aria-selected={values.length === 0}
              onClick={clearAll}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-secondary"
            >
              <span className="flex h-4 w-4 items-center justify-center">
                {values.length === 0 ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
              </span>
              {allLabel}
            </button>
            {options.map((o) => {
              const checked = values.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-secondary"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {checked ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn('relative flex w-full min-w-0 flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs leading-snug text-muted-foreground">
        {label}
      </label>
      <button
        id={id}
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'jarvis-filter-select flex w-full min-w-0 items-center justify-between gap-1 text-left',
          values.length > 0 && 'font-medium text-foreground',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-60 transition-transform', open && 'rotate-180')} />
      </button>
      {panel}
    </div>
  );
}

export default FilterMultiSelect;
