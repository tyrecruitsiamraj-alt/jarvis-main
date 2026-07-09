import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { cn } from '@/lib/utils';

const MagicLinkVerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyMagicLink, isAuthenticated, bootstrapping } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('กำลังยืนยันลิงก์เข้าสู่ระบบ…');

  useEffect(() => {
    if (bootstrapping) return;
    if (isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }

    const token = searchParams.get('token')?.trim();
    if (!token) {
      setStatus('error');
      setMessage('ลิงก์ไม่ถูกต้อง — ไม่พบรหัสยืนยัน');
      return;
    }

    let cancelled = false;
    (async () => {
      const err = await verifyMagicLink(token);
      if (cancelled) return;
      if (err) {
        setStatus('error');
        setMessage(err);
        return;
      }
      setStatus('success');
      setMessage('เข้าสู่ระบบสำเร็จ — กำลังพาไปหน้าหลัก…');
      navigate('/', { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrapping, isAuthenticated, navigate, searchParams, verifyMagicLink]);

  return (
    <div className="jarvis-warm-bg min-h-[100dvh] flex items-center justify-center p-4">
      <div className="jarvis-frost w-full max-w-md rounded-[1.5rem] p-8 text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <BrandMark size="md" />
          <BrandTitle />
        </div>
        <p
          className={cn(
            'text-sm',
            status === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
          role="status"
        >
          {message}
        </p>
        {status === 'error' ? (
          <Link
            to="/"
            className="inline-flex text-sm font-medium text-blue-600 hover:underline underline-offset-4"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        ) : null}
      </div>
    </div>
  );
};

export default MagicLinkVerifyPage;
