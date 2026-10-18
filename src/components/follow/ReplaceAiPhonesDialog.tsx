import React, { useEffect, useMemo, useState } from 'react';
import { Bot } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import { aiPhonesToText, parseAiPhoneLines, replacePhoneKey, type ReplaceAiPhone } from '@/lib/irecruitReplaceSync';
import { setReplaceAiPhones } from '@/lib/irecruitReplaceSyncApi';
import { formatYmdTh, toYmdBangkok } from '@/lib/dateTh';
import { friendlyErrorText } from '@/lib/friendlyError';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

export type ReplaceAiPhonesState = {
  aiPhones: ReplaceAiPhone[];
  aiPhonesWorkYmd: string | null;
  /** บันทึกแล้วแต่ตัวดึงยังไม่ได้สลับสาย (ธง `aiPhonesApplyPending`) */
  pending: boolean;
};

const ALL_DAYS = 'all';

function plusDaysYmd(days: number): string {
  return toYmdBangkok(new Date(Date.now() + days * 86_400_000));
}

/**
 * ═══ รายชื่อให้ AI โทร ของแท็บส่งคนแทน (เจ้าของเลือกทำ 18 ต.ค. 2569 — เดิมตั้งในฐานข้อมูลตรง ๆ) ═══
 * วางรายชื่อแบบที่ส่งกันในแชตได้เลย บรรทัดละคน เบอร์ที่สอง = เบอร์ฉุกเฉิน · เลือกใช้กับงานวันไหน (หรือทุกวัน)
 * บันทึกแล้วตัวดึงทุก 5 นาทีสลับสายที่ยังไม่ถึงเวลาของคนในรายชื่อเป็น AI ครั้งเดียว (`applyReplaceAiPhonesToPending`)
 * หัวหน้างานขึ้นไป (server กันอีกชั้น)
 */
const ReplaceAiPhonesDialog: React.FC<{
  value: ReplaceAiPhonesState;
  /** ชื่อคนไปแทนจากรายการในแท็บ — ให้เห็นว่าเบอร์ไหนเป็นใคร */
  nameOfPhone: (phone: string) => string | null;
  onSaved: (v: ReplaceAiPhonesState) => void;
}> = ({ value, nameOfPhone, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [day, setDay] = useState<string>(ALL_DAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setText(aiPhonesToText(value.aiPhones));
    setDay(value.aiPhonesWorkYmd ?? ALL_DAYS);
    setError(null);
  }, [open, value]);

  const parsed = useMemo(() => parseAiPhoneLines(text), [text]);

  const dayOptions = useMemo(() => {
    const days = [0, 1, 2].map((n) => plusDaysYmd(n));
    const label = ['วันนี้', 'พรุ่งนี้', 'มะรืน'];
    const opts = [
      { value: ALL_DAYS, label: 'ทุกวัน' },
      ...days.map((ymd, i) => ({ value: ymd, label: `${label[i]} ${formatYmdTh(ymd)}` })),
    ];
    if (value.aiPhonesWorkYmd && !days.includes(value.aiPhonesWorkYmd)) {
      opts.push({ value: value.aiPhonesWorkYmd, label: formatYmdTh(value.aiPhonesWorkYmd) });
    }
    return opts;
  }, [value.aiPhonesWorkYmd]);

  const save = async () => {
    if (parsed.bad.length > 0) {
      setError(`มี ${parsed.bad.length} บรรทัดที่ไม่มีเบอร์มือถือ แก้หรือลบออกก่อน`);
      return;
    }
    setBusy(true);
    try {
      const st = await setReplaceAiPhones({ aiPhones: parsed.phones, aiPhonesWorkYmd: day === ALL_DAYS ? null : day });
      onSaved({ aiPhones: st.rule.aiPhones, aiPhonesWorkYmd: st.rule.aiPhonesWorkYmd, pending: st.rule.aiPhonesApplyPending });
      toast.success(`บันทึก ${st.rule.aiPhones.length} คนแล้ว · ระบบเปลี่ยนสายให้ภายใน 5 นาที`);
      setOpen(false);
    } catch (e) {
      setError(friendlyErrorText(e, 'บันทึกไม่สำเร็จ'));
    } finally {
      setBusy(false);
    }
  };

  const dayText = value.aiPhonesWorkYmd ? formatYmdTh(value.aiPhonesWorkYmd) : 'ทุกวัน';

  return (
    <>
      <Button type="button" variant="outline" size="xs" onClick={() => setOpen(true)} data-testid="replace-ai-phones-open">
        <Bot aria-hidden />
        รายชื่อ AI โทร {value.aiPhones.length}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>รายชื่อให้ AI โทร</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>ตอนนี้ {value.aiPhones.length} คน · {dayText}</span>
              {value.pending ? <Badge variant="outline">รอระบบเปลี่ยนสาย</Badge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">ใช้กับงานวันที่</span>
              <ChoiceDropdown<string> value={day} options={dayOptions} onChange={setDay} ariaLabel="ใช้กับงานวันที่" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="replace-ai-phones-text" className="text-xs font-medium text-muted-foreground">
                บรรทัดละคน · เบอร์ที่สองคือเบอร์ฉุกเฉิน
              </label>
              <Textarea
                id="replace-ai-phones-text"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                rows={6}
                placeholder={'สมชาย 0812345678 ฉุกเฉิน 0898765432\n0823456789'}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">อ่านได้ {parsed.phones.length} คน</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2 text-xs" data-testid="replace-ai-phones-preview">
                {parsed.phones.length === 0 ? <li className="text-muted-foreground">ไม่มีรายชื่อ</li> : null}
                {parsed.phones.map((p) => (
                  <li key={p.phone} className="flex flex-wrap items-center gap-x-2 tabular-nums">
                    <span className="font-medium">{nameOfPhone(p.phone) ?? 'ไม่เจอในรายการส่งคนแทน'}</span>
                    <span>{p.phone}</span>
                    <span className="text-muted-foreground">{p.emergency ? `ฉุกเฉิน ${p.emergency}` : 'ไม่มีเบอร์ฉุกเฉิน'}</span>
                  </li>
                ))}
                {parsed.bad.map((line, i) => (
                  <li key={`bad-${i}`} className={cn('break-all', TONE.danger.value)}>
                    อ่านไม่ออก: {line}
                  </li>
                ))}
              </ul>
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ปิด
            </Button>
            <Button type="button" onClick={() => void save()} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/** ชื่อคนไปแทนจากแถวในแท็บ — เทียบด้วยเบอร์ 9 หลักท้าย (081… / +6681… เป็นคนเดียวกัน) */
export function buildReplaceNameOfPhone(rows: readonly { recipient_phone?: string | null; recipient_name?: string | null }[]) {
  const map = new Map<string, string>();
  for (const r of rows) {
    const k = replacePhoneKey(r.recipient_phone);
    const name = (r.recipient_name ?? '').trim();
    if (k && name && !map.has(k)) map.set(k, name);
  }
  return (phone: string) => {
    const k = replacePhoneKey(phone);
    return k ? map.get(k) ?? null : null;
  };
}

export default ReplaceAiPhonesDialog;
