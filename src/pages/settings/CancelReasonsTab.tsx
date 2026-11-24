/**
 * ═══ ตั้งค่า › เหตุผลยกเลิกใบขอ (เจ้าของ 24 พ.ย. 2569) ═══
 * รายการกลางที่ทีมเลือกตอนใส่เหตุผลบนใบที่ยกเลิก (หน้า Dashboard กดเลขยกเลิก) · Admin เท่านั้น
 * ตั้งต้นด้วย 11 ข้อของ ERP (ชื่อตาม ERP แก้ไม่ได้) · เพิ่มข้อใหม่ได้ · ลบไม่ได้ เลิกใช้แทน (ใบเก่ายังอ้างอยู่)
 * ติ๊ก "นับว่าได้คนแล้ว" = ตอนกดเลขยกเลิก ใบเหตุผลนี้ไปอยู่กลุ่มได้คนแล้ว · ตัวคิด `src/lib/requestCancelReason.ts`
 */
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { CancelReasonMaster } from '@/lib/requestCancelReason';
import { createCancelReason, updateCancelReason, useCancelReasons } from '@/lib/requestCancelReasonsApi';

const CancelReasonsTab: React.FC = () => {
  const { data, error, reload } = useCancelReasons();
  const [label, setLabel] = useState('');
  const [gotPerson, setGotPerson] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const usage = new Map<number, number>();
  for (const t of data?.tags ?? []) usage.set(t.reasonId, (usage.get(t.reasonId) ?? 0) + 1);

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      await reload();
      setNotice({ ok: true, text: ok });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' });
    } finally {
      setBusy(null);
    }
  };

  const rename = (m: CancelReasonMaster, next: string) => {
    const v = next.trim();
    if (!v || v === m.label) return;
    void run(`name-${m.id}`, () => updateCancelReason(m.id, { label: v }), 'เปลี่ยนชื่อแล้ว');
  };

  return (
    <Card variant="solid" className="max-w-4xl space-y-4 p-5" data-testid="cancel-reasons">
      <h3 className="text-lg font-medium text-foreground">เหตุผลยกเลิกใบขอ</h3>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1 space-y-1">
          <Label htmlFor="cancel-reason-new">เพิ่มเหตุผล</Label>
          <Input id="cancel-reason-new" value={label} maxLength={80} placeholder="เช่น ย้ายคนจากไซต์อื่น" onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="flex h-10 items-center gap-2">
          <Checkbox id="cancel-reason-new-got" checked={gotPerson} onCheckedChange={(v) => setGotPerson(v === true)} />
          <Label htmlFor="cancel-reason-new-got" className="font-normal">
            นับว่าได้คนแล้ว
          </Label>
        </div>
        <Button
          type="button"
          disabled={!label.trim() || busy !== null}
          onClick={() =>
            void run(
              'new',
              async () => {
                await createCancelReason(label.trim(), gotPerson);
                setLabel('');
                setGotPerson(false);
              },
              'เพิ่มเหตุผลแล้ว',
            )
          }
          data-testid="cancel-reason-add"
        >
          เพิ่มเหตุผล
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
              <TableHead className="text-xs">เหตุผล</TableHead>
              <TableHead className="text-xs">มาจาก</TableHead>
              <TableHead className="text-xs">นับว่าได้คนแล้ว</TableHead>
              <TableHead className="text-right text-xs">ทีมใส่บนใบ</TableHead>
              <TableHead className="text-xs">ใช้อยู่ไหม</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data ? (
              <TableRow>
                <TableCell colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                  กำลังโหลด…
                </TableCell>
              </TableRow>
            ) : data.reasons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                  ยังไม่มีเหตุผล
                </TableCell>
              </TableRow>
            ) : null}
            {(data?.reasons ?? []).map((m) => (
              <TableRow key={m.id} className={cn(!m.active && 'text-muted-foreground')} data-testid="cancel-reason-row">
                <TableCell className="min-w-56 text-sm">
                  {m.erpCode ? (
                    m.label
                  ) : (
                    <Input
                      key={m.label}
                      defaultValue={m.label}
                      maxLength={80}
                      aria-label={`ชื่อเหตุผล ${m.label}`}
                      disabled={busy !== null}
                      onBlur={(e) => rename(m, e.target.value)}
                    />
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{m.erpCode ? <Badge variant="outline">ERP {m.erpCode}</Badge> : <Badge variant="secondary">ทีมเพิ่ม</Badge>}</TableCell>
                <TableCell>
                  <Switch
                    checked={m.gotPerson}
                    disabled={busy !== null}
                    aria-label={`${m.label} นับว่าได้คนแล้ว`}
                    onCheckedChange={(v) => void run(`got-${m.id}`, () => updateCancelReason(m.id, { gotPerson: v }), 'บันทึกแล้ว')}
                  />
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{(usage.get(m.id) ?? 0).toLocaleString('th-TH')} ใบ</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="inline-block w-20 text-sm">{m.active ? 'ใช้อยู่' : 'เลิกใช้แล้ว'}</span>
                  <Button
                    type="button"
                    size="xs"
                    variant={m.active ? 'outline' : 'default'}
                    disabled={busy !== null}
                    onClick={() => void run(`active-${m.id}`, () => updateCancelReason(m.id, { active: !m.active }), m.active ? 'เลิกใช้แล้ว' : 'กลับมาใช้แล้ว')}
                  >
                    {m.active ? 'เลิกใช้' : 'กลับมาใช้'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default CancelReasonsTab;
