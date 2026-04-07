import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { UserRole } from '@/types';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { isDemoMode, isRuntimeDemoFallback } from '@/lib/demoMode';
import { User, Users2, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsDemo, devRoleSignIn, signIn, signUp } = useAuth();
  const { config } = useBranding();
  const shellBg = getAppShellBackgroundStyle(config);
  const demo = isDemoMode();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [registerRole, setRegisterRole] = useState<UserRole>('staff');

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
        full_name: fullName,
        role: registerRole,
      });
      if (msg) {
        setError(msg);
        return;
      }
      setAuthMode('login');
      setError('สมัครสำเร็จแล้ว — กรุณาเข้าสู่ระบบ');
    } finally {
      setSubmitting(false);
    }
  };
  const pickRole = async (role: UserRole, path: string) => {
    setError(null);
    if (demo) {
      loginAsDemo(role);
      navigate(path, { replace: true });
      return;
    }
    setSubmitting(true);
    try {
      const msg = await devRoleSignIn(role);
      if (msg) setError(msg);
      else navigate(path, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const roleTiles: {
    role: UserRole;
    path: string;
    label: string;
    desc: string;
    icon: typeof User;
    className: string;
  }[] = [
    {
      role: 'staff',
      path: '/staff',
      label: 'Staff',
      desc: 'สตาฟ / ปฏิบัติงาน',
      icon: User,
      className: 'hover:border-primary/50 hover:bg-primary/5',
    },
    {
      role: 'supervisor',
      path: '/supervisor',
      label: 'Supervisor',
      desc: 'หัวหน้างาน',
      icon: Users2,
      className: 'hover:border-info/50 hover:bg-info/5',
    },
    {
      role: 'admin',
      path: '/admin',
      label: 'Admin',
      desc: 'ผู้ดูแลระบบ',
      icon: Shield,
      className: 'hover:border-warning/50 hover:bg-warning/5',
    },
  ];

  const rolePickerBlock = (
    <div>
      <p className="text-xs font-semibold text-foreground text-center mb-1">เลือกสิทธิ์เข้าใช้งาน</p>
      <p className="text-[11px] text-muted-foreground text-center mb-3">
        {demo
          ? isRuntimeDemoFallback()
            ? 'ต่อเซิร์ฟเวอร์ไม่ได้ — ใช้โหมดสาธิตอัตโนมัติ (ข้อมูลบางส่วนในเบราว์เซอร์)'
            : 'โหมดสาธิต — ข้อมูลบางส่วนอยู่ในเบราว์เซอร์ ไม่ใช่ทั้งหมดใน DB'
          : 'เลือกบทบาทเพื่อเข้าใช้งานและดูฟีเจอร์ตามสิทธิ์ — ไม่ต้องใส่อีเมลหรือรหัสผ่าน (เชื่อมบัญชีในฐานข้อมูลตาม role ที่เลือก)'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {roleTiles.map(({ role, path, label, desc, icon: Icon, className }) => (
          <button
            key={role}
            type="button"
            disabled={submitting}
            onClick={() => void pickRole(role, path)}
            className={cn(
              'p-4 rounded-xl border border-border/80 bg-secondary/30 text-left transition-all shadow-sm disabled:opacity-50',
              className,
            )}
          >
            <Icon className="w-5 h-5 text-primary mb-2" />
            <div className="font-semibold text-foreground text-sm">{label}</div>
            <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{desc}</div>
          </button>
        ))}
      </div>
    </div>
  );

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
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
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
              <div className="space-y-1.5">
                <Label htmlFor="roleRegister">Role</Label>
                <select
                  id="roleRegister"
                  value={registerRole}
                  onChange={(e) => setRegisterRole(e.target.value as UserRole)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="staff">Staff</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full p-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}

          <div className="pt-1 border-t border-border/80" />
          {rolePickerBlock}
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
