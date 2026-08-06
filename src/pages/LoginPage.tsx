import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';

type AuthConfig = {
  companyEmailLogin: boolean;
  passwordLogin: boolean;
  microsoftLogin: boolean;
  devRoleLogin: boolean;
  publicRegister?: boolean;
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

// ─── Email / Password form ────────────────────────────────────────────────────
function EmailPasswordForm({
  hint,
  onError,
}: {
  hint: string | null;
  onError: (msg: string) => void;
}) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    onError('');
    if (!email.trim() || !password) {
      setFormError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setSubmitting(true);
    const err = await signIn(email.trim(), password);
    setSubmitting(false);
    if (err) {
      setFormError(err);
      return;
    }
    const returnTo = searchParams.get('returnTo');
    const safe =
      returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : '/';
    navigate(safe, { replace: true });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div className="space-y-2">
        <div>
          <label htmlFor="login-email" className="block text-xs font-medium text-foreground mb-1">
            อีเมล
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={hint ?? 'you@company.com'}
            disabled={submitting}
            className="w-full rounded-xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/70 dark:focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="block text-xs font-medium text-foreground mb-1">
            รหัสผ่าน
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={submitting}
              className="w-full rounded-xl border border-white/70 bg-white/60 px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/70 dark:focus:border-blue-500"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {formError ? (
        <p className="text-xs text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {submitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            กำลังเข้าสู่ระบบ…
          </>
        ) : (
          'เข้าสู่ระบบ'
        )}
      </button>
    </form>
  );
}

// ─── Microsoft button ─────────────────────────────────────────────────────────
function MicrosoftLoginButton() {
  const { signInWithMicrosoft } = useAuth();
  return (
    <button
      type="button"
      onClick={() => signInWithMicrosoft('/')}
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

// ─── Divider ──────────────────────────────────────────────────────────────────
function OrDivider() {
  return (
    <div className="flex items-center gap-3" role="separator">
      <div className="h-px flex-1 bg-white/50" />
      <span className="text-xs text-muted-foreground">หรือ</span>
      <div className="h-px flex-1 bg-white/50" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
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

  // แสดง form email+password ถ้า JWT ถูกตั้งค่า (passwordLogin) ไม่ต้องรอ Postmark
  const showEmail = authConfig?.passwordLogin ?? authConfig?.companyEmailLogin ?? false;
  const showMicrosoft = authConfig?.microsoftLogin ?? false;

  return (
    <div
      className={cn('jarvis-warm-bg relative overflow-x-hidden', config.pageBackgroundMode === 'solid' && 'jarvis-warm-bg')}
      style={config.pageBackgroundMode !== 'solid' ? shellBg : undefined}
    >

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col items-center gap-6 overflow-y-auto p-4 py-8 sm:p-6 sm:py-10 lg:flex-row lg:items-stretch lg:gap-8 lg:p-10">
        {/* Left — sign in card */}
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

                <div className="space-y-4">
                  {showEmail && (
                    <EmailPasswordForm
                      hint={authConfig.companyEmailHint}
                      onError={(msg) => setError(msg || null)}
                    />
                  )}

                  {showEmail && showMicrosoft && <OrDivider />}

                  {showMicrosoft && <MicrosoftLoginButton />}

                  {!showEmail && !showMicrosoft && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      ยังไม่มีวิธีเข้าสู่ระบบที่เปิดใช้งาน — ติดต่อผู้ดูแลระบบ
                    </p>
                  )}
                </div>

                {error ? (
                  <p className="text-xs text-destructive text-center" role="alert">
                    {error}
                  </p>
                ) : null}

                {!showEmail && !showMicrosoft ? null : (
                  <p className="text-center text-[11px] text-muted-foreground">
                    เฉพาะผู้ใช้ที่ได้รับสิทธิ์ในองค์กรเท่านั้น
                  </p>
                )}
              </>
            )}

            {/* ทางเข้าบอร์ดรับสมัครงาน — โชว์เฉพาะจอไม่ใหญ่ (มือถือ/แท็บเล็ต) */}
            <div className="border-t border-white/60 pt-4 lg:hidden">
              <Link
                to="/apply"
                className="flex w-full min-h-[46px] touch-manipulation items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white/70 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                ดูประกาศรับสมัครพนักงาน
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Right — visual card */}
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
