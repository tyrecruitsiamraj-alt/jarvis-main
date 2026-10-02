import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import TimeSelect24 from '@/components/shared/TimeSelect24';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { normalizeReplaceCallRule, type ReplaceCallRule } from '@/lib/irecruitReplaceSync';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { fetchReplaceSyncStatus, runReplaceSyncNow, saveReplaceCallRule, type ReplaceSyncStatus } from '@/lib/irecruitReplaceSyncApi';

/**
 * ═══ แถบ "ดึงจาก iRecruit" บนแท็บติดตามส่งคนแทน (เจ้าของเคาะ 2 ต.ค. 2569: ดึงเองทุกเช้า · เวลาโทรตั้งได้ · AI โทรเลย) ═══
 *
 * บรรทัดเดียว: ดึงล่าสุดเมื่อไหร่ ได้อะไรมา · โทรเวลาไหน · ปุ่มแก้เวลาโทร / ดึงตอนนี้ (หัวหน้างานขึ้นไป)
 * - ไม่มีประโยคอธิบาย (กติกาหน้าติดตาม) · ว่าง = "ยังไม่เคยดึง" ไม่ใช่หาย
 * - แถบนี้เป็นของแท็บส่งคนแทนอย่างเดียว — ข้อยกเว้นเดียวของกติกา "สองแท็บเหมือนกัน" เพราะเจ้าของสั่งดึงรายชื่อให้แท็บนี้โดยตรง
 */
const DMY_HM = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const NUM = new Intl.NumberFormat('th-TH');

const DAY_OFFSET_LABEL: Record<'0' | '-1' | '-2', string> = {
  '0': 'วันเข้างาน',
  '-1': 'วันก่อนเข้างาน',
  '-2': 'สองวันก่อนเข้างาน',
};

function RuleEditor({ rule, onSaved }: { rule: ReplaceCallRule; onSaved: (s: ReplaceSyncStatus) => void }) {
  const [open, setOpen] = React.useState(false);
  const [dayOffset, setDayOffset] = React.useState<string>(String(rule.dayOffset));
  const [time, setTime] = React.useState(rule.time);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDayOffset(String(rule.dayOffset));
    setTime(rule.time);
    setError(null);
  }, [open, rule]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // ส่งแค่วัน+เวลา — "AI เริ่มโทรตั้งแต่" คงค่าเดิมที่ server
      const { dayOffset: d, time: t } = normalizeReplaceCallRule({ dayOffset: Number(dayOffset), time });
      onSaved(await saveReplaceCallRule({ dayOffset: d, time: t }));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="xs" variant="outline">
          แก้เวลาโทร
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="replace-call-day" className="text-xs font-normal text-muted-foreground">
            โทรวันไหน
          </Label>
          <Select value={dayOffset} onValueChange={setDayOffset}>
            <SelectTrigger id="replace-call-day" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(DAY_OFFSET_LABEL) as Array<keyof typeof DAY_OFFSET_LABEL>).map((k) => (
                <SelectItem key={k} value={k}>
                  {DAY_OFFSET_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">เวลา</p>
          {/* 🔴 ห้าม <input type="time"> (ขึ้นกับภาษาเครื่อง) — ใช้ TimeSelect24 ตัวกลาง */}
          <TimeSelect24 value={time} onChange={setTime} disabled={busy} label="เวลาโทร" className="min-h-9" />
        </div>
        {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" size="xs" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button type="button" size="xs" onClick={() => void save()} disabled={busy || !/^\d{1,2}:\d{2}$/.test(time)}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function IrecruitReplaceSyncBar({ canManage, onSynced }: { canManage: boolean; onSynced: () => void }) {
  const [status, setStatus] = React.useState<ReplaceSyncStatus | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [runError, setRunError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setStatus(await fetchReplaceSyncStatus());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'อ่านสภาพการดึงไม่สำเร็จ');
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const runNow = async () => {
    setBusy(true);
    setRunError(null);
    try {
      const next = await runReplaceSyncNow();
      setStatus(next);
      if (next.summary.added > 0) onSynced();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'ดึงไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const last = status?.lastRun ?? null;
  const problem = runError ?? status?.unavailableReason ?? last?.error ?? loadError ?? (status && !status.tableReady ? 'ฐานยังไม่พร้อม (รอ migrate)' : null);

  return (
    <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3 text-sm" data-testid="irecruit-replace-sync">
      <span className="font-medium text-foreground">iRecruit</span>
      <span className={DASH.muted}>
        {!status && !loadError
          ? 'กำลังอ่าน…'
          : last
            ? `ดึงล่าสุด ${DMY_HM.format(new Date(last.at))} · เพิ่ม ${NUM.format(last.added)} · มีแล้ว ${NUM.format(last.alreadyIn)}${
                last.noPhone > 0 ? ` · ไม่มีเบอร์ ${NUM.format(last.noPhone)}` : ''
              }${last.queued > 0 ? ` · ส่ง AI ${NUM.format(last.queued)}` : ''}`
            : 'ยังไม่เคยดึง'}
      </span>
      {status ? (
        <span className={DASH.muted}>
          · โทร <span className="text-foreground">{status.ruleText}</span>
          {status.enabled ? ` · ดึงเองทุกวัน ${String(status.hour).padStart(2, '0')}:00` : ' · ปิดดึงอัตโนมัติอยู่'}
          {status.rule.aiFrom ? (
            <>
              {' · '}
              <span className="text-foreground">AI เริ่มโทร {formatYmdDmyBe(status.rule.aiFrom)}</span> (ก่อนหน้านั้นคนโทร)
            </>
          ) : null}
        </span>
      ) : null}
      {problem ? <span className={cn('text-xs', TONE.warn.value)}>· {problem}</span> : null}
      {canManage && status ? (
        <span className="ml-auto flex items-center gap-2">
          <RuleEditor rule={status.rule} onSaved={setStatus} />
          <Button type="button" size="xs" variant="outline" disabled={busy || status.running || Boolean(status.unavailableReason)} onClick={() => void runNow()}>
            {busy || status.running ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            {busy || status.running ? 'กำลังดึง…' : 'ดึงตอนนี้'}
          </Button>
        </span>
      ) : null}
    </Card>
  );
}
