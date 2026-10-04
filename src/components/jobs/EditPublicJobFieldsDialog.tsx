/**
 * ═══ ข้อมูลที่จะขึ้นประกาศ — ขั้น 2 (สถานที่) กับขั้น 3 (รายได้ + สวัสดิการ) ของป๊อปไล่งาน ═══
 *
 * เดิมเป็นป๊อป "แก้ข้อมูลที่จะขึ้นประกาศ" จากการ์ดกล่องงาน (17 ส.ค. 2569) · ตอนนี้ฝังในป๊อปไล่งานอย่างเดียว
 * (`BoardPostingSteps`) — ห้ามห่อ Dialog ซ้อนในป๊อปอีก ⇒ **โหมด Dialog ถอดแล้ว 30 ก.ย. 2569** (ไม่มีใครเรียก)
 *
 * ═══ โฉมใหม่ 30 ก.ย. 2569 (เจ้าของไล่ทีละหน้า) ═══
 * - ขั้น 2: *"มันจะมีใบขอเขียนว่า กับ ใส่รายละเอียดเองใช่ไหม ควรมี Checkbox เพื่อให้รู้ว่าจะเอาอันไหน
 *   ถ้าไม่ได้จะใส่เองก็ซ่อนไว้ แต่ถ้าติ๊กว่าใส่เอง ค่อยโชว์ออกมา"* ⇒ สองกล่องเลือกได้อย่างเดียว
 *   ใบขอเขียนว่า = ล้างที่ตั้งเอง (ระบบอ่านจากที่อยู่ให้) · ใส่รายละเอียดเอง = จังหวัด/อำเภอ/ตำบล (เลือกที่อ่านได้ไว้ให้ก่อน)
 * - ขั้น 3 รายได้: *"มียอด Sum มาให้ มียอดคนเก่ารับ และ ยอดให้คีย์เอง และแน่นอน มี Checkbox"*
 *   → Choice "ติ๊กเลือกได้อย่างเดียว (แนะนำ)" · ตามใบขอ (ติ๊กบรรทัดอัตรา + ยอดรวม) · รายได้คนเก่า · ใส่เอง
 * - ขั้น 3 สวัสดิการ: *"Checkbox แล้วด้านขวาเป็นชื่อสวัสดิการ · ช่อง Freetext มาจากรายการที่ติ๊ก
 *   จะเพิ่มไรก็ตรงที่ติ๊กมีให้กดเพื่อใส่รายละเอียดเพิ่มเติม ลดการคีย์มือ"* → Choice "รายการทั่วไป (แนะนำ)"
 * - ทุกขั้น: *"ไม่ต้องมีคำว่าบันทึกแล้วปิด"* ⇒ ไม่มีปุ่มบันทึก/ปิด เหลือป้ายสถานะ (บันทึกเองเหมือนเดิม)
 * ตัวแปลงหน้าฟอร์ม ↔ ของที่บันทึก อยู่ `src/lib/publicFieldsForm.ts` ที่เดียว (มีเทสต์ไป-กลับ)
 *
 * ⚠️ **ไม่ได้แก้ข้อมูลใน ERP** — เก็บเป็น override ฝั่งเรา (`siamraj_unit_notes.field_overrides`)
 * ⚠️ รายได้ที่ตั้ง **ทับเฉพาะเลขที่โชว์** ไม่ใช่อัตราจ่ายจริง และไม่ใช่ตัวที่ AI ใช้คิด
 */
