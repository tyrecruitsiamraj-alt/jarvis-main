/**
 * ═══ กล่องหนึ่งช่องของป๊อปประกาศหน้าเดียว (เจ้าของ 6 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"แยกกล่องให้ใส่แบบนี้ … รายได้ · รายได้รวม · สวัสดิการ · เพศ · อายุ · สถานที่ปฏิบัติงาน · ทุกหน้ามีปุ่มข้าง
 * เพื่อกดแล้วเด้ง Popup ให้ดูได้แต่จะไม่เอารายละเอียดตามนั้นก็ได้ … มีหน้าเดียวแค่ใส่รายละเอียด กับ Genlink จบๆเลย"*
 * → Choice "ทำเลย"
 *
 * กล่องหนึ่ง = ชื่อช่อง · ค่าที่ผู้สมัครเห็น (ว่าง = แดง) · ปุ่ม "ใบขอ" (ดูค่าของ ERP อย่างเดียว) · ปุ่ม "แก้" (กางฟอร์มในกล่อง)
 * 🔴 ป๊อปนี้อยู่ใน Dialog แล้ว — ห้ามซ้อน Dialog ⇒ ปุ่ม "ใบขอ" ใช้ Popover · ไม่มีปุ่มนี้ถ้าใบขอไม่มีข้อมูลช่องนั้น (ห้ามปุ่มตาย)
 * ฟอร์มวาดเฉพาะตอนกาง — ปิดแล้วเปิดใหม่ = อ่านค่าล่าสุดเสมอ (ฟอร์มถือ state ของตัวเองตั้งแต่ตอนเปิด)
 */
import React from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { saveUnitFieldOverridesPatch, unitRequestNoteKey } from '@/lib/siamrajUnitRequestsApi';
import { buildIncomeDisplay } from '@/lib/incomeBreakdown';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';

export function PostingFieldBox({
  title,
  value,
  missing = false,
  erp,
  editor,
  open,
  onOpenChange,
  testId,
}: {
  title: string;
  /** ค่าที่ผู้สมัครเห็นตอนนี้ */
  value: React.ReactNode;
  /** ช่องนี้ยังขาด (ตัวตัดสินเดียวกับชิปบนการ์ด) — ขึ้นแดง */
  missing?: boolean;
  /** ค่าในใบขอ ERP — `null` = ใบขอไม่มีข้อมูลช่องนี้ ⇒ ไม่มีปุ่ม */
  erp: React.ReactNode | null;
  editor: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testId?: string;
}) {
  return (
    <Card className={cn('space-y-3 p-4', missing && TONE.danger.soft)} data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <div className={cn('break-words text-sm', missing ? TONE.danger.value : 'text-foreground')}>
            {missing ? 'ยังไม่ได้ใส่' : value}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {erp !== null ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" size="xs" variant="ghost" aria-label={`${title} ตามใบขอ`}>
                  <FileText aria-hidden />
                  ใบขอ
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="max-h-96 w-80 overflow-y-auto text-sm">
                <p className="mb-2 text-xs text-muted-foreground">{title} ตามใบขอ</p>
                {erp}
              </PopoverContent>
            </Popover>
          ) : null}
          <Button
            type="button"
            size="xs"
            variant={open ? 'default' : 'outline'}
            aria-expanded={open}
            onClick={() => onOpenChange(!open)}
          >
            {open ? 'เสร็จ' : 'แก้'}
          </Button>
        </div>
      </div>
      {open ? <div className="border-t border-border/60 pt-3">{editor}</div> : null}
    </Card>
  );
}

const NUM = new Intl.NumberFormat('th-TH');

/**
 * กล่อง "รายได้รวม" — ยอดเดียว · มีรายการรายได้อยู่แล้ว = ปรับยอดรวมของรายการ (`income.total`) ·
 * ยังไม่มีรายการ = ยอดเดี่ยวแบบเดิม (`total_income`) · ว่าง = ล้าง (ใช้ผลบวกของรายการ)
 * บันทึกผ่าน `saveUnitFieldOverridesPatch` (อ่านของล่าสุดก่อนต่อ ไม่ทับช่องอื่น)
 */
export function TotalIncomeField({ job, onSaved }: { job: JobRequest; onSaved: (patch: Partial<JobRequest>) => void }) {
  const fo = job.field_overrides;
  const init = fo?.income?.total ?? (typeof fo?.total_income === 'number' ? fo.total_income : null);
  const [text, setText] = React.useState(init != null ? String(init) : '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const n = text.trim() === '' ? null : Math.trunc(Number(text.replace(/[^\d]/g, ''))) || null;
  const dirty = n !== init;

  const save = async () => {
    const requestNo = unitRequestNoteKey(job);
    if (!requestNo) {
      setError('ใบขอนี้ไม่มีเลขที่ใบขอ บันทึกไม่ได้');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const patch = fo?.income && fo.income.lines.length > 0 ? { income: { ...fo.income, total: n } } : { total_income: n };
      const next = await saveUnitFieldOverridesPatch(requestNo, patch);
      const display = next.income ? buildIncomeDisplay(next.income) : null;
      onSaved({
        field_overrides: next as JobRequest['field_overrides'],
        ...(display ? { income_display: display } : {}),
        ...('total_income' in patch ? { total_income: n ?? undefined } : {}),
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-36">
        <Input
          aria-label="รายได้รวม"
          className="text-right tabular-nums"
          inputMode="numeric"
          placeholder="บาท"
          value={text}
          onChange={(e) => {
            setText(e.target.value.replace(/[^\d]/g, ''));
            setSaved(false);
          }}
        />
      </div>
      <span className="text-sm text-muted-foreground">บาท/เดือน</span>
      <Button type="button" size="sm" variant="outline" disabled={busy || !dirty} onClick={() => void save()}>
        {busy ? 'กำลังบันทึก…' : 'บันทึก'}
      </Button>
      {saved ? <span className={cn('text-sm', TONE.success.value)}>บันทึกแล้ว {n != null ? NUM.format(n) : ''}</span> : null}
      {error ? (
        <span role="alert" className={cn('text-sm', TONE.danger.value)}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
