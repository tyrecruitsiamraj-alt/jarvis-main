import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import type { User, AuditLog } from '@/types';
import { Users, Shield, Database, FileText, Palette, UserCog, ListChecks, SlidersHorizontal, PhoneForwarded, MoveRight, Activity,
  MessageSquareText,
  PhoneOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandingAppearanceTab from '@/pages/settings/BrandingAppearanceTab';
import JobStaffRosterTab from '@/pages/settings/JobStaffRosterTab';
import RolePermissionsTab from '@/pages/settings/RolePermissionsTab';
import WorkStatusMasterTab from '@/pages/settings/WorkStatusMasterTab';
import MatchPriorityWeightsTab from '@/pages/settings/MatchPriorityWeightsTab';
import LumosDispatchModeTab from '@/pages/settings/LumosDispatchModeTab';
import CallScriptsTab from '@/pages/settings/CallScriptsTab';
import CallSuppressionTab from '@/pages/settings/CallSuppressionTab';
import ApplicationAutoMoveTab from '@/pages/settings/ApplicationAutoMoveTab';
import SystemHealthTab from '@/pages/settings/SystemHealthTab';
import NavMenuTab from '@/pages/settings/NavMenuTab';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { getTotalPages, type PageSizeOption } from '@/lib/pagination';
import { parseAppUser, parseAppUserList, isUserRole } from '@/lib/userApi';
import { APP_DEPARTMENT_CODES, APP_DEPARTMENT_LABELS } from '@/lib/departmentCodes';
import {
  buildSettingsNav,
  isSettingsTabId,
  SETTINGS_TAB_IDS,
  type SettingsTabId,
} from '@/lib/settingsNav';
import { TONE } from '@/lib/designTokens';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

/** ⚠️ ชนิด + ป้ายชื่อ + การจัดกลุ่ม อยู่ที่ `src/lib/settingsNav.ts` ที่เดียว (มีเทสต์คุม) */
type SettingsTab = SettingsTabId;
type ReferenceCategory = 'สถานะพนักงาน' | 'ลักษณะงาน' | 'ประเภทงาน' | 'สาเหตุปัญหา' | 'ผลการขับรถ';

const REF_DATA_STORAGE_KEY = 'jarvis_reference_data_v1';
const REF_CATEGORIES: ReferenceCategory[] = [
  'สถานะพนักงาน',
  'ลักษณะงาน',
  'ประเภทงาน',
  'สาเหตุปัญหา',
  'ผลการขับรถ',
];
const DEFAULT_REF_DATA: Record<ReferenceCategory, string[]> = {
  สถานะพนักงาน: ['ผ่านงาน', 'รออบรม', 'หยุดงาน'],
  ลักษณะงาน: ['ผู้บริหารคนไทย', 'ผู้บริหารต่างชาติ', 'ส่วนกลาง', 'Valet Parking'],
  ประเภทงาน: ['เอกชน', 'ราชการ', 'ธนาคาร'],
  สาเหตุปัญหา: ['มาสาย', 'ขาดงาน', 'เอกสารไม่ครบ'],
  ผลการขับรถ: ['ผ่าน', 'ไม่ผ่าน', 'ยังไม่ทดสอบ'],
};

/**
 * ไอคอนของแต่ละแท็บ — อยู่ที่ไฟล์หน้าเพราะเป็นเรื่องการแสดงผมล้วน ๆ
 * (ป้ายชื่อ/คำอธิบาย/กลุ่ม อยู่ที่ `lib/settingsNav.ts`)
 */
const TAB_ICON: Record<SettingsTab, React.ElementType> = {
  appearance: Palette,
  navMenu: ListChecks,
  users: Users,
  roles: Shield,
  jobStaff: UserCog,
  workStatus: ListChecks,
  matchWeights: SlidersHorizontal,
  lumosMode: PhoneForwarded,
  callScripts: MessageSquareText,
  callSuppression: PhoneOff,
  autoMove: MoveRight,
  health: Activity,
  reference: Database,
  audit: FileText,
};

/** แท็บเดียวที่คนไม่ใช่ admin เข้าได้ (ของเดิม: adminOnly = false เฉพาะ appearance) */
const NON_ADMIN_TABS: readonly SettingsTab[] = ['appearance'];

const AdminSettings: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const canAdmin = hasPermission('admin');
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  // ⚠️ ตัวคัดค่าอยู่ที่ `isSettingsTabId` แล้ว — เดิมไล่เทียบทีละชื่อ 11 บรรทัด
  // แล้ว 'navMenu' หายไปจากรายการ (ลิงก์ ?tab=navMenu จึงเด้งกลับ users)
  const initialTab: SettingsTab = isSettingsTabId(tabFromUrl) ? tabFromUrl : 'users';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  /**
   * เมนูที่คนนี้เห็นได้ — จัดกลุ่มที่ `lib/settingsNav.ts` ที่เดียว
   * (คนไม่ใช่ admin เข้าได้แค่ธีม/โลโก้ เหมือนเดิม)
   */
  const navGroups = React.useMemo(
    () => buildSettingsNav(canAdmin ? SETTINGS_TAB_IDS : NON_ADMIN_TABS),
    [canAdmin],
  );
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiAuditLogs, setApiAuditLogs] = useState<AuditLog[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  // แบ่งหน้าผู้ใช้ — เริ่มที่ 10 คน/หน้า เลือกได้เอง (ใช้แถบเลขหน้ากลางของระบบ)
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState<PageSizeOption>(10);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState<PageSizeOption>(20);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [userActionError, setUserActionError] = useState('');
  const [userActionOk, setUserActionOk] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [referenceData, setReferenceData] = useState<Record<ReferenceCategory, string[]>>(DEFAULT_REF_DATA);
  const [editingCategory, setEditingCategory] = useState<ReferenceCategory | null>(null);
  const [newRefValue, setNewRefValue] = useState('');

  useEffect(() => {
    if (!canAdmin) return;
    if (activeTab === 'users') {
      setUsersLoading(true);
      apiFetch('/api/app-users')
        .then(async (r) => {
          if (!r.ok) return [];
          return parseAppUserList(await r.json());
        })
        .then((d) => setApiUsers(d))
        .catch(() => setApiUsers([]))
        .finally(() => setUsersLoading(false));
    }
    if (activeTab === 'audit') {
      setAuditLoading(true);
      apiFetch('/api/audit-logs?limit=200')
        .then(async (r) => (r.ok ? ((await r.json()) as AuditLog[]) : []))
        .then((d) => setApiAuditLogs(Array.isArray(d) ? d : []))
        .catch(() => setApiAuditLogs([]))
        .finally(() => setAuditLoading(false));
    }
  }, [canAdmin, activeTab]);

  useEffect(() => {
    if (activeTab !== 'users') return;
    setUserActionError('');
    setUserActionOk('');
  }, [activeTab]);

  // แบ่งหน้าผู้ใช้ + กันค้างอยู่หน้าที่หายไปเมื่อจำนวนคนหรือจำนวนต่อหน้าเปลี่ยน
  const userTotalPages = getTotalPages(apiUsers.length, userPageSize);
  const currentUserPage = Math.min(userPage, userTotalPages);
  const userPageStart = (currentUserPage - 1) * userPageSize;
  const visibleUsers = apiUsers.slice(userPageStart, userPageStart + userPageSize);
  useEffect(() => {
    if (userPage > userTotalPages) setUserPage(userTotalPages);
  }, [userPage, userTotalPages]);

  const userPaginationBar = (
    <ListPaginationBar
      page={currentUserPage}
      pageSize={userPageSize}
      totalItems={apiUsers.length}
      totalPages={userTotalPages}
      pageFrom={apiUsers.length === 0 ? 0 : userPageStart + 1}
      pageTo={userPageStart + visibleUsers.length}
      onPageChange={setUserPage}
      onPageSizeChange={(size) => {
        setUserPageSize(size);
        setUserPage(1);
      }}
    />
  );

  // แบ่งหน้า audit log — บันทึกเยอะ ต้องดูทีละหน้าเหมือนตารางอื่น
  const auditTotalPages = getTotalPages(apiAuditLogs.length, auditPageSize);
  const currentAuditPage = Math.min(auditPage, auditTotalPages);
  const auditPageStart = (currentAuditPage - 1) * auditPageSize;
  const visibleAuditLogs = apiAuditLogs.slice(auditPageStart, auditPageStart + auditPageSize);
  useEffect(() => {
    if (auditPage > auditTotalPages) setAuditPage(auditTotalPages);
  }, [auditPage, auditTotalPages]);

  const updateUser = async (
    id: string,
    patch: { role?: User['role']; is_active?: boolean; department_code?: string | null; phone?: string | null },
  ) => {
    setSavingUserId(id);
    setUserActionError('');
    setUserActionOk('');
    try {
      const r = await apiFetch('/api/app-users', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...patch }),
      });
      const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        const msg =
          typeof body.message === 'string'
            ? body.message
            : typeof body.error === 'string'
              ? body.error
              : 'ไม่สามารถอัปเดตสิทธิ์ผู้ใช้ได้';
        setUserActionError(msg);
        return;
      }
      const updated = parseAppUser(body);
      if (!updated) {
        setUserActionError('รูปแบบข้อมูลผู้ใช้จากเซิร์ฟเวอร์ไม่ถูกต้อง');
        return;
      }
      setApiUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      setUserActionOk('บันทึกสิทธิ์ผู้ใช้เรียบร้อย');
    } catch {
      setUserActionError('เกิดข้อผิดพลาดระหว่างอัปเดตสิทธิ์ผู้ใช้');
    } finally {
      setSavingUserId(null);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REF_DATA_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<ReferenceCategory, string[]>>;
      const merged: Record<ReferenceCategory, string[]> = { ...DEFAULT_REF_DATA };
      for (const k of REF_CATEGORIES) {
        const arr = parsed[k];
        if (Array.isArray(arr)) {
          merged[k] = arr.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
        }
      }
      setReferenceData(merged);
    } catch {
      /* ignore bad storage */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(REF_DATA_STORAGE_KEY, JSON.stringify(referenceData));
    } catch {
      /* ignore storage quota/private mode */
    }
  }, [referenceData]);

  const openReferenceEditor = (cat: ReferenceCategory) => {
    setEditingCategory(cat);
    setNewRefValue('');
  };

  const addReferenceValue = () => {
    if (!editingCategory) return;
    const v = newRefValue.trim();
    if (!v) return;
    setReferenceData((prev) => {
      const current = prev[editingCategory];
      if (current.some((x) => x.toLowerCase() === v.toLowerCase())) return prev;
      return { ...prev, [editingCategory]: [...current, v] };
    });
    setNewRefValue('');
  };

  const removeReferenceValue = (cat: ReferenceCategory, idx: number) => {
    setReferenceData((prev) => ({
      ...prev,
      [cat]: prev[cat].filter((_, i) => i !== idx),
    }));
  };

  if (!canAdmin) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะ Admin)</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="ตั้งค่าระบบ" />
      <div className="px-4 md:px-6 space-y-4">
        {/**
         * เมนูซ้ายแบ่งกลุ่ม (เจ้าของเคาะ 20 ส.ค. 2569 — เดิมเป็นแท็บ 12 อันแถวเดียว
         * เลื่อนซ้ายขวา เห็นพร้อมกันจริงแค่ ~8 อัน และไม่มีการจัดกลุ่มเลย)
         * 🔴 จอเล็กใช้ดรอปดาวน์แทน **ห้ามกลับไปเป็นแถวเลื่อนซ้ายขวา** — นั่นคือปัญหาเดิม
         */}
        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          {/* จอเล็ก: ดรอปดาวน์ (จัดกลุ่มด้วย SelectGroup เหมือนกัน) */}
          <div className="lg:hidden">
            <Select
              value={activeTab}
              onValueChange={(v) => {
                if (isSettingsTabId(v)) setActiveTab(v);
              }}
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="เลือกหัวข้อตั้งค่า" />
              </SelectTrigger>
              <SelectContent>
                {navGroups.map((g) => (
                  <SelectGroup key={g.id}>
                    <SelectLabel>{g.label}</SelectLabel>
                    {g.tabs.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* จอใหญ่: เมนูซ้าย เห็นทั้ง 12 หัวข้อพร้อมกัน ไม่ต้องเลื่อน */}
          <nav aria-label="หัวข้อตั้งค่า" className="hidden lg:block lg:sticky lg:top-4">
            <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-3">
              {navGroups.map((g) => (
                <div key={g.id} className="space-y-1">
                  <p className="px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </p>
                  {g.tabs.map((t) => {
                    const Icon = TAB_ICON[t.id];
                    const active = activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id)}
                        aria-current={active ? 'page' : undefined}
                        title={t.hint}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors',
                          active
                            ? cn(TONE.primary.soft, 'font-semibold')
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active && TONE.primary.value)} />
                        <span className="min-w-0">
                          <span className={cn('block text-sm leading-snug', active && TONE.primary.value)}>
                            {t.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                            {t.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </nav>

          <div className="min-w-0 space-y-4">

        {activeTab === 'appearance' && <BrandingAppearanceTab />}

        {activeTab === 'navMenu' && <NavMenuTab />}

        {activeTab === 'users' &&
          (usersLoading ? (
            <p className="text-sm text-muted-foreground p-4">กำลังโหลดรายชื่อผู้ใช้…</p>
          ) : (
            <div className="glass-card rounded-xl border border-border overflow-x-auto">
              {userActionError ? (
                <div className="mx-4 mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {userActionError}
                </div>
              ) : null}
              {userActionOk ? (
                <div className="mx-4 mt-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
                  {userActionOk}
                </div>
              ) : null}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium">ชื่อ</th>
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium">Username</th>
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium">Email</th>
                    <th className="px-4 py-3 text-center text-muted-foreground font-medium">Role</th>
                    <th className="px-4 py-3 text-center text-muted-foreground font-medium">แผนก</th>
                    <th className="px-4 py-3 text-center text-muted-foreground font-medium">เบอร์โทร</th>
                    <th className="px-4 py-3 text-center text-muted-foreground font-medium">สถานะ</th>
                    <th className="px-4 py-3 text-center text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiUsers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                        ยังไม่มีผู้ใช้ (หรือโหลดไม่สำเร็จ)
                      </td>
                    </tr>
                  )}
                  {visibleUsers.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="px-4 py-3 font-medium text-foreground">{u.full_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.username}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={u.role}
                          disabled={savingUserId === u.id}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!isUserRole(next)) return;
                            if (next === u.role) return;
                            void updateUser(u.id, { role: next });
                          }}
                          className={cn(
                            'rounded-md border border-border bg-secondary px-2 py-1 text-xs',
                            savingUserId === u.id && 'opacity-60',
                          )}
                        >
                          <option value="admin">admin</option>
                          <option value="supervisor">supervisor</option>
                          <option value="staff">staff</option>
                          <option value="opl">opl (อ่านอย่างเดียว)</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={u.department_code || ''}
                          disabled={savingUserId === u.id}
                          onChange={(e) => {
                            const next = e.target.value.trim().toUpperCase() || null;
                            const cur = u.department_code || null;
                            if (next === cur) return;
                            void updateUser(u.id, { department_code: next });
                          }}
                          className={cn(
                            'rounded-md border border-border bg-secondary px-2 py-1 text-xs min-w-[5.5rem]',
                            savingUserId === u.id && 'opacity-60',
                          )}
                          title="ล็อกให้เห็นใบขอเฉพาะแผนกนี้ (ว่าง = บังคับให้ผู้ใช้เลือกตอนเข้าครั้งแรก)"
                        >
                          <option value="">ยังไม่ตั้ง</option>
                          {APP_DEPARTMENT_CODES.map((code) => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Input
                          type="tel"
                          key={`${u.id}-${u.phone || ''}`}
                          defaultValue={u.phone || ''}
                          disabled={savingUserId === u.id}
                          placeholder="08xxxxxxxx"
                          title="เบอร์นี้เป็น admin_phone ที่ AI โทรกลับเมื่อโทรหาผู้สมัครไม่สำเร็จ"
                          className={cn(
                            'h-8 w-32 mx-auto text-center text-xs',
                            savingUserId === u.id && 'opacity-60',
                          )}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            const cur = u.phone || '';
                            if (next === cur) return;
                            void updateUser(u.id, { phone: next || null });
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          disabled={savingUserId === u.id}
                          onClick={() => void updateUser(u.id, { is_active: !u.is_active })}
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full transition-colors',
                            u.is_active
                              ? 'bg-success/15 text-success hover:bg-success/25'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                            savingUserId === u.id && 'opacity-60',
                          )}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center text-[11px] text-muted-foreground">
                        {user?.id === u.id ? 'คุณ' : savingUserId === u.id ? 'saving…' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 pb-4">{userPaginationBar}</div>
            </div>
          ))}

        {activeTab === 'jobStaff' && <JobStaffRosterTab />}

        {activeTab === 'roles' && <RolePermissionsTab />}

        {activeTab === 'workStatus' && <WorkStatusMasterTab />}
        {activeTab === 'matchWeights' && <MatchPriorityWeightsTab />}
        {activeTab === 'lumosMode' && <LumosDispatchModeTab />}
        {activeTab === 'callScripts' && <CallScriptsTab />}
        {activeTab === 'callSuppression' && <CallSuppressionTab />}
        {activeTab === 'autoMove' && <ApplicationAutoMoveTab />}
        {activeTab === 'health' && <SystemHealthTab />}

        {activeTab === 'reference' && (
          <div className="space-y-3">
            {REF_CATEGORIES.map((cat) => (
              <div key={cat} className="glass-card rounded-[1.5rem] p-4 border border-white/70">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground text-sm">{cat}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {referenceData[cat].length} รายการ
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openReferenceEditor(cat)}
                    className="text-xs px-2 py-1 rounded bg-blue-500/12 text-blue-600 hover:bg-blue-500/15"
                  >
                    จัดการ
                  </button>
                </div>
              </div>
            ))}

            {editingCategory && (
              <div className="glass-card rounded-[1.5rem] p-4 border border-white/70">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-foreground">จัดการ: {editingCategory}</div>
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="text-xs px-2 py-1 rounded bg-secondary text-muted-foreground"
                  >
                    ปิด
                  </button>
                </div>

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newRefValue}
                    onChange={(e) => setNewRefValue(e.target.value)}
                    placeholder="เพิ่มรายการใหม่"
                    className="jarvis-soft-field flex-1"
                  />
                  <button
                    type="button"
                    onClick={addReferenceValue}
                    className="px-3 py-2 jarvis-pill-btn text-sm"
                  >
                    เพิ่ม
                  </button>
                </div>

                <div className="space-y-2">
                  {referenceData[editingCategory].map((item, idx) => (
                    <div key={`${item}-${idx}`} className="flex items-center justify-between rounded border border-border px-3 py-2">
                      <span className="text-sm text-foreground">{item}</span>
                      <button
                        type="button"
                        onClick={() => removeReferenceValue(editingCategory, idx)}
                        className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive"
                      >
                        ลบ
                      </button>
                    </div>
                  ))}
                  {referenceData[editingCategory].length === 0 && (
                    <div className="text-sm text-muted-foreground">ยังไม่มีรายการ</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'audit' &&
          (auditLoading ? (
            <p className="text-sm text-muted-foreground p-4">กำลังโหลด audit log…</p>
          ) : apiAuditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground glass-card rounded-[1.5rem] p-4 border border-white/70">
              ยังไม่มีบันทึกใน audit log (ระบบจะเพิ่มเมื่อมีการบันทึกผ่าน API)
            </p>
          ) : (
            <div className="space-y-2">
              {visibleAuditLogs.map((log) => (
                <div key={log.id} className="glass-card rounded-lg p-3 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{log.user_name}</span>
                    <span className="text-[10px] text-muted-foreground">{log.timestamp}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded mr-1',
                        log.action === 'CREATE'
                          ? 'bg-success/15 text-success'
                          : log.action === 'UPDATE'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-destructive/15 text-destructive',
                      )}
                    >
                      {log.action}
                    </span>
                    {log.entity_type} • {log.new_value}
                    {log.old_value && <span className="text-muted-foreground/60"> (เดิม: {log.old_value})</span>}
                  </div>
                </div>
              ))}
              <ListPaginationBar
                page={currentAuditPage}
                pageSize={auditPageSize}
                totalItems={apiAuditLogs.length}
                totalPages={auditTotalPages}
                pageFrom={auditPageStart + 1}
                pageTo={auditPageStart + visibleAuditLogs.length}
                onPageChange={setAuditPage}
                onPageSizeChange={(size) => {
                  setAuditPageSize(size);
                  setAuditPage(1);
                }}
              />
            </div>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
