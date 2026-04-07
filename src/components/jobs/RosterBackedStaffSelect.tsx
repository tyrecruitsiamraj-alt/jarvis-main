import React, { useMemo, useState } from 'react';
import {
  addRecruiterToRoster,
  addScreenerToRoster,
  getRecruitersRoster,
  getScreenersRoster,
  removeRecruiterFromRoster,
  removeScreenerFromRoster,
} from '@/lib/demoStorage';
import { getJobStaffApiCache, mutateJobStaffRemote } from '@/lib/jobStaffRemote';
import { isDemoMode } from '@/lib/demoMode';

type Role = 'recruiter' | 'screener';

export type RosterBackedStaffSelectProps = {
  role: Role;
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** รายชื่อใน dropdown (รวม roster + จากงาน/mock) */
  optionNames: string[];
  canManageRoster: boolean;
  /** bump เมื่อ roster เปลี่ยน (ฟัง event ที่ parent แล้วส่ง rev) */
  rosterRev: number;
};

function nameMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export const RosterBackedStaffSelect: React.FC<RosterBackedStaffSelectProps> = ({
  role,
  label,
  value,
  onChange,
  optionNames,
  canManageRoster,
  rosterRev,
}) => {
  const rosterOnly = useMemo(() => {
    void rosterRev;
    if (isDemoMode()) {
      return role === 'recruiter' ? getRecruitersRoster() : getScreenersRoster();
    }
    const c = getJobStaffApiCache();
    return role === 'recruiter' ? (c?.recruiters ?? []) : (c?.screeners ?? []);
  }, [role, rosterRev]);

  const [addDraft, setAddDraft] = useState('');
  const [removePick, setRemovePick] = useState('');
  const [staffMutating, setStaffMutating] = useState(false);

  const trimmed = value.trim();
  const inOptions =
    trimmed === '' || optionNames.some((n) => nameMatch(n, trimmed));

  const tryAdd = async () => {
    const t = addDraft.trim();
    if (!t || staffMutating) return;
    if (isDemoMode()) {
      if (role === 'recruiter') addRecruiterToRoster(t);
      else addScreenerToRoster(t);
      setAddDraft('');
      onChange(t);
      return;
    }
    setStaffMutating(true);
    const res = await mutateJobStaffRemote({ op: 'add', role, name: t });
    setStaffMutating(false);
    if (!res.ok) {
      window.alert(res.message ?? 'บันทึกไม่สำเร็จ');
      return;
    }
    setAddDraft('');
    onChange(t);
  };

  const tryRemove = async () => {
    if (!removePick || staffMutating) return;
    if (!window.confirm(`ลบ «${removePick}» ออกจากรายการหลัก?\nงานเดิมที่มอบหมายชื่อนี้ยังคงแสดงตามข้อมูลงาน`)) return;
    if (isDemoMode()) {
      if (role === 'recruiter') removeRecruiterFromRoster(removePick);
      else removeScreenerFromRoster(removePick);
    } else {
      setStaffMutating(true);
      const res = await mutateJobStaffRemote({ op: 'remove', role, name: removePick });
      setStaffMutating(false);
      if (!res.ok) {
        window.alert(res.message ?? 'บันทึกไม่สำเร็จ');
        return;
      }
    }
    if (nameMatch(value, removePick)) onChange('');
    setRemovePick('');
  };

  const selectValue = inOptions ? value : trimmed ? value : '';

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <select
        value={selectValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
      >
        <option value="">— ไม่ระบุ —</option>
        {trimmed && !inOptions ? (
          <option value={value}>{trimmed} (ไม่อยู่ในรายการ)</option>
        ) : null}
        {optionNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      {canManageRoster && (
        <div className="mt-2 space-y-2 rounded-lg border border-border/70 bg-secondary/25 p-2.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            จัดการรายชื่อในรายการ (Admin)
          </p>
          <div className="flex flex-wrap gap-1.5 items-center">
            <input
              type="text"
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              placeholder="ชื่อใหม่"
              className="flex-1 min-w-[120px] bg-background border border-border rounded-lg px-2 py-1.5 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), tryAdd())}
            />
            <button
              type="button"
              disabled={staffMutating}
              onClick={() => void tryAdd()}
              className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground"
            >
              {staffMutating ? '…' : 'เพิ่ม'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <select
              value={removePick}
              onChange={(e) => setRemovePick(e.target.value)}
              className="flex-1 min-w-[140px] bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
            >
              <option value="">เลือกชื่อที่จะลบจากรายการ…</option>
              {rosterOnly.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!removePick || staffMutating}
              onClick={() => void tryRemove()}
              className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-destructive/15 text-destructive disabled:opacity-40"
            >
              ลบ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
