import React, { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";
import LoadErrorNotice from "@/components/shared/LoadErrorNotice";
import { friendlyErrorText } from "@/lib/friendlyError";
import { DASH, TONE } from "@/lib/designTokens";
import {
  EMPTY_VALUE_CASE,
  computeValueCase,
  normalizeValueCase,
  effectiveNowSalary,
  type ValueCaseInputs,
  type ValueCaseMonth,
} from "@/lib/valueCase";
import { fetchValueCase, saveValueCase } from "@/lib/valueCaseApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChoiceDropdown } from "@/components/shared/ChoiceDropdown";
import {
  ValueBottleneckTab,
  ValueGapsTab,
  ValueOutcomeSection,
  ValueRequestTab,
} from "@/components/value/ValuePipelineTabs";

type ValueTab = "outcome" | "bottleneck" | "request" | "gaps";

/**
 * ═══ หน้าความคุ้มค่าระบบ (เจ้าของสั่ง 15 ต.ค. 2569 · เปิดได้คนเดียว ไม่มีในเมนู · /value) ═══
 * เจ้าของกรอก: คน/เงินเดือน/โอที ก่อนกับตอนนี้ · ค่าระบบรายเดือน · ลด/เพิ่มอะไรได้
 * ระบบเติม: ผู้สมัครเข้า · สายที่ AI โทรจบ รายเดือน · ตัวคิดอยู่ `src/lib/valueCase.ts` ที่เดียว
 * 🔴 ทุกเลขสรุปบอกที่มาเป็นสมการให้เห็น (เจ้าของไม่เชื่อเลขที่บวกลบไม่เห็น — 7 ต.ค. 2569)
 * 🔴 บันทึกเมื่อกดปุ่มเท่านั้น (บทเรียนฟอร์มเซฟเองเขียนฐานตอนแค่เปิดดู)
 */

const NUM = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const NUM1 = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });
const MONTH = new Intl.DateTimeFormat("th-TH", {
  month: "short",
  year: "2-digit",
  timeZone: "Asia/Bangkok",
});
const SAVED_AT = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

const baht = (n: number) => `${NUM.format(Math.round(n))} บาท`;
/** ส่วนต่าง: ติดลบ = เขียนเป็นคำ ไม่ใช่เครื่องหมายลบ (เจ้าของเคาะ 18 ต.ค. 2569 "คงตัวเลขจริง + เติมคำว่า ต้นทุนสูงกว่าเดิม") */
const savingText = (n: number) =>
  Math.round(n) < 0 ? `ต้นทุนสูงกว่าเดิม ${NUM.format(Math.abs(Math.round(n)))} บาท` : baht(n);
const monthLabel = (ym: string) =>
  MONTH.format(new Date(`${ym}-15T00:00:00+07:00`));

