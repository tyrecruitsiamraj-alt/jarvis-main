import React, { useEffect, useState } from 'react';
import { FileDown, LoaderCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ChannelPicker from '@/components/shared/ChannelPicker';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { apiFetch } from '@/lib/apiFetch';
import { parseAppUserList } from '@/lib/userApi';
import { recruitChannelLabel, type RecruitChannelMatch } from '@/lib/recruitPostings';
import {
  downloadApplicationImportTemplate,
  readFileAsBase64,
  runApplicationImport,
  type ApplicationImportResult,
} from '@/lib/applicationImportApi';

/**
 * ป๊อป **นำเข้าผู้สมัครจาก Excel** (เจ้าของสั่ง 1 ต.ค. 2569 · Choice "ทำ Excel ตัวอย่าง + อัปโหลด")
 *
 * ดาวน์โหลดไฟล์ตัวอย่าง → กรอก → เลือกไฟล์ (อ่านตัวอย่างทันที ไม่เขียนอะไร) → กด "นำเข้า N คน"
 * ผู้รับผิดชอบ/ช่องทางเลือกบนป๊อป ใช้กับทุกแถว (ให้ตรงรายการจริงในระบบ ไม่พิมพ์เองในไฟล์)
 * 🔴 เบอร์ที่มีในระบบแล้ว/ซ้ำในไฟล์ = ข้าม (กติกาเบอร์เดียว) · นำเข้าแล้ว AI ยังไม่โทร
 * 🔴 ตารางตัวอย่างอยู่เสมอ ว่าง = แถว "ยังไม่ได้เลือกไฟล์" (กติกาว่างแล้วห้ามหาย)
 */
const NO_STAFF = '__none__';

const ImportApplicantsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  /** บันทึกแล้ว — หน้าแม่โหลดรายชื่อใหม่ + ขึ้นข้อความ */
  onSaved: (inserted: number) => void;
}> = ({ open, onClose, onSaved }) => {
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [responsible, setResponsible] = useState(NO_STAFF);
  const [channel, setChannel] = useState<RecruitChannelMatch | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<ApplicationImportResult | null>(null);
  const [busy, setBusy] = useState<'template' | 'reading' | 'saving' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setResponsible(NO_STAFF);
    setChannel(null);
    setFileName(null);
    setFileBase64(null);
    setPreview(null);
    setBusy(null);
    setError(null);
    void apiFetch('/api/app-users')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setStaff(
          parseAppUserList(data)
            .filter((u) => u.is_active)
            .map((u) => ({ id: u.id, name: u.full_name || u.email })),
        ),
      )
      .catch(() => setStaff([]));
  }, [open]);

  const shared = () => ({
    responsibleName: staff.find((u) => u.id === responsible)?.name ?? null,
    channelId: channel?.id ?? null,
    channelLabel: channel ? recruitChannelLabel(channel) : null,
  });

  const pickFile = async (f: File | null) => {
    setError(null);
    setPreview(null);
    setFileName(f?.name ?? null);
    setFileBase64(null);
    if (!f) return;
    setBusy('reading');
    try {
      const b64 = await readFileAsBase64(f);
      setFileBase64(b64);
      setPreview(await runApplicationImport({ fileBase64: b64, dryRun: true, ...shared() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อ่านไฟล์ไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!fileBase64 || busy) return;
    setBusy('saving');
    setError(null);
    try {
      const result = await runApplicationImport({ fileBase64, dryRun: false, ...shared() });
      setPreview(result);
      onSaved(result.inserted ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'นำเข้าไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const saved = preview !== null && !preview.dryRun;
  const ready = preview?.dryRun ? (preview.ready ?? 0) : 0;
  const rows = preview?.rows ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => (!o && busy !== 'saving' ? onClose() : undefined)}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>นำเข้าผู้สมัครจาก Excel</DialogTitle>
          <DialogDescription className="sr-only">ดาวน์โหลดไฟล์ตัวอย่าง กรอก แล้วเลือกไฟล์เพื่อดูตัวอย่างก่อนนำเข้า</DialogDescription>
        </DialogHeader>

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => {
              setBusy('template');
              setError(null);
              downloadApplicationImportTemplate()
                .catch((e) => setError(e instanceof Error ? e.message : 'ดาวน์โหลดไฟล์ตัวอย่างไม่สำเร็จ'))
                .finally(() => setBusy(null));
            }}
          >
            {busy === 'template' ? <LoaderCircle className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
            ดาวน์โหลดไฟล์ตัวอย่าง
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ผู้รับผิดชอบ</Label>
            <Select value={responsible} onValueChange={setResponsible} disabled={saved || busy === 'saving'}>
              <SelectTrigger className="h-9 text-sm" aria-label="ผู้รับผิดชอบ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_STAFF}>ไม่ระบุ</SelectItem>
                {staff.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ช่องทาง</Label>
            <ChannelPicker value={channel} onChange={setChannel} reloadKey={open} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="import-applicants-file" className="text-xs text-muted-foreground">
            ไฟล์ Excel
          </Label>
          <Input
            id="import-applicants-file"
            type="file"
            accept=".xlsx,.xls"
            disabled={saved || busy !== null}
            onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
            className="h-auto py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2" data-testid="import-summary">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums', TONE.success.chip)}>
            {saved ? `นำเข้าแล้ว ${preview?.inserted ?? 0}` : `พร้อมนำเข้า ${ready}`}
          </span>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums', TONE.neutral.chip)}>
            ข้าม {preview?.skipped ?? 0}
          </span>
          {busy === 'reading' ? <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" aria-label="กำลังอ่านไฟล์" /> : null}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="min-w-full border-collapse text-left" aria-label="ตัวอย่างก่อนนำเข้า">
            <thead>
              <tr className={cn('border-b border-border', DASH.tableHead)}>
                <th className="px-3 py-2 text-[11px] font-medium">แถว</th>
                <th className="px-3 py-2 text-[11px] font-medium">ชื่อ</th>
                <th className="px-3 py-2 text-[11px] font-medium">เบอร์โทร</th>
                <th className="px-3 py-2 text-[11px] font-medium">ผล</th>
              </tr>
            </thead>
            <tbody data-testid="import-rows">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {fileName ? (busy === 'reading' ? 'กำลังอ่านไฟล์' : 'ไม่มีแถวข้อมูลในไฟล์') : 'ยังไม่ได้เลือกไฟล์'}
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.row} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{r.row}</td>
                  <td className="px-3 py-2 text-xs text-foreground">{r.name || '—'}</td>
                  <td className="px-3 py-2 text-xs tabular-nums text-foreground">{r.phone || '—'}</td>
                  <td className={cn('px-3 py-2 text-xs font-medium', r.ok ? TONE.success.value : TONE.danger.value)}>
                    {r.ok ? (saved ? 'นำเข้าแล้ว' : 'พร้อมนำเข้า') : r.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error ? (
          <p role="alert" className={cn('text-xs font-medium', TONE.danger.value)}>
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy === 'saving'} onClick={onClose}>
            {saved ? 'ปิด' : 'ยกเลิก'}
          </Button>
          {saved ? null : (
            <Button type="button" size="sm" disabled={ready === 0 || busy !== null} onClick={() => void save()}>
              {busy === 'saving' ? <LoaderCircle className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
              {busy === 'saving' ? 'กำลังนำเข้า…' : `นำเข้า ${ready} คน`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportApplicantsDialog;
