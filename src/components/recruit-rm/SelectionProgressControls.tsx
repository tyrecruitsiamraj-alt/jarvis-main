import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  INFORM_PLAN_KEY,
  PREP_CHECKLIST_ITEMS,
  PREP_CHECKLIST_LABEL,
  SELECTION_STATUSES,
  SELECTION_STATUS_CLASS,
  SELECTION_STATUS_LABEL,
  isSelectionStatus,
  prepChecklistProgress,
  togglePrepChecklist,
  type PrepChecklist,
  type SelectionStatus,
} from '@/lib/selectionProgress';
import { saveSelectionProgress, type PublicApplication } from '@/lib/publicApplicationsApi';
import { buildFollowPrefillPath } from '@/lib/followPrefill';
import { cn } from '@/lib/utils';
import { LoaderCircle } from 'lucide-react';

/**
 * ขั้นในกระบวนการจ้าง + เช็คลิสต์เตรียมเข้างาน (เจ้าของสั่ง 16 ส.ค. 2569 ข้อ 5–7)
 *
 * - dropdown 6 ขั้น (รอนายพิจารณา … รอแจ้งเข้า)
 * - ติ๊ก 5 รายการ · ติ๊ก "ลงแผนแจ้งเข้า" แล้ว**พาไปหน้า Follow พร้อมชื่อ/เบอร์ตั้งไว้ให้**
 *   เหลือแค่เลือกวัน–เวลา (ข้อ 7)
 *
 * ⚠️ บันทึกทันทีที่กด (ไม่มีปุ่ม Save) — คนใช้จริงกดทีละช่องระหว่างคุยโทรศัพท์
 * ⚠️ ล้มแล้วต้อง**คืนค่าเดิมบนจอ** ไม่ใช่ปล่อยให้ค้างเป็นค่าที่ยังไม่ได้บันทึก
 */
export type SelectionProgressControlsProps = {
  application: PublicApplication;
  onSaved?: (next: PublicApplication) => void;
};

const SelectionProgressControls: React.FC<SelectionProgressControlsProps> = ({
  application,
  onSaved,
}) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SelectionStatus | ''>(application.selection_status ?? '');
  const [checklist, setChecklist] = useState<PrepChecklist>(application.prep_checklist ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = async (
    patch: { selection_status?: SelectionStatus | null; prep_checklist?: PrepChecklist },
    rollback: () => void,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const next = await saveSelectionProgress(application.id, patch);
      onSaved?.(next);
    } catch (e) {
      rollback();
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (raw: string) => {
    const prev = status;
    const next = isSelectionStatus(raw) ? raw : '';
    setStatus(next);
    void persist({ selection_status: next || null }, () => setStatus(prev));
  };

  const toggle = (key: (typeof PREP_CHECKLIST_ITEMS)[number]) => {
    const prev = checklist;
    const next = togglePrepChecklist(checklist, key);
    setChecklist(next);
    void persist({ prep_checklist: next }, () => setChecklist(prev));

    // ติ๊ก "ลงแผนแจ้งเข้า" → ไปตั้งตารางโทรที่หน้า Follow พร้อมชื่อ/เบอร์ (ข้อ 7)
    // เอาติ๊กออกไม่พาไปไหน (ไม่งั้นกดพลาดแล้วเด้งออกจากหน้าที่ทำอยู่)
    if (key === INFORM_PLAN_KEY && next[key]) {
      navigate(
        buildFollowPrefillPath({
          name: application.full_name,
          phone: application.phone,
          topic: `แจ้งเข้างาน ${application.job_title ?? ''}`.trim(),
        }),
      );
    }
  };

  const progress = prepChecklistProgress(checklist);

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/30 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`sel-${application.id}`} className="text-xs font-semibold text-foreground">
          ขั้นตอนตอนนี้
        </label>
        <select
          id={`sel-${application.id}`}
          value={status}
          disabled={busy}
          onChange={(e) => changeStatus(e.target.value)}
          className="jarvis-soft-field min-h-[34px] text-sm disabled:opacity-50"
        >
          <option value="">— ยังไม่ระบุ —</option>
          {SELECTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SELECTION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {status ? (
          <span
            className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', SELECTION_STATUS_CLASS[status])}
          >
            {SELECTION_STATUS_LABEL[status]}
          </span>
        ) : null}
        {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-xs font-semibold text-foreground">
          เตรียมเข้างาน{' '}
          <span className="font-mono tabular-nums text-muted-foreground">
            {progress.done}/{progress.total}
          </span>
        </span>
        {PREP_CHECKLIST_ITEMS.map((key) => (
          <label key={key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={checklist[key] === true}
              disabled={busy}
              onChange={() => toggle(key)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            {PREP_CHECKLIST_LABEL[key]}
            {key === INFORM_PLAN_KEY ? (
              <span className="text-[10px] text-muted-foreground/70">(ไปตั้งตารางโทร)</span>
            ) : null}
          </label>
        ))}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
};

export default SelectionProgressControls;
