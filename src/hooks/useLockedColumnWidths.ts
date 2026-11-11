import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * ล็อกความกว้างคอลัมน์ตารางตามที่วัดได้ตอนขึ้นข้อมูลครั้งแรก (เจ้าของ 11 พ.ย. 2569 "กดแล้วเลื่อน เม้าต้องขยับตาม")
 * ตารางกว้างตามเนื้อหา ⇒ กดเรียง/เปลี่ยนหน้าแล้วคอลัมน์ขยับ หัวคอลัมน์ที่เพิ่งกดเลื่อนหนีเมาส์ ·
 * วัดครั้งเดียวแล้วใช้ `table-fixed` + `<col>` · ย่อ/ขยายหน้าต่าง = วัดใหม่
 */
export function useLockedColumnWidths(ready: boolean) {
  const ref = useRef<HTMLTableElement>(null);
  const [widths, setWidths] = useState<number[] | null>(null);

  useLayoutEffect(() => {
    if (!ready || widths || !ref.current) return;
    const ths = ref.current.querySelectorAll(':scope > thead > tr:first-child > th');
    const next = [...ths].map((th) => th.getBoundingClientRect().width);
    // ตารางซ่อนอยู่ (จอเล็ก) วัดได้ 0 — ไม่ล็อก
    if (next.length === 0 || next.some((w) => w === 0)) return;
    setWidths(next);
  }, [ready, widths]);

  useEffect(() => {
    const reset = () => setWidths(null);
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, []);

  return { ref, widths };
}
