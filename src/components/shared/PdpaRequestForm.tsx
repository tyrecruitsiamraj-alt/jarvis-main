import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  PDPA_REQUEST_KIND_LABEL,
  PDPA_REQUEST_KINDS,
  validatePdpaRequest,
  type PdpaRequestKind,
  type PdpaRequestInput,
} from '@/lib/pdpaRequests';

/**
 * ฟอร์มคำขอใช้สิทธิ์ข้อมูลส่วนบุคคล (18 ต.ค. 2569) — ตัวเดียวทั้งหน้าสาธารณะ /privacy-request และเจ้าหน้าที่ลงแทน (หน้าตั้งค่า)
 * ตรวจค่าด้วย `validatePdpaRequest` ตัวเดียวกับเซิร์ฟเวอร์ (ข้อความเตือนตรงกัน)
 */
export default function PdpaRequestForm({
  onSubmit,
  submitLabel,
  busy,
  error,
  idPrefix,
}: {
  onSubmit: (v: PdpaRequestInput) => void;
  submitLabel: string;
  busy: boolean;
  /** ข้อความจากเซิร์ฟเวอร์ (ส่งไม่สำเร็จ) */
  error: string | null;
  idPrefix: string;
}) {
  const [kind, setKind] = useState<PdpaRequestKind | ''>('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [detail, setDetail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = validatePdpaRequest({ kind, fullName, phone, detail });
    if ('message' in parsed) {
      setLocalError(parsed.message);
      return;
    }
    setLocalError(null);
    onSubmit(parsed.value);
  };

  const shownError = localError ?? error;

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">ต้องการอะไร</p>
        <RadioGroup
          value={kind}
          onValueChange={(v) => {
            setKind(v as PdpaRequestKind);
            setLocalError(null);
          }}
          className="grid gap-2 sm:grid-cols-2"
        >
          {PDPA_REQUEST_KINDS.map((k) => (
            <Label
              key={k}
              htmlFor={`${idPrefix}-kind-${k}`}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-normal has-[[data-state=checked]]:border-primary"
            >
              <RadioGroupItem id={`${idPrefix}-kind-${k}`} value={k} />
              {PDPA_REQUEST_KIND_LABEL[k]}
            </Label>
          ))}
        </RadioGroup>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>ชื่อ-นามสกุล</Label>
        <Input
          id={`${idPrefix}-name`}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          maxLength={120}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>เบอร์มือถือที่ใช้สมัคร</Label>
        <Input
          id={`${idPrefix}-phone`}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          maxLength={12}
          placeholder="0812345678"
          className="tabular-nums"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-detail`}>{kind === 'correct' ? 'ข้อมูลไหนผิด ที่ถูกคืออะไร' : 'รายละเอียดเพิ่มเติม (ไม่บังคับ)'}</Label>
        <Textarea id={`${idPrefix}-detail`} value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={1000} />
      </div>
      {shownError ? (
        <p role="alert" className="text-sm text-destructive">
          {shownError}
        </p>
      ) : null}
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {busy ? 'กำลังส่ง…' : submitLabel}
      </Button>
    </form>
  );
}
