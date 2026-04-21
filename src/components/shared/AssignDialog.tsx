import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { mockEmployees, mockClients } from '@/data/mockData';
import { toast } from 'sonner';
import { isDemoMode } from '@/lib/demoMode';
import { createWorkCalendarAssignment } from '@/lib/workCalendarStore';
import { apiFetch } from '@/lib/apiFetch';
import { parseJobsPayload } from '@/lib/jobCoords';
import type { ClientWorkplace, Employee, JobRequest } from '@/types';
import {
  THAI_MONTHS,
  parseYmd,
  toYmdLocal,
  ceToBeYear,
  dmyBeToYmd,
  formatYmdDmyBe,
  buildDateRangeYmd,
} from '@/lib/dateTh';

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
  const [startDay, setStartDay] = useState(1);
  const [startMonth, setStartMonth] = useState(1);
  const [startYearBe, setStartYearBe] = useState(ceToBeYear(new Date().getFullYear()));
  const [endDay, setEndDay] = useState<number | ''>('');
  const [endMonth, setEndMonth] = useState<number | ''>('');
  const [endYearBe, setEndYearBe] = useState<number | ''>('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('');
  const [endTimeUnknown, setEndTimeUnknown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiEmployees, setApiEmployees] = useState<Employee[]>([]);
  const [apiClients, setApiClients] = useState<ClientWorkplace[]>([]);
  const [apiJobs, setApiJobs] = useState<JobRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const yearOptionsBe = useMemo(() => {
    const cy = new Date().getFullYear();
    const centerBe = ceToBeYear(cy);
    const out: number[] = [];
    for (let be = centerBe - 15; be <= centerBe + 15; be += 1) out.push(be);
    return out;
  }, []);

  const dayOptions = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);

  const applyDateProp = (ymd: string) => {
    const p = parseYmd(ymd) ?? parseYmd(toYmdLocal(new Date()));
    if (!p) return;
    setStartDay(p.d);
    setStartMonth(p.m);
    setStartYearBe(ceToBeYear(p.y));
    setEndDay('');
    setEndMonth('');
    setEndYearBe('');
  };

  useEffect(() => {
    if (open) {
      setSelectedEmployee(employeeId || '');
      setSelectedClient('');
      applyDateProp(date || toYmdLocal(new Date()));
      setStartTime('08:00');
      setEndTime('');
      setEndTimeUnknown(false);
      setLoadError(null);
    }
  }, [open, employeeId, date]);

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

  const endDateFilled =
    endDay !== '' &&
    endMonth !== '' &&
    endYearBe !== '' &&
    typeof endDay === 'number' &&
    typeof endMonth === 'number' &&
    typeof endYearBe === 'number';

  const anyEndField = endDay !== '' || endMonth !== '' || endYearBe !== '';
  const endDatePartial = anyEndField && !endDateFilled;

  const handleAssign = async () => {
    const empId = employeeId || selectedEmployee;
    const emp = employeeList.find((e) => e.id === empId);
    const client = clientList.find((c) => c.id === selectedClient);
    const fallbackUnit = fallbackUnitsFromJobs.find((u) => `unit:${u}` === selectedClient);
    if (!emp || (!client && !fallbackUnit)) return;

    const startIso = dmyBeToYmd(startDay, startMonth, startYearBe);
    if (!startIso) {
      toast.error('กรุณาเลือกวันเริ่มงานให้ถูกต้อง');
      return;
    }

    if (endDatePartial) {
      toast.error('ถ้าระบุถึงวันที่ ให้เลือกวัน เดือน และปี พ.ศ. ให้ครบ หรือเว้นว่างทั้งหมด');
      return;
    }

    let endIso: string | null = null;
    if (endDateFilled) {
      endIso = dmyBeToYmd(endDay as number, endMonth as number, endYearBe as number);
      if (!endIso) {
        toast.error('กรุณาเลือกวันสิ้นสุดให้ถูกต้อง หรือเว้นว่างเพื่อลงวันเดียว');
        return;
      }
    }

    if (!startTime.trim()) {
      toast.error('กรุณาเลือกเวลาเริ่มงาน');
      return;
    }

    const dates = buildDateRangeYmd(startIso, endIso);
    if (dates.length === 0) {
      toast.error('ช่วงวันที่ไม่ถูกต้อง');
      return;
    }

    const shift =
      !endTimeUnknown && endTime.trim() ? `${startTime.trim()}-${endTime.trim()}` : startTime.trim();

    setSaving(true);
    try {
      for (const workDate of dates) {
        const res = await createWorkCalendarAssignment({
          employee_id: emp.id,
          work_date: workDate,
          client_id: client?.id,
          client_name: client?.name ?? fallbackUnit,
          shift,
          status: 'normal_work',
          income: client?.default_income,
          cost: client?.default_cost,
        });
        if (!res.ok) {
          toast.error(res.message ?? `บันทึกไม่สำเร็จ (${workDate})`);
          return;
        }
      }

      const endLabel = endIso ?? startIso;
      toast.success(`มอบหมาย ${emp.first_name} ไปที่ ${client?.name ?? fallbackUnit} ช่วง ${startIso} ถึง ${endLabel}`);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            มอบหมายงาน — วันที่ {formatYmdDmyBe(date || toYmdLocal(new Date()))}
          </DialogTitle>
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
            <label className="text-xs font-medium text-muted-foreground mb-1 block">วันเริ่มงาน (วัน / เดือน / ปี พ.ศ.)</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={startDay}
                onChange={(e) => setStartDay(Number(e.target.value))}
                className="bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground"
              >
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className="bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground"
              >
                {THAI_MONTHS.map((mo) => (
                  <option key={mo.value} value={mo.value}>
                    {mo.label}
                  </option>
                ))}
              </select>
              <select
                value={startYearBe}
                onChange={(e) => setStartYearBe(Number(e.target.value))}
                className="bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground"
              >
                {yearOptionsBe.map((be) => (
                  <option key={be} value={be}>
                    {be}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              ถึงวันที่ (ไม่บังคับ — เว้นว่าง = ลงวันเดียวกับวันเริ่ม)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={endDay === '' ? '' : String(endDay)}
                onChange={(e) => {
                  const v = e.target.value;
                  setEndDay(v === '' ? '' : Number(v));
                }}
                className="bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground"
              >
                <option value="">วัน</option>
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={endMonth === '' ? '' : String(endMonth)}
                onChange={(e) => {
                  const v = e.target.value;
                  setEndMonth(v === '' ? '' : Number(v));
                }}
                className="bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground"
              >
                <option value="">เดือน</option>
                {THAI_MONTHS.map((mo) => (
                  <option key={mo.value} value={mo.value}>
                    {mo.label}
                  </option>
                ))}
              </select>
              <select
                value={endYearBe === '' ? '' : String(endYearBe)}
                onChange={(e) => {
                  const v = e.target.value;
                  setEndYearBe(v === '' ? '' : Number(v));
                }}
                className="bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground"
              >
                <option value="">ปี พ.ศ.</option>
                {yearOptionsBe.map((be) => (
                  <option key={be} value={be}>
                    {be}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">เวลาเริ่มงาน</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">เวลาเลิกงาน (ไม่บังคับ)</label>
              <input
                type="time"
                value={endTime}
                disabled={endTimeUnknown}
                onChange={(e) => {
                  setEndTimeUnknown(false);
                  setEndTime(e.target.value);
                }}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-50"
              />
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0 rounded border-border"
                  checked={endTimeUnknown}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setEndTimeUnknown(on);
                    if (on) setEndTime('');
                  }}
                />
                <span>ยังไม่ทราบเวลาเลิกงาน — ระบบจะบันทึกเฉพาะเวลาเริ่ม (ไม่ต้องใส่เวลาข้างบน)</span>
              </label>
            </div>
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
