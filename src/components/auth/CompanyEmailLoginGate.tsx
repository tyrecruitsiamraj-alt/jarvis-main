import React, { useState } from 'react';
import { Label } from '@/components/ui/label';

export function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

type Props = {
  email: string;
  onEmailChange: (value: string) => void;
  emailPlaceholder: string;
  companyEmailHint: string | null;
  magicLinkMsg: string | null;
  magicLinkBusy: boolean;
  microsoftLogin?: boolean;
  companyEmailLogin?: boolean;
  microsoftBusy?: boolean;
  onMicrosoftLogin?: () => void;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
};

const CompanyEmailLoginGate: React.FC<Props> = ({
  email,
  onEmailChange,
  emailPlaceholder,
  companyEmailHint,
  magicLinkMsg,
  magicLinkBusy,
  microsoftLogin = false,
  companyEmailLogin = false,
  microsoftBusy = false,
  onMicrosoftLogin,
  error,
  onSubmit,
}) => {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const msBusy = microsoftBusy || magicLinkBusy;
  const showEmailFallback = companyEmailLogin && !microsoftLogin;

  return (
    <>
      <h1 className="text-xl font-semibold mb-1 text-center text-foreground">ยินดีต้อนรับ</h1>
      <p className="text-sm text-muted-foreground mb-7 text-center">
        เข้าสู่ระบบด้วยบัญชีองค์กรของคุณ
      </p>

      <button
        type="button"
        disabled={msBusy}
        onClick={() => {
          if (microsoftLogin) {
            onMicrosoftLogin?.();
            return;
          }
          if (showEmailFallback) {
            setShowEmailForm(true);
          } else {
            onMicrosoftLogin?.();
          }
        }}
        className="btn-primary w-full touch-manipulation min-h-[52px]"
      >
        <MicrosoftLogo />
        {microsoftBusy
          ? 'กำลังเปลี่ยนหน้า…'
          : magicLinkBusy
            ? 'กำลังส่งลิงก์…'
            : 'เข้าสู่ระบบด้วย Microsoft'}
      </button>

      {companyEmailLogin && microsoftLogin ? (
        <button
          type="button"
          className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline touch-manipulation"
          onClick={() => setShowEmailForm((v) => !v)}
        >
          {showEmailForm ? 'ซ่อนฟอร์มอีเมล' : 'หรือรับลิงก์เข้าสู่ระบบทางอีเมล'}
        </button>
      ) : null}

      {(showEmailForm || showEmailFallback) && companyEmailLogin ? (
        <form onSubmit={onSubmit} className="mt-5 space-y-3 text-left">
          <div className="space-y-1.5">
            <Label htmlFor="company-email" className="text-xs font-medium text-muted-foreground">
              อีเมลบริษัท
            </Label>
            <input
              id="company-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder={emailPlaceholder}
              required
              className="jarvis-soft-field min-h-[44px] w-full"
            />
            {companyEmailHint ? (
              <p className="text-[11px] text-muted-foreground">{companyEmailHint}</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={magicLinkBusy}
            className="jarvis-pill-btn w-full min-h-[44px] px-4 py-2.5 text-sm touch-manipulation"
          >
            {magicLinkBusy ? 'กำลังส่งลิงก์…' : 'ส่งลิงก์เข้าสู่ระบบ'}
          </button>
        </form>
      ) : null}

      {magicLinkMsg ? (
        <p
          className="mt-4 text-xs text-muted-foreground text-center rounded-xl bg-white/50 border border-white/70 px-3 py-2"
          role="status"
        >
          {magicLinkMsg}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-xs text-destructive text-center" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-6 text-xs text-muted-foreground text-center">
        เฉพาะผู้ใช้ที่ได้รับสิทธิ์ในองค์กรเท่านั้น
      </p>
    </>
  );
};

export default CompanyEmailLoginGate;
