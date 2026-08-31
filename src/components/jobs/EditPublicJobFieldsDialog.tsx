import React, { useEffect, useMemo, useState } from 'react';
import type { JobRequest } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  fetchSiamrajUnitRequest,
  saveUnitRequestMeta,
  siamrajExternalId,
} from '@/lib/siamrajUnitRequestsApi';
import { inferProvinceFromAddress, inferSubdistrictFromAddress } from '@/lib/parseThaiJobAddress';
import { displayDistrictLine } from '@/lib/displayJobLocation';
import { benefitDisplayLabels } from '@/lib/extraBenefits';
import {
  mergePickedIntoLines,
  rateLineChoices,
  type BenefitChoice,
} from '@/lib/jobBenefitPicks';
import {
  BENEFIT_LINE_MAX,
  INCOME_LINE_MAX,
  INCOME_OTHER_LABEL,
  INCOME_PERIOD_LABEL,
  INCOME_PERIODS,
  SUGGESTED_INCOME_LABELS,
  buildIncomeDisplay,
  cleanBenefitLines,
  sumIncomeLines,
  type IncomeLine,
  type IncomePeriod,
} from '@/lib/incomeBreakdown';
import { Checkbox } from '@/components/ui/checkbox';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import {
  getDistrictOptions,
  getProvinceOptions,
  getSubdistrictOptions,
} from '@/lib/thaiAddressCascade';

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
/**
 * ส่วนของฟอร์มที่จะโชว์ — 🔴 เพิ่ม 28 ส.ค. 2569 เพราะเจ้าของแยกงานเป็นขั้น:
 * *"กดถัดไปจะเจอช่องให้ใส่สถานที่ปฏิบัติงาน · กดถัดไปจะเจอช่อง Checklist ให้เลือกว่า
 * จากข้อมูลใบขอจะเอาอะไรมาเป็นสวัสดิการบ้าง"*
 * ⇒ ขั้น 2 โชว์ `place` · ขั้น 3 โชว์ `income` + `benefits`
 * ⚠️ ไม่ส่งมา = โชว์ครบทุกส่วนเหมือนเดิม (หน้าอื่นที่เรียกอยู่แล้วไม่ต้องแก้)
 */
export type PublicFieldSection = 'place' | 'income' | 'benefits';

