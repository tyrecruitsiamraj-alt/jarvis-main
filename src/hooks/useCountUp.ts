import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * ตัวเลขวิ่งจากค่าเดิมไปค่าใหม่ (หน้าหลักอัปเดตสด · 6 ต.ค. 2569) — เห็นว่าเลขขยับ ไม่ใช่กระโดดเงียบ ๆ
 * - ครั้งแรก = ค่าจริงทันที (ไม่วิ่งจาก 0 ทุกครั้งที่เปิดหน้า)
 * - ผู้ใช้ตั้งลดการเคลื่อนไหว = เปลี่ยนทันที
 * - `resetKey` เปลี่ยน (สลับหัวข้อ/ช่วงวัน) = เปลี่ยนทันที — วิ่งเฉพาะตอนเลขชุดเดิมอัปเดต ไม่วิ่งจากเลขของหัวข้ออื่น
 * คืนจำนวนเต็มเสมอ
 */
export function useCountUp(target: number, resetKey: string = '', durationMs = 700): number {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  const shownRef = useRef(target);
  const keyRef = useRef(resetKey);
  shownRef.current = shown;
  // สลับหัวข้อ/ช่วง = ค่าใหม่ทันทีตั้งแต่ render นี้ (ไม่มีเฟรมที่โชว์เลขของหัวข้อเดิม)
  const keyChanged = keyRef.current !== resetKey;

  useEffect(() => {
    if (keyRef.current !== resetKey || reduce || !Number.isFinite(target)) {
      keyRef.current = resetKey;
      setShown(target);
      return;
    }
    const from = shownRef.current;
    if (from === target) return;
    fromRef.current = from;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, resetKey, durationMs, reduce]);

  return keyChanged ? target : shown;
}
