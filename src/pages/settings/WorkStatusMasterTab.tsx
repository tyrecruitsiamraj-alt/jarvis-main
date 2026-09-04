import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  listWorkStatusMaster,
  createWorkStatus,
  updateWorkStatus,
  deleteWorkStatus,
  builtinWorkStatusItems,
  type WorkStatusMasterItem,
} from '@/lib/workStatusMasterApi';
import { invalidateWorkStatusOptions } from '@/hooks/useWorkStatusOptions';

/**
 * ตั้งค่า "สถานะทำงาน" ของใบขอ — Admin เท่านั้น
 * สถานะพื้นฐานของระบบ (built-in) ลบไม่ได้เพราะแดชบอร์ดนับตัวเลขจากสถานะเหล่านี้ แต่ปิดใช้งานได้
 * สถานะที่เพิ่มเองลบได้เมื่อยังไม่มีใบขอไหนใช้อยู่
 */
const WorkStatusMasterTab: React.FC = () => {
  const [items, setItems] = useState<WorkStatusMasterItem[] | null>(null);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDateLabel, setNewDateLabel] = useState('');

  const reload = async () => {
    try {
      setItems(await listWorkStatusMaster());
      // ล้าง cache ของ dropdown ทั้งระบบ ให้ช่องสถานะเห็นค่าใหม่โดยไม่ต้องรีเฟรชหน้า
      invalidateWorkStatusOptions();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดสถานะทำงานไม่สำเร็จ');
      // ยังโชว์ค่าพื้นฐานให้เห็นว่าระบบมีสถานะอะไรอยู่ แม้ API ล่ม
      setItems((prev) => prev ?? builtinWorkStatusItems());
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const flash = (msg: string) => {
    setOkMsg(msg);
    window.setTimeout(() => setOkMsg(''), 2500);
  };

  const onAdd = async () => {
    setError('');
    setAdding(true);
    try {
      await createWorkStatus({
        code: newCode.trim().toLowerCase(),
        label: newLabel.trim(),
        date_label: newDateLabel.trim() || undefined,
      });
      setNewCode('');
      setNewLabel('');
      setNewDateLabel('');
      await reload();
      flash('เพิ่มสถานะแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เพิ่มสถานะไม่สำเร็จ');
    } finally {
      setAdding(false);
    }
  };

  const onToggleActive = async (item: WorkStatusMasterItem) => {
    setError('');
    setBusyCode(item.code);
    try {
      await updateWorkStatus(item.code, { is_active: !item.is_active });
      await reload();
      flash(item.is_active ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusyCode(null);
    }
  };

  const onRename = async (item: WorkStatusMasterItem, label: string) => {
    const next = label.trim();
    if (!next || next === item.label) return;
    setError('');
    setBusyCode(item.code);
    try {
      await updateWorkStatus(item.code, { label: next });
      await reload();
      flash('เปลี่ยนชื่อแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
      await reload();
    } finally {
      setBusyCode(null);
    }
  };

  const onDelete = async (item: WorkStatusMasterItem) => {
    setError('');
    setBusyCode(item.code);
    try {
      await deleteWorkStatus(item.code);
      await reload();
      flash('ลบแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-[1.5rem] border border-white/70 p-4 space-y-3">
        <div>
          <div className="text-sm font-semibold text-foreground">สถานะทำงานของใบขอ</div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            ใช้ในช่อง “สถานะทำงาน” ของใบขอ และเป็นตัวนับบนแดชบอร์ด · สถานะพื้นฐานของระบบลบไม่ได้
            (ปิดใช้งานเพื่อซ่อนจากตัวเลือกได้) · สถานะที่เพิ่มเองลบได้เมื่อยังไม่มีใบขอใช้อยู่
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {okMsg ? (
          <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            {okMsg}
          </div>
        ) : null}

        {/* เพิ่มสถานะใหม่ */}
        <div className="rounded-xl border border-border p-3 space-y-2">
          <div className="text-xs font-semibold text-foreground">เพิ่มสถานะใหม่</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-[11px] text-muted-foreground">รหัส (a-z, _)</span>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="waiting_document"
                className="jarvis-soft-field font-mono text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] text-muted-foreground">ชื่อที่แสดง</span>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="รอเอกสาร"
                className="jarvis-soft-field text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] text-muted-foreground">ป้ายช่องวันที่ (ไม่ใส่ = “วันที่”)</span>
              <input
                value={newDateLabel}
                onChange={(e) => setNewDateLabel(e.target.value)}
                placeholder="วันที่ส่งเอกสาร"
                className="jarvis-soft-field text-xs"
              />
            </label>
          </div>
          <Button size="sm"
            type="button"
            onClick={() => void onAdd()}
            disabled={adding || !newCode.trim() || !newLabel.trim()}
            className="px-3 py-1.5"
          >
            {adding ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            เพิ่มสถานะ
          </Button>
        </div>

        {/* รายการสถานะ */}
        {!items ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" /> กำลังโหลด…
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <div
                key={item.code}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between',
                  item.is_active ? 'border-border' : 'border-dashed border-slate-300 bg-slate-50/60',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      defaultValue={item.label}
                      disabled={busyCode === item.code}
                      onBlur={(e) => void onRename(item, e.target.value)}
                      className="min-w-0 max-w-[14rem] rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-foreground hover:border-border focus:border-blue-300 focus:outline-none"
                    />
                    {item.is_builtin ? <span className="jarvis-chip-neutral">พื้นฐาน</span> : null}
                    {!item.is_active ? <span className="jarvis-chip-warn">ปิดใช้งาน</span> : null}
                    {item.usage ? <span className="jarvis-chip-info">{item.usage} ใบใช้อยู่</span> : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[10px] text-muted-foreground">
                    <span className="font-mono">{item.code}</span>
                    <span>ช่องวันที่: {item.date_label}</span>
                    <span>ลำดับ {item.sort_order}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {/* เปิด/ปิดใช้งาน — สลับ variant ของ Button แทนการสลับคลาสปุ่มที่ปั้นเอง */}
                  <Button
                    type="button"
                    size="sm"
                    variant={item.is_active ? 'secondary' : 'default'}
                    disabled={busyCode === item.code}
                    onClick={() => void onToggleActive(item)}
                    className="px-2.5 py-1"
                  >
                    {item.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </Button>
                  {!item.is_builtin ? (
                    <Button variant="destructive" size="sm"
                      type="button"
                      disabled={busyCode === item.code || !!item.usage}
                      onClick={() => void onDelete(item)}
                      title={item.usage ? 'มีใบขอใช้สถานะนี้อยู่ ลบไม่ได้' : 'ลบสถานะนี้'}
                      className="px-2.5 py-1"
                    >
                      <Trash2 className="h-3 w-3" /> ลบ
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkStatusMasterTab;
