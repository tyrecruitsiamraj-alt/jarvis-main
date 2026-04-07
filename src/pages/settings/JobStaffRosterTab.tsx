import React, { useEffect, useMemo, useState } from 'react';
import { isDemoMode } from '@/lib/demoMode';
import {
  addRecruiterToRoster,
  addScreenerToRoster,
  getRecruitersRoster,
  getScreenersRoster,
  JOB_STAFF_ROSTER_CHANGED_EVENT,
  removeRecruiterFromRoster,
  removeScreenerFromRoster,
  renameRecruiterRoster,
  renameScreenerRoster,
} from '@/lib/demoStorage';
import { getJobStaffApiCache, mutateJobStaffRemote, refreshJobStaffFromApi } from '@/lib/jobStaffRemote';
import { cn } from '@/lib/utils';

type RosterKind = 'recruiter' | 'screener';

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
    if (isDemoMode()) {
      if (kind === 'recruiter') addRecruiterToRoster(t);
      else addScreenerToRoster(t);
      setDraft('');
      return;
    }
    setBusy(true);
    const res = await mutateJobStaffRemote({ op: 'add', role: kind, name: t });
    setBusy(false);
    if (!res.ok) window.alert(res.message ?? 'บันทึกไม่สำเร็จ');
    else setDraft('');
  };

  const remove = async (name: string) => {
    if (!window.confirm(`ลบ «${name}» ออกจากรายการ?\nงานเดิมที่มอบหมายชื่อนี้ยังคงแสดงในประวัติตามเดิม`)) return;
    if (busy) return;
    if (isDemoMode()) {
      if (kind === 'recruiter') removeRecruiterFromRoster(name);
      else removeScreenerFromRoster(name);
      return;
    }
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
    if (isDemoMode()) {
      if (kind === 'recruiter') renameRecruiterRoster(original, t);
      else renameScreenerRoster(original, t);
      setEditing(null);
      return;
    }
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
                  className="flex-1 min-w-[140px] bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm"
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
                  className="text-xs px-2 py-1 rounded bg-secondary text-primary hover:underline"
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
          className="flex-1 min-w-[180px] bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
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
    if (isDemoMode()) return getRecruitersRoster();
    return getJobStaffApiCache()?.recruiters ?? [];
  }, [rev]);
  const screeners = useMemo(() => {
    void rev;
    if (isDemoMode()) return getScreenersRoster();
    return getJobStaffApiCache()?.screeners ?? [];
  }, [rev]);

  useEffect(() => {
    if (isDemoMode()) return;
    void refreshJobStaffFromApi();
  }, []);

  return (
    <div className="space-y-4">
      {!isDemoMode() && (
        <p className="text-sm text-muted-foreground glass-card rounded-xl p-3 border border-border border-info/30 bg-info/5">
          โหมด API: รายชื่อสรรหา/คัดสรรบันทึกในฐานข้อมูล การเปลี่ยนชื่อจะอัปเดตชื่อบนงานที่ตรงกันด้วย
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <RosterSection kind="recruiter" title="เจ้าหน้าที่สรรหา" names={recruiters} />
        <RosterSection kind="screener" title="เจ้าหน้าที่คัดสรร" names={screeners} />
      </div>
    </div>
  );
};

export default JobStaffRosterTab;