function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  placeholder = "0",
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode="decimal"
          className="tabular-nums"
          value={value === 0 ? "" : String(value)}
          placeholder={placeholder}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/,/g, ""));
            onChange(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
        />
        {suffix ? (
          <span className={cn("shrink-0 text-xs", DASH.muted)}>{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

/** บรรทัดสมการใต้ตัวเลข — ให้เห็นว่ามาจากไหน */
function Formula({ children }: { children: React.ReactNode }) {
  return <p className={cn("text-xs tabular-nums", DASH.muted)}>{children}</p>;
}

const ValueCasePage: React.FC = () => {
  usePageTitle("ความคุ้มค่าระบบ");
  const [tab, setTab] = useState<ValueTab>("outcome");
  /** เดือนของแท็บใบขอครบเส้น — เดือนนี้ + 3 เดือนก่อน (ระบบเริ่มใช้ ส.ค. 2569) */
  const pipeMonthOptions = useMemo(() => {
    const cur = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);
    return [0, 1, 2, 3].map((i) => {
      const d = new Date(`${cur}-15T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - i);
      const ym = d.toISOString().slice(0, 7);
      return { value: ym, label: monthLabel(ym) };
    });
  }, []);
  const [pipeMonth, setPipeMonth] = useState(() => pipeMonthOptions[0].value);
  const [pipeJob, setPipeJob] = useState("");
  const [inputs, setInputs] = useState<ValueCaseInputs>(EMPTY_VALUE_CASE);
  const [months, setMonths] = useState<ValueCaseMonth[]>([]);
  const [currentYm, setCurrentYm] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "not_allowed" | "error"
  >("loading");
  /** ค่าที่บันทึกล่าสุด — แก้แล้วคืนค่าเดิม = ไม่ค้าง "ยังไม่ได้บันทึก" (QA 17 ต.ค. 2569) */
  const [savedInputs, setSavedInputs] = useState<ValueCaseInputs>(EMPTY_VALUE_CASE);
  const dirty = useMemo(() => JSON.stringify(inputs) !== JSON.stringify(savedInputs), [inputs, savedInputs]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetchValueCase()
      .then((d) => {
        if (!alive) return;
        const loaded = normalizeValueCase(d.inputs);
        setInputs(loaded);
        setSavedInputs(loaded);
        setMonths(d.months);
        setCurrentYm(d.currentYm);
        setSavedAt(d.updatedAt);
        setState("ready");
      })
      .catch((e) => {
        if (alive)
          setState(
            e instanceof Error && e.message === "not_allowed"
              ? "not_allowed"
              : "error",
          );
      });
    return () => {
      alive = false;
    };
  }, [rev]);

  const set = <K extends keyof ValueCaseInputs>(
    key: K,
    value: ValueCaseInputs[K],
  ) => {
    setInputs((p) => ({ ...p, [key]: value }));
  };

  const result = useMemo(
    () => computeValueCase(inputs, months, currentYm),
    [inputs, months, currentYm],
  );

  const save = async () => {
    setSaveError(null);
    // 0 ชั่วโมง เซิร์ฟเวอร์เปลี่ยนเป็น 176 เงียบ ๆ ตอนอ่านกลับ (QA 17 ต.ค. 2569) — กันตั้งแต่ตอนกด
    if (!(inputs.hoursPerStaffMonth > 0)) {
      setSaveError("ชั่วโมงทำงานต่อคนต้องมากกว่า 0");
      return;
    }
    setSaving(true);
    try {
      const r = await saveValueCase(inputs);
      setSavedAt(r.updatedAt);
      setSavedInputs(inputs);
    } catch (e) {
      setSaveError(friendlyErrorText(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  };

  if (state === "not_allowed") {
    return (
      <div>
        <PageHeader title="ไม่พบหน้านี้" backPath="/" />
      </div>
    );
  }

  const savingTone =
    result.savingMonthly >= 0 ? TONE.success.value : TONE.danger.value;
  const totals = months.reduce(
    (t, m) => ({
      applicants: t.applicants + m.applicants,
      recruit: t.recruit + m.aiRecruitCalls,
      follow: t.follow + m.aiFollowCalls,
    }),
    { applicants: 0, recruit: 0, follow: 0 },
  );

  return (
    <div>
      <PageHeader
        title="ความคุ้มค่าระบบ"
        backPath="/"
        actions={
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs",
                saveError ? TONE.danger.value : DASH.muted,
              )}
            >
              {saveError ??
                (dirty
                  ? "ยังไม่ได้บันทึก"
                  : savedAt
                    ? `บันทึกแล้ว ${SAVED_AT.format(new Date(savedAt))}`
                    : "")}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => void save()}
              disabled={saving || state !== "ready" || !dirty}
            >
              <Save aria-hidden /> {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        }
      />

      {/* ═══ 4 แท็บ (เจ้าของ 19 ต.ค. 2569 "ทำไว้ที่หน้าความคุ้มค่าก่อน" · Choice "ทั้ง 4 แบบเป็นแท็บ") ═══ */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as ValueTab)} className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="outcome">คุ้มไหม</TabsTrigger>
            <TabsTrigger value="bottleneck">ช้าที่ตรงไหน</TabsTrigger>
            <TabsTrigger value="request">ใบขอนี้ติดอะไร</TabsTrigger>
            <TabsTrigger value="gaps">จุดบอด</TabsTrigger>
          </TabsList>
          {tab !== 'request' ? (
            <ChoiceDropdown value={pipeMonth} options={pipeMonthOptions} onChange={setPipeMonth} ariaLabel="เดือน" />
          ) : null}
        </div>
        <TabsContent value="outcome" className="space-y-4">
          <ValueOutcomeSection month={pipeMonth} />
      {/* ล้ม = ไม่วาดตัวเลข (เดิมขึ้น "0 บาท" ทั้งหน้าใต้ข้อความล้ม · QA 17 ต.ค. 2569) */}
      {state === "error" ? (
        <LoadErrorNotice
          className="mt-4"
          message="โหลดข้อมูลไม่สำเร็จ"
          onRetry={() => setRev((n) => n + 1)}
        />
      ) : (
      <div className="mt-4 space-y-4" data-testid="value-case">
        {/* ── สรุปบนสุด: ส่วนต่างต่อเดือน/ปี + AI ทำแทนกี่คน ── */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="space-y-1 rounded-2xl p-4">
            <p className={cn("text-xs", DASH.muted)}>ส่วนต่างต่อเดือน</p>
            {state === "loading" ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p
                className={cn("text-2xl font-medium tabular-nums", savingTone)}
              >
                {savingText(result.savingMonthly)}
              </p>
            )}
            <Formula>
              เดิม {NUM.format(result.beforeCost)} − ตอนนี้{" "}
              {NUM.format(result.nowCost)}
            </Formula>
          </Card>
          <Card className="space-y-1 rounded-2xl p-4">
            <p className={cn("text-xs", DASH.muted)}>ส่วนต่างต่อปี</p>
            {state === "loading" ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p
                className={cn("text-2xl font-medium tabular-nums", savingTone)}
              >
                {savingText(result.savingYearly)}
              </p>
            )}
            <Formula>ต่อเดือน × 12</Formula>
          </Card>
          <Card className="space-y-1 rounded-2xl p-4">
            <p className={cn("text-xs", DASH.muted)}>AI โทรแทนคน</p>
            {state === "loading" ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-medium tabular-nums text-foreground">
                {NUM1.format(result.aiFte)} คน
              </p>
            )}
            <Formula>
              {NUM.format(result.basisCalls)} สาย ×{" "}
              {NUM1.format(inputs.minutesPerCall)} นาที ={" "}
              {NUM.format(result.aiHours)} ชม. ÷{" "}
              {NUM.format(inputs.hoursPerStaffMonth)} ชม.ต่อคน
            </Formula>
          </Card>
        </div>

        {/* ── ก่อน / ตอนนี้ ── */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="space-y-3 rounded-2xl p-4">
            <h2 className="text-base font-medium text-foreground">
              ก่อนมีระบบ
            </h2>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <NumberField
                id="vcBeforeStaff"
                label="จำนวนคน"
                value={inputs.beforeStaff}
                onChange={(n) => set("beforeStaff", n)}
                suffix="คน"
              />
              <NumberField
                id="vcBeforeSalary"
                label="เงินเดือนเฉลี่ยต่อคน"
                value={inputs.beforeSalary}
                onChange={(n) => set("beforeSalary", n)}
                suffix="บาท"
              />
              <NumberField
                id="vcBeforeOt"
                label="โอทีต่อเดือน (ทั้งทีม)"
                value={inputs.beforeOt}
                onChange={(n) => set("beforeOt", n)}
                suffix="บาท"
              />
            </div>
            <div className="border-t border-border/70 pt-2">
              <p className="text-sm text-foreground">
                รวมต่อเดือน{" "}
                <b className="tabular-nums">{baht(result.beforeCost)}</b>
              </p>
              <Formula>
                {NUM.format(inputs.beforeStaff)} คน ×{" "}
                {NUM.format(inputs.beforeSalary)} + โอที{" "}
                {NUM.format(inputs.beforeOt)}
              </Formula>
            </div>
          </Card>

          <Card className="space-y-3 rounded-2xl p-4">
            <h2 className="text-base font-medium text-foreground">ตอนนี้</h2>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <NumberField
                id="vcNowStaff"
                label="จำนวนคน"
                value={inputs.nowStaff}
                onChange={(n) => set("nowStaff", n)}
                suffix="คน"
              />
              <NumberField
                id="vcNowSalary"
                label="เงินเดือนเฉลี่ยต่อคน"
                value={inputs.nowSalary}
                onChange={(n) => set("nowSalary", n)}
                suffix="บาท"
                placeholder={
                  inputs.beforeSalary > 0
                    ? NUM.format(inputs.beforeSalary)
                    : "0"
                }
              />
              <NumberField
                id="vcNowOt"
                label="โอทีต่อเดือน (ทั้งทีม)"
                value={inputs.nowOt}
                onChange={(n) => set("nowOt", n)}
                suffix="บาท"
              />
            </div>
            <div className="space-y-2">
              <p className={cn("text-xs", DASH.muted)}>ค่าระบบต่อเดือน</p>
              {inputs.systemCosts.map((c, i) => (
                /* กริด 12 ช่อง — ช่องกรอกของระบบกว้างเต็มเสมอ (jarvis-soft-field) ใช้ w- กำหนดเองไม่ได้ */
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-7">
                    <Input
                      aria-label={`ชื่อค่าใช้จ่ายที่ ${i + 1}`}
                      value={c.label}
                      placeholder="เช่น ค่าเซิร์ฟเวอร์"
                      maxLength={80}
                      onChange={(e) =>
                        set(
                          "systemCosts",
                          inputs.systemCosts.map((x, j) =>
                            j === i ? { ...x, label: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      aria-label={`ค่าใช้จ่ายที่ ${i + 1} ต่อเดือน`}
                      inputMode="decimal"
                      className="tabular-nums"
                      value={c.monthly === 0 ? "" : String(c.monthly)}
                      placeholder="0"
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/,/g, ""));
                        set(
                          "systemCosts",
                          inputs.systemCosts.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  monthly: Number.isFinite(n) && n >= 0 ? n : 0,
                                }
                              : x,
                          ),
                        );
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    size="iconXs"
                    variant="ghost"
                    aria-label={`ลบ ${c.label || `ค่าใช้จ่ายที่ ${i + 1}`}`}
                    onClick={() =>
                      set(
                        "systemCosts",
                        inputs.systemCosts.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  set("systemCosts", [
                    ...inputs.systemCosts,
                    { label: "", monthly: 0 },
                  ])
                }
              >
                <Plus aria-hidden /> เพิ่มค่าใช้จ่าย
              </Button>
            </div>
            <div className="border-t border-border/70 pt-2">
              <p className="text-sm text-foreground">
                รวมต่อเดือน{" "}
                <b className="tabular-nums">{baht(result.nowCost)}</b>
              </p>
              <Formula>
                {NUM.format(inputs.nowStaff)} คน ×{" "}
                {NUM.format(effectiveNowSalary(inputs))} + โอที{" "}
                {NUM.format(inputs.nowOt)} + ค่าระบบ{" "}
                {NUM.format(result.systemCost)}
              </Formula>
            </div>
          </Card>
        </div>

        {/* ── งานที่ระบบทำ (ดึงจากระบบ) ── */}
        <Card className="space-y-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-base font-medium text-foreground">
              งานที่ระบบทำ
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:w-96">
              <NumberField
                id="vcMinutes"
                label="ถ้าคนโทรเอง ใช้กี่นาทีต่อสาย"
                value={inputs.minutesPerCall}
                onChange={(n) => set("minutesPerCall", n)}
                suffix="นาที"
              />
              <NumberField
                id="vcHours"
                label="ชั่วโมงทำงานต่อคนต่อเดือน"
                value={inputs.hoursPerStaffMonth}
                onChange={(n) => set("hoursPerStaffMonth", n)}
                suffix="ชม."
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">เดือน</TableHead>
                  <TableHead className="text-right text-xs">
                    ผู้สมัครเข้า
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    AI โทรงานสรรหา
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    AI โทรติดตาม
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    AI โทรรวม
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state === "loading"
                  ? Array.from({ length: 6 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : months.map((m) => {
                      const inBasis = result.basisYm === m.ym;
                      return (
                        /* กดแถว = ใช้เดือนนั้นเป็นฐานเทียบ (ระบบเพิ่งเริ่ม เดือนแรก ๆ เป็น 0 — ให้เลือกเอง) */
                        <TableRow
                          key={m.ym}
                          onClick={() => set("basisYm", m.ym)}
                          aria-selected={inBasis}
                          className={cn(
                            "cursor-pointer",
                            inBasis
                              ? "bg-primary/10 hover:bg-primary/10"
                              : DASH.muted,
                          )}
                        >
                          <TableCell className="text-sm">
                            {monthLabel(m.ym)}
                            {m.ym === currentYm ? (
                              <span className={cn("ml-1 text-xs", DASH.muted)}>
                                (ยังไม่จบเดือน)
                              </span>
                            ) : null}
                            {inBasis ? (
                              <span
                                className={cn(
                                  "ml-2 text-xs font-medium",
                                  TONE.primary.value,
                                )}
                              >
                                ฐานเทียบ
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {NUM.format(m.applicants)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {NUM.format(m.aiRecruitCalls)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {NUM.format(m.aiFollowCalls)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {NUM.format(m.aiRecruitCalls + m.aiFollowCalls)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="text-sm">รวม 6 เดือน</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {NUM.format(totals.applicants)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {NUM.format(totals.recruit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {NUM.format(totals.follow)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {NUM.format(totals.recruit + totals.follow)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <div className="grid gap-1 text-sm text-foreground sm:grid-cols-2">
            <p>
              ฐานเทียบ{" "}
              <span className={DASH.muted}>
                {result.basisYm
                  ? monthLabel(result.basisYm)
                  : "ยังไม่มีเดือนเต็ม"}
                {result.basisProjected ? " คาดทั้งเดือน" : ""}
              </span>{" "}
              <b className="tabular-nums">
                {NUM.format(result.basisCalls)} สาย
              </b>{" "}
              ·{" "}
              <b className="tabular-nums">
                {NUM.format(result.basisApplicants)} ผู้สมัคร
              </b>
            </p>
            <p>
              เท่ากับค่าแรง{" "}
              <b className="tabular-nums">{baht(result.aiFteValue)}</b>
              <span className={DASH.muted}>
                {" "}
                ต่อเดือน ({NUM1.format(result.aiFte)} คน ={" "}
                {NUM.format(result.basisCalls)} สาย × {NUM1.format(inputs.minutesPerCall)} นาที ÷ 60 ÷{" "}
                {NUM.format(inputs.hoursPerStaffMonth)} ชม. × {NUM.format(inputs.beforeSalary)})
              </span>
            </p>
            <p>
              ค่าระบบต่อสาย{" "}
              <b className="tabular-nums">
                {result.costPerCall === null
                  ? "—"
                  : `${NUM1.format(result.costPerCall)} บาท`}
              </b>
              <span className={DASH.muted}>
                {" "}
                ({NUM.format(result.systemCost)} ÷{" "}
                {NUM.format(result.basisCalls)} สาย)
              </span>
            </p>
          </div>
        </Card>

        {/* ── ลด / เพิ่ม — เจ้าของเขียนเอง ── */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="space-y-2 rounded-2xl p-4">
            <Label
              htmlFor="vcReduce"
              className="text-base font-medium text-foreground"
            >
              ลดอะไรได้
            </Label>
            <Textarea
              id="vcReduce"
              rows={6}
              value={inputs.notesReduce}
              maxLength={4000}
              onChange={(e) => set("notesReduce", e.target.value)}
            />
          </Card>
          <Card className="space-y-2 rounded-2xl p-4">
            <Label
              htmlFor="vcAdd"
              className="text-base font-medium text-foreground"
            >
              เพิ่มอะไรได้
            </Label>
            <Textarea
              id="vcAdd"
              rows={6}
              value={inputs.notesAdd}
              maxLength={4000}
              onChange={(e) => set("notesAdd", e.target.value)}
            />
          </Card>
        </div>
        {/* ปุ่มบันทึกท้ายหน้าด้วย — หน้ายาวราว 3,000px ปุ่มบนหัวมองไม่เห็นตอนกรอกช่องล่าง (QA 17 ต.ค. 2569) */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {saveError ? <span className={cn("text-xs", TONE.danger.value)}>{saveError}</span> : null}
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving || state !== "ready" || !dirty}>
            <Save aria-hidden /> {saving ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      </div>
      )}
        </TabsContent>
        <TabsContent value="bottleneck">
          <ValueBottleneckTab
            month={pipeMonth}
            onOpenJob={(id) => {
              setPipeJob(id);
              setTab('request');
            }}
          />
        </TabsContent>
        <TabsContent value="request">
          <ValueRequestTab jobId={pipeJob} onPick={setPipeJob} />
        </TabsContent>
        <TabsContent value="gaps">
          <ValueGapsTab month={pipeMonth} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ValueCasePage;
