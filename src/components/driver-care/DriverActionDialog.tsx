import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import DateSelectDmyBe from '@/components/shared/DateSelectDmyBe';
import type {
  DriverActionLogInput,
  DriverActionResult,
  DriverActionStatus,
  DriverActionType,
  DriverIssueFound,
  DriverRiskListItem,
} from '@/types/driverCare';
import { DRIVER_ACTION_TYPE_LABELS } from '@/types/driverCare';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: DriverRiskListItem | null;
  saving: boolean;
  onSubmit: (input: DriverActionLogInput) => void;
};

const ACTION_TYPES = Object.keys(DRIVER_ACTION_TYPE_LABELS) as DriverActionType[];

const DriverActionDialog: React.FC<Props> = ({ open, onOpenChange, driver, saving, onSubmit }) => {
  const [actionType, setActionType] = React.useState<DriverActionType>('call');
  const [notReached, setNotReached] = React.useState(false);
  const [issueFound, setIssueFound] = React.useState<DriverIssueFound>('none');
  const [actionTaken, setActionTaken] = React.useState('');
  const [result, setResult] = React.useState<DriverActionResult>('pending');
  const [nextFollowUpDate, setNextFollowUpDate] = React.useState('');
  const [status, setStatus] = React.useState<DriverActionStatus>('pending');

  React.useEffect(() => {
    if (!open) return;
    setActionType('call');
    setNotReached(false);
    setIssueFound('none');
    setActionTaken('');
    setResult('pending');
    setNextFollowUpDate('');
    setStatus('pending');
  }, [open, driver?.employeeId]);

  const handleNotReachedChange = (checked: boolean) => {
    setNotReached(checked);
    if (checked) {
      setIssueFound('none');
      setResult('not_reached');
      setStatus('in_progress');
      if (!actionTaken.trim()) {
        setActionTaken('ติดต่อไม่ได้ — รอติดตามครั้งถัดไป');
      }
    } else {
      setResult('pending');
      setStatus('pending');
      if (actionTaken.trim() === 'ติดต่อไม่ได้ — รอติดตามครั้งถัดไป') {
        setActionTaken('');
      }
    }
  };

  const canSubmit = notReached
    ? true
    : actionTaken.trim().length > 0;

  if (!driver) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">บันทึก Action — {driver.driverName}</DialogTitle>
          <DialogDescription className="sr-only">ฟอร์มบันทึกการติดตามคนขับ</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3 mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            const note = actionTaken.trim()
              || (notReached ? 'ติดต่อไม่ได้ — รอติดตามครั้งถัดไป' : '');
            onSubmit({
              employeeId: driver.employeeId,
              riskScoreId: driver.riskScoreId,
              actionType,
              contactStatus: notReached ? 'not_reached' : 'contacted',
              issueFound: notReached ? 'none' : issueFound,
              actionTaken: note,
              result: notReached ? 'not_reached' : result,
              nextFollowUpDate: nextFollowUpDate || undefined,
              status: notReached ? 'in_progress' : status,
            });
          }}
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเภท Action</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as DriverActionType)}
              className="jarvis-soft-field"
            >
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>{DRIVER_ACTION_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <label
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors',
              notReached
                ? 'border-amber-400/70 bg-amber-500/10'
                : 'border-white/70 bg-white/40 hover:bg-white/55',
            )}
          >
            <Checkbox
              checked={notReached}
              onCheckedChange={(v) => handleNotReachedChange(v === true)}
              className="mt-0.5"
              id="driver-action-not-reached"
            />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground block">ติดต่อไม่ได้</span>
              <span className="text-xs text-muted-foreground">
                เลือกเมื่อโทร/นัดแล้วติดต่อคนขับไม่ได้ — บันทึกแบบย่อและนัดติดตามใหม่
              </span>
            </div>
          </label>

          {notReached ? (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  หมายเหตุ (ไม่บังคับ)
                </label>
                <textarea
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  rows={2}
                  className="jarvis-soft-field min-h-[56px] resize-y"
                  placeholder="เช่น โทร 3 ครั้งไม่รับ, ส่งข้อความแล้ว"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  นัดติดตามครั้งถัดไป (แนะนำ)
                </label>
                <DateSelectDmyBe value={nextFollowUpDate} onChange={setNextFollowUpDate} allowEmpty />
              </div>
              <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
                ระบบจะบันทึกผลลัพธ์เป็น &quot;ติดต่อไม่ได้&quot; และสถานะ &quot;กำลังติดตาม&quot; อัตโนมัติ
              </p>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเด็นที่พบ</label>
                <select
                  value={issueFound}
                  onChange={(e) => setIssueFound(e.target.value as DriverIssueFound)}
                  className="jarvis-soft-field"
                >
                  <option value="none">ไม่มี</option>
                  <option value="income_drop">รายได้ลด</option>
                  <option value="ot_drop">OT ลด</option>
                  <option value="leave_issue">ปัญหาการลา</option>
                  <option value="attendance_issue">มาสาย/ขาดงาน</option>
                  <option value="client_issue">ปัญหาลูกค้า</option>
                  <option value="supervisor_issue">ปัญหาหัวหน้างาน</option>
                  <option value="personal_issue">ปัญหาส่วนตัว</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">สิ่งที่ดำเนินการ</label>
                <textarea
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  rows={3}
                  required
                  className="jarvis-soft-field min-h-[72px] resize-y"
                  placeholder="สรุปการโทร/นัดพบ/ตรวจสอบ..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ผลลัพธ์</label>
                  <select
                    value={result}
                    onChange={(e) => setResult(e.target.value as DriverActionResult)}
                    className="jarvis-soft-field"
                  >
                    <option value="pending">รอผล</option>
                    <option value="stay">อยู่ต่อ</option>
                    <option value="unsure">ยังไม่ชัด</option>
                    <option value="confirmed_resign">ยืนยันลาออก</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะเคส</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DriverActionStatus)}
                    className="jarvis-soft-field"
                  >
                    <option value="pending">รอดำเนินการ</option>
                    <option value="in_progress">กำลังติดตาม</option>
                    <option value="closed">ปิดเคส</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  นัดติดตามครั้งถัดไป (ไม่บังคับ)
                </label>
                <DateSelectDmyBe value={nextFollowUpDate} onChange={setNextFollowUpDate} allowEmpty />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="w-full py-2.5 jarvis-pill-btn text-sm disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึก Action'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DriverActionDialog;