import React, { useEffect, useId, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { JobRequest } from '@/types';
import {
  fetchSiamrajUnitRequest,
  saveUnitRequestMeta,
  siamrajExternalId,
  unitRequestNoteKey,
} from '@/lib/siamrajUnitRequestsApi';
import { rateLineChoices, type BenefitChoice } from '@/lib/jobBenefitPicks';
import {
  BENEFIT_LABEL_MAX,
  BENEFIT_LINE_MAX,
  INCOME_LINE_MAX,
  INCOME_OTHER_LABEL,
  INCOME_PERIOD_LABEL,
  INCOME_PERIODS,
  buildIncomeDisplay,
  cleanBenefitLines,
  sumIncomeLines,
  type IncomeLine,
  type IncomePeriod,
} from '@/lib/incomeBreakdown';
import { EXTRA_BENEFITS } from '@/lib/extraBenefits';
import { resignedMonthlyNetAverage } from '@/lib/resignedIncome';
import { publicSafeAddress } from '@/lib/publicJobPrivacy';
import {
  RESIGNED_INCOME_LINE_LABEL,
  benefitDetailMax,
  benefitEntriesFromText,
  benefitTextFromEntries,
  buildOverridesPatch,
  formDiffersFromJob,
  formStateForSections,
  formStateFromJob,
  incomeDraftFromForm,
  incomeFormFromDraft,
  placeGuessForForm,
  placeModeOf,
  type BenefitEntry,
  type IncomeDraft,
  type IncomeMode,
  type OverridesFormState,
  type PlaceMode,
} from '@/lib/publicFieldsForm';
import { PAY_CYCLES, type PayCycle } from '@/lib/payCycle';
import {
  PUBLIC_TOGGLE_FIELDS,
  PUBLIC_FIELD_LABEL,
  readPublicVisibility,
  type PublicToggleField,
} from '@/lib/publicFieldVisibility';
import {
  getDistrictOptions,
  getProvinceOptions,
  getSubdistrictOptions,
} from '@/lib/thaiAddressCascade';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CheckRow, ChoiceBox, StepCard } from '@/components/jobs/postingStepParts';
import { EVEN_TYPE, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * ส่วนของฟอร์มที่จะโชว์ — ขั้น 2 = `place` · ขั้น 3 = `income` + `benefits` (+ ช่องที่ให้ผู้สมัครเห็น)
 * ไม่ส่งมา = โชว์ครบทุกส่วน
 * `visibility` (2 ต.ค. 2569) = เฉพาะกล่อง "ให้ผู้สมัครเห็นอะไรบ้าง" — ป๊อปประกาศหน้าเดียวแยกเป็นแถวของตัวเอง
 */
export type PublicFieldSection = 'place' | 'income' | 'benefits' | 'visibility';

const NUM = new Intl.NumberFormat('th-TH');
const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const NO_PLACE = { province: '', district: '', subdistrict: '' };
const NO_INCOME = { incomePeriod: 'monthly' as const, incomeRows: [], incomeTotal: '' };
const digitsOnly = (v: string) => v.replace(/[^\d]/g, '');

/** แถวรายได้ในฟอร์ม → รายการที่ใช้ได้จริง (ตัดแถวที่ไม่ครบ) — กติกาเดียวกับตัวประกอบ patch */
function parseIncomeRows(rows: OverridesFormState['incomeRows']): IncomeLine[] {
  return rows
    .map((r) => ({ label: r.label.trim(), amount: Math.trunc(Number(r.amount)) }))
    .filter((r) => r.label !== '' && Number.isFinite(r.amount) && r.amount > 0);
}

function PeriodToggle({ value, onChange }: { value: IncomePeriod; onChange: (next: IncomePeriod) => void }) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={value}
      onValueChange={(v) => {
        if (v === 'daily' || v === 'monthly') onChange(v);
      }}
      aria-label="หน่วยรายได้"
    >
      {INCOME_PERIODS.map((p) => (
        <ToggleGroupItem
          key={p}
          value={p}
          className="h-8 px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {INCOME_PERIOD_LABEL[p]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function PlaceSelect({
  id,
  label,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  /** ค่าเก่าที่พิมพ์เองก่อนเปลี่ยนเป็นรายการ — ใส่ไว้ให้เห็นว่าตั้งอะไรอยู่ (ไม่งั้นช่องว่างเหมือนไม่เคยตั้ง) */
  const legacy = value !== '' && !options.includes(value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="h-10 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={cn('max-h-72', EVEN_TYPE)}>
          {legacy ? <SelectItem value={value}>{value}</SelectItem> : null}
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** "ผู้สมัครจะเห็น …" บรรทัดเดียว */
function SeenLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground">
      ผู้สมัครจะเห็น <span className="text-foreground">{children}</span>
    </p>
  );
}

const EditPublicJobFieldsDialog: React.FC<{
  job: JobRequest | null;
  sections?: PublicFieldSection[];
  /**
   * ไม่วาดกล่อง "ให้ผู้สมัครเห็นอะไรบ้าง" ที่ปกติติดมากับรายได้/สวัสดิการ (2 ต.ค. 2569) — ป๊อปประกาศหน้าเดียว
   * วาดกล่องนั้นเป็นแถวแยก (`sections={['visibility']}`) ⇒ ฟอร์มนี้ต้องไม่ถือช่องนั้นด้วย ไม่งั้นเขียนทับกัน
   */
  hideVisibility?: boolean;
  onSaved?: (patch: Partial<JobRequest>) => void;
}> = ({ job, sections, hideVisibility = false, onSaved }) => {
  const uid = useId();
  /**
   * 🔴 **ค่าตั้งต้นมาจากใบขอตั้งแต่ render แรก** (แก้ 27 ก.ย. 2569) — เดิมเริ่มจากค่าว่างแล้ว
   * ค่อยเติมใน useEffect ⇒ มีช่วงที่ฟอร์มถือค่าว่าง แล้ว auto-save หยิบช่วงนั้นไปเขียนทับ
   * ⚠️ ผู้เรียกต้องใส่ `key={job.id}` — เปลี่ยนใบ = สร้างฟอร์มใหม่ (ไม่เติมค่าข้ามใบ)
   */
  const [init] = useState(() => (job ? formStateFromJob(job) : null));

  // ── ขั้น 2 สถานที่ ──
  const [placeMode, setPlaceMode] = useState<PlaceMode>(() => placeModeOf(init ?? NO_PLACE));
  const [province, setProvince] = useState(init?.province ?? '');
  const [district, setDistrict] = useState(init?.district ?? '');
  const [subdistrict, setSubdistrict] = useState(init?.subdistrict ?? '');

  // ── ขั้น 3 รายได้ (เลือกได้ทางเดียว · ค่าของแต่ละทางจำไว้ สลับไปมาไม่หาย) ──
  const [income, setIncome] = useState<IncomeDraft>(() => incomeDraftFromForm(init ?? NO_INCOME));
  /** บรรทัดรายได้ตอนเปิด — บรรทัดที่ไม่อยู่ในตารางอัตรา (พิมพ์เองสมัยก่อน) ยังโชว์ให้ติ๊กคืนได้ */
  const [openedRequestRows] = useState(() => income.requestRows);
  /**
   * ตารางอัตราตามใบขอ (ERP) — มาจากเส้น "ใบเดียว" (`?id=`) เท่านั้น ต้องดึงตอนเปิด
   * 🔴 **โชว์เฉพาะอัตราจ่าย** (`jobBenefitPicks`) — อัตราเบิกห้ามออกหน้าสาธารณะ
   */
  const [rateChoices, setRateChoices] = useState<BenefitChoice[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);

  /** รอบรับเงิน (4 ต.ค. 2569 — ไม่ใช่สวัสดิการ) */
  const [payCycles, setPayCycles] = useState<PayCycle[]>(() => init?.payCycles ?? []);

  // ── ขั้น 3 สวัสดิการ (ลำดับตามที่บันทึกไว้เสมอ) ──
  const [benefits, setBenefits] = useState<BenefitEntry[]>(() => benefitEntriesFromText(init?.benefitText ?? ''));
  /** รายการทั่วไปที่กด "+ รายละเอียด" แล้ว (ช่องกางอยู่) */
  const [detailOpen, setDetailOpen] = useState<ReadonlySet<string>>(() => new Set());
  const customSeq = React.useRef(0);

  /** หน้าสาธารณะเห็นช่องไหน (22 ก.ย. 2569) — true = โชว์ (ค่าเริ่มทุกช่อง) */
  const [visibility, setVisibility] = useState<Record<PublicToggleField, boolean>>(
    () => init?.visibility ?? readPublicVisibility(null),
  );
  const [error, setError] = useState<string | null>(null);
  /** สถานะ auto-save (22 ก.ย. 2569) — idle/saving/saved(+เวลา)/error */
  const [autoStatus, setAutoStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  /** ตัวบันทึกล่าสุด (อัปเดตทุก render) — ให้ debounce hook เรียกได้โดยไม่ผูก closure เก่า */
  const persistRef = React.useRef<null | (() => Promise<void>)>(null);
  /** นาฬิกา auto-save ที่ค้างอยู่ — `null` = ไม่มีของค้าง (🔴 ต้องคืนเป็น null ทุกครั้งที่ยกเลิก) */
  const autosaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /** ค่าที่จะบันทึกจริง — เฉพาะทางที่ติ๊กอยู่ (ใบขอเขียนว่า = ไม่ตั้งเอง) */
  const place = useMemo(
    () => (placeMode === 'manual' ? { province, district, subdistrict } : NO_PLACE),
    [placeMode, province, district, subdistrict],
  );
  const incomeForm = useMemo(() => incomeFormFromDraft(income), [income]);
  const { incomePeriod, incomeRows, incomeTotal } = incomeForm;
  const benefitText = useMemo(() => benefitTextFromEntries(benefits), [benefits]);

  const show = (k: PublicFieldSection) => !sections || sections.includes(k);
  const showPlace = show('place');
  const showIncome = show('income');
  const showBenefits = show('benefits');
  /** กล่อง "ให้ผู้สมัครเห็นอะไรบ้าง" — ติดมากับขั้น 3 แบบเดิม หรือขอแยกมาเฉพาะกล่องนี้ (`visibility`) */
  const showVisibility = sections
    ? sections.includes('visibility') || (!hideVisibility && (showIncome || showBenefits))
    : true;
  /** ช่องที่ฟอร์มนี้เป็นเจ้าของ — ช่องของขั้นอื่นเอาจากใบขอล่าสุดเสมอ (`formStateForSections`) */
  const own = useMemo(
    () => ({ place: showPlace, income: showIncome, benefits: showBenefits, visibility: showVisibility }),
    [showPlace, showIncome, showBenefits, showVisibility],
  );
  const needRates = showIncome;

  /**
   * ดึงตารางอัตราของใบนี้ (เฉพาะขั้นที่มีรายได้) — ล้มไม่เป็นไร แค่ไม่มีบรรทัดให้ติ๊ก
   * ผูกกับเลขใบ (ไม่ใช่ตัวแปร `job` ที่ถูกสร้างใหม่ทุก render ฝั่งแม่) — ดึงครั้งเดียวต่อใบ
   */
  const rateKey = job && needRates ? siamrajExternalId(job) : null;
  useEffect(() => {
    if (!rateKey) return;
    let cancelled = false;
    setRatesLoading(true);
    void fetchSiamrajUnitRequest(`siamraj-sql:${rateKey}`)
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
  }, [rateKey]);

  /**
   * 🔴 **Auto-save** (เจ้าของเคาะ 22 ก.ย. 2569 — "เซฟดราฟต์เอาไว้เสมอ")
   * แก้อะไรแล้วรอ 1.5 วิ ค่อยยิงบันทึกเงียบ ๆ · ยิงผ่าน `persistRef` (อัปเดตทุก render)
   * 🔴 **ยิงเฉพาะตอนฟอร์มต่างจากที่บันทึกไว้จริง** (`formDiffersFromJob` — แก้ 27 ก.ย. 2569)
   * เปิดดูเฉย ๆ / ฝั่งแม่ render ใหม่ / เพิ่งบันทึกเสร็จ = ฟอร์มเท่ากับใบขอ = ไม่ยิง (วนไม่ได้อีก)
   */
  useEffect(() => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (!job) return;
    const st = formStateForSections(job, own, { ...place, incomePeriod, incomeRows, incomeTotal, benefitText, payCycles, visibility });
    if (!formDiffersFromJob(st)) return;
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void persistRef.current?.();
    }, 1500);
    // ทุก field ที่ประกอบเป็น patch + ใบขอ (ของที่บันทึกไว้) — เปลี่ยนเมื่อไหร่เทียบใหม่
  }, [job, own, place, incomePeriod, incomeRows, incomeTotal, benefitText, payCycles, visibility]);

  /** unmount (สลับขั้น/ปิดป๊อป) ระหว่างมี auto-save ค้าง → flush กันของหาย */
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
        void persistRef.current?.();
      }
    };
  }, []);

  const provinceOptions = useMemo(() => getProvinceOptions(), []);
  const districtOptions = useMemo(() => getDistrictOptions(province), [province]);
  const subdistrictOptions = useMemo(() => getSubdistrictOptions(province, district), [province, district]);

  if (!job) return null;

  /**
   * บันทึก field_overrides — ยิงจาก auto-save / flush ตอนออกจากขั้น / ปุ่ม "ลองอีกครั้ง"
   * 🔴 คีย์ใบขอผ่าน `unitRequestNoteKey` ตัวกลางเท่านั้น (23 ก.ย. 2569 — คิดคีย์เองเคยเขียนทับใบขอจริง
   *    ที่เลขชนกับใบขอล่วงหน้า 64%)
   */
  const persist = async () => {
    const requestNo = unitRequestNoteKey(job);
    if (!requestNo) {
      setError('ใบขอนี้ไม่มีเลขที่ใบขอ บันทึกไม่ได้');
      return;
    }
    const st = formStateForSections(job, own, { ...place, incomePeriod, incomeRows, incomeTotal, benefitText, payCycles, visibility });
    // ไม่มีอะไรเปลี่ยน = ไม่ยิง (ด่านที่สอง เผื่อมีทางเรียกอื่นหลุดมา)
    if (!formDiffersFromJob(st)) return;
    setAutoStatus('saving');
    setError(null);
    try {
      const patch = buildOverridesPatch(st);
      await saveUnitRequestMeta(requestNo, { field_overrides: patch });
      const shown = buildIncomeDisplay(patch.income);
      onSaved?.({
        override_province: st.province.trim() || null,
        override_district: st.district.trim() || null,
        override_subdistrict: st.subdistrict.trim() || null,
        ...(patch.total_income != null ? { total_income: patch.total_income } : {}),
        income_display: shown ?? undefined,
        extra_benefits: patch.benefits ?? undefined,
        // ส่ง field_overrides ทั้งก้อนกลับ ให้สรุปขั้น 4/การ์ดฝั่งแม่อัปเดตทันที
        field_overrides: patch,
      });
      setAutoStatus('saved');
      setSavedAt(TIME.format(new Date()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
      setAutoStatus('error');
    }
  };
  // ให้ debounce hook เรียกตัวล่าสุดเสมอ (closure ใหม่ทุก render)
  persistRef.current = persist;

  // ── ขั้น 2 ──
  const choosePlace = (next: PlaceMode) => {
    if (next === placeMode) return;
    setPlaceMode(next);
    // ติ๊กใส่เองครั้งแรก = เลือกที่ระบบอ่านจากใบขอได้ไว้ให้ก่อน (ถูกแล้วไม่ต้องแตะ)
    if (next === 'manual' && !province && !district && !subdistrict) {
      const g = placeGuessForForm(job.location_address);
      setProvince(g.province);
      setDistrict(g.district);
      setSubdistrict(g.subdistrict);
    }
  };
  const requestPlaceText = publicSafeAddress({ location_address: job.location_address });
  const manualPlaceText = publicSafeAddress({
    location_address: job.location_address,
    override_province: province,
    override_district: district,
    override_subdistrict: subdistrict,
  });
  const legacyPlace = [
    province && !provinceOptions.includes(province) ? `จังหวัด ${province}` : '',
    district && province && !districtOptions.includes(district) ? `อำเภอ ${district}` : '',
    subdistrict && district && !subdistrictOptions.includes(subdistrict) ? `ตำบล ${subdistrict}` : '',
  ].filter(Boolean);

  // ── ขั้น 3 รายได้ ──
  /** รายได้คนเก่าเฉลี่ยต่อเดือน — `null` = ไม่มีงวดเต็มให้ใช้ (เช่น เปิดไซต์ใหม่) */
  const resignedAvg = resignedMonthlyNetAverage(job.resigned_income_3m, job.lastWorkingDay);
  const resignedAmount = income.resignedRows[0] ? Number(income.resignedRows[0].amount) || null : (resignedAvg?.amount ?? null);
  const chooseIncome = (next: IncomeMode) =>
    setIncome((d) => {
      if (d.mode === next) return d;
      if (next === 'resigned') {
        const rows =
          d.resignedRows.length > 0
            ? d.resignedRows
            : resignedAvg
              ? [{ label: RESIGNED_INCOME_LINE_LABEL, amount: String(resignedAvg.amount) }]
              : [];
        // ยอดสุทธิเฉลี่ย "ต่อเดือน" เสมอ
        return { ...d, mode: next, resignedRows: rows, period: 'monthly' };
      }
      return { ...d, mode: next };
    });
  /**
   * 🔴 บรรทัดรายได้จำด้วย **ชื่อ + ยอด** ไม่ใช่ชื่ออย่างเดียว (เจ้าของ 4 ต.ค. 2569: *"ฉันเลือก 12000 ทำไมช่องด้านล่างไม่ขึ้น 12000"*)
   * ตารางอัตราของจริงมีชื่อซ้ำคนละยอด ("เงินเดือน" 12,000 ต่อเดือน กับ "เงินเดือน" 400 ต่อวัน) — เดิมจับด้วยชื่อ
   * ติ๊ก 12,000 แล้วจอบอกว่าติ๊กอยู่ แต่ที่เก็บไว้เป็น 400 และติ๊กซ้ำก็ไม่เปลี่ยน
   */
  const rowKey = (label: string, amount: string | number | null | undefined) =>
    `${label.trim()}\u0000${Math.trunc(Number(String(amount ?? '').replace(/,/g, '')) || 0)}`;
  const requestHas = (label: string, amount: string | number | null | undefined) =>
    income.requestRows.some((r) => rowKey(r.label, r.amount) === rowKey(label, amount));
  const setRequestRow = (row: { label: string; amount: string }, on: boolean) =>
    setIncome((d) => {
      const k = rowKey(row.label, row.amount);
      const has = d.requestRows.some((r) => rowKey(r.label, r.amount) === k);
      if (on) return has ? d : { ...d, requestRows: [...d.requestRows, row] };
      return { ...d, requestRows: d.requestRows.filter((r) => rowKey(r.label, r.amount) !== k) };
    });
  const erpKeys = new Set(rateChoices.map((c) => rowKey(c.name, c.amount)));
  /** ชื่อซ้ำ + ยอดเดียวกัน = บรรทัดเดียว (ของจริง: "ค่าล่วงเวลา 1.5 เท่า" สองบรรทัดเลขเดียวกัน) · ชื่อซ้ำคนละยอดโชว์ครบ */
  const rateRows = rateChoices.filter(
    (c, i, all) => all.findIndex((x) => rowKey(x.name, x.amount) === rowKey(c.name, c.amount)) === i,
  );
  /** บรรทัดที่ไม่อยู่ในตารางอัตรา (บันทึกไว้ก่อนหน้า) — ติ๊กคืน/ปลดได้เหมือนบรรทัดอื่น */
  const extraRows = [...openedRequestRows, ...income.requestRows].filter(
    (r, i, all) =>
      r.label.trim() !== '' &&
      !erpKeys.has(rowKey(r.label, r.amount)) &&
      all.findIndex((x) => rowKey(x.label, x.amount) === rowKey(r.label, r.amount)) === i,
  );
  const requestLines = parseIncomeRows(income.requestRows);
  const requestSum = sumIncomeLines(requestLines);
  const requestTotalNum = income.requestTotal.trim() === '' ? null : Math.trunc(Number(income.requestTotal) || 0);
  const parsedLines = parseIncomeRows(incomeRows);
  const totalNum = incomeTotal.trim() === '' ? null : Math.trunc(Number(incomeTotal) || 0);
  /** ตัวอย่างที่ผู้สมัครจะเห็น — ตัวคำนวณเดียวกับหน้าสาธารณะเป๊ะ (เลข balance เสมอ) */
  const preview = buildIncomeDisplay(
    parsedLines.length > 0 ? { period: incomePeriod, lines: parsedLines, total: totalNum } : null,
  );
  const rowsFull = income.requestRows.length >= INCOME_LINE_MAX;

  // ── ขั้น 3 สวัสดิการ ──
  const benefitsFull = benefits.length >= BENEFIT_LINE_MAX;
  const presetEntry = (key: string) =>
    benefits.find((e): e is Extract<BenefitEntry, { kind: 'preset' }> => e.kind === 'preset' && e.key === key);
  const togglePreset = (key: string, on: boolean) => {
    setBenefits((list) => {
      const has = list.some((e) => e.kind === 'preset' && e.key === key);
      if (on) return has || list.length >= BENEFIT_LINE_MAX ? list : [...list, { kind: 'preset', key, detail: '' }];
      return list.filter((e) => !(e.kind === 'preset' && e.key === key));
    });
    if (!on) {
      setDetailOpen((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  };
  const setPresetDetail = (key: string, detail: string) =>
    setBenefits((list) => list.map((e) => (e.kind === 'preset' && e.key === key ? { ...e, detail } : e)));
  const addCustom = () => {
    customSeq.current += 1;
    const id = `new-${customSeq.current}`;
    setBenefits((list) => (list.length >= BENEFIT_LINE_MAX ? list : [...list, { kind: 'custom', id, text: '' }]));
  };
  const setCustomText = (id: string, text: string) =>
    setBenefits((list) => list.map((e) => (e.kind === 'custom' && e.id === id ? { ...e, text } : e)));
  const removeCustom = (id: string) => setBenefits((list) => list.filter((e) => !(e.kind === 'custom' && e.id === id)));
  const customs = benefits.filter((e): e is Extract<BenefitEntry, { kind: 'custom' }> => e.kind === 'custom');
  const benefitPreview = cleanBenefitLines(benefitText.split('\n'));

  return (
    <div className="space-y-4">
      {showPlace ? (
        <StepCard title="สถานที่ปฏิบัติงาน">
          <div role="group" aria-label="สถานที่ที่ผู้สมัครจะเห็น" className="space-y-3">
            <ChoiceBox
              id={`${uid}-place-request`}
              checked={placeMode === 'request'}
              onSelect={() => choosePlace('request')}
              title="ใบขอเขียนว่า"
            >
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                {job.location_address?.trim() || 'ใบขอไม่ได้ใส่ที่อยู่มา'}
              </p>
              <SeenLine>{requestPlaceText || 'ไม่ระบุจังหวัด'}</SeenLine>
            </ChoiceBox>

            <ChoiceBox
              id={`${uid}-place-manual`}
              checked={placeMode === 'manual'}
              onSelect={() => choosePlace('manual')}
              title="ใส่รายละเอียดเอง"
            >
              {placeMode === 'manual' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <PlaceSelect
                      id={`${uid}-province`}
                      label="จังหวัด"
                      value={province}
                      options={provinceOptions}
                      placeholder="เลือกจังหวัด"
                      onChange={(v) => {
                        // เปลี่ยนจังหวัด = อำเภอ/ตำบลเดิมใช้ไม่ได้แล้ว (ไม่ล้าง = ได้คู่ที่ไม่มีจริง)
                        setProvince(v);
                        setDistrict('');
                        setSubdistrict('');
                      }}
                    />
                    <PlaceSelect
                      id={`${uid}-district`}
                      label="อำเภอ/เขต"
                      value={district}
                      options={districtOptions}
                      placeholder={province ? 'เลือกอำเภอ' : 'เลือกจังหวัดก่อน'}
                      disabled={!province}
                      onChange={(v) => {
                        setDistrict(v);
                        setSubdistrict('');
                      }}
                    />
                    <PlaceSelect
                      id={`${uid}-subdistrict`}
                      label="ตำบล/แขวง"
                      value={subdistrict}
                      options={subdistrictOptions}
                      placeholder={district ? 'เลือกตำบล' : 'เลือกอำเภอก่อน'}
                      disabled={!district}
                      onChange={setSubdistrict}
                    />
                  </div>
                  {legacyPlace.length > 0 ? (
                    <p className={cn('rounded-lg border px-3 py-2 text-xs', TONE.warn.soft, TONE.warn.value)}>
                      ค่าเดิมไม่อยู่ในรายการ {legacyPlace.join(' ')} เลือกใหม่จากรายการให้ตัวกรองหาเจอ
                    </p>
                  ) : null}
                  <SeenLine>{province || district || subdistrict ? manualPlaceText : 'ยังไม่ได้เลือก'}</SeenLine>
                </>
              ) : null}
            </ChoiceBox>
          </div>
        </StepCard>
      ) : null}

      {showIncome ? (
        <StepCard title="รายได้">
          <div role="group" aria-label="รายได้ที่จะขึ้นประกาศ" className="space-y-3">
            <ChoiceBox
              id={`${uid}-income-request`}
              checked={income.mode === 'request'}
              onSelect={() => chooseIncome('request')}
              title="ตามใบขอ"
              meta={income.mode === 'request' && requestSum > 0 ? `รวม ${NUM.format(requestSum)}` : undefined}
            >
              {income.mode === 'request' ? (
                <>
                  {ratesLoading ? (
                    <p className="text-xs text-muted-foreground">กำลังโหลดอัตราของใบนี้…</p>
                  ) : rateChoices.length === 0 && extraRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">ใบนี้ไม่มีตารางอัตรา เลือกทางอื่นแทน</p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {rateRows.map((c) => {
                        const on = requestHas(c.name, c.amount);
                        const noAmount = !(c.amount != null && c.amount > 0);
                        return (
                          <CheckRow
                            key={c.key}
                            id={`${uid}-rate-${c.key}`}
                            checked={on}
                            disabled={noAmount || (!on && rowsFull)}
                            onCheckedChange={(v) =>
                              setRequestRow({ label: c.name, amount: c.amount != null ? String(c.amount) : '' }, v)
                            }
                            label={
                              <>
                                {c.name}
                                {c.isPenalty ? (
                                  <span className={cn('ml-2 text-xs', TONE.warn.value)}>ค่าปรับ ไม่ใช่รายได้</span>
                                ) : null}
                              </>
                            }
                            meta={noAmount ? '—' : NUM.format(c.amount ?? 0)}
                          />
                        );
                      })}
                      {extraRows.map((r) => (
                        <CheckRow
                          key={`extra-${r.label}-${r.amount}`}
                          id={`${uid}-extra-${r.label}-${r.amount}`}
                          checked={requestHas(r.label, r.amount)}
                          disabled={!requestHas(r.label, r.amount) && rowsFull}
                          onCheckedChange={(v) => setRequestRow(r, v)}
                          label={r.label}
                          meta={NUM.format(Math.trunc(Number(r.amount)) || 0)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <PeriodToggle value={income.period} onChange={(p) => setIncome((d) => ({ ...d, period: p }))} />
                    <Label htmlFor={`${uid}-request-total`} className="text-xs font-normal text-muted-foreground">
                      ปรับยอดรวม
                    </Label>
                    {/* กว้างคุมที่กล่องครอบ — ช่องกรอกของแอป (`jarvis-soft-field`) บังคับเต็มความกว้างเสมอ */}
                    <div className="w-32">
                      <Input
                        id={`${uid}-request-total`}
                        className="text-right tabular-nums"
                        inputMode="numeric"
                        value={income.requestTotal}
                        placeholder={requestSum > 0 ? NUM.format(requestSum) : 'บาท'}
                        onChange={(e) => setIncome((d) => ({ ...d, requestTotal: digitsOnly(e.target.value) }))}
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </ChoiceBox>

            <ChoiceBox
              id={`${uid}-income-resigned`}
              checked={income.mode === 'resigned'}
              disabled={!resignedAmount}
              onSelect={() => chooseIncome('resigned')}
              title="รายได้คนเก่า"
              meta={resignedAmount ? `≈ ${NUM.format(resignedAmount)} ต่อเดือน` : 'ไม่มีข้อมูล'}
            >
              {income.mode === 'resigned' && resignedAvg ? (
                <p className="text-xs text-muted-foreground">
                  เฉลี่ยจากใบแจ้งเงินเดือน {NUM.format(resignedAvg.fullPeriods)} งวดเต็ม
                </p>
              ) : null}
            </ChoiceBox>

            <ChoiceBox
              id={`${uid}-income-manual`}
              checked={income.mode === 'manual'}
              onSelect={() => chooseIncome('manual')}
              title="ใส่เอง"
            >
              {income.mode === 'manual' ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-36">
                    <Input
                      aria-label="ยอดรายได้"
                      className="text-right tabular-nums"
                      inputMode="numeric"
                      placeholder="บาท"
                      value={income.manualAmount}
                      onChange={(e) =>
                        setIncome((d) => ({ ...d, manualAmount: digitsOnly(e.target.value), manualLegacy: false }))
                      }
                    />
                  </div>
                  <PeriodToggle
                    value={income.period}
                    onChange={(p) => setIncome((d) => ({ ...d, period: p, manualLegacy: false }))}
                  />
                </div>
              ) : null}
            </ChoiceBox>
          </div>

          {/* ผู้สมัครจะเห็น — ตัวคำนวณเดียวกับหน้าสาธารณะ (ยอดรวม > ผลบวก เติม "อื่น ๆ" · น้อยกว่า ใช้ผลบวก) */}
          <div className={cn('space-y-1 rounded-xl border px-3 py-2 text-sm', TONE.success.soft)}>
            <p className="text-xs text-muted-foreground">
              ผู้สมัครจะเห็น{preview ? ` ${INCOME_PERIOD_LABEL[preview.period]}` : ''}
            </p>
            {preview ? (
              <>
                {preview.lines.map((l, i) => (
                  <div key={`${l.label}-${i}`} className="flex justify-between gap-3">
                    <span className={l.label === INCOME_OTHER_LABEL ? 'text-muted-foreground' : undefined}>{l.label}</span>
                    <span className="tabular-nums">{NUM.format(l.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-border/60 pt-1 font-medium">
                  <span>รวม</span>
                  <span className="tabular-nums">{NUM.format(preview.total)} บาท</span>
                </div>
              </>
            ) : totalNum != null ? (
              <p className="font-medium tabular-nums">{NUM.format(totalNum)} บาท ต่อเดือน</p>
            ) : (
              <p className="text-muted-foreground">ยังไม่ได้ตั้งรายได้</p>
            )}
            {income.mode === 'request' && requestTotalNum != null && requestTotalNum < requestSum ? (
              <p className={cn('text-xs', TONE.warn.value)}>ยอดที่ใส่น้อยกว่ารวมของรายการ ประกาศใช้ยอดรวมของรายการแทน</p>
            ) : null}
          </div>
        </StepCard>
      ) : null}

      {showBenefits ? (
        /* รอบรับเงิน — แยกจากสวัสดิการ (เจ้าของ 4 ต.ค. 2569: *"จ่ายรายวันไม่ใช่สวัสดิการ เป็นแค่ทางเลือกรับเงิน
           ให้เลือกได้ว่าจะรับรายเดือน รายวัน รายสัปดาห์"*) · ติ๊กได้หลายแบบ (บางงานให้เลือกรับ) */
        <StepCard title="รับเงิน">
          <div role="group" aria-label="รอบรับเงิน" className="flex flex-wrap gap-x-6">
            {PAY_CYCLES.map((c) => (
              <CheckRow
                key={c.key}
                id={`${uid}-pay-${c.key}`}
                checked={payCycles.includes(c.key)}
                onCheckedChange={(v) =>
                  setPayCycles((cur) =>
                    PAY_CYCLES.map((x) => x.key).filter((k) => (k === c.key ? v : cur.includes(k))),
                  )
                }
                label={c.label}
              />
            ))}
          </div>
        </StepCard>
      ) : null}

      {showBenefits ? (
        /* 🔴 ไม่ล็อก 5 รายการแล้ว (เจ้าของ 4 ต.ค. 2569: *"ทำไมต้อง Lock ไว้ให้เลือกแค่ 5 ต้องเลือกได้เลย"*) */
        <StepCard title="สวัสดิการ">
          <div className="grid gap-x-6 sm:grid-cols-2">
            {EXTRA_BENEFITS.map((b) => {
              const entry = presetEntry(b.key);
              const on = Boolean(entry);
              if (b.count) {
                /* รายการที่บอกจำนวนได้ (ชุดฟอร์ม) — ใส่กี่ชุด หรือติ๊กไม่ระบุจำนวน */
                const n = (entry?.detail.match(/\d+/) ?? [''])[0];
                const unspecified = on && !n;
                return (
                  <CheckRow
                    key={b.key}
                    id={`${uid}-benefit-${b.key}`}
                    checked={on}
                    disabled={!on && benefitsFull}
                    onCheckedChange={(v) => togglePreset(b.key, v)}
                    label={b.label}
                  >
                    {on ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <Input
                              aria-label={`จำนวน${b.label}`}
                              inputMode="numeric"
                              className="text-right tabular-nums"
                              value={n}
                              placeholder="—"
                              onChange={(e) => {
                                const d = digitsOnly(e.target.value).slice(0, 2);
                                setPresetDetail(b.key, d ? `${Number(d)} ${b.count?.unit}` : '');
                              }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">{b.count.unit}</span>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                          <Checkbox
                            checked={unspecified}
                            onCheckedChange={(v) => {
                              if (v === true) setPresetDetail(b.key, '');
                            }}
                          />
                          ไม่ระบุจำนวน{b.count.unit}
                        </label>
                      </div>
                    ) : null}
                  </CheckRow>
                );
              }
              const detailShown = Boolean(entry) && (detailOpen.has(b.key) || (entry?.detail.trim() ?? '') !== '');
              return (
                <CheckRow
                  key={b.key}
                  id={`${uid}-benefit-${b.key}`}
                  checked={on}
                  disabled={!on && benefitsFull}
                  onCheckedChange={(v) => togglePreset(b.key, v)}
                  label={b.label}
                  action={
                    on && !detailShown ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setDetailOpen((s) => new Set(s).add(b.key))}
                      >
                        <Plus aria-hidden />
                        รายละเอียด
                      </Button>
                    ) : null
                  }
                >
                  {entry && detailShown ? (
                    <Input
                      aria-label={`รายละเอียด ${b.label}`}
                      value={entry.detail}
                      maxLength={benefitDetailMax(b.key)}
                      placeholder="ใส่รายละเอียด"
                      onChange={(e) => setPresetDetail(b.key, e.target.value)}
                    />
                  ) : null}
                </CheckRow>
              );
            })}
          </div>

          {customs.length > 0 ? (
            <div className="space-y-2">
              {customs.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <Checkbox
                    checked
                    aria-label={`เอา ${e.text.trim() || 'รายการนี้'} ออก`}
                    onCheckedChange={(v) => {
                      if (v !== true) removeCustom(e.id);
                    }}
                  />
                  <Input
                    aria-label="สวัสดิการที่เพิ่มเอง"
                    className="flex-1"
                    value={e.text}
                    maxLength={BENEFIT_LABEL_MAX}
                    placeholder="พิมพ์สวัสดิการ"
                    onChange={(ev) => setCustomText(e.id, ev.target.value)}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <Button type="button" variant="outline" size="xs" disabled={benefitsFull} onClick={addCustom}>
            <Plus aria-hidden />
            เพิ่มรายการเอง
          </Button>

          <div className={cn('space-y-1 rounded-xl border px-3 py-2 text-sm', TONE.success.soft)}>
            <p className="text-xs text-muted-foreground">ผู้สมัครจะเห็น</p>
            {benefitPreview.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-5">
                {benefitPreview.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">ยังไม่ได้เลือก</p>
            )}
          </div>
        </StepCard>
      ) : null}

      {/**
       * 🔴 ติ๊กว่าหน้าสาธารณะเห็นช่องไหน (เจ้าของเคาะ 22 ก.ย. 2569 นิยามกล่องงานข้อ 3)
       * อยู่คู่ขั้น 3 · เอาติ๊กออก = ซ่อนทั้งช่องบนหน้าสมัคร ไม่ลบค่า · ตัวตัดสินอยู่ที่ `publicFieldVisible()`
       */}
      {showVisibility ? (
        <StepCard title="ให้ผู้สมัครเห็นอะไรบ้าง">
          <div className="grid gap-x-6 sm:grid-cols-2">
            {PUBLIC_TOGGLE_FIELDS.map((f) => (
              <CheckRow
                key={f}
                id={`${uid}-visible-${f}`}
                checked={visibility[f]}
                onCheckedChange={(v) => setVisibility((prev) => ({ ...prev, [f]: v }))}
                label={PUBLIC_FIELD_LABEL[f]}
              />
            ))}
          </div>
        </StepCard>
      ) : null}

      {/* 🔴 ป้ายสถานะ auto-save — ไม่มีปุ่มบันทึก/ปิดแล้ว (เจ้าของ 30 ก.ย. 2569: "ไม่ต้องมีคำว่าบันทึกแล้วปิด") */}
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs" aria-live="polite">
        {autoStatus === 'saving' ? (
          <span className="text-muted-foreground">กำลังบันทึก…</span>
        ) : autoStatus === 'error' ? (
          <>
            <span className="text-destructive">{error ?? 'บันทึกไม่สำเร็จ'}</span>
            <Button type="button" variant="outline" size="xs" onClick={() => void persist()}>
              ลองอีกครั้ง
            </Button>
          </>
        ) : autoStatus === 'saved' && savedAt ? (
          <span className={TONE.success.value}>บันทึกแล้ว {savedAt}</span>
        ) : error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          <span className="text-muted-foreground">แก้แล้วบันทึกให้เอง</span>
        )}
      </div>
    </div>
  );
};

export default EditPublicJobFieldsDialog;
