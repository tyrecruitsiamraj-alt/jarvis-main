/**
 * สถานะ Online ของทุกบัญชี สำหรับ ตั้งค่า › ผู้ใช้งาน (ย้ายมาจากท้ายหน้าหลัก 30 ก.ย. 2569)
 *
 * ดึงใหม่ทุก 1 นาทีตอนเปิดแท็บผู้ใช้งานอยู่ — Online = ใช้งานใน 30 นาทีล่าสุด ต้องเป็นของตอนนี้เสมอ ·
 * ปิดแท็บ (`enabled` = false) = หยุดดึง · นิยามอยู่ `src/lib/homePresence.ts` · เส้น `/api/home-presence`
 */
import { useEffect, useState } from 'react';
import type { HomePresenceResponse } from '@/lib/homePresence';
import { fetchHomePresence } from '@/lib/homePresenceApi';

const REFRESH_MS = 60_000;

export function useUserPresence(enabled: boolean): { data: HomePresenceResponse | null; error: string | null } {
  const [data, setData] = useState<HomePresenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const pull = () =>
      fetchHomePresence()
        .then((d) => {
          if (!alive) return;
          setData(d);
          setError(null);
        })
        .catch((e: unknown) => {
          if (alive) setError(e instanceof Error && e.message ? e.message : 'โหลดสถานะไม่ขึ้น ลองรีเฟรชอีกครั้ง');
        });
    void pull();
    const timer = window.setInterval(() => void pull(), REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return { data, error };
}
