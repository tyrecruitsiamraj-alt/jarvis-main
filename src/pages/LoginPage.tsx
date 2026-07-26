import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/apiFetch';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import type { UserRole } from '@/types';
import { isValidEnglishName, sanitizeEnglishName } from '@/lib/englishName';
import { APP_DEPARTMENT_CODES, APP_DEPARTMENT_LABELS } from '@/lib/departmentCodes';

type AuthConfig = {
  companyEmailLogin: boolean;
  microsoftLogin: boolean;
  devRoleLogin: boolean;
  emailLoginGate: boolean;
  companyEmailRequired: boolean;
  allowedDomains: string[];
  companyEmailHint: string | null;
};

// ลิงก์เพิ่มเพื่อน LINE (Official Account) — กดปุ่มโลโก้แล้วเปิด LINE ให้เลย
// TODO(login): แทนที่ด้วยลิงก์ LINE จริงจาก QR (เช่น https://lin.ee/xxxxxxx)
const LINE_ADD_URL = '__REPLACE_WITH_LINE_LINK__';
const LINE_ADD_ENABLED = LINE_ADD_URL.startsWith('http');

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  no_account: 'บัญชี Microsoft นี้ยังไม่ได้ลงทะเบียนในระบบ — ติดต่อผู้ดูแล',
  disabled: 'บัญชีนี้ถูกปิดใช้งาน',
  domain: 'กรุณาใช้อีเมลบริษัทที่อนุญาตเท่านั้น',
  state: 'เซสชันหมดอายุ — กรุณาลองเข้าสู่ระบบอีกครั้ง',
  oauth: 'เข้าสู่ระบบ Microsoft ไม่สำเร็จ — ลองใหม่อีกครั้ง',
  azure_not_configured: 'การเข้าสู่ระบบด้วย Microsoft ยังไม่พร้อม — ติดต่อผู้ดูแลระบบให้ตั้งค่า Azure AD',
};

/** โลโก้ LINE (speech bubble) — ฝังเป็น SVG ในแอป ไม่ดึงจากเน็ต */
function LineGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 3C6.2 3 1.5 6.86 1.5 11.6c0 4.25 3.74 7.81 8.79 8.48.34.07.81.22.93.51.1.26.07.67.03.94l-.15.9c-.04.27-.21 1.04.92.57 1.13-.48 6.08-3.58 8.29-6.13C21.98 15.2 22.5 13.47 22.5 11.6 22.5 6.86 17.8 3 12 3zM7.6 14.02H5.52a.55.55 0 0 1-.55-.55V9.32a.55.55 0 0 1 1.1 0v3.6H7.6a.55.55 0 0 1 0 1.1zm2.16-.55a.55.55 0 0 1-1.1 0V9.32a.55.55 0 0 1 1.1 0v4.15zm4.9 0a.55.55 0 0 1-.38.52.56.56 0 0 1-.62-.19l-2.13-2.9v2.57a.55.55 0 0 1-1.1 0V9.32a.55.55 0 0 1 .99-.33l2.14 2.9V9.32a.55.55 0 0 1 1.1 0v4.15zm3.3-2.62a.55.55 0 0 1 0 1.1h-1.53v.97h1.53a.55.55 0 0 1 0 1.1H15.4a.55.55 0 0 1-.55-.55V9.32a.55.55 0 0 1 .55-.55h2.08a.55.55 0 0 1 0 1.1h-1.53v.98h1.53z" />
    </svg>
  );
}

