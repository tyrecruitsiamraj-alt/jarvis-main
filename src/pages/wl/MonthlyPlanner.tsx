import React, { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import AssignDialog from '@/components/shared/AssignDialog';
import { useWorkCalendarEntries } from '@/lib/workCalendarStore';
import { useWlEmployees } from '@/hooks/useWlEmployees';
import { WorkCalendarEntry, WorkStatus, WORK_STATUS_COLORS, WORK_STATUS_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProductionDataPlaceholder from '@/components/shared/ProductionDataPlaceholder';

const MonthlyPlanner: React.FC = () => {
  const calendarEntries = useWorkCalendarEntries();
  const { employees: wlEmployees, loading } = useWlEmployees();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; date: string; empId: string; empName: string }>({ open: false, date: '', empId: '', empName: '' });
  const [cellDetail, setCellDetail] = useState<{ open: boolean; entry: WorkCalendarEntry | null; empName: string }>({ open: false, entry: null, empName: '' });

  const activeEmployees = wlEmployees.filter((e) => e.status === 'active');
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getEntry = (empId: string, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendarEntries.find(w => w.employee_id === empId && w.work_date === dateStr);
  };

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  return (
    <div>
      <PageHeader title="Monthly Work Planner" subtitle="วางแผนงานรายเดือน" backPath="/wl" />
      <ProductionDataPlaceholder title="Monthly Planner" />
      {loading ? (
        <div className="px-4 md:px-6 text-sm text-muted-foreground">กำลังโหลด…</div>
      ) : (
      <div className="px-4 md:px-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg bg-secondary hover:bg-secondary/80"><ChevronLeft className="w-4 h-4" /></button>
          <span className="font-semibold text-foreground">{monthNames[month]} {year + 543}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg bg-secondary hover:bg-secondary/80"><ChevronRight className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(WORK_STATUS_LABELS) as WorkStatus[]).map(status => (
            <div key={status} className="flex items-center gap-1.5 text-xs">
              <div className={cn('status-dot', WORK_STATUS_COLORS[status])} />
              <span className="text-muted-foreground">{WORK_STATUS_LABELS[status]}</span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto glass-card rounded-xl border border-border">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 bg-card z-10 px-3 py-2 text-left text-muted-foreground font-medium min-w-[120px]">พนักงาน</th>
                {days.map(d => (
                  <th key={d} className="px-1 py-2 text-center text-muted-foreground font-medium min-w-[32px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map(emp => (
                <tr key={emp.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="sticky left-0 bg-card z-10 px-3 py-2 font-medium text-foreground whitespace-nowrap">
                    {emp.nickname || emp.first_name}
                  </td>
                  {days.map(d => {
                    const entry = getEntry(emp.id, d);
                    return (
                      <td key={d} className="px-1 py-2 text-center">
                        {entry ? (
                          <div onClick={() => setCellDetail({ open: true, entry, empName: `${emp.first_name} ${emp.last_name}` })}
                            className={cn('w-6 h-6 rounded-md mx-auto flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all', WORK_STATUS_COLORS[entry.status])}>
                            <span className="text-[8px] font-bold text-foreground">{entry.client_name?.charAt(0) || ''}</span>
                          </div>
                        ) : (
                          <div onClick={() => setAssignDialog({ open: true, date: getDateStr(d), empId: emp.id, empName: `${emp.first_name} ${emp.last_name}` })}
                            className="w-6 h-6 rounded-md mx-auto bg-secondary/30 cursor-pointer hover:bg-primary/20 transition-colors" title="กดเพื่อมอบหมายงาน" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Assign Dialog */}
      <AssignDialog open={assignDialog.open} onOpenChange={(o) => setAssignDialog(prev => ({ ...prev, open: o }))}
        date={assignDialog.date} employeeId={assignDialog.empId} employeeName={assignDialog.empName} />

      {/* Cell Detail Dialog */}
      <Dialog open={cellDetail.open} onOpenChange={(o) => setCellDetail(prev => ({ ...prev, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">รายละเอียดงาน</DialogTitle>
            <DialogDescription className="sr-only">รายละเอียดการทำงานในวันที่เลือกจากปฏิทิน</DialogDescription>
          </DialogHeader>
          {cellDetail.entry && (
            <div className="space-y-3 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{cellDetail.empName}</span>
                <StatusBadge status={cellDetail.entry.status} type="work" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">วันที่</span><span className="text-foreground">{cellDetail.entry.work_date}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ลูกค้า</span><span className="text-foreground">{cellDetail.entry.client_name || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">กะ</span><span className="text-foreground">{cellDetail.entry.shift || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">รายได้</span><span className="text-success">฿{cellDetail.entry.income?.toLocaleString() || 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ต้นทุน</span><span className="text-warning">฿{cellDetail.entry.cost?.toLocaleString() || 0}</span></div>
                {cellDetail.entry.issue_reason && (
                  <div className="flex justify-between"><span className="text-muted-foreground">สาเหตุ</span><span className="text-destructive">{cellDetail.entry.issue_reason}</span></div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MonthlyPlanner;
