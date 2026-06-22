import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DateSelectDmyBe from '@/components/shared/DateSelectDmyBe';
import TimeSelect24 from '@/components/shared/TimeSelect24';
import SearchableSelect from '@/components/shared/SearchableSelect';
import type { SearchableSelectGroup } from '@/components/shared/SearchableSelect';
import { mockEmployees, mockClients } from '@/data/mockData';
import { toast } from 'sonner';
import { isDemoMode } from '@/lib/demoMode';
import { createWorkCalendarAssignment } from '@/lib/workCalendarStore';
import { apiFetch } from '@/lib/apiFetch';
import { parseJobsPayload } from '@/lib/jobCoords';
import type { ClientWorkplace, Employee, JobRequest } from '@/types';
import { parseYmd, toYmdLocal, formatYmdDmyBe, buildDateRangeYmd } from '@/lib/dateTh';

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endDateUnknown, setEndDateUnknown] = useState(false);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('');
  const [endTimeUnknown, setEndTimeUnknown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiEmployees, setApiEmployees] = useState<Employee[]>([]);
  const [apiClients, setApiClients] = useState<ClientWorkplace[]>([]);
  const [apiJobs, setApiJobs] = useState<JobRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const applyDateProp = (ymd: string) => {
    const p = parseYmd(ymd) ?? parseYmd(toYmdLocal(new Date()));
    if (!p) return;
    setStartDate(`${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`);
    setEndDate('');
    setEndDateUnknown(false);
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

  const employeeOptions = useMemo(
    () =>
      activeEmployees.map((e) => ({
        value: e.id,
        label: `${e.first_name} ${e.last_name}${e.nickname ? ` (${e.nickname})` : ''}`,
        keywords: [e.phone, e.employee_code, e.position, e.title_prefix].filter(Boolean).join(' '),
      })),
    [activeEmployees],
  );

  const clientOptions = useMemo((): SearchableSelectGroup[] => {
    const groups: SearchableSelectGroup[] = [];
    if (activeClients.length > 0) {
      groups.push({
        heading: 'ลูกค้า / สถานที่',
        options: activeClients.map((c) => ({
          value: c.id,
          label: c.name,
          keywords: [c.address, c.contact_person, c.contact_phone].filter(Boolean).join(' '),
        })),
      });
    }
    if (fallbackUnitsFromJobs.length > 0) {
      groups.push({
        heading: 'หน่วยงานจากงาน',
        options: fallbackUnitsFromJobs.map((name) => ({
          value: `unit:${name}`,
          label: name,
        })),
      });
    }
    return groups;
  }, [activeClients, fallbackUnitsFromJobs]);

  const handleAssign = async () => {
    const empId = employeeId || selectedEmployee;
    const emp = employeeList.find((e) => e.id === empId);
    const client = clientList.find((c) => c.id === selectedClient);
    const fallbackUnit = fallbackUnitsFromJobs.find((u) => `unit:${u}` === selectedClient);
    if (!emp || (!client && !fallbackUnit)) return;

    if (!parseYmd(startDate)) {
      toast.error('กรุณาเลือกวันเริ่มงานให้ถูกต้อง');
      return;
    }

    let endIso: string | null = null;
    if (!endDateUnknown && endDate) {
      if (!parseYmd(endDate)) {
        toast.error('กรุณาเลือกวันเลิกให้ถูกต้อง หรือเลือกไม่ทราบวันเลิกงาน');
        return;
      }
      endIso = endDate;
    }

    if (!startTime.trim()) {
      toast.error('กรุณาเลือกเวลาเริ่มงาน');
      return;
    }

    const dates = buildDateRangeYmd(startDate, endIso);
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

      const endLabel = endIso ?? startDate;
      toast.success(`มอบหมาย ${emp.first_name} ไปที่ ${client?.name ?? fallbackUnit} ช่วง ${startDate} ถึง ${endLabel}`);
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
              <div className="jarvis-soft-field">{employeeName}</div>
            ) : (
              <SearchableSelect
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                options={employeeOptions}
                placeholder="เลือกพนักงาน"
                searchPlaceholder="ค้นหาชื่อ พนักงาน..."
                emptyText="ไม่พบพนักงาน"
              />
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">หน่วยงาน / ลูกค้า</label>
            <SearchableSelect
              value={selectedClient}
              onChange={setSelectedClient}
              groups={clientOptions}
              placeholder="เลือกหน่วยงาน"
              searchPlaceholder="ค้นหาหน่วยงาน ลูกค้า..."
              emptyText="ไม่พบหน่วยงาน"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              วันเริ่มงาน (วัน / เดือน / ปี พ.ศ.)
            </label>
            <DateSelectDmyBe value={startDate} onChange={setStartDate} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              วันเลิก (วัน / เดือน / ปี พ.ศ.)
            </label>
            {endDateUnknown ? (
              <div className="jarvis-soft-field text-muted-foreground">ไม่ทราบวันเลิกงาน</div>
            ) : (
              <DateSelectDmyBe
                value={endDate}
                onChange={setEndDate}
                allowEmpty
              />
            )}
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0 rounded border-border"
                checked={endDateUnknown}
                onChange={(e) => {
                  const on = e.target.checked;
                  setEndDateUnknown(on);
                  if (on) setEndDate('');
                }}
              />
              <span>ไม่ทราบวันเลิกงาน — ระบบจะลงเฉพาะวันเริ่มงาน</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">เวลาเริ่มงาน</label>
              <TimeSelect24 value={startTime} onChange={setStartTime} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">เวลาเลิกงาน (ไม่บังคับ)</label>
              {endTimeUnknown ? (
                <div className="jarvis-soft-field text-muted-foreground">ไม่ทราบเวลาเลิกงาน</div>
              ) : (
                <TimeSelect24
                  value={endTime || '17:00'}
                  onChange={setEndTime}
                />
              )}
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
                <span>ยังไม่ทราบเวลาเลิกงาน — ระบบจะบันทึกเฉพาะเวลาเริ่ม</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleAssign()}
            disabled={saving || !selectedClient || (!employeeId && !selectedEmployee)}
            className="w-full py-2.5 jarvis-pill-btn font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'กำลังบันทึก…' : 'ยืนยันมอบหมาย'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignDialog;
