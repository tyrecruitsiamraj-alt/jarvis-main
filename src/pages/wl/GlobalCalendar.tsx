import React, { useMemo, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { useWorkCalendarEntries } from '@/lib/workCalendarStore';
import { useWlEmployees } from '@/hooks/useWlEmployees';
import { WORK_STATUS_COLORS } from '@/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductionDataPlaceholder from '@/components/shared/ProductionDataPlaceholder';

/** ตรงกับค่า <input type="date"> และ work_date ใน store (ปฏิทินท้องถิ่น ไม่ใช่ UTC จาก toISOString) */
function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const GlobalCalendar: React.FC = () => {
  const workCalendar = useWorkCalendarEntries();
  const { employees: wlEmployees, loading } = useWlEmployees();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d;
  });

  const days = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [startDate],
  );

  const activeEmployees = wlEmployees.filter((e) => e.status === 'active');
  const todayYmd = formatLocalYmd(new Date());

  const getEntry = (empId: string, date: Date) => {
    const dateStr = formatLocalYmd(date);
    return workCalendar.find((w) => w.employee_id === empId && w.work_date === dateStr);
  };

  const offsetWeek = (dir: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + dir * 7);
    setStartDate(d);
  };

  const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  return (
    <div>
      <PageHeader title="Global Planning Calendar" subtitle="ตาราง Matrix พนักงาน × วันที่" backPath="/wl" />
      <ProductionDataPlaceholder title="Global Calendar" />
      {loading ? (
        <div className="px-4 md:px-6 text-sm text-muted-foreground">กำลังโหลดพนักงาน…</div>
      ) : (
      <div className="px-4 md:px-6">
        <div className="flex items-center gap-3 mb-4">
          <button type="button" onClick={() => offsetWeek(-1)} className="p-2 rounded-lg bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium text-foreground">
            {days[0].toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - {days[days.length - 1].toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
          </span>
          <button type="button" onClick={() => offsetWeek(1)} className="p-2 rounded-lg bg-secondary"><ChevronRight className="w-4 h-4" /></button>
        </div>

        <div className="overflow-x-auto glass-card rounded-xl border border-border">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 bg-card z-10 px-3 py-2 text-left text-muted-foreground font-medium min-w-[120px]">พนักงาน</th>
                {days.map((d, i) => {
                  const isToday = formatLocalYmd(d) === todayYmd;
                  return (
                    <th key={i} className={cn('px-1 py-2 text-center min-w-[70px]', isToday && 'bg-primary/5')}>
                      <div className="text-muted-foreground">{dayNames[d.getDay()]}</div>
                      <div className={cn('text-foreground font-semibold', isToday && 'text-primary')}>{d.getDate()}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map(emp => (
                <tr key={emp.id} className="border-b border-border/50">
                  <td className="sticky left-0 bg-card z-10 px-3 py-2 font-medium text-foreground whitespace-nowrap">
                    {emp.nickname || emp.first_name}
                  </td>
                  {days.map((d, i) => {
                    const entry = getEntry(emp.id, d);
                    const isToday = formatLocalYmd(d) === todayYmd;
                    return (
                      <td key={i} className={cn('px-1 py-1.5', isToday && 'bg-primary/5')}>
                        {entry && entry.status !== 'available' ? (
                          <div className={cn('rounded-md px-1.5 py-1 text-center', WORK_STATUS_COLORS[entry.status])}>
                            <div
                              className="text-[9px] font-medium text-foreground leading-tight break-words line-clamp-3 max-w-[76px] mx-auto"
                              title={entry.client_name || undefined}
                            >
                              {entry.client_name || '—'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground/50 text-[10px]">ว่าง</div>
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
    </div>
  );
};

export default GlobalCalendar;
