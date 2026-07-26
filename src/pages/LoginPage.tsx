import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { ArrowRight } from 'lucide-react';

type AuthConfig = {
  companyEmailLogin: boolean;
  microsoftLogin: boolean;
  devRoleLogin: boolean;
  emailLoginGate: boolean;
  companyEmailRequired: boolean;
  allowedDomains: string[];
  companyEmailHint: string | null;
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  no_account: 'บัญชี Microsoft นี้ยังไม่ได้ลงทะเบียนในระบบ — ติดต่อผู้ดูแล',
  disabled: 'บัญชีนี้ถูกปิดใช้งาน',
  domain: 'กรุณาใช้อีเมลบริษัทที่อนุญาตเท่านั้น',
  state: 'เซสชันหมดอายุ — กรุณาลองเข้าสู่ระบบอีกครั้ง',
  oauth: 'เข้าสู่ระบบ Microsoft ไม่สำเร็จ — ลองใหม่อีกครั้ง',
  azure_not_configured: 'การเข้าสู่ระบบด้วย Microsoft ยังไม่พร้อม — ติดต่อผู้ดูแลระบบให้ตั้งค่า Azure AD',
};

/** ปุ่มเข้าสู่ระบบด้วย Microsoft (Azure AD) — พา browser ไป /api/auth/azure-ad/start
 *  (redirect เต็มหน้าไป Microsoft แล้วเด้งกลับ) ไม่ต้องกรอก username/password */
function MicrosoftLoginButton() {
  const start = () => {
    window.location.href = `/api/auth/azure-ad/start?returnTo=${encodeURIComponent('/')}`;
  };
  return (
    <button
      type="button"
      onClick={start}
      className="inline-flex w-full min-h-[52px] items-center justify-center gap-2.5 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 active:bg-red-800 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
    >
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-white">
        <svg viewBox="0 0 21 21" className="h-3.5 w-3.5" aria-hidden>
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
      </span>
      เข้าสู่ระบบด้วย Microsoft
    </button>
  );
}

const LoginPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { config } = useBranding();
  const shellBg = getAppShellBackgroundStyle(config);

  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState(false);
  const [configAttempt, setConfigAttempt] = useState(0);

  const todayLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, []);

  // แสดง error จาก OAuth (Microsoft) ที่เด้งกลับมาทาง ?auth_error=
  useEffect(() => {
    const code = searchParams.get('auth_error');
    if (!code) return;
    setError(AUTH_ERROR_MESSAGES[code] || 'เข้าสู่ระบบไม่สำเร็จ');
    const next = new URLSearchParams(searchParams);
    next.delete('auth_error');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // โหลด config พร้อม retry — กันหน้า Login ค้าง "กำลังโหลด" ถ้า API ยังไม่พร้อม
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    (async () => {
      for (let attempt = 1; attempt <= 3 && !cancelled; attempt++) {
        try {
          const r = await apiFetch('/api/auth/config');
          if (cancelled) return;
          if (r.ok) {
            const data = (await r.json()) as AuthConfig;
            if (!cancelled) {
              setAuthConfig(data);
              setConfigError(false);
            }
            return;
          }
        } catch {
          /* ลองใหม่ */
        }
        if (attempt < 3) {
          await new Promise((resolve) => {
            timer = window.setTimeout(resolve, 1500 * attempt);
          });
        }
      }
      if (!cancelled) setConfigError(true);
    })();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [configAttempt]);

  return (
    <div
      className={cn('jarvis-warm-bg relative overflow-x-hidden', config.pageBackgroundMode === 'solid' && 'jarvis-warm-bg')}
      style={config.pageBackgroundMode !== 'solid' ? shellBg : undefined}
    >
      {/* ambient orbs */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 jarvis-blue-orb opacity-40 blur-sm" aria-hidden />
      <div className="pointer-events-none absolute bottom-10 -left-16 h-48 w-48 jarvis-blue-orb opacity-25 blur-md" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col items-center gap-6 overflow-y-auto p-4 py-8 sm:p-6 sm:py-10 lg:flex-row lg:items-stretch lg:gap-8 lg:p-10">
        {/* Left — sign in with Microsoft */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex w-full max-w-lg flex-col justify-center lg:max-w-md lg:flex-1 lg:my-auto"
        >
          <div className="jarvis-frost p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <BrandMark size="lg" />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  <BrandTitle />
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">Workforce Management System</p>
              </div>
            </div>

            {authConfig === null && configError ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบว่า API ทำงานอยู่แล้วลองใหม่
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setConfigError(false);
                    setConfigAttempt((n) => n + 1);
                  }}
                  className="jarvis-pill-btn mx-auto px-6 py-2.5 text-sm font-semibold"
                >
                  ลองอีกครั้ง
                </button>
              </div>
            ) : authConfig === null ? (
              <p className="text-sm text-muted-foreground text-center py-6 animate-pulse">กำลังโหลด…</p>
            ) : (
              <>
                <div className="space-y-1.5 pt-1 text-center">
                  <h2 className="text-lg font-bold text-foreground">ยินดีต้อนรับ</h2>
                  <p className="text-sm text-muted-foreground">เข้าสู่ระบบด้วยบัญชีองค์กรของคุณ</p>
                </div>

                <MicrosoftLoginButton />

                <p className="text-center text-[11px] text-muted-foreground">
                  เฉพาะผู้ใช้ที่ได้รับสิทธิ์ในองค์กรเท่านั้น
                </p>

                {error ? (
                  <p className="text-xs text-destructive text-center" role="alert">
                    {error}
                  </p>
                ) : null}
              </>
            )}

            {/* ทางเข้าบอร์ดรับสมัครงาน — เห็นได้ทุกขนาดจอ (ไม่ใช่แค่การ์ดขวา desktop) */}
            <div className="border-t border-white/60 pt-4">
              <p className="mb-2 text-center text-[11px] text-muted-foreground">ต้องการสมัครงานภายนอก?</p>
              <Link
                to="/apply"
                className="flex w-full min-h-[46px] items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white/70 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white touch-manipulation"
              >
                ดูประกาศรับสมัครพนักงาน
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Right — visual card (คง "ดูประกาศรับสมัครพนักงาน" ไว้เหมือนเดิม) */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="hidden lg:flex w-full max-w-md flex-1 flex-col justify-center"
        >
          <div className="jarvis-frost relative min-h-[480px] overflow-hidden p-8 flex flex-col justify-between">
            <div className="relative z-10">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Today</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground leading-tight">{todayLabel}</p>
            </div>

            <div className="relative z-10 flex flex-1 items-center justify-center py-8">
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute h-40 w-40 rounded-full opacity-25 blur-2xl"
                  style={{ background: `hsl(${config.primaryHsl})` }}
                  aria-hidden
                />
                <BrandMark size="hero" className="relative z-10" />
              </div>
            </div>

            <div className="relative z-10 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">ดูประกาศรับสมัครพนักงาน</p>
              </div>
              <Link
                to="/apply"
                className="jarvis-pill-btn w-full min-h-[48px] px-6 py-3 text-sm touch-manipulation"
              >
                Join now
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-blue-100/20" aria-hidden />
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            ต้องการสมัครงานภายนอก?{' '}
            <Link to="/apply" className="font-medium text-blue-600 hover:underline underline-offset-4 touch-manipulation">
              ดูบอร์ดประกาศรับสมัคร
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