const EditPublicJobFieldsDialog: React.FC<{
  job: JobRequest | null;
  sections?: PublicFieldSection[];
  onClose: () => void;
  onSaved?: (patch: Partial<JobRequest>) => void;
  /** true = คืนเนื้อฟอร์มเปล่า ๆ ไม่ห่อ Dialog (ฝังในแท็บ "แก้ไข" ของป๊อปอัปการ์ด) */
  embedded?: boolean;
}> = ({ job, sections, onClose, onSaved, embedded = false }) => {
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  /**
   * รายได้แบบแยกส่วน (เจ้าของสั่ง 20 ส.ค. 2569) — แต่ละแถว: ชื่อรายการ + จำนวนเงิน
   * แถวที่ยังกรอกไม่ครบเก็บเป็น string ไว้ก่อน (แปลง/คัดตอนบันทึกด้วย lib กลาง)
   */
  const [incomePeriod, setIncomePeriod] = useState<IncomePeriod>('monthly');
  const [incomeRows, setIncomeRows] = useState<{ label: string; amount: string }[]>([]);
  /** ยอดรวมที่ใส่เอง — ว่าง = ใช้ผลบวกของรายการ */
  const [incomeTotal, setIncomeTotal] = useState('');
  /** สวัสดิการ freetext บรรทัดละรายการ (เจ้าของเคาะ: จำกัด 5 รายการ ไม่งั้นเยอะเกิน) */
  const [benefitText, setBenefitText] = useState('');
  /**
   * ตารางอัตราตามใบขอ (ERP) — เจ้าของชี้ตารางนี้มาเองให้เอามาทำ checklist
   * ⚠️ ตารางนี้มาจากเส้น "ใบเดียว" (`?id=`) ไม่ได้ติดมากับรายการ จึงต้องดึงตอนเปิดป๊อป
   */
  const [rateChoices, setRateChoices] = useState<BenefitChoice[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  /** เปิด/ปิดแผงติ๊กจากตารางอัตรา (กดจากปุ่ม "เพิ่มรายการรายได้") */
  const [showRatePicker, setShowRatePicker] = useState(false);
  /** บรรทัดที่ติ๊กไว้ — 🔴 ค่าตั้งต้นคือไม่ติ๊กอะไรเลย (เจ้าของเคาะ) */
  const [pickedKeys, setPickedKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job) return;
    setError(null);
    setProvince(job.override_province ?? '');
    setDistrict(job.override_district ?? '');
    setSubdistrict(job.override_subdistrict ?? '');
    const savedIncome = job.field_overrides?.income;
    if (savedIncome && savedIncome.lines.length > 0) {
      setIncomePeriod(savedIncome.period);
      setIncomeRows(savedIncome.lines.map((l) => ({ label: l.label, amount: String(l.amount) })));
      setIncomeTotal(savedIncome.total != null ? String(savedIncome.total) : '');
    } else {
      setIncomePeriod('monthly');
      setIncomeRows([]);
      // ยังไม่เคยตั้งรายการ → ช่องยอดรวมทำหน้าที่เดิม (ทับเลขเดี่ยวบนประกาศ)
      setIncomeTotal(job.total_income != null ? String(job.total_income) : '');
    }
    // ค่าเก่าที่ติ๊กเป็นคีย์ → แปลงเป็นคำอ่านให้แก้ต่อได้ (ห้ามหายเงียบ)
    setBenefitText(benefitDisplayLabels(job.extra_benefits).join('\n'));
    setShowRatePicker(false);
    /**
     * ดึงตารางอัตราของใบนี้ — เส้น "ใบเดียว" เท่านั้นที่มี `rate_lines`
     * ⚠️ ล้มไม่เป็นไร (แค่ไม่มีอะไรให้ติ๊ก ยังพิมพ์เองได้) — ห้ามทำให้ป๊อปเปิดไม่ได้
     */
    const id = siamrajExternalId(job);
    if (!id) return;
    let cancelled = false;
    setRatesLoading(true);
    void fetchSiamrajUnitRequest(`siamraj-sql:${id}`)
      .then((full) => {
        if (!cancelled) setRateChoices(rateLineChoices(full.rate_lines));
      })
      .catch(() => {
        if (!cancelled) setRateChoices([]);
      })
      .finally(() => {
        if (!cancelled) setRatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job]);

  /**
   * ตัวเลือกที่อยู่แบบไล่ระดับ (เจ้าของสั่ง 17 ส.ค. 2569: *"จังหวัด อำเภอ ตำบล ทำเป็น Dropdown"*)
   *
   * เดิมเป็นช่องพิมพ์เอง — พิมพ์ผิด/สะกดคนละแบบ ("บางรัก" vs "เขตบางรัก") ทำให้ประกาศ
   * ขึ้นพื้นที่ที่คนหาไม่เจอ และตัวกรองจังหวัดบนบอร์ดก็จับไม่ตรง
   * ใช้ชุดข้อมูลเดียวกับหน้าเพิ่มงาน/หน้าสมัคร (`thaiAddressCascade`) ทั้งระบบจึงสะกดเหมือนกัน
   */
  const provinceOptions = useMemo(() => getProvinceOptions(), []);
  const districtOptions = useMemo(() => getDistrictOptions(province), [province]);
  const subdistrictOptions = useMemo(
    () => getSubdistrictOptions(province, district),
    [province, district],
  );

  if (!job) return null;

  // ค่าที่ระบบเดาได้เอง — โชว์เป็น placeholder ให้รู้ว่าถ้าไม่กรอกจะได้อะไร
  const guessedProvince = inferProvinceFromAddress(job.location_address || '') || 'ไม่ทราบ';
  const guessedDistrict = displayDistrictLine(job.location_address || '') || 'ไม่ทราบ';
  const guessedSubdistrict = inferSubdistrictFromAddress(job.location_address || '') || 'ไม่ทราบ';

  /** แปลงแถวในฟอร์ม → รายการที่ใช้ได้จริง (ตัดแถวที่กรอกไม่ครบ) */
  const parsedLines: IncomeLine[] = incomeRows
    .map((r) => ({ label: r.label.trim(), amount: Math.trunc(Number(r.amount)) }))
    .filter((r) => r.label !== '' && Number.isFinite(r.amount) && r.amount > 0);
  const linesSum = sumIncomeLines(parsedLines);
  const totalNum = incomeTotal.trim() === '' ? null : Math.trunc(Number(incomeTotal) || 0);
  /** ตัวอย่างที่ผู้สมัครจะเห็น — ใช้ตัวคำนวณเดียวกับหน้าสาธารณะเป๊ะ */
  const preview = buildIncomeDisplay(
    parsedLines.length > 0 ? { period: incomePeriod, lines: parsedLines, total: totalNum } : null,
  );
  const benefitLines = cleanBenefitLines(benefitText.split('\n'));
  // ⚠️ ห้ามใช้ useMemo ตรงนี้ — อยู่ใต้ early return ของ `open` แล้ว (rules-of-hooks)
  const mergedBenefitLines = benefitLines;

  const save = async () => {
    const requestNo = siamrajExternalId(job) || job.request_no;
    if (!requestNo) {
      setError('ใบขอนี้ไม่มีเลขที่ใบขอ — แก้ไม่ได้');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      /**
       * มีรายการ = เก็บเป็น breakdown (income) · ไม่มีรายการ = ช่องยอดรวมทำหน้าที่
       * เดิมของมัน (ทับเลขเดี่ยว total_income) — คนที่เคยตั้งเลขเดี่ยวไว้ไม่เสียค่า
       */
      const hasBreakdown = parsedLines.length > 0;
      const patch = {
        province: province.trim() || null,
        district: district.trim() || null,
        subdistrict: subdistrict.trim() || null,
        total_income: hasBreakdown
          ? null
          : incomeTotal.trim() === ''
            ? null
            : Math.max(0, Math.trunc(Number(incomeTotal) || 0)),
        // ที่ติ๊กจากตารางอัตรา ต่อท้ายของที่พิมพ์เอง — ตัวซ้ำถูกตัดให้แล้ว
        benefits: mergedBenefitLines.length > 0 ? mergedBenefitLines : null,
        income: hasBreakdown
          ? { period: incomePeriod, lines: parsedLines, total: totalNum }
          : null,
      };
      await saveUnitRequestMeta(requestNo, { field_overrides: patch });
      onSaved?.({
        override_province: patch.province,
        override_district: patch.district,
        override_subdistrict: patch.subdistrict,
        ...(patch.total_income != null ? { total_income: patch.total_income } : {}),
        ...(preview ? { income_display: preview } : { income_display: undefined }),
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

  /** โชว์ส่วนนี้ไหม — ไม่ส่ง `sections` มา = โชว์หมด */
  const show = (k: PublicFieldSection) => !sections || sections.includes(k);

  const body = (
        // `relative` = ที่ยึดของแผงเด้ง "อัตราตามใบขอ" (absolute inset-0) ข้างล่าง
        <div className="relative space-y-4">
          {show('place') ? (
          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">พื้นที่ทำงาน</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">จังหวัด</span>
                <select
                  className={fieldCls}
                  value={province}
                  onChange={(e) => {
                    // เปลี่ยนจังหวัด = อำเภอ/ตำบลเดิมใช้ไม่ได้แล้ว ต้องล้างทิ้ง
                    // ไม่ล้าง = ได้คู่ที่ไม่มีอยู่จริง (เช่น กรุงเทพฯ + อ.ศรีราชา)
                    setProvince(e.target.value);
                    setDistrict('');
                    setSubdistrict('');
                  }}
                >
                  <option value="">— ใช้ค่าที่ระบบเดา ({guessedProvince}) —</option>
                  {provinceOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">อำเภอ/เขต</span>
                <select
                  className={fieldCls}
                  value={district}
                  disabled={!province}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    setSubdistrict('');
                  }}
                >
                  <option value="">
                    {province ? `— ใช้ค่าที่ระบบเดา (${guessedDistrict}) —` : '— เลือกจังหวัดก่อน —'}
                  </option>
                  {districtOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">ตำบล/แขวง</span>
                <select
                  className={fieldCls}
                  value={subdistrict}
                  disabled={!district}
                  onChange={(e) => setSubdistrict(e.target.value)}
                >
                  <option value="">
                    {district ? `— ใช้ค่าที่ระบบเดา (${guessedSubdistrict}) —` : '— เลือกอำเภอก่อน —'}
                  </option>
                  {subdistrictOptions.map((sd) => (
                    <option key={sd} value={sd}>
                      {sd}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              ไม่เลือก = ใช้ค่าที่ระบบเดาจากที่อยู่ ERP · เลือกจังหวัดใหม่แล้วอำเภอ/ตำบลจะถูกล้าง
            </p>
            {/* ค่าเดิมที่เคยพิมพ์เองอาจไม่มีในรายการ (ก่อนเปลี่ยนเป็น dropdown)
                ต้องบอกให้รู้ ไม่ใช่ปล่อยให้ช่องว่างเปล่าแล้วเข้าใจว่าไม่เคยตั้ง */}
            {[
              province && !provinceOptions.includes(province) ? `จังหวัด "${province}"` : '',
              district && province && !districtOptions.includes(district) ? `อำเภอ "${district}"` : '',
              subdistrict && district && !subdistrictOptions.includes(subdistrict)
                ? `ตำบล "${subdistrict}"`
                : '',
            ].filter(Boolean).length > 0 ? (
              <p className={cn('rounded-lg px-2.5 py-1.5 text-[11px]', TONE.warn.soft, TONE.warn.value)}>
                ค่าเดิมที่เคยพิมพ์ไว้ไม่ตรงกับรายการมาตรฐาน (
                {[
                  province && !provinceOptions.includes(province) ? `จังหวัด "${province}"` : '',
                  district && province && !districtOptions.includes(district) ? `อำเภอ "${district}"` : '',
                  subdistrict && district && !subdistrictOptions.includes(subdistrict)
                    ? `ตำบล "${subdistrict}"`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                ) — เลือกใหม่จากรายการเพื่อให้ตัวกรองจับได้
              </p>
            ) : null}
          </section>
          ) : null}

          {show('income') ? (
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground">รายได้ที่จะโชว์บนประกาศ</p>
              {/* หน่วยของทั้งชุด — ห้ามปนรายวันกับรายเดือนในรายการเดียว */}
              <div className="flex items-center gap-1">
                {INCOME_PERIODS.map((pd) => (
                  <button
                    key={pd}
                    type="button"
                    aria-pressed={incomePeriod === pd}
                    onClick={() => setIncomePeriod(pd)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                      incomePeriod === pd ? TONE.info.solid : TONE.neutral.outline,
                    )}
                  >
                    {INCOME_PERIOD_LABEL[pd]}
                  </button>
                ))}
              </div>
            </div>

            {/* รายการรายได้ — ชื่อพิมพ์เอง/เลือกจากชุดแนะนำ + จำนวนเงิน (เจ้าของสั่ง 20 ส.ค. 2569) */}
            {incomeRows.length > 0 ? (
              <div className="space-y-1.5">
                {incomeRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      className={cn(fieldCls, 'flex-1')}
                      list="income-label-suggestions"
                      maxLength={30}
                      placeholder="เช่น ฐานเงินเดือน"
                      value={row.label}
                      onChange={(e) =>
                        setIncomeRows((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)),
                        )
                      }
                    />
                    <input
                      className={cn(fieldCls, 'w-28 text-right font-semibold tabular-nums')}
                      inputMode="numeric"
                      placeholder="บาท"
                      value={row.amount}
                      onChange={(e) =>
                        setIncomeRows((prev) =>
                          prev.map((r, j) =>
                            j === i ? { ...r, amount: e.target.value.replace(/[^\d]/g, '') } : r,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label={`ลบรายการ ${row.label || i + 1}`}
                      onClick={() => setIncomeRows((prev) => prev.filter((_, j) => j !== i))}
                      className={cn(
                        'shrink-0 rounded-lg border px-2 py-1.5 text-xs font-semibold',
                        TONE.danger.outline,
                      )}
                    >
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                ยังไม่มีรายการ — ประกาศจะโชว์รายได้แบบเดิม (เลขจาก ERP หรือยอดรวมที่ใส่ในช่องล่าง)
              </p>
            )}
            <datalist id="income-label-suggestions">
              {SUGGESTED_INCOME_LABELS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
            {incomeRows.length < INCOME_LINE_MAX ? (
              <button
                type="button"
                onClick={() => setShowRatePicker((v) => !v)}
                className={cn('rounded-lg border px-2.5 py-1 text-xs font-semibold', TONE.info.outline)}
              >
                + เพิ่มรายการรายได้
              </button>
            ) : (
              <p className="text-[11px] text-muted-foreground">ครบ {INCOME_LINE_MAX} รายการแล้ว</p>
            )}

            {/**
              * ═══ กด "เพิ่มรายการรายได้" แล้ว **เด้งป๊อป** ตารางอัตราตามใบขอมาให้ติ๊ก ═══
              *
              * เจ้าของสั่ง 31 ส.ค. 2569: *"ต้องการกดคำว่า เพิ่มรายการรายได้ แล้วให้ popup
              * เด้งอัตราตามใบขอ (ERP) ขึ้นมาพร้อมกับกล่อง Checkbox"*
              *
              * 🔴 **ไม่ใช้ `Dialog`** — ฟอร์มนี้ถูกฝังอยู่ในป๊อปไล่งานอยู่แล้ว (`embedded`)
              * ใส่ Dialog ซ้อนเข้าไปคือผิดกติกาบ้านนี้ตรง ๆ ⇒ ทำเป็นแผงคลุมทับ**ในกล่องเดิม**
              * ได้ความรู้สึกเด้งเหมือนกัน แต่ไม่ซ้อนชั้นป๊อป
              *
              * 🔴 ติ๊กหลายอันแล้วกดเพิ่มทีเดียว · ตัวเลขที่ใส่ให้คือ**อัตราจ่าย** เท่านั้น
              */}
            {showRatePicker ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/25 p-3">
                <div
                  className={cn(
                    'flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-lg',
                    'border-border bg-card',
                  )}
                >
                  <div className="border-b border-border/70 px-3.5 py-2.5">
                    <p className="text-sm font-semibold text-foreground">อัตราตามใบขอ (ERP)</p>
                    <p className={cn('text-[11px]', DASH.muted)}>
                      ติ๊กอันที่จะเอาไปเป็นรายการรายได้ — ตัวเลขคืออัตราจ่าย อัตราเบิกไม่ขึ้นประกาศ
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2">
                    {ratesLoading ? (
                      <p className={cn('py-4 text-center text-xs', DASH.muted)}>
                        กำลังอ่านตารางอัตราของใบนี้…
                      </p>
                    ) : rateChoices.length === 0 ? (
                      <p className={cn('py-4 text-center text-xs', DASH.muted)}>
                        ใบนี้ไม่มีตารางอัตราจากระบบงานหลัก — กด "พิมพ์เองแทน" ข้างล่าง
                      </p>
                    ) : (
                      <ul className="divide-y divide-border/60">
                        {rateChoices.map((c) => {
                          const already = incomeRows.some((r) => r.label.trim() === c.name);
                          const on = pickedKeys.includes(c.key);
                          return (
                            <li key={c.key}>
                              <label
                                className={cn(
                                  'flex cursor-pointer items-center gap-2.5 py-2',
                                  already && 'opacity-45',
                                )}
                              >
                                <Checkbox
                                  checked={on}
                                  disabled={already}
                                  onCheckedChange={(v) =>
                                    setPickedKeys((cur) =>
                                      v === true
                                        ? [...cur, c.key]
                                        : cur.filter((k) => k !== c.key),
                                    )
                                  }
                                />
                                <span className="min-w-0 flex-1 text-xs text-foreground">
                                  {c.isPenalty ? (
                                    <span className={cn('mr-1 font-semibold', TONE.warn.value)}>⚠</span>
                                  ) : null}
                                  {c.name}
                                  {already ? (
                                    <span className={cn('ml-1 text-[11px]', DASH.muted)}>
                                      (ใส่ไปแล้ว)
                                    </span>
                                  ) : null}
                                  {c.isPenalty ? (
                                    <span className={cn('block text-[10px]', TONE.warn.value)}>
                                      บรรทัดค่าปรับ ไม่ใช่รายได้
                                    </span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                                  {c.amount != null && c.amount > 0
                                    ? c.amount.toLocaleString('th-TH')
                                    : '—'}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3.5 py-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIncomeRows((prev) => [...prev, { label: '', amount: '' }]);
                        setPickedKeys([]);
                        setShowRatePicker(false);
                      }}
                      className="text-[11px] font-semibold text-muted-foreground underline"
                    >
                      พิมพ์เองแทน
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPickedKeys([]);
                          setShowRatePicker(false);
                        }}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        disabled={pickedKeys.length === 0}
                        onClick={() => {
                          const add = rateChoices
                            .filter((c) => pickedKeys.includes(c.key))
                            .slice(0, Math.max(0, INCOME_LINE_MAX - incomeRows.length))
                            .map((c) => ({
                              label: c.name,
                              amount: c.amount != null ? String(c.amount) : '',
                            }));
                          setIncomeRows((prev) => [...prev, ...add]);
                          setPickedKeys([]);
                          setShowRatePicker(false);
                        }}
                        className={cn(
                          'rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-40',
                          TONE.info.solid,
                        )}
                      >
                        เพิ่ม {pickedKeys.length} รายการ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <label className="flex items-center gap-2 pt-1">
              <span className="shrink-0 text-xs text-muted-foreground">
                {parsedLines.length > 0 ? 'ยอดรวมที่จะโชว์ (ใส่เองได้)' : 'รายได้รวมที่จะโชว์'}
              </span>
              <input
                className={cn(fieldCls, 'text-center font-semibold tabular-nums')}
                inputMode="numeric"
                value={incomeTotal}
                placeholder={parsedLines.length > 0 ? `ผลบวก ${linesSum.toLocaleString('th-TH')}` : 'ใช้ค่าจาก ERP'}
                onChange={(e) => setIncomeTotal(e.target.value.replace(/[^\d]/g, ''))}
              />
            </label>

            {/* ตัวอย่างที่ผู้สมัครเห็น — คำนวณด้วยตัวเดียวกับหน้าสาธารณะ (เลข balance เสมอ:
                ยอดรวม > ผลบวก → เติมบรรทัด "อื่น ๆ" · ยอดรวม < ผลบวก → ใช้ผลบวกแทน) */}
            {preview ? (
              <div className={cn('space-y-0.5 rounded-xl px-3 py-2 text-xs', TONE.success.soft)}>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  ผู้สมัครจะเห็น ({INCOME_PERIOD_LABEL[preview.period]})
                </p>
                {preview.lines.map((l, i) => (
                  <div key={`${l.label}-${i}`} className="flex justify-between gap-3">
                    <span className={l.label === INCOME_OTHER_LABEL ? 'italic' : undefined}>
                      {l.label}
                    </span>
                    <span className="font-medium tabular-nums">฿{l.amount.toLocaleString('th-TH')}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-border/50 pt-0.5 font-semibold">
                  <span>รวม</span>
                  <span className="tabular-nums">฿{preview.total.toLocaleString('th-TH')}</span>
                </div>
                {totalNum != null && totalNum < linesSum ? (
                  <p className={cn('pt-0.5 text-[11px]', TONE.warn.value)}>
                    ยอดรวมที่ใส่ ({totalNum.toLocaleString('th-TH')}) น้อยกว่าผลบวกของรายการ —
                    ระบบใช้ผลบวกแทน (เลขบนประกาศห้ามน้อยกว่าของที่แจกแจง)
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                ล้างช่องให้ว่าง = กลับไปใช้เลขจาก ERP · ตัวเลขทั้งชุดทับเฉพาะที่โชว์บนประกาศ
              </p>
            )}
          </section>
          ) : null}

          {show('benefits') ? (
          <section className="space-y-3">
            {/**
              * ═══ ติ๊กเลือกจากสวัสดิการจริงของใบนี้ (เจ้าของสั่ง 31 ส.ค. 2569) ═══
              * *"หน้าเลือกสวัสดิการ เอาจากใบขอขึ้นมาให้เป็น Checklist ได้ไหม
              *  จะได้ไม่ต้องพิมพ์เอง"* · *"อยากได้แบบกดแล้วมีรายการให้เลือก"*
              *
              * 🔴 **คนละชุดกับชิปติ๊กที่ถอดไปเมื่อ 20 ส.ค.** — อันนั้นเป็นรายการสำเร็จรูป
              * 12 อันเหมือนกันทุกใบ · อันนี้คือ**อัตราจริงของใบนี้จาก ERP** ต่างกันทุกใบ
              * เจ้าของเคาะเองว่าเอาเฉพาะชุดนี้ ไม่เอารายการสำเร็จรูปกลับมา
              *
              * ทุกอันติ๊กไว้ให้ตั้งแต่แรก (ของเดิมขึ้นประกาศเองอยู่แล้ว) — ปลดติ๊ก = ไม่ให้คนนอกเห็น
              */}
            <p className="text-xs font-semibold text-muted-foreground">
              สวัสดิการเพิ่มเติม ({benefitLines.length}/{BENEFIT_LINE_MAX} รายการ)
            </p>
            <textarea
              className={cn(fieldCls, 'min-h-[92px]')}
              value={benefitText}
              onChange={(e) => setBenefitText(e.target.value)}
              placeholder={'บรรทัดละ 1 รายการ เช่น\nชุดฟอร์มฟรี\nรถรับส่งจากบีทีเอส'}
            />
            <p className="text-[11px] text-muted-foreground">
              บรรทัดละ 1 รายการ · เก็บสูงสุด {BENEFIT_LINE_MAX} รายการ รายการละไม่เกิน 30 ตัวอักษร
              (เกินจากนั้นถูกตัดทิ้งตอนบันทึก)
            </p>
            {benefitText.split('\n').filter((l) => l.trim()).length > BENEFIT_LINE_MAX ? (
              <p className={cn('rounded-lg px-2.5 py-1.5 text-[11px]', TONE.warn.soft, TONE.warn.value)}>
                ใส่เกิน {BENEFIT_LINE_MAX} รายการ — จะเก็บเฉพาะ {BENEFIT_LINE_MAX} รายการแรก:{' '}
                {benefitLines.join(' · ')}
              </p>
            ) : null}
          </section>
          ) : null}

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
  );

  /** ฝังเป็นส่วนหนึ่งของแท็บ "แก้ไข" ในป๊อปอัปการ์ด = คืนเนื้อฟอร์มเปล่า ๆ
   *  (เจ้าของเคาะ 20 ส.ค. 2569 — ถอดไอคอนดินสอบนการ์ดแล้วย้ายฟอร์มมารวมที่นี่)
   *  🔴 ห้ามซ้อน Dialog ใน Dialog */
  if (embedded) return body;

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

        {body}
      </DialogContent>
    </Dialog>
  );
};

export default EditPublicJobFieldsDialog;
