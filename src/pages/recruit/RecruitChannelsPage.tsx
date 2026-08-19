import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import {
  createRecruitChannel,
  deleteRecruitChannel,
  fetchRecruitChannelRootsPage,
  fetchRecruitChannelSecondary,
  updateRecruitChannel,
} from '@/lib/recruitPostingsApi';
import type { RecruitChannel } from '@/lib/recruitPostings';
import {
  CHANNEL_ADMIN_PAGE_SIZE,
  CHANNEL_ADMIN_VIEW_LABEL,
  channelDeleteWarning,
  channelNameChanged,
  channelNameError,
  channelPageCount,
  channelPageOffset,
  channelRangeLabel,
  clampChannelPage,
  type ChannelAdminView,
} from '@/lib/recruitChannelAdmin';

/**
 * หน้าจัดช่องทางรับสมัคร (แทนป๊อปอัป "ช่องทาง" เดิมบนบอร์ด — เจ้าของเคาะ 19 ส.ค. 2569)
 *
 * ⚠️ **ห้ามโหลดทั้งก้อน** — ของจริงที่ยกมาจาก iRecruit มีช่องทางหลัก 43 · ช่องทางรอง 4,345
 * (พ่อชื่อ "Facebook Group" ตัวเดียวมีลูก 4,187) ทุกตารางจึงค้นหา+แบ่งหน้าที่เซิร์ฟเวอร์
 * ยกเว้น dropdown เลือกช่องทางหลัก ที่โหลดพ่อ 43 ตัวครั้งเดียวแล้วกรองในเครื่อง
 * (ท่าเดียวกับ ChannelPicker — 43 แถวเบาพอ และทำให้พิมพ์แล้วกรองทันทีไม่ต้องรอเน็ต)
 *
 * ⚠️ กฎชื่อซ้ำมีสองแบบ (migration 075) — แถวที่ยกมา (`source='irecruit'`) ชื่อซ้ำกันได้จริง
 * ส่วนแถวที่คนคีย์เองยังกันซ้ำด้วย `recruit_channels_manual_parent_name_idx`
 * เพิ่มจากหน้านี้ = ของคนคีย์เอง จึงเจอ "มีช่องทางชื่อนี้อยู่แล้ว" ได้ ทั้งที่ตาเห็นชื่อซ้ำในตาราง
 */

const fieldCls =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30';

const VIEWS: ChannelAdminView[] = ['roots', 'children'];

