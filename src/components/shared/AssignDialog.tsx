import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { mockEmployees, mockClients } from '@/data/mockData';
import { toast } from 'sonner';
import { isDemoMode } from '@/lib/demoMode';
import { createWorkCalendarAssignment } from '@/lib/workCalendarStore';
import { apiFetch } from '@/lib/apiFetch';
import { parseJobsPayload } from '@/lib/jobCoords';
import type { ClientWorkplace, Employee, JobRequest } from '@/types';

interface AssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  employeeId?: string;
  employeeName?: string;
}

const AssignDialog: React.FC<AssignDialogProps> = ({ open, onOpenChange, date, employeeId, employeeName }) => {
  const [selectedEmployee, setSelectedEmployee] = useState(employeeId || '');
  const [selectedClient, setSelectedClient] = useState('');
  const [shift, setShift] = useState('08:00-17:00');
  const [saving, setSaving] = useState(false);
  const [apiEmployees, setApiEmployees] = useState<Employee[]>([]);
  const [apiClients, setApiClients] = useState<ClientWorkplace[]>([]);
  const [apiJobs, setApiJobs] = useState<JobRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedEmployee(employeeId || '');
      setSelectedClient('');
      setShift('08:00-17:00');
      setLoadError(null);
    }
  }, [open, employeeId]);

  useEffect(() => {
    if (!open || isDemoMode()) return;
    let cancelled = false;
    setLoadError(null);
    Promise.all([
      apiFetch('/api/employees?limit=500').then(async (r) => (r.ok ? ((await r.json()) as Employee[]) : [])),
      apiFetch('/api/clients?active_only=1').then(async (r) => (r.ok ? ((await r.json()) as ClientWorkplace[]) : [])),
      apiFetch('/api/jobs?limit=500').then(async (r) => (r.ok ? parseJobsPayload(await r.json()) : [])),
    ])
      .then(([emps, cls, jobs]) => {
        if (!cancelled) {
          setApiEmployees(Array.isArray(emps) ? emps : []);
          setApiClients(Array.isArray(cls) ? cls : []);
          setApiJobs(Array.isArray(jobs) ? jobs : []);
          if ((!emps || emps.length === 0) && (!cls || cls.length === 0) && (!jobs || jobs.length === 0)) {
            setLoadError('ยังไม่มีพนักงานหรือลูกค้าในระบบ — เพิ่มใน Employees / Clients (Admin) ก่อน');
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('โหลดข้อมูลไม่สำเร็จ');
          setApiEmployees([]);
          setApiClients([]);
          setApiJobs([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const activeEmployees = isDemoMode()
    ? mockEmployees.filter((e) => e.status === 'active')
    : apiEmployees.filter((e) => e.status === 'active');
  const activeClients = isDemoMode()
    ? mockClients.filter((c) => c.is_active)
    : apiClients.filter((c) => c.is_active !== false);
  const fallbackUnitsFromJobs = isDemoMode()
    ? []
    : Array.from(
        new Set(
          apiJobs
            .map((j) => (typeof j.unit_name === 'string' ? j.unit_name.trim() : ''))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, 'th'));

  const employeeList = isDemoMode() ? mockEmployees : apiEmployees;
  const clientList = isDemoMode() ? mockClients : apiClients;

  const handleAssign = async () => {
    const empId = employeeId || selectedEmployee;
    const emp = employeeList.find((e) => e.id === empId);
    const client = clientList.find((c) => c.id === selectedClient);
    const fallbackUnit = fallbackUnitsFromJobs.find((u) => `unit:${u}` === selectedClient);
    if (!emp || (!client && !fallbackUnit)) return;

    setSaving(true);
    try {
      const res = await createWorkCalendarAssignment({
        employee_id: emp.id,
        work_date: date,
        client_id: client?.id,
        client_name: client?.name ?? fallbackUnit,
        shift,
        status: 'normal_work',
        income: client?.default_income,
        cost: client?.default_cost,
      });
      if (!res.ok) {
        toast.error(res.message ?? 'บันทึกไม่สำเร็จ');
        return;
      }
      toast.success(`มอบหมาย ${emp.first_name} ไปที่ ${client?.name ?? fallbackUnit} วันที่ ${date}`);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">มอบหมายงาน - {date}</DialogTitle>
          <DialogDescription className="sr-only">
            เลือกพนักงาน หน่วยงาน และช่วงเวลา เพื่อยืนยันการมอบหมายงาน
          </DialogDescription>
        </DialogHeader>

        {!isDemoMode() && loadError && (
          <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
            {loadError}
          </p>
        )}

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">พนักงาน</label>
            {employeeName ? (
              <div className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                {employeeName}
              </div>
            ) : (
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="">เลือกพนักงาน</option>
                {activeEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} ({e.nickname})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">หน่วยงาน / ลูกค้า</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <option value="">เลือกหน่วยงาน</option>
              {activeClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {fallbackUnitsFromJobs.map((name) => (
                <option key={`unit:${name}`} value={`unit:${name}`}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">กะ / เวลา</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <option value="06:00-15:00">06:00-15:00</option>
              <option value="07:00-16:00">07:00-16:00</option>
              <option value="08:00-17:00">08:00-17:00</option>
              <option value="08:30-17:30">08:30-17:30</option>
              <option value="09:00-18:00">09:00-18:00</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void handleAssign()}
            disabled={saving || !selectedClient || (!employeeId && !selectedEmployee)}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'กำลังบันทึก…' : 'ยืนยันมอบหมาย'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignDialog;
