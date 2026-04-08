import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  return (
    <div
      className={cn(
        'min-h-screen flex items-center justify-center p-4',
        config.pageBackgroundMode === 'solid' && 'bg-background',
      )}
      style={shellBg}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandMark size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            <BrandTitle />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Workforce Management System</p>
        </div>

        <div className="glass-card rounded-2xl border border-border/80 p-6 shadow-lg shadow-black/[0.04] space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium',
                authMode === 'login' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
              )}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium',
                authMode === 'register' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
              )}
            >
              Register
            </button>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full p-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">ชื่อ</Label>
                  <Input
                    id="firstName"
                    name="givenName"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">นามสกุล</Label>
                  <Input
                    id="lastName"
                    name="familyName"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emailRegister">Email</Label>
                <Input
                  id="emailRegister"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="passwordRegister">Password (ขั้นต่ำ 8 ตัวอักษร)</Label>
                <Input
                  id="passwordRegister"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                สมัครใหม่ได้รับสิทธิ์ Staff อัตโนมัติ — ไม่มีตัวเลือกบทบาท
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="w-full p-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}

          {error ? (
            <p className="text-xs text-destructive text-center" role="alert">
              {error}
            </p>
          ) : null}

          <div className="pt-4 border-t border-border/80">
            <button
              type="button"
              disabled
              className="w-full p-3 rounded-xl border border-border bg-muted/50 text-muted-foreground text-sm opacity-60 cursor-not-allowed"
            >
              Sign in with Microsoft (Coming Soon)
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ต้องการสมัครงานภายนอก?{' '}
          <Link to="/apply" className="font-medium text-primary hover:underline underline-offset-4">
            ดูบอร์ดประกาศรับสมัคร
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
