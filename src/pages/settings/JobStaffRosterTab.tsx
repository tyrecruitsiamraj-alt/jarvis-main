import React, { useCallback, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import {
  fetchJobStaffState,
  mutateJobStaffForBu,
  type JobStaffApiState,
} from '@/lib/jobStaffRemote';
import { useAuth } from '@/contexts/AuthContext';
import { APP_DEPARTMENT_CODES, APP_DEPARTMENT_LABELS } from '@/lib/departmentCodes';
import { cn } from '@/lib/utils';

type RosterKind = 'recruiter' | 'screener' | 'opl';

const BU_STORAGE_KEY = 'jarvis:job-staff-roster-bu';

function RosterSection({
  kind,
  title,
  names,
  bu,
  onState,
}: {
  kind: RosterKind;
  title: string;
  names: string[];
  bu: string;
  onState: (s: JobStaffApiState) => void;
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const t = draft.trim();
    if (!t || busy) return;
    setBusy(true);
    const res = await mutateJobStaffForBu({ op: 'add', role: kind, name: t }, bu);
    setBusy(false);
    if (!res.ok) window.alert(res.message ?? 'บันทึกไม่สำเร็จ');
    else {
      setDraft('');
      if (res.state) onState(res.state);
    }
  };

  const remove = async (name: string) => {
    if (!window.confirm(`ลบ «${name}» ออกจากรายการ (BU ${bu})?\nงานเดิมที่มอบหมายชื่อนี้ยังคงแสดงในประวัติตามเดิม`)) return;
    if (busy) return;
    setBusy(true);
    const res = await mutateJobStaffForBu({ op: 'remove', role: kind, name }, bu);
    setBusy(false);
    if (!res.ok) window.alert(res.message ?? 'บันทึกไม่สำเร็จ');
    else if (res.state) onState(res.state);
  };

  const startEdit = (name: string) => {
    setEditing(name);
    setEditValue(name);
  };

  const saveEdit = async (original: string) => {
    const t = editValue.trim();
    if (!t || busy) return;
    setBusy(true);
    const res = await mutateJobStaffForBu(
      { op: 'rename', role: kind, oldName: original, newName: t },
      bu,
    );
    setBusy(false);
    if (!res.ok) window.alert(res.message ?? 'บันทึกไม่สำเร็จ');
    else {
      setEditing(null);
      if (res.state) onState(res.state);
    }
  };

  return (
    <div className="glass-card rounded-xl border border-border p-4 space-y-3">
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">
        รายชื่อสำหรับเลือกในฟอร์มงานและตัวกรอง ชื่อจากงานเก่าที่ยังไม่ได้อยู่ในรายการนี้จะยังโผล่ในดรอปดาวน์ตามข้อมูลงาน
      </p>
      <ul className="space-y-2">
        {names.length === 0 && (
          <li className="text-sm text-muted-foreground italic">ยังไม่มีชื่อในรายการ — เพิ่มด้านล่าง</li>
        )}
        {names.map((name) => (
          <li
            key={name}
            className="flex flex-wrap items-center gap-2 py-1.5 border-b border-border/40 last:border-0"
          >
            {editing === name ? (
              <>
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 min-w-[140px] jarvis-soft-field px-2 py-1.5 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveEdit(name);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => void saveEdit(name)}
                  disabled={busy}
                  className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground"
                >
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-xs px-2 py-1 rounded bg-secondary text-muted-foreground"
                >
                  ยกเลิก
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-foreground">{name}</span>
                <button
                  type="button"
                  onClick={() => startEdit(name)}
                  className="text-xs px-2 py-1 rounded bg-secondary text-blue-600 hover:underline"
                >
                  เปลี่ยนชื่อ
                </button>
                <button
                  type="button"
                  onClick={() => void remove(name)}
                  disabled={busy}
                  className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  ลบ
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="พิมพ์ชื่อใหม่แล้วกดเพิ่ม"
          className="flex-1 min-w-[180px] jarvis-soft-field"
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void add()}
          className={cn(
            'text-sm px-4 py-2 rounded-lg font-medium',
            'bg-primary text-primary-foreground hover:opacity-90',
          )}
        >
          {busy ? 'กำลังบันทึก…' : 'เพิ่มชื่อ'}
        </button>
      </div>
    </div>
  );
}

function initialBu(userDept?: string | null): string {
  try {
    const stored = sessionStorage.getItem(BU_STORAGE_KEY);
    if (stored && (APP_DEPARTMENT_CODES as readonly string[]).includes(stored)) return stored;
  } catch {
    /* ignore */
  }
  const dept = (userDept || '').trim().toUpperCase();
  if ((APP_DEPARTMENT_CODES as readonly string[]).includes(dept)) return dept;
  return APP_DEPARTMENT_CODES[0];
}

const JobStaffRosterTab: React.FC = () => {
  const { user } = useAuth();
  const [bu, setBu] = useState<string>(() => initialBu(user?.department_code));
  const [state, setState] = useState<JobStaffApiState | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const s = await fetchJobStaffState(bu);
    setState(s);
    setLoading(false);
  }, [bu]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    try {
      sessionStorage.setItem(BU_STORAGE_KEY, bu);
    } catch {
      /* ignore */
    }
  }, [bu]);

  return (
    <div className="space-y-4">
      <div className="jarvis-menu-card rounded-[1.5rem] border border-white/70 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Lock className="h-4 w-4" />
          </span>
          เลือก BU แล้วล็อกจัดการรายชื่อตามนั้น
        </div>
        <div className="flex flex-wrap gap-2">
          {APP_DEPARTMENT_CODES.map((code) => {
            const active = bu === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setBu(code)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {APP_DEPARTMENT_LABELS[code]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          กำลังจัดการรายชื่อของ BU{' '}
          <span className="font-semibold text-foreground">{bu}</span> — ชื่อที่เพิ่ม/แก้จะเห็นเฉพาะ BU นี้
          (รายชื่อเดิมที่ยังไม่ได้ระบุ BU จะยังแสดงอยู่ทุก BU)
        </p>
      </div>

      {loading && !state ? (
        <p className="text-sm text-muted-foreground animate-pulse py-6 text-center">กำลังโหลดรายชื่อ…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <RosterSection
            kind="recruiter"
            title="เจ้าหน้าที่สรรหา"
            names={state?.recruiters ?? []}
            bu={bu}
            onState={setState}
          />
          <RosterSection
            kind="screener"
            title="เจ้าหน้าที่คัดสรร"
            names={state?.screeners ?? []}
            bu={bu}
            onState={setState}
          />
          <RosterSection
            kind="opl"
            title="เจ้าหน้าที่ OPL"
            names={state?.opls ?? []}
            bu={bu}
            onState={setState}
          />
        </div>
      )}
    </div>
  );
};

export default JobStaffRosterTab;
