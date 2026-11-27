/**
 * ═══ ตั้งค่า › แบบฟอร์มใบสมัคร (เจ้าของ 27 พ.ย. 2569 · แบบร่าง "ทำตามแบบร่าง") ═══
 * > *"จะมีไปออกบูธรับสมัคร เลยอยากเพิ่มอีกฟอร์ม … ใช้แค่บาง Bu … เลือกฟอร์มยังไง แก้ไข ลบ เพิ่มยังไงผ่านหน้า ui"*
 * ฟอร์มมาตรฐานอยู่บนสุดเสมอ ลบไม่ได้ · ฟอร์มอื่น = ติ๊กช่องเสริม + ติ๊ก BU (ไม่ติ๊ก = ทุก BU)
 * ลบได้เฉพาะฟอร์มที่ยังไม่มีลิงก์ใช้ · มีแล้ว = เลิกใช้ (ลิงก์เดิมยังเปิดได้ · Gen ใหม่เลือกไม่ได้)
 * ตัวกลาง `src/lib/applyForms.ts` · เส้น `/api/apply-forms`
 */
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { APP_DEPARTMENT_CODES } from '@/lib/departmentCodes';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { APPLY_FORM_FIELDS, STANDARD_APPLY_FORM_NAME, type ApplyForm, type ApplyFormField } from '@/lib/applyForms';
import { createApplyForm, deleteApplyForm, updateApplyForm, useApplyForms } from '@/lib/applyFormsApi';

type Draft = { id: number | null; name: string; departmentCodes: string[]; fields: ApplyFormField[] };
const EMPTY: Draft = { id: null, name: '', departmentCodes: [], fields: APPLY_FORM_FIELDS.map((f) => f.key) };
const FIELD_LABEL = new Map(APPLY_FORM_FIELDS.map((f) => [f.key, f.label]));

