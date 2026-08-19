import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

/** แถบแท็บ pill รางเดียว — สไตล์เดียวกับแท็บ Settings (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-8) */
function PillTabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: T; label: string; count: number }[];
  active: T;
  onSelect: (key: T) => void;
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex w-max gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800/70">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.key)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors',
              active === t.key
                ? 'bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                : 'font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {t.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-xs tabular-nums',
                active === t.key ? 'bg-primary/10 text-primary' : 'bg-slate-200/70 dark:bg-slate-700/70',
              )}
            >
              {t.count.toLocaleString('th-TH')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const JobStaffRosterTab: React.FC = () => {
  const [state, setState] = useState<JobStaffManageState | null>(null);
  const [loading, setLoading] = useState(false);
  /**
   * สองชั้นแท็บ (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-8: *"กด BU แล้วมีให้เลือกดูอีกเป็น
   * สรรหา/คัดสรร ฯลฯ ไม่ได้ให้เอามารวมกันมันงง"*) — เลือก BU แล้วเลือกบทบาท เห็นกล่องเดียว
   * `activeBu = null` = ยังไม่เลือกเอง → ใช้ค่าเริ่มต้น (BU แรกที่มีคน)
   */
  const [activeBu, setActiveBu] = useState<RosterBuKey | null>(null);
  const [activeKind, setActiveKind] = useState<RosterKind>('recruiter');

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

  const activeState: JobStaffManageState = state ?? {
    recruiters: [],
    screeners: [],
    opls: [],
    onlines: [],
    canManageAllBu: false,
  };

  // BU ที่ใช้จริง — ค่าเริ่มต้น = BU แรกที่มีคน (ไม่งั้นเปิดมาเจอกล่องว่างของ SN)
  const firstWithPeople = buCounts.find((b) => b.total > 0)?.key;
  const effectiveBu: RosterBuKey = activeBu ?? firstWithPeople ?? ROSTER_BU_KEYS[0];

  const buTabs = buCounts.map((b) => ({ key: b.key, label: rosterBuLabel(b.key), count: b.total }));
  const activeBuCount = buCounts.find((b) => b.key === effectiveBu);
  const kindTabs = ROSTER_KINDS.map((k) => ({
    key: k.kind,
    label: k.title.replace('เจ้าหน้าที่', '').replace('ทีม ', '').trim(),
    count: activeBuCount ? activeBuCount[k.kind] : 0,
  }));
  const activeKindMeta = ROSTER_KINDS.find((k) => k.kind === activeKind) ?? ROSTER_KINDS[0];

  return (
    <div className="space-y-4">
      {/* ชั้น 1: เลือก BU */}
      <div className="space-y-1.5">
        <p className="ml-1 text-xs font-medium text-muted-foreground">เลือก BU</p>
        <PillTabs<RosterBuKey> tabs={buTabs} active={effectiveBu} onSelect={(k) => setActiveBu(k)} />
      </div>
      {/* ชั้น 2: เลือกบทบาทของ BU นั้น */}
      <div className="space-y-1.5">
        <p className="ml-1 text-xs font-medium text-muted-foreground">เลือกทีม</p>
        <PillTabs<RosterKind> tabs={kindTabs} active={activeKind} onSelect={(k) => setActiveKind(k)} />
      </div>
      {/* กล่องเดียวของบทบาทที่เลือก + แบ่งหน้า */}
      <RosterSection
        key={`${effectiveBu}:${activeKind}`}
        kind={activeKind}
        title={`${activeKindMeta.title} · ${rosterBuLabel(effectiveBu)}`}
        entries={entriesForBu(entriesOfKind(activeState, activeKind), effectiveBu)}
        defaultBu={buKeyToValue(effectiveBu)}
        onChanged={reload}
      />
    </div>
  );
};

export default JobStaffRosterTab;
