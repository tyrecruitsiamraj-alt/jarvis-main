/**
 * การ์ดแนบภาพเอกสาร 1 ใบ ของฟอร์มส่งเอกสาร — ถ่ายรูปหรือเลือกจากเครื่อง · ดูภาพที่แนบ · คำเตือนของใบนี้ · ติ๊กยืนยันว่าภาพใช้ได้ (22 พ.ย. 2569)
 * ปุ่มอยู่บนสุดที่เดิมเสมอ ภาพและข้อความต่อท้ายลงมา (กดแล้วปุ่มไม่ขยับ) · คำเตือนเป็นของใบนี้ใบเดียว ไม่บอกว่า "อ่านผ่าน"
 */
import { useId, useRef } from 'react';
import { Camera, ImageUp, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { UPLOAD_LABEL, type UploadKind } from '@/lib/documents/documentTypes';
import type { UploadSlot } from '@/lib/documents/applicantForm';

export default function DocumentUploadCard({
  kind,
  slot,
  imageUrl,
  enabled,
  busyText,
  error,
  onPick,
  onReadAgain,
  onConfirm,
}: {
  kind: UploadKind;
  slot: UploadSlot | undefined;
  imageUrl: string | null;
  /** กดแนบได้ไหม (ยอมรับข้อตกลงแล้ว และไม่มีใบอื่นกำลังทำงาน) */
  enabled: boolean;
  /** ข้อความความคืบหน้าของใบนี้ — null = ไม่ได้ทำงานอยู่ */
  busyText: string | null;
  error: string | null;
  onPick: (file: File) => void;
  onReadAgain: () => void;
  onConfirm: (checked: boolean) => void;
}) {
  const id = useId();
  const camera = useRef<HTMLInputElement | null>(null);
  const picker = useRef<HTMLInputElement | null>(null);
  const label = UPLOAD_LABEL[kind];
  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onPick(file);
  };
  const warnings = [...(slot?.quality ?? []), ...(slot?.result?.warnings ?? [])];
  const status =
    busyText ??
    (!slot
      ? 'ยังไม่ได้แนบ'
      : kind === 'house'
        ? 'แนบแล้ว'
        : slot.status === 'read'
          ? 'อ่านข้อมูลจากภาพแล้ว ตรวจอีกครั้งในขั้นถัดไป'
          : 'อ่านข้อมูลจากภาพไม่ได้ กรอกเองในขั้นถัดไป');

  return (
    <Card className="space-y-3 rounded-2xl p-4" data-testid={`upload-${kind}`}>
      <h3 className="text-base font-medium text-foreground">{label}</h3>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="lg" disabled={!enabled} onClick={() => camera.current?.click()}>
          <Camera aria-hidden /> {slot ? 'ถ่ายใหม่' : 'ถ่ายรูป'}
        </Button>
        <Button type="button" size="lg" variant="outline" disabled={!enabled} onClick={() => picker.current?.click()}>
          <ImageUp aria-hidden /> {slot ? 'เลือกภาพอื่น' : 'เลือกจากเครื่อง'}
        </Button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden aria-label={`ถ่ายรูป${label}`} onChange={take} />
      <input ref={picker} type="file" accept="image/*" hidden aria-label={`เลือกภาพ${label}`} onChange={take} data-testid={`upload-input-${kind}`} />
      <p className="text-sm text-muted-foreground" role="status" data-testid={`upload-status-${kind}`}>
        {status}
      </p>
      {error ? (
        <p className={cn('text-sm', TONE.danger.value)} role="alert">
          {error}
        </p>
      ) : null}
      {slot && imageUrl ? (
        <a href={imageUrl} target="_blank" rel="noreferrer" className="block">
          <img src={imageUrl} alt={`ภาพ${label}ที่แนบ`} className="w-full rounded-xl border border-border" />
        </a>
      ) : null}
      {slot && warnings.length ? (
        <ul className={cn('list-disc space-y-1 pl-5 text-sm', TONE.warn.value)} data-testid={`upload-warnings-${kind}`}>
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {slot && kind !== 'house' && slot.status === 'manual' && !busyText ? (
        <Button type="button" variant="outline" size="sm" disabled={!enabled} onClick={onReadAgain}>
          <RotateCw aria-hidden /> อ่านอีกครั้ง
        </Button>
      ) : null}
      {slot ? (
        <div className="flex items-start gap-2 text-sm text-foreground">
          <Checkbox id={id} className="mt-0.5" checked={slot.imageConfirmed} disabled={Boolean(busyText)} onCheckedChange={(v) => onConfirm(v === true)} />
          <label htmlFor={id} className="cursor-pointer leading-relaxed">
            ภาพนี้ถูกใบ อ่านตัวหนังสือได้ครบ
          </label>
        </div>
      ) : null}
    </Card>
  );
}
