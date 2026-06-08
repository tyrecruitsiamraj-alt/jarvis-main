import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { isConfiguredDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';
import { apiUnreachableHint } from '@/lib/apiUnreachableHint';
import type { SoOperationUnit } from '@/types';
import { Building2, Pencil, Plus } from 'lucide-react';

const SoOperationUnitsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canRename = hasPermission('supervisor');
  const [units, setUnits] = useState<SoOperationUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isConfiguredDemoMode()) {
      setNotConfigured(false);
      setUnits([]);
      setListError('โหมดสาธิต — ปิด VITE_DEMO_MODE เพื่อเชื่อมหน่วยงานจาก so-operation');
      setLoading(false);
      return;
    }
    setListError(null);
    setNotConfigured(false);
    setLoading(true);
    try {
      const r = await apiFetch('/api/so-operation/units');
      if (r.status === 501) {
        setNotConfigured(true);
        setUnits([]);
        setListError(null);
        return;
      }
      if (!r.ok) {
        setUnits([]);
        setListError(`โหลดไม่สำเร็จ (HTTP ${r.status})`);
        return;
      }
      const data = (await r.json()) as unknown;
      const rows = Array.isArray(data)
        ? data.filter(
            (u): u is SoOperationUnit =>
              u !== null &&
              typeof u === 'object' &&
              'id' in u &&
              'name' in u &&
              typeof (u as SoOperationUnit).id === 'string' &&
              typeof (u as SoOperationUnit).name === 'string',
          )
        : [];
      setUnits(rows);
    } catch {
      setUnits([]);
      setListError(apiUnreachableHint());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || adding || isConfiguredDemoMode() || notConfigured) return;
    setAddError(null);
    setAdding(true);
    try {
      const r = await apiFetch('/api/so-operation/units', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const body: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const msg =
          body && typeof body === 'object' && 'message' in body
            ? String((body as { message?: string }).message || '')
            : '';
        setAddError(msg || `เพิ่มไม่สำเร็จ (HTTP ${r.status})`);
        return;
      }
      setNewName('');
      await load();
    } catch {
      setAddError(apiUnreachableHint());
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (u: SoOperationUnit) => {
    setEditError(null);
    setEditingId(u.id);
    setEditDraft(u.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
    setEditError(null);
  };

  const saveEdit = async (id: string) => {
    const name = editDraft.trim();
    if (!name || patchingId) return;
    setEditError(null);
    setPatchingId(id);
    try {
      const r = await apiFetch('/api/so-operation/units', {
        method: 'PATCH',
        body: JSON.stringify({ id, name }),
      });
      const body: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const msg =
          body && typeof body === 'object' && 'message' in body
            ? String((body as { message?: string }).message || '')
            : '';
        setEditError(msg || `บันทึกไม่สำเร็จ (HTTP ${r.status})`);
        return;
      }
      cancelEdit();
      await load();
    } catch {
      setEditError(apiUnreachableHint());
    } finally {
      setPatchingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="หน่วยงาน (so-operation)"
        subtitle="เพิ่มและแก้ไขชื่อหน่วยงานในฐานข้อมูล schema so-operation เท่านั้น"
        backPath="/jobs"
      />

      <div className="px-4 md:px-6 space-y-6 max-w-2xl">
        <p className="text-sm text-muted-foreground">
          ใบงานในระบบยังบันทึกชื่อหน่วยงานใน <code className="text-xs bg-muted px-1 rounded">jobs.unit_name</code> อ้างอิงจากรายการด้านล่าง
        </p>

        {notConfigured ? (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
            ยังไม่ได้ตั้งค่า <code className="text-xs">SO_OPERATION_SCHEMA</code> บนเซิร์ฟเวอร์ — ไม่สามารถเพิ่มหน่วยงานที่นี่ได้
            <span className="block mt-1 text-muted-foreground">
              ถ้าตั้ง schema แล้วไม่ระบุตาราง ระบบใช้ตาราง{' '}
              <code className="text-xs">activity_to_saleco_request_position</code> เป็นค่าเริ่มต้น
            </span>
          </div>
        ) : null}

        {!isConfiguredDemoMode() && !notConfigured ? (
          <form onSubmit={submitAdd} className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Plus className="w-4 h-4 text-orange-600" />
              เพิ่มหน่วยงานใหม่
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ชื่อหน่วยงาน"
                className="jarvis-soft-field flex-1"
                disabled={adding}
              />
              <button
                type="submit"
                disabled={adding || !newName.trim()}
                className="shrink-0 px-4 py-2 jarvis-pill-btn text-sm font-medium disabled:opacity-50"
              >
                {adding ? 'กำลังบันทึก…' : 'บันทึกลง so-operation'}
              </button>
            </div>
            {addError ? <p className="text-xs text-destructive">{addError}</p> : null}
          </form>
        ) : null}

        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">รายการหน่วยงาน</span>
            {loading ? <span className="text-xs text-muted-foreground">กำลังโหลด…</span> : null}
          </div>
          {listError ? (
            <div className="p-4 text-sm text-destructive">{listError}</div>
          ) : units.length === 0 && !loading ? (
            <div className="p-4 text-sm text-muted-foreground">
              {notConfigured ? 'ยังไม่เชื่อมตาราง' : 'ยังไม่มีรายการ — เพิ่มชื่อหน่วยงานด้านบน'}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {units.map((u) => (
                <li key={u.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  {editingId === u.id && canRename ? (
                    <>
                      <input
                        type="text"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        className="jarvis-soft-field flex-1"
                        disabled={patchingId === u.id}
                      />
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void saveEdit(u.id)}
                          disabled={patchingId === u.id || !editDraft.trim()}
                          className="px-3 py-1.5 jarvis-pill-btn text-xs font-medium disabled:opacity-50"
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={patchingId === u.id}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-foreground">{u.name}</span>
                      {canRename ? (
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          className="shrink-0 inline-flex items-center gap-1 text-xs text-orange-600 hover:underline"
                        >
                          <Pencil className="w-3 h-3" />
                          แก้ไข
                        </button>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editError ? <div className="px-4 pb-3 text-xs text-destructive">{editError}</div> : null}
        </div>

        <p className="text-xs text-muted-foreground">
          <Link to="/jobs/add" className="text-orange-600 hover:underline">
            ไปสร้างงานใหม่
          </Link>
          {' · '}
          <Link to="/jobs/list" className="text-orange-600 hover:underline">
            รายการงาน
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SoOperationUnitsPage;
