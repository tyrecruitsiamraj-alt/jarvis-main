import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import CallFunnelPanel from '@/components/follow/CallFunnelPanel';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { Phone, Plus, X, LoaderCircle, RefreshCw, PhoneForwarded } from 'lucide-react';
import {
  listFollowEntries,
  createFollowEntry,
  cancelFollowEntry,
  FOLLOW_STATUS_LABEL,
  FOLLOW_STATUS_CLASS,
  FOLLOW_STATUS_BAR,
  type FollowEntry,
  type FollowCallStatus,
} from '@/lib/followApi';
import NameAvatar from '@/components/shared/NameAvatar';

const FILTERS: Array<{ id: 'all' | FollowCallStatus; label: string }> = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'pending', label: 'รอโทร' },
  { id: 'delivered', label: 'กำลังโทร' },
  { id: 'completed', label: 'โทรสำเร็จ' },
  { id: 'failed', label: 'ไม่สำเร็จ' },
];

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
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    setScheduledAts([nowForInput()]);
    setDateFrom('');
    setDateTo('');
    setRoundTimes(['07:00']);
    setFormError(null);
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
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const recipientName = composeRecipientName(prefix, firstName, lastName);

    // โหมดตาราง: ช่วงวัน × รอบเวลา/วัน → 1 แถว/วัน ผูก group เดียว (Lumos หยุดรอบที่เหลือ
    // ของวันเมื่อยืนยัน · declined ยกเลิกทั้งชุด — server จัดการ)
    if (scheduleMode) {
      const days = daysInRange(dateFrom, dateTo);
      if (days.length === 0) {
        setFormError('เลือกช่วงวันให้ถูกต้อง (ไม่เกิน 31 วัน · วันเริ่มต้องไม่หลังวันจบ)');
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
        <CallFunnelPanel defaultSource="follow" lockSource showAttempts />


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
          <form onSubmit={submit} className="jarvis-frost space-y-3 p-4 sm:p-5">
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
                {(() => {
                  const days = daysInRange(dateFrom, dateTo).length;
                  const rounds = new Set(roundTimes.filter((t) => /^\d{1,2}:\d{2}$/.test(t))).size;
                  return days > 0 && rounds > 0 ? (
                    <p className="ml-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                      รวม {days} วัน × {rounds} รอบ = {days * rounds} สาย · รับสายยืนยันแล้ววันนั้นหยุด พรุ่งนี้โทรต่อ
                    </p>
                  ) : (
                    <p className="ml-1 text-[11px] text-muted-foreground">เลือกช่วงวัน + รอบเวลา แล้วระบบจะสรุปจำนวนสายให้</p>
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

            {formError ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
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

        {/* ตัวกรอง */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'min-h-[36px] rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                filter === f.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-white/70 bg-white/60 text-slate-600 hover:text-foreground dark:border-white/15 dark:bg-white/10 dark:text-slate-300',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

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
                      <span className={FOLLOW_STATUS_CLASS[it.call_status]}>
                        {FOLLOW_STATUS_LABEL[it.call_status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{it.topic}</p>
                    {it.note ? <p className="text-xs text-muted-foreground">{it.note}</p> : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      ให้โทร {formatWhen(it.scheduled_at)}
                      {it.created_by_name ? ` · ลงโดย ${it.created_by_name}` : ''}
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
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={`tel:${it.recipient_phone}`}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-sky-200 bg-sky-50/70 px-3 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950"
                    >
                      <Phone className="h-3 w-3" aria-hidden />
                      {it.recipient_phone}
                    </a>
                    {!it.cancelled && it.call_status === 'pending' ? (
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
    </div>
  );
};

export default FollowPage;
