import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { mockUsers, mockAuditLogs } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import type { User, AuditLog } from '@/types';
import { Users, Shield, Database, FileText, Palette, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandingAppearanceTab from '@/pages/settings/BrandingAppearanceTab';
import JobStaffRosterTab from '@/pages/settings/JobStaffRosterTab';
import { isDemoMode } from '@/lib/demoMode';

type SettingsTab = 'appearance' | 'users' | 'roles' | 'jobStaff' | 'reference' | 'audit';
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
  { id: 'reference', label: 'Reference Data', icon: Database, adminOnly: true },
  { id: 'audit', label: 'Audit Log', icon: FileText, adminOnly: true },
];

const AdminSettings: React.FC = () => {
  const { hasPermission } = useAuth();
  const canAdmin = hasPermission('admin');
  const demo = isDemoMode();
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiAuditLogs, setApiAuditLogs] = useState<AuditLog[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [referenceData, setReferenceData] = useState<Record<ReferenceCategory, string[]>>(DEFAULT_REF_DATA);
  const [editingCategory, setEditingCategory] = useState<ReferenceCategory | null>(null);
  const [newRefValue, setNewRefValue] = useState('');

  useEffect(() => {
    if (!canAdmin || demo) return;
    if (activeTab === 'users') {
      setUsersLoading(true);
      apiFetch('/api/app-users')
        .then(async (r) => (r.ok ? ((await r.json()) as User[]) : []))
        .then((d) => setApiUsers(Array.isArray(d) ? d : []))
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
  }, [canAdmin, activeTab, demo]);

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
          (demo ? (
            <div className="glass-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium">ชื่อ</th>
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium">Username</th>
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium">Email</th>
                    <th className="px-4 py-3 text-center text-muted-foreground font-medium">Role</th>
                    <th className="px-4 py-3 text-center text-muted-foreground font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {mockUsers.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="px-4 py-3 font-medium text-foreground">{u.full_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.username}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            u.role === 'admin'
                              ? 'bg-destructive/15 text-destructive'
                              : u.role === 'supervisor'
                                ? 'bg-warning/15 text-warning'
                                : 'bg-info/15 text-info',
                          )}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            u.is_active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : usersLoading ? (
            <p className="text-sm text-muted-foreground p-4">กำลังโหลดรายชื่อผู้ใช้…</p>
          ) : (
            <div className="glass-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium">ชื่อ</th>
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium">Username</th>
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium">Email</th>
                    <th className="px-4 py-3 text-center text-muted-foreground font-medium">Role</th>
                    <th className="px-4 py-3 text-center text-muted-foreground font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {apiUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
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
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            u.role === 'admin'
                              ? 'bg-destructive/15 text-destructive'
                              : u.role === 'supervisor'
                                ? 'bg-warning/15 text-warning'
                                : 'bg-info/15 text-info',
                          )}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            u.is_active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {activeTab === 'jobStaff' && <JobStaffRosterTab />}

        {activeTab === 'roles' && (
          <div className="space-y-3">
            {['admin', 'supervisor', 'staff'].map((role) => (
              <div key={role} className="glass-card rounded-xl p-4 border border-border">
                <div className="font-semibold text-foreground capitalize mb-2">{role}</div>
                <div className="text-sm text-muted-foreground">
                  {role === 'admin'
                    ? 'เข้าถึงได้ทุกหน้า จัดการ users, permissions, master data, dashboard, settings — แก้รายชื่อเจ้าหน้าที่สรรหา/คัดสรรได้ที่แท็บสรรหา / คัดสรร'
                    : role === 'supervisor'
                      ? 'แก้ไขข้อมูลพนักงาน หน่วยงาน แผนงาน สถานะ matching ดู dashboard (ไม่มีสิทธิ์ Settings)'
                      : 'ใช้งานเฉพาะหน้าที่ได้รับมอบหมาย ดู dashboard ได้แต่แก้ไขไม่ได้'}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reference' && (
          <div className="space-y-3">
            {REF_CATEGORIES.map((cat) => (
              <div key={cat} className="glass-card rounded-xl p-4 border border-border">
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
                    className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    จัดการ
                  </button>
                </div>
              </div>
            ))}

            {editingCategory && (
              <div className="glass-card rounded-xl p-4 border border-border">
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
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={addReferenceValue}
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
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
          (demo ? (
            <div className="space-y-2">
              {mockAuditLogs.map((log) => (
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
          ) : auditLoading ? (
            <p className="text-sm text-muted-foreground p-4">กำลังโหลด audit log…</p>
          ) : apiAuditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground glass-card rounded-xl p-4 border border-border">
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
