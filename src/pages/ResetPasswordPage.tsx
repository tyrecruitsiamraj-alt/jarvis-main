import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { apiFetch } from '@/lib/apiFetch';
import { ArrowRight } from 'lucide-react';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (!token) {
      setError('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง');
      return;
    }
    if (password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (password !== confirm) {
      setError('ยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setBusy(true);
    try {
      const r = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: password }),
      });
      const body = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!r.ok) {
        setError(body.message || body.error || 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ');
        return;
      }
      setOk(body.message || 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว');
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="jarvis-warm-bg min-h-[100dvh] flex items-center justify-center p-4">
      <div className="jarvis-frost w-full max-w-md rounded-[1.5rem] p-8 space-y-5">
        <div className="flex items-center gap-3">
          <BrandMark size="md" />
          <div>
            <h1 className="text-lg font-bold text-foreground">
              <BrandTitle />
            </h1>
            <p className="text-xs text-muted-foreground">ตั้งรหัสผ่านใหม่</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="jarvis-soft-field min-h-[48px] w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="jarvis-soft-field min-h-[48px] w-full"
            />
          </div>

          {error ? (
            <p className="text-xs text-destructive text-center" role="alert">
              {error}
            </p>
          ) : null}
          {ok ? (
            <p className="text-xs text-success text-center" role="status">
              {ok}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !token}
            className="jarvis-pill-btn w-full min-h-[52px] disabled:opacity-60"
          >
            {busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/" className="text-blue-600 hover:underline underline-offset-4">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
