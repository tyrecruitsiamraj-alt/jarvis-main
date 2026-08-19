import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import {
  fetchJobStaffManage,
  rosterMutate,
  type JobStaffManageState,
  type RosterEntry,
} from '@/lib/jobStaffRemote';
import { APP_DEPARTMENT_CODES, APP_DEPARTMENT_LABELS } from '@/lib/departmentCodes';
import {
  ROSTER_BU_KEYS,
  ROSTER_KINDS,
  rosterBuLabel,
  entriesOfKind,
  entriesForBu,
  countRosterByBu,
  paginate,
  type RosterBuKey,
  type RosterKind,
} from '@/lib/rosterBuGroups';
import { cn } from '@/lib/utils';

/** BU ที่กำหนดกับรายชื่อ — ค่าใน select ตอน add/แก้ · '' = ไม่ระบุ (เห็นทุก BU ตอนมอบหมาย) */
const NO_BU = '';

/** แปลงคีย์กล่อง BU (มี 'none') → ค่า bu ที่เก็บจริง ('' สำหรับ none) */
function buKeyToValue(key: RosterBuKey): string {
  return key === 'none' ? NO_BU : key;
}

function BuSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const active = value !== NO_BU;
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      title="กำหนด BU ของรายชื่อนี้"
      className={cn(
        'h-7 shrink-0 cursor-pointer rounded-full border px-2 text-xs font-medium transition-colors disabled:opacity-60',
        active
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-border bg-secondary text-muted-foreground',
      )}
    >
      <option value={NO_BU}>BU: ไม่ระบุ</option>
      {APP_DEPARTMENT_CODES.map((code) => (
        <option key={code} value={code}>
          BU: {APP_DEPARTMENT_LABELS[code]}
        </option>
      ))}
    </select>
  );
}

const PAGE_SIZE = 10; // เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-7: หน้าละ 10 รายการ

function RosterSection({
  kind,
  title,
  entries,
  defaultBu,
  onChanged,
}: {
  kind: RosterKind;
  title: string;
  /** รายชื่อของบทบาทนี้ **ที่กรอง BU มาแล้ว** จากหน้าแม่ */
  entries: RosterEntry[];
  defaultBu: string;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  // จำนวนคนเปลี่ยน (เพิ่ม/ลบ) แล้วหน้าอาจเกินช่วง — paginate บีบให้เอง
  const paged = useMemo(() => paginate(entries, page, PAGE_SIZE), [entries, page]);
  // ให้ state page ตามที่ถูกบีบ (กันปุ่มโชว์หน้าเกินจริง)
  useEffect(() => {
    if (paged.page !== page) setPage(paged.page);
  }, [paged.page, page]);

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
    // เพิ่มในกล่อง BU ที่กำลังดูอยู่ — คนคาดหวังว่าชื่อใหม่จะอยู่ BU นี้เลย
    if (await run({ op: 'add', name: t, bu: defaultBu })) {
      setDraft('');
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
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {paged.total.toLocaleString('th-TH')} คน
        </span>
      </div>
      <ul className="space-y-2">
        {paged.total === 0 && (
          <li className="text-sm text-muted-foreground italic">ยังไม่มีชื่อในกล่องนี้ — เพิ่มด้านล่าง</li>
        )}
        {paged.items.map((entry) => (
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

      {/* แบ่งหน้า — โผล่เมื่อมีมากกว่า 1 หน้า (เจ้าของขอหน้าละ 10) */}
      {paged.pageCount > 1 ? (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={paged.page <= 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border disabled:opacity-40 hover:bg-secondary"
            aria-label="หน้าก่อนหน้า"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            หน้า {paged.page.toLocaleString('th-TH')}/{paged.pageCount.toLocaleString('th-TH')}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={paged.page >= paged.pageCount}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border disabled:opacity-40 hover:bg-secondary"
            aria-label="หน้าถัดไป"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="พิมพ์ชื่อใหม่"
          className="flex-1 min-w-[150px] jarvis-soft-field"
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
  const [state, setState] = useState<JobStaffManageState | null>(null);
  const [loading, setLoading] = useState(false);
  /** BU ที่กด drill เข้าไป — null = หน้ารวมกล่อง BU (เจ้าของสั่ง ค่ำ-7) */
  const [openBu, setOpenBu] = useState<RosterBuKey | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const s = await fetchJobStaffManage();
    setState(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const buCounts = useMemo(() => (state ? countRosterByBu(state) : []), [state]);

  if (loading && !state) {
    return (
      <p className="text-sm text-muted-foreground animate-pulse py-6 text-center">กำลังโหลดรายชื่อ…</p>
    );
  }

  // ── หน้ารวม: กล่องแต่ละ BU (กดเข้าไปดู 4 บทบาท) ──────────────────────────
  if (openBu === null) {
    return (
      <div className="space-y-4">
        <div className="jarvis-menu-card rounded-[1.5rem] border border-white/70 border-info/30 bg-info/5 p-3">
          <p className="text-sm text-muted-foreground">
            เลือก BU เพื่อดูรายชื่อเจ้าหน้าที่สรรหา / คัดสรร / OPL / ทีมออนไลน์ ของ BU นั้น
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buCounts.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setOpenBu(b.key)}
              className="glass-card rounded-xl border border-border p-4 text-left transition-colors hover:border-primary/50 hover:bg-secondary/30"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                  <Users className="h-4 w-4 text-primary" aria-hidden />
                  {rosterBuLabel(b.key)}
                </span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {b.total.toLocaleString('th-TH')} คน
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>สรรหา {b.recruiter.toLocaleString('th-TH')}</span>
                <span>คัดสรร {b.screener.toLocaleString('th-TH')}</span>
                <span>OPL {b.opl.toLocaleString('th-TH')}</span>
                <span>Online {b.online.toLocaleString('th-TH')}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── หน้า BU เดียว: 4 กล่องบทบาท + แบ่งหน้าอิสระ ──────────────────────────
  const activeState: JobStaffManageState = state ?? {
    recruiters: [],
    screeners: [],
    opls: [],
    onlines: [],
    canManageAllBu: false,
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpenBu(null)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> ทุก BU
        </button>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="h-4 w-4 text-primary" aria-hidden />
          {rosterBuLabel(openBu)}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ROSTER_KINDS.map((s) => (
          <RosterSection
            key={s.kind}
            kind={s.kind}
            title={s.title}
            entries={entriesForBu(entriesOfKind(activeState, s.kind), openBu)}
            defaultBu={buKeyToValue(openBu)}
            onChanged={reload}
          />
        ))}
      </div>
    </div>
  );
};

export default JobStaffRosterTab;
