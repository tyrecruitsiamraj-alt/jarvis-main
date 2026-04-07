import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CalendarPlus, Calendar, Users, BarChart3 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import DetailListDialog from '@/components/shared/DetailListDialog';
import { useWorkCalendarEntries } from '@/lib/workCalendarStore';
import { useWlEmployees } from '@/hooks/useWlEmployees';
import { WORK_STATUS_LABELS } from '@/types';
import { motion } from 'framer-motion';
import ProductionDataPlaceholder from '@/components/shared/ProductionDataPlaceholder';

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type DetailDialogItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  onClick?: () => void;
  extra?: React.ReactNode;
};

const subMenus = [
  { path: '/wl/monthly-planner', label: 'Monthly Planner', desc: 'วางแผนรายเดือน', icon: CalendarDays },
  { path: '/wl/daily-assignment', label: 'Daily Assignment', desc: 'ลงคนรายวัน', icon: CalendarPlus },
  { path: '/wl/global-calendar', label: 'Global Calendar', desc: 'ตาราง Matrix', icon: Calendar },
  { path: '/wl/employees', label: 'พนักงาน WL', desc: 'จัดการพนักงาน', icon: Users },
];

const WLDashboard: React.FC = () => {
  const navigate = useNavigate();
  const calendarEntries = useWorkCalendarEntries();
  const { employees: wlEmployees } = useWlEmployees();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogItems, setDialogItems] = useState<DetailDialogItem[]>([]);

  const activeEmployees = wlEmployees.filter((e) => e.status === 'active');
  const todayStr = formatLocalYmd(new Date());
  const todayEntries = calendarEntries.filter((w) => w.work_date === todayStr);
  const workingToday = todayEntries.filter((w) => w.status === 'normal_work' || w.status === 'late');
  const issueToday = todayEntries.filter((w) =>
    ['cancel_by_employee', 'no_show', 'cancel_by_client'].includes(w.status),
  );
  const assignedIds = todayEntries.map((e) => e.employee_id);
  const availableToday = activeEmployees.filter((e) => !assignedIds.includes(e.id));

  const showEmployees = () => {
    setDialogTitle(`พนักงานทั้งหมด (${activeEmployees.length} คน)`);
    setDialogItems(
      activeEmployees.map((e) => ({
        id: e.id,
        title: `${e.first_name} ${e.last_name} (${e.nickname})`,
        subtitle: `${e.position} • Reliability: ${e.reliability_score}% • โทร: ${e.phone}`,
        badge: e.status === 'active' ? 'ทำงาน' : 'ไม่ทำงาน',
        badgeVariant: e.status === 'active' ? 'success' : 'destructive',
        onClick: () => {
          setDialogOpen(false);
          navigate(`/wl/employees/${e.id}`);
        },
      })),
    );
    setDialogOpen(true);
  };

  const showWorking = () => {
    setDialogTitle(`ทำงานวันนี้ (${workingToday.length} คน)`);
    setDialogItems(
      workingToday.map((w) => {
        const emp = wlEmployees.find((e) => e.id === w.employee_id);
        return {
          id: w.id,
          title: `${emp?.first_name || ''} ${emp?.last_name || ''}`,
          subtitle: `${w.client_name || '-'} • ${w.shift || ''} • ${WORK_STATUS_LABELS[w.status]}`,
          badge: w.status === 'late' ? 'มาสาย' : 'ปกติ',
          badgeVariant: w.status === 'late' ? 'warning' : 'success',
          onClick: emp
            ? () => {
                setDialogOpen(false);
                navigate(`/wl/employees/${emp.id}`);
              }
            : undefined,
        };
      }),
    );
    setDialogOpen(true);
  };

  const showIssues = () => {
    setDialogTitle(`ปัญหาวันนี้ (${issueToday.length} คน)`);
    setDialogItems(
      issueToday.map((w) => {
        const emp = wlEmployees.find((e) => e.id === w.employee_id);
        return {
          id: w.id,
          title: `${emp?.first_name || ''} ${emp?.last_name || ''}`,
          subtitle: `${w.client_name || '-'} • ${w.issue_reason || WORK_STATUS_LABELS[w.status]}`,
          badge: WORK_STATUS_LABELS[w.status],
          badgeVariant: 'destructive' as const,
          onClick: emp
            ? () => {
                setDialogOpen(false);
                navigate(`/wl/employees/${emp.id}`);
              }
            : undefined,
        };
      }),
    );
    setDialogOpen(true);
  };

  const showAvailable = () => {
    setDialogTitle(`ว่างวันนี้ (${availableToday.length} คน)`);
    setDialogItems(
      availableToday.map((e) => ({
        id: e.id,
        title: `${e.first_name} ${e.last_name} (${e.nickname})`,
        subtitle: `${e.position} • Reliability: ${e.reliability_score}% • โทร: ${e.phone}`,
        badge: 'ว่าง',
        badgeVariant: 'warning' as const,
        onClick: () => {
          setDialogOpen(false);
          navigate(`/wl/employees/${e.id}`);
        },
      })),
    );
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader title="WL Module" subtitle="บริหารกำลังคนและปฏิทินงาน" />
      <ProductionDataPlaceholder title="สรุป WL / ปฏิทิน" />
      <div className="px-4 md:px-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="พนักงานทั้งหมด"
            value={activeEmployees.length}
            icon={Users}
            variant="primary"
            onClick={showEmployees}
          />
          <StatCard
            title="ทำงานวันนี้"
            value={workingToday.length}
            icon={CalendarDays}
            variant="success"
            onClick={showWorking}
          />
          <StatCard
            title="ปัญหาวันนี้"
            value={issueToday.length}
            icon={BarChart3}
            variant="destructive"
            onClick={showIssues}
          />
          <StatCard
            title="ว่างวันนี้"
            value={availableToday.length}
            variant="warning"
            onClick={showAvailable}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {subMenus.map((item, i) => (
            <motion.button
              key={item.path}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              type="button"
              onClick={() => navigate(item.path)}
              className="glass-card rounded-xl p-4 border border-border hover:border-primary/40 transition-all text-left"
            >
              <item.icon className="w-6 h-6 text-primary mb-2" />
              <div className="font-semibold text-foreground text-sm">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.desc}</div>
            </motion.button>
          ))}
        </div>
      </div>
      <DetailListDialog open={dialogOpen} onOpenChange={setDialogOpen} title={dialogTitle} items={dialogItems} />
    </div>
  );
};

export default WLDashboard;
