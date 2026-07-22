import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchJobStaffManage,
  rosterMutate,
  type JobStaffManageState,
  type RosterEntry,
} from '@/lib/jobStaffRemote';
import { APP_DEPARTMENT_CODES, APP_DEPARTMENT_LABELS } from '@/lib/departmentCodes';
import { cn } from '@/lib/utils';

type RosterKind = 'recruiter' | 'screener' | 'opl';

const NO_BU = ''; // ไม่ระบุ — visible in every BU

function BuSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="jarvis-soft-field h-8 px-2 py-0 text-xs disabled:opacity-60"
      title="กำหนด BU ของรายชื่อนี้"
    >
      <option value={NO_BU}>ไม่ระบุ</option>
      {APP_DEPARTMENT_CODES.map((code) => (
        <option key={code} value={code}>
          {APP_DEPARTMENT_LABELS[code]}
        </option>
      ))}
    </select>
  );
}

function RosterSection({
  kind,
  title,
  entries,
  onChanged,
}: {
  kind: RosterKind;
  title: string;
  entries: RosterEntry[];
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [draftBu, setDraftBu] = useState<string>(NO_BU);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (body: Record<string, unknown>) => {
    if (busy) return false;
    setBusy(true);
    const res = await rosterMutate({ role: kind, ...body });
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message ?? 'บันทึกไม่สำเร็จ');
      return false;
    }
    onChanged();
    return true;
  };

  const add = async () => {
    const t = draft.trim();
    if (!t) return;
    if (await run({ op: 'add', name: t, bu: draftBu })) {
      setDraft('');
      setDraftBu(NO_BU);
    }
  };

  const remove = (entry: RosterEntry) => {
    const buLabel = entry.bu ?? 'ไม่ระบุ';
    if (!window.confirm(`ลบ «${entry.name}» (BU ${buLabel}) ออกจากรายการ?\nงานเดิมที่มอบหมายชื่อนี้ยังคงแสดงในประวัติตามเดิม`)) return;
    void run({ op: 'remove', name: entry.name, bu: entry.bu ?? NO_BU });
  };

  const changeBu = (entry: RosterEntry, toBu: string) => {
    if ((entry.bu ?? NO_BU) === toBu) return;
    void run({ op: 'set-bu', name: entry.name, fromBu: entry.bu ?? NO_BU, toBu });
  };

  const startEdit = (name: string) => {
    setEditing(name);
    setEditValue(name);
  };

  const saveEdit = async (entry: RosterEntry) => {
    const t = editValue.trim();
    if (!t) return;
    if (await run({ op: 'rename', oldName: entry.name, newName: t, bu: entry.bu ?? NO_BU })) {
      setEditing(null);
    }
  };

  return (
    <div className="glass-card rounded-xl border border-border p-4 space-y-3">
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">
        กำหนด BU ให้แต่ละรายชื่อได้จากช่องด้านขวา — &quot;ไม่ระบุ&quot; = แสดงทุก BU
      </p>
      <ul className="space-y-2">
        {entries.length === 0 && (
          <li className="text-sm text-muted-foreground italic">ยังไม่มีชื่อในรายการ — เพิ่มด้านล่าง</li>
        )}
        {entries.map((entry) => (
          <li
            key={`${entry.name}::${entry.bu ?? ''}`}
            className="flex flex-wrap items-center gap-2 py-1.5 border-b border-border/40 last:border-0"
          >
            {editing === entry.name ? (
              <>
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 min-w-[140px] jarvis-soft-field px-2 py-1.5 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveEdit(entry);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => void saveEdit(entry)}
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
                <span className="flex-1 min-w-[120px] text-sm font-medium text-foreground">{entry.name}</span>
                <BuSelect
                  value={entry.bu ?? NO_BU}
                  disabled={busy}
                  onChange={(v) => changeBu(entry, v)}
                />
                <button
                  type="button"
                  onClick={() => startEdit(entry.name)}
                  className="text-xs px-2 py-1 rounded bg-secondary text-blue-600 hover:underline"
                >
                  เปลี่ยนชื่อ
                </button>
                <button
                  type="button"
                  onClick={() => remove(entry)}
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
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="พิมพ์ชื่อใหม่"
          className="flex-1 min-w-[150px] jarvis-soft-field"
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <BuSelect value={draftBu} disabled={busy} onChange={setDraftBu} />
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
  const [state, setState] = useState<JobStaffManageState | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const s = await fetchJobStaffManage();
    setState(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground jarvis-menu-card rounded-[1.5rem] p-3 border border-white/70 border-info/30 bg-info/5">
        รายชื่อสรรหา/คัดสรร/OPL บันทึกในฐานข้อมูล กำหนด BU ให้แต่ละคนได้ในช่องขวาของแต่ละรายชื่อ —
        &quot;ไม่ระบุ&quot; จะแสดงในทุก BU การเปลี่ยนชื่อจะอัปเดตชื่อบนงานที่ตรงกันด้วย
      </p>
      {loading && !state ? (
        <p className="text-sm text-muted-foreground animate-pulse py-6 text-center">กำลังโหลดรายชื่อ…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <RosterSection
            kind="recruiter"
            title="เจ้าหน้าที่สรรหา"
            entries={state?.recruiters ?? []}
            onChanged={reload}
          />
          <RosterSection
            kind="screener"
            title="เจ้าหน้าที่คัดสรร"
            entries={state?.screeners ?? []}
            onChanged={reload}
          />
          <RosterSection
            kind="opl"
            title="เจ้าหน้าที่ OPL"
            entries={state?.opls ?? []}
            onChanged={reload}
          />
        </div>
      )}
    </div>
  );
};

export default JobStaffRosterTab;
