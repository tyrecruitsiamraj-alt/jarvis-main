import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchSiamrajUnitRequest,
  saveUnitFieldOverridesPatch,
  unitRequestNoteKey,
} from '@/lib/siamrajUnitRequestsApi';
import { boardCardAge } from '@/lib/boardCardFacts';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';
import { ageRangeError } from '@/lib/ageRange';

const toNum = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * ═══ อายุที่รับ — หน้า 3 ของป๊อปประกาศ (เจ้าของ 4 ต.ค. 2569: *"เลือกสวัสดิการ + รายได้ เพศ อายุ
 * ดึงข้อมูลจากใบขอมาก่อน แต่ถ้าจะแก้ไขก็ทำได้"*) ═══
 *
 * - ค่าตั้งต้น = ที่ใบขอเขียน (API ทับค่าที่ทีมแก้ไว้ให้แล้วใน `age_range_min/max`)
 * - กด **บันทึกอายุ** เอง (เลิก auto-save ทั้งระบบแล้ว — ฟอร์มเปิดดูห้ามเขียนฐาน)
 * - เก็บที่ `field_overrides.age_min/age_max` ผ่าน `saveUnitFieldOverridesPatch` (อ่านของล่าสุดก่อนต่อ)
 * - "ใช้ตามใบขอ" = ลบค่าที่ทีมแก้ แล้วอ่านใบขอใหม่ (ค่าเดิมของใบขอไม่ได้ส่งมาแยก ห้ามเดา)
 */
export default function AgeRangeFields({
  job,
  onSaved,
}: {
  job: JobRequest;
  onSaved: (patch: Partial<JobRequest>) => void;
}) {
  const initMin = job.age_range_min ? String(job.age_range_min) : '';
  const initMax = job.age_range_max ? String(job.age_range_max) : '';
  const [minText, setMinText] = React.useState(initMin);
  const [maxText, setMaxText] = React.useState(initMax);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const edited = job.field_overrides?.age_min !== undefined || job.field_overrides?.age_max !== undefined;
  const dirty = minText !== initMin || maxText !== initMax;
  const id = React.useId();

  React.useEffect(() => {
    setMinText(initMin);
    setMaxText(initMax);
  }, [initMin, initMax]);

  const save = async () => {
    const requestNo = unitRequestNoteKey(job);
    if (!requestNo) {
      setError('ใบขอนี้ไม่มีเลขที่ใบขอ บันทึกไม่ได้');
      return;
    }
    const min = toNum(minText);
    const max = toNum(maxText);
    const bad = ageRangeError(Number.isNaN(min) ? -1 : min, Number.isNaN(max) ? -1 : max);
    if (bad) {
      setError(bad);
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await saveUnitFieldOverridesPatch(requestNo, { age_min: min, age_max: max });
      onSaved({ field_overrides: next, age_range_min: min ?? undefined, age_range_max: max ?? undefined });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกอายุไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const requestNo = unitRequestNoteKey(job);
    if (!requestNo) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await saveUnitFieldOverridesPatch(requestNo, { age_min: undefined, age_max: undefined });
      const fresh = await fetchSiamrajUnitRequest(job.id);
      onSaved({ field_overrides: next, age_range_min: fresh.age_range_min, age_range_max: fresh.age_range_max });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'กลับไปใช้ตามใบขอไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {edited ? 'ทีม Online แก้เป็น' : 'ใบขอเขียนว่า'} <span className="text-foreground">{boardCardAge(job)}</span>
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-min`} className="text-xs text-muted-foreground">
            อายุต่ำสุด
          </Label>
          <Input
            id={`${id}-min`}
            inputMode="numeric"
            value={minText}
            onChange={(e) => {
              setMinText(e.target.value.replace(/[^\d]/g, '').slice(0, 2));
              setSaved(false);
            }}
            className="w-24 tabular-nums"
            placeholder="ไม่จำกัด"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-max`} className="text-xs text-muted-foreground">
            อายุสูงสุด
          </Label>
          <Input
            id={`${id}-max`}
            inputMode="numeric"
            value={maxText}
            onChange={(e) => {
              setMaxText(e.target.value.replace(/[^\d]/g, '').slice(0, 2));
              setSaved(false);
            }}
            className="w-24 tabular-nums"
            placeholder="ไม่จำกัด"
          />
        </div>
        <Button type="button" size="sm" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? 'กำลังบันทึก…' : 'บันทึกอายุ'}
        </Button>
        {edited ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void reset()}>
            ใช้ตามใบขอ
          </Button>
        ) : null}
      </div>
      {saved && !dirty ? <p className={cn('text-xs', TONE.success.value)}>บันทึกแล้ว</p> : null}
      {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}
    </div>
  );
}
