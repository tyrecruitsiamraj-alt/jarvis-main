import React from 'react';
import { Button } from '@/components/ui/button';
import { saveUnitFieldOverridesPatch, unitRequestNoteKey } from '@/lib/siamrajUnitRequestsApi';
import {
  GENDER_CHOICES,
  erpGenderLabel,
  genderNeedsChoice,
  onlineGenderChoice,
  type GenderChoice,
} from '@/lib/genderRequirement';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';

/**
 * ═══ ช่องเลือกเพศ (เจ้าของเคาะ 26 ก.ย. 2569) ═══
 *
 * > *"ถ้าขึ้น O ให้เลือกได้ว่าจะใส่ว่าเพศอะไรก่อนขึ้นหน้าสาธารณะ"* → บังคับเลือกก่อนส่ง
 *
 * ใช้ร่วมสองป๊อป: ป๊อปประกาศหน้าเดียว (`BoardPublishSheet` · 2 ต.ค. 2569) กับป๊อป 4 ขั้นเดิม (`BoardPostingSteps` · ทางถอย)
 * — ย้ายออกมาจาก `BoardPostingPage.tsx` 2 ต.ค. 2569 ไม่ได้เปลี่ยนพฤติกรรม
 *
 * - บอก **"ใบขอเขียนว่า"** ไว้เสมอ — ใบขออาจมาไม่ถูกแต่แรก ทีม Online ต้องเห็นของเดิมด้วย
 * - กดแล้วบันทึกทันที (ไม่มีปุ่มบันทึกแยก) · เก็บที่ `field_overrides.gender` ช่องเดิม
 * - 🔴 เขียนผ่าน `saveUnitFieldOverridesPatch` (อ่านของล่าสุดก่อนต่อ) — ฟอร์มสถานที่/รายได้ก็เขียนก้อนเดียวกัน
 */
export default function GenderPicker({
  job,
  onSaved,
}: {
  job: JobRequest;
  onSaved: (patch: Partial<JobRequest>) => void;
}) {
  const [busy, setBusy] = React.useState<GenderChoice | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const chosen = onlineGenderChoice(job);
  const erp = erpGenderLabel(job);
  /** ปุ่มที่กดค้างไว้ = ค่าที่จะขึ้นประกาศตอนนี้ (ทีม Online เลือก หรือใบขอบอก ชาย/หญิง มาแล้ว) */
  const effective: GenderChoice | null = chosen ?? (erp === 'ชาย' || erp === 'หญิง' ? erp : null);
  const needs = genderNeedsChoice(job);

  const pick = async (choice: GenderChoice) => {
    const requestNo = unitRequestNoteKey(job);
    if (!requestNo) {
      setError('ใบขอนี้ไม่มีเลขที่ใบขอ บันทึกไม่ได้');
      return;
    }
    setBusy(choice);
    setError(null);
    try {
      const next = await saveUnitFieldOverridesPatch(requestNo, { gender: choice });
      const hadChoice = (job.field_overrides?.gender ?? '').trim() !== '';
      onSaved({
        field_overrides: next,
        gender_requirement: choice,
        // ค่าที่ใบขอเขียนไว้ — เลือกครั้งแรก = ค่าที่เห็นอยู่ · เคยเลือกแล้ว = ค่าที่ API จำไว้
        erp_gender_requirement: hadChoice ? (job.erp_gender_requirement ?? null) : (job.gender_requirement ?? null),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกเพศไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          ใบขอเขียนว่า <span className="text-foreground">{erp}</span>
        </span>
        {chosen ? (
          <span>
            ทีม Online เลือก <span className="text-foreground">{chosen}</span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {GENDER_CHOICES.map((g) => (
          <Button
            key={g}
            type="button"
            size="sm"
            variant={effective === g ? 'default' : 'outline'}
            aria-pressed={effective === g}
            disabled={busy !== null}
            onClick={() => void pick(g)}
          >
            {busy === g ? 'กำลังบันทึก…' : g}
          </Button>
        ))}
      </div>
      {needs ? (
        <p className={cn('rounded-lg border px-3 py-2 text-xs', TONE.warn.soft, TONE.warn.value)}>
          ใบขอไม่ระบุเพศ ต้องเลือกก่อนส่งประกาศ
        </p>
      ) : null}
      {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}
    </div>
  );
}
