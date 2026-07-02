import React from 'react';

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
  busy?: boolean;
  onMicrosoftLogin: () => void;
  error: string | null;
};

const CompanyEmailLoginGate: React.FC<Props> = ({ busy = false, onMicrosoftLogin, error }) => (
  <>
    <h1 className="text-xl font-semibold mb-1 text-center text-foreground">ยินดีต้อนรับ</h1>
    <p className="text-sm text-muted-foreground mb-7 text-center">
      เข้าสู่ระบบด้วยบัญชีองค์กรของคุณ
    </p>

    <button
      type="button"
      disabled={busy}
      onClick={onMicrosoftLogin}
      className="btn-primary w-full touch-manipulation min-h-[52px]"
    >
      <MicrosoftLogo />
      {busy ? 'กำลังเปลี่ยนหน้า…' : 'เข้าสู่ระบบด้วย Microsoft'}
    </button>

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

export default CompanyEmailLoginGate;
