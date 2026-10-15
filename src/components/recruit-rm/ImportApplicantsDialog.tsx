import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bot, FileDown, LoaderCircle, Upload, Users } from 'lucide-react';
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
import { recruitChannelLabel, type RecruitChannelMatch } from '@/lib/recruitPostings';
import { importDateTh, importStatusLabel } from '@/lib/applicantImportDuplicates';
import {
  downloadApplicationImportTemplate,
  downloadImportDuplicates,
  fetchResponsibleNames,
  readFileAsBase64,
  runApplicationImport,
  type ApplicationImportResult,
} from '@/lib/applicationImportApi';

/**
 * ป๊อป **นำเข้าผู้สมัครจาก Excel** (เจ้าของสั่ง 1 ต.ค. 2569 · Choice "ทำ Excel ตัวอย่าง + อัปโหลด")
 *
 * ═══ ลำดับใหม่ (เจ้าของ 4 ต.ค. 2569) ═══
 * 1. ดาวน์โหลดแบบฟอร์ม → 2. เลือกไฟล์ (อ่านตัวอย่างทันที ไม่เขียนอะไร) → 3. **เลือกผู้รับผิดชอบ + ช่องทาง** (โผล่หลังเลือกไฟล์
 *    ต้องเลือกทั้งคู่ถึงนำเข้าได้ — รายชื่อชุดนี้มาจากไหน ใครดูแล) → 4. มีรายชื่อซ้ำ = เด้งหน้ารายชื่อซ้ำ (สมัครล่าสุด · สถานะล่าสุด ·
 *    ดาวน์โหลดเป็นไฟล์ได้) · กลับมาทำต่อได้ · ห้ามซ้อน Dialog ⇒ สลับเนื้อในป๊อปเดิม
 * 🔴 เบอร์ที่สมัครเข้ามาภายใน 14 วัน/ซ้ำในไฟล์ = ข้าม (กติกาสมัครซ้ำ · เหตุผลมาจาก API) · นำเข้าแล้ว AI ยังไม่โทร
 * 🔴 ตารางตัวอย่างอยู่เสมอ ว่าง = แถว "ยังไม่ได้เลือกไฟล์" (กติกาว่างแล้วห้ามหาย)
 *
 * ═══ นำเข้าตามกล่อง (เจ้าของสั่ง 15 ต.ค. 2569) ═══ — เปิดจากปุ่ม "Excel" บนการ์ดใบขอ (แท็บโพสต์ประกาศ)
 * ส่ง `job` มา = ทุกแถวผูกใบนั้น + บันทึกแล้วส่ง AI โทรเลย · ตารางตัวอย่างคือรายชื่อที่จะโทร (กติกาปุ่มยิงสายต้องเห็นรายชื่อ)
 * ใบยังไม่ตั้งรายได้ = บอกก่อนกดว่า AI ยังไม่โทร (นำเข้าได้ ส่งทีหลังได้)
 */
const NO_STAFF = '__none__';

const ImportApplicantsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  /** บันทึกแล้ว — หน้าแม่โหลดรายชื่อใหม่ + ขึ้นข้อความ */
  onSaved: (inserted: number) => void;
  /** นำเข้าตามกล่อง — ผูกใบขอนี้ + ส่ง AI โทรเลย · ไม่ส่ง = นำเข้าแบบเดิม (AI ยังไม่โทร) */
  job?: { id: string; title?: string | null; unitName?: string | null; label?: string | null } | null;
}> = ({ open, onClose, onSaved, job = null }) => {
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [responsible, setResponsible] = useState(NO_STAFF);
  const [channel, setChannel] = useState<RecruitChannelMatch | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<ApplicationImportResult | null>(null);
  const [busy, setBusy] = useState<'template' | 'reading' | 'saving' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** หน้ารายชื่อซ้ำ — เด้งเองเมื่ออ่านไฟล์แล้วมีคนซ้ำ · กด "ทำต่อ" กลับหน้านำเข้า */
  const [showDupes, setShowDupes] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowDupes(false);
    setResponsible(NO_STAFF);
    setChannel(null);
    setFileName(null);
    setFileBase64(null);
    setPreview(null);
    setBusy(null);
    setError(null);
    // 🔴 ห้ามกลับไปใช้ /api/app-users (admin เท่านั้น — คนอื่นได้ลิสต์ว่าง นำเข้าไม่ได้ · 11 ต.ค. 2569)
    void fetchResponsibleNames()
      .then(setStaff)
      .catch((e) => {
        setStaff([]);
        setError(e instanceof Error ? e.message : 'โหลดรายชื่อผู้รับผิดชอบไม่สำเร็จ');
      });
  }, [open]);

  const shared = () => ({
    responsibleName: staff.find((u) => u.id === responsible)?.name ?? null,
    channelId: channel?.id ?? null,
    channelLabel: channel ? recruitChannelLabel(channel) : null,
    job,
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
      const result = await runApplicationImport({
        fileBase64: b64,
        dryRun: true,
        ...shared(),
      });
      setPreview(result);
      setShowDupes((result.duplicates?.length ?? 0) > 0);
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
      const result = await runApplicationImport({
        fileBase64,
        dryRun: false,
        ...shared(),
      });
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
  const dupes = preview?.duplicates ?? [];
  /** ต้องเลือกทั้งผู้รับผิดชอบและช่องทางก่อนนำเข้า (เจ้าของ 4 ต.ค. 2569) */
  const sharedPicked = responsible !== NO_STAFF && channel !== null;
  const aiBlock = job && preview?.dryRun ? (preview.ai_block ?? null) : null;
  const ai = saved ? preview?.ai : undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o && busy !== 'saving' ? onClose() : undefined)}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? 'นำเข้า Excel แล้วส่ง AI โทร' : 'นำเข้าผู้สมัครจาก Excel'}</DialogTitle>
          {job ? (
            <DialogDescription data-testid="import-job">
              {job.label || [job.unitName, job.title].filter(Boolean).join(' · ')}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              ดาวน์โหลดไฟล์ตัวอย่าง กรอก แล้วเลือกไฟล์เพื่อดูตัวอย่างก่อนนำเข้า
            </DialogDescription>
          )}
        </DialogHeader>
        {showDupes ? (
          /* ═══ รายชื่อซ้ำ (เจ้าของ 4 ต.ค. 2569) — สมัครล่าสุด · สถานะล่าสุด · โหลดเป็นไฟล์ได้ · กลับไปทำต่อ ═══ */
          <div className="space-y-4" data-testid="import-duplicates">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">รายชื่อซ้ำ {dupes.length} คน</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!preview?.duplicatesFileBase64}
                onClick={() => preview?.duplicatesFileBase64 && downloadImportDuplicates(preview.duplicatesFileBase64)}
              >
                <FileDown aria-hidden />
                ดาวน์โหลดรายชื่อซ้ำ
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="min-w-full border-collapse text-left" aria-label="รายชื่อซ้ำ">
                <thead>
                  <tr className={cn('border-b border-border', DASH.tableHead)}>
                    <th className="px-3 py-2 text-[11px] font-medium">แถว</th>
                    <th className="px-3 py-2 text-[11px] font-medium">ชื่อ</th>
                    <th className="px-3 py-2 text-[11px] font-medium">เบอร์โทร</th>
                    <th className="px-3 py-2 text-[11px] font-medium">สมัครล่าสุด</th>
                    <th className="px-3 py-2 text-[11px] font-medium">สถานะล่าสุด</th>
                    <th className="px-3 py-2 text-[11px] font-medium">ผลนำเข้า</th>
                  </tr>
                </thead>
                <tbody>
                  {dupes.map((d) => (
                    <tr key={d.row} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{d.row}</td>
                      <td className="px-3 py-2 text-xs text-foreground">
                        {d.name || '—'}
                        {d.lastJob ? (
                          <span className="block text-[11px] text-muted-foreground">{d.lastJob}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs tabular-nums text-foreground">{d.phone || '—'}</td>
                      <td className="px-3 py-2 text-xs tabular-nums text-foreground">
                        {importDateTh(d.lastAppliedAt)}
                        {d.applications > 1 ? (
                          <span className="block text-[11px] text-muted-foreground">เคยสมัคร {d.applications} ใบ</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-foreground">{importStatusLabel(d.lastStatus)}</td>
                      <td
                        className={cn('px-3 py-2 text-xs font-medium', d.skipped ? TONE.danger.value : TONE.warn.value)}
                      >
                        {d.skipped ? 'ข้าม' : 'นำเข้าได้'}
                        <span className="block text-[11px] font-normal text-muted-foreground">{d.note}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button type="button" size="sm" onClick={() => setShowDupes(false)}>
                <ArrowLeft aria-hidden />
                {saved ? 'กลับ' : 'ทำต่อ'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
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
                ดาวน์โหลดแบบฟอร์มนำเข้า
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-applicants-file" className="text-xs text-muted-foreground">
                ไฟล์ Excel (กรอกตามแบบฟอร์ม)
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

            {/* 3. หลังเลือกไฟล์ถึงโผล่ — รายชื่อชุดนี้มาจากไหน ใครดูแล (ต้องเลือกทั้งคู่) */}
            {fileBase64 ? (
              <div className="grid gap-3 sm:grid-cols-2" data-testid="import-shared">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">ผู้รับผิดชอบรายชื่อชุดนี้</Label>
                  <Select value={responsible} onValueChange={setResponsible} disabled={saved || busy === 'saving'}>
                    <SelectTrigger className="h-9 text-sm" aria-label="ผู้รับผิดชอบ">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_STAFF} disabled>
                        เลือกผู้รับผิดชอบ
                      </SelectItem>
                      {staff.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">รายชื่อชุดนี้มาจากช่องทาง</Label>
                  <ChannelPicker value={channel} onChange={setChannel} reloadKey={open} />
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2" data-testid="import-summary">
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums', TONE.success.chip)}>
                {saved ? `นำเข้าแล้ว ${preview?.inserted ?? 0}` : `พร้อมนำเข้า ${ready}`}
              </span>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums', TONE.neutral.chip)}>
                ข้าม {preview?.skipped ?? 0}
              </span>
              {dupes.length > 0 ? (
                <Button type="button" size="xs" variant="outline" onClick={() => setShowDupes(true)}>
                  <Users aria-hidden />
                  ซ้ำ {dupes.length} คน
                </Button>
              ) : null}
              {ai ? (
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums', TONE.info.chip)}>
                  ส่ง AI โทร {ai.queued}
                </span>
              ) : null}
              {ai && ai.skipped.length > 0 ? (
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums', TONE.warn.chip)}>
                  AI ไม่โทร {ai.skipped.length}
                </span>
              ) : null}
              {busy === 'reading' ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" aria-label="กำลังอ่านไฟล์" />
              ) : null}
            </div>

            {aiBlock ? (
              <p role="status" className={cn('text-xs font-medium', TONE.warn.value)} data-testid="import-ai-block">
                AI ยังโทรใบนี้ไม่ได้: {aiBlock}
              </p>
            ) : null}
            {ai?.error ? (
              <p role="alert" className={cn('text-xs font-medium', TONE.danger.value)}>
                {ai.error}
              </p>
            ) : null}
            {ai && ai.skipped.length > 0 ? (
              <ul className="space-y-0.5 text-xs" data-testid="import-ai-skipped">
                {ai.skipped.map((x, i) => (
                  <li key={`${x.name}-${i}`} className="text-foreground">
                    {x.name || '—'} <span className="text-muted-foreground">· {x.reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}

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
                        {fileName
                          ? busy === 'reading'
                            ? 'กำลังอ่านไฟล์'
                            : 'ไม่มีแถวข้อมูลในไฟล์'
                          : 'ยังไม่ได้เลือกไฟล์'}
                      </td>
                    </tr>
                  ) : null}
                  {rows.map((r) => (
                    <tr key={r.row} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{r.row}</td>
                      <td className="px-3 py-2 text-xs text-foreground">{r.name || '—'}</td>
                      <td className="px-3 py-2 text-xs tabular-nums text-foreground">{r.phone || '—'}</td>
                      <td
                        className={cn('px-3 py-2 text-xs font-medium', r.ok ? TONE.success.value : TONE.danger.value)}
                      >
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
                <Button
                  type="button"
                  size="sm"
                  disabled={ready === 0 || busy !== null || !sharedPicked}
                  title={!sharedPicked && fileBase64 ? 'เลือกผู้รับผิดชอบและช่องทางก่อน' : undefined}
                  onClick={() => void save()}
                >
                  {busy === 'saving' ? (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  ) : job && !aiBlock ? (
                    <Bot aria-hidden />
                  ) : (
                    <Upload aria-hidden />
                  )}
                  {busy === 'saving'
                    ? 'กำลังนำเข้า…'
                    : job && !aiBlock
                      ? `นำเข้าแล้วส่ง AI โทร ${ready} คน`
                      : `นำเข้า ${ready} คน`}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportApplicantsDialog;
