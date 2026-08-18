import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import FollowCallRoundsPanel from '@/components/follow/FollowCallRoundsPanel';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { Phone, Plus, X, LoaderCircle, RefreshCw, PhoneForwarded, Users, Pencil, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import FollowCompleteControls from '@/components/follow/FollowCompleteControls';
import { FOLLOW_OUTCOME_LABEL, type FollowOutcome } from '@/lib/followOutcome';
import {
  listFollowEntries,
  createFollowEntry,
  cancelFollowEntry,
  completeFollowEntry,
  FOLLOW_STATUS_LABEL,
  FOLLOW_STATUS_CLASS,
  FOLLOW_STATUS_BAR,
  type FollowEntry,
  type FollowCallStatus,
  updateFollowEntry,
} from '@/lib/followApi';
import NameAvatar from '@/components/shared/NameAvatar';
import BoardPersonPicker from '@/components/follow/BoardPersonPicker';
import BoardUnitPicker from '@/components/follow/BoardUnitPicker';
import { splitPickerName, type BoardPickerPerson } from '@/lib/boardPickerApi';
import type { BoardUnitOption } from '@/lib/boardUnitPicker';
import {
  firstIncompleteStep,
  followStepError,
  followStepSummary,
  FOLLOW_WIZARD_STEPS,
  isSubmitTooSoonAfterStep3,
  nextFollowStep,
  prevFollowStep,
  type FollowWizardStep,
} from '@/lib/followWizard';
import { useSearchParams } from 'react-router-dom';
import { hasFollowPrefill, readFollowPrefill, splitPrefillName } from '@/lib/followPrefill';
import { fetchSiamrajUnitRequests } from '@/lib/siamrajUnitRequestsApi';
import type { JobRequest } from '@/types';
import FollowEditDialog from '@/components/follow/FollowEditDialog';


function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

/** ค่าเริ่มต้นช่องวันเวลา = ตอนนี้ (รูปแบบ datetime-local ตามเวลาเครื่อง) */
function nowForInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * คำนำหน้าที่ให้เลือก — เก็บเป็นข้อความติดหน้าชื่อตามธรรมเนียมไทย ("นายสมชาย ใจดี")
 * ค่าว่าง = ไม่ระบุ (บางเคสมีแค่ชื่อเล่น/ชื่อที่คนแนะนำมา)
 */
const NAME_PREFIXES = ['', 'นาย', 'นาง', 'นางสาว'] as const;

/** ประกอบชื่อที่จะส่งให้ API — API รับ `recipient_name` ก้อนเดียว */
function composeRecipientName(prefix: string, first: string, last: string): string {
  return `${prefix}${first.trim()} ${last.trim()}`.trim().replace(/\s+/g, ' ');
}

const FollowPage: React.FC = () => {
  const [items, setItems] = useState<FollowEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | FollowCallStatus>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  /** เบอร์เจ้าหน้าที่ผู้ติดตาม — AI พูดให้ผู้สมัครโทรกลับ (เจ้าของสั่ง 13 ส.ค. 2569) */
  const [staffPhone, setStaffPhone] = useState('');
  /** ให้โทรเมื่อไหร่ — หลายรอบได้ เพราะบางเคสต้องโทรมากกว่า 1 ครั้ง (เจ้าของสั่ง 10 ส.ค. 2569) */
  const [scheduledAts, setScheduledAts] = useState<string[]>(() => [nowForInput()]);
  /**
   * โหมดตารางโทร (16 ส.ค. · migration 092): ช่วงวัน × รอบเวลา/วัน
   * เช่น 1-7 ส.ค. วันละ 2 รอบ 07:00/08:00 → ระบบยิง 1 แถว/วัน ผูก group เดียว
   * รับสายยืนยันแล้ว Lumos หยุดรอบที่เหลือของวันนั้น (stop_early) พรุ่งนี้โทรต่อ
   */
  const [scheduleMode, setScheduleMode] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [roundTimes, setRoundTimes] = useState<string[]>(() => ['07:00']);
  /**
   * วันที่ **จะส่งให้ Lumos จริง** (เจ้าของสั่ง 17 ส.ค. 2569: *"ลงหน้า Follow ตั้งแต่ 1-7 วัน
   * แต่เลือกได้ว่าจะส่งให้ lumos วันไหนบ้าง"*)
   *
   * เดิมช่วงวันคือ "ส่งทุกวันในช่วง" ไม่มีทางข้ามวัน — เสาร์อาทิตย์/วันหยุดก็ยิงหมด
   * ตอนนี้ช่วงวันเป็นแค่ **ตัวกางปฏิทิน** ส่วนวันที่ติ๊กไว้เท่านั้นที่กลายเป็นสายจริง
   * ⚠️ ติ๊กไม่ครบ = ไม่ใช่ error — ตั้งใจข้ามวันได้
   */
  const [skippedDays, setSkippedDays] = useState<Set<string>>(() => new Set());
  /**
   * หน่วยงานที่ตามเรื่องให้ + รหัสไซต์ (096) — เลือกจากใบขอแล้วเติมให้ทั้งคู่
   * (เจ้าของสั่ง: *"เพิ่มชื่อหน่วยงาน โดยเลือกจากใบงานได้เลย · Code site ถ้าเลือกหน่วยงานก็ให้ขึ้นมาเลย"*)
   */
  const [unitName, setUnitName] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [openJobs, setOpenJobs] = useState<JobRequest[]>([]);
  /** รายการที่กำลังแก้ไข (096) — null = ไม่ได้เปิดกล่องแก้ */
  const [editing, setEditing] = useState<FollowEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * เลือกชื่อจากบอร์ด ERP (F5b · 16 ส.ค. 2569) — เดิมต้องคีย์ชื่อ+เบอร์เอง พิมพ์ผิด = โทรผิดคน
   * เลือกแล้วเติมช่องชื่อ/เบอร์ให้ · ช่อง "เรื่องที่จะให้โทร" ยังต้องพิมพ์เอง (คนละเรื่องกันทุกครั้ง)
   */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedFrom, setPickedFrom] = useState<string | null>(null);
  /** ตัวเลือกหน่วยงานจากบอร์ด (18 ส.ค. 2569) — คู่แฝดของ picker ชื่อคน */
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  /**
   * ฟอร์มเพิ่มเป็น 3 ขั้น (เจ้าของสั่ง 18 ส.ค. 2569) — คน → หน่วยงาน → เวลา
   * ด่านตรวจอยู่ที่ `followWizard.ts` ที่เดียว ทั้งปุ่มถัดไปและตอนกดบันทึก
   */
  const [step, setStep] = useState<FollowWizardStep>(1);
  /**
   * เวลาที่เพิ่งเข้าขั้นตั้งเวลา — กันคลิกเร็วซ้อน: กด "ถัดไป" แล้วปุ่ม "บันทึก"
   * มาเรนเดอร์แถวเดียวกันทันที คลิกที่สองของคนกดเร็วตกลงบนบันทึกพอดี (โดนจริง 18 ส.ค.)
   */
  const step3EnteredAtRef = useRef(0);

  /** ใบขอที่ยังเปิด — ใช้เป็นตัวเลือกหน่วยงาน · โหลดไม่ได้ = พิมพ์ชื่อเองได้เหมือนเดิม */
  useEffect(() => {
    let cancelled = false;
    void fetchSiamrajUnitRequests(500)
      .then((v) => {
        if (!cancelled) setOpenJobs(v);
      })
      .catch(() => {
        if (!cancelled) setOpenJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * ค่าที่ส่งมาจากปุ่ม "ลงแผนแจ้งเข้า" ในหน้าคัดสรร (ข้อ 7) — กรอกชื่อ/เบอร์/เรื่องให้เลย
   * เหลือแค่เลือกวัน–เวลา · อ่านครั้งเดียวตอนเข้าหน้า แล้วล้าง query ทิ้ง
   * (ไม่ล้าง = กดรีเฟรชแล้วฟอร์มเด้งเปิดใหม่ทุกครั้ง)
   */
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const prefill = readFollowPrefill(searchParams);
    if (!hasFollowPrefill(prefill)) return;
    if (prefill.name) {
      const { prefix: pre, first, last } = splitPrefillName(prefill.name);
      setPrefix(pre);
      setFirstName(first);
      setLastName(last);
    }
    if (prefill.phone) setPhone(prefill.phone);
    if (prefill.topic) setTopic(prefill.topic);
    setPickedFrom('มาจากหน้าคัดสรร — เหลือเลือกวันและเวลา');
    setFormOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);
  const pickPerson = (p: BoardPickerPerson) => {
    const { prefix: pre, first, last } = splitPickerName(p);
    setPrefix(pre);
    setFirstName(first);
    setLastName(last);
    setPhone((p.mobile || '').trim());
    setPickedFrom(p.column_label ? `เลือกจากบอร์ด · ถัง ${p.column_label}` : 'เลือกจากบอร์ด');
    setPickerOpen(false);
    setFormError(null);
  };

  /** เลือกหน่วยงานจากบอร์ด — เติมทั้งชื่อและรหัสไซต์ (เหมือน dropdown เดิมทุกอย่าง) */
  const pickUnit = (u: BoardUnitOption) => {
    setUnitName(u.unitName);
    setSiteCode(u.siteCode);
    setUnitPickerOpen(false);
    setFormError(null);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listFollowEntries());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดรายการไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const resetForm = () => {
    setPrefix('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setTopic('');
    setNote('');
    setStaffPhone('');
    setPickedFrom(null);
    setScheduledAts([nowForInput()]);
    setDateFrom('');
    setDateTo('');
    setRoundTimes(['07:00']);
    setSkippedDays(new Set());
    setUnitName('');
    setSiteCode('');
    setFormError(null);
    setStep(1);
  };

  const setScheduledAtAt = (i: number, v: string) =>
    setScheduledAts((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  const addScheduledAt = () => setScheduledAts((prev) => [...prev, nowForInput()]);
  const removeScheduledAt = (i: number) =>
    setScheduledAts((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const setRoundAt = (i: number, v: string) =>
    setRoundTimes((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  const addRound = () => setRoundTimes((prev) => (prev.length >= 5 ? prev : [...prev, '08:00']));
  const removeRound = (i: number) =>
    setRoundTimes((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  /** วันในช่วง [from, to] เป็น YYYY-MM-DD (สูงสุด 31 วัน) — คืน [] ถ้าช่วงผิด */
  const daysInRange = (from: string, to: string): string[] => {
    if (!from || !to) return [];
    const start = new Date(`${from}T00:00:00+07:00`);
    const end = new Date(`${to}T00:00:00+07:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
    const out: string[] = [];
    for (let d = new Date(start); d <= end && out.length < 31; d.setDate(d.getDate() + 1)) {
      out.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }));
    }
    return out;
  };

  /**
   * หนึ่งเวลา = หนึ่งรายการ — API รับเวลาเดียวต่อรายการ และคิวโทรก็ผูกกับรายการ 1:1
   * จึงยิงทีละรอบ ไม่ใช่ยัดหลายเวลาลงรายการเดียว (แต่ละรอบมีสถานะ/ผลของตัวเอง ตามงานจริงได้)
   *
   * ⚠️ ยิงหลายรอบแล้วรอบท้าย ๆ ล้มได้ — ต้องบอกผู้ใช้ว่า **อะไรสำเร็จไปแล้ว**
   * ไม่งั้นเขากดซ้ำทั้งชุดแล้วได้รายการซ้อน (บทเรียนเดียวกับตอนสร้างชุดส่งจากหน้า Matching)
   */
  /** ค่าที่ตัวตรวจของ wizard ใช้ — ประกอบที่เดียว ปุ่มถัดไปกับตอนบันทึกจึงตรวจชุดเดียวกัน */
  const wizardValues = useMemo(
    () => ({
      firstName,
      phone,
      topic,
      scheduleMode,
      scheduledAts,
      scheduleDays: daysInRange(dateFrom, dateTo).filter((d) => !skippedDays.has(d)),
      roundTimes,
    }),
    [firstName, phone, topic, scheduleMode, scheduledAts, dateFrom, dateTo, skippedDays, roundTimes],
  );

  const stepError = followStepError(step, wizardValues);

  /**
   * เปลี่ยนขั้นผ่านตัวนี้เสมอ — จับเวลาเข้าขั้น 3 **ตอนคลิก ไม่ใช่หลัง render**
   * (useEffect ตั้งหลัง paint — คลิกซ้อนที่เร็วกว่าเฟรมแรกจะเห็น ref เป็นค่าเก่าแล้วหลุดด่าน)
   */
  const goToStep = (target: FollowWizardStep) => {
    if (target === 3 && step !== 3) step3EnteredAtRef.current = Date.now();
    setStep(target);
  };

  // backstop เผื่อมีทางเปลี่ยนขั้นที่ไม่ผ่าน goToStep
  useEffect(() => {
    if (step === 3 && step3EnteredAtRef.current === 0) step3EnteredAtRef.current = Date.now();
  }, [step]);

  /** กดถัดไป — ไม่ผ่านด่านของขั้นนี้ก็ไม่ให้ไป และบอกว่าติดตรงไหน */
  const goNext = () => {
    if (stepError) {
      setFormError(stepError);
      return;
    }
    setFormError(null);
    goToStep(nextFollowStep(step));
  };

  const submit = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    setFormError(null);
    /**
     * 🔴 **ยังไม่ถึงขั้นตั้งเวลา = ห้ามบันทึกเด็ดขาด** (เจ้าของแจ้ง 18 ส.ค. 2569:
     * *"พอเลือกหน่วยงานแล้วจะกดไปตั้งเวลามันบันทึกเองเลย"*)
     *
     * เหตุ: ฟอร์ม HTML ยิง submit เองเมื่อกด Enter ในช่องใด ๆ (รวมตอนเลือก dropdown
     * ด้วยคีย์บอร์ด) — และขั้น 3 **ผ่านด่านตั้งแต่ยังไม่แตะ** เพราะเวลาเริ่มต้นเป็น "ตอนนี้"
     * ด่าน `firstIncompleteStep` จึงไม่ช่วยเลย บันทึกทันทีตั้งแต่ยืนอยู่ขั้น 2
     * → ต้องกันด้วย "อยู่ขั้นไหน" ไม่ใช่ "ข้อมูลครบหรือยัง" · Enter กลายเป็นปุ่มถัดไปแทน
     */
    if (step !== 3) {
      const err = followStepError(step, wizardValues);
      if (err) setFormError(err);
      else goToStep(nextFollowStep(step));
      return;
    }
    /**
     * 🔴 เพิ่งเข้าขั้นตั้งเวลามาไม่ถึงช่วงกัน = คลิกซ้อนจากปุ่มถัดไป ไม่ใช่เจตนาบันทึก
     * กลืนเงียบ ๆ (เหมือนกดไม่ติด) — คนที่ตั้งใจจริงจะกดอีกครั้งหลังอ่านหน้าจอ
     */
    if (isSubmitTooSoonAfterStep3(step3EnteredAtRef.current, Date.now())) return;
    /**
     * 🔴 กันข้ามขั้น — ต่อให้กด Enter จากขั้นไหนก็ต้องผ่านทุกขั้นก่อนถึงจะยิงจริง
     * ไม่ผ่านตรงไหนให้เด้งกลับไป**ขั้นนั้น** ไม่ใช่ขึ้น error ลอย ๆ ที่คนหาไม่เจอ
     */
    const incomplete = firstIncompleteStep(wizardValues);
    if (incomplete) {
      setStep(incomplete);
      setFormError(followStepError(incomplete, wizardValues));
      return;
    }
    const recipientName = composeRecipientName(prefix, firstName, lastName);

    // โหมดตาราง: ช่วงวัน × รอบเวลา/วัน → 1 แถว/วัน ผูก group เดียว (Lumos หยุดรอบที่เหลือ
    // ของวันเมื่อยืนยัน · declined ยกเลิกทั้งชุด — server จัดการ)
    if (scheduleMode) {
      const allDays = daysInRange(dateFrom, dateTo);
      if (allDays.length === 0) {
        setFormError('เลือกช่วงวันให้ถูกต้อง (ไม่เกิน 31 วัน · วันเริ่มต้องไม่หลังวันจบ)');
        return;
      }
      // ส่งเฉพาะวันที่ติ๊กไว้ — ช่วงวันเป็นแค่ตัวกางปฏิทิน ไม่ใช่คำสั่งส่งทุกวัน
      const days = allDays.filter((d) => !skippedDays.has(d));
      if (days.length === 0) {
        setFormError('ยังไม่ได้เลือกวันที่จะส่งให้ AI โทรสักวัน — ติ๊กอย่างน้อย 1 วัน');
        return;
      }
      const rounds = [...new Set(roundTimes.filter((t) => /^\d{1,2}:\d{2}$/.test(t)))].sort();
      if (rounds.length === 0) {
        setFormError('ระบุรอบเวลาอย่างน้อย 1 รอบ (เช่น 07:00)');
        return;
      }
      const groupId = crypto.randomUUID();
      setSubmitting(true);
      let done = 0;
      try {
        for (const day of days) {
          await createFollowEntry({
            recipient_name: recipientName,
            recipient_phone: phone,
            topic,
            note: note || undefined,
            staff_phone: staffPhone || undefined,
            scheduled_at: new Date(`${day}T${rounds[0]}:00+07:00`).toISOString(),
            group_id: groupId,
            call_times: rounds,
            unit_name: unitName.trim() || undefined,
            site_code: siteCode.trim() || undefined,
          });
          done += 1;
        }
        resetForm();
        setFormOpen(false);
        setOkMessage(`ตั้งตารางโทรแล้ว — ${days.length} วัน วันละ ${rounds.length} รอบ (รวม ${days.length * rounds.length} สาย)`);
        window.setTimeout(() => setOkMessage(null), 6000);
        await reload();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'ตั้งตารางไม่สำเร็จ';
        setFormError(done > 0 ? `${msg} — ตั้งไปแล้ว ${done} จาก ${days.length} วัน อย่ากดซ้ำทั้งชุด` : msg);
        if (done > 0) await reload();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // เรียงเวลาจากก่อนไปหลัง + ตัดเวลาซ้ำทิ้ง (กดเพิ่มแล้วลืมแก้ = ได้สองสายเวลาเดียวกัน)
    const times = [...new Set(scheduledAts.filter(Boolean))].sort();
    if (times.length === 0) {
      setFormError('กรุณาระบุเวลาที่ให้โทรอย่างน้อย 1 รอบ');
      return;
    }

    setSubmitting(true);
    let done = 0;
    try {
      for (const t of times) {
        await createFollowEntry({
          recipient_name: recipientName,
          recipient_phone: phone,
          topic,
          note: note || undefined,
          staff_phone: staffPhone || undefined,
          scheduled_at: new Date(t).toISOString(),
          unit_name: unitName.trim() || undefined,
          site_code: siteCode.trim() || undefined,
        });
        done += 1;
      }
      resetForm();
      setFormOpen(false);
      setOkMessage(
        times.length > 1
          ? `เพิ่มรายชื่อแล้ว — ตั้งให้โทร ${times.length} รอบ`
          : 'เพิ่มรายชื่อแล้ว',
      );
      window.setTimeout(() => setOkMessage(null), 5000);
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เพิ่มรายชื่อไม่สำเร็จ';
      setFormError(
        done > 0
          ? `${msg} — แต่บันทึกไปแล้ว ${done} จาก ${times.length} รอบ กรุณาเพิ่มเฉพาะรอบที่ยังขาด อย่ากดซ้ำทั้งชุด`
          : msg,
      );
      if (done > 0) await reload();
    } finally {
      setSubmitting(false);
    }
  };

  const doCancel = async (id: string) => {
    setBusyId(id);
    try {
      await cancelFollowEntry(id);
      setCancellingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * ปิดงาน (095) — บันทึกว่าจบแบบไหน แล้วโหลดใหม่ให้ป้ายบนแถวขึ้นทันที
   * ⚠️ ไม่แตะคิวโทร: รายการที่ปิดแล้วแต่ยังมีรอบค้างในตาราง ต้องกดยกเลิกแยก
   * (ปิดแล้วลบสายที่นัดไว้เอง = เดาแทนคน เจ้าของยังไม่ได้สั่ง)
   */
  const doComplete = async (id: string, outcome: FollowOutcome, note?: string) => {
    setBusyId(id);
    setError(null);
    try {
      await completeFollowEntry(id, outcome, note);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ปิดงานไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((it) => it.call_status === filter)),
    [items, filter],
  );

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.call_status === 'pending').length;
    const done = items.filter((i) => i.call_status === 'completed').length;
    return { total: items.length, pending, done };
  }, [items]);

  return (
    <div className="relative">
      <PageHeader
        title="Follow"
        subtitle="ลงรายชื่อคนที่ต้องติดตาม แล้ว AI จะโทรตามให้"
        backPath="/"
      />

      <div className="px-4 md:px-6 py-4 space-y-4">
        {/* funnel การโทร "ของหน้านี้เท่านั้น" + ถัง "ต้องคนตาม"
            เจ้าของสั่ง 10 ส.ค. 2569: หน้านี้เอาแค่ของ Follow พอ ("ตอนนี้มีแค่ 1 พอ")
            ตัวที่กดสลับดูต้นทางอื่นได้ ย้ายไปอยู่หน้าการไหลของงานแล้ว */}
        {/* แผงการโทรแบบ 3 รอบ + ปฏิทิน (เจ้าของสั่ง 18 ส.ค. 2569 — แทน funnel 4 ช่องเดิม)
            CallFunnelPanel ใช้ที่หน้านี้ที่เดียว การเปลี่ยนจึงไม่กระทบหน้า Matching
            (หน้านั้นใช้ AiCallFlowPanel คนละตัว) */}
        <FollowCallRoundsPanel />


        {/* สรุป + ปุ่มเพิ่ม */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setFormOpen((v) => !v);
              setFormError(null);
            }}
            className="jarvis-pill-btn inline-flex min-h-[44px] items-center gap-1.5 px-5 py-2.5 text-sm touch-manipulation"
          >
            <Plus className="h-4 w-4" aria-hidden />
            เพิ่มรายชื่อที่ต้องติดตาม
          </button>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className={cn(
              'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium shadow-sm disabled:opacity-50',
              // เดิมเขียนคลาสเองแบบไม่มีคู่ dark: → โหมดมืดได้ปุ่มขาวทึบบนพื้นดำ
              // (วัดจริง: rgb(255,255,255) บนพื้น rgb(19,19,22)) · TONE.info.outline คือชุดเดียวกันแต่ครบสองธีม
              TONE.info.outline,
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            รีเฟรช
          </button>
          <p className="text-xs text-muted-foreground">
            ทั้งหมด <span className="font-bold tabular-nums text-foreground">{counts.total}</span> · รอโทร{' '}
            <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{counts.pending}</span> · สำเร็จ{' '}
            <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{counts.done}</span>
          </p>
        </div>

        {okMessage ? (
          <p className={cn('rounded-xl border px-3.5 py-2.5 text-xs font-medium', TONE.success.soft, TONE.success.value)}>
            {okMessage}
          </p>
        ) : null}

        {/* ฟอร์มเพิ่ม */}
        {formOpen ? (
          <form
            /**
             * 🔴 **ฟอร์มนี้ไม่รับ submit เลย** (เจ้าของโดนบันทึกเองซ้ำ 18 ส.ค. 2569) —
             * ทุกเส้นทาง submit ของเบราว์เซอร์ (Enter · implicit submit · ปุ่มที่ลืมใส่ type)
             * ถูกตัดทิ้งที่นี่ การบันทึกผูกกับ onClick ของปุ่ม "บันทึก + ส่ง AI โทร"
             * **ที่เดียวเท่านั้น** — โครงสร้างนี้ทำให้ "บันทึกเอง" เป็นไปไม่ได้ ไม่ใช่แค่กันไว้
             */
            onSubmit={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                e.preventDefault();
              }
            }}
            className="jarvis-frost space-y-3 p-4 sm:p-5"
          >
            {/* แถบขั้น 1→2→3 (เจ้าของสั่ง 18 ส.ค. 2569) — กดย้อนกลับขั้นที่ทำแล้วได้
                ขั้นที่ยังไม่ถึงกดไม่ได้ ต้องผ่านด่านของขั้นก่อนหน้าเอง */}
            <ol className="flex items-stretch gap-1.5">
              {FOLLOW_WIZARD_STEPS.map((s) => {
                const done = s.step < step;
                const current = s.step === step;
                return (
                  <li key={s.step} className="min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={s.step > step}
                      onClick={() => goToStep(s.step)}
                      className={cn(
                        'flex w-full flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors',
                        current
                          ? 'border-primary bg-primary/10'
                          : done
                            ? cn(TONE.success.soft, 'hover:bg-secondary')
                            : 'border-border bg-background opacity-60',
                      )}
                    >
                      <span
                        className={cn(
                          'text-[10px] font-bold',
                          current ? 'text-primary' : done ? TONE.success.value : 'text-muted-foreground',
                        )}
                      >
                        {done ? '✓' : s.step} · {s.title}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {followStepSummary(s.step, { ...wizardValues, recipientName: composeRecipientName(prefix, firstName, lastName), unitName, siteCode }) ?? s.hint}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {step === 1 ? (
            <>
            {/* เลือกจากบอร์ด (F5b) — คีย์ชื่อเองก็ยังได้เหมือนเดิม ปุ่มนี้เป็นทางลัดกันพิมพ์ผิด */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className={cn(
                  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold',
                  TONE.info.outline,
                )}
              >
                <Users className="h-3.5 w-3.5" aria-hidden />
                เลือกชื่อจากบอร์ด
              </button>
              {pickedFrom ? (
                <span className="jarvis-chip jarvis-chip-info">{pickedFrom}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">หรือคีย์ชื่อเองด้านล่าง</span>
              )}
            </div>

            {/* คำนำหน้า + ชื่อ + นามสกุล — API รับ recipient_name ก้อนเดียว ประกอบตอนส่ง
                นามสกุลไม่บังคับ บางเคสมีแค่ชื่อที่คนแนะนำมา ไม่ควรบล็อกไม่ให้ลงรายชื่อ */}
            <div className="grid gap-3 sm:grid-cols-[7rem_1fr_1fr]">
              <div className="space-y-1.5">
                <label htmlFor="followPrefix" className="ml-1 text-xs font-medium text-muted-foreground">
                  คำนำหน้า
                </label>
                <select
                  id="followPrefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="jarvis-soft-field min-h-[46px]"
                >
                  {NAME_PREFIXES.map((p) => (
                    <option key={p || 'none'} value={p}>
                      {p || 'ไม่ระบุ'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="followFirst" className="ml-1 text-xs font-medium text-muted-foreground">
                  ชื่อ
                </label>
                <input
                  id="followFirst"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="สมชาย"
                  className="jarvis-soft-field min-h-[46px]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="followLast" className="ml-1 text-xs font-medium text-muted-foreground">
                  นามสกุล <span className="text-muted-foreground/70">(ถ้ามี)</span>
                </label>
                <input
                  id="followLast"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="ใจดี"
                  className="jarvis-soft-field min-h-[46px]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="followPhone" className="ml-1 text-xs font-medium text-muted-foreground">
                เบอร์โทร (มือถือ 10 หลัก)
              </label>
              <input
                id="followPhone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
                placeholder="0812345678"
                className="jarvis-soft-field min-h-[46px]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="followTopic" className="ml-1 text-xs font-medium text-muted-foreground">
                เรื่องที่จะให้โทรติดตาม
              </label>
              <input
                id="followTopic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                placeholder="เช่น ยืนยันวันเริ่มงาน 15 ส.ค."
                className="jarvis-soft-field min-h-[46px]"
              />
            </div>
            </>
            ) : null}

            {step === 2 ? (
            <>
            {/* ปุ่มเลือกหน่วยงานจากบอร์ด (18 ส.ค. 2569) — คู่แฝดของปุ่มเลือกชื่อ
                dropdown เดิมยังอยู่ข้างล่าง สำหรับคนที่ชินกับของเก่า */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setUnitPickerOpen(true)}
                className={cn(
                  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold',
                  TONE.info.outline,
                )}
              >
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                เลือกหน่วยงานจากบอร์ด
              </button>
              {unitName ? (
                <span className="jarvis-chip jarvis-chip-info">{unitName}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  ข้ามได้ถ้าไม่ผูกหน่วยงาน
                </span>
              )}
            </div>

            {/* หน่วยงาน (096 · เจ้าของสั่ง 17 ส.ค. 2569) — เลือกจากใบขอแล้วรหัสไซต์ขึ้นเอง
                ⚠️ เก็บเป็น **ข้อความ ไม่ใช่ FK ไปใบขอ** — ใบขออยู่คนละฐาน (ERP) และเลขที่ใบ
                ยังซ้ำกันได้ (ใบขอปกติ vs ใบขอล่วงหน้า 23 ใบ · เลขท้ายชนข้าม BU อีก 234 ใบ)
                สิ่งที่งาน Follow ต้องการคือ "ตอนนั้นตามเรื่องของหน่วยงานไหน" = snapshot */}
            <div className="space-y-1.5">
              <label htmlFor="followUnit" className="ml-1 text-xs font-medium text-muted-foreground">
                หน่วยงาน (ถ้ามี)
              </label>
              {/* 🔴 **ไม่มี dropdown แล้ว** (เจ้าของสั่ง 18 ส.ค. 2569: *"พอเลือกหน่วยงานแล้ว
                  ให้ชื่อมาอยู่ในช่องหน่วยงาน เอา Dropdown ออก"*)
                  เหตุผลเสริม: การเลือก dropdown ด้วยคีย์บอร์ดกด Enter = ฟอร์มยิง submit เอง
                  ซึ่งทำให้บันทึกทั้งที่ยังไม่ได้ตั้งเวลา · ช่องข้อความไม่มีปัญหานั้น
                  พิมพ์เองได้สำหรับหน่วยงานที่ไม่มีใบขอเปิดบนบอร์ด */}
              <input
                id="followUnit"
                value={unitName}
                onChange={(e) => {
                  setUnitName(e.target.value);
                  // พิมพ์เองแล้วรหัสไซต์เดิมใช้ไม่ได้ — รหัสไซต์มาจากการ "เลือกจากบอร์ด" เท่านั้น
                  if (siteCode) setSiteCode('');
                }}
                placeholder="กดปุ่มด้านบนเพื่อเลือก หรือพิมพ์ชื่อหน่วยงานเอง"
                className="jarvis-soft-field min-h-[46px] w-full"
              />
              {siteCode ? (
                <p className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Building2 className="h-3 w-3" aria-hidden />
                  รหัสไซต์ <span className="font-mono font-semibold text-foreground">{siteCode}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUnitName('');
                      setSiteCode('');
                    }}
                    className="ml-1 underline hover:text-foreground"
                  >
                    ล้าง
                  </button>
                </p>
              ) : (
                <p className="ml-1 text-[10px] text-muted-foreground">
                  เลือกจากบอร์ดแล้วรหัสไซต์จะขึ้นเอง · พิมพ์เองได้แต่จะไม่มีรหัสไซต์
                </p>
              )}
            </div>

            {/* เจ้าของสั่ง 13 ส.ค. 2569: เปลี่ยนช่อง "รายละเอียดเพิ่มเติม" เป็นเบอร์เจ้าหน้าที่
                — ผู้สมัครที่รับสายจาก AI ต้องมีเบอร์คนจริงให้โทรกลับ
                ⚠️ เก็บเป็นคอลัมน์ใหม่ (staff_phone) ไม่ทับ note เดิมซึ่งคนละความหมาย */}
            <div className="space-y-1.5">
              <label htmlFor="followStaffPhone" className="ml-1 text-xs font-medium text-muted-foreground">
                เบอร์โทรเจ้าหน้าที่ที่ติดตาม (ถ้ามี)
              </label>
              <input
                id="followStaffPhone"
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
                inputMode="tel"
                placeholder="เบอร์ที่ให้ผู้สมัครโทรกลับ เช่น 021234567 ต่อ 101"
                className="jarvis-soft-field min-h-[46px]"
              />
              <p className="ml-1 text-[10px] text-muted-foreground">
                AI จะบอกเบอร์นี้ตอนท้ายสาย — ไม่ใช่เบอร์ที่ระบบใช้โทรออก
              </p>
            </div>

            </>
            ) : null}

            {step === 3 ? (
            <>
            {/* สลับโหมด: รอบเดี่ยว/หลายรอบ (เวลาเจาะจง) vs ตารางหลายวัน (ช่วงวัน × รอบ/วัน) */}
            <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/40 p-1 text-xs dark:border-white/15 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setScheduleMode(false)}
                className={cn('flex-1 rounded-full px-3 py-1.5 font-medium', !scheduleMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
              >
                ระบุเวลาเอง
              </button>
              <button
                type="button"
                onClick={() => setScheduleMode(true)}
                className={cn('flex-1 rounded-full px-3 py-1.5 font-medium', scheduleMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
              >
                ตารางหลายวัน
              </button>
            </div>

            {scheduleMode ? (
              /* ตารางโทร: ช่วงวัน × รอบเวลา/วัน (เจ้าของสั่ง 16 ส.ค. — เช่น 1-7 วันละ 2 รอบ) */
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor="followFrom" className="ml-1 text-xs font-medium text-muted-foreground">ตั้งแต่วันที่</label>
                    <input id="followFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="jarvis-soft-field min-h-[46px] w-full" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="followTo" className="ml-1 text-xs font-medium text-muted-foreground">ถึงวันที่</label>
                    <input id="followTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="jarvis-soft-field min-h-[46px] w-full" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="ml-1 text-xs font-medium text-muted-foreground">รอบเวลาต่อวัน (สูงสุด 5 รอบ)</span>
                  {roundTimes.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={v}
                        onChange={(e) => setRoundAt(i, e.target.value)}
                        aria-label={`รอบที่ ${i + 1}`}
                        className="jarvis-soft-field min-h-[46px] flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeRound(i)}
                        disabled={roundTimes.length <= 1}
                        aria-label={`เอารอบที่ ${i + 1} ออก`}
                        className="inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/60 text-slate-600 hover:text-foreground disabled:opacity-40 dark:border-white/15 dark:bg-white/10 dark:text-slate-300"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                  {roundTimes.length < 5 ? (
                    <button
                      type="button"
                      onClick={addRound}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/70 bg-white/60 px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-foreground dark:border-white/15 dark:bg-white/10 dark:text-slate-300"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden /> เพิ่มรอบต่อวัน
                    </button>
                  ) : null}
                </div>
                {/* เลือกได้ว่าจะส่งให้ Lumos วันไหนบ้าง (เจ้าของสั่ง 17 ส.ค. 2569)
                    ช่วงวันข้างบนเป็นแค่ตัวกางปฏิทิน · ติ๊กวันไหน วันนั้นถึงกลายเป็นสายจริง
                    เดิมส่งทุกวันในช่วง ข้ามเสาร์อาทิตย์/วันหยุดไม่ได้เลย */}
                {(() => {
                  const all = daysInRange(dateFrom, dateTo);
                  if (all.length === 0) return null;
                  const dayLabel = (ymd: string) => {
                    const d = new Date(`${ymd}T00:00:00+07:00`);
                    return d.toLocaleDateString('th-TH', {
                      timeZone: 'Asia/Bangkok',
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    });
                  };
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="ml-1 text-xs font-medium text-muted-foreground">
                          ส่งให้ AI โทรวันไหนบ้าง
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSkippedDays((prev) =>
                              prev.size > 0 ? new Set() : new Set(all),
                            )
                          }
                          className="text-[11px] font-medium text-primary underline"
                        >
                          {skippedDays.size > 0 ? 'เลือกทุกวัน' : 'ไม่เลือกสักวัน'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {all.map((d) => {
                          const on = !skippedDays.has(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                setSkippedDays((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(d)) next.delete(d);
                                  else next.add(d);
                                  return next;
                                })
                              }
                              className={cn(
                                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                                on
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-background text-muted-foreground hover:bg-secondary',
                              )}
                            >
                              {dayLabel(d)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const days = daysInRange(dateFrom, dateTo).filter((d) => !skippedDays.has(d)).length;
                  const rounds = new Set(roundTimes.filter((t) => /^\d{1,2}:\d{2}$/.test(t))).size;
                  return days > 0 && rounds > 0 ? (
                    <p className="ml-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                      รวม {days} วัน × {rounds} รอบ = {days * rounds} สาย · รับสายยืนยันแล้ววันนั้นหยุด พรุ่งนี้โทรต่อ
                    </p>
                  ) : (
                    <p className="ml-1 text-[11px] text-muted-foreground">
                      เลือกช่วงวัน + ติ๊กวันที่จะส่ง + รอบเวลา แล้วระบบจะสรุปจำนวนสายให้
                    </p>
                  );
                })()}
              </div>
            ) : (
            /* ให้โทรเมื่อไหร่ — เพิ่มได้หลายรอบ · หนึ่งรอบ = หนึ่งรายการในคิว มีสถานะ/ผลของตัวเอง */
            <div className="space-y-1.5">
              <label htmlFor="followWhen0" className="ml-1 text-xs font-medium text-muted-foreground">
                ให้โทรเมื่อไหร่
              </label>
              <div className="space-y-2">
                {scheduledAts.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      id={`followWhen${i}`}
                      type="datetime-local"
                      value={v}
                      onChange={(e) => setScheduledAtAt(i, e.target.value)}
                      className="jarvis-soft-field min-h-[46px] flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeScheduledAt(i)}
                      disabled={scheduledAts.length <= 1}
                      title={scheduledAts.length <= 1 ? 'ต้องมีอย่างน้อย 1 รอบ' : 'เอารอบนี้ออก'}
                      aria-label={`เอารอบที่ ${i + 1} ออก`}
                      className={cn(
                        'inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border',
                        'border-white/70 bg-white/60 text-slate-600 hover:text-foreground',
                        'dark:border-white/15 dark:bg-white/10 dark:text-slate-300',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                      )}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addScheduledAt}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/70 bg-white/60 px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-foreground dark:border-white/15 dark:bg-white/10 dark:text-slate-300"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> เพิ่มรอบโทร
              </button>
              <p className="ml-1 text-[11px] text-muted-foreground">
                บางเรื่องต้องโทรมากกว่า 1 ครั้ง — ใส่ได้หลายรอบ ระบบจะสร้างเป็นรายการแยกให้รอบละ 1 รายการ
                (เวลาซ้ำกันจะถูกตัดออกอัตโนมัติ)
              </p>
            </div>
            )}
            </>
            ) : null}

            {formError ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {formError}
              </p>
            ) : null}

            {/* ปุ่มเดินขั้น — ปุ่มบันทึกโผล่เฉพาะขั้นสุดท้าย กันกดส่งตั้งแต่ยังไม่ตั้งเวลา */}
            <div className="flex flex-wrap gap-2">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    goToStep(prevFollowStep(step));
                  }}
                  className={cn(
                    'inline-flex min-h-[46px] items-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-medium',
                    TONE.neutral.outline,
                  )}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden /> ย้อนกลับ
                </button>
              ) : null}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="jarvis-pill-btn inline-flex min-h-[46px] items-center gap-1.5 px-6 py-2.5 text-sm"
                >
                  ถัดไป <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting}
                  className="jarvis-pill-btn inline-flex min-h-[46px] items-center gap-1.5 px-6 py-2.5 text-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <PhoneForwarded className="h-4 w-4" aria-hidden />
                  )}
                  {submitting ? 'กำลังบันทึก…' : 'บันทึก + ส่ง AI โทร'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                className={cn(
                  'inline-flex min-h-[46px] items-center rounded-full border px-5 py-2.5 text-sm font-medium',
                  TONE.neutral.outline,
                )}
              >
                ยกเลิก
              </button>
            </div>
          </form>
        ) : null}

        {/* ⚠️ ชิปกรอง "ทั้งหมด / รอโทร / กำลังโทร / โทรสำเร็จ / ไม่สำเร็จ" ถูกถอดออก
            (เจ้าของสั่ง 18 ส.ค. 2569 ให้เอาไปแทนด้วยแผง 3 รอบด้านบน)
            แผงใหม่ให้ข้อมูลมากกว่าเดิม: แยกตามรอบโทร + กดแล้วเห็นชื่อพร้อมรายละเอียด
            ทั้งที่ชิปเดิมบอกได้แค่ยอดรวมข้ามรอบ

            ⚠️ state `filter` ยังอยู่และยังกรองรายการข้างล่างตามเดิม — ตอนนี้ค้างที่
            'all' เสมอ · จะเอาชิปกลับมาก็แค่คืน block นี้ ไม่ต้องรื้ออย่างอื่น */}

        {error ? (
          <p className={cn('rounded-xl border px-3.5 py-2.5 text-xs font-medium', TONE.danger.soft, TONE.danger.value)}>
            {error}
          </p>
        ) : null}

        {/* รายการ */}
        {loading && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-500" aria-hidden />
            กำลังโหลดรายการ…
          </p>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-2xl border border-white/70 p-8 text-center text-muted-foreground">
            <PhoneForwarded className="mx-auto mb-2 h-8 w-8 text-blue-400/60" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              {items.length === 0 ? 'ยังไม่มีรายชื่อที่ต้องติดตาม' : 'ไม่มีรายการตามตัวกรองนี้'}
            </p>
            {items.length === 0 ? (
              <p className="mt-1 text-xs">กด “เพิ่มรายชื่อที่ต้องติดตาม” เพื่อให้ AI โทรตามให้</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((it) => (
              // แถบสีซ้าย 4px บอกสถานะทันทีแบบการ์ด Matching (mockup rev.3 ข้อ 08)
              <div
                key={it.id}
                className="glass-card relative overflow-hidden rounded-2xl border border-white/70 pl-4 pr-3.5 py-3 dark:border-slate-700/70"
              >
                <span
                  aria-hidden
                  className={cn('absolute left-0 top-0 bottom-0 w-1', FOLLOW_STATUS_BAR[it.call_status])}
                />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <NameAvatar name={it.recipient_name} />
                      <span className="font-bold text-foreground">{it.recipient_name}</span>
                      {it.next_action?.urgency === 'urgent' ? (
                        <span
                          title={it.next_action.reason || 'AI แนะนำให้โทรกลับหาคนนี้ด่วน'}
                          className="inline-flex items-center gap-0.5 rounded-full border border-red-300 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300"
                        >
                          📞 โทรกลับด่วน
                        </span>
                      ) : null}
                      <span className={FOLLOW_STATUS_CLASS[it.call_status]}>
                        {FOLLOW_STATUS_LABEL[it.call_status]}
                      </span>
                      {/* ปิดงานแล้ว (095) — ป้ายแยกจากสถานะการโทร เพราะคนละเรื่อง:
                          สถานะโทร = AI ไปถึงไหน · ป้ายนี้ = เจ้าหน้าที่สรุปว่าจบแบบไหน */}
                      {it.completed_at && it.outcome_code ? (
                        <span
                          title={it.outcome_note || undefined}
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            TONE.success.chip,
                          )}
                        >
                          ปิดงาน:{' '}
                          {FOLLOW_OUTCOME_LABEL[it.outcome_code as FollowOutcome] ?? it.outcome_code}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-foreground">{it.topic}</p>
                    {it.note ? <p className="text-xs text-muted-foreground">{it.note}</p> : null}
                    {/* หน่วยงาน + รหัสไซต์ (096) — ไม่ได้ระบุ = ไม่ขึ้นบรรทัดนี้ ห้ามขึ้นว่า "ไม่ระบุ" */}
                    {it.unit_name || it.site_code ? (
                      <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="font-medium text-foreground">{it.unit_name || '—'}</span>
                        {it.site_code ? (
                          <span className="font-mono">({it.site_code})</span>
                        ) : null}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      ให้โทร {formatWhen(it.scheduled_at)}
                      {/* เจ้าของข้อมูล = คนที่กรอกครั้งแรก (เจ้าของสั่ง 17 ส.ค. 2569)
                          คนแก้ทีหลังโชว์แยก ไม่ทับกัน */}
                      {it.created_by_name ? ` · เจ้าของข้อมูล ${it.created_by_name}` : ''}
                      {it.updated_by_name ? ` · แก้ล่าสุดโดย ${it.updated_by_name}` : ''}
                      {/* เบอร์ที่ AI บอกให้ผู้สมัครโทรกลับ — ต้องเห็นได้ในรายการ
                          ไม่งั้นเจ้าหน้าที่ตอบไม่ได้ว่าสายที่โทรเข้ามาบอกเบอร์ใครไป */}
                      {it.staff_phone ? ` · โทรกลับ ${it.staff_phone}` : ''}
                    </p>
                    {it.call_outcome || it.call_summary ? (
                      <p className="mt-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] text-slate-700">
                        ผลการโทร{it.call_outcome ? ` (${it.call_outcome})` : ''}
                        {it.call_summary ? `: ${it.call_summary}` : ''}
                        {it.called_at ? ` · ${formatWhen(it.called_at)}` : ''}
                      </p>
                    ) : null}
                    {it.next_action?.urgency === 'urgent' && it.next_action.reason ? (
                      <p className="mt-1 rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-1 text-[11px] font-medium text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                        AI แนะนำ: {it.next_action.reason}
                        {it.next_action.due_at ? ` · ภายใน ${formatWhen(it.next_action.due_at)}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={`tel:${it.recipient_phone}`}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-sky-200 bg-sky-50/70 px-3 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950"
                    >
                      <Phone className="h-3 w-3" aria-hidden />
                      {it.recipient_phone}
                    </a>
                    {/* ปิดงาน (095) — โผล่เมื่อยังไม่ปิดและยังไม่ถูกยกเลิก
                        ⚠️ ไม่ผูกกับ call_status: ตามจนจบด้วยตัวเองโดยที่ AI ยังไม่ได้โทร
                        ก็ต้องปิดได้ (ปุ่มยกเลิกข้างล่างผูกกับ pending เพราะมันไปแตะคิว) */}
                    {/* แก้ไข (096) — เฉพาะรายการที่ยังไม่ปิด/ยกเลิก (server กันอีกชั้น) */}
                    {!it.cancelled && !it.completed_at ? (
                      <button
                        type="button"
                        onClick={() => setEditing(it)}
                        title="แก้ไขรายการนี้"
                        className={cn(
                          'inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium',
                          TONE.neutral.outline,
                        )}
                      >
                        <Pencil className="h-3 w-3" aria-hidden />
                        แก้ไข
                      </button>
                    ) : null}
                    {!it.cancelled && !it.completed_at ? (
                      <FollowCompleteControls
                        busy={busyId === it.id}
                        onComplete={(outcome, note) => doComplete(it.id, outcome, note)}
                      />
                    ) : null}
                    {!it.cancelled && it.call_status === 'pending' && !it.completed_at ? (
                      cancellingId === it.id ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === it.id}
                            onClick={() => void doCancel(it.id)}
                            className="inline-flex min-h-[36px] items-center rounded-full bg-red-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {busyId === it.id ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancellingId(null)}
                            className={cn(
                              'inline-flex min-h-[36px] items-center rounded-full border px-3 py-1 text-[11px] font-medium',
                              TONE.neutral.outline,
                            )}
                          >
                            ไม่
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCancellingId(it.id)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/50"
                        >
                          <X className="h-3 w-3" aria-hidden />
                          ยกเลิก
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BoardPersonPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={pickPerson}
      />

      <BoardUnitPicker
        open={unitPickerOpen}
        onClose={() => setUnitPickerOpen(false)}
        jobs={openJobs}
        onPick={pickUnit}
      />

      <FollowEditDialog
        entry={editing}
        openJobs={openJobs}
        onClose={() => setEditing(null)}
        onSaved={(msg) => {
          setOkMessage(msg);
          window.setTimeout(() => setOkMessage(null), 7000);
          void reload();
        }}
      />
    </div>
  );
};

export default FollowPage;
