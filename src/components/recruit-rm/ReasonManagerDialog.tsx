import React, { useEffect, useState } from 'react';
import { Loader2, Plus, RotateCcw, Ban } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { groupRecruitReasons, type RecruitReason } from '@/lib/recruitReasons';
import {
  fetchRecruitReasons,
  createRecruitReason,
  updateRecruitReason,
  deactivateRecruitReason,
} from '@/lib/recruitReasonsApi';

const fieldCls =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30';

/**
 * ปุ่ม "เหตุผล" — master เหตุผลของงานสรรหา (RM)
 *
 * โครงตรงกับระบบเดิม: เหตุผลสังกัด **ขั้นตอน** (การติดต่อ / นัดหมาย / ติดตามการนัดหมาย)
 * และเป็นเหตุผลของ **ผล** สำเร็จหรือไม่สำเร็จ · ยกมาจาก `recruit_master_reason` 82 เหตุผล
 *
 * ⚠️ ปิดการใช้งานแทนการลบ — เหตุผลถูกอ้างจากผลติดต่อย้อนหลัง ลบแล้วรายงานเก่าอ่านไม่ออก
 * (ระบบเดิมก็ใช้ `status = 'inactive'` มีของจริง 5 แถว)
 */
const ReasonManagerDialog: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const [rows, setRows] = useState<RecruitReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** ช่องเพิ่มเหตุผลแยกรายกลุ่ม — คีย์คือ `${process}:${outcome}` */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchRecruitReasons({ includeInactive: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดเหตุผลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setDraft({});
    void reload();
  }, [open]);

  const add = async (processCode: string, outcomeCode: string) => {
    const key = `${processCode}:${outcomeCode}`;
    const name = (draft[key] ?? '').trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createRecruitReason({ processCode, outcomeCode, name });
      setDraft((prev) => ({ ...prev, [key]: '' }));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เพิ่มเหตุผลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (r: RecruitReason) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (r.isActive) await deactivateRecruitReason(r.id);
      else await updateRecruitReason(r.id, { isActive: true });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เปลี่ยนสถานะไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const groups = groupRecruitReasons(rows);
  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-[40rem] flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <DialogHeader className="shrink-0 border-b border-border/50 px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold">เหตุผล</DialogTitle>
          <DialogDescription className="text-xs">
            เหตุผลที่เจ้าหน้าที่เลือกตอนบันทึกผล — แยกตามขั้นตอนและผลสำเร็จ/ไม่สำเร็จ
            {rows.length > 0 ? ` · ใช้งานอยู่ ${activeCount} จาก ${rows.length}` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          {loading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังโหลด…
            </p>
          ) : (
            groups.map((g) => {
              const key = `${g.processCode}:${g.outcomeCode}`;
              return (
                <section key={key} className="space-y-2 rounded-2xl border border-border/70 p-3">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{g.processLabel}</h3>
                    <span
                      className={
                        g.outcomeCode === 'A'
                          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                          : 'rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                      }
                    >
                      {g.outcomeLabel}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {g.reasons.length.toLocaleString('th-TH')} เหตุผล
                    </span>
                  </div>

                  {g.reasons.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">ยังไม่มีเหตุผลของช่องนี้</p>
                  ) : (
                    <ul className="space-y-1">
                      {g.reasons.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-secondary"
                        >
                          <span
                            className={
                              r.isActive
                                ? 'min-w-0 flex-1 truncate text-xs text-foreground'
                                : 'min-w-0 flex-1 truncate text-xs text-muted-foreground line-through'
                            }
                          >
                            {r.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => void toggleActive(r)}
                            disabled={busy}
                            title={r.isActive ? 'ปิดการใช้งาน (ไม่ลบทิ้ง)' : 'เปิดใช้งานอีกครั้ง'}
                            aria-label={`${r.isActive ? 'ปิด' : 'เปิด'} ${r.name}`}
                            className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
                          >
                            {r.isActive ? (
                              <Ban className="h-3.5 w-3.5" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex gap-2">
                    <input
                      className={fieldCls}
                      placeholder={`เพิ่มเหตุผล “${g.processLabel} · ${g.outcomeLabel}”`}
                      value={draft[key] ?? ''}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void add(g.processCode, g.outcomeCode);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void add(g.processCode, g.outcomeCode)}
                      disabled={busy || !(draft[key] ?? '').trim()}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" /> เพิ่ม
                    </button>
                  </div>
                </section>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReasonManagerDialog;