/** ปุ่มแอดไลน์บนหน้า Login — กดแล้วเปิด LINE (แอด Official Account) ในแท็บใหม่ */
function LineContactButton() {
  if (!LINE_ADD_ENABLED) return null;
  return (
    <a
      href={LINE_ADD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#06C755] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#05b34c] active:bg-[#04a144] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06C755] focus-visible:ring-offset-2"
      aria-label="แอดไลน์สอบถาม/แจ้งปัญหา (เปิด LINE)"
    >
      <LineGlyph className="h-5 w-5 shrink-0" />
      แอดไลน์สอบถาม/แจ้งปัญหา
    </a>
  );
}

/** ปุ่มเข้าสู่ระบบด้วย Microsoft (Azure AD) — พา browser ไป /api/auth/azure-ad/start
 *  (redirect เต็มหน้าไป Microsoft แล้วเด้งกลับ) ไม่ต้องกรอก username/password */
function MicrosoftLoginButton({ returnTo = '/' }: { returnTo?: string }) {
  const start = () => {
    window.location.href = `/api/auth/azure-ad/start?returnTo=${encodeURIComponent(returnTo)}`;
  };
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={start}
        className="inline-flex w-full min-h-[52px] items-center justify-center gap-2.5 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        <svg viewBox="0 0 21 21" className="h-4 w-4 shrink-0" aria-hidden>
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
        เข้าสู่ระบบด้วย Microsoft
      </button>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] text-muted-foreground">หรือเข้าด้วยอีเมล</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signIn, signUp, signInWithDevRole } = useAuth();
  const { config } = useBranding();
  const shellBg = getAppShellBackgroundStyle(config);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [departmentCode, setDepartmentCode] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const todayLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, []);

  useEffect(() => {
    const code = searchParams.get('auth_error');
    if (!code) return;
    setError(AUTH_ERROR_MESSAGES[code] || 'เข้าสู่ระบบไม่สำเร็จ');
    const next = new URLSearchParams(searchParams);
    next.delete('auth_error');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // โหลด config พร้อม retry — เดิม fetch ครั้งเดียวแล้วเงียบ ทำให้หน้า Login
  // ค้าง "กำลังโหลด" ตลอดถ้าจังหวะนั้น API ยังไม่พร้อม (เช่น server เพิ่ง restart)
  const [configError, setConfigError] = useState(false);
  const [configAttempt, setConfigAttempt] = useState(0);

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

  const emailPlaceholder = useMemo(() => {
    const domain = authConfig?.allowedDomains?.[0];
    return domain ? `name@${domain}` : 'your@email.com';
  }, [authConfig]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const msg = await signIn(email, password);
      if (msg) setError(msg);
      else navigate('/', { replace: true });
    } catch {
      setError('เข้าสู่ระบบไม่สำเร็จ — ลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDevRole = async (role: UserRole) => {
    setError(null);
    setSubmitting(true);
    try {
      const msg = await signInWithDevRole(role);
      if (msg) setError(msg);
      else navigate('/', { replace: true });
    } catch {
      setError('เข้าสู่ระบบด้วยสิทธิ์ไม่สำเร็จ — ตรวจสอบว่า API ทำงานและ JARVIS_DEV_ROLE_LOGIN=true');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidEnglishName(firstName)) {
      setError('ชื่อต้องกรอกเป็นภาษาอังกฤษเท่านั้น (A–Z)');
      return;
    }
    if (!isValidEnglishName(lastName)) {
      setError('นามสกุลต้องกรอกเป็นภาษาอังกฤษเท่านั้น (A–Z)');
      return;
    }
    if (!departmentCode) {
      setError('กรุณาเลือกแผนก');
      return;
    }
    setSubmitting(true);
    try {
      const msg = await signUp({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        department_code: departmentCode,
      });
      if (msg) {
        setError(msg);
        return;
      }
      navigate('/', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    const em = forgotEmail.trim() || email.trim();
    if (!em) {
      setForgotMsg('กรุณากรอกอีเมล');
      return;
    }
    setForgotBusy(true);
    try {
      const r = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: em }),
      });
      const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
      setForgotMsg(
        typeof data.message === 'string'
          ? data.message
          : typeof data.error === 'string'
            ? data.error
            : r.ok
              ? 'ส่งคำขอแล้ว'
              : 'ไม่สามารถดำเนินการได้',
      );
    } catch {
      setForgotMsg('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setForgotBusy(false);
    }
  };

  const submitLabel = authMode === 'login'
    ? submitting ? 'Signing in…' : 'Sign in'
    : submitting ? 'Creating account…' : 'Create account';

  return (
    <div
      className={cn('jarvis-warm-bg relative overflow-x-hidden', config.pageBackgroundMode === 'solid' && 'jarvis-warm-bg')}
      style={config.pageBackgroundMode !== 'solid' ? shellBg : undefined}
    >
      {/* ambient orbs */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 jarvis-blue-orb opacity-40 blur-sm" aria-hidden />
      <div className="pointer-events-none absolute bottom-10 -left-16 h-48 w-48 jarvis-blue-orb opacity-25 blur-md" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col items-center gap-6 overflow-y-auto p-4 py-8 sm:p-6 sm:py-10 lg:flex-row lg:items-stretch lg:gap-8 lg:p-10">
        {/* Left — glass login */}
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
            <div className="flex rounded-full bg-white/50 p-1 border border-white/70">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setShowPassword(false);
                }}
                className={cn(
                  'flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all',
                  authMode === 'login'
                    ? 'bg-[#141210] text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setShowPassword(false);
                }}
                className={cn(
                  'flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all',
                  authMode === 'register'
                    ? 'bg-[#141210] text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Register
              </button>
            </div>

            {authMode === 'login' && authConfig?.microsoftLogin ? <MicrosoftLoginButton /> : null}

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-muted-foreground ml-1">
                    Username
                  </Label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={emailPlaceholder}
                    required
                    className="jarvis-soft-field min-h-[48px]"
                  />
                  {authConfig?.companyEmailHint ? (
                    <p className="text-[11px] text-muted-foreground ml-1">{authConfig.companyEmailHint}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 ml-1">
                    <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                      Password
                    </Label>
                    <button
                      type="button"
                      className="text-xs font-medium text-blue-600 hover:underline underline-offset-4 touch-manipulation"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotMsg(null);
                        setForgotOpen(true);
                      }}
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="jarvis-soft-field min-h-[48px] pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      aria-pressed={showPassword}
                      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-muted-foreground hover:bg-white/80 hover:text-foreground touch-manipulation"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline touch-manipulation py-0.5 ml-1"
                  >
                    {showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="jarvis-pill-btn w-full min-h-[52px] px-6 py-3 text-sm touch-manipulation"
                >
                  {submitLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs font-medium text-muted-foreground ml-1">
                      ชื่อ (ภาษาอังกฤษ)
                    </Label>
                    <input
                      id="firstName"
                      name="givenName"
                      autoComplete="given-name"
                      lang="en"
                      inputMode="text"
                      autoCapitalize="words"
                      spellCheck={false}
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(sanitizeEnglishName(e.target.value))}
                      required
                      pattern="[A-Za-z]+([ '-][A-Za-z]+)*"
                      title="กรอกเป็นภาษาอังกฤษเท่านั้น"
                      className="jarvis-soft-field min-h-[48px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs font-medium text-muted-foreground ml-1">
                      นามสกุล (ภาษาอังกฤษ)
                    </Label>
                    <input
                      id="lastName"
                      name="familyName"
                      autoComplete="family-name"
                      lang="en"
                      inputMode="text"
                      autoCapitalize="words"
                      spellCheck={false}
                      placeholder="Smith"
                      value={lastName}
                      onChange={(e) => setLastName(sanitizeEnglishName(e.target.value))}
                      required
                      pattern="[A-Za-z]+([ '-][A-Za-z]+)*"
                      title="กรอกเป็นภาษาอังกฤษเท่านั้น"
                      className="jarvis-soft-field min-h-[48px]"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emailRegister" className="text-xs font-medium text-muted-foreground ml-1">
                    Email
                  </Label>
                  <input
                    id="emailRegister"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="jarvis-soft-field min-h-[48px]"
                  />
                  {authConfig?.companyEmailHint ? (
                    <p className="text-[11px] text-muted-foreground ml-1">{authConfig.companyEmailHint}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="departmentRegister" className="text-xs font-medium text-muted-foreground ml-1">
                    แผนก <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="departmentRegister"
                    value={departmentCode}
                    onChange={(e) => setDepartmentCode(e.target.value)}
                    required
                    className="jarvis-soft-field min-h-[48px] w-full"
                  >
                    <option value="">— เลือกแผนก —</option>
                    {APP_DEPARTMENT_CODES.map((code) => (
                      <option key={code} value={code}>
                        {APP_DEPARTMENT_LABELS[code]}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground ml-1">
                    จะเห็นใบขอเฉพาะแผนกนี้ — Admin แก้ไขให้ได้ภายหลัง
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="passwordRegister" className="text-xs font-medium text-muted-foreground ml-1">
                    Password (ขั้นต่ำ 8 ตัวอักษร)
                  </Label>
                  <div className="relative">
                    <input
                      id="passwordRegister"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="jarvis-soft-field min-h-[48px] pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      aria-pressed={showPassword}
                      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-muted-foreground hover:bg-white/80 hover:text-foreground touch-manipulation"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline touch-manipulation py-0.5 ml-1"
                  >
                    {showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground ml-1">
                  สมัครใหม่ได้รับสิทธิ์ Staff — ต้องเลือกแผนกก่อนใช้งาน
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="jarvis-pill-btn w-full min-h-[52px] px-6 py-3 text-sm touch-manipulation"
                >
                  {submitLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </form>
            )}

            {error ? (
              <p className="text-xs text-destructive text-center" role="alert">
                {error}
              </p>
            ) : null}

            {authConfig?.devRoleLogin ? (
              <div className="space-y-2 rounded-2xl border border-dashed border-orange-300/60 bg-orange-50/40 p-3">
                <p className="text-xs font-medium text-orange-900 text-center">
                  Dev — เข้าเร็วตามสิทธิ์ (ไม่ต้องกรอกรหัส)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['opl', 'staff', 'supervisor', 'admin'] as UserRole[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleDevRole(role)}
                      className="rounded-full border border-orange-200 bg-white/80 px-2 py-2 text-[11px] font-semibold capitalize text-orange-900 hover:bg-white disabled:opacity-50"
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
              </>
            )}
          </div>

          <LineContactButton />

          <p className="mt-4 text-center text-xs text-muted-foreground px-1 lg:hidden">
            ต้องการสมัครงานภายนอก?{' '}
            <Link to="/apply" className="font-medium text-blue-600 hover:underline underline-offset-4 touch-manipulation">
              ดูบอร์ดประกาศรับสมัคร
            </Link>
          </p>
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

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto jarvis-frost rounded-[1.5rem] border-white/70">
          <DialogHeader>
            <DialogTitle>ลืมรหัสผ่าน</DialogTitle>
            <DialogDescription>
              กรอกอีเมลที่ใช้ลงทะเบียน ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปทางอีเมล
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForgot} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder={email || 'your@email.com'}
                className="jarvis-soft-field min-h-[48px]"
              />
            </div>
            {forgotMsg ? (
              <p className="text-sm text-muted-foreground" role="status">
                {forgotMsg}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
              <button
                type="button"
                className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-border text-sm touch-manipulation min-h-[44px]"
                onClick={() => setForgotOpen(false)}
              >
                ปิด
              </button>
              <button
                type="submit"
                disabled={forgotBusy}
                className="jarvis-pill-btn w-full sm:w-auto px-5 py-2.5 text-sm disabled:opacity-60 touch-manipulation min-h-[44px]"
              >
                {forgotBusy ? 'กำลังส่ง…' : 'ส่งคำขอ'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
