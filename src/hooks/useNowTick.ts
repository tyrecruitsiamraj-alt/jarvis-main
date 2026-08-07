import { useEffect, useState } from 'react';

/**
 * นาฬิกาเดินวินาที — เดินเฉพาะเมื่อ `enabled` เป็น true
 *
 * ⚠️ ตั้งใจให้มี **ตัวเดียวต่อหน้า** ห้ามเรียกในแต่ละการ์ด
 * ลิสต์หน้า Matching มีได้ 100 การ์ด ถ้าแต่ละใบสร้าง interval เองจะได้ 100 timer
 * (แยกออกจาก MatchingPage.tsx ตอนแตกไฟล์ — ใช้ร่วมกับ CallHoldPanel)
 */
export function useNowTick(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return now;
}
