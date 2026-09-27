import { createContext, useContext, useEffect, useRef } from 'react';

/**
 * ═══ ช่องค้นหาบนแถบบน (ซ้ายกระดิ่ง) — ใช้ทุกหน้า ═══
 *
 * เจ้าของสั่ง 27 ก.ย. 2569: *"ทั้งระบบย้ายปุ่มค้นหาไปไว้ข้างซ้ายของกระดิ่ง"*
 * แล้วเลือกแบบ **"ช่องเปิดค้าง ค้นในหน้านั้น"** จากแบบร่าง
 *
 * 🔴 **หน้าเป็นเจ้าของคำค้นเหมือนเดิม** — แถบบนแค่วาดช่องให้ (value/onChange ของหน้าเดิม)
 * ⇒ ค้นเรื่องเดิมของหน้านั้นทุกอย่าง (กล่องงาน = หน่วยงาน/ตำแหน่ง/ที่อยู่ · ใบขอ = เลขที่ใบขอ ฯลฯ)
 * หน้าไหนไม่มีการค้นหา = ไม่มีช่อง (ไม่มีช่องหลอกที่พิมพ์แล้วไม่เกิดอะไร)
 *
 * ⚠️ ช่องค้นหาที่เป็น "ช่องกรอกของเครื่องมือ" หรืออยู่ในป๊อป (Pre-Check · ตัวเลือกคน/ช่องทาง ·
 * ช่องค้นในกล่อง Dropdown) **ไม่ย้าย** — มันเป็นส่วนหนึ่งของฟอร์มนั้น ไม่ใช่ช่องค้นของหน้า
 */
export type HeaderSearchSpec = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** กด Enter — หน้าที่เคยมีปุ่ม "ค้นหา" ใช้ต่อ (ไม่ส่ง = กรองสดขณะพิมพ์อย่างเดียว) */
  onSubmit?: () => void;
};

export type HeaderSearchRegistration = { id: number; spec: HeaderSearchSpec };
export type HeaderSearchCtxValue = {
  current: HeaderSearchRegistration | null;
  register: (r: HeaderSearchRegistration) => void;
  unregister: (id: number) => void;
};

export const HeaderSearchCtx = createContext<HeaderSearchCtxValue | null>(null);

let nextId = 0;

/**
 * หน้าฝากช่องค้นหาของตัวเองขึ้นแถบบน — ส่ง `null` = หน้านี้ (ตอนนี้) ไม่มีช่องค้นหา
 * @returns `true` = แถบบนรับไปวาดแล้ว (หน้าต้องไม่วาดช่องซ้ำ) · `false` = อยู่นอกโครงหลัก วาดเองตามเดิม
 */
export function useHeaderSearch(spec: HeaderSearchSpec | null): boolean {
  const ctx = useContext(HeaderSearchCtx);
  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = ++nextId;
  // เก็บตัวจัดการล่าสุดไว้ใน ref — ฟังก์ชันของหน้าเปลี่ยนตัวทุกครั้งที่ render ถ้าใส่ใน deps จะวนไม่จบ
  // (อัปเดตใน effect ที่ประกาศก่อน effect ลงทะเบียน ⇒ รันก่อนเสมอในรอบเดียวกัน)
  const handlers = useRef<Pick<HeaderSearchSpec, 'onChange' | 'onSubmit'> | null>(null);
  const onChangeLatest = spec?.onChange;
  const onSubmitLatest = spec?.onSubmit;
  useEffect(() => {
    handlers.current = onChangeLatest ? { onChange: onChangeLatest, onSubmit: onSubmitLatest } : null;
  });

  const register = ctx?.register;
  const unregister = ctx?.unregister;
  const active = spec !== null;
  const value = spec?.value ?? '';
  const placeholder = spec?.placeholder ?? '';
  const hasSubmit = Boolean(spec?.onSubmit);

  useEffect(() => {
    if (!register || !unregister) return;
    const id = idRef.current;
    if (!active) {
      unregister(id);
      return;
    }
    register({
      id,
      spec: {
        value,
        placeholder,
        onChange: (v) => handlers.current?.onChange(v),
        onSubmit: hasSubmit ? () => handlers.current?.onSubmit?.() : undefined,
      },
    });
  }, [register, unregister, active, value, placeholder, hasSubmit]);

  // ออกจากหน้า = เอาช่องออกจากแถบบน
  useEffect(() => {
    const id = idRef.current;
    return () => unregister?.(id);
  }, [unregister]);

  return Boolean(ctx) && active;
}

