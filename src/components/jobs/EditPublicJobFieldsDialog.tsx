import React, { useEffect, useState } from 'react';
import type { JobRequest } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { saveUnitRequestMeta, siamrajExternalId } from '@/lib/siamrajUnitRequestsApi';
import { inferProvinceFromAddress, inferSubdistrictFromAddress } from '@/lib/parseThaiJobAddress';
import { displayDistrictLine } from '@/lib/displayJobLocation';
import { EXTRA_BENEFITS } from '@/lib/extraBenefits';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * แก้ข้อมูลที่จะไปโผล่บน **หน้าประกาศสาธารณะ** — เปิดจากการ์ดในกล่องงาน
 * (เจ้าของสั่ง 17 ส.ค. 2569: *"หน้าสาธารณะก่อนจะไปหน้า เพิ่มให้แก้ไขจากหน้ากล่องงานที"*)
 *
 * แก้ได้ 3 อย่าง:
 *   1. จังหวัด / อำเภอ / ตำบล — ที่อยู่ ERP เป็นข้อความก้อนเดียว ตัวถอดเดาผิดได้
 *      ประกาศเลยขึ้นพื้นที่ผิดแล้วคนในพื้นที่หาไม่เจอ
 *   2. รายได้รวม — เพิ่ม/ลดจากเลขที่ ERP ให้มา
 *   3. สวัสดิการเพิ่มเติม — ติ๊กจากรายการใน `src/lib/extraBenefits.ts`
 *
 * ⚠️ **ไม่ได้แก้ข้อมูลใน ERP** — เก็บเป็น override ฝั่งเรา (`siamraj_unit_notes.field_overrides`)
 * ล้างช่องให้ว่าง = กลับไปใช้ค่าจาก ERP ตามเดิม
 * ⚠️ รายได้ที่แก้ **ทับเฉพาะเลขที่โชว์** ไม่ใช่อัตราจ่ายจริง และไม่ใช่ตัวที่ AI ใช้คิด
 */
const EditPublicJobFieldsDialog: React.FC<{
  job: JobRequest | null;
  onClose: () => void;
  onSaved?: (patch: Partial<JobRequest>) => void;
}> = ({ job, onClose, onSaved }) => {
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [income, setIncome] = useState('');
  const [benefits, setBenefits] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job) return;
    setError(null);
    setProvince(job.override_province ?? '');
    setDistrict(job.override_district ?? '');
    setSubdistrict(job.override_subdistrict ?? '');
    setIncome(job.total_income != null ? String(job.total_income) : '');
    setBenefits(job.extra_benefits ?? []);
  }, [job]);

  if (!job) return null;

  // ค่าที่ระบบเดาได้เอง — โชว์เป็น placeholder ให้รู้ว่าถ้าไม่กรอกจะได้อะไร
  const guessedProvince = inferProvinceFromAddress(job.location_address || '') || 'ไม่ทราบ';
  const guessedDistrict = displayDistrictLine(job.location_address || '') || 'ไม่ทราบ';
  const guessedSubdistrict = inferSubdistrictFromAddress(job.location_address || '') || 'ไม่ทราบ';

  const toggle = (key: string) =>
    setBenefits((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const save = async () => {
    const requestNo = siamrajExternalId(job) || job.request_no;
    if (!requestNo) {
      setError('ใบขอนี้ไม่มีเลขที่ใบขอ — แก้ไม่ได้');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const trimmedIncome = income.trim();
      const patch = {
        province: province.trim() || null,
        district: district.trim() || null,
        subdistrict: subdistrict.trim() || null,
        total_income: trimmedIncome === '' ? null : Math.max(0, Math.trunc(Number(trimmedIncome) || 0)),
        benefits: benefits.length > 0 ? benefits : null,
      };
      await saveUnitRequestMeta(requestNo, { field_overrides: patch });
      onSaved?.({
        override_province: patch.province,
        override_district: patch.district,
        override_subdistrict: patch.subdistrict,
        ...(patch.total_income != null ? { total_income: patch.total_income } : {}),
        extra_benefits: patch.benefits,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls =
    'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary';

  return (
    <Dialog open={Boolean(job)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">แก้ข้อมูลที่จะขึ้นประกาศ</DialogTitle>
          <DialogDescription className="text-xs">
            {job.request_no ? `${job.request_no} · ` : ''}
            {job.unit_name} — แก้แล้วมีผลเฉพาะหน้าประกาศสาธารณะ ไม่ได้แก้ข้อมูลใน ERP
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">พื้นที่ทำงาน</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">จังหวัด</span>
                <input
                  className={fieldCls}
                  value={province}
                  placeholder={guessedProvince}
                  onChange={(e) => setProvince(e.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">อำเภอ/เขต</span>
                <input
                  className={fieldCls}
                  value={district}
                  placeholder={guessedDistrict}
                  onChange={(e) => setDistrict(e.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">ตำบล/แขวง</span>
                <input
                  className={fieldCls}
                  value={subdistrict}
                  placeholder={guessedSubdistrict}
                  onChange={(e) => setSubdistrict(e.target.value)}
                />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              ปล่อยว่าง = ใช้ค่าที่ระบบเดาจากที่อยู่ (ตัวสีจางในช่อง)
            </p>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">รายได้รวมที่จะโชว์</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIncome(String(Math.max(0, (Number(income) || 0) - 500)))}
                className={cn('rounded-lg border px-3 py-1.5 text-sm font-semibold', TONE.neutral.outline)}
              >
                −500
              </button>
              <input
                className={cn(fieldCls, 'text-center font-semibold tabular-nums')}
                inputMode="numeric"
                value={income}
                placeholder="ใช้ค่าจาก ERP"
                onChange={(e) => setIncome(e.target.value.replace(/[^\d]/g, ''))}
              />
              <button
                type="button"
                onClick={() => setIncome(String((Number(income) || 0) + 500))}
                className={cn('rounded-lg border px-3 py-1.5 text-sm font-semibold', TONE.neutral.outline)}
              >
                +500
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              ล้างช่องให้ว่าง = กลับไปใช้เลขจาก ERP · ตัวเลขนี้ทับเฉพาะที่โชว์บนประกาศ
            </p>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              สวัสดิการเพิ่มเติม {benefits.length > 0 ? `(ติ๊กไว้ ${benefits.length})` : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXTRA_BENEFITS.map((b) => {
                const on = benefits.includes(b.key);
                return (
                  <button
                    key={b.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(b.key)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium',
                      on ? TONE.success.solid : TONE.neutral.outline,
                    )}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
          </section>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={cn('rounded-lg border px-3.5 py-1.5 text-sm font-medium', TONE.neutral.outline)}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className={cn(
                'rounded-lg px-3.5 py-1.5 text-sm font-semibold disabled:opacity-50',
                TONE.success.solid,
              )}
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditPublicJobFieldsDialog;
