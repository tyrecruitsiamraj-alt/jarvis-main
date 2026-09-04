import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import UnitSectorSelect from '@/components/jobs/UnitSectorSelect';
import { fetchUnitSectors, saveUnitSector } from '@/lib/unitSectorApi';
import { unitSectorLabel, type UnitSector } from '@/lib/unitSector';
import { toast } from '@/hooks/use-toast';
import PrequestBadge from '@/components/jobs/PrequestBadge';
import JobUrgencyBadge from '@/components/jobs/JobUrgencyBadge';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { computeJobUrgency, URGENCY_FILTER_OPTIONS } from '@/lib/jobUrgency';
import { RosterBackedStaffSelect } from '@/components/jobs/RosterBackedStaffSelect';
import { fetchSiamrajUnitRequest, saveSiamrajUnitAssignment } from '@/lib/siamrajUnitRequestsApi';
import { buildRecruiterNameOptions, buildScreenerNameOptions, buildOplNameOptions } from '@/lib/jobStaffNames';
import { refreshJobStaffFromApi } from '@/lib/jobStaffRemote';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/jobStaffRemote';
import { UnitRequestNoteDetail } from '@/components/jobs/UnitRequestNoteField';
import UnitRequestInfoFields from '@/components/jobs/UnitRequestInfoFields';
import UnitRequestTabs from '@/components/jobs/UnitRequestTabs';
import { UnitRequestReplacementSelect } from '@/components/jobs/UnitRequestReplacementToggle';
import {
  UnitRequestWorkStatusBadge,
  UnitRequestWorkStatusEditor,
} from '@/components/jobs/UnitRequestWorkStatusField';
import type { JobRequest } from '@/types';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { ChevronDown, Database, ExternalLink, Landmark, Users, StickyNote, UserCheck, UserMinus, ClipboardList } from 'lucide-react';
import {
  amountText,
  hasDeductSide,
  moneyFieldText,
  resignedIncomeRows,
  visibleRateLines,
} from '@/lib/unitRequestDetail';

import { resolveUnitDetailBackPath } from '@/lib/jobUnitSessionState';
import { backLabelFor } from '@/lib/stageOrigin';

function Field({ label, value }: { label: string; value?: string | number | null }) {
  const display =
    value === undefined || value === null || value === '' ? '—' : value;
  return (
    <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{display}</div>
    </div>
  );
}

const SiamrajUnitRequestDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  /**
   * ประเภทหน่วยงาน ราชการ/เอกชน — เจ้าของสั่งย้ายมาเลือกที่ใบงาน 25 ส.ค. 2569
   * (เดิมอยู่เป็นคอลัมน์ในตารางหน้ารายการ)
   * 🔴 ยังคีย์ด้วย site_code เหมือนเดิม — เลือกที่ใบนี้มีผลกับทุกใบขอของหน่วยงานเดียวกัน
   */
  const [sector, setSector] = React.useState<UnitSector | null>(null);
  const [savingSector, setSavingSector] = React.useState(false);
  /**
   * กล่อง "ข้อมูลใบขอ" กาง/หุบ — เจ้าของสั่ง 25 ส.ค. 2569:
   * *"ทำไอคำว่า ข้อมูลใบขอ ทำเป็นแบบลูกศรแล้วโชว์รายละเอียด"*
   * 🔴 **หุบเป็นค่าตั้งต้น** (เจ้าของเคาะ: *"หุบไว้ กดลูกศรค่อยกาง"*)
   * เปิดใบขอมาจะเห็นหัวข้อ + ส่วนอื่น (ผู้รับผิดชอบ/หมายเหตุ/ผู้สมัคร) ก่อน
   */
  const [infoOpen, setInfoOpen] = React.useState(false);
  const backPath = resolveUnitDetailBackPath({
    stateReturnTo: (location.state as { returnTo?: string } | null)?.returnTo,
    search: location.search,
  });
  const { hasPermission } = useAuth();
  const canAssignStaff = hasPermission('supervisor');

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['siamraj', 'unit-request', id],
    queryFn: () => fetchSiamrajUnitRequest(id),
    enabled: !!id,
  });

  const [recruiter, setRecruiter] = useState('');
  const [screener, setScreener] = useState('');
  const [opl, setOpl] = useState('');
  const [rosterRev, setRosterRev] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // โหลดรายชื่อสรรหา/คัดสรรจาก roster + ฟังการเปลี่ยนแปลง
  useEffect(() => {
    void refreshJobStaffFromApi();
    const onRoster = () => setRosterRev((r) => r + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, onRoster);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, onRoster);
  }, []);

  /**
   * โหลดประเภทหน่วยงานของไซต์นี้
   * 🔴 ล้มแล้วถือว่า "ยังไม่ระบุ" — หน้าใบงานต้องไม่พังเพราะช่องนี้
   */
  useEffect(() => {
    const code = String(data?.site_code ?? '').trim();
    if (!code) {
      setSector(null);
      return;
    }
    let alive = true;
    void fetchUnitSectors()
      .then((m) => {
        if (alive) setSector(m[code] ?? null);
      })
      .catch(() => {
        if (alive) setSector(null);
      });
    return () => {
      alive = false;
    };
  }, [data?.site_code]);

  /** บันทึกแบบมองโลกในแง่ดี — ล้มแล้วถอยกลับค่าเดิม (ไม่ปล่อยให้จอโกหก) */
  const changeSector = async (code: string, next: UnitSector | null) => {
    const prev = sector;
    setSector(next);
    setSavingSector(true);
    try {
      await saveUnitSector(code, next);
      toast({
        title: `หน่วยงานนี้ = ${unitSectorLabel(next)}`,
        description: `มีผลกับทุกใบขอของรหัส ${code}`,
      });
    } catch (e) {
      setSector(prev);
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: e instanceof Error ? e.message : 'ลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    } finally {
      setSavingSector(false);
    }
  };

  // seed ค่าผู้รับผิดชอบจากข้อมูลที่โหลดมา
  useEffect(() => {
    setRecruiter(data?.recruiter_name ?? '');
    setScreener(data?.screener_name ?? '');
    setOpl(data?.opl_name ?? '');
    setSaveMsg(null);
  }, [data?.recruiter_name, data?.screener_name, data?.opl_name]);

  const recruiterOptions = useMemo(() => {
    void rosterRev;
    return buildRecruiterNameOptions();
  }, [rosterRev]);
  const screenerOptions = useMemo(() => {
    void rosterRev;
    return buildScreenerNameOptions();
  }, [rosterRev]);
  const oplOptions = useMemo(() => {
    void rosterRev;
    return buildOplNameOptions();
  }, [rosterRev]);

  const requestNo = data?.request_no;
  const requestKey = (data?.externalId || data?.request_no)?.trim();
  const dirty =
    (recruiter.trim() || '') !== (data?.recruiter_name ?? '') ||
    (screener.trim() || '') !== (data?.screener_name ?? '') ||
    (opl.trim() || '') !== (data?.opl_name ?? '');

  const saveAssignment = async () => {
    const key = requestKey;
    if (!key || saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveSiamrajUnitAssignment(key, {
        recruiter_name: recruiter.trim() || null,
        screener_name: screener.trim() || null,
        opl_name: opl.trim() || null,
      });
      queryClient.setQueryData<JobRequest>(['siamraj', 'unit-request', id], (old) =>
        old
          ? {
              ...old,
              recruiter_name: recruiter.trim() || undefined,
              screener_name: screener.trim() || undefined,
              opl_name: opl.trim() || undefined,
            }
          : old,
      );
      await queryClient.invalidateQueries({ queryKey: ['siamraj', 'unit-request', id] });
      setSaveMsg('บันทึกผู้รับผิดชอบแล้ว');
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const urgencyMeta = data ? computeJobUrgency(data) : null;
  const urgencyHint = URGENCY_FILTER_OPTIONS.find((o) => o.value === urgencyMeta?.kind)?.hint;
  /** อัตราของใบขอ + รายได้จริงของคนเดิม — คิดที่ pure lib ที่เดียว (มีเทสต์คุม) */
  const rateLines = React.useMemo(() => (data ? visibleRateLines(data) : []), [data]);
  const incomeRows = React.useMemo(() => (data ? resignedIncomeRows(data) : null), [data]);
  const showDeduct = React.useMemo(
    () => (incomeRows ? hasDeductSide(incomeRows) : false),
    [incomeRows],
  );

  return (
    <div>
      <PageHeader
        title="รายละเอียดใบขอ"
        subtitle={data?.request_no || 'อ่านจาก Siamraj'}
        backPath={backPath}
        backLabel={backLabelFor(backPath)}
        actions={
          <>
            {/* ป้ายใบขอชั่วคราว — หน้ารายละเอียดคือที่ที่คนตัดสินใจว่าจะสัญญาอะไรกับผู้สมัคร */}
            <PrequestBadge job={data ?? { id }} />
            <span className={cn('inline-flex items-center gap-1', TONE.primary.chip)}>
              <Database className="w-3.5 h-3.5" />
              Siamraj · อ่านอย่างเดียว
            </span>
          </>
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {/* 4 แท็บของใบขอ (16 ส.ค. 2569 เย็น) — หน้านี้คือ "รายละเอียดงาน" */}
        {id ? <UnitRequestTabs jobId={id} active="detail" /> : null}
        {isLoading && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
        {error && (
          <p className="text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
            {error instanceof Error ? error.message : String(error)}
          </p>
        )}

        {data && (
          <>
            <div className="glass-card rounded-3xl p-4 border border-white/70 flex flex-wrap items-center gap-2">
              <UnitRequestWorkStatusBadge
                status={data.work_status}
                firstName={data.work_person_first_name}
                lastName={data.work_person_last_name}
                persons={data.work_persons}
              />
              <JobUrgencyBadge job={data} />
              {urgencyHint ? (
                <span className="text-xs text-muted-foreground" title={urgencyHint}>
                  {urgencyHint}
                </span>
              ) : null}
              {data.request_action_name ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground">
                  {data.request_action_name}
                </span>
              ) : null}
              {data.siamraj_status ? (
                <span className="text-xs text-muted-foreground">สถานะ ST: {data.siamraj_status}</span>
              ) : null}
            </div>

            <section className="glass-card rounded-3xl p-4 border border-white/70 space-y-2">
              {/* หัวข้อเป็นปุ่มกาง/หุบ (เจ้าของสั่ง 25 ส.ค. 2569) — ลูกศรหมุนตามสถานะ
                  ทั้งแถวกดได้ ไม่ใช่แค่ลูกศร (นิ้วบนมือถือกดโดนง่ายกว่า) */}
              <button
                type="button"
                onClick={() => setInfoOpen((v) => !v)}
                aria-expanded={infoOpen}
                className="flex min-h-9 w-full items-center gap-1.5 text-left text-sm font-semibold"
              >
                <ExternalLink className={cn("w-4 h-4", TONE.primary.value)} />
                ข้อมูลใบขอ
                <ChevronDown
                  className={cn(
                    'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    infoOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>
              {/* 🔴 ชุดช่องนี้ย้ายไปเป็น component กลาง 28 ส.ค. 2569 — popup ไล่งาน
                  บนกล่องงานต้องกางชุดเดียวกัน (เจ้าของสั่ง *"กดแล้วก็ขยายให้ดูเลย"*)
                  ห้ามก๊อปชุดช่องกลับมาเขียนซ้ำที่นี่ */}
              {infoOpen ? <UnitRequestInfoFields job={data} /> : null}

              {/* ── อัตราของใบขอจาก ERP (เจ้าของสั่ง 25 ส.ค. 2569) ──────────────────
                  🔴 ใบขอหนึ่งใบมีเฉลี่ย 15 บรรทัด · ตัดแถวที่ทั้งจ่ายและเบิกเป็น 0 ทิ้ง
                  แต่บรรทัดค่าจ้างหลักโชว์เสมอ (ตัวที่ประกาศเป็นรายได้ให้ผู้สมัคร) */}
              {infoOpen && rateLines.length > 0 ? (
                <div className="rounded-xl border border-white/70 bg-white/40 p-3">
                  <div className="text-xs font-semibold text-foreground">อัตราตามใบขอ (ERP)</div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full table-fixed text-xs">
                      <thead>
                        <tr className="text-left text-[10px] text-muted-foreground">
                          {/* table-fixed + ความกว้างคงที่ — บนมือถือ 375px ตัวเลขทั้งสองคอลัมน์
                              ต้องเห็นครบโดยไม่ต้องเลื่อนแนวนอน (ชื่อรายการตัดบรรทัดเอา) */}
                          <th className="w-1/2 pb-1 pr-2 font-medium">รายการ</th>
                          <th className="w-1/4 pb-1 pr-2 text-right font-medium">อัตราจ่าย (บาท)</th>
                          <th className="w-1/4 pb-1 text-right font-medium">อัตราเบิก (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rateLines.map((l) => (
                          <tr key={l.seq} className="border-t border-white/60">
                            <td className="py-1 pr-2 break-words">
                              {l.fee_name || '—'}
                              {l.is_wage ? (
                                <span className="ml-1 text-[10px] text-muted-foreground">
                                  (ค่าจ้างหลัก)
                                </span>
                              ) : null}
                              {l.remark ? (
                                <div className="text-[10px] text-muted-foreground">{l.remark}</div>
                              ) : null}
                            </td>
                            {/* 0 ที่มาจากฐานจริงต้องขึ้น 0 — ต่างจากไม่มีค่าที่ขึ้น "—"
                                หน่วยอยู่บนหัวคอลัมน์แล้ว ตัวเลขจึงไม่ตัดบรรทัดบนมือถือ */}
                            <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">
                              {amountText(l.payment_rate) ?? '—'}
                            </td>
                            <td className="whitespace-nowrap py-1 text-right tabular-nums">
                              {amountText(l.draw_rate) ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* ── คนที่ออก / เปลี่ยนตัว ── อยู่ในกล่อง "ข้อมูลใบขอ" เดียวกัน
                  (เจ้าของสั่ง 25 ส.ค. 2569: *"มันต้องไปอยู่รวมกับ [ข้อมูลใบขอ]"*)
                  ⇒ หุบกล่องนี้แล้วส่วนนี้หายตามไปด้วย เพราะเป็นข้อมูลอ่านอย่างเดียวชุดเดียวกัน
                  ⚠️ "เบอร์ติดต่อ" ไม่ซ้ำที่นี่แล้ว — กริดข้างบนมีอยู่ช่องเดียว
                  ⚠️ คอมเมนต์ JSX ต้องอยู่**นอก** `cond ? (` — วางในนั้นแล้ว TS ฟ้อง ')' expected */}
              {infoOpen ? (
                <div className="rounded-xl border border-white/70 bg-white/40 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <UserMinus className={cn('w-3.5 h-3.5', TONE.primary.value)} />
                    คนที่ออก / เปลี่ยนตัว
                  </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="ชื่อ - นามสกุล" value={data.resigned_employee_name} />
                  <Field label="สาเหตุที่ลาออก" value={data.resigned_reason} />
                  <Field label="รุ่น/ประเภทรถ" value={data.vehicle_required} />
                </div>

                {/* อัตราตามเงื่อนไขของคนคนนี้ — คนละเรื่องกับรายได้จริงข้างล่าง
                    🔴 ใช้คำ ERP ตรง ๆ ("ฝั่งจ่าย"/"ฝั่งเบิก") ไม่ตีความว่าฝั่งไหนเป็นเงินของใคร */}
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field
                    label="อัตราตามเงื่อนไข (ฝั่งจ่าย)"
                    value={moneyFieldText(data.resigned_wage_fee_rate)}
                  />
                  <Field
                    label="อัตราตามเงื่อนไข (ฝั่งเบิก)"
                    value={moneyFieldText(data.resigned_wage_draw_rate)}
                  />
                  <Field label="อัตรานี้มีผลตั้งแต่" value={data.resigned_wage_effective_date} />
                </div>

                {/* ── รายได้จริงย้อนหลัง 3 งวด — **แยกรายงวด ไม่ใช่ค่าเฉลี่ย** ──────────
                    (เจ้าของสั่ง: *"ฉันไม่ได้เอาแบบเฉลี่ย ฉันขอดูแบบย้อนหลัง 3 เดือนเลย"*)
                    🔴 ต้องมีช่วงวันของทุกงวด — งวดสุดท้ายของคนที่ออกมักไม่เต็มเดือน
                    ยอดจะดูต่ำผิดปกติถ้าไม่บอกว่าเป็นงวดสั้น */}
                <div className="rounded-xl border border-white/70 bg-white/40 p-3">
                  {/* 🔴 **ต้องบอกที่มา** (เจ้าของถาม 27 ส.ค. 2569: "ดึงมาจากไหน
                      เพราะเหมือนมันไม่ตรง") · สองอย่างที่ทำให้อ่านแล้วเข้าใจผิดมาตลอด:
                      (1) "งวด" ที่นี่ **ส่วนใหญ่เป็นครึ่งเดือน** ⇒ 3 งวด ~ 1.5 เดือน
                          ไม่ใช่ 3 เดือน (วัดฐาน: ครึ่งเดือน 71,542 · เต็มเดือน 31,876)
                      (2) เดิม **ไม่กรองไซต์** ⇒ เอาเงินจากงานอื่นมาปน (59% ของคน
                          มีงวดข้ามไซต์) — ตอนนี้กรองด้วยไซต์ของใบขอนี้แล้ว
                      (3) เดิมเป็น **ยอดรวมก่อนหัก** ⇒ สูงกว่าที่เขารับจริง
                          เจ้าของเคาะ 27 ส.ค. 2569 ให้ใช้ยอด eSlip (สุทธิ) แทน */}
                  <div className="text-xs font-semibold text-foreground">
                    รายได้จริง 3 งวดล่าสุดของงานนี้
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    ยอดเดียวกับ<span className="font-medium">ใบแจ้งเงินเดือน (eSlip)</span>
                    ของไซต์นี้เท่านั้น — เมนู ERP <span className="font-mono">PR-4813</span>
                    · <span className="font-medium">หนึ่งงวดมักเป็นครึ่งเดือน</span>
                    ดูช่วงวันในตารางก่อนเอาไปเทียบกับเงินเดือน
                  </p>
                  {incomeRows ? (
                    <table className="mt-2 w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] text-muted-foreground">
                          {/* 🔴 คอลัมน์ตามใบแจ้งเงินเดือน — **สุทธิ** คือตัวที่เจ้าของถาม
                              ("ยอดที่เขารับจริง") จึงอยู่ขวาสุดและเป็นตัวหนา
                              เงินหักโชว์เฉพาะตอนมีจริง (บางงวดหัก 0) */}
                          <th className="pb-1 pr-2 font-medium">งวด</th>
                          <th className="pb-1 pr-2 text-right font-medium">เงินได้ (บาท)</th>
                          {showDeduct ? (
                            <th className="pb-1 pr-2 text-right font-medium">หัก (บาท)</th>
                          ) : null}
                          <th className="pb-1 text-right font-medium">สุทธิ (บาท)</th>
                        </tr>
                    </thead>
                    <tbody>
                      {incomeRows.map((r) => (
                        <tr key={r.key} className="border-t border-white/60">
                          <td className="py-1 pr-2 break-words">{r.period}</td>
                          {/* null = งวดนั้นไม่มีบรรทัดฝั่งนี้ ⇒ "—" ห้ามขึ้น 0 */}
                          <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">
                            {amountText(r.pay) ?? '—'}
                          </td>
                          {showDeduct ? (
                            <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums text-muted-foreground">
                              {amountText(r.deduct) ?? '—'}
                            </td>
                          ) : null}
                          {/* สุทธิ = ตัวที่เจ้าของถามหา ทำให้เด่นกว่าช่องอื่น */}
                          <td className="whitespace-nowrap py-1 text-right font-semibold tabular-nums text-foreground">
                            {amountText(r.net) ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  // ไม่มีของ ต้องบอกว่าไม่มี ห้ามปล่อยว่างให้คนเดาว่าพัง
                  <p className="mt-1 text-xs text-muted-foreground">
                    {/* 414 ใบเข้าเคสนี้หลังกรองไซต์ (วัดแล้ว) — ต้องบอกว่าทำไมถึงไม่มี
                        ไม่ใช่แค่ "ไม่พบ" เฉย ๆ ซึ่งอ่านเหมือนระบบพัง */}
                    ไม่พบงวดจ่ายของคนคนนี้ในไซต์ของใบขอนี้ — อาจยังไม่ถึงรอบจ่าย
                    หรือเงินที่เคยได้มาจากไซต์อื่น
                  </p>
                )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    เงินได้ = ค่าแรง · ล่วงเวลา · เบี้ยเลี้ยง รวมกัน · หัก = ภาษี · ประกันสังคม ·
                    เงินประกัน · หนี้อื่น — งวดแรกหรืองวดสุดท้ายของคนที่เพิ่งเข้า/เพิ่งออก
                    มักไม่เต็มงวด ยอดจึงดูต่ำ
                  </p>
                  </div>
                </div>
              ) : null}

            </section>

            <section className="glass-card rounded-3xl p-4 border border-white/70 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Users className={cn("w-4 h-4", TONE.primary.value)} />
                ผู้รับผิดชอบ
              </h3>
              {canAssignStaff ? (
                <>
                  {/* ผู้รับผิดชอบ 3 ช่อง **อยู่บรรทัดเดียวกัน** (เจ้าของสั่ง 25 ส.ค. 2569)
                      เดิม 2 คอลัมน์ทำให้ช่องที่สามตกไปบรรทัดใหม่เสมอ */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <RosterBackedStaffSelect
                      role="recruiter"
                      label="เจ้าหน้าที่สรรหา"
                      value={recruiter}
                      onChange={setRecruiter}
                      optionNames={recruiterOptions}
                      canManageRoster={false}
                      rosterRev={rosterRev}
                    />
                    <RosterBackedStaffSelect
                      role="screener"
                      label="เจ้าหน้าที่คัดสรร"
                      value={screener}
                      onChange={setScreener}
                      optionNames={screenerOptions}
                      canManageRoster={false}
                      rosterRev={rosterRev}
                    />
                    <RosterBackedStaffSelect
                      role="opl"
                      label="เจ้าหน้าที่ OPL"
                      value={opl}
                      onChange={setOpl}
                      optionNames={oplOptions}
                      canManageRoster={false}
                      rosterRev={rosterRev}
                    />
                    {/* ⚠️ ช่อง "ทีม Online (ผู้รับผิดชอบ)" ถูกถอดออก (เจ้าของสั่ง 21 ส.ค. 2569:
                        *"ทีม Online (ผู้รับผิดชอบ) มีแค่กล่องงาน"*) — ตั้งค่าได้ที่ Gen link
                        ในกล่องงานที่เดียว · ไม่ส่ง online_name = server คงค่าเดิม (partial update) */}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button size="sm"
                      type="button"
                      onClick={() => void saveAssignment()}
                      disabled={saving || !requestKey || !dirty}
                      className="text-sm px-4 py-2"
                    >
                      {saving ? 'กำลังบันทึก…' : 'บันทึกผู้รับผิดชอบ'}
                    </Button>
                    {saveMsg && <span className="text-xs text-muted-foreground">{saveMsg}</span>}
                    {!requestKey && (
                      <span className="text-xs text-destructive">ใบขอนี้ไม่มีเลขที่ใบขอ จึงบันทึกไม่ได้</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label="เจ้าหน้าที่สรรหา" value={data.recruiter_name} />
                  <Field label="เจ้าหน้าที่คัดสรร" value={data.screener_name} />
                  <Field label="เจ้าหน้าที่ OPL" value={data.opl_name} />
                  <p className="sm:col-span-3 text-xs text-muted-foreground">
                    กำหนดผู้รับผิดชอบได้เฉพาะ Supervisor ขึ้นไป
                  </p>
                </div>
              )}
            </section>


            {/* ── สามช่องตั้งค่าใบขอ อยู่แถวเดียวกัน (เจ้าของสั่ง 25 ส.ค. 2569:
                *"ทำให้อยู่แถวเดียวกันที และทำเป็น Dropdown รูปแบบเดียวกัน ... เพื่อความสวยงาม
                ไม่ได้รวมข้อมูลกัน"*) — **ข้อมูลยังแยกกันเหมือนเดิม ไม่ได้ยุบรวม**
                วางไว้เหนือ "หมายเหตุ" ตามที่สั่ง
                ⚠️ สถานะทำงานมีฟอร์มย่อย (ชื่อคน/วันที่) โผล่เมื่อเลือกสถานะที่ต้องระบุคน
                จึงให้ทั้งกล่องกินเต็มแถวเมื่อฟอร์มนั้นเปิด — ไม่งั้นช่องกรอกแคบจนใช้ไม่ได้ */}
            <section className="glass-card rounded-3xl p-4 border border-white/70 space-y-3">
              <div className="grid items-start gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Landmark className={cn('w-3.5 h-3.5', TONE.primary.value)} />
                    ราชการ / เอกชน
                  </label>
                  <UnitSectorSelect
                    siteCode={data.site_code}
                    value={sector}
                    onChange={(code, next) => void changeSector(code, next)}
                    saving={savingSector}
                    className="w-full"
                    triggerClassName="w-full"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {data.site_code
                      ? `มีผลกับทุกใบขอของหน่วยงานนี้ (${data.site_code})`
                      : 'ใบขอนี้ยังไม่มีรหัสไซต์ จึงระบุประเภทหน่วยงานไม่ได้'}
                  </p>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <UserCheck className={cn('w-3.5 h-3.5', TONE.primary.value)} />
                    ส่งคนแทน
                  </label>
                  <UnitRequestReplacementSelect
                    job={data}
                    onSaved={(sendReplacement) => {
                      queryClient.setQueryData<JobRequest>(['siamraj', 'unit-request', id], (old) =>
                        old ? { ...old, send_replacement: sendReplacement } : old,
                      );
                    }}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    ใบขอนี้ส่งคนแทนหรือไม่
                  </p>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ClipboardList className={cn('w-3.5 h-3.5', TONE.primary.value)} />
                    สถานะทำงาน
                  </label>
                  {requestKey ? (
                    <UnitRequestWorkStatusEditor
                      requestKey={requestKey}
                      initialStatus={data.work_status}
                      initialFirstName={data.work_person_first_name}
                      initialLastName={data.work_person_last_name}
                      initialStatusDate={data.work_status_date}
                      initialPersons={data.work_persons}
                      hideLabel
                      onSaved={(next) => {
                        queryClient.setQueryData<JobRequest>(['siamraj', 'unit-request', id], (old) =>
                          old ? { ...old, ...next } : old,
                        );
                      }}
                    />
                  ) : (
                    <p className="text-xs text-destructive">
                      ใบขอนี้ไม่มีเลขที่ใบขอ จึงบันทึกสถานะไม่ได้
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    เก็บใน Jarvis — ไม่แก้สถานะบน Siamraj
                  </p>
                </div>
              </div>
            </section>

            <section className="glass-card rounded-3xl p-4 border border-white/70 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <StickyNote className={cn("w-4 h-4", TONE.primary.value)} />
                หมายเหตุ
              </h3>
              <UnitRequestNoteDetail
                job={data}
                onSaved={(note) => {
                  queryClient.setQueryData<JobRequest>(['siamraj', 'unit-request', id], (old) =>
                    old ? { ...old, list_note: note || undefined } : old,
                  );
                }}
              />
            </section>



            {/* ⚠️ ส่วน "ประวัติการแก้ไข" ถูกย้ายไปป๊อปอัปการ์ดในกล่องงานแล้ว
                (เจ้าของ clarify 21 ส.ค. 2569: *"ฉันหมายถึงหน้ากล่องงาน — ของหน้าใบงาน
                ทำแบบเดิม เคยไม่มีก็ไม่ต้องมี"*) — ดูที่ JobBoardView แท็บรายละเอียดงาน */}


            <p className="text-xs text-muted-foreground">
              ข้อมูลมาจาก schema so-operation บน Siamraj — Jarvis อ่านอย่างเดียว แก้ไขที่ระบบต้นทาง
            </p>

            <Button size="sm"
              type="button"
              onClick={() => navigate(backPath)}
              className="text-sm px-4 py-2"
            >
              กลับรายการ
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default SiamrajUnitRequestDetailPage;
