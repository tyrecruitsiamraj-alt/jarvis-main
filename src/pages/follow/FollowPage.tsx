import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import FollowCallRoundsPanel from '@/components/follow/FollowCallRoundsPanel';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { followScheduleCounts } from '@/lib/followSchedule';
import { conveyorLabel } from '@/lib/soRecruitNav';
import { Plus, X, LoaderCircle, RefreshCw, PhoneForwarded, Users, Building2, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import {
  listFollowEntries,
  createFollowEntry,
  cancelFollowEntry,
  completeFollowEntry,
  type FollowEntry,
  updateFollowEntry,
} from '@/lib/followApi';
import { summarizeDispatchResults } from '@/lib/followDispatchState';
import BoardPersonPicker from '@/components/follow/BoardPersonPicker';
import BoardUnitPicker from '@/components/follow/BoardUnitPicker';
import FollowCompletedPanel from '@/components/follow/FollowCompletedPanel';
import { splitPickerName, type BoardPickerPerson } from '@/lib/boardPickerApi';
import { buildBoardUnitOptions, mergeBoardUnitOptions, type BoardUnitOption } from '@/lib/boardUnitPicker';
import { findScheduleDuplicates, type DuplicateRound } from '@/lib/followDuplicateGuard';
import { groupFollowEntries } from '@/lib/followGrouping';
import {
  filterFollowEntries,
  countFollowTabs,
  listFollowOwners,
  FOLLOW_TABS,
  FOLLOW_TAB_LABEL,
  TIME_BAND_LABEL,
  type FollowTab,
  type TimeBand,
} from '@/lib/followListFilter';
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
import { fetchSiamrajUnitRequests, fetchAllUnitOptions } from '@/lib/siamrajUnitRequestsApi';
import type { JobRequest } from '@/types';
import FollowEditDialog from '@/components/follow/FollowEditDialog';
import RoundScriptNote from '@/components/follow/RoundScriptNote';
import StaffContactField from '@/components/follow/StaffContactField';
import TopicField from '@/components/follow/TopicField';
import FollowMasterManagerDialog from '@/components/follow/FollowMasterManagerDialog';
import FollowRoundsDialog from '@/components/follow/FollowRoundsDialog';
import FollowPlanningCalendar from '@/components/follow/FollowPlanningCalendar';
import { type FollowOutcome } from '@/lib/followOutcome';
import { buildFollowPlanningRows } from '@/lib/followPlanning';
import { followRoundSlot } from '@/lib/followRoundBuckets';
import { toYmdBangkok } from '@/lib/dateTh';
import { listFollowTopics, createFollowTopic, type FollowTopic } from '@/lib/followTopicsApi';
import {
  listStaffContacts,
  createStaffContact,
  type FollowStaffContact,
} from '@/lib/followStaffContactsApi';
import { useAuth } from '@/contexts/AuthContext';

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
  /**
   * แท็บสถานะ (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-6: แยกหน้า กำลังตาม/สำเร็จ/สิ้นสุด/ยกเลิก)
   * + filter ประจำวัน (วันที่/ช่วงเวลา/เจ้าของงาน) · ตรรกะที่ followListFilter.ts
   */
  const [tab, setTab] = useState<FollowTab>('active');
  const [filterOpen, setFilterOpen] = useState(false);
  const [fDate, setFDate] = useState('');
  const [fBand, setFBand] = useState<TimeBand>('');
  const [fOwner, setFOwner] = useState('');
  /** เดือนที่ปฏิทิน Planning กางอยู่ (YYYY-MM) — เริ่มที่เดือนนี้ตามปฏิทินไทย */
  const [calMonth, setCalMonth] = useState(() => toYmdBangkok(new Date()).slice(0, 7));
  /**
   * ช่องในปฏิทินที่กดเปิดอยู่ (คน + วัน) — null = ไม่ได้เปิด
   * เก็บเป็น **คีย์** ไม่ใช่ก้อนข้อมูล เพื่อให้ป๊อปอ่านของสดหลังโหลดใหม่เสมอ
   * (ปิดงาน/ยกเลิกแล้วป้ายในป๊อปต้องเปลี่ยนตาม ไม่ใช่ค้างของเก่า)
   */
  const [openCell, setOpenCell] = useState<{ key: string; ymd: string } | null>(null);
  /**
   * "การโทรครั้งที่" ที่แผงข้างบนเลือกอยู่ (เจ้าของสั่ง 1 ก.ย. 2569:
   * *"ถ้าเลือกการโทรครั้งที่ 1 ตารางปฏิทินก็โชว์ข้อมูลแค่ของครั้งที่ 1 สิ"*)
   * 🔴 นิยาม "อยู่รอบไหน" ใช้ `followRoundSlot` ตัวเดียวกับที่แผงนับ — ห้ามเขียนซ้ำ
   */
  const [activeRound, setActiveRound] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  /**
   * เบอร์เจ้าหน้าที่ผู้ติดตาม — AI พูดให้ผู้สมัครโทรกลับ (เจ้าของสั่ง 13 ส.ค. 2569)
   *
   * 18 ส.ค. 2569 (ค่ำ-2) เจ้าของสั่งให้ **ระบุได้ทีละวัน**:
   * *"ต้องอยู่หน้ากรอกวันที่เวลา เพื่อจะได้ระบุเจ้าของแผนแต่ละวันได้"*
   * → เก็บแยกตามรอบ/ตามวัน ไม่ใช่ค่าเดียวทั้งชุด
   *   · โหมดเวลาเอง: `staffPhones[i]` คู่กับ `scheduledAts[i]`
   *   · โหมดตาราง: `staffPhoneByDay['YYYY-MM-DD']`
   * ⚠️ ไม่ต้องแตะ schema — แถวจริงเป็น **1 แถว/วัน (หรือ 1 แถว/รอบ)** อยู่แล้ว
   *   แต่ละแถวจึงถือ `staff_phone` ของตัวเองได้เลย
   */
  const [staffPhones, setStaffPhones] = useState<string[]>(() => ['']);
  const [staffPhoneByDay, setStaffPhoneByDay] = useState<Record<string, string>>({});
  /** ให้โทรเมื่อไหร่ — หลายรอบได้ เพราะบางเคสต้องโทรมากกว่า 1 ครั้ง (เจ้าของสั่ง 10 ส.ค. 2569) */
  const [scheduledAts, setScheduledAts] = useState<string[]>(() => [nowForInput()]);
  /**
   * รอบนี้คือ **"สายที่เท่าไหร่"** (เจ้าของสั่ง 1 ก.ย. 2569:
   * *"เลือกวันเวลาเสร็จของรอบแรก ก็มี Dropdown ให้เลือกเลยว่านี่คือ สาย 1 2 3"*)
   *
   * 🔴 **อาร์เรย์นี้ต้องขยับคู่กับ `scheduledAts` เสมอ** (กับดักเดียวกับอาร์เรย์เบอร์)
   * หลุดคู่เมื่อไหร่ = รอบที่ 2 ไปใช้บทของรอบที่ 3 โดยไม่มีอะไรบนจอบอก
   * ค่านี้ถูกส่งขึ้นไปจริง (`call_round`) และเป็นตัวตัดสินว่า AI พูดบทไหน
   */
  const [callRounds, setCallRounds] = useState<number[]>(() => [1]);
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
  /**
   * bump เมื่อ dialog จัดการ (ข้างไอคอนปฏิทิน) เพิ่มค่าใหม่ — dropdown ที่ mount อยู่
   * โหลดลิสต์ใหม่ทันที ไม่ต้องรีเฟรชหน้า (เรื่อง กับ เจ้าหน้าที่ แยกตัวนับกัน)
   */
  const [topicsRev, setTopicsRev] = useState(0);
  const [contactsRev, setContactsRev] = useState(0);
  /** dialog จัดการเรื่อง / เจ้าหน้าที่ — เปิดจากปุ่มข้างปฏิทิน (supervisor+ เท่านั้น) */
  const [topicManagerOpen, setTopicManagerOpen] = useState(false);
  const [staffManagerOpen, setStaffManagerOpen] = useState(false);
  const { user } = useAuth();
  /** เพิ่มเรื่อง/เจ้าหน้าที่ได้เฉพาะ supervisor ขึ้นไป (เจ้าของสั่ง ค่ำ-5) */
  const canManageMasters = user?.role === 'supervisor' || user?.role === 'admin';
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
  /** ข้อความยืนยันการย้ายไปดูแลหลังเริ่มงาน (Phase 7.2) — แยกจาก pickedFrom ของฟอร์ม */
  const [aftercareNotice, setAftercareNotice] = useState<string | null>(null);
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
  /**
   * popup เตือนลงซ้ำ (เจ้าของสั่ง 18 ส.ค. 2569) — เก็บทั้งกองซ้ำและกองที่ไม่ซ้ำ
   * `null` = ไม่มีเตือนค้าง · ตรรกะเทียบอยู่ที่ `followDuplicateGuard.ts` (pure + เทสต์)
   */
  const [dupWarning, setDupWarning] = useState<{
    duplicates: DuplicateRound[];
    freshIso: string[];
    /** โหมดตาราง: ยิงตามชุดวันเดิม · โหมดเวลา: ยิงตาม freshIso */
    proceed: () => Promise<void>;
  } | null>(null);

  /**
   * หน่วยงานทั้งชุดตั้งแต่ปี 2567 (~1,054) — เจ้าของแจ้ง 18 ส.ค. 2569 ว่ากล่องเลือก
   * "ขึ้นไม่ครบ" เพราะเดิมยุบจากใบขอที่ยังเปิดเท่านั้น (152)
   * โหลดพัง = [] แล้ว merge จะเหลือชุดใบขอเปิดเหมือนเดิม (ห้ามบล็อกงาน)
   */
  const [allUnits, setAllUnits] = useState<BoardUnitOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetchAllUnitOptions()
      .then((v) => {
        if (!cancelled) setAllUnits(v);
      })
      .catch(() => {
        if (!cancelled) setAllUnits([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    // หน่วยงานที่เลือกไว้แล้วตอนตั้งขั้น (Phase 6.6/6.9) — เติมให้ ไม่ต้องเลือกซ้ำ
    // ⚠️ เติมแค่ชื่อ · รหัสไซต์ให้คนยืนยันจาก picker เอง (ชื่ออาจซ้ำข้ามไซต์)
    if (prefill.unitName) setUnitName(prefill.unitName);
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
    setStaffPhones(['']);
    setStaffPhoneByDay({});
    setPickedFrom(null);
    setScheduledAts([nowForInput()]);
    setCallRounds([1]);
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
  /**
   * เพิ่ม/ลบรอบต้องขยับ **อาร์เรย์เบอร์ให้คู่กันเสมอ** — หลุดคู่เมื่อไหร่ เบอร์เลื่อนไปอยู่ผิดรอบ
   * (รอบที่ 2 ได้เบอร์ของรอบที่ 3) ซึ่งไม่มีอะไรบนจอบอก จนกว่าสายจะออกไปแล้ว
   * รอบใหม่ลอกเบอร์ของรอบสุดท้ายมาเป็นค่าตั้งต้น — ปกติทั้งชุดเป็นเจ้าของคนเดียวกัน
   */
  const addScheduledAt = () => {
    setScheduledAts((prev) => [...prev, nowForInput()]);
    setStaffPhones((prev) => [...prev, prev[prev.length - 1] ?? '']);
    // รอบใหม่เดาให้ว่าเป็นสายถัดไป — เปลี่ยนเองได้จาก dropdown
    setCallRounds((prev) => [...prev, (prev[prev.length - 1] ?? prev.length) + 1]);
  };
  const removeScheduledAt = (i: number) => {
    setScheduledAts((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
    setStaffPhones((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
    setCallRounds((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  };
  const setCallRoundAt = (i: number, v: number) =>
    setCallRounds((prev) => {
      const next = prev.length >= i + 1 ? [...prev] : [...prev, ...Array(i + 1 - prev.length).fill(1)];
      next[i] = v;
      return next;
    });
  const setStaffPhoneAt = (i: number, v: string) =>
    setStaffPhones((prev) => {
      const next = prev.length >= i + 1 ? [...prev] : [...prev, ...Array(i + 1 - prev.length).fill('')];
      next[i] = v;
      return next;
    });

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
      const dayIsos = days.map((day) => new Date(`${day}T${rounds[0]}:00+07:00`).toISOString());
      const dupCheck = findScheduleDuplicates(phone, dayIsos, items);
      const runSchedule = async (sendDays: string[]) => {
        setSubmitting(true);
        let done = 0;
        // เก็บผล "ส่งให้ AI ได้ไหม" ของทุกรายการ แล้วสรุปทีเดียวตอนจบ
        const dispatchStates: Array<string | null> = [];
        try {
          for (const day of sendDays) {
            const createdEntry = await createFollowEntry({
              recipient_name: recipientName,
              recipient_phone: phone,
              topic,
              note: note || undefined,
              // เบอร์ของ **วันนั้น** — เจ้าของแผนคนละคนกันได้ในชุดเดียว
              staff_phone: (staffPhoneByDay[day] || '').trim() || undefined,
              scheduled_at: new Date(`${day}T${rounds[0]}:00+07:00`).toISOString(),
              group_id: groupId,
              call_times: rounds,
              unit_name: unitName.trim() || undefined,
              site_code: siteCode.trim() || undefined,
            });
            dispatchStates.push(createdEntry.dispatch_state ?? null);
            done += 1;
          }
          resetForm();
          setFormOpen(false);
          /* 🔴 บอกทันทีถ้ามีรายการที่ "ไม่ได้ส่งให้ AI" — เดิมขึ้นว่าสำเร็จอย่างเดียว
             คนนั่งรอสายที่ไม่มีวันออก (เกิดจริง 24 ส.ค. 2569) */
          const warn = summarizeDispatchResults(dispatchStates);
          const okText = `ตั้งตารางโทรแล้ว — ${sendDays.length} วัน วันละ ${rounds.length} รอบ (รวม ${sendDays.length * rounds.length} สาย)`;
          if (warn) {
            setFormError(`${okText}\n${warn.text}`);
          } else {
            setOkMessage(okText);
            window.setTimeout(() => setOkMessage(null), 6000);
          }
          await reload();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'ตั้งตารางไม่สำเร็จ';
          setFormError(done > 0 ? `${msg} — ตั้งไปแล้ว ${done} จาก ${sendDays.length} วัน อย่ากดซ้ำทั้งชุด` : msg);
          if (done > 0) await reload();
        } finally {
          setSubmitting(false);
        }
      };
      if (dupCheck.duplicates.length > 0) {
        // วันที่ไม่ซ้ำ = วันที่รอบแรกของวันนั้นอยู่ในกอง fresh
        const freshSet = new Set(dupCheck.freshIso);
        const freshDays = days.filter((day, i) => freshSet.has(dupCheck.freshIso.find((x) => x === dayIsos[i]) ?? ''));
        setDupWarning({
          duplicates: dupCheck.duplicates,
          freshIso: dupCheck.freshIso,
          proceed: () => runSchedule(freshDays),
        });
        return;
      }
      await runSchedule(days);
      return;
    }

    // เรียงเวลาจากก่อนไปหลัง + ตัดเวลาซ้ำทิ้ง (กดเพิ่มแล้วลืมแก้ = ได้สองสายเวลาเดียวกัน)
    const times = [...new Set(scheduledAts.filter(Boolean))].sort();
    if (times.length === 0) {
      setFormError('กรุณาระบุเวลาที่ให้โทรอย่างน้อย 1 รอบ');
      return;
    }

    /**
     * 🔴 เตือนลงซ้ำก่อนยิง (เจ้าของสั่ง 18 ส.ค. 2569: *"นายคนนี้ลงวันเวลาเดิม
     * ก็เด้งเตือนเลยว่าซ้ำ"*) — เบอร์เดิม+เวลาเดิม (ระดับนาที) กับรายการที่ยังไม่ยกเลิก
     */
    const isoTimes = times.map((t) => new Date(t).toISOString());
    /**
     * 🔴 แมป **เวลา → เบอร์** ก่อนใช้ — `times` ถูก dedup + sort แล้ว index จึง**ไม่ตรง**
     * กับ `scheduledAts`/`staffPhones` อีก ใช้ index ตรง ๆ = เบอร์ไปโผล่ผิดรอบเงียบ ๆ
     * เวลาซ้ำกันเก็บเบอร์ของช่องแรกที่เจอ (ช่องที่ซ้ำถูกตัดทิ้งอยู่แล้ว)
     */
    const phoneByLocal = new Map<string, string>();
    scheduledAts.forEach((v, i) => {
      if (v && !phoneByLocal.has(v)) phoneByLocal.set(v, (staffPhones[i] || '').trim());
    });
    const phoneByIso = new Map<string, string>();
    times.forEach((t, i) => phoneByIso.set(isoTimes[i], phoneByLocal.get(t) ?? ''));
    /**
     * 🔴 แมป **เวลา → สายที่เท่าไหร่** ด้วยวิธีเดียวกับเบอร์ — ห้ามใช้ index ของ `times`
     * เพราะถูก dedup + sort มาแล้ว (ใช้ index ตรง ๆ = บทไปโผล่ผิดรอบเงียบ ๆ)
     */
    const roundByLocal = new Map<string, number>();
    scheduledAts.forEach((v, i) => {
      if (v && !roundByLocal.has(v)) roundByLocal.set(v, callRounds[i] ?? i + 1);
    });
    const roundByIso = new Map<string, number>();
    times.forEach((t, i) => roundByIso.set(isoTimes[i], roundByLocal.get(t) ?? 1));
    const dupCheck = findScheduleDuplicates(phone, isoTimes, items);
    const runTimes = async (sendIso: string[]) => {
      setSubmitting(true);
      let done = 0;
      const dispatchStates: Array<string | null> = [];
      try {
        for (const t of sendIso) {
          const createdEntry = await createFollowEntry({
            recipient_name: recipientName,
            recipient_phone: phone,
            topic,
            note: note || undefined,
            staff_phone: phoneByIso.get(t) || undefined,
            scheduled_at: t,
            call_round: roundByIso.get(t) ?? 1,
            unit_name: unitName.trim() || undefined,
            site_code: siteCode.trim() || undefined,
          });
          dispatchStates.push(createdEntry.dispatch_state ?? null);
          done += 1;
        }
        resetForm();
        setFormOpen(false);
        const warn = summarizeDispatchResults(dispatchStates);
        const okText =
          sendIso.length > 1 ? `เพิ่มรายชื่อแล้ว — ตั้งให้โทร ${sendIso.length} รอบ` : 'เพิ่มรายชื่อแล้ว';
        if (warn) {
          setFormError(`${okText}\n${warn.text}`);
        } else {
          setOkMessage(okText);
          window.setTimeout(() => setOkMessage(null), 5000);
        }
        await reload();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'เพิ่มรายชื่อไม่สำเร็จ';
        setFormError(
          done > 0
            ? `${msg} — แต่บันทึกไปแล้ว ${done} จาก ${sendIso.length} รอบ กรุณาเพิ่มเฉพาะรอบที่ยังขาด อย่ากดซ้ำทั้งชุด`
            : msg,
        );
        if (done > 0) await reload();
      } finally {
        setSubmitting(false);
      }
    };
    if (dupCheck.duplicates.length > 0) {
      setDupWarning({
        duplicates: dupCheck.duplicates,
        freshIso: dupCheck.freshIso,
        proceed: () => runTimes(dupCheck.freshIso),
      });
      return;
    }
    await runTimes(isoTimes);
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

  /** ตัวเลือกหน่วยงานที่กล่อง picker ใช้ — ละเอียดจากใบขอเปิด + ครบจากชุดทั้งหมด */
  const unitOptions = useMemo(
    () => mergeBoardUnitOptions(buildBoardUnitOptions(openJobs), allUnits),
    [openJobs, allUnits],
  );

  const filtered = useMemo(
    () => filterFollowEntries(items, { tab, date: fDate, band: fBand, owner: fOwner }),
    [items, tab, fDate, fBand, fOwner],
  );
  const tabCounts = useMemo(() => countFollowTabs(items), [items]);
  const owners = useMemo(() => listFollowOwners(items), [items]);
  const hasActiveFilter = Boolean(fDate || fBand || fOwner);

  /**
   * การ์ดเดียวต่อคน (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ: คนเดียวหลายรอบแตกหลายแถว "งงตาย")
   * จับกลุ่มเบอร์+เรื่อง — ตรรกะอยู่ที่ `followGrouping.ts` (pure + เทสต์) ที่เดียว
   */
  const groups = useMemo(() => groupFollowEntries(filtered), [filtered]);

  /**
   * ═══ แถวของตาราง Planning (F3 · เจ้าของสั่ง 1 ก.ย. 2569) ═══
   * **มาแทนรายการการ์ดเดิม** — หนึ่งแถวหนึ่งคน · ติดตามวันไหน · กี่รอบ · เวลาไหน · ไปถึงไหน
   *
   * 🔴 **เรียงก่อนแบ่งหน้าเสมอ** — "คนที่ต้องโทรก่อนอยู่บนสุด" จะจริงก็ต่อเมื่อเรียงทั้งชุด
   * ถ้าไปเรียงในตาราง (หลังแบ่งหน้า) ลำดับจะถูกแค่ภายในหน้านั้น หน้า 2 มีของด่วนกว่าซ่อนอยู่
   */
  const planningRowsAllRounds = useMemo(() => buildFollowPlanningRows(groups), [groups]);

  /**
   * ปฏิทินโชว์เฉพาะคนที่อยู่ใน "การโทรครั้งที่" ที่เลือกไว้ข้างบน
   * ⚠️ กรองระดับ **คน** ไม่ใช่ระดับรอบ — แผงข้างบนก็นับคนแบบนี้ (คนหนึ่งอยู่ครั้งเดียว)
   * กรองระดับรอบเมื่อไหร่ เลขบนกล่องกับจำนวนแถวจะไม่ตรงกันทันที
   */
  const planningRows = useMemo(
    () =>
      planningRowsAllRounds.filter((r) =>
        r.rounds.some((x) => followRoundSlot(x.entry) === activeRound),
      ),
    [planningRowsAllRounds, activeRound],
  );

  /**
   * 🔴 **ชุดเต็มไม่ผ่านตัวกรองใด ๆ** — ใช้เฉพาะกับป๊อปรายละเอียด
   *
   * เจ้าของทัก 1 ก.ย. 2569: *"ทำไมขึ้นว่าเสร็จสิ้น เพราะในระบบ Lumos บอกยกเลิก
   * งี้จะเชื่อนายได้ไง"* — เคสจริงคือคนนั้นมี **3 สายในวันเดียว** (11:00 ที่ถูกยกเลิก ·
   * 11:00 ที่คุยจบ · 11:15) แต่แท็บ "กำลังตาม" กรองสายที่ยกเลิกออก ⇒ จอเราโชว์ 2
   * ส่วน Lumos โชว์ 3 · **ป๊อปคือที่ที่คนมาถามว่า "ตกลงเกิดอะไรขึ้น"** จึงต้องเล่าครบเสมอ
   * (ปฏิทิน/เลขบนแท็บยังเคารพตัวกรองเหมือนเดิม ไม่งั้นเลขกับจอจะเถียงกันเอง)
   */
  const allRows = useMemo(
    () => buildFollowPlanningRows(groupFollowEntries(items)),
    [items],
  );

  /**
   * รายละเอียดของช่องที่กดในปฏิทิน — **อ่านจากชุดเต็ม**
   * ไม่เจอแล้ว (ถูกลบ) = ส่ง null ให้ป๊อปว่างแทนที่จะค้างข้อมูลเก่า
   */
  const cellDetail = useMemo(() => {
    if (!openCell) return null;
    const row = allRows.find((r) => r.group.key === openCell.key);
    if (!row) return null;
    return {
      group: row.group,
      ymd: openCell.ymd,
      /* 🔴 รวมรอบที่ยกเลิกด้วย — Lumos โชว์ว่ายกเลิก จอเราต้องโชว์ด้วย ไม่งั้นสองระบบเล่าคนละเรื่อง */
      rounds: row.rounds.filter((r) => r.ymd === openCell.ymd),
    };
  }, [openCell, allRows]);


  /** เลือกวันจากปฏิทิน = ใช้ช่องกรองวันเดิม (`fDate`) — ห้ามมีตัวกรองวันสองตัวในหน้าเดียว */
  const pickCalendarDay = (ymd: string) => {
    setFDate(ymd);
    setCalMonth(ymd ? ymd.slice(0, 7) : calMonth);
  };

  const counts = useMemo(() => {
    // 🔴 นับเฉพาะที่อยู่ในคิวจริง — เดิม API เดา 'pending' ให้แถวที่ไม่เคยส่ง ตัวเลขจึงเกินจริง
    const pending = items.filter((i) => i.call_status === 'pending').length;
    const notSent = items.filter((i) => !i.call_status && !i.cancelled).length;
    const done = items.filter((i) => i.call_status === 'completed').length;
    return { total: items.length, pending, done, notSent };
  }, [items]);

  /**
   * 🔴 ถังตามเวลานัด — **นิยามเดียวกับหน้าแรก** (`followScheduleCounts`)
   * หน้าแรกส่งคนมาที่นี่ด้วยพาดหัว "เลยเวลานัดแล้ว N ราย" แต่เดิมหน้านี้ไม่มีเลขนั้น
   * อยู่เลย ⇒ คนกดมาแล้วหาไม่เจอว่าต้องโทรใคร (audit คนใหม่ 26 ส.ค. 2569)
   */
  const schedule = useMemo(() => followScheduleCounts(items), [items]);

  return (
    <div className="relative">
      <PageHeader
        /* 🔴 ชื่อหัวหน้าต้อง = ชื่อเมนู เสมอ — เดิมเป็น "Follow" */
        title={conveyorLabel('follow')}
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
        {/* ปุ่ม "เพิ่มเรื่อง / เพิ่มเจ้าหน้าที่" อยู่ข้างไอคอนปฏิทิน (เจ้าของสั่ง 18 ส.ค.
            2569 ค่ำ-5 — แทนกล่อง TopicManager ของค่ำ-4 ที่ถูกถอดออก) · โผล่เฉพาะ
            supervisor+ เท่านั้น server กันอีกชั้นที่ rbac ไม่ใช่แค่ซ่อนปุ่ม */}
        <FollowCallRoundsPanel
          /* 🔴 ส่งรายการก้อนเดียวกับที่หน้านี้ใช้ — แผงนี้ห้ามโหลดเอง
             (เดิมโหลดแยก ⇒ จอเดียวมี "ทั้งหมด" สามค่าที่ไม่ตรงกัน) */
          entries={items}
          loading={loading}
          onReload={() => void reload()}
          onRoundChange={setActiveRound}
          /* 🔴 ปุ่ม "เพิ่มคนที่ต้องการติดตาม" ย้ายมาอยู่แถวเดียวกับ "เพิ่มเจ้าหน้าที่"
             (เจ้าของสั่ง 1 ก.ย. 2569) · ปุ่มนี้ **ทุกคนกดได้** ต่างจากอีกสองปุ่มที่เป็น
             supervisor+ จึงอยู่นอกเงื่อนไข canManageMasters */
          headerExtras={
            <>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(true);
                  setFormError(null);
                }}
                className="jarvis-pill-btn inline-flex h-8 items-center gap-1 px-3 text-[11px] touch-manipulation"
              >
                <Plus className="h-3 w-3" aria-hidden /> เพิ่มคนที่ต้องการติดตาม
              </button>
              {canManageMasters ? (
              <>
                <button
                  type="button"
                  onClick={() => setTopicManagerOpen(true)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[11px] font-semibold',
                    TONE.info.outline,
                  )}
                >
                  <Plus className="h-3 w-3" aria-hidden /> เพิ่มเรื่อง
                </button>
                <button
                  type="button"
                  onClick={() => setStaffManagerOpen(true)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[11px] font-semibold',
                    TONE.info.outline,
                  )}
                >
                  <Plus className="h-3 w-3" aria-hidden /> เพิ่มเจ้าหน้าที่
                </button>
              </>
              ) : null}
            </>
          }
        />

        {/* ═══ ปฏิทิน Planning (เจ้าของสั่ง 1 ก.ย. 2569 ข้อ 1.1 + ข้อ 3 ของ concept) ═══
            *"เปิดมาปุ๊บ เจอ 3 หลัก ๆ: ปฏิทิน · ปุ่มเพิ่มคน · Planning"* — เรียงตามนั้นเลย
            🔴 ช่องวันต้องมีชื่อคนอยู่ในนั้นจริง ๆ ไม่ใช่แค่จำนวนสาย (เจ้าของทักเอง) */}
        <FollowPlanningCalendar
          rows={planningRows}
          month={calMonth}
          onMonthChange={setCalMonth}
          selectedYmd={fDate}
          onSelect={pickCalendarDay}
          onOpenCell={(row, ymd) => setOpenCell({ key: row.group.key, ymd })}
          activeRound={activeRound}
        />

        {/* สรุปยอด + รีเฟรช (ปุ่มเพิ่มคนย้ายขึ้นไปอยู่กับ "เพิ่มเจ้าหน้าที่" แล้ว) */}
        <div className="flex flex-wrap items-center gap-2.5">
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
          {/* 🔴 แถบเวลานัด — เลขชุดเดียวกับที่หน้าแรกใช้พาดหัวส่งคนมาที่นี่
              ต้องมาก่อนยอดรวมสถานะสาย เพราะนี่คือ "ต้องโทรใครตอนนี้" ส่วนข้างล่างคือ
              "สายไปถึงไหนแล้ว" — คนละคำถาม เดิมมีแต่อย่างหลังจึงหาของด่วนไม่เจอ */}
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground/70">ต้องโทรใครตอนนี้ · </span>
            <span title="คนที่ตั้งเวลาโทรไว้ในวันนี้ (ยังไม่ถึงเวลาก็นับ)">
              นัดวันนี้{' '}
              <span className="font-bold tabular-nums text-foreground">{schedule.today}</span>
            </span>
            {' · '}
            <span
              title="เลยเวลาที่นัดจะโทรแล้วยังไม่มีผลกลับ — มีคนรอสายอยู่จริง (เลขเดียวกับที่หน้าแรกพาดหัว)"
              className={schedule.pastDue > 0 ? 'text-red-700 dark:text-red-300' : undefined}
            >
              เลยเวลานัดแล้ว{' '}
              <span className="font-bold tabular-nums">{schedule.pastDue}</span>
            </span>
            {' · '}
            <span title="คนที่ตั้งเวลาโทรไว้เป็นวันถัดไป ยังไม่ถึงคิววันนี้">
              นัดล่วงหน้า{' '}
              <span className="font-bold tabular-nums text-foreground">{schedule.upcoming}</span>
            </span>
          </p>
          {/* 🔴 บอกให้ชัดว่ายอดชุดนี้นับอะไร — บนจอเดียวมีสามชุดที่ตอบคนละคำถาม
              (แถบเวลานัด = ต้องโทรใครตอนนี้ · ชุดนี้ = สายไปถึงไหน · แท็บ = งานจบยัง)
              เดิมทั้งสามชุดขึ้นคำว่า "ทั้งหมด" เฉย ๆ แล้วเลขไม่ตรงกัน คนใหม่เลยไม่รู้ว่าอันไหนจริง */}
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground/70">สถานะสาย · </span>
            ทั้งหมด <span className="font-bold tabular-nums text-foreground">{counts.total}</span> · รอโทร{' '}
            <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{counts.pending}</span> · สำเร็จ{' '}
            <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{counts.done}</span>
            {/* 🔴 ของค้างที่ไม่มีใครจะโทร — โชว์เฉพาะเมื่อมีจริง (กติกา: ห้ามป้ายที่ขึ้น 0 ทุกวัน) */}
            {counts.notSent > 0 ? (
              <>
                {' '}·{' '}
                <span
                  title="รายการที่ยังไม่ได้ส่งให้ AI โทร — ดูเหตุผลที่ป้ายในแต่ละรายการ"
                  className="font-bold tabular-nums text-amber-700 dark:text-amber-300"
                >
                  ไม่ได้ส่งให้ AI {counts.notSent}
                </span>
              </>
            ) : null}
          </p>
        </div>

        {/* แท็บสถานะ + ปุ่ม Filter (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-6) — แยกหน้าตามสถานะ
            เพื่อดูง่าย · ปุ่ม Filter เช็คสถานะประจำวัน (วันที่/ช่วงเวลา/เจ้าของงาน) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ยอดชุดที่สาม = "งานจบหรือยัง" — ติดป้ายกำกับเหมือนอีกสองชุด
              ทั้งสามชุดนับจากรายการก้อนเดียวกันแล้ว ต่างกันแค่คำถามที่ตอบ */}
          <span className="text-xs text-foreground/70">งานจบหรือยัง ·</span>
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-border p-0.5 text-xs">
            {FOLLOW_TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                }}
                aria-pressed={tab === t}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors',
                  tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary',
                )}
              >
                {FOLLOW_TAB_LABEL[t]}
                <span
                  className={cn(
                    'tabular-nums',
                    tab === t ? 'text-primary-foreground/80' : 'text-muted-foreground/70',
                  )}
                >
                  {tabCounts[t].toLocaleString('th-TH')}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
            className={cn(
              'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
              hasActiveFilter ? cn(TONE.info.soft, TONE.info.value, 'border-transparent') : TONE.neutral.outline,
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            ตัวกรอง
            {hasActiveFilter ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
          </button>
          {hasActiveFilter ? (
            <button
              type="button"
              onClick={() => {
                setFDate('');
                setFBand('');
                setFOwner('');
              }}
              className="text-[11px] font-medium text-primary underline"
            >
              ล้างตัวกรอง
            </button>
          ) : null}
        </div>

        {/* แผงตัวกรองประจำวัน — วันที่ / ช่วงเวลา / เจ้าของงาน (พับได้) */}
        {filterOpen ? (
          <div className={cn('grid gap-3 rounded-xl border p-3 sm:grid-cols-3', TONE.neutral.soft)}>
            <div className="space-y-1">
              <label htmlFor="fDate" className="ml-1 text-[11px] font-medium text-muted-foreground">
                วันที่
              </label>
              <input
                id="fDate"
                type="date"
                value={fDate}
                onChange={(e) => {
                  setFDate(e.target.value);
                }}
                className="jarvis-soft-field min-h-[40px] w-full"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="fBand" className="ml-1 text-[11px] font-medium text-muted-foreground">
                ช่วงเวลา
              </label>
              <select
                id="fBand"
                value={fBand}
                onChange={(e) => {
                  setFBand(e.target.value as TimeBand);
                }}
                className="jarvis-soft-field min-h-[40px] w-full"
              >
                <option value="">ทุกช่วง</option>
                <option value="morning">{TIME_BAND_LABEL.morning}</option>
                <option value="afternoon">{TIME_BAND_LABEL.afternoon}</option>
                <option value="evening">{TIME_BAND_LABEL.evening}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="fOwner" className="ml-1 text-[11px] font-medium text-muted-foreground">
                เจ้าของงาน (คนคีย์)
              </label>
              <select
                id="fOwner"
                value={fOwner}
                onChange={(e) => {
                  setFOwner(e.target.value);
                }}
                className="jarvis-soft-field min-h-[40px] w-full"
              >
                <option value="">ทุกคน</option>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {okMessage ? (
          <p className={cn('rounded-xl border px-3.5 py-2.5 text-xs font-medium', TONE.success.soft, TONE.success.value)}>
            {okMessage}
          </p>
        ) : null}

        {/**
          * ═══ ฟอร์มเพิ่มคน = **ป๊อป** (เจ้าของสั่ง 1 ก.ย. 2569) ═══
          * > *"ปุ่ม เพิ่มคนที่ต้องการติดตาม เมื่อกดไปแล้ว เด้ง Popup ขึ้นมา
          * >  แล้วพาทำทีละขั้นตอน"*
          *
          * 🔴 **ยกเนื้อฟอร์มเดิมเข้ามาทั้งดุ้น ไม่เขียนใหม่** — ฟอร์มนี้มีกติกาที่แลกมา
          * ด้วยบั๊กหลายรอบ (อาร์เรย์เบอร์ต้องขยับคู่กับรอบเสมอ · ส่งเฉพาะวันที่ติ๊ก
          * ไม่ใช่ทั้งช่วง · กันเวลาซ้ำในวันเดียว · ฟอร์มไม่รับ submit เลย)
          * เขียนใหม่เมื่อไหร่คือรื้อกับดักพวกนี้ออกหมด
          *
          * ⚠️ ปิดป๊อปด้วยการกดนอกกล่อง/Esc = **ไม่ล้างของที่กรอกค้างไว้** ตั้งใจให้เปิดกลับมา
          * ทำต่อได้ (ฟอร์มสามขั้นกรอกยาว หลุดแล้วต้องเริ่มใหม่คือเจ็บ) · ล้างตอนบันทึกสำเร็จเท่านั้น
          */}
        <Dialog open={formOpen} onOpenChange={(o) => (o ? undefined : setFormOpen(false))}>
          <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto p-0">
            <DialogHeader className="px-4 pt-4 sm:px-5">
              <DialogTitle>เพิ่มคนที่ต้องการติดตาม</DialogTitle>
              <DialogDescription>ทำทีละขั้น — ใครก่อน แล้วหน่วยงาน แล้วค่อยตั้งวันเวลาที่จะโทร</DialogDescription>
            </DialogHeader>
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
            {/* เรื่องที่จะให้โทรติดตาม (100 · เจ้าของสั่ง 18 ส.ค. 2569) — dropdown จากลิสต์กลาง
                ที่ supervisor เพิ่มเองได้ · ยังพิมพ์เรื่องใหม่เองได้ถ้าไม่มีในลิสต์ */}
            <TopicField id="followTopic" value={topic} onChange={setTopic} reloadSignal={topicsRev} />
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

            {/* 🔴 ช่องเบอร์เจ้าหน้าที่ **ย้ายไปขั้น 3 (หน้าตั้งวันเวลา)** แล้ว
                เจ้าของสั่ง 18 ส.ค. 2569 (ค่ำ-2): *"เบอร์โทร จนท ที่ติดตาม ต้องอยู่หน้ากรอก
                วันที่เวลา เพื่อจะได้ระบุเจ้าของแผนแต่ละวันได้"* — หนึ่งวันมีเจ้าของคนละคนได้ */}

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

                      {/* เบอร์เจ้าหน้าที่ **ใต้วันที่ที่ติดตาม** (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-2)
                          โชว์เฉพาะวันที่ติ๊กไว้ — วันที่ไม่ส่งไม่มีเจ้าของแผน จะโชว์ก็รกเปล่า ๆ
                          ⚠️ ช่องนี้แชร์ลิสต์กันผ่านแคชระดับโมดูล (ไม่ยิงเส้นตัวละครั้ง) */}
                      {all.filter((d) => !skippedDays.has(d)).length > 0 ? (
                        <div className="mt-1.5 space-y-2">
                          <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                            เจ้าของแผนแต่ละวัน
                          </span>
                          {all
                            .filter((d) => !skippedDays.has(d))
                            .map((d) => (
                              <div
                                key={d}
                                className="rounded-xl border border-white/70 bg-white/40 p-2.5 dark:border-white/15 dark:bg-white/5"
                              >
                                <StaffContactField
                                  id={`followStaffPhoneDay${d}`}
                                  label={`เจ้าหน้าที่ที่ติดตาม · ${dayLabel(d)}`}
                                  value={staffPhoneByDay[d] ?? ''}
                                  onChange={(next) =>
                                    setStaffPhoneByDay((prev) => ({ ...prev, [d]: next }))
                                  }
                                  reloadSignal={contactsRev}
                                />
                              </div>
                            ))}
                        </div>
                      ) : null}
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
              {/* หนึ่งรอบ = วันเวลา + **เบอร์เจ้าหน้าที่ของรอบนั้น** (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-2)
                  เบอร์อยู่ใต้วันที่เลย เพื่อระบุเจ้าของแผนของรอบนั้นได้ */}
              <div className="space-y-2.5">
                {scheduledAts.map((v, i) => (
                  <div
                    key={i}
                    className="space-y-1.5 rounded-xl border border-white/70 bg-white/40 p-2.5 dark:border-white/15 dark:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
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
                    <StaffContactField
                      id={`followStaffPhone${i}`}
                      label={`เจ้าหน้าที่ที่ติดตามรอบที่ ${i + 1}`}
                      value={staffPhones[i] ?? ''}
                      onChange={(next) => setStaffPhoneAt(i, next)}
                      reloadSignal={contactsRev}
                    />
                    {/* ═══ นี่คือสายที่เท่าไหร่ (เจ้าของสั่ง 1 ก.ย. 2569) ═══
                        *"เลือกวันเวลาเสร็จของรอบแรก ก็มี Dropdown ให้เลือกเลยว่านี่คือ สาย 1 2 3
                         แล้วพอเพิ่มรอบก็เหมือนกัน พอเลือกแล้วบอกหน่อยว่า Scrip นั้น ๆ จะพูดอะไรบ้าง"*
                        🔴 ค่านี้ **ส่งขึ้นไปจริง** และเป็นตัวตัดสินว่า AI พูดบทไหน
                        (ก่อนหน้านี้ทุกรอบพูดบทสายแรกหมด ทั้งที่จอเขียนว่ารอบ 2 ใช้อีกบท) */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`followCallRound${i}`}
                        className="ml-1 text-xs font-medium text-muted-foreground"
                      >
                        รอบนี้คือสายที่เท่าไหร่
                      </label>
                      <select
                        id={`followCallRound${i}`}
                        value={callRounds[i] ?? i + 1}
                        onChange={(e) => setCallRoundAt(i, Number(e.target.value))}
                        className="jarvis-soft-field min-h-[46px] w-full"
                      >
                        {Array.from(
                          /* อย่างน้อย 3 ตัวเลือกเสมอ · ตั้งรอบเกิน 3 ก็ต้องเลือกเลขที่สูงกว่าได้ */
                          { length: Math.max(3, scheduledAts.length) },
                          (_, n) => n + 1,
                        ).map((n) => (
                          <option key={n} value={n}>
                            สายที่ {n}
                            {n === 1 ? ' (สายแรก)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* บทที่รอบนี้จะพูด — กางให้เห็นเลย ไม่ต้องกดหา (เจ้าของสั่งให้ "บอกหน่อยว่า Scrip
                        นั้น ๆ จะพูดอะไรบ้าง") */}
                    <RoundScriptNote callRound={callRounds[i] ?? i + 1} defaultOpen />
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
          </DialogContent>
        </Dialog>

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

        {/* ═══ ไม่มีอะไรให้ตามเลย — ปฏิทินข้างบนจะว่างเปล่า ต้องบอกว่าต้องทำอะไรต่อ ═══
            🔴 ตารางรายละเอียดใต้ปฏิทินถูกถอดทิ้ง (เจ้าของสั่ง 1 ก.ย. 2569:
            *"คนที่ต้องติดตาม/หน่วยงาน/ติดตามวันไหน/แต่ละรอบ — เอากล่องพวกนี้ออกไปเลย"*)
            ปุ่มทำงานย้ายไปอยู่ในป๊อปที่เด้งตอนกดช่องเวลาในปฏิทิน */}
        {!loading && items.length === 0 ? (
          <div className="glass-card rounded-2xl border border-white/70 p-8 text-center text-muted-foreground">
            <PhoneForwarded className="mx-auto mb-2 h-8 w-8 text-blue-400/60" aria-hidden />
            <p className="text-sm font-medium text-foreground">ยังไม่มีรายชื่อที่ต้องติดตาม</p>
            <p className="mt-1 text-xs">กด “เพิ่มคนที่ต้องการติดตาม” เพื่อให้ AI โทรตามให้</p>
          </div>
        ) : null}

        {/* กล่อง "โทรครบแล้ว" (Phase 7.1-7.2) — ซ่อนตัวเองเมื่อไม่มีของ
            🔴 รับ `groups` ชุดเดียวกับตารางข้างบน (ยอดกับรายชื่อต้องมาจากชุดเดียวกัน)
            🔴 **ย้ายลงมาไว้ท้ายหน้า 1 ก.ย. 2569** — เจ้าของสั่ง *"เปิดมาปุ๊บ เจอ 3 หลัก ๆ"*
            (ปฏิทิน · ปุ่มเพิ่มคน · Planning) กล่องนี้เคยอยู่บน แล้วดันปฏิทินตกจอไปเลย
            ยังอยู่นอกแท็บเหมือนเดิม จึงไม่หายเวลาสลับแท็บ */}
        <FollowCompletedPanel
          groups={groups}
          onMoved={(name) => setAftercareNotice(`ย้าย ${name} ไปดูแลหลังเริ่มงานแล้ว`)}
        />
        {aftercareNotice ? (
          <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.success.soft, TONE.success.value)}>
            {aftercareNotice}
          </p>
        ) : null}
      </div>

      {/* ป๊อปรายละเอียดของช่องปฏิทิน — ปุ่มทำงานทั้งหมดอยู่ในนี้
          🔴 กด "แก้ไข" ต้องปิดป๊อปนี้ก่อน แล้วค่อยเปิดกล่องแก้ไข (ห้ามซ้อน Dialog) */}
      <FollowRoundsDialog
        open={Boolean(openCell)}
        onClose={() => setOpenCell(null)}
        group={cellDetail?.group ?? null}
        ymd={cellDetail?.ymd ?? null}
        rounds={cellDetail?.rounds ?? []}
        busyId={busyId}
        cancellingId={cancellingId}
        onAskCancel={setCancellingId}
        onCancel={(id) => void doCancel(id)}
        onEdit={(entry) => {
          setOpenCell(null);
          setEditing(entry);
        }}
        onComplete={doComplete}
      />

      <BoardPersonPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={pickPerson}
      />

      <BoardUnitPicker
        open={unitPickerOpen}
        onClose={() => setUnitPickerOpen(false)}
        units={unitOptions}
        onPick={pickUnit}
      />

      {/* popup เตือนลงซ้ำ (เจ้าของสั่ง 18 ส.ค. 2569) — บอกชนกับใคร เวลาไหน
          เลือกได้: บันทึกเฉพาะรอบที่ไม่ซ้ำ หรือกลับไปแก้ · ไม่มีปุ่ม "บันทึกซ้ำทั้งหมด"
          (ตั้งซ้อนเวลาเดิม = AI โทรหาคนเดิมสองสายพร้อมกัน ไม่มีเคสที่ตั้งใจทำแบบนั้น) */}
      {dupWarning ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label="เตือนรายการซ้ำ"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl">
            <h2 className="text-base font-semibold text-foreground">⚠️ ลงซ้ำกับรายการที่มีอยู่แล้ว</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              เบอร์นี้มีคิวโทรเวลาเดียวกันอยู่แล้ว — ตั้งซ้ำ = AI โทรซ้อนหาคนเดิม
            </p>
            <ul className="mt-3 space-y-1.5">
              {dupWarning.duplicates.map((d) => (
                <li
                  key={d.iso}
                  className={cn('rounded-lg border px-3 py-2 text-xs', TONE.warn.soft, TONE.warn.value)}
                >
                  <span className="font-semibold">{d.existingName}</span>
                  {' · '}
                  {new Date(d.iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDupWarning(null)}
                className={cn('inline-flex min-h-[40px] items-center rounded-full border px-4 text-xs font-medium', TONE.neutral.outline)}
              >
                กลับไปแก้เวลา
              </button>
              {dupWarning.freshIso.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const go = dupWarning.proceed;
                    setDupWarning(null);
                    void go();
                  }}
                  className="jarvis-pill-btn inline-flex min-h-[40px] items-center px-5 text-xs font-semibold"
                >
                  บันทึกเฉพาะที่ไม่ซ้ำ ({dupWarning.freshIso.length.toLocaleString('th-TH')} รอบ)
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* dialog จัดการเรื่อง / เจ้าหน้าที่ (เปิดจากปุ่มข้างปฏิทิน · supervisor+) */}
      <FollowMasterManagerDialog<FollowTopic>
        open={topicManagerOpen}
        onClose={() => setTopicManagerOpen(false)}
        title="เรื่องที่จะให้โทรติดตาม"
        description="ตัวเลือกใน dropdown ตอนเพิ่มรายชื่อ — เพิ่มแล้วใช้ได้ทันทีทุกฟอร์ม"
        fields={[{ key: 'name', placeholder: 'เพิ่มเรื่องใหม่ เช่น ติดตามเบิกเบี้ยเลี้ยง' }]}
        load={listFollowTopics}
        create={(f) => createFollowTopic(f.name ?? '')}
        toChip={(t) => t.name}
        onChanged={() => setTopicsRev((r) => r + 1)}
      />
      <FollowMasterManagerDialog<FollowStaffContact>
        open={staffManagerOpen}
        onClose={() => setStaffManagerOpen(false)}
        title="ชื่อ-เบอร์โทรเจ้าหน้าที่ที่ติดตาม"
        description="ตัวเลือกใน dropdown เจ้าหน้าที่ (หน้าตั้งวันเวลา) — AI บอกเบอร์นี้ให้ผู้สมัครโทรกลับ"
        fields={[
          { key: 'name', placeholder: 'ชื่อเจ้าหน้าที่ เช่น คุณคิว ทีมสรรหา' },
          { key: 'phone', placeholder: 'เบอร์โทร เช่น 021234567 ต่อ 101', inputMode: 'tel' },
        ]}
        load={listStaffContacts}
        create={(f) => createStaffContact(f.name ?? '', f.phone ?? '')}
        toChip={(c) => `${c.name} — ${c.phone}`}
        onChanged={() => setContactsRev((r) => r + 1)}
      />

      <FollowEditDialog
        entry={editing}
        unitOptions={unitOptions}
        topicsRev={topicsRev}
        contactsRev={contactsRev}
        /**
         * รอบอื่นของ "คนเดียวกัน" — จับคู่ด้วย **เบอร์ + เรื่อง** (ไม่มี group ผูกให้ทุกเคส
         * · เบอร์อย่างเดียวไม่พอ คนเดียวอาจถูกตามหลายเรื่องพร้อมกัน)
         */
        siblings={
          editing
            ? items.filter(
                (x) =>
                  x.recipient_phone === editing.recipient_phone &&
                  x.topic === editing.topic,
              )
            : []
        }
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
