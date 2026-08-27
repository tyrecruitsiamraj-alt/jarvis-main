/**
 * แถบเมนูสายพาน — โครงนำทางใหม่ (เจ้าของเคาะจากต้นแบบ 26 ส.ค. 2569)
 *
 * แทน drawer ที่ต้องกด hamburger ก่อนถึงจะเห็น ⇒ **เมนูอยู่ตรงนั้นตลอดเวลา**
 * บนจอใหญ่ · จอเล็กยังใช้ drawer เดิม (พื้นที่ไม่พอจริง ๆ)
 *
 * 🔴 ของที่ตั้งใจให้ต่างจากเมนูเดิม:
 * 1. **เลขขั้นอยู่บนปุ่ม** — เห็นลำดับงานโดยไม่ต้องอ่านคำอธิบาย
 * 2. **ตัวนับของค้างท้ายปุ่ม** — รู้ว่าต้องไปไหนก่อนโดยไม่ต้องเปิดทีละหน้า
 *    ป้ายแดง = ต้องลงมือ · ป้ายเทา = บอกปริมาณเฉย ๆ (`conveyorBadge`)
 * 3. **ไม่มีป้ายเลยเมื่อยังไม่รู้** — ห้ามวาด 0 ตอนโหลดไม่ได้ (ดู useConveyorCounts)
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { useConveyorCounts } from '@/hooks/useConveyorCounts';
import {
  CONVEYOR_HOME,
  CONVEYOR_STEPS,
  CONVEYOR_VAULT,
  CONVEYOR_BADGE_MEANING,
  conveyorBadge,
  isStepActive,
  isVaultActive,
  type ConveyorBadgeKey,
} from '@/lib/soRecruitNav';

/**
 * จำสถานะยุบไว้ต่อเครื่อง (แพตเทิร์นเดียวกับธีมที่ `src/lib/theme.ts`)
 *
 * 🔴 **ทำไมต้องยุบได้** — วัดจริง 26 ส.ค. 2569: ตาราง "ใบขอ" ถูกจูนไว้รอบสี่สิบหก
 * ให้พอดีกล่อง 1,306px **โดยไม่มีแถบเมนูกินที่** · แถบกางกว้าง 240px ⇒ ตารางตกขอบ
 * ทันทีบนจอ 1440 · ยุบเหลือ 56px แล้วได้ที่คืน 184px ตารางกลับมาพอดีเหมือนเดิม
 */
const COLLAPSE_KEY = 'jarvis:nav-collapsed';

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    // โหมดส่วนตัว/localStorage ถูกปิด — กางไว้ (ทางที่คนใหม่เห็นเมนูครบ)
    return false;
  }
}

const GroupLabel: React.FC<{ children: React.ReactNode; collapsed: boolean }> = ({
  children,
  collapsed,
}) =>
  collapsed ? (
    // ยุบแล้วยังต้องมีเส้นคั่นกลุ่ม ไม่งั้นไอคอน 10 อันกลายเป็นแถวเดียวยาวอ่านไม่ออก
    <div className="mx-3 my-2 border-t border-white/60 dark:border-white/10" aria-hidden />
  ) : (
    <div className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </div>
  );

/**
 * 🔴 **ป้ายต้องบอกว่ามันนับอะไร** — เลขทั้ง 6 ขั้นนับคนละเรื่องกัน (ยอดสะสมบ้าง
 * ของที่ต้องลงมือบ้าง) · เดิมเป็นเลขลอย ๆ ⇒ คนใหม่เห็น "ประกาศรับ 1" ข้างหน้าแรก
 * ที่บอก "ประกาศแล้ว 176" แล้วสรุปว่าระบบมั่ว · คำแปลอยู่ `CONVEYOR_BADGE_MEANING`
 */
const Badge: React.FC<{ value: number; urgent: boolean; meaning: string }> = ({
  value,
  urgent,
  meaning,
}) => (
  <span
    title={meaning}
    className={cn(
      'ml-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums',
      urgent
        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200'
        : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700/70 dark:text-slate-300',
    )}
  >
    {value}
  </span>
);

const rowClass = (active: boolean, collapsed: boolean) =>
  cn(
    'flex h-11 items-center rounded-xl text-sm font-medium transition-colors',
    collapsed ? 'justify-center px-0' : 'gap-2.5 px-3',
    active
      ? 'bg-blue-500/10 text-blue-700 shadow-[inset_3px_0_0_theme(colors.blue.500)] dark:bg-blue-400/15 dark:text-blue-200'
      : 'text-foreground/80 hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10',
  );

