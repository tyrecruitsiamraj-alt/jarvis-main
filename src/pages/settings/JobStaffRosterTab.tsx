import React, { useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import {
  JOB_STAFF_ROSTER_CHANGED_EVENT,
  getJobStaffApiCache,
  mutateJobStaffRemote,
  refreshJobStaffFromApi,
} from '@/lib/jobStaffRemote';
import { cn } from '@/lib/utils';

type RosterKind = 'recruiter' | 'screener' | 'opl';

function useRosterRev(): number {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const fn = () => setRev((x) => x + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
  }, []);
  return rev;
}

function RosterSection({
  kind,
  title,
  names,
}: {
  kind: RosterKind;
  title: string;
  names: string[];
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const t = draft.trim();
    if (!t || busy) return;
    setBusy(true);
    const res = await mutateJobStaffRemote({ op: 'add', role: kind, name: t });
    setBusy(false);
    if (!res.ok) window.alert(res.message ?? 'บันทึกไม่สำเร็จ');
    else setDraft('');
  };

  const remove = async (name: string) => {
    if (!window.confirm(`ลบ «${name}» ออกจากรายการ?\nงานเดิมที่มอบหมายชื่อนี้ยังคงแสดงในประวัติตามเดิม`)) return;
    if (busy) return;
    setBusy(true);
    const res = await mutateJobStaffRemote({ op: 'remove', role: kind, name });
    setBusy(false);
    if (!res.ok) window.alert(res.message ?? 'บันทึกไม่สำเร็จ');
  };

  const startEdit = (name: string) => {
    setEditing(name);
    setEditValue(name);
  };

  const saveEdit = async (original: string) => {
    const t = editValue.trim();
    if (!t || busy) return;
    setBusy(true);
    const res = await mutateJobStaffRemote({
      op: 'rename',
      role: kind,
      oldName: original,
      newName: t,
    });
    setBusy(false);
    if (!res.ok) window.alert(res.message ?? 'บันทึกไม่สำเร็จ');
    else setEditing(null);
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

const JobStaffRosterTab: React.FC = () => {
  const rev = useRosterRev();
  const recruiters = useMemo(() => {
    void rev;
    return getJobStaffApiCache()?.recruiters ?? [];
  }, [rev]);
  const screeners = useMemo(() => {
    void rev;
    return getJobStaffApiCache()?.screeners ?? [];
  }, [rev]);
  const opls = useMemo(() => {
    void rev;
    return getJobStaffApiCache()?.opls ?? [];
  }, [rev]);
  const bu = useMemo(() => {
    void rev;
    return getJobStaffApiCache()?.bu ?? null;
  }, [rev]);
  const buMode = useMemo(() => {
    void rev;
    return getJobStaffApiCache()?.buMode ?? null;
  }, [rev]);

  useEffect(() => {
    void refreshJobStaffFromApi();
  }, []);

  const needsDepartment = buMode === 'none';

  return (
    <div className="space-y-4">
      <div className="jarvis-menu-card flex items-center gap-3 rounded-[1.5rem] border border-white/70 border-info/30 bg-info/5 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Lock className="h-4 w-4" />
        </span>
        <div className="min-w-0 text-sm text-muted-foreground">
          {buMode === 'code' ? (
            <>
              ล็อกที่ BU{' '}
              <span className="font-semibold text-foreground">{bu}</span> ตามแผนกของบัญชีที่ล็อกอิน —
              รายชื่อที่เพิ่ม/แก้จะเห็นเฉพาะ BU นี้ (รายชื่อเดิมที่ยังไม่มี BU จะยังแสดงอยู่)
            </>
          ) : buMode === 'all' ? (
            <>บัญชีนี้ไม่ผูกแผนก — แสดงรายชื่อ<span className="font-semibold text-foreground">ทุก BU</span></>
          ) : needsDepartment ? (
            <>บัญชีนี้ยังไม่ได้ตั้งแผนก — กรุณาตั้งแผนกให้บัญชีก่อน จึงจะจัดการรายชื่อตาม BU ได้</>
          ) : (
            <>รายชื่อสรรหา/คัดสรร/OPL บันทึกในฐานข้อมูล การเปลี่ยนชื่อจะอัปเดตชื่อบนงานที่ตรงกันด้วย</>
          )}
        </div>
      </div>
      {needsDepartment ? null : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <RosterSection kind="recruiter" title="เจ้าหน้าที่สรรหา" names={recruiters} />
          <RosterSection kind="screener" title="เจ้าหน้าที่คัดสรร" names={screeners} />
          <RosterSection kind="opl" title="เจ้าหน้าที่ OPL" names={opls} />
        </div>
      )}
    </div>
  );
};

export default JobStaffRosterTab;