/** dropdown เลือกช่องทางหลัก ที่พิมพ์ค้นได้ — ใช้ทั้งตอนกรองและตอนเพิ่มช่องทางรอง */
const ParentSelect: React.FC<{
  roots: RecruitChannel[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  /** ให้เลือก "ทุกช่องทางหลัก" ได้ (ใช้ตอนกรอง ไม่ใช้ตอนเพิ่ม) */
  allowAll?: boolean;
}> = ({ roots, value, onChange, placeholder, allowAll = false }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const picked = roots.find((r) => r.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const term = query.trim().toLowerCase();
  const shown = term ? roots.filter((r) => r.name.toLowerCase().includes(term)) : roots;

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => {
          setQuery('');
          setOpen((v) => !v);
        }}
        className={cn(fieldCls, 'flex items-center justify-between gap-2 text-left')}
      >
        <span className={cn('truncate', picked ? 'text-foreground' : 'text-muted-foreground/70')}>
          {picked ? picked.name : placeholder}
        </span>
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-background p-1.5 shadow-lg">
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="พิมพ์ค้นช่องทางหลัก"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-xs"
            />
          </div>
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {allowAll ? (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary"
              >
                ทุกช่องทางหลัก
              </button>
            ) : null}
            {shown.length === 0 ? (
              <p className="px-2.5 py-1.5 text-xs text-muted-foreground">ไม่เจอช่องทางหลักที่ตรงกับคำค้น</p>
            ) : (
              shown.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onChange(r.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs',
                    r.id === value
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-secondary',
                  )}
                >
                  {r.name}
                  {r.isActive ? '' : ' (ปิดใช้งาน)'}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const RecruitChannelsPage: React.FC = () => {
  const { isFunctionEnabled } = useRolePermissions();
  const canManage = isFunctionEnabled('recruit_postings');

  const [view, setView] = useState<ChannelAdminView>('roots');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [parentFilter, setParentFilter] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<RecruitChannel[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<{ roots: number; children: number }>({ roots: 0, children: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  /** พ่อทั้ง 43 ตัวสำหรับ dropdown — โหลดครั้งเดียว รีเฟรชเมื่อรายการพ่อเปลี่ยน */
  const [roots, setRoots] = useState<RecruitChannel[]>([]);

  const [newName, setNewName] = useState('');
  const [newParent, setNewParent] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  /** ลำดับคำขอ — คำตอบที่มาช้ากว่าคำขอใหม่ต้องถูกทิ้ง ไม่งั้นผลเก่าทับผลใหม่ */
  const seqRef = useRef(0);

  const flash = (msg: string) => {
    setOkMsg(msg);
    window.setTimeout(() => setOkMsg(''), 2500);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // เปลี่ยนคำค้น/มุมมอง/ตัวกรองพ่อ = กลับหน้าแรกเสมอ (ไม่งั้นค้างหน้า 7 ของผลเก่า)
  useEffect(() => {
    setPage(1);
  }, [debounced, view, parentFilter]);

  /**
   * โหลดพ่อทั้งชุดสำหรับ dropdown + เลขรวมของทั้งสองแท็บ
   * ⚠️ เลขบนแท็บ "ช่องทางรอง" ต้องถูกตั้งแต่เปิดหน้า ไม่ใช่รอให้กดเข้าไปดูก่อน
   * (ขอแค่ limit=1 — เอาแต่ `total` ไม่ต้องลากแถวมา 4,345 ตัว)
   */
  const loadRoots = useCallback(async () => {
    try {
      // พ่อมี 43 ตัว — ขอเผื่อไว้ 200 (เพดานของ API) พอสำหรับ dropdown ทั้งชุด
      const [rootRes, childRes] = await Promise.all([
        fetchRecruitChannelRootsPage({ includeInactive: true, limit: 200 }),
        fetchRecruitChannelSecondary({ includeInactive: true, limit: 1 }),
      ]);
      setRoots(rootRes.items);
      setCounts({ roots: rootRes.total, children: childRes.total });
    } catch {
      setRoots([]);
    }
  }, []);

  const load = useCallback(async () => {
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setLoading(true);
    try {
      const common = {
        includeInactive: true,
        limit: CHANNEL_ADMIN_PAGE_SIZE,
        offset: channelPageOffset(page),
        q: debounced || undefined,
      };
      const res =
        view === 'roots'
          ? await fetchRecruitChannelRootsPage(common)
          : await fetchRecruitChannelSecondary({ ...common, parentId: parentFilter || null });
      if (seqRef.current !== seq) return;
      setRows(res.items);
      setTotal(res.total);
      setError('');
      // จำนวนรวมของแท็บ — อัปเดตเฉพาะตอนไม่ได้กรอง ไม่งั้นเลขบนแท็บกลายเป็นจำนวนผลค้น
      if (!debounced && (view === 'roots' || !parentFilter)) {
        setCounts((c) => ({ ...c, [view]: res.total }));
      }
    } catch (e) {
      if (seqRef.current !== seq) return;
      setRows([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : 'โหลดช่องทางไม่สำเร็จ');
    } finally {
      if (seqRef.current === seq) setLoading(false);
    }
  }, [view, page, debounced, parentFilter]);

  useEffect(() => {
    void loadRoots();
  }, [loadRoots]);

  useEffect(() => {
    void load();
  }, [load]);

  // ลบจนหน้าท้ายว่าง → เด้งกลับหน้าที่ยังมีของ (ไม่ปล่อยให้ค้างหน้าเปล่า)
  useEffect(() => {
    const clamped = clampChannelPage(page, total);
    if (clamped !== page) setPage(clamped);
  }, [page, total]);

  const pageCount = channelPageCount(total);

  const tabs = useMemo(
    () =>
      VIEWS.map((v) => ({
        key: v,
        label: CHANNEL_ADMIN_VIEW_LABEL[v],
        count: counts[v],
      })),
    [counts],
  );

  const onAdd = async () => {
    const nameErr = channelNameError(newName);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    if (view === 'children' && !newParent) {
      setError('เลือกช่องทางหลักก่อน');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createRecruitChannel({
        name: newName.trim(),
        parentId: view === 'children' ? newParent : null,
      });
      setNewName('');
      await Promise.all([load(), loadRoots()]);
      flash('เพิ่มช่องทางแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เพิ่มช่องทางไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const onSaveName = async (row: RecruitChannel) => {
    const nameErr = channelNameError(editName);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    if (!channelNameChanged(row.name, editName)) {
      setEditingId(null);
      return;
    }
    setBusyId(row.id);
    setError('');
    try {
      await updateRecruitChannel(row.id, { name: editName.trim() });
      setEditingId(null);
      await Promise.all([load(), loadRoots()]);
      flash('แก้ชื่อแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'แก้ชื่อไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const onToggleActive = async (row: RecruitChannel) => {
    setBusyId(row.id);
    setError('');
    try {
      await updateRecruitChannel(row.id, { isActive: !row.isActive });
      await Promise.all([load(), loadRoots()]);
      flash(row.isActive ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (row: RecruitChannel) => {
    // 🔴 FK เป็น cascade — ลบพ่อคือลบลูกทั้งกอง ต้องให้เห็นจำนวนก่อนเสมอ
    if (!window.confirm(channelDeleteWarning(row))) return;
    setBusyId(row.id);
    setError('');
    try {
      await deleteRecruitChannel(row.id);
      await Promise.all([load(), loadRoots()]);
      flash('ลบแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  if (!canManage) {
    return (
      <div className="min-h-screen">
        <PageHeader title="จัดช่องทางรับสมัคร" backPath="/jobs/board" />
        <div className="px-4 pb-10 md:px-6">
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            บัญชีนี้ยังไม่ได้เปิดสิทธิ์จัดการช่องทางรับสมัคร
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="จัดช่องทางรับสมัคร"
        subtitle="ช่องทางหลัก → ช่องทางรอง · ใช้ตอนสร้างลิงก์ เพื่อรู้ว่าผู้สมัครมาจากช่องไหน"
        backPath="/jobs/board"
      />

      <div className="space-y-3 px-4 pb-16 md:px-6">
        {/* สลับมุมมอง */}
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex w-max gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800/70">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors',
                  view === t.key
                    ? 'bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 text-xs tabular-nums',
                    view === t.key ? 'bg-primary/10 text-primary' : 'bg-slate-200/70 dark:bg-slate-700/70',
                  )}
                >
                  {t.count.toLocaleString('th-TH')}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* เพิ่มช่องทาง */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm dark:bg-slate-900">
          <p className="mb-2 text-xs font-semibold text-foreground">
            เพิ่ม{CHANNEL_ADMIN_VIEW_LABEL[view]}
          </p>
          <div className="flex flex-col gap-2 md:flex-row">
            {view === 'children' ? (
              <div className="md:w-64">
                <ParentSelect
                  roots={roots}
                  value={newParent}
                  onChange={setNewParent}
                  placeholder="เลือกช่องทางหลัก…"
                />
              </div>
            ) : null}
            <input
              className={fieldCls}
              placeholder={view === 'roots' ? 'ชื่อช่องทางหลัก เช่น Facebook' : 'ชื่อช่องทางรอง เช่น กลุ่มหางานนนทบุรี'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onAdd();
                }
              }}
            />
            <button
              type="button"
              onClick={() => void onAdd()}
              disabled={saving}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              เพิ่ม
            </button>
          </div>
        </div>

        {/* ค้นหา + กรองพ่อ */}
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(fieldCls, 'pl-9')}
              placeholder={
                view === 'roots' ? 'ค้นชื่อช่องทางหลัก' : 'ค้นชื่อช่องทางรอง หรือชื่อช่องทางหลัก'
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="ล้างคำค้น"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {view === 'children' ? (
            <div className="md:w-64">
              <ParentSelect
                roots={roots}
                value={parentFilter}
                onChange={setParentFilter}
                placeholder="ทุกช่องทางหลัก"
                allowAll
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}
        {okMsg ? (
          <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {okMsg}
          </p>
        ) : null}

        {/* ตาราง */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm dark:bg-slate-900">
          {loading ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> กำลังโหลด…
            </p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {debounced ? 'ไม่เจอช่องทางที่ตรงกับคำค้น' : 'ยังไม่มีช่องทางในมุมมองนี้'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    {editingId === row.id ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          className={cn(fieldCls, 'py-1.5')}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void onSaveName(row);
                            }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => void onSaveName(row)}
                          className="shrink-0 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="shrink-0 rounded-xl border border-border px-3 text-xs font-semibold"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.name}
                          {row.isActive ? null : (
                            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              ปิดใช้งาน
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {view === 'roots'
                            ? `ช่องทางรอง ${(row.childCount ?? 0).toLocaleString('th-TH')} ช่อง`
                            : `อยู่ใต้ ${row.parentName ?? '—'}`}
                        </p>
                      </>
                    )}
                  </div>

                  {editingId === row.id ? null : (
                    <div className="flex shrink-0 items-center gap-1">
                      {busyId === row.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(row.id);
                          setEditName(row.name);
                        }}
                        title="แก้ชื่อ"
                        aria-label={`แก้ชื่อ ${row.name}`}
                        className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onToggleActive(row)}
                        className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary"
                      >
                        {row.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(row)}
                        title="ลบช่องทางนี้"
                        aria-label={`ลบ ${row.name}`}
                        className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* แบ่งหน้า */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {channelRangeLabel(page, total, rows.length)}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="หน้าก่อนหน้า"
              className="rounded-full border border-border p-1.5 text-muted-foreground disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs tabular-nums text-muted-foreground">
              หน้า {page.toLocaleString('th-TH')}/{pageCount.toLocaleString('th-TH')}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              aria-label="หน้าถัดไป"
              className="rounded-full border border-border p-1.5 text-muted-foreground disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecruitChannelsPage;
