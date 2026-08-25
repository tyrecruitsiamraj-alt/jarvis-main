/**
 * อ่าน `/api/auth/config` จากในแอป (ไม่ใช่หน้า Login)
 *
 * เส้นนี้ถูกเรียกจากหลายที่ในเปลือกแอป (แถบบน · ลิ้นชักเมนู) จึง **cache เป็น promise
 * ระดับโมดูล** — เปิดหน้าหนึ่งครั้งยิงจริงครั้งเดียว ที่เหลือใช้ผลเดิม
 * (คนละตัวกับหน้า Login ที่มี retry ของตัวเองอยู่แล้วโดยเจตนา)
 */
import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/apiFetch';
import type { AuthConfig } from '@/lib/authConfig';

let cached: Promise<AuthConfig | null> | null = null;

function load(): Promise<AuthConfig | null> {
  if (!cached) {
    cached = apiFetch('/api/auth/config')
      .then((r) => (r.ok ? (r.json() as Promise<AuthConfig>) : null))
      .catch(() => null);
  }
  return cached;
}

export function useAuthConfig(): AuthConfig | null {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  useEffect(() => {
    let alive = true;
    void load().then((c) => {
      if (alive) setConfig(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return config;
}