const ApplyFormsTab: React.FC = () => {
  const { forms, error, reload } = useApplyForms();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ApplyForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, ok: string): Promise<boolean> => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      await reload();
      setNotice({ ok: true, text: ok });
      return true;
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setDialogError(null);
    setBusy(true);
    try {
      const input = { name: draft.name, departmentCodes: draft.departmentCodes, fields: draft.fields };
      if (draft.id === null) await createApplyForm(input);
      else await updateApplyForm(draft.id, input);
      await reload();
      setNotice({ ok: true, text: draft.id === null ? 'เพิ่มฟอร์มแล้ว' : 'บันทึกแล้ว' });
      setDraft(null);
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Card variant="solid" className="max-w-4xl space-y-4 p-5" data-testid="apply-forms">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-medium text-foreground">แบบฟอร์มใบสมัคร</h3>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => {
            setDialogError(null);
            setDraft({ ...EMPTY });
          }}
          data-testid="apply-form-add"
        >
          <Plus aria-hidden /> เพิ่มฟอร์ม
        </Button>
      </div>

      {/* บรรทัดแจ้งผลจองที่ไว้ — กดแล้วตารางไม่ขยับ */}
      <p className={cn('min-h-5 text-sm', notice ? (notice.ok ? TONE.success.value : TONE.danger.value) : TONE.danger.value)} role="status">
        {notice?.text ?? error}
      </p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table className="min-w-[44rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">ฟอร์ม</TableHead>
              <TableHead className="text-xs">ใช้กับ BU</TableHead>
              <TableHead className="text-xs">ช่องเสริม</TableHead>
              <TableHead className="text-right text-xs">ลิงก์ที่ใช้</TableHead>
              <TableHead className="text-xs" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow data-testid="apply-form-row-standard">
              <TableCell className="text-sm font-medium">{STANDARD_APPLY_FORM_NAME}</TableCell>
              <TableCell className="text-sm text-muted-foreground">ทุก BU</TableCell>
              <TableCell className="text-sm text-muted-foreground">ไม่มี</TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
              <TableCell className="text-sm text-muted-foreground">ลบไม่ได้</TableCell>
            </TableRow>
            {forms === null ? (
              <TableRow>
                <TableCell colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                  กำลังโหลด…
                </TableCell>
              </TableRow>
            ) : null}
            {(forms ?? []).map((f) => (
              <TableRow key={f.id} className={cn(!f.active && 'text-muted-foreground')} data-testid="apply-form-row">
                <TableCell className="text-sm font-medium">
                  {f.name}
                  {f.active ? null : (
                    <Badge variant="secondary" className="ml-2 font-normal">
                      เลิกใช้แล้ว
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {f.departmentCodes.length === 0 ? (
                    <span className="text-muted-foreground">ทุก BU</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {f.departmentCodes.map((c) => (
                        <Badge key={c} variant="outline" className="font-normal">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-wrap gap-1">
                    {f.fields.map((k) => (
                      <Badge key={k} variant="outline" className="font-normal">
                        {FIELD_LABEL.get(k) ?? k}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{f.linkCount.toLocaleString('th-TH')}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setDialogError(null);
                        setDraft({ id: f.id, name: f.name, departmentCodes: f.departmentCodes, fields: f.fields });
                      }}
                    >
                      แก้ไข
                    </Button>
                    {f.linkCount === 0 ? (
                      <Button type="button" size="xs" variant="outline" disabled={busy} onClick={() => setConfirmDelete(f)}>
                        ลบ
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="xs"
                        variant={f.active ? 'outline' : 'default'}
                        disabled={busy}
                        onClick={() => void run(() => updateApplyForm(f.id, { active: !f.active }).then(() => undefined), f.active ? 'เลิกใช้แล้ว' : 'กลับมาใช้แล้ว')}
                      >
                        {f.active ? 'เลิกใช้' : 'กลับมาใช้'}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">ฟอร์มที่มีลิงก์ใช้อยู่ลบไม่ได้ กด "เลิกใช้" แทน ลิงก์เดิมยังเปิดได้</p>

      <Dialog open={draft !== null} onOpenChange={(v) => !v && !busy && setDraft(null)}>
        <DialogContent className="sm:max-w-lg" data-testid="apply-form-dialog">
          <DialogHeader>
            <DialogTitle>{draft?.id === null ? 'เพิ่มฟอร์ม' : 'แก้ไขฟอร์ม'}</DialogTitle>
            <DialogDescription className="sr-only">ตั้งชื่อ เลือก BU และช่องเสริมของฟอร์ม</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="apply-form-name">ชื่อฟอร์ม</Label>
                <Input
                  id="apply-form-name"
                  value={draft.name}
                  maxLength={80}
                  placeholder="เช่น ฟอร์มออกบูธ"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ใช้กับ BU (ไม่ติ๊ก = ทุก BU)</Label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {APP_DEPARTMENT_CODES.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draft.departmentCodes.includes(c)}
                        onCheckedChange={() => setDraft({ ...draft, departmentCodes: toggle(draft.departmentCodes, c) })}
                        aria-label={`BU ${c}`}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>ช่องเสริม (ผู้สมัครไม่ต้องกรอกทุกช่อง)</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {APPLY_FORM_FIELDS.map((f) => (
                    <label key={f.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draft.fields.includes(f.key)}
                        onCheckedChange={() => setDraft({ ...draft, fields: toggle(draft.fields, f.key) })}
                        aria-label={f.label}
                      />
                      {f.label}
                      {f.key === 'salary' ? <span className="text-xs text-muted-foreground">ต่ำสุด–สูงสุด</span> : null}
                    </label>
                  ))}
                </div>
              </div>
              <p className={cn('min-h-5 text-sm', TONE.danger.value)} role="alert">
                {dialogError}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(null)}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              disabled={busy || !draft?.name.trim() || (draft?.fields.length ?? 0) === 0}
              onClick={() => void save()}
              data-testid="apply-form-save"
            >
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>ฟอร์มนี้ยังไม่มีลิงก์ใช้ ลบแล้วกู้คืนไม่ได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const f = confirmDelete;
                setConfirmDelete(null);
                if (f) void run(() => deleteApplyForm(f.id), 'ลบฟอร์มแล้ว');
              }}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default ApplyFormsTab;
