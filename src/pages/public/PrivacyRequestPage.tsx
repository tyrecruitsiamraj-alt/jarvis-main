import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import PdpaRequestForm from '@/components/shared/PdpaRequestForm';
import { submitPublicPdpaRequest } from '@/lib/pdpaRequestsApi';
import { pdpaStopsCalls, type PdpaRequestInput } from '@/lib/pdpaRequests';
import { friendlyErrorText } from '@/lib/friendlyError';

/** เบอร์ติดต่อเรื่องข้อมูลส่วนบุคคล — ตามข้อตกลงของบริษัท (`PDPA_POLICY` หัวข้อ 5) */
const PDPA_CONTACT_PHONE = '082-7530-062';

/**
 * ═══ /privacy-request — ผู้สมัครขอดู / แก้ / ลบข้อมูลของตัวเอง (เจ้าของเลือกทำ 18 ต.ค. 2569) ═══
 * ลิงก์อยู่ในข้อตกลง PDPA บนฟอร์มสมัคร · ส่งแล้วเจ้าหน้าที่โทรกลับยืนยันตัวตน (Choice 17 ต.ค. 2569)
 * ขอลบ / ขอให้หยุดติดต่อ = ระบบหยุดโทรทันที
 */
export default function PrivacyRequestPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<PdpaRequestInput | null>(null);

  const submit = async (v: PdpaRequestInput) => {
    setBusy(true);
    setError(null);
    try {
      await submitPublicPdpaRequest(v);
      setSent(v);
    } catch (e) {
      setError(friendlyErrorText(e, 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 md:py-10">
      <Card className="space-y-5 rounded-2xl p-5 md:p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-medium text-foreground">ขอใช้สิทธิ์ข้อมูลส่วนบุคคล</h1>
          <p className="text-sm text-muted-foreground">ขอดู ขอแก้ หรือขอลบข้อมูลที่ให้ไว้ตอนสมัครงาน</p>
        </div>
        {sent ? (
          <div className="space-y-2 text-sm text-foreground" data-testid="privacy-request-sent">
            <p className="text-base font-medium">ได้รับคำขอแล้ว</p>
            <p>เจ้าหน้าที่จะโทรกลับเบอร์ {sent.phone} เพื่อยืนยันว่าเป็นเจ้าของข้อมูล ภายใน 30 วัน</p>
            {pdpaStopsCalls(sent.kind) ? <p>ระบบหยุดโทรหาเบอร์นี้แล้ว</p> : null}
            <p className="text-muted-foreground">สอบถามเพิ่มเติม โทร {PDPA_CONTACT_PHONE}</p>
          </div>
        ) : (
          <>
            <PdpaRequestForm onSubmit={(v) => void submit(v)} submitLabel="ส่งคำขอ" busy={busy} error={error} idPrefix="privacy" />
            <p className="text-xs text-muted-foreground">
              เจ้าหน้าที่จะโทรกลับเบอร์ที่กรอกเพื่อยืนยันตัวตนก่อน · สอบถาม {PDPA_CONTACT_PHONE}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
