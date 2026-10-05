import { useEffect } from 'react';
import { setPageTitle } from '@/lib/brandingStorage';

/**
 * ชื่อแท็บเบราว์เซอร์ของหน้านี้ = "label · ชื่อระบบ" · ออกจากหน้า = กลับเป็นชื่อระบบ
 * (QA 5 ต.ค. 2569 — ดู `setPageTitle`)
 */
export function usePageTitle(label: string | null): void {
  useEffect(() => {
    setPageTitle(label);
    return () => setPageTitle(null);
  }, [label]);
}
