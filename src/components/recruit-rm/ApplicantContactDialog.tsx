import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Pencil, UserRound, X } from 'lucide-react';
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
import {
  AppointmentsTable,
  AttendanceTable,
  CallsTable,
  ContactsTable,
  HistoryTable,
} from '@/components/recruit-rm/ApplicantRecordTables';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { EM_DASH } from '@/lib/displayFallback';
import { formatYmdDmyBe } from '@/lib/dateTh';
import {
  fetchApplicantDetailExtras,
  fetchAttendanceLogs,
  fixApplicationPhone,
  recordAppointmentAttendance,
  updateApplicationProfile,
  type ApplicantDetailExtras,
  type AttendanceLogItem,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import { fetchRecruitReasons } from '@/lib/recruitReasonsApi';
import type { RecruitReason } from '@/lib/recruitReasons';
import { fetchContactLogs, saveContactLog, type ContactLog } from '@/lib/applicationContactsApi';
import { fetchSiamrajUnitRequests } from '@/lib/siamrajUnitRequestsApi';
import { unitRequestCardTitle } from '@/lib/unitRequestDisplay';
import { canRecordAttendance } from '@/lib/appointmentAttendance';
import { profileDraftOf, profilePatchFromDraft, type ProfileDraft } from '@/lib/applicantProfileEdit';
import {
  DETAIL_TABS,
  FOLLOW_UP_FAIL_OPTIONS,
  PROCESS_STEPS,
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
 * - ก้อน "ยกเลิกข้อมูลผู้สมัคร" ในรูป **ยังไม่ทำ** (Choice ของเจ้าของ)
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
}: {
  application: PublicApplication | null;
  onClose: () => void;
  /** บันทึกสำเร็จ — ให้หน้าแม่ reload ลิสต์ (สถานะใบเปลี่ยน แถวอาจย้ายแท็บ) */
  onSaved: () => void;
  /** true = คืนเนื้อเปล่า ๆ ไม่ห่อ Dialog (ฝังในป๊อปดูรายชื่อของกล่องงาน) · 🔴 ห้ามซ้อน Dialog ใน Dialog */
  embedded?: boolean;
}) {
  const a = application;
  const [tab, setTab] = useState<DetailTab>('info');

  // ── ขั้น 1 การติดต่อ — กดเลือก = จะบันทึกผลติดต่อครั้งใหม่ (log รายครั้ง กดผลเดิมซ้ำก็นับเป็นครั้งใหม่)
  const [contactPicked, setContactPicked] = useState<ContactChoice | null>(null);
  const [reasonId, setReasonId] = useState('');
  // ── ขั้น 2 การนัดหมาย
  const [apptOpen, setApptOpen] = useState(false);
  const [apptDate, setApptDate] = useState('');
  const [apptPlace, setApptPlace] = useState('');
  const [apptJob, setApptJob] = useState(ADVANCE);
  // ── ขั้น 3 การติดตามนัด — 'fail' ที่ยังไม่เลือกไม่มา/เลื่อนนัด = ค้างให้เลือก
  const [followPicked, setFollowPicked] = useState<FollowUpChoice | 'fail' | null>(null);
  // ── แท็บข้อมูลผู้สมัคร
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reasons, setReasons] = useState<RecruitReason[]>([]);
  const [openJobs, setOpenJobs] = useState<JobRequest[]>([]);
  const [logs, setLogs] = useState<ContactLog[]>([]);
  const [extras, setExtras] = useState<ApplicantDetailExtras>(EMPTY_EXTRAS);
  const [attendance, setAttendance] = useState<AttendanceLogItem[]>([]);

  /** แก้เบอร์ (ใบที่ติดธง "เบอร์ใช้โทรไม่ได้" — migration 087) */
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // เปิดคนใหม่ = เริ่มใหม่ทั้งหมด + โหลดของประกอบ · กัน race (`cancelled`) — กดไล่แถวเร็ว ๆ
  // แล้ว response ที่มาช้าต้องไม่ทับของคนที่เปิดอยู่ (ทุกตัวกลืน error เป็นรายการว่าง)
  useEffect(() => {
    if (!application) return;
    let cancelled = false;
    setTab('info');
    setContactPicked(null);
    setReasonId('');
    setApptOpen(false);
    setApptDate('');
    setApptPlace('');
    setApptJob(ADVANCE);
    setFollowPicked(null);
    setEditing(false);
    setDraft(null);
    setBusy(false);
    setError(null);
    setLogs([]);
    setExtras(EMPTY_EXTRAS);
    setAttendance([]);
    setPhoneDraft('');
    setPhoneBusy(false);
    setPhoneError(null);
    void fetchContactLogs(application.id).then((v) => !cancelled && setLogs(v));
    void fetchApplicantDetailExtras(application.id).then((v) => !cancelled && setExtras(v));
    void fetchAttendanceLogs(application.id).then((v) => !cancelled && setAttendance(v));
    void fetchRecruitReasons({ processCode: '1', outcomeCode: 'C' })
      .then((v) => !cancelled && setReasons(v))
      .catch(() => !cancelled && setReasons([]));
    void fetchSiamrajUnitRequests(500)
      .then((v) => !cancelled && setOpenJobs(v))
      .catch(() => !cancelled && setOpenJobs([]));
    return () => {
      cancelled = true;
    };
  }, [application]);

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
    : apptOpen
      ? 'บันทึกนัดหมายใหม่ก่อน'
      : !canRecordAttendance(a.appointment_at, now)
        ? 'บันทึกได้ตั้งแต่วันนัด'
        : null;
  const selectedReason = reasons.find((r) => r.id === reasonId) ?? null;
  const selectedJob = openJobs.find((j) => j.id === apptJob) ?? null;
  const profile = editing && draft ? profilePatchFromDraft(baseDraft, draft) : { patch: {}, error: null };
  const profileDirty = Object.keys(profile.patch).length > 0 || Boolean(profile.error);
  const dirty = profileDirty || contactPicked !== null || apptOpen || followPicked !== null;

  const save = async () => {
    if (busy) return;
    setError(null);
    if (profile.error) return setError(profile.error);
    if (contactFailPicked && !selectedReason) return setError('เลือกเหตุผลที่ติดต่อไม่สำเร็จ');
    if (apptOpen && contactFailPicked) return setError('ติดต่อไม่สำเร็จ นัดหมายไม่ได้');
    if (apptOpen && !apptDate) return setError('นัดหมายใหม่ต้องใส่วันนัด');
    if (followPicked === 'fail') return setError('เลือกว่าไม่มา หรือ เลื่อนนัด');
    setBusy(true);
    const saved: string[] = [];
    try {
      if (Object.keys(profile.patch).length > 0) {
        await updateApplicationProfile(a.id, profile.patch);
        saved.push('ข้อมูลผู้สมัคร');
      }
      if (contactPicked !== null || apptOpen) {
        // นัดหมายใหม่โดยไม่ได้กดขั้น 1 = ติดต่อสำเร็จอยู่แล้ว (นัดได้แปลว่าคุยกันได้)
        const ok = contactPicked ? contactPicked === 'ok' : true;
        await saveContactLog({
          applicationId: a.id,
          ok,
          reasonId: ok ? null : (selectedReason?.id ?? null),
          reasonLabel: ok ? null : (selectedReason?.name ?? null),
          appointmentAt: ok && apptOpen ? apptDate : null,
          appointmentPlace: ok && apptOpen ? apptPlace.trim() || null : null,
          jobId: ok && apptOpen && apptJob !== ADVANCE ? apptJob : null,
          jobLabel: ok && apptOpen ? (selectedJob ? unitRequestCardTitle(selectedJob) : 'หาล่วงหน้า') : null,
          note: null,
        });
        saved.push(apptOpen ? 'นัดหมาย' : 'ผลการติดต่อ');
      }
      if (followPicked && a.appointment_at) {
        await recordAppointmentAttendance({
          applicationId: a.id,
          appointmentAt: a.appointment_at,
          result: followPicked,
        });
        saved.push('ผลติดตามนัด');
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
    a.phone_callable === false ? (
      <div className="mt-1.5 space-y-1">
        <p className={cn('text-xs font-medium', TONE.danger.value)}>เบอร์นี้ใช้กับระบบโทรไม่ได้</p>
        <div className="flex items-center gap-1.5">
          <Input
            value={phoneDraft}
            onChange={(e) => setPhoneDraft(e.target.value)}
            placeholder="มือถือ 10 หลัก"
            inputMode="tel"
            aria-label="เบอร์มือถือใหม่"
            className="h-8 text-xs tabular-nums"
          />
          <Button
            type="button"
            size="xs"
            disabled={phoneBusy || phoneDraft.replace(/\D/g, '').length < 10}
            onClick={() => {
              setPhoneBusy(true);
              setPhoneError(null);
              fixApplicationPhone(a.id, phoneDraft)
                .then(() => onSaved())
                .catch((e) => setPhoneError(e instanceof Error ? e.message : 'แก้เบอร์ไม่สำเร็จ'))
                .finally(() => setPhoneBusy(false));
            }}
          >
            {phoneBusy ? <Loader2 className="animate-spin" /> : null} แก้เบอร์
          </Button>
        </div>
        {phoneError ? <p className={cn('text-xs', TONE.danger.value)}>{phoneError}</p> : null}
      </div>
    ) : null;

  const body = (
    <div className="space-y-4">
      <DialogHeaderLike embedded={embedded} name={a.full_name} />

      {/* ── ขั้นตอนการดำเนินการ ── */}
      <section className="space-y-2" aria-label="ขั้นตอนการดำเนินการ">
        <p className="text-xs font-medium text-muted-foreground">ขั้นตอนการดำเนินการ</p>

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
                setApptOpen(false);
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

        <div className="overflow-hidden rounded-xl border border-border/70" data-testid="step-appointment">
          <StepHead index={1} done={Boolean(a.appointment_at)}>
            <Button
              type="button"
              size="sm"
              variant={apptOpen ? 'outline' : 'default'}
              disabled={busy || contactFailPicked}
              title={contactFailPicked ? 'ติดต่อไม่สำเร็จ นัดหมายไม่ได้' : undefined}
              onClick={() => {
                setApptOpen((v) => !v);
                setError(null);
              }}
            >
              {apptOpen ? 'ยกเลิกนัดใหม่' : 'นัดหมายใหม่'}
            </Button>
          </StepHead>
          <div className="grid grid-cols-1 gap-3 border-t border-border/70 bg-muted/30 p-3 sm:grid-cols-3">
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
              <p className="text-sm text-foreground">
                {a.appointment_job || (a.appointment_at ? 'หาล่วงหน้า' : EM_DASH)}
              </p>
            </div>
          </div>
          {apptOpen ? (
            <div className="grid grid-cols-1 gap-3 border-t border-border/70 p-3 sm:grid-cols-3" data-testid="new-appointment">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">นัดหมายวันที่ *</p>
                <DateSelectDmyBe value={apptDate} onChange={setApptDate} allowEmpty disabled={busy} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">สถานที่นัดหมาย</p>
                <Input
                  value={apptPlace}
                  onChange={(e) => setApptPlace(e.target.value)}
                  disabled={busy}
                  aria-label="สถานที่นัดหมาย"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ลงหน่วยงาน</p>
                <Select value={apptJob} onValueChange={setApptJob} disabled={busy}>
                  <SelectTrigger className="h-9 text-sm" aria-label="ลงหน่วยงาน">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* เจ้าของเคาะเดิม: บางกรณีนัดไว้แต่ยังไม่รู้ลงใบไหน — เป็นค่าเริ่มต้น */}
                    <SelectItem value={ADVANCE}>ยังไม่ระบุ — หาล่วงหน้า</SelectItem>
                    {openJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {unitRequestCardTitle(j)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
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
        </div>
      </section>

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
        </TabsContent>
        <TabsContent value="history" className="pt-2">
          <HistoryTable items={extras.history} />
        </TabsContent>
        <TabsContent value="calls" className="pt-2">
          <CallsTable rows={callRows} application={a} />
        </TabsContent>
        <TabsContent value="contacts" className="pt-2">
          <ContactsTable logs={logs} />
        </TabsContent>
        <TabsContent value="appointments" className="pt-2">
          <AppointmentsTable logs={logs} />
        </TabsContent>
        <TabsContent value="attendance" className="pt-2">
          <AttendanceTable logs={attendance} />
        </TabsContent>
      </Tabs>

      {error ? (
        <p role="alert" className={cn('text-xs font-medium', TONE.danger.value)}>
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
        <Button type="button" size="sm" onClick={() => void save()} disabled={!dirty || busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null} บันทึก
        </Button>
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
