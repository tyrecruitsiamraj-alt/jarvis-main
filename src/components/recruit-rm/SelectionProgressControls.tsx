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
import { saveSelectionProgressByPhone } from '@/lib/selectionProgressApi';
import { buildFollowPrefillPath } from '@/lib/followPrefill';
import { BoardUnitPickerBody } from '@/components/follow/BoardUnitPicker';
import type { BoardUnitOption } from '@/lib/boardUnitPicker';
import { needsUnitPick } from '@/lib/selectionUnitStage';
import { cn } from '@/lib/utils';
import { Building2, LoaderCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * ขั้นในกระบวนการจ้าง + เช็คลิสต์เตรียมเข้างาน (เจ้าของสั่ง 16 ส.ค. 2569 ข้อ 5–7)
 *
 * - dropdown 6 ขั้น (รอนายพิจารณา … รอแจ้งเข้า)
 * - ติ๊ก **6 รายการ** (เดิม 5 + "ทำบัตร" · เจ้าของเคาะ 22 ส.ค. 2569) · ติ๊ก "ลงแผนแจ้งเข้า"
 *   แล้ว**พาไปหน้า Follow พร้อมชื่อ/เบอร์ตั้งไว้ให้** เหลือแค่เลือกวัน–เวลา (ข้อ 7)
 * - **ขั้นที่รอหน่วยงาน** มีปุ่มเลือกหน่วยงาน (Phase 6.6 · เลือกจากรายการ ห้ามพิมพ์เอง)
 *
 * 🔴 **Phase 6.5: ใช้ได้กับสองแบบ** (เจ้าของเคาะ: "คนจาก match ใช้ด้วย")
 *   · `subject.kind === 'application'` — คนที่มีใบสมัคร → `PATCH /api/job-applications`
 *   · `subject.kind === 'person'` — คนจาก match (บอร์ด/iRecruit ไม่มีใบสมัคร) →
 *     `PATCH /api/selection-progress` (คีย์ jobId + เบอร์)
 *   ทั้งสองลงตารางกลางเดียวกัน คนคนเดียวจึงเห็นขั้นเดียวกันทุกหน้า
 *
 * ⚠️ บันทึกทันทีที่กด (ไม่มีปุ่ม Save) — คนใช้จริงกดทีละช่องระหว่างคุยโทรศัพท์
 * ⚠️ ล้มแล้วต้อง**คืนค่าเดิมบนจอ** ไม่ใช่ปล่อยให้ค้างเป็นค่าที่ยังไม่ได้บันทึก
 * ⚠️ ตัวเลือกหน่วยงานใช้ `Popover` **ไม่ใช่ Dialog** — component นี้ถูกฝังในป๊อปที่เป็น
 *   Dialog อยู่แล้ว (ห้าม Dialog ซ้อน Dialog)
 */
export type SelectionProgressSubject =
  | { kind: 'application'; application: PublicApplication }
  | {
      kind: 'person';
      /** id เต็มของใบขอ (ERP) */
      jobId: string;
      phone: string;
      fullName: string;
      jobTitle?: string | null;
      selectionStatus?: SelectionStatus | null;
      prepChecklist?: PrepChecklist;
      unitSiteCode?: string | null;
      unitName?: string | null;
    };

export type SelectionProgressControlsProps = {
  /** แบบใหม่ (Phase 6.5) — รองรับทั้งคนมีใบสมัครและคนจาก match */
  subject?: SelectionProgressSubject;
  /** แบบเดิม — ยังรับไว้ให้ผู้เรียกเก่าไม่พัง (เท่ากับ subject kind 'application') */
  application?: PublicApplication;
  onSaved?: (next: PublicApplication) => void;
  /** หน่วยงานให้เลือก (merge มาจากหน้าแม่) — ไม่ส่ง = ไม่โชว์ปุ่มเลือกหน่วยงาน */
  units?: BoardUnitOption[];
};

const SelectionProgressControls: React.FC<SelectionProgressControlsProps> = ({
  subject: subjectProp,
  application: legacyApplication,
  onSaved,
  units,
}) => {
  const navigate = useNavigate();
  const subject: SelectionProgressSubject | null =
    subjectProp ?? (legacyApplication ? { kind: 'application', application: legacyApplication } : null);

  const initial =
    subject?.kind === 'application'
      ? {
          status: subject.application.selection_status ?? '',
          checklist: subject.application.prep_checklist ?? {},
          unitName: subject.application.unit_name_progress ?? null,
          unitSiteCode: subject.application.unit_site_code ?? null,
          key: subject.application.id,
        }
      : subject
        ? {
            status: subject.selectionStatus ?? '',
            checklist: subject.prepChecklist ?? {},
            unitName: subject.unitName ?? null,
            unitSiteCode: subject.unitSiteCode ?? null,
            key: `${subject.jobId}::${subject.phone}`,
          }
        : { status: '' as const, checklist: {} as PrepChecklist, unitName: null, unitSiteCode: null, key: '' };

  const [status, setStatus] = useState<SelectionStatus | ''>(initial.status as SelectionStatus | '');
  const [checklist, setChecklist] = useState<PrepChecklist>(initial.checklist);
  const [unitName, setUnitName] = useState<string | null>(initial.unitName);
  const [unitOpen, setUnitOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!subject) return null;

  /** ยิงบันทึกตามชนิดของ subject — ปลายทางเป็นตารางกลางเดียวกันทั้งคู่ */
  const persist = async (
    patch: {
      selection_status?: SelectionStatus | null;
      prep_checklist?: PrepChecklist;
      unit_site_code?: string | null;
      unit_name?: string | null;
    },
    rollback: () => void,
  ) => {
    setBusy(true);
    setError(null);
    try {
      if (subject.kind === 'application') {
        const next = await saveSelectionProgress(subject.application.id, patch);
        onSaved?.(next);
      } else {
        await saveSelectionProgressByPhone({ jobId: subject.jobId, phone: subject.phone, ...patch });
      }
    } catch (e) {
      rollback();
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  /** path ไปหน้า Follow พร้อมชื่อ/เบอร์/เรื่อง/หน่วยงาน — ใช้ทั้งปุ่มและตอนติ๊กลงแผน */
  const followPath = () => {
    const name = subject.kind === 'application' ? subject.application.full_name : subject.fullName;
    const phone = subject.kind === 'application' ? subject.application.phone : subject.phone;
    const jobTitle = subject.kind === 'application' ? subject.application.job_title : subject.jobTitle;
    return buildFollowPrefillPath({
      name,
      phone,
      topic: `แจ้งเข้างาน ${jobTitle ?? ''}`.trim(),
      unitName: unitName ?? undefined,
    });
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
    // หน่วยงานที่เลือกไว้แล้วถูกส่งต่อไปให้ฟอร์ม Follow ด้วย (ไม่ต้องเลือกซ้ำ)
    if (key === INFORM_PLAN_KEY && next[key]) navigate(followPath());
  };

  const pickUnit = (u: BoardUnitOption) => {
    const prev = unitName;
    setUnitName(u.unitName);
    setUnitOpen(false);
    void persist({ unit_site_code: u.siteCode, unit_name: u.unitName }, () => setUnitName(prev));
  };

  const progress = prepChecklistProgress(checklist);
  const inputId = `sel-${initial.key}`;

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/30 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="text-xs font-semibold text-foreground">
          ขั้นตอนตอนนี้
        </label>
        <select
          id={inputId}
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

        {/* ขั้น "รอแจ้งเข้า" = ถึงคิวตั้งตารางโทรแจ้งเข้าแล้ว (Phase 6.9)
            🔴 เป็น **ปุ่มให้กด** ไม่ใช่เด้งเอง — การเลือก dropdown ไม่ควรพาคนออกจากหน้า
            ที่กำลังทำอยู่ (ต่างจากติ๊ก "ลงแผนแจ้งเข้า" ที่เจ้าของสั่งให้เด้งเลย) */}
        {status === 'await_inform' ? (
          <button
            type="button"
            onClick={() => navigate(followPath())}
            className="jarvis-btn-secondary text-xs"
          >
            ไปตั้งตารางโทรแจ้งเข้า
          </button>
        ) : null}
      </div>

      {/* หน่วยงานที่กำลังพิจารณา (Phase 6.6) — โผล่เฉพาะขั้นที่รอหน่วยงานจริง
          ⚠️ เลือกจากรายการเท่านั้น (ห้าม free text) · ใช้ Popover ไม่ใช่ Dialog */}
      {units && needsUnitPick(status || null) ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">หน่วยงานที่พิจารณา</span>
          <Popover open={unitOpen} onOpenChange={setUnitOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={busy}
                className="jarvis-btn-secondary text-xs disabled:opacity-50"
              >
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                {unitName ?? 'เลือกหน่วยงาน'}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(28rem,90vw)] p-3">
              <BoardUnitPickerBody
                units={units}
                onPick={pickUnit}
                listClassName="max-h-64 overflow-y-auto"
              />
            </PopoverContent>
          </Popover>
          {unitName ? (
            <span className="text-[11px] text-muted-foreground">
              เลือกไว้แล้ว — กดเพื่อเปลี่ยน
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">ยังไม่เลือก</span>
          )}
        </div>
      ) : null}

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
