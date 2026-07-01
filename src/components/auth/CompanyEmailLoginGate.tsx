import React from 'react';
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
  const showMagicLinkForm = companyEmailLogin;

  return (
    <>
      <p className="text-sm text-center text-foreground font-medium">เข้าใช้งานระบบ</p>
      <p className="text-xs text-center text-muted-foreground -mt-2">
        {microsoftLogin && !showMagicLinkForm
          ? 'เข้าสู่ระบบด้วยบัญชี Microsoft ของบริษัท'
          : microsoftLogin
            ? 'เข้าสู่ระบบด้วย Microsoft หรือรับลิงก์ทางอีเมล'
            : 'กรอกอีเมลบริษัทแล้วรับลิงก์เข้าสู่ระบบทางอีเมล'}
      </p>

      {microsoftLogin ? (
        <button
          type="button"
          disabled={microsoftBusy || magicLinkBusy}
          onClick={() => onMicrosoftLogin?.()}
          className="btn-primary w-full touch-manipulation min-h-[52px]"
        >
          <MicrosoftLogo />
          {microsoftBusy ? 'กำลังเปลี่ยนหน้า…' : 'เข้าสู่ระบบด้วย Microsoft'}
        </button>
      ) : null}

      {showMagicLinkForm ? (
        <form onSubmit={onSubmit} className="space-y-4">
          {microsoftLogin ? (
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 text-muted-foreground bg-transparent">หรือรับลิงก์ทางอีเมล</span>
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="company-email" className="text-xs font-medium text-muted-foreground ml-1">
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
              className="jarvis-soft-field min-h-[48px]"
            />
            {companyEmailHint ? (
              <p className="text-[11px] text-muted-foreground ml-1">{companyEmailHint}</p>
            ) : null}
          </div>

          {magicLinkMsg ? (
            <p
              className="text-xs text-muted-foreground text-center rounded-xl bg-white/50 border border-white/70 px-3 py-2"
              role="status"
            >
              {magicLinkMsg}
            </p>
          ) : null}

          {!microsoftLogin ? (
            <button
              type="submit"
              disabled={magicLinkBusy}
              className="btn-primary w-full touch-manipulation min-h-[52px]"
            >
              <MicrosoftLogo />
              {magicLinkBusy ? 'กำลังส่งลิงก์…' : 'เข้าสู่ระบบด้วย Microsoft'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={magicLinkBusy}
              className="jarvis-pill-btn w-full min-h-[52px] px-6 py-3 text-sm touch-manipulation"
            >
              {magicLinkBusy ? 'กำลังส่งลิงก์…' : 'ส่งลิงก์เข้าสู่ระบบทางอีเมล'}
            </button>
          )}
        </form>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive text-center" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
};

export default CompanyEmailLoginGate;
