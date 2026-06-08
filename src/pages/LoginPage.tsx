import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { config } = useBranding();
  const shellBg = getAppShellBackgroundStyle(config);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const todayLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const msg = await signIn(email, password);
      if (msg) setError(msg);
      else navigate('/', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const msg = await signUp({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      });
      if (msg) {
        setError(msg);
        return;
      }
      setAuthMode('login');
      setFirstName('');
      setLastName('');
      setPassword('');
      setError('สมัครสำเร็จแล้ว — กรุณาเข้าสู่ระบบ');
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
      className={cn('jarvis-warm-bg relative overflow-hidden', config.pageBackgroundMode === 'solid' && 'jarvis-warm-bg')}
      style={config.pageBackgroundMode !== 'solid' ? shellBg : undefined}
    >
      {/* ambient orbs */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 jarvis-orange-orb opacity-40 blur-sm" aria-hidden />
      <div className="pointer-events-none absolute bottom-10 -left-16 h-48 w-48 jarvis-orange-orb opacity-25 blur-md" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col items-center justify-center gap-6 p-4 sm:p-6 lg:flex-row lg:items-stretch lg:gap-8 lg:p-10">
        {/* Left — glass login */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex w-full max-w-lg flex-col justify-center lg:max-w-md lg:flex-1"
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

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-muted-foreground ml-1">
                    Email
                  </Label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="jarvis-soft-field min-h-[48px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 ml-1">
                    <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                      Password
                    </Label>
                    <button
                      type="button"
                      className="text-xs font-medium text-orange-600 hover:underline underline-offset-4 touch-manipulation"
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
                      ชื่อ
                    </Label>
                    <input
                      id="firstName"
                      name="givenName"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="jarvis-soft-field min-h-[48px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs font-medium text-muted-foreground ml-1">
                      นามสกุล
                    </Label>
                    <input
                      id="lastName"
                      name="familyName"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
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
                  สมัครใหม่ได้รับสิทธิ์ Staff อัตโนมัติ — ไม่มีตัวเลือกบทบาท
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

            <button
              type="button"
              disabled
              className="w-full rounded-full border border-white/40 bg-white/40 px-4 py-3 text-sm text-muted-foreground opacity-60 cursor-not-allowed"
            >
              Sign in with Microsoft (Coming Soon)
            </button>
          </div>

          {/* Dark promo card */}
          <div className="jarvis-dark-card mt-4 p-5 sm:p-6 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-1">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                New in
              </div>
              <p className="text-sm font-medium text-white/90 leading-snug">
                Discover open roles &amp; apply without signing in
              </p>
            </div>
            <Link
              to="/apply"
              className="jarvis-pill-btn shrink-0 px-5 py-2.5 text-xs bg-white text-[#141210] hover:bg-white/90 hover:text-[#141210] shadow-none"
            >
              Discover
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground px-1 lg:hidden">
            ต้องการสมัครงานภายนอก?{' '}
            <Link to="/apply" className="font-medium text-orange-600 hover:underline underline-offset-4 touch-manipulation">
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
              <div className="jarvis-orange-orb h-44 w-44 animate-pulse" style={{ animationDuration: '4s' }} aria-hidden />
            </div>

            <div className="relative z-10 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">ดูประกาศรับสมัครพนักงาน</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Browse public job openings, explore opportunities, and connect with teams across units.
                </p>
              </div>
              <Link
                to="/apply"
                className="jarvis-pill-btn w-full min-h-[48px] px-6 py-3 text-sm touch-manipulation"
              >
                Join now
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-orange-100/20" aria-hidden />
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            ต้องการสมัครงานภายนอก?{' '}
            <Link to="/apply" className="font-medium text-orange-600 hover:underline underline-offset-4 touch-manipulation">
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
              กรอกอีเมลที่ใช้ลงทะเบียน แล้วระบบจะสร้างรหัสชั่วคราวใหม่ให้ทันที
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
