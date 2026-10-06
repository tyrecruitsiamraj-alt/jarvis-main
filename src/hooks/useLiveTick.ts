import { useEffect, useRef, useState } from 'react';

/**
 * ═══ จังหวะอัปเดตสด (หน้าหลัก · เจ้าของ 6 ต.ค. 2569 "ต้องทำเป็น Interactive" → Choice "ตัวเลขอัปเดตเองสด ๆ") ═══
 *
 * คืนเลขรอบ — เพิ่มขึ้นทุก `intervalMs` ขณะเปิดแท็บดูอยู่ · ผู้เรียกใส่เลขนี้ใน deps แล้วโหลดใหม่แบบเงียบ (ไม่ขึ้นโครงโหลด)
 * - แท็บซ่อน = หยุด (ไม่ยิงเซิร์ฟเวอร์ทิ้ง) · กลับมาดู = เพิ่มรอบทันทีถ้าเลยเวลาแล้ว
 * - `enabled` false = ไม่เดิน (เช่น ช่วงที่เลือกจบไปแล้ว ตัวเลขไม่เปลี่ยนอีก)
 * ⚠️ ใช้ตัวเดียวต่อหน้า แล้วส่งเลขรอบลงไปให้ลูก — ห้ามให้แต่ละการ์ดสร้าง timer เอง
 */
export function useLiveTick(enabled: boolean, intervalMs: number): number {
  const [tick, setTick] = useState(0);
  const lastRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;
    lastRef.current = Date.now();
    const bump = () => {
      lastRef.current = Date.now();
      setTick((n) => n + 1);
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') bump();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRef.current >= intervalMs) bump();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs]);

  return tick;
}
