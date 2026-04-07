import React, { useMemo, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import AssignDialog from '@/components/shared/AssignDialog';
import { useWorkCalendarEntries } from '@/lib/workCalendarStore';
import { useWlEmployees } from '@/hooks/useWlEmployees';
import { Plus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Employee, WorkCalendarEntry, WORK_STATUS_LABELS } from '@/types';
import ProductionDataPlaceholder from '@/components/shared/ProductionDataPlaceholder';

const DailyAssignment: React.FC = () => {
  const workCalendar = useWorkCalendarEntries();
  const { employees: wlEmployees, loading: loadingEmps } = useWlEmployees();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; empId: string; empName: string }>({ open: false, empId: '', empName: '' });
  type WorkCalendarEntryWithEmployee = WorkCalendarEntry & { emp?: Employee };
  const [editDialog, setEditDialog] = useState<{ open: boolean; entry: WorkCalendarEntryWithEmployee | null }>({ open: false, entry: null });

  const todayEntries = useMemo(
    () => workCalendar.filter((w) => w.work_date === selectedDate),
    [workCalendar, selectedDate],
  );
  const activeEmployees = wlEmployees.filter((e) => e.status === 'active');
  const assignedIds = todayEntries.map(e => e.employee_id);
  const availableEmployees = activeEmployees.filter(e => !assignedIds.includes(e.id));
  const filteredAvailable = availableEmployees.filter(e =>
    `${e.first_name} ${e.last_name} ${e.nickname}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Daily Assignment" subtitle="ลงคนทำงานรายวัน" backPath="/wl" />
      <ProductionDataPlaceholder title="Daily Assignment" />
      {loadingEmps ? (
        <div className="px-4 md:px-6 text-sm text-muted-foreground">กำลังโหลด…</div>
      ) : (
      <div className="px-4 md:px-6 space-y-4">
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground" />

        {/* Assigned today */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">ลงงานแล้ววันนี้ ({todayEntries.length} คน)</h3>
          <div className="space-y-2">
            {todayEntries.map(entry => {
              const emp = wlEmployees.find(e => e.id === entry.employee_id);
              return (
                <div key={entry.id} onClick={() => setEditDialog({ open: true, entry: { ...entry, emp } })}
                  className="glass-card rounded-lg p-3 border border-border flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors">
                  <div>
                    <div className="font-medium text-foreground text-sm">{emp?.first_name} {emp?.last_name}</div>
                    <div className="text-xs text-muted-foreground">{entry.client_name} • {entry.shift}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={entry.status} type="work" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Available */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">ว่าง ({filteredAvailable.length} คน)</h3>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="ค้นหาพนักงาน..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {filteredAvailable.map(emp => (
              <div key={emp.id} className="glass-card rounded-lg p-3 border border-border flex items-center justify-between">
                <div>
                  <div className="font-medium text-foreground text-sm">{emp.first_name} {emp.last_name}</div>
                  <div className="text-xs text-muted-foreground">{emp.position} • Reliability: {emp.reliability_score}%</div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignDialog({ open: true, empId: emp.id, empName: `${emp.first_name} ${emp.last_name}` })}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="w-3 h-3" /> มอบหมาย
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Assign Dialog */}
      <AssignDialog open={assignDialog.open} onOpenChange={(o) => setAssignDialog(prev => ({ ...prev, open: o }))}
        date={selectedDate} employeeId={assignDialog.empId} employeeName={assignDialog.empName} />

      {/* Edit/Detail Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(o) => setEditDialog(prev => ({ ...prev, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">รายละเอียดงาน</DialogTitle>
            <DialogDescription className="sr-only">รายละเอียดการลงงานและลูกค้าในวันที่เลือก</DialogDescription>
          </DialogHeader>
          {editDialog.entry && (
            <div className="space-y-3 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{editDialog.entry.emp?.first_name} {editDialog.entry.emp?.last_name}</span>
                <StatusBadge status={editDialog.entry.status} type="work" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">ลูกค้า</span><span className="text-foreground">{editDialog.entry.client_name || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">กะ</span><span className="text-foreground">{editDialog.entry.shift || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">สถานะ</span><span>{WORK_STATUS_LABELS[editDialog.entry.status as keyof typeof WORK_STATUS_LABELS]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">รายได้</span><span className="text-success">฿{editDialog.entry.income?.toLocaleString() || 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ต้นทุน</span><span className="text-warning">฿{editDialog.entry.cost?.toLocaleString() || 0}</span></div>
                {editDialog.entry.issue_reason && (
                  <div className="flex justify-between"><span className="text-muted-foreground">สาเหตุ</span><span className="text-destructive">{editDialog.entry.issue_reason}</span></div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>โทร: {editDialog.entry.emp?.phone}</span>
                <a href={`tel:${editDialog.entry.emp?.phone}`} className="px-2 py-1 rounded bg-success/10 text-success">โทร</a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyAssignment;
