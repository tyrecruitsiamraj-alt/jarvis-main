/**
 * ═══ ตั้งค่า › ส่งเอกสารผ่าน LINE (เจ้าของ 22 พ.ย. 2569) ═══
 * เปิด/ปิดระบบ · LINE Login Channel ID + LIFF ID (ไม่ใช่ความลับ) · ต้นฉบับเอกสารบริษัท 5 ฉบับ (เก็บในฐาน ไม่อยู่ในโค้ด)
 * เปิดได้เมื่อตั้งค่าครบ (เซิร์ฟเวอร์ตรวจก่อนเปิด) · ปิด = สร้างลิงก์ใหม่ไม่ได้ ผู้สมัครเปิดลิงก์ไม่ได้ ของที่ส่งแล้วยังดูได้
 */
import React, { useCallback, useEffect, useId, useState } from 'react';
import { Copy, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TONE } from '@/lib/designTokens';
import { formatDateTimeTh } from '@/lib/dateTh';
import { cn } from '@/lib/utils';
import type { DocId } from '@/lib/documents/documentTypes';
import { fetchDocumentSettings, saveDocumentSettings, settingsTemplateUrl, uploadDocumentTemplate, type DocumentSettingsView } from '@/lib/documents/documentsStaffApi';

const PAGE_MAX_BYTES = 3_000_000;
const UPLOAD_MAX_BYTES = 12_000_000;

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).slice(String(r.result).indexOf(',') + 1));
    r.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'));
    r.readAsDataURL(file);
  });

function TemplateRow({ t, onUploaded }: { t: NonNullable<DocumentSettingsView['templates']>[number]; onUploaded: () => void }) {
  const input = React.useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const upload = async (list: FileList | null) => {
    const files = [...(list ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!files.length) return;
    setNote(null);
    if (files.some((f) => f.size > PAGE_MAX_BYTES)) return setNote({ ok: false, text: 'ไฟล์หน้าเอกสารใหญ่เกิน 3 MB' });
    if (files.reduce((n, f) => n + f.size, 0) > UPLOAD_MAX_BYTES) return setNote({ ok: false, text: 'ไฟล์รวมใหญ่เกิน 12 MB ลดขนาดภาพก่อน' });
    setBusy(true);
    try {
      const saved = await uploadDocumentTemplate(t.docType, await Promise.all(files.map(fileToBase64)));
      setNote({ ok: true, text: `บันทึกรุ่น ${saved.version} · ${saved.pageCount} หน้า` });
      onUploaded();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'อัปโหลดไม่ได้' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="space-y-1.5 p-3" data-testid={`template-${t.docType}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-foreground">{t.title}</p>
          <p className="text-xs text-muted-foreground">
            {t.version ? `รุ่น ${t.version} · ${t.pages} หน้า · ${t.updatedAt ? formatDateTimeTh(t.updatedAt) : ''}${t.updatedByName ? ` · ${t.updatedByName}` : ''}` : 'ยังไม่มีต้นฉบับ'}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()} data-testid={`template-upload-${t.docType}`}>
          <Upload aria-hidden /> {busy ? 'กำลังอัปโหลด…' : t.version ? 'อัปโหลดรุ่นใหม่' : 'อัปโหลด'}
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          hidden
          aria-label={`ไฟล์ต้นฉบับ ${t.title}`}
          onChange={(e) => {
            const files = e.target.files;
            void upload(files).finally(() => {
              e.target.value = '';
            });
          }}
        />
      </div>
      {t.pages ? (
        <p className="text-xs">
          {Array.from({ length: t.pages }, (_, i) => (
            <a key={i} href={settingsTemplateUrl(t.docType as DocId, i + 1)} target="_blank" rel="noreferrer" className="mr-3 text-primary underline">
              หน้า {i + 1}
            </a>
          ))}
        </p>
      ) : null}
      {note ? <p className={cn('text-xs', note.ok ? TONE.success.value : TONE.danger.value)}>{note.text}</p> : null}
    </li>
  );
}

/** ค่าใน Select (Radix ใช้ค่าว่างไม่ได้) = อ่านในมือถือผู้สมัคร */
const OCR_ON_PHONE = 'phone';

const DocumentsSettingsTab: React.FC = () => {
  const id = useId();
  const [s, setS] = useState<DocumentSettingsView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [channel, setChannel] = useState('');
  const [liff, setLiff] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [ocr, setOcr] = useState(OCR_ON_PHONE);
  const endpoint = `${window.location.origin}/apply/documents`;

  const load = useCallback(async () => {
    try {
      const v = await fetchDocumentSettings();
      setS(v);
      setChannel(v.lineChannelId ?? '');
      setLiff(v.liffId ?? '');
      setOcr(v.ocrModel || OCR_ON_PHONE);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'อ่านค่าไม่ได้');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Parameters<typeof saveDocumentSettings>[0], done: string) => {
    setBusy(true);
    setNote(null);
    try {
      await saveDocumentSettings(patch);
      setNote({ ok: true, text: done });
      await load();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'บันทึกไม่ได้' });
    } finally {
      setBusy(false);
    }
  };

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopied(true);
    } catch {
      (document.getElementById(`${id}-endpoint`) as HTMLInputElement | null)?.select();
    }
  };

  if (loadError && !s) return <p className={cn('text-sm', TONE.danger.value)}>{loadError}</p>;
  if (!s) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  const changed = channel.trim() !== (s.lineChannelId ?? '') || liff.trim() !== (s.liffId ?? '');

  return (
    <Card variant="solid" className="max-w-3xl space-y-6 p-5" data-testid="documents-settings">
      <h3 className="text-lg font-medium text-foreground">ส่งเอกสารผ่าน LINE</h3>

      <section className="space-y-2">
        <div className="flex items-center gap-3">
          <Switch
            id={`${id}-enabled`}
            checked={s.enabled}
            disabled={busy}
            onCheckedChange={(v) => void save({ enabled: v }, v ? 'เปิดใช้แล้ว' : 'ปิดแล้ว')}
            data-testid="documents-enabled"
          />
          <Label htmlFor={`${id}-enabled`} className="text-sm">
            {s.enabled ? 'เปิดใช้อยู่' : 'ปิดอยู่'}
          </Label>
        </div>
        {s.problems?.length ? (
          <ul className={cn('list-disc space-y-0.5 pl-5 text-sm', TONE.warn.value)} data-testid="documents-problems">
            {s.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
        {s.mock ? <p className="text-xs text-muted-foreground">เครื่องทดสอบ: ใช้บัญชี LINE จำลองได้</p> : null}
        {note ? <p className={cn('text-sm', note.ok ? TONE.success.value : TONE.danger.value)}>{note.text}</p> : null}
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">LINE Login</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-channel`}>Channel ID</Label>
            <Input id={`${id}-channel`} inputMode="numeric" maxLength={20} value={channel} placeholder="เช่น 2001234567" onChange={(e) => setChannel(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-liff`}>LIFF ID</Label>
            <Input id={`${id}-liff`} maxLength={40} value={liff} placeholder="เช่น 2001234567-AbCdEfGh" onChange={(e) => setLiff(e.target.value.trim())} />
          </div>
        </div>
        <Button type="button" size="sm" disabled={busy || !changed} onClick={() => void save({ lineChannelId: channel.trim(), liffId: liff.trim() }, 'บันทึกแล้ว')}>
          บันทึก
        </Button>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-endpoint`}>Endpoint URL ของ LIFF</Label>
          <div className="flex gap-2">
            <Input id={`${id}-endpoint`} readOnly value={endpoint} className="min-w-0 flex-1" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" size="sm" variant="outline" onClick={() => void copyEndpoint()}>
              <Copy aria-hidden /> {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-2" data-testid="documents-ocr">
        <h4 className="text-sm font-medium text-foreground">อ่านบัตรประชาชน · ใบขับขี่</h4>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-sm">
            <Label htmlFor={`${id}-ocr`}>อ่านด้วย</Label>
            <Select value={ocr} onValueChange={setOcr} disabled={busy}>
              <SelectTrigger id={`${id}-ocr`} data-testid="documents-ocr-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OCR_ON_PHONE}>มือถือผู้สมัคร</SelectItem>
                {(s.ocrModels ?? []).map((m) => (
                  <SelectItem key={m} value={m}>
                    เซิร์ฟเวอร์บริษัท · {m}
                  </SelectItem>
                ))}
                {s.ocrModel && !(s.ocrModels ?? []).includes(s.ocrModel) ? <SelectItem value={s.ocrModel}>เซิร์ฟเวอร์บริษัท · {s.ocrModel}</SelectItem> : null}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={busy || ocr === (s.ocrModel || OCR_ON_PHONE)}
            onClick={() => void save({ ocrModel: ocr === OCR_ON_PHONE ? '' : ocr }, 'บันทึกแล้ว')}
          >
            บันทึก
          </Button>
        </div>
        <p className={cn('text-sm', ocrStatus(s).tone)} data-testid="documents-ocr-status">
          {ocrStatus(s).text}
        </p>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">ต้นฉบับเอกสาร</h4>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {(s.templates ?? []).map((t) => (
            <TemplateRow key={t.docType} t={t} onUploaded={() => void load()} />
          ))}
        </ul>
      </section>

      <section className="space-y-1 text-sm">
        <h4 className="text-sm font-medium text-foreground">แจ้งเตือนเจ้าหน้าที่</h4>
        <p className="text-muted-foreground" data-testid="documents-outbox">
          รอส่ง <span className="tabular-nums">{s.outbox?.pending ?? 0}</span> · ส่งไม่สำเร็จ <span className="tabular-nums">{s.outbox?.failed ?? 0}</span>
        </p>
      </section>

      <section className="space-y-1 text-sm">
        <h4 className="text-sm font-medium text-foreground">iRecruit</h4>
        <p className="text-muted-foreground">{s.irecruitConnected ? 'เชื่อมแล้ว' : 'ยังไม่เชื่อม · HR คีย์ใน iRecruit แล้วบันทึกเลขที่ในแท็บเอกสาร'}</p>
      </section>
    </Card>
  );
};

/** สถานะตัวอ่านบัตร — โมเดลที่เลือกไว้หายจากเซิร์ฟเวอร์ต้องเห็นบนจอ (บทเรียน 30 ต.ค. 2569) */
function ocrStatus(s: DocumentSettingsView): { text: string; tone: string } {
  if (!s.ocrModel) return { text: 'อ่านในมือถือผู้สมัคร', tone: 'text-muted-foreground' };
  if (s.ocrError) return { text: `${s.ocrError} ตอนนี้อ่านในมือถือแทน`, tone: TONE.warn.value };
  if (!(s.ocrModels ?? []).includes(s.ocrModel)) return { text: `ไม่พบ ${s.ocrModel} บนเซิร์ฟเวอร์ AI แล้ว ตอนนี้อ่านในมือถือแทน`, tone: TONE.danger.value };
  return { text: 'พร้อมใช้ · ภาพละราว 40 วินาที', tone: TONE.success.value };
}

export default DocumentsSettingsTab;
