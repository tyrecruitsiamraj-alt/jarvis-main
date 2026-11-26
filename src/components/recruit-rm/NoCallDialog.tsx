import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NO_CALL_BOXES, NO_CALL_BOX_LABEL, type NoCallBox, type NoCallReason } from '@/lib/applicantNoCall';
import { createNoCallReason, updateNoCallReason } from '@/lib/applicantNoCallApi';
import { friendlyErrorText } from '@/lib/friendlyError';

/**
 * ═══ ปุ่ม "ไม่โทร" — เลือกเหตุผลแล้วใบย้ายไปกล่องของเหตุผลนั้น (เจ้าของ 26 พ.ย. 2569) ═══
 * Supervisor ขึ้นไปเพิ่มเหตุผล / เลิกใช้ได้ในป๊อปเดียวกัน (เหตุผลที่ไปกล่องของตัวเอง = มีกล่องใหม่บนแท็บผู้สมัคร)
 */
export default function NoCallDialog({
  names,
  reasons,
  canManage,
  busy,
  onPick,
  onClose,
  onReasonsChanged,
}: {
  /** ชื่อคนที่ติ๊กไว้ · null = ปิดป๊อป */
  names: string[] | null;
  reasons: readonly NoCallReason[];
  canManage: boolean;
  busy: boolean;
  onPick: (reasonId: number) => void;
  onClose: () => void;
  onReasonsChanged: () => void;
}) {
  const [label, setLabel] = useState('');
  const [box, setBox] = useState<NoCallBox>('own');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const active = reasons.filter((r) => r.active);
  const run = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await fn();
      onReasonsChanged();
    } catch (e) {
      setError(friendlyErrorText(e, 'บันทึกเหตุผลไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  };
  const shown = names ?? [];
  return (
    <Dialog open={names !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="no-call-dialog">
        <DialogHeader>
          <DialogTitle>ไม่โทร {shown.length.toLocaleString('th-TH')} คน</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {shown.slice(0, 3).join(', ')}
          {shown.length > 3 ? ` และอีก ${shown.length - 3} คน` : ''}
        </p>
        <div className="space-y-2" role="group" aria-label="เหตุผลที่ไม่โทร">
          {active.map((r) => (
            <Button
              key={r.id}
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onPick(r.id)}
              className="w-full justify-between"
              data-testid={`no-call-reason-${r.id}`}
            >
              <span>{r.label}</span>
              {r.box !== 'own' ? <span className="text-xs text-muted-foreground">ไปกล่อง {NO_CALL_BOX_LABEL[r.box]}</span> : null}
            </Button>
          ))}
          {active.length === 0 ? <p className="text-sm text-muted-foreground">ยังไม่มีเหตุผล</p> : null}
        </div>
        {canManage ? (
          <div className="space-y-2 border-t border-border pt-3" data-testid="no-call-manage">
            <p className="text-sm font-medium text-foreground">จัดการเหตุผล</p>
            <div className="flex flex-wrap gap-2">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ไม่สะดวกเดินทาง" className="min-w-0 flex-1" maxLength={80} />
              <Select value={box} onValueChange={(v) => setBox(v as NoCallBox)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NO_CALL_BOXES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b === 'own' ? 'กล่องใหม่' : `กล่อง ${NO_CALL_BOX_LABEL[b]}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={saving || !label.trim()}
                onClick={() => void run(async () => {
                  await createNoCallReason(label.trim(), box);
                  setLabel('');
                  setBox('own');
                })}
              >
                เพิ่ม
              </Button>
            </div>
            <ul className="space-y-1">
              {reasons.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className={r.active ? 'text-foreground' : 'text-muted-foreground line-through'}>{r.label}</span>
                  <Button type="button" size="xs" variant="ghost" disabled={saving} onClick={() => void run(() => updateNoCallReason(r.id, { active: !r.active }))}>
                    {r.active ? 'เลิกใช้' : 'ใช้ต่อ'}
                  </Button>
                </li>
              ))}
            </ul>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
