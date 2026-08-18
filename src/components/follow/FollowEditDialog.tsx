import React, { useEffect, useMemo, useState } from 'react';
import { Building2, LoaderCircle, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { createFollowEntry, updateFollowEntry, type FollowEntry } from '@/lib/followApi';
import { buildExtraRounds, extraRoundsNote } from '@/lib/followExtraRounds';
import BoardUnitPicker from '@/components/follow/BoardUnitPicker';
import StaffContactField from '@/components/follow/StaffContactField';
import TopicField from '@/components/follow/TopicField';
import type { BoardUnitOption } from '@/lib/boardUnitPicker';

/**
 * แก้ไขรายการติดตาม (096 · เจ้าของสั่ง 17 ส.ค. 2569: *"เพิ่มให้แก้ไขได้"*)
 *
 * ⚠️ **เจ้าของข้อมูลแก้ไม่ได้** — คนที่กรอกครั้งแรกคือเจ้าของตลอดไป (server ก็กันอีกชั้น)
 * คนแก้ทีหลังถูกบันทึกแยกที่ `updated_by_name` ประวัติจึงไม่หาย
 *
 * ⚠️ **ตารางโทร (ชุดหลายวัน) แก้ที่นี่ไม่ได้** — แก้ทีละแถวคือชุดเพี้ยน
 * จะเปลี่ยนตารางต้องยกเลิกทั้งชุดแล้วตั้งใหม่
 *
 * 🔴 หลังบันทึก server จะรีเฟรชบทพูดในคิว Lumos ให้ด้วย **เฉพาะสายที่ยังไม่ถูกดึงไป**
 * ถ้า `queue_refreshed = 0` แปลว่าสายที่ออกไปแล้วใช้ข้อมูลเดิม — ต้องบอกคนใช้ ไม่ใช่เงียบ
 *
 * **เพิ่มรอบโทรได้** (เจ้าของสั่ง 18 ส.ค. 2569: *"เผื่อบางทีต้องโทร 2 รอบ
 * แต่ดันเผลอตั้งไปรอบเดียว"*) — หนึ่งรอบ = **หนึ่งรายการใหม่** ที่ลอกคน/เรื่อง/หน่วยงาน
 * มาจากรายการนี้ (คิวโทรผูกกับรายการ 1:1 · ยัดหลายเวลาลงรายการเดียวไม่ได้)
 * ตรรกะกันเวลาซ้ำ/เตือนเวลาที่ผ่านมาแล้วอยู่ที่ `followExtraRounds.ts`
 */
export default function FollowEditDialog({
  entry,
  unitOptions,
  siblings = [],
  topicsRev,
  contactsRev,
  onClose,
  onSaved,
}: {
  entry: FollowEntry | null;
  /** ตัวเลือกหน่วยงานที่ merge แล้ว (โหลดไว้แล้วจากหน้าแม่ — ไม่ยิงเส้นซ้ำ) */
  unitOptions: BoardUnitOption[];
  /** รอบอื่นของ "คนเดียวกัน" ที่ยังไม่ถูกยกเลิก — ใช้โชว์รอบที่มีอยู่ + กันตั้งเวลาซ้ำ */
  siblings?: FollowEntry[];
  /** bump เมื่อ dialog จัดการ (ข้างปฏิทิน) เพิ่มค่าใหม่ — dropdown โหลดลิสต์ใหม่ */
  topicsRev?: number;
  contactsRev?: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [when, setWhen] = useState('');
  const [unitName, setUnitName] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** ช่องเวลาของ "รอบที่จะเพิ่ม" — ว่างอยู่ = ยังไม่เพิ่ม */
  const [extraWhen, setExtraWhen] = useState<string[]>([]);
  /** ตัวเลือกหน่วยงานจากบอร์ด — ชุดเดียวกับฟอร์มเพิ่ม (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ) */
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setName(entry.recipient_name ?? '');
    setPhone(entry.recipient_phone ?? '');
    setTopic(entry.topic ?? '');
    setNote(entry.note ?? '');
    setStaffPhone(entry.staff_phone ?? '');
    setUnitName(entry.unit_name ?? '');
    setSiteCode(entry.site_code ?? '');
    // input datetime-local กินรูป YYYY-MM-DDTHH:mm ตามเวลาเครื่อง — ต้องแปลงจาก ISO ก่อน
    if (entry.scheduled_at) {
      const d = new Date(entry.scheduled_at);
      if (!Number.isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        setWhen(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
        );
      }
    }
    setError(null);
    setExtraWhen([]);
  }, [entry]);

  /**
   * เวลาที่ "มีอยู่แล้ว" ของคนนี้ = รอบที่กำลังแก้ (ค่าในช่อง) + รอบพี่น้องที่ยังไม่ยกเลิก
   * ใช้กันตั้งซ้ำ — ซ้ำเมื่อไหร่คือโทรซ้อนหาคนเดิม
   */
  const existingIso = useMemo(() => {
    const out: string[] = [];
    if (when) {
      const d = new Date(when);
      if (!Number.isNaN(d.getTime())) out.push(d.toISOString());
    }
    for (const s of siblings) {
      if (s.id === entry?.id || s.cancelled || !s.scheduled_at) continue;
      out.push(s.scheduled_at);
    }
    return out;
  }, [when, siblings, entry?.id]);

  const rounds = useMemo(() => buildExtraRounds(extraWhen, existingIso), [extraWhen, existingIso]);
  const roundsNote = extraRoundsNote(rounds);

  if (!entry) return null;

  const otherRounds = siblings.filter((s) => s.id !== entry.id && !s.cancelled);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const saved = await updateFollowEntry(entry.id, {
        recipient_name: name,
        recipient_phone: phone,
        topic,
        note: note || undefined,
        staff_phone: staffPhone || undefined,
        scheduled_at: when ? new Date(when).toISOString() : undefined,
        unit_name: unitName.trim() || undefined,
        site_code: siteCode.trim() || undefined,
      });
      /**
       * รอบใหม่สร้างหลังแก้สำเร็จเท่านั้น — แก้ล้มแล้วยังเพิ่มรอบต่อ = ได้รอบที่ใช้ข้อมูลเก่า
       * ⚠️ ยิงทีละรอบ ล้มกลางทางต้องบอกว่าสำเร็จไปกี่รอบ ไม่งั้นคนกดซ้ำแล้วได้รอบซ้อน
       */
      let added = 0;
      for (const iso of rounds.isoTimes) {
        await createFollowEntry({
          recipient_name: name,
          recipient_phone: phone,
          topic,
          note: note || undefined,
          staff_phone: staffPhone || undefined,
          scheduled_at: iso,
          unit_name: unitName.trim() || undefined,
          site_code: siteCode.trim() || undefined,
        });
        added += 1;
      }

      // บอกตรง ๆ ว่าสายที่ออกไปแล้วใช้ข้อมูลเดิม — เงียบไว้คือเข้าใจผิดว่าแก้ทันทุกสาย
      const queueMsg =
        (saved.queue_refreshed ?? 0) > 0
          ? `แก้ไขแล้ว — อัปเดตบทพูดในคิว ${saved.queue_refreshed} สายด้วย`
          : 'แก้ไขแล้ว — แต่สายที่ AI รับไปแล้วยังใช้ข้อมูลเดิม (เรียกคืนไม่ได้)';
      onSaved(added > 0 ? `${queueMsg} · เพิ่มอีก ${added} รอบ` : queueMsg);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'แก้ไขไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="แก้ไขรายการติดตาม"
    >
      <form
        onSubmit={save}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-background p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">แก้ไขรายการติดตาม</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              เจ้าของข้อมูล{' '}
              <span className="font-medium text-foreground">
                {entry.created_by_name || 'ไม่ทราบ'}
              </span>{' '}
              — แก้ไม่ได้ ใครกรอกคนนั้นเป็นเจ้าของ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="feName" className="ml-1 text-xs font-medium text-muted-foreground">
              ชื่อผู้ที่ต้องติดตาม
            </label>
            <input
              id="feName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="jarvis-soft-field min-h-[46px] w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="fePhone" className="ml-1 text-xs font-medium text-muted-foreground">
              เบอร์โทร
            </label>
            <input
              id="fePhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
              className="jarvis-soft-field min-h-[46px] w-full"
            />
          </div>
          {/* dropdown เรื่องจากลิสต์กลาง (100) — ตัวเดียวกับฟอร์มเพิ่ม
              ⚠️ แก้เรื่องแล้วกลุ่มการ์ดบนลิสต์เปลี่ยนตาม (จับกลุ่มด้วยเบอร์+เรื่อง)
              และ `siblings` ของกล่องนี้ก็ผูกเรื่องเดิม — เปลี่ยนเรื่องคือแยกออกจากกลุ่มเดิม */}
          <TopicField id="feTopic" value={topic} onChange={setTopic} reloadSignal={topicsRev} />
          <div className="space-y-1.5">
            <label htmlFor="feUnit" className="ml-1 text-xs font-medium text-muted-foreground">
              หน่วยงาน
            </label>
            {/* ปุ่มเลือกจากบอร์ด + ช่องข้อความ — แบบเดียวกับฟอร์มเพิ่ม (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)
                dropdown เดิมมีปัญหาเดียวกับที่ฟอร์มเพิ่มเคยเจอ: เลือกด้วยคีย์บอร์ดกด Enter
                = ฟอร์มยิง submit เอง · ช่องข้อความ + ปุ่มเปิด picker ไม่มีทางนั้น */}
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
            </div>
            <input
              id="feUnit"
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
          {/* dropdown ชื่อ+เบอร์จากรายชื่อกลาง (099 · เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)
              ⚠️ select ในฟอร์มนี้กด Enter แล้วฟอร์มยิง save ได้ — ยอมรับได้เพราะ
              ฟอร์มแก้ไข Enter = บันทึกการแก้ อยู่แล้วทุกช่อง (ไม่ใช่ฟอร์มเพิ่มที่เคยพัง) */}
          <StaffContactField
            id="feStaffPhone"
            value={staffPhone}
            onChange={setStaffPhone}
            reloadSignal={contactsRev}
          />
          <div className="space-y-1.5">
            <label htmlFor="feWhen" className="ml-1 text-xs font-medium text-muted-foreground">
              ให้โทรเมื่อไหร่
            </label>
            <input
              id="feWhen"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="jarvis-soft-field min-h-[46px] w-full"
            />
            {entry.call_status !== 'pending' ? (
              <p className={cn('ml-1 rounded-lg px-2 py-1 text-[11px]', TONE.warn.soft, TONE.warn.value)}>
                สายนี้ AI รับไปแล้ว — แก้ที่นี่ไม่ทำให้สายที่ออกไปเปลี่ยนตาม
              </p>
            ) : null}
          </div>
          {/* เพิ่มรอบโทร (เจ้าของสั่ง 18 ส.ค. 2569) — รอบใหม่ = รายการใหม่ที่ลอกข้อมูลนี้ไป
              โชว์รอบที่มีอยู่แล้วให้เห็นก่อน จะได้ไม่ตั้งซ้อนกันเอง */}
          <div className={cn('space-y-2 rounded-xl border p-3', TONE.neutral.soft)}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-xs font-semibold text-foreground">รอบโทรของคนนี้</span>
              <span className="text-[11px] text-muted-foreground">
                มีอยู่ {(otherRounds.length + 1).toLocaleString('th-TH')} รอบ
                {rounds.isoTimes.length > 0
                  ? ` · กำลังเพิ่มอีก ${rounds.isoTimes.length.toLocaleString('th-TH')}`
                  : ''}
              </span>
            </div>

            {otherRounds.length > 0 ? (
              <ul className="space-y-1">
                {otherRounds.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-2 py-1 text-[11px]"
                  >
                    <span className="text-muted-foreground">
                      {s.scheduled_at
                        ? new Date(s.scheduled_at).toLocaleString('th-TH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </span>
                    <span className="text-muted-foreground">
                      {s.call_status === 'pending' ? 'รอโทร' : 'ส่ง AI แล้ว'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {extraWhen.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={v}
                  aria-label={`รอบที่จะเพิ่ม ${i + 1}`}
                  onChange={(e) =>
                    setExtraWhen((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                  }
                  className="jarvis-soft-field min-h-[44px] flex-1"
                />
                <button
                  type="button"
                  onClick={() => setExtraWhen((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`เอารอบที่จะเพิ่ม ${i + 1} ออก`}
                  className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setExtraWhen((prev) => (prev.length >= 5 ? prev : [...prev, when || '']))
              }
              disabled={extraWhen.length >= 5}
              className={cn(
                'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-4 text-xs font-medium disabled:opacity-40',
                TONE.info.outline,
              )}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> เพิ่มรอบโทร
            </button>

            {/* 🔴 ห้ามเงียบเมื่อมีของถูกตัด/ของเสี่ยง — คนต้องรู้ก่อนกดบันทึก */}
            {roundsNote ? (
              <p
                className={cn(
                  'rounded-lg px-2 py-1 text-[11px]',
                  rounds.pastCount > 0 || rounds.invalidCount > 0
                    ? cn(TONE.warn.soft, TONE.warn.value)
                    : 'text-muted-foreground',
                )}
              >
                {roundsNote}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                กดเพิ่มรอบแล้วตั้งวัน-เวลา · เวลาซ้ำกับรอบเดิมจะถูกตัดให้อัตโนมัติ
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="feNote" className="ml-1 text-xs font-medium text-muted-foreground">
              ข้อความที่อยากให้ AI พูดเพิ่ม
            </label>
            <textarea
              id="feNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="jarvis-soft-field w-full"
            />
          </div>
        </div>

        {error ? (
          <p className={cn('mt-3 rounded-lg px-3 py-2 text-xs', TONE.danger.soft, TONE.danger.value)}>
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'inline-flex min-h-[40px] items-center rounded-full border px-4 text-xs font-medium',
              TONE.neutral.outline,
            )}
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            {rounds.isoTimes.length > 0
              ? `บันทึก + เพิ่ม ${rounds.isoTimes.length} รอบ`
              : 'บันทึกการแก้ไข'}
          </button>
        </div>
      </form>

      {/* picker เป็น Radix Dialog ที่ portal ไป body — เปิดซ้อนกล่องแก้ไข (fixed z-50) ได้
          เพราะ portal ถูกต่อท้าย DOM ทีหลังจึงอยู่บนสุดเสมอ */}
      <BoardUnitPicker
        open={unitPickerOpen}
        onClose={() => setUnitPickerOpen(false)}
        units={unitOptions}
        onPick={(u: BoardUnitOption) => {
          setUnitName(u.unitName);
          setSiteCode(u.siteCode);
          setUnitPickerOpen(false);
        }}
      />
    </div>
  );
}
