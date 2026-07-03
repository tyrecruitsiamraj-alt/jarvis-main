import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import type { User, AuditLog } from '@/types';
import { Users, Shield, Database, FileText, Palette, UserCog, HeartPulse, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandingAppearanceTab from '@/pages/settings/BrandingAppearanceTab';
import JobStaffRosterTab from '@/pages/settings/JobStaffRosterTab';
import RolePermissionsTab from '@/pages/settings/RolePermissionsTab';
import VercelOutboundIpTab from '@/pages/settings/VercelOutboundIpTab';
import DriverCareResourcesPanel from '@/components/driver-care/DriverCareResourcesPanel';
import { parseAppUser, parseAppUserList, isUserRole } from '@/lib/userApi';

type SettingsTab = 'appearance' | 'users' | 'roles' | 'jobStaff' | 'reference' | 'audit' | 'driverCare' | 'outboundIp';
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

const allTabs: { id: SettingsTab; label: string; icon: React.ElementType; adminOnly: boolean }[] = [
  { id: 'appearance', label: 'ธีม / โลโก้', icon: Palette, adminOnly: false },
  { id: 'users', label: 'Users', icon: Users, adminOnly: true },
  { id: 'roles', label: 'Roles', icon: Shield, adminOnly: true },
  { id: 'jobStaff', label: 'สรรหา / คัดสรร', icon: UserCog, adminOnly: true },
  { id: 'driverCare', label: 'Driver Care', icon: HeartPulse, adminOnly: true },
  { id: 'outboundIp', label: 'Vercel IP', icon: Globe, adminOnly: true },
  { id: 'reference', label: 'Reference Data', icon: Database, adminOnly: true },
  { id: 'audit', label: 'Audit Log', icon: FileText, adminOnly: true },
];

const AdminSettings: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const canAdmin = hasPermission('admin');
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const initialTab: SettingsTab =
    tabFromUrl === 'driverCare' ||
    tabFromUrl === 'outboundIp' ||
    tabFromUrl === 'appearance' ||
    tabFromUrl === 'users' ||
    tabFromUrl === 'roles' ||
    tabFromUrl === 'jobStaff' ||
    tabFromUrl === 'reference' ||
    tabFromUrl === 'audit'
      ? tabFromUrl
      : 'users';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiAuditLogs, setApiAuditLogs] = useState<AuditLog[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
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

  const updateUser = async (id: string, patch: { role?: User['role']; is_active?: boolean }) => {
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
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {allTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'appearance' && <BrandingAppearanceTab />}

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
                    <th className="px-4 py-3 text-center text-muted-foreground font-medium">สถานะ</th>
                    <th className="px-4 py-3 text-center text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                        ยังไม่มีผู้ใช้ (หรือโหลดไม่สำเร็จ)
                      </td>
                    </tr>
                  )}
                  {apiUsers.map((u) => (
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
            </div>
          ))}

        {activeTab === 'users' && !usersLoading && (
          <div className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-3">
            <div className="text-sm font-semibold text-foreground">จัดการสิทธิ์ผู้ใช้</div>
            {userActionError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {userActionError}
              </div>
            ) : null}
            {userActionOk ? (
              <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
                {userActionOk}
              </div>
            ) : null}

            <div className="space-y-2">
              {apiUsers.map((u) => (
                <div key={`manage-${u.id}`} className="rounded-lg border border-border p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{u.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
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

                    <button
                      type="button"
                      disabled={savingUserId === u.id}
                      onClick={() => void updateUser(u.id, { is_active: !u.is_active })}
                      className={cn(
                        'text-xs px-2 py-1 rounded-full transition-colors',
                        u.is_active
                          ? 'bg-success/15 text-success hover:bg-success/25'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80',
                        savingUserId === u.id && 'opacity-60',
                      )}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <span className="text-[11px] text-muted-foreground">
                      {user?.id === u.id ? 'บัญชีของคุณ' : savingUserId === u.id ? 'saving…' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'jobStaff' && <JobStaffRosterTab />}

        {activeTab === 'driverCare' && <DriverCareResourcesPanel />}

        {activeTab === 'outboundIp' && <VercelOutboundIpTab />}

        {activeTab === 'roles' && <RolePermissionsTab />}

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
              {apiAuditLogs.map((log) => (
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
            </div>
          ))}
      </div>
    </div>
  );
};

export default AdminSettings;
