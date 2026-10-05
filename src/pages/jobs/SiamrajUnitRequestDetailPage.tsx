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
import { computeJobUrgency, jobUrgencyHint } from '@/lib/jobUrgency';
import { RosterBackedStaffSelect } from '@/components/jobs/RosterBackedStaffSelect';
import {
  fetchSiamrajUnitRequest,
  saveSiamrajUnitAssignment,
  unitRequestNoteKey,
} from '@/lib/siamrajUnitRequestsApi';
import { buildRecruiterNameOptions, buildScreenerNameOptions, buildOplNameOptions } from '@/lib/jobStaffNames';
import { refreshJobStaffFromApi } from '@/lib/jobStaffRemote';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/jobStaffRemote';
import { UnitRequestNoteDetail } from '@/components/jobs/UnitRequestNoteField';
import UnitRequestInfoFields from '@/components/jobs/UnitRequestInfoFields';
import UnitRequestTabs from '@/components/jobs/UnitRequestTabs';
import RequestLeadRulesCard from '@/components/jobs/RequestLeadRulesCard';
import { UnitRequestReplacementSelect } from '@/components/jobs/UnitRequestReplacementToggle';
import {
  UnitRequestWorkStatusBadge,
  UnitRequestWorkStatusEditor,
} from '@/components/jobs/UnitRequestWorkStatusField';
import type { JobRequest } from '@/types';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { ChevronDown, Database, ExternalLink, Landmark, Users, StickyNote, UserCheck, ClipboardList } from 'lucide-react';
import { RequestRateLinesBlock, ResignedEmployeeBlock } from '@/components/jobs/UnitRequestPayBlocks';

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
  /**
   * 🔴 **บันทึกล้มต้องหน้าตาไม่เหมือนบันทึกสำเร็จ** (21 ก.ย. 2569)
   *
   * ของเดิมใช้ข้อความสีเทาตัวเล็กอันเดียวกันทั้งสองกรณี ⇒ คนกดแล้วเห็นตัวหนังสือจาง ๆ
   * คิดว่าบันทึกแล้ว (ช่องยังโชว์ค่าที่พิมพ์ไว้เพราะเป็น state ในจอ) พอกลับมาอีกทีค่าหาย
   * — อาการที่เจ้าของแจ้งว่า *"บันทึกได้แล้วหาย"*
   */
  const [saveFailed, setSaveFailed] = useState(false);

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
  /**
   * 🔴 **ต้องใช้ตัวเดียวกับที่อื่น** (23 ก.ย. 2569) — บรรทัดนี้เคยเรียง
   * `externalId || request_no` ซึ่ง **สลับกับ `unitRequestNoteKey`** (request_no ก่อน)
   * คือบั๊ก "บันทึกแล้วหาย" แบบเดียวกับที่แก้ไป 22 ก.ย. ที่ยังค้างอยู่จุดนี้
   * · และตัวกลางตัวนี้รู้จักใบขอล่วงหน้า (คีย์เป็น id เต็ม เลขที่ใบซ้ำใบจริงได้)
   */
  const requestKey = data ? unitRequestNoteKey(data) : undefined;
  const dirty =
    (recruiter.trim() || '') !== (data?.recruiter_name ?? '') ||
    (screener.trim() || '') !== (data?.screener_name ?? '') ||
    (opl.trim() || '') !== (data?.opl_name ?? '');

  const saveAssignment = async () => {
    const key = requestKey;
    if (!key || saving) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveFailed(false);
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
      setSaveFailed(true);
      setSaveMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const urgencyMeta = data ? computeJobUrgency(data) : null;
  /**
   * คำอธิบายต้องพูด**เลขของใบนี้** — ใบที่ตั้งเกณฑ์เอง (10 ก.ย. 2569) ถ้ายังอ่านคำอธิบาย
   * จากค่ากลาง ป้ายจะบอก "น้อยกว่า 7 วัน" ทั้งที่ใบนี้ตั้งไว้ 3 วัน = จอโกหก
   */
  const urgencyHint = data ? jobUrgencyHint(data) : undefined;

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

            {/* เกณฑ์ความเร่งเฉพาะใบ (เจ้าของสั่ง 10 ก.ย. 2569) — วางไว้ใต้ป้ายสถานะ
                เพราะป้าย "ฉุกเฉิน/ล่วงหน้า" ด้านบนมาจากเกณฑ์ชุดนี้ตรง ๆ */}
            <RequestLeadRulesCard
              job={data}
              onSaved={() => {
                void queryClient.invalidateQueries({ queryKey: ['siamraj', 'unit-request', id] });
              }}
            />

            <section className="glass-card rounded-3xl p-4 border border-white/70 space-y-2">
              {/* หัวข้อเป็นปุ่มกาง/หุบ (เจ้าของสั่ง 25 ส.ค. 2569) — ลูกศรหมุนตามสถานะ
                  ทั้งแถวกดได้ ไม่ใช่แค่ลูกศร (นิ้วบนมือถือกดโดนง่ายกว่า) */}
              <button
                type="button"
                onClick={() => setInfoOpen((v) => !v)}
                aria-expanded={infoOpen}
                className="flex min-h-9 w-full items-center gap-1.5 text-left text-sm font-medium"
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

              {/* ── อัตราของใบขอ + คนที่ออก/เปลี่ยนตัว (รายได้จริง 3 เดือน) ──
                  🔴 ย้ายไปเป็น component กลาง 26 ก.ย. 2569 (`UnitRequestPayBlocks`) — ป๊อปไล่งาน
                  บนกล่องงานต้องเห็นชุดเดียวกัน (เจ้าของ: *"ทีม online ควรดูรายละเอียดใบขอ
                  นั้น ๆ ได้แบบหน้าใบขอ"*) · ห้ามก๊อปกลับมาเขียนซ้ำที่นี่
                  ⇒ หุบกล่อง "ข้อมูลใบขอ" แล้วสองส่วนนี้หายตามไปด้วย (อ่านอย่างเดียวชุดเดียวกัน) */}
              {infoOpen ? <RequestRateLinesBlock job={data} /> : null}
              {infoOpen ? <ResignedEmployeeBlock job={data} /> : null}

            </section>

            <section className="glass-card rounded-3xl p-4 border border-white/70 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
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
                    {saveMsg ? (
                      <span
                        className={cn(
                          'text-xs font-medium',
                          saveFailed ? TONE.danger.value : TONE.success.value,
                        )}
                      >
                        
                        {saveMsg}
                      </span>
                    ) : null}
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
              <h3 className="text-sm font-medium flex items-center gap-1.5">
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
