import React, { useEffect, useMemo, useState } from 'react';

/**
 * ช่องเลือกค่าจาก **ลิสต์กลางที่แก้เองได้** บนหน้า Follow —
 * ใช้ร่วมกันสองที่: เบอร์เจ้าหน้าที่ผู้ติดตาม (099) และเรื่องที่จะให้โทรติดตาม (100)
 *
 * 🔴 **ตัวนี้เป็นแค่ช่องเลือก ไม่มีปุ่มเพิ่มค่าแล้ว** (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-5:
 * *"เพิ่มเรื่อง/เพิ่มเจ้าหน้าที่ ย้ายไปไว้ข้างๆปฏิทิน เพิ่มได้เฉพาะ supervisor"*)
 * — การเพิ่ม/ดูลิสต์ทั้งหมดอยู่ที่ dialog ซึ่งเปิดจากปุ่มข้างไอคอนปฏิทินบนแผงการโทร
 * (`FollowMasterManagerDialog`) · เพิ่มที่นั่นแล้ว dropdown นี้โหลดใหม่ผ่าน `reloadSignal`
 *
 * ทางถอยที่ต้องมีเสมอ (เจ้าหน้าที่ทำงานจริงต่อได้แม้ของกลางพัง):
 * - โหลดลิสต์ไม่ได้ / ตารางยังไม่ migrate → ถอยเป็นช่องพิมพ์เองแบบเดิม **ห้ามบล็อกงาน**
 * - ค่าเดิมของรายการเก่าที่ไม่ตรงกับใครในลิสต์ → โชว์เป็นตัวเลือก "ค่าที่กรอกไว้เดิม"
 *   (หายเงียบเมื่อไหร่ = เปิดแก้รายการเก่าแล้วค่าหลุดโดยไม่มีใครรู้)
 */
export default function FollowMasterSelect<T>({
  id,
  label,
  value,
  onChange,
  emptyOptionLabel,
  manualPlaceholder,
  hint,
  manualInputMode,
  load,
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
  /** โหมดแป้นพิมพ์ของช่องพิมพ์เอง (เช่น 'tel' สำหรับเบอร์) */
  manualInputMode?: 'tel' | 'text';
  load: () => Promise<T[]>;
  /** ค่าที่จะถูกเก็บลงฟอร์มเมื่อเลือกตัวนี้ */
  toValue: (item: T) => string;
  /** ข้อความบน dropdown */
  toLabel: (item: T) => string;
  /**
   * เลขที่เปลี่ยนเมื่อไหร่ = **โหลดลิสต์ใหม่** — ใช้ตอนมีคนเพิ่มค่าจาก dialog จัดการ
   * ขณะที่ dropdown นี้ mount อยู่แล้ว · ไม่ส่ง = โหลดครั้งเดียวตอน mount
   */
  reloadSignal?: number;
}) {
  const [items, setItems] = useState<T[]>([]);
  /** null = ยังโหลดอยู่ · false = โหลดพัง (ถอยเป็นช่องพิมพ์เอง) */
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [manualMode, setManualMode] = useState(false);

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
    // โหลดใหม่เมื่อ mount หรือเมื่อ reloadSignal เปลี่ยน (มีคนเพิ่มค่าจาก dialog จัดการ)
    // `load` เป็นฟังก์ชันคงที่จากไฟล์ api ไม่ต้องเฝ้า
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadSignal]);

  const matchedIndex = useMemo(
    () => items.findIndex((it) => toValue(it).trim() === value.trim()),
    [items, value, toValue],
  );

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
            inputMode={manualInputMode}
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
          </p>
        </>
      )}
    </div>
  );
}