/** เลขขั้นในกรอบสี่เหลี่ยม — สว่างขึ้นเมื่ออยู่ขั้นนั้น */
const StepChip: React.FC<{ n: number; active: boolean }> = ({ n, active }) => (
  <span
    className={cn(
      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold',
      active
        ? 'bg-blue-500 text-white'
        : 'bg-slate-200/80 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
    )}
  >
    {n}
  </span>
);

const ConveyorSidebar: React.FC = () => {
  const { pathname, search } = useLocation();
  const { isFunctionEnabled } = useRolePermissions();
  const counts = useConveyorCounts();
  const [collapsed, setCollapsed] = React.useState(loadCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      // เก็บไม่ได้ก็ยังยุบได้ในรอบนี้ — แค่ไม่จำข้ามครั้ง
    }
  };

  const badgeFor = (key: ConveyorBadgeKey) => {
    if (collapsed) return null;
    const b = conveyorBadge(counts, key);
    return b ? (
      <Badge value={b.value} urgent={b.urgent} meaning={CONVEYOR_BADGE_MEANING[key]} />
    ) : null;
  };

  const steps = CONVEYOR_STEPS.filter((s) => !s.functionId || isFunctionEnabled(s.functionId));
  const vault = CONVEYOR_VAULT.filter((v) => !v.functionId || isFunctionEnabled(v.functionId));

  /**
   * ยุบแล้วเหลือแต่ไอคอน ⇒ ป้ายกำกับต้องย้ายไป title ไม่งั้นไม่มีอะไรบอกว่าปุ่มไหนคืออะไร
   * และถ้าขั้นนั้นมีเลขแปะอยู่ ให้ **ต่อคำอธิบายเลขเข้าไปด้วย** — ชี้ตรงไหนของแถวก็รู้
   */
  const titleOf = (label: string, blurb: string, key?: ConveyorBadgeKey) => {
    const head = collapsed ? `${label} — ${blurb}` : blurb;
    if (!key || typeof counts[key] !== 'number') return head;
    return `${head}\nเลขที่แปะอยู่ = ${CONVEYOR_BADGE_MEANING[key]}`;
  };

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-[100dvh] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-white/60 bg-white/55 py-4 backdrop-blur-xl transition-[width] duration-200 lg:flex dark:border-white/10 dark:bg-slate-900/50',
        collapsed ? 'w-14 px-1.5' : 'w-60 px-3',
      )}
      aria-label="เมนูสายพานงาน"
    >
      <GroupLabel collapsed={collapsed}>งานของฉัน</GroupLabel>
      <Link
        to={CONVEYOR_HOME.path}
        className={rowClass(pathname === '/', collapsed)}
        title={titleOf(CONVEYOR_HOME.label, CONVEYOR_HOME.blurb, 'today')}
      >
        <CONVEYOR_HOME.icon className="h-4 w-4 shrink-0" aria-hidden />
        {collapsed ? null : <span className="truncate">{CONVEYOR_HOME.label}</span>}
        {badgeFor('today')}
      </Link>

      <GroupLabel collapsed={collapsed}>สายพานงาน</GroupLabel>
      {steps.map((step) => {
        const active = isStepActive(step, pathname, search);
        return (
          <Link
            key={step.key}
            to={step.path}
            className={rowClass(active, collapsed)}
            title={titleOf(`ขั้นที่ ${step.step} · ${step.label}`, step.blurb, step.key)}
          >
            <StepChip n={step.step} active={active} />
            {collapsed ? null : <span className="truncate">{step.label}</span>}
            {badgeFor(step.key)}
          </Link>
        );
      })}

      <GroupLabel collapsed={collapsed}>คลังข้อมูล</GroupLabel>
      {vault.map((item) => (
        <Link
          key={item.key}
          to={item.path}
          className={rowClass(isVaultActive(item, pathname), collapsed)}
          title={titleOf(item.label, item.blurb)}
        >
          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
          {collapsed ? null : <span className="truncate">{item.label}</span>}
        </Link>
      ))}

      <div className="flex-1" />
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'กางแถบเมนู' : 'ยุบแถบเมนูให้เหลือไอคอน'}
        title={
          collapsed
            ? 'กางแถบเมนู'
            : 'ยุบแถบเมนู — ได้พื้นที่คืน 184px สำหรับหน้าที่มีตารางกว้าง'
        }
        className={cn(
          'mt-2 flex h-9 items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10',
          collapsed ? 'justify-center' : 'gap-2 px-3',
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" aria-hidden />
        ) : (
          <>
            <PanelLeftClose className="h-4 w-4" aria-hidden />
            <span className="text-xs">ยุบแถบเมนู</span>
          </>
        )}
      </button>
    </aside>
  );
};

export default ConveyorSidebar;
