import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DateSelectDmyBe from '@/components/shared/DateSelectDmyBe';
import type {
  DriverActionLogInput,
  DriverActionResult,
  DriverActionStatus,
  DriverActionType,
  DriverContactStatus,
  DriverIssueFound,
  DriverRiskListItem,
} from '@/types/driverCare';
import {
  DRIVER_ACTION_TYPE_LABELS,
} from '@/types/driverCare';

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
  const [contactStatus, setContactStatus] = React.useState<DriverContactStatus>('contacted');
  const [issueFound, setIssueFound] = React.useState<DriverIssueFound>('none');
  const [actionTaken, setActionTaken] = React.useState('');
  const [result, setResult] = React.useState<DriverActionResult>('pending');
  const [nextFollowUpDate, setNextFollowUpDate] = React.useState('');
  const [status, setStatus] = React.useState<DriverActionStatus>('pending');

  React.useEffect(() => {
    if (!open) return;
    setActionType('call');
    setContactStatus('contacted');
    setIssueFound('none');
    setActionTaken('');
    setResult('pending');
    setNextFollowUpDate('');
    setStatus('pending');
  }, [open, driver?.employeeId]);

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
            onSubmit({
              employeeId: driver.employeeId,
              riskScoreId: driver.riskScoreId,
              actionType,
              contactStatus,
              issueFound,
              actionTaken: actionTaken.trim(),
              result,
              nextFollowUpDate: nextFollowUpDate || undefined,
              status,
            });
          }}
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเภท Action</label>
            <select value={actionType} onChange={(e) => setActionType(e.target.value as DriverActionType)} className="jarvis-soft-field">
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>{DRIVER_ACTION_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะการติดต่อ</label>
            <select value={contactStatus} onChange={(e) => setContactStatus(e.target.value as DriverContactStatus)} className="jarvis-soft-field">
              <option value="contacted">ติดต่อได้</option>
              <option value="not_reached">ติดต่อไม่ได้</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเด็นที่พบ</label>
            <select value={issueFound} onChange={(e) => setIssueFound(e.target.value as DriverIssueFound)} className="jarvis-soft-field">
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
              <select value={result} onChange={(e) => setResult(e.target.value as DriverActionResult)} className="jarvis-soft-field">
                <option value="pending">รอผล</option>
                <option value="stay">อยู่ต่อ</option>
                <option value="unsure">ยังไม่ชัด</option>
                <option value="confirmed_resign">ยืนยันลาออก</option>
                <option value="not_reached">ติดต่อไม่ได้</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะเคส</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as DriverActionStatus)} className="jarvis-soft-field">
                <option value="pending">รอดำเนินการ</option>
                <option value="in_progress">กำลังติดตาม</option>
                <option value="closed">ปิดเคส</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">นัดติดตามครั้งถัดไป (ไม่บังคับ)</label>
            <DateSelectDmyBe value={nextFollowUpDate} onChange={setNextFollowUpDate} allowEmpty />
          </div>
          <button type="submit" disabled={saving || !actionTaken.trim()} className="w-full py-2.5 jarvis-pill-btn text-sm disabled:opacity-50">
            {saving ? 'กำลังบันทึก…' : 'บันทึก Action'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DriverActionDialog;
