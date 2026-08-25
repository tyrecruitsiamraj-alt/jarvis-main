import React, { useEffect, useMemo, useState } from 'react';
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
import UnitRequestTabs from '@/components/jobs/UnitRequestTabs';
import { UnitRequestReplacementDetail } from '@/components/jobs/UnitRequestReplacementToggle';
import {
  UnitRequestWorkStatusBadge,
  UnitRequestWorkStatusEditor,
} from '@/components/jobs/UnitRequestWorkStatusField';
import type { JobRequest } from '@/types';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { ChevronDown, Database, ExternalLink, Landmark, Users, StickyNote, UserCheck, ClipboardList } from 'lucide-react';
import {
  amountText,
  formatMoney,
  moneyFieldText,
  summarizeResignedIncome,
  visibleRateLines,
} from '@/lib/unitRequestDetail';

import { resolveUnitDetailBackPath } from '@/lib/jobUnitSessionState';

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
  const income = React.useMemo(() => (data ? summarizeResignedIncome(data) : null), [data]);

  return (
    <div>
      <PageHeader
        title="รายละเอียดใบขอ"
        subtitle={data?.request_no || 'อ่านจาก Siamraj'}
        backPath={backPath}
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
            <div className="glass-card rounded-[1.5rem] p-4 border border-white/70 flex flex-wrap items-center gap-2">
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

            <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-2">
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
              {infoOpen ? (
              <div className="grid sm:grid-cols-2 gap-2">
                <Field label="เลขที่ใบขอ" value={data.request_no} />
                <Field label="ชื่อผู้ส่ง" value={data.submittedByName} />
                <Field
                  label="วัน/เวลาที่ส่ง"
                  value={data.submittedAt ? new Date(data.submittedAt).toLocaleString('th-TH') : undefined}
                />
                <Field label="วันที่ต้องการ" value={formatYmdDmyBe(data.required_date)} />
                <Field
                  label="ขอมา"
                  value={
                    data.request_positions != null && data.request_positions > 0
                      ? `${data.request_positions.toLocaleString('th-TH')} ตำแหน่ง`
                      : undefined
                  }
                />
                <Field
                  label="หาได้แล้ว"
                  value={
                    data.filled_positions != null
                      ? `${data.filled_positions.toLocaleString('th-TH')} ตำแหน่ง`
                      : undefined
                  }
                />
                <Field label="คงเหลือ (ต้องหา)" value={`${jobPositionUnits(data)} ตำแหน่ง`} />
                <Field label="ทำงานวันสุดท้าย" value={data.lastWorkingDay ? formatYmdDmyBe(data.lastWorkingDay) : undefined} />
                <Field label="ชื่อหน่วยงาน" value={data.unit_name} />
                {/* ⚠️ ห้าม fallback ไปชื่อหน่วยงาน — ใบขอล่วงหน้าไม่มีรหัสไซต์
                    แล้วช่อง "รหัสไซต์" ขึ้นชื่อบริษัท คนอ่านเข้าใจว่านั่นคือรหัส (เจอ 18 ส.ค. 2569)
                    ไม่มีก็บอกว่าไม่มี — Field แสดง "—" ให้เองเมื่อค่าว่าง */}
                <Field label="รหัสไซต์" value={data.site_code} />
                <Field label="สถานที่ปฏิบัติงาน" value={data.work_place} />
                <Field label="สถานที่ทำงาน (ที่อยู่เต็ม)" value={data.location_address} />
                <Field label="ลักษณะงาน" value={data.job_description_code_1} />
                <Field label="ตำแหน่ง (รายละเอียด)" value={data.staff_title_name || data.job_description_code_2} />
                <Field
                  label="ช่วงอายุ"
                  value={
                    data.age_range_min != null || data.age_range_max != null
                      ? `${data.age_range_min ?? '—'} – ${data.age_range_max ?? '—'} ปี`
                      : undefined
                  }
                />
                <Field label="เพศ" value={data.gender_requirement} />
                <Field label="สัญชาติเจ้านาย" value={data.boss_nationality} />
                <Field label="ประเภทใบขอ" value={data.request_action_name} />
                <Field label="ชื่อคนลาออก" value={data.resigned_employee_name} />
                <Field label="สาเหตุที่ลาออก" value={data.resigned_reason} />
                <Field label="รายได้ (อัตราจ่าย)" value={data.total_income ? `฿${data.total_income.toLocaleString()}` : undefined} />
                <Field label="วันเวลาเข้างาน" value={data.work_schedule} />
                <Field label="ชื่อผู้ติดต่อหน่วยงาน" value={data.contact_name} />
                <Field label="เบอร์ติดต่อ" value={data.contact_phone} />
                <Field label="ค่าปรับต่อวันถ้าไม่มีคน" value={moneyFieldText(data.penalty_per_day)} />
                {/* เงินของคนที่ออก — 🔴 **สองชุดคนละเรื่อง อย่าสลับกัน** (ตรวจฐาน ERP 25 ส.ค. 2569)
                    ชุดที่ 1 = **อัตราตามเงื่อนไข** จาก hr_staff_changing (ตารางเรต ไม่ใช่ payroll)
                    ชุดที่ 2 = **เงินที่ได้รับจริง** จากรอบจ่ายจริง wg2_ppayment
                    เคสจริง: อัตรา 19,588 ทุกงวด แต่จ่ายจริง 20,345 / 21,220 / 20,927 ไม่ตรงสักงวด
                    ⚠️ ไม่รู้ขึ้น "—" ห้ามขึ้น 0 · แต่ 0 ที่มาจากฐานจริงต้องขึ้น "0 บาท" */}
                {/* 🔴 ใช้คำของ ERP ตรง ๆ ("อัตราจ่าย"/"อัตราเบิก") ไม่ตีความว่าฝั่งไหนคือใคร
                    พิสูจน์การจับคู่แล้ว: ใบขอ payment_rate ↔ fee_amount ในงวดจ่ายจริง ·
                    draw_rate ↔ draw_amount · แต่ "เบิก = ของใคร" เป็นนิยามทางบัญชี ไม่ใช่ของเรา */}
                <Field
                  label="คนเดิม — อัตราตามเงื่อนไข (ฝั่งเบิก)"
                  value={moneyFieldText(data.resigned_wage_draw_rate)}
                />
                <Field
                  label="คนเดิม — อัตราตามเงื่อนไข (ฝั่งจ่าย)"
                  value={moneyFieldText(data.resigned_wage_fee_rate)}
                />
                <Field
                  label="คนเดิม — อัตรานี้มีผลตั้งแต่"
                  value={data.resigned_wage_effective_date}
                />
              </div>
              ) : null}

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

              {/* ── รายได้จริง 3 งวดล่าสุดของคนที่ออก/เปลี่ยนตัว ──────────────────
                  🔴 เป็นค่า **ประมาณ** — งวดสุดท้ายของคนที่ออกมักไม่เต็มเดือน
                  จึงต้องบอกทั้งช่วงวันและจำนวนงวด ห้ามโชว์เป็นตัวเลขชี้ขาด */}
              {infoOpen && income ? (
                <div className="rounded-xl border border-white/70 bg-white/40 p-3">
                  <div className="text-xs font-semibold text-foreground">
                    {data.resigned_employee_name || 'คนเดิม'} — รายได้จริงย้อนหลัง
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    ประมาณเดือนละ{' '}
                    <span className="font-semibold">{formatMoney(income.average)}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    รวม {formatMoney(income.total)} จาก {income.periods} งวด
                    {income.period ? ` · ${income.period}` : ''}
                  </div>
                  {income.drawTotal !== null ? (
                    <div className="text-[11px] text-muted-foreground">
                      ฝั่งอัตราเบิกรวม {formatMoney(income.drawTotal)}
                    </div>
                  ) : null}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    ยอดจริงที่จ่ายแล้ว (รวมล่วงเวลา/เบี้ยเลี้ยง) — งวดสุดท้ายอาจไม่เต็มเดือน
                  </div>
                </div>
              ) : null}
            </section>

            <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-3">
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
                    <button
                      type="button"
                      onClick={() => void saveAssignment()}
                      disabled={saving || !requestKey || !dirty}
                      className="jarvis-pill-btn text-sm px-4 py-2 disabled:opacity-50"
                    >
                      {saving ? 'กำลังบันทึก…' : 'บันทึกผู้รับผิดชอบ'}
                    </button>
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

            {/* ประเภทหน่วยงาน ราชการ/เอกชน — เจ้าของสั่ง 25 ส.ค. 2569 (รอบสี่สิบห้า):
                *"เอามาไว้ใต้ [ผู้รับผิดชอบ]"* · เดิมอยู่ในกริด "ข้อมูลใบขอ" ซึ่งหุบไว้เป็นค่าตั้งต้น
                ⇒ คนที่ต้องกรอกต้องกางกล่องก่อนถึงจะเจอ · ย้ายออกมาแล้วเห็นทันทีที่เปิดใบ
                🔴 คีย์ด้วย site_code ⇒ เลือกที่ใบนี้มีผลกับทุกใบขอของหน่วยงานเดียวกัน */}
            <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Landmark className={cn("w-4 h-4", TONE.primary.value)} />
                ราชการ / เอกชน
              </h3>
              <UnitSectorSelect
                siteCode={data.site_code}
                value={sector}
                onChange={(code, next) => void changeSector(code, next)}
                saving={savingSector}
              />
              {data.site_code ? (
                <p className="text-xs text-muted-foreground">
                  มีผลกับทุกใบขอของหน่วยงานนี้ ({data.site_code})
                </p>
              ) : (
                // ใบขอล่วงหน้าไม่มีรหัสไซต์ ⇒ ไม่มีคีย์ให้บันทึก ต้องบอกตรง ๆ ว่าทำไมเลือกไม่ได้
                <p className="text-xs text-muted-foreground">
                  ใบขอนี้ยังไม่มีรหัสไซต์ จึงระบุประเภทหน่วยงานไม่ได้
                </p>
              )}
            </section>

            <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-3">
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

            <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <UserCheck className={cn("w-4 h-4", TONE.primary.value)} />
                ส่งคนแทน
              </h3>
              <p className="text-xs text-muted-foreground">เลือกว่าใบขอนี้ส่งคนแทนหรือไม่ส่งคนแทน</p>
              <UnitRequestReplacementDetail
                job={data}
                onSaved={(sendReplacement) => {
                  queryClient.setQueryData<JobRequest>(['siamraj', 'unit-request', id], (old) =>
                    old ? { ...old, send_replacement: sendReplacement } : old,
                  );
                }}
              />
            </section>

            <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <ClipboardList className={cn("w-4 h-4", TONE.primary.value)} />
                สถานะทำงาน
              </h3>
              <p className="text-xs text-muted-foreground">
                เก็บในฐานข้อมูล Jarvis สำหรับติดตามงานและ Dashboard — ไม่แก้สถานะบน Siamraj
              </p>
              {requestKey ? (
                <UnitRequestWorkStatusEditor
                  requestKey={requestKey}
                  initialStatus={data.work_status}
                  initialFirstName={data.work_person_first_name}
                  initialLastName={data.work_person_last_name}
                  initialStatusDate={data.work_status_date}
                  initialPersons={data.work_persons}
                  onSaved={(next) => {
                    queryClient.setQueryData<JobRequest>(['siamraj', 'unit-request', id], (old) =>
                      old ? { ...old, ...next } : old,
                    );
                  }}
                />
              ) : (
                <p className="text-xs text-destructive">ใบขอนี้ไม่มีเลขที่ใบขอ จึงบันทึกสถานะไม่ได้</p>
              )}
            </section>

            {/* ⚠️ ส่วน "ประวัติการแก้ไข" ถูกย้ายไปป๊อปอัปการ์ดในกล่องงานแล้ว
                (เจ้าของ clarify 21 ส.ค. 2569: *"ฉันหมายถึงหน้ากล่องงาน — ของหน้าใบงาน
                ทำแบบเดิม เคยไม่มีก็ไม่ต้องมี"*) — ดูที่ JobBoardView แท็บรายละเอียดงาน */}

            <section className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-2">
              <h3 className="text-sm font-semibold">ผู้ลาออก / ตำแหน่ง</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                <Field label="ชื่อคนลาออก" value={data.resigned_employee_name} />
                <Field label="สาเหตุที่ลาออก" value={data.resigned_reason} />
                <Field label="รุ่น/ประเภทรถ" value={data.vehicle_required} />
                <Field label="เบอร์ติดต่อ" value={data.contact_phone} />
              </div>
            </section>

            <p className="text-xs text-muted-foreground">
              ข้อมูลมาจาก schema so-operation บน Siamraj — Jarvis อ่านอย่างเดียว แก้ไขที่ระบบต้นทาง
            </p>

            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="jarvis-pill-btn text-sm px-4 py-2"
            >
              กลับรายการ
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SiamrajUnitRequestDetailPage;
