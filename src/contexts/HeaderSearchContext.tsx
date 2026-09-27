import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import SearchField from '@/components/shared/SearchField';
import { cn } from '@/lib/utils';
import {
  HeaderSearchCtx,
  type HeaderSearchRegistration,
  type HeaderSearchSpec,
} from '@/hooks/useHeaderSearch';

/**
 * ตัวรับช่องค้นหาของแต่ละหน้าขึ้นแถบบน (ซ้ายกระดิ่ง) — ดูหลักการที่ `src/hooks/useHeaderSearch.ts`
 * (เจ้าของสั่ง 27 ก.ย. 2569: "ทั้งระบบย้ายปุ่มค้นหาไปไว้ข้างซ้ายของกระดิ่ง")
 */
export function HeaderSearchProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<HeaderSearchRegistration | null>(null);
  const register = useCallback((r: HeaderSearchRegistration) => setCurrent(r), []);
  /** ถอดเฉพาะของตัวเอง — หน้าใหม่ลงทะเบียนก่อนหน้าเก่าถอด (เปลี่ยนแท็บ) ต้องไม่ลบของหน้าใหม่ */
  const unregister = useCallback(
    (id: number) => setCurrent((cur) => (cur && cur.id === id ? null : cur)),
    [],
  );
  const value = useMemo(() => ({ current, register, unregister }), [current, register, unregister]);
  return <HeaderSearchCtx.Provider value={value}>{children}</HeaderSearchCtx.Provider>;
}

/**
 * ช่องบนแถบบน — วางซ้ายกระดิ่ง · ไม่มีหน้าไหนฝากไว้ = ไม่วาดอะไร
 * 🔴 ถือคำที่พิมพ์ไว้เอง (draft) — ค่าของหน้าไหลกลับมาทาง effect ช้ากว่าหนึ่งจังหวะ
 * ถ้าผูก `value` ตรง ๆ กับค่าที่ไหลกลับ ช่องจะเด้งเคอร์เซอร์/กลืนตัวอักษรตอนพิมพ์เร็ว
 */
export function HeaderSearchSlot({
  className,
  containerClassName,
}: {
  /** กว้าง/ระยะของช่องเอง */
  className?: string;
  /** กล่องครอบ (เช่นระยะขอบแถวที่สองบนมือถือ) — วาดเฉพาะตอนมีช่อง ไม่ทิ้งช่องว่างเปล่า */
  containerClassName?: string;
}) {
  const ctx = useContext(HeaderSearchCtx);
  const current = ctx?.current ?? null;
  if (!current) return null;
  const input = <HeaderSearchInput key={current.id} spec={current.spec} className={className} />;
  return containerClassName ? <div className={containerClassName}>{input}</div> : input;
}

function HeaderSearchInput({ spec, className }: { spec: HeaderSearchSpec; className?: string }) {
  const [draft, setDraft] = useState(spec.value);
  // หน้าเปลี่ยนคำค้นเอง (ล้าง · เปิดลิงก์ · ย้อนกลับ) ⇒ ช่องตามค่าของหน้า
  useEffect(() => setDraft(spec.value), [spec.value]);
  return (
    <SearchField
      compact
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        spec.onChange(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') spec.onSubmit?.();
      }}
      placeholder={spec.placeholder}
      aria-label={spec.placeholder}
      wrapperClassName={cn('min-w-0', className)}
    />
  );
}
