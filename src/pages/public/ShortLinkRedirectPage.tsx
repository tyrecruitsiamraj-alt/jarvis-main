import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShortLink } from '@/lib/shortLinksApi';

/** /s/:code — resolve a short link and redirect to its target path */
const ShortLinkRedirectPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!code) {
      setFailed(true);
      return;
    }
    resolveShortLink(code)
      .then((target) => {
        if (cancelled) return;
        if (target) {
          // replace so the short URL doesn't linger in history
          window.location.replace(target);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      {failed ? (
        <>
          <p className="text-base font-semibold text-foreground">ลิงก์ไม่ถูกต้องหรือหมดอายุ</p>
          <a href="/apply" className="text-sm font-medium text-blue-600 hover:underline">
            ไปที่บอร์ดประกาศรับสมัคร
          </a>
        </>
      ) : (
        <p className="text-sm text-muted-foreground animate-pulse">กำลังเปิดลิงก์…</p>
      )}
    </div>
  );
};

export default ShortLinkRedirectPage;
