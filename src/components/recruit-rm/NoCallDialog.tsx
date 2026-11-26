import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NO_CALL_BOX_LABEL, type NoCallReason } from '@/lib/applicantNoCall';

/**
 * ═══ ปุ่ม "ไม่โทร" — กดเหตุผลแล้วใบย้ายไปกล่องของเหตุผลนั้นทันที (เจ้าของ 26 พ.ย. 2569) ═══
 * ไม่มีส่วนจัดการเหตุผลในป๊อป (เจ้าของ "ทำไมต้องให้จัดการเหตุผลไรด้วย แค่กดไม่โทรก็ใส่เหตุผลแล้วก็ย้ายกล่องไปเลย")
 * ทุกเหตุผลมีกล่องของตัวเอง
 */
export default function NoCallDialog({
  names,
  reasons,
  busy,
  onPick,
  onClose,
}: {
  /** ชื่อคนที่ติ๊กไว้ · null = ปิดป๊อป */
  names: string[] | null;
  reasons: readonly NoCallReason[];
  busy: boolean;
  onPick: (reasonId: number) => void;
  onClose: () => void;
}) {
  const active = reasons.filter((r) => r.active);
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
      </DialogContent>
    </Dialog>
  );
}
