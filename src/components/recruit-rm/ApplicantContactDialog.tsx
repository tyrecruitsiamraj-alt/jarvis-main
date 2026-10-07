import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CalendarX, Check, Loader2, Pencil, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DateSelectDmyBe from '@/components/shared/DateSelectDmyBe';
import ApplicantInfoPanel from '@/components/recruit-rm/ApplicantInfoPanel';
import ApplicantPhoneFix from '@/components/recruit-rm/ApplicantPhoneFix';
import {
  AppointmentsTable,
  AttendanceTable,
  CallsTable,
  ContactsTable,
  HistoryTable,
  RecordLoadProvider,
  type RecordLoadState,
} from '@/components/recruit-rm/ApplicantRecordTables';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { EM_DASH } from '@/lib/displayFallback';
import { formatYmdDmyBe } from '@/lib/dateTh';
import {
  fetchApplicantDetailExtras,
  fetchAttendanceLogs,
  recordAppointmentAttendance,
  setApplicationCancelled,
  updateApplicationProfile,
  type ApplicantDetailExtras,
  type AttendanceLogItem,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import { fetchRecruitReasons } from '@/lib/recruitReasonsApi';
import type { RecruitReason } from '@/lib/recruitReasons';
import { fetchContactLogs, saveContactLog, type ContactLog } from '@/lib/applicationContactsApi';
import { fetchSiamrajUnitRequests } from '@/lib/siamrajUnitRequestsApi';
import { jobBoardCardTitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { publicJobTitle } from '@/lib/publicJobTitle';
import SearchableSelect from '@/components/shared/SearchableSelect';

/** ป้ายหน่วยงานของนัด — ชื่อจุดทำงาน · ตำแหน่ง (เลขที่ใบขอ) · เก็บคำเดียวกันลงประวัตินัดด้วย (5 ต.ค. 2569) */
function appointmentUnitLabel(j: JobRequest): string {
  const no = j.request_no?.trim();
  return `${jobBoardCardTitle(j)} · ${publicJobTitle(j)}${no ? ` (${no})` : ''}`;
}
import { canRecordAttendance } from '@/lib/appointmentAttendance';
import { profileDraftOf, profilePatchFromDraft, type ProfileDraft } from '@/lib/applicantProfileEdit';
import {
  APPOINTMENT_PLACES,
  APPOINTMENT_PLACE_OTHER,
  DETAIL_TABS,
  FOLLOW_UP_FAIL_OPTIONS,
  PROCESS_STEPS,
  appointmentPlaceValue,
  contactChoiceOf,
  detailCallRows,
  followUpChoiceOf,
  followUpSide,
  type ContactChoice,
  type DetailTab,
  type FollowUpChoice,
} from '@/lib/applicantDetail';
import type { JobRequest } from '@/types';

/**
 * ═══ ป๊อป "รายละเอียดผู้สมัคร" แบบรูป iRecruit (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"ปุ่มดูรายละเอียด ต้องได้รายละเอียดแบบรูปที่ส่งให้"*
 * - **ขั้นตอนการดำเนินการ 3 ขั้น** — การติดต่อ (สำเร็จ/ไม่สำเร็จ) · การนัดหมาย (นัดหมายใหม่ + วันที่/สถานที่/หน่วยงาน)
 *   · การติดตามนัด (สำเร็จ = มาตามนัด · ไม่สำเร็จ = ไม่มา/เลื่อนนัด)
 * - **แท็บ** ข้อมูลผู้สมัคร (แก้ไขได้ · เก็บ log ว่าใครแก้ ไม่โชว์ log) / ประวัติการสมัคร / การโทร /
 *   การติดต่อ / การนัดหมาย / ติดตามนัดหมาย
 * - กดเลือกในขั้นตอน/แก้ข้อมูลแล้ว **ยังไม่เขียน** จนกด "บันทึก" (เขียนทีละอย่างตามลำดับ · ล้มกลางทางบอกว่าอะไรบันทึกแล้ว)
 * - ก้อน "ยกเลิกข้อมูลผู้สมัคร" อยู่ในโหมด profile (135 · 4 ต.ค. 2569)
 *
 *
 * 🔴 Journey ของเจ้าของ (4 ต.ค. 2569 · ตรงกับ iRecruit): ติดต่อสำเร็จ → ปุ่ม "นัดหมาย / นัดหมายไม่สำเร็จ" ถึงขึ้น ·
 * นัดหมาย = วันที่ + สถานที่นัดหมาย (รายการเดียวกับ iRecruit · อื่นๆ พิมพ์เอง) + ลงหน่วยงาน ·
 * นัดหมายไม่สำเร็จ = เหตุผล (master ขั้นนัดหมาย × ไม่สำเร็จ) · ติดต่อไม่สำเร็จ = เหตุผลอย่างเดียว
 *
 * ของเดิมที่ยังอยู่: เหตุผลไม่สำเร็จจาก master (process การติดต่อ × ไม่สำเร็จ) · หน่วยงานจากใบขอที่ยังเปิด
 * + "หาล่วงหน้า" · แก้เบอร์ใบที่ติดธง (087) · ไฟล์แนบ · สถานะใบขยับที่ server (นัดได้ → converted)
 * 🔴 `embedded` = คืนเนื้อเปล่า ๆ ไม่ห่อ Dialog (ฝังใน "ป๊อปดูรายชื่อ" ของกล่องงาน) — ห้ามซ้อน Dialog ใน Dialog
 */
const ADVANCE = '__advance__';
const EMPTY_EXTRAS: ApplicantDetailExtras = { history: [], aiCalls: [], staffCalls: [] };

const StepNo: React.FC<{ n: number; done: boolean }> = ({ n, done }) => (
  <span
    className={cn(
      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums',
      done ? cn(TONE.success.wash, TONE.success.value) : cn(TONE.neutral.wash, TONE.neutral.value),
    )}
    aria-hidden
  >
    {n}
  </span>
);

const StepHead: React.FC<{ index: 0 | 1 | 2; done: boolean; children?: React.ReactNode }> = ({ index, done, children }) => {
  const s = PROCESS_STEPS[index];
  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <StepNo n={s.no} done={done} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{s.title}</p>
        <p className="text-xs text-muted-foreground">{s.hint}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-1.5">{children}</div> : null}
    </div>
  );
};

export default function ApplicantContactDialog({
  application,
  onClose,
  onSaved,
  embedded = false,
  mode = 'contact',
  onCancelled,
}: {
  application: PublicApplication | null;
  onClose: () => void;
  /** บันทึกสำเร็จ — ให้หน้าแม่ reload ลิสต์ (สถานะใบเปลี่ยน แถวอาจย้ายแท็บ) */
  onSaved: () => void;
  /** true = คืนเนื้อเปล่า ๆ ไม่ห่อ Dialog (ฝังในป๊อปดูรายชื่อของกล่องงาน) · 🔴 ห้ามซ้อน Dialog ใน Dialog */
  embedded?: boolean;
  /**
   * `profile` = ปุ่มดูข้อมูลของแท็บผู้สมัคร (เจ้าของส่งรูป iRecruit 4 ต.ค. 2569): **ไม่มีขั้นตอน 3 ขั้น** ·
   * แท็บ 6 อันเหมือนเดิม · มีก้อน "ยกเลิกข้อมูลผู้สมัคร" · ปุ่มล่างเหลือ ปิด (บันทึกโผล่ตอนแก้ข้อมูล)
   * `contact` (ค่าเดิม) = แท็บการติดต่อ: ขั้น 1 การติดต่อ → กดติดต่อสำเร็จแล้วขั้น 2 การนัดหมายถึงโผล่ (เจ้าของสั่ง 4 ต.ค. 2569)
   * `appointment` = แท็บติดตามนัดหมาย: นัดปัจจุบัน + ขั้น 3 การติดตามนัด (*"การติดตามนัดต้องไปอยู่ที่หน้าติดตามนัดหมาย"*)
   */
  mode?: 'contact' | 'appointment' | 'profile';
  /** ยกเลิกข้อมูลผู้สมัครสำเร็จ (โหมด profile) — หน้าแม่ปิดป๊อป + โหลดใหม่ (ใบหายจากรายชื่อหลัก) */
  onCancelled?: () => void;
}) {
  const a = application;
  const [tab, setTab] = useState<DetailTab>('info');

  // ── ขั้น 1 การติดต่อ — กดเลือก = จะบันทึกผลติดต่อครั้งใหม่ (log รายครั้ง กดผลเดิมซ้ำก็นับเป็นครั้งใหม่)
  const [contactPicked, setContactPicked] = useState<ContactChoice | null>(null);
  const [reasonId, setReasonId] = useState('');
  // ── ขั้น 2 การนัดหมาย — 'ok' = นัดได้ (กรอกวัน/ที่/หน่วยงาน) · 'fail' = นัดหมายไม่สำเร็จ (เลือกเหตุผล)
  const [apptPick, setApptPick] = useState<'ok' | 'fail' | null>(null);
  const [apptDate, setApptDate] = useState('');
  const [apptPlace, setApptPlace] = useState('');
  const [apptPlaceOther, setApptPlaceOther] = useState('');
  const [apptJob, setApptJob] = useState(ADVANCE);
  const [apptReasonId, setApptReasonId] = useState('');
  // ── ขั้น 3 การติดตามนัด — 'fail' ที่ยังไม่เลือกไม่มา/เลื่อนนัด = ค้างให้เลือก
  const [followPicked, setFollowPicked] = useState<FollowUpChoice | 'fail' | null>(null);
  // ── แท็บข้อมูลผู้สมัคร
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ── ยกเลิกข้อมูลผู้สมัคร (โหมด profile · 135) — กางยืนยันในป๊อปเดิม ไม่ซ้อน Dialog
  const [cancelAsk, setCancelAsk] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [reasons, setReasons] = useState<RecruitReason[]>([]);
  const [apptReasons, setApptReasons] = useState<RecruitReason[]>([]);
  const [openJobs, setOpenJobs] = useState<JobRequest[]>([]);
  const [logs, setLogs] = useState<ContactLog[]>([]);
  const [extras, setExtras] = useState<ApplicantDetailExtras>(EMPTY_EXTRAS);
  const [attendance, setAttendance] = useState<AttendanceLogItem[]>([]);
  /**
   * สภาพการโหลดของแท็บประวัติ/การโทร/การติดต่อ/ติดตามนัด — แยก "กำลังโหลด / โหลดไม่ได้" ออกจาก "ยังไม่มี"
   * (QA 5 ต.ค. 2569: เส้นล้มแล้วแท็บขึ้น "ยังไม่มีการโทร" ทั้งที่ของจริงมีสาย AI)
   */
  const [recState, setRecState] = useState<Record<'logs' | 'extras' | 'attendance', RecordLoadState>>({
    logs: 'loading',
    extras: 'loading',
    attendance: 'loading',
  });
  const loadRecords = useCallback((id: string, isCancelled: () => boolean = () => false) => {
    setRecState({ logs: 'loading', extras: 'loading', attendance: 'loading' });
    const settle = (key: 'logs' | 'extras' | 'attendance', ok: boolean) =>
      !isCancelled() && setRecState((prev) => ({ ...prev, [key]: ok ? 'ready' : 'failed' }));
    void fetchContactLogs(id)
      .then((v) => {
        if (!isCancelled()) setLogs(v);
        settle('logs', true);
      })
      .catch(() => settle('logs', false));
    void fetchApplicantDetailExtras(id)
      .then((v) => {
        if (!isCancelled()) setExtras(v);
        settle('extras', true);
      })
      .catch(() => settle('extras', false));
    void fetchAttendanceLogs(id)
      .then((v) => {
        if (!isCancelled()) setAttendance(v);
        settle('attendance', true);
      })
      .catch(() => settle('attendance', false));
  }, []);

  // เปิดคนใหม่ = เริ่มใหม่ทั้งหมด + โหลดของประกอบ · กัน race (`cancelled`) — กดไล่แถวเร็ว ๆ
  // แล้ว response ที่มาช้าต้องไม่ทับของคนที่เปิดอยู่ (ทุกตัวกลืน error เป็นรายการว่าง)
  useEffect(() => {
    if (!application) return;
    let cancelled = false;
    setTab('info');
    setContactPicked(null);
    setReasonId('');
    setApptPick(null);
    setApptDate('');
    setApptPlace('');
    setApptPlaceOther('');
    setApptJob(ADVANCE);
    setApptReasonId('');
    setFollowPicked(null);
    setEditing(false);
    setDraft(null);
    setBusy(false);
    setError(null);
    setLogs([]);
    setExtras(EMPTY_EXTRAS);
    setAttendance([]);
    loadRecords(application.id, () => cancelled);
    void fetchRecruitReasons({ processCode: '1', outcomeCode: 'C' })
      .then((v) => !cancelled && setReasons(v))
      .catch(() => !cancelled && setReasons([]));
    void fetchRecruitReasons({ processCode: '2', outcomeCode: 'C' })
      .then((v) => !cancelled && setApptReasons(v))
      .catch(() => !cancelled && setApptReasons([]));
    void fetchSiamrajUnitRequests(500)
      .then((v) => !cancelled && setOpenJobs(v))
      .catch(() => !cancelled && setOpenJobs([]));
    return () => {
      cancelled = true;
    };
  }, [application, loadRecords]);

  const baseDraft = useMemo(() => (a ? profileDraftOf(a) : null), [a]);
  const callRows = useMemo(() => detailCallRows(extras.aiCalls, extras.staffCalls), [extras]);

  if (!a || !baseDraft) return null;

  const now = new Date();
  const contactShown = contactPicked ?? contactChoiceOf(a);
  const followInitial = followUpChoiceOf(a);
  const followShownSide = followPicked === 'fail' ? 'fail' : followUpSide(followPicked ?? followInitial);
  const followShownValue = followPicked && followPicked !== 'fail' ? followPicked : followPicked ? null : followInitial;
  const contactFailPicked = contactPicked === 'fail';
  const followBlocked = !a.appointment_at
    ? 'ยังไม่มีนัดหมาย'
    : apptPick === 'ok'
      ? 'บันทึกนัดหมายใหม่ก่อน'
      : !canRecordAttendance(a.appointment_at, now)
        ? 'บันทึกได้ตั้งแต่วันนัด'
        : null;
  const selectedReason = reasons.find((r) => r.id === reasonId) ?? null;
  const selectedJob = openJobs.find((j) => j.id === apptJob) ?? null;
  const selectedApptReason = apptReasons.find((r) => r.id === apptReasonId) ?? null;
  const placeValue = appointmentPlaceValue(apptPlace, apptPlaceOther);
  /**
   * ช่องนัดหมาย (วัน · สถานที่ · ลงหน่วยงาน) — ใช้ทั้งขั้น 2 "นัดหมาย" และขั้น 3 "เลื่อนนัด"
   * (เจ้าของ Choice 7 ต.ค. 2569 "ถามวันนัดใหม่ + สถานที่" — เดิมเลื่อนนัดบันทึกได้โดยไม่รู้ว่าเลื่อนไปวันไหน)
   */
  const apptFields = (testId: string) => (
            <div className="grid grid-cols-1 gap-3 border-t border-border/70 p-3 sm:grid-cols-3" data-testid={testId}>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">นัดหมายวันที่ *</p>
                <DateSelectDmyBe value={apptDate} onChange={setApptDate} allowEmpty disabled={busy} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">สถานที่นัดหมาย *</p>
                <Select value={apptPlace || undefined} onValueChange={setApptPlace} disabled={busy}>
                  <SelectTrigger className="h-9 text-sm" aria-label="สถานที่นัดหมาย">
                    <SelectValue placeholder="เลือกสถานที่นัดหมาย" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_PLACES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {apptPlace === APPOINTMENT_PLACE_OTHER ? (
                  <Input
                    value={apptPlaceOther}
                    onChange={(e) => setApptPlaceOther(e.target.value)}
                    disabled={busy}
                    maxLength={300}
                    aria-label="ชื่อสถานที่นัดหมาย"
                    placeholder="ชื่อสถานที่"
                    className="h-9 text-sm"
                  />
                ) : null}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ลงหน่วยงาน</p>
                {/* 🔴 ชื่อหน่วยงาน + พิมพ์ค้นได้ (เจ้าของสั่ง 5 ต.ค. 2569: *"ลงหน่วยงาน ขอเป็นชื่อได้ไหม ค้นหาจากชื่อมันง่ายกว่า
                    และพิมพ์ค้นหาได้ด้วย"*) — เดิมเป็นเลขที่ใบขอล้วน · ค้นได้ทั้งชื่อ/ตำแหน่ง/เลขที่ใบขอ/รหัสไซต์
                    "ยังไม่ระบุ — หาล่วงหน้า" อยู่บนสุด (เจ้าของเคาะเดิม: นัดไว้แต่ยังไม่รู้ลงใบไหน) */}
                <div aria-label="ลงหน่วยงาน" data-testid="appointment-unit">
                  <SearchableSelect
                    value={apptJob}
                    onChange={setApptJob}
                    disabled={busy}
                    placeholder="เลือกหน่วยงาน"
                    searchPlaceholder="พิมพ์ชื่อหน่วยงาน ตำแหน่ง หรือเลขที่ใบขอ"
                    emptyText="ไม่พบหน่วยงาน"
                    options={[
                      { value: ADVANCE, label: 'ยังไม่ระบุ — หาล่วงหน้า' },
                      ...openJobs.map((j) => ({
                        value: j.id,
                        label: appointmentUnitLabel(j),
                        keywords: [j.request_no, j.site_code, j.unit_name, j.work_site_name, publicJobPositionLabel(j)]
                          .filter(Boolean)
                          .join(' '),
                      })),
                    ]}
                  />
                </div>
              </div>
            </div>
  );
  // ปุ่มขั้น 2 ขึ้นเมื่อติดต่อสำเร็จ (กดตอนนี้ หรือผลล่าสุดสำเร็จอยู่แล้ว) — ตาม Journey ข้อ 4
  const apptUnlocked = contactShown === 'ok';
  const profile = editing && draft ? profilePatchFromDraft(baseDraft, draft) : { patch: {}, error: null };
  const profileDirty = Object.keys(profile.patch).length > 0 || Boolean(profile.error);
  const dirty = profileDirty || contactPicked !== null || apptPick !== null || followPicked !== null;

  const save = async () => {
    if (busy) return;
    setError(null);
    if (profile.error) return setError(profile.error);
    if (contactFailPicked && !selectedReason) return setError('เลือกเหตุผลที่ติดต่อไม่สำเร็จ');
    if (apptPick && contactFailPicked) return setError('ติดต่อไม่สำเร็จ นัดหมายไม่ได้');
    if (apptPick === 'ok' && !apptDate) return setError('นัดหมายต้องใส่วันนัด');
    if (apptPick === 'ok' && !placeValue) {
      return setError(apptPlace === APPOINTMENT_PLACE_OTHER ? 'พิมพ์ชื่อสถานที่นัดหมาย' : 'เลือกสถานที่นัดหมาย');
    }
    if (apptPick === 'fail' && !selectedApptReason) return setError('เลือกเหตุผลที่นัดหมายไม่สำเร็จ');
    if (followPicked === 'fail') return setError('เลือกว่าไม่มา หรือ เลื่อนนัด');
    if (followPicked === 'rescheduled' && !apptDate) return setError('เลื่อนนัดต้องใส่วันนัดใหม่');
    if (followPicked === 'rescheduled' && !placeValue) {
      return setError(apptPlace === APPOINTMENT_PLACE_OTHER ? 'พิมพ์ชื่อสถานที่นัดหมาย' : 'เลือกสถานที่นัดหมาย');
    }
    setBusy(true);
    const saved: string[] = [];
    try {
      if (Object.keys(profile.patch).length > 0) {
        await updateApplicationProfile(a.id, profile.patch);
        saved.push('ข้อมูลผู้สมัคร');
      }
      if (contactPicked !== null || apptPick !== null) {
        // นัดหมายโดยไม่ได้กดขั้น 1 = ผลล่าสุดติดต่อสำเร็จอยู่แล้ว (ปุ่มขั้น 2 ขึ้นเฉพาะตอนนั้น)
        const ok = contactPicked ? contactPicked === 'ok' : true;
        const booked = ok && apptPick === 'ok';
        const apptFailed = ok && apptPick === 'fail';
        const reason = ok ? (apptFailed ? selectedApptReason : null) : selectedReason;
        await saveContactLog({
          applicationId: a.id,
          ok,
          appointmentFailed: apptFailed,
          reasonId: reason?.id ?? null,
          reasonLabel: reason?.name ?? null,
          appointmentAt: booked ? apptDate : null,
          appointmentPlace: booked ? placeValue : null,
          jobId: booked && apptJob !== ADVANCE ? apptJob : null,
          jobLabel: booked ? (selectedJob ? appointmentUnitLabel(selectedJob) : 'หาล่วงหน้า') : null,
          note: null,
        });
        saved.push(booked ? 'นัดหมาย' : apptFailed ? 'ผลนัดหมาย' : 'ผลการติดต่อ');
      }
      if (followPicked && a.appointment_at) {
        await recordAppointmentAttendance({
          applicationId: a.id,
          appointmentAt: a.appointment_at,
          result: followPicked,
        });
        saved.push('ผลติดตามนัด');
        // เลื่อนนัด = นัดใหม่ตามวัน/สถานที่ที่กรอก (ขึ้นในติดตามนัดหมายตามวันใหม่)
        if (followPicked === 'rescheduled') {
          await saveContactLog({
            applicationId: a.id,
            ok: true,
            appointmentFailed: false,
            reasonId: null,
            reasonLabel: null,
            appointmentAt: apptDate,
            appointmentPlace: placeValue,
            jobId: apptJob !== ADVANCE ? apptJob : null,
            jobLabel: selectedJob ? appointmentUnitLabel(selectedJob) : 'หาล่วงหน้า',
            note: null,
          });
          saved.push('นัดใหม่');
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ';
      setError(saved.length > 0 ? `${msg} — บันทึกแล้ว: ${saved.join(', ')}` : msg);
      if (saved.length > 0) onSaved();
    } finally {
      setBusy(false);
    }
  };

  const phoneFixSlot =
    a.phone_callable === false ? <ApplicantPhoneFix applicationId={a.id} onFixed={onSaved} /> : null;

  const body = (
    <div className="space-y-4">
      <DialogHeaderLike embedded={embedded} name={a.full_name} />

      {mode !== 'profile' ? (
      <>
      {/* ── ขั้นตอนการดำเนินการ ── */}
      <section className="space-y-2" aria-label="ขั้นตอนการดำเนินการ">
        <p className="text-xs font-medium text-muted-foreground">ขั้นตอนการดำเนินการ</p>

        {mode === 'contact' ? (
        <>
        <div className="rounded-xl border border-border/70" data-testid="step-contact">
          <StepHead index={0} done={contactShown !== null}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={contactShown === 'ok'}
              disabled={busy}
              onClick={() => {
                setContactPicked('ok');
                setError(null);
              }}
              className={cn(contactShown === 'ok' && TONE.success.solid)}
            >
              <Check aria-hidden /> ติดต่อสำเร็จ
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={contactShown === 'fail'}
              disabled={busy}
              onClick={() => {
                setContactPicked('fail');
                setApptPick(null);
                setError(null);
              }}
              className={cn(contactShown === 'fail' && TONE.danger.solid)}
            >
              <X aria-hidden /> ติดต่อไม่สำเร็จ
            </Button>
          </StepHead>
          {contactFailPicked ? (
            <div className="border-t border-border/70 p-3">
              <Select value={reasonId || undefined} onValueChange={setReasonId} disabled={busy}>
                <SelectTrigger className="h-9 text-sm" aria-label="เหตุผลที่ติดต่อไม่สำเร็จ">
                  <SelectValue placeholder={reasons.length > 0 ? 'เลือกเหตุผลที่ติดต่อไม่สำเร็จ' : 'โหลดเหตุผลไม่ได้'} />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {/* 🔴 ขั้น 2 โผล่หลังกด "ติดต่อสำเร็จ" เท่านั้น (เจ้าของสั่ง 4 ต.ค. 2569) · ฟอร์มนัดโผล่หลังเลือก "นัดหมาย" */}
        {apptUnlocked ? (
        <div className="overflow-hidden rounded-xl border border-border/70" data-testid="step-appointment">
          <StepHead index={1} done={Boolean(a.appointment_at)}>
            {apptUnlocked ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-pressed={apptPick === 'ok'}
                  disabled={busy}
                  onClick={() => {
                    setApptPick((v) => (v === 'ok' ? null : 'ok'));
                    setError(null);
                  }}
                  className={cn(apptPick === 'ok' && TONE.success.solid)}
                >
                  <CalendarCheck aria-hidden /> {a.appointment_at ? 'นัดหมายใหม่' : 'นัดหมาย'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-pressed={apptPick === 'fail'}
                  disabled={busy}
                  onClick={() => {
                    setApptPick((v) => (v === 'fail' ? null : 'fail'));
                    setError(null);
                  }}
                  className={cn(apptPick === 'fail' && TONE.danger.solid)}
                >
                  <CalendarX aria-hidden /> นัดหมายไม่สำเร็จ
                </Button>
              </>
            ) : null}
          </StepHead>
          {/* นัดปัจจุบัน — ยังไม่มีนัดไม่ต้องโชว์ช่องขีด (เจ้าของสั่ง 4 ต.ค. 2569 · แบบ iRecruit) */}
          {a.appointment_at ? (
            <div
              className="grid grid-cols-1 gap-3 border-t border-border/70 bg-muted/30 p-3 sm:grid-cols-3"
              data-testid="current-appointment"
            >
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">นัดหมายวันที่</p>
                <p className="text-sm tabular-nums text-foreground">{formatYmdDmyBe(a.appointment_at)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">สถานที่นัดหมาย</p>
                <p className="text-sm text-foreground">{a.appointment_place || EM_DASH}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ลงหน่วยงาน</p>
                <p className="text-sm text-foreground">{a.appointment_job || 'หาล่วงหน้า'}</p>
              </div>
            </div>
          ) : null}
          {apptPick === 'ok' ? apptFields('new-appointment') : null}
          {apptPick === 'fail' ? (
            <div className="border-t border-border/70 p-3" data-testid="appointment-failed">
              <Select value={apptReasonId || undefined} onValueChange={setApptReasonId} disabled={busy}>
                <SelectTrigger className="h-9 text-sm" aria-label="เหตุผลที่นัดหมายไม่สำเร็จ">
                  <SelectValue
                    placeholder={apptReasons.length > 0 ? 'เลือกเหตุผลที่นัดหมายไม่สำเร็จ' : 'โหลดเหตุผลไม่ได้'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {apptReasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        ) : null}
        </>
        ) : null}

        {/* 🔴 การติดตามนัด อยู่แท็บติดตามนัดหมายเท่านั้น (เจ้าของสั่ง 4 ต.ค. 2569) — โชว์นัดปัจจุบันให้ดูคู่กัน */}
        {mode === 'appointment' ? (
        <>
        <div
          className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 sm:grid-cols-3"
          data-testid="appointment-summary"
        >
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">นัดหมายวันที่</p>
            <p className="text-sm tabular-nums text-foreground">
              {a.appointment_at ? formatYmdDmyBe(a.appointment_at) : EM_DASH}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">สถานที่นัดหมาย</p>
            <p className="text-sm text-foreground">{a.appointment_place || EM_DASH}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ลงหน่วยงาน</p>
            <p className="text-sm text-foreground">{a.appointment_job || (a.appointment_at ? 'หาล่วงหน้า' : EM_DASH)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/70" data-testid="step-follow-up">
          <StepHead index={2} done={followInitial !== null}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={followShownSide === 'ok'}
              disabled={busy || Boolean(followBlocked)}
              title={followBlocked ?? undefined}
              onClick={() => {
                setFollowPicked('showed');
                setError(null);
              }}
              className={cn(followShownSide === 'ok' && TONE.success.solid)}
            >
              <Check aria-hidden /> ติดตามสำเร็จ
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={followShownSide === 'fail'}
              disabled={busy || Boolean(followBlocked)}
              title={followBlocked ?? undefined}
              onClick={() => {
                setFollowPicked('fail');
                setError(null);
              }}
              className={cn(followShownSide === 'fail' && TONE.danger.solid)}
            >
              <X aria-hidden /> ติดตามไม่สำเร็จ
            </Button>
          </StepHead>
          {followPicked !== null && followShownSide === 'fail' ? (
            <div className="flex flex-wrap gap-1.5 border-t border-border/70 p-3" role="group" aria-label="ติดตามไม่สำเร็จเพราะ">
              {FOLLOW_UP_FAIL_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  size="xs"
                  variant={followShownValue === o.value ? 'default' : 'outline'}
                  aria-pressed={followShownValue === o.value}
                  disabled={busy}
                  onClick={() => setFollowPicked(o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          ) : null}
          {followPicked === 'rescheduled' ? apptFields('reschedule-appointment') : null}
        </div>
        </>
        ) : null}
      </section>
      </>
      ) : null}

      {/* ── แท็บรายละเอียด ── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          {DETAIL_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="info" className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">ข้อมูลส่วนตัวและการสมัคร</p>
            <Button
              type="button"
              size="sm"
              variant={editing ? 'outline' : 'default'}
              disabled={busy}
              onClick={() => {
                if (editing) {
                  setEditing(false);
                  setDraft(null);
                } else {
                  setDraft(baseDraft);
                  setEditing(true);
                }
                setError(null);
              }}
            >
              {editing ? (
                'ยกเลิกแก้ไข'
              ) : (
                <>
                  <Pencil aria-hidden /> แก้ไขข้อมูล
                </>
              )}
            </Button>
          </div>
          <ApplicantInfoPanel
            application={a}
            editing={editing}
            draft={draft ?? baseDraft}
            onDraft={setDraft}
            disabled={busy}
            phoneFixSlot={phoneFixSlot}
          />
          {/* ยกเลิกข้อมูลผู้สมัคร (รูป iRecruit · Choice "ซ่อนจากรายชื่อหลัก กู้คืนได้" 4 ต.ค. 2569) */}
          {mode === 'profile' && !a.cancelled_at ? (
            <div className={cn('space-y-3 rounded-xl border p-3', TONE.danger.soft)} data-testid="cancel-applicant">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className={cn('text-sm font-medium', TONE.danger.value)}>ยกเลิกข้อมูลผู้สมัคร</p>
                  <p className="text-xs text-muted-foreground">นำออกจากรายการหลัก</p>
                </div>
                {!cancelAsk ? (
                  <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => setCancelAsk(true)}>
                    ยกเลิกข้อมูล
                  </Button>
                ) : null}
              </div>
              {cancelAsk ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="เหตุผลที่ยกเลิก"
                    className="min-w-0 flex-1"
                    placeholder="เหตุผล (ไม่ใส่ก็ได้)"
                    value={cancelReason}
                    maxLength={300}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      setError(null);
                      void setApplicationCancelled(a.id, true, cancelReason.trim() || null)
                        .then(() => onCancelled?.())
                        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'ยกเลิกข้อมูลไม่สำเร็จ'))
                        .finally(() => setBusy(false));
                    }}
                  >
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : null} ยืนยันยกเลิก
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setCancelAsk(false)}>
                    ไม่ยกเลิก
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="history" className="pt-2">
          <RecordLoadProvider state={recState.extras} onRetry={() => loadRecords(a.id)}>
            <HistoryTable items={extras.history} />
          </RecordLoadProvider>
        </TabsContent>
        <TabsContent value="calls" className="pt-2">
          <RecordLoadProvider state={recState.extras} onRetry={() => loadRecords(a.id)}>
            <CallsTable rows={callRows} application={a} />
          </RecordLoadProvider>
        </TabsContent>
        <TabsContent value="contacts" className="pt-2">
          <RecordLoadProvider state={recState.logs} onRetry={() => loadRecords(a.id)}>
            <ContactsTable logs={logs} />
          </RecordLoadProvider>
        </TabsContent>
        <TabsContent value="appointments" className="pt-2">
          <RecordLoadProvider state={recState.logs} onRetry={() => loadRecords(a.id)}>
            <AppointmentsTable logs={logs} />
          </RecordLoadProvider>
        </TabsContent>
        <TabsContent value="attendance" className="pt-2">
          <RecordLoadProvider state={recState.attendance} onRetry={() => loadRecords(a.id)}>
            <AttendanceTable logs={attendance} />
          </RecordLoadProvider>
        </TabsContent>
      </Tabs>

      {error ? (
        <p role="alert" className={cn('text-xs font-medium', TONE.danger.value)}>
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
        {/* ปุ่มบันทึกปิดอยู่ต้องบอกเหตุ (QA 5 ต.ค. 2569: กดแล้วเงียบ ไม่รู้ว่าทำไมไม่ไป) */}
        {editing && !dirty ? <span className="self-center text-xs text-muted-foreground">ยังไม่ได้แก้</span> : null}
        {mode !== 'profile' || editing ? (
          <Button type="button" size="sm" onClick={() => void save()} disabled={!dirty || busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null} บันทึก
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={busy}>
          ปิด
        </Button>
      </div>
    </div>
  );

  /** ฝังในป๊อปดูรายชื่อ = คืนเนื้อเปล่า ๆ (ห้ามซ้อน Dialog ใน Dialog) */
  if (embedded) return body;

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">{body}</DialogContent>
    </Dialog>
  );
}

/**
 * หัวป๊อป "รายละเอียดผู้สมัคร" — ในโหมดฝังใช้หัวข้อธรรมดา (ไม่มี Dialog ครอบ ใช้ DialogTitle ไม่ได้)
 * ชื่อคนอยู่ในคำอธิบายสำหรับโปรแกรมอ่านหน้าจอ (ตาเห็นชื่อในแท็บข้อมูลผู้สมัครอยู่แล้ว)
 */
function DialogHeaderLike({ embedded, name }: { embedded: boolean; name: string }) {
  const icon = (
    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE.primary.soft, TONE.primary.value)}>
      <UserRound className="h-4 w-4" aria-hidden />
    </span>
  );
  if (embedded) {
    return (
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm font-medium text-foreground">รายละเอียดผู้สมัคร</p>
          <p className="sr-only">{name}</p>
        </div>
      </div>
    );
  }
  return (
    <DialogHeader className="flex-row items-center gap-3 space-y-0 text-left">
      {icon}
      <div>
        <DialogTitle className="text-sm font-medium text-foreground">รายละเอียดผู้สมัคร</DialogTitle>
        <DialogDescription className="sr-only">{name}</DialogDescription>
      </div>
    </DialogHeader>
  );
}
