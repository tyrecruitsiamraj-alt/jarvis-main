import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { fixApplicationPhone } from '@/lib/publicApplicationsApi';

/**
 * แก้เบอร์ของใบที่ติดธง "เบอร์ใช้โทรไม่ได้" (migration 087) — ใช้ร่วมป๊อปรายละเอียด (แท็บการติดตาม)
 * กับใบประวัติ (แท็บผู้สมัคร) · ชุดเดียว ห้ามก๊อปไปเขียนซ้ำ
 */
export default function ApplicantPhoneFix({ applicationId, onFixed }: { applicationId: string; onFixed: () => void }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // เปิดคนใหม่ = ล้างช่องเสมอ (ไม่งั้นเบอร์ที่พิมพ์ค้างไปอยู่กับคนถัดไป)
  useEffect(() => {
    setDraft('');
    setBusy(false);
    setError(null);
  }, [applicationId]);

  return (
    <div className="mt-1.5 space-y-1">
      <p className={cn('text-xs font-medium', TONE.danger.value)}>เบอร์นี้ใช้กับระบบโทรไม่ได้</p>
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="มือถือ 10 หลัก"
          inputMode="tel"
          aria-label="เบอร์มือถือใหม่"
          className="h-8 text-xs tabular-nums"
        />
        <Button
          type="button"
          size="xs"
          disabled={busy || draft.replace(/\D/g, '').length < 10}
          onClick={() => {
            setBusy(true);
            setError(null);
            fixApplicationPhone(applicationId, draft)
              .then(() => onFixed())
              .catch((e) => setError(e instanceof Error ? e.message : 'แก้เบอร์ไม่สำเร็จ'))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? <Loader2 className="animate-spin" /> : null} แก้เบอร์
        </Button>
      </div>
      {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}
    </div>
  );
}
