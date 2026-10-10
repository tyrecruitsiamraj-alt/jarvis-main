import React, { useState } from 'react';
import { LoaderCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { formatYmdDmyBe, toYmdBangkok } from '@/lib/dateTh';
import { friendlyErrorText } from '@/lib/friendlyError';
import { addAftercareContact, fetchAftercareHistory } from '@/lib/aftercareApi';
import {
  AFTERCARE_RESULTS,
  AFTERCARE_RESULT_LABEL,
  AFTERCARE_RESULT_TONE,
  type AftercareContact,
  type AftercareResult,
} from '@/lib/aftercareContact';

/**
 * กดโทร + ลงผลบนแถวของหน้าดูแลหลังเริ่มงาน (เจ้าของ 10 ต.ค. 2569 *"ทำคล้ายๆกับหน้าแท็บ การติดต่อ … กดโทรแล้วใส่ผล"*)
 * ผล 4 แบบ (Choice เจ้าของ) + หมายเหตุ · ทุกครั้งเก็บเป็นประวัติ · ฝังในแถว (ไม่เปิดป๊อปซ้อน)
 */
const when = (iso: string) => {
  const d = new Date(iso);
  return `${formatYmdDmyBe(toYmdBangkok(d))} ${d.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} น.`;
};

export const AftercareResultChip: React.FC<{ contact: AftercareContact }> = ({ contact }) => (
  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', TONE[AFTERCARE_RESULT_TONE[contact.result]].outline)}>
    {AFTERCARE_RESULT_LABEL[contact.result]}
  </span>
);

const AftercareContactPanel: React.FC<{
  phone: string;
  lastContact: AftercareContact | null | undefined;
  contactCount: number;
  disabled?: boolean;
  onSaved: (c: AftercareContact) => void;
}> = ({ phone, lastContact, contactCount, disabled, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AftercareResult | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<AftercareContact[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const save = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const saved = await addAftercareContact({ phone, result, note: note.trim() || null });
      toast.success(`ลงผลแล้ว: ${AFTERCARE_RESULT_LABEL[saved.result]}`);
      setOpen(false);
      setResult(null);
      setNote('');
      setHistory((h) => (h ? [saved, ...h] : h));
      onSaved(saved);
    } catch (e) {
      toast.error(friendlyErrorText(e, 'ลงผลไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  };

  const toggleHistory = async () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && history === null) {
      setHistoryLoading(true);
      try {
        setHistory(await fetchAftercareHistory(phone));
      } catch (e) {
        toast.error(friendlyErrorText(e, 'โหลดประวัติไม่สำเร็จ'));
        setHistoryOpen(false);
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  return (
    <div className="mt-2 space-y-2" data-testid="aftercare-contact">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <a href={`tel:${phone}`} aria-label="โทร">
            <Phone aria-hidden />
            โทร
          </a>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={open ? 'secondary' : 'outline'}
          className="rounded-full"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          ลงผล
        </Button>
        {lastContact ? (
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            ล่าสุด <AftercareResultChip contact={lastContact} />
            {when(lastContact.created_at)}
            {lastContact.created_by_name ? ` · ${lastContact.created_by_name}` : ''}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">ยังไม่เคยลงผล</span>
        )}
        {contactCount > 0 ? (
          <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => void toggleHistory()}>
            {historyOpen ? 'ซ่อนประวัติ' : `ประวัติ ${contactCount.toLocaleString('th-TH')} ครั้ง`}
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/30 p-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ผลการโทร">
            {AFTERCARE_RESULTS.map((r) => (
              <Button
                key={r}
                type="button"
                size="sm"
                role="radio"
                aria-checked={result === r}
                variant="outline"
                className={cn('rounded-full', result === r ? TONE[AFTERCARE_RESULT_TONE[r]].outline : '')}
                onClick={() => setResult(r)}
              >
                {AFTERCARE_RESULT_LABEL[r]}
              </Button>
            ))}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="หมายเหตุ (ถ้ามี)"
            rows={2}
            maxLength={2000}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={!result || saving} onClick={() => void save()}>
              {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              บันทึกผล
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        historyLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
            กำลังโหลดประวัติ…
          </p>
        ) : (
          <ul className="space-y-1" data-testid="aftercare-history">
            {(history ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <AftercareResultChip contact={c} />
                <span>{when(c.created_at)}</span>
                {c.created_by_name ? <span>· {c.created_by_name}</span> : null}
                {c.note ? <span className="w-full pl-1 text-foreground">{c.note}</span> : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
};

export default AftercareContactPanel;
