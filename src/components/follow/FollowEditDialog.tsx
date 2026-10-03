import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Building2, LoaderCircle, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { createFollowEntry, replaceFollowSchedule, updateFollowEntry, type FollowEntry } from '@/lib/followApi';
import { buildExtraRounds, extraRoundsNote, localInputToIso } from '@/lib/followExtraRounds';
import { BoardUnitPickerBody } from '@/components/follow/BoardUnitPicker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import StaffContactField from '@/components/follow/StaffContactField';
import DateTimeField24 from '@/components/shared/DateTimeField24';
import TopicField from '@/components/follow/TopicField';
import FollowScheduleEditor from '@/components/follow/FollowScheduleEditor';
import {
  draftFromRows,
  followSetRows,
  isEditableFollowRound,
  isoToBangkokInput,
  scheduleReplaceBody,
  validateScheduleDraft,
} from '@/lib/followScheduleEdit';
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
  /**
   * ใครโทรของรอบที่จะเพิ่ม (เจ้าของสั่ง 3 ต.ค. 2569: *"ตั้งแบบวันเดียวก็ควรเลือกได้เหมือนกัน
   * ว่าจะให้ AI โทรหรือให้คนโทร"*) — เดิมรอบที่เพิ่มทีหลังเป็น AI เสมอโดยไม่มีช่องให้เลือก
   */
  const [extraModes, setExtraModes] = useState<Array<'ai' | 'manual'>>([]);
  /** ตัวเลือกหน่วยงานจากบอร์ด — ชุดเดียวกับฟอร์มเพิ่ม (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ) */
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  /**
   * 🔴 **แก้ตารางทั้งชุด** (เจ้าของ Choice 1 ต.ค. 2569 "แก้ตารางหลังบันทึกไม่ได้ → แก้") — สลับเนื้อในกล่องนี้
   * เป็นตัวแก้ตาราง (ไม่เปิด Dialog ซ้อน) · ปิดกล่อง/เปลี่ยนรายการ = กลับหน้าฟอร์มเสมอ
   */
  const [scheduleEditing, setScheduleEditing] = useState(false);
  /**
   * 🔴 **ใครโทรสายนี้ — เปลี่ยนใจได้** (เจ้าของสั่ง 1 ต.ค. 2569: *"แก้ไขมันต้องแก้ไขได้ว่าแบบเผื่อเปลี่ยนใจ
   * ไม่ใช่ Ai โทรและ หรือ จะเปลี่ยนจากคนเป็น Ai"*) · สลับได้เฉพาะสายที่ยังไม่ถึงเวลาและยังไม่ถูกโทร
   * บันทึกผ่านเส้นแก้ตารางทั้งชุด (ถอน/ส่งคิว + ส่งแผนใหม่ให้ Lumos ครบในที่เดียว)
   */
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');

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
    setMode(entry.call_mode === 'manual' ? 'manual' : 'ai');
    setError(null);
    setExtraWhen([]);
    setExtraModes([]);
    setScheduleEditing(false);
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
  /** สายของชุดนี้ (ชุดเดียวกันเท่านั้น) + ยังมีสายที่แก้ได้ไหม — ไม่มีเลย = ไม่ต้องโชว์ปุ่มแก้ตาราง */
  const setRows = followSetRows(entry, siblings);
  const canEditSchedule = setRows.some((r) => isEditableFollowRound(r, new Date()));
  const modeEditable = isEditableFollowRound(entry, new Date());
  const beforeMode: 'ai' | 'manual' = entry.call_mode === 'manual' ? 'manual' : 'ai';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const now = new Date();
    const newIso = when ? new Date(when).toISOString() : entry.scheduled_at;
    const minuteOf = (iso: string | null | undefined) => Math.floor(Date.parse(iso ?? '') / 60_000);
    const modeChanged = modeEditable && mode !== beforeMode;
    const fieldsChanged =
      name !== (entry.recipient_name ?? '') ||
      phone !== (entry.recipient_phone ?? '') ||
      topic !== (entry.topic ?? '') ||
      note !== (entry.note ?? '') ||
      staffPhone !== (entry.staff_phone ?? '') ||
      unitName !== (entry.unit_name ?? '') ||
      siteCode !== (entry.site_code ?? '') ||
      minuteOf(newIso) !== minuteOf(entry.scheduled_at);
    /**
     * สลับคนโทร = ส่ง **ทุกสายที่ยังแก้ได้ของชุด** ไปทีเดียว (เปลี่ยนแค่สายนี้) — ฝั่ง API ยกเลิกแผนเดิมแล้วส่งแผนใหม่
     * ทั้งชุด · ตรวจเวลาก่อนเขียนอะไร (เส้นนี้รับแต่เวลาอนาคต) จะได้ไม่แก้ข้อมูลไปครึ่งเดียว
     */
    const editable = setRows.filter((r) => isEditableFollowRound(r, now));
    const draft = draftFromRows(editable).map((d) =>
      d.id === entry.id ? { ...d, mode, when: isoToBangkokInput(newIso) } : d,
    );
    if (modeChanged) {
      const check = validateScheduleDraft(draft, now);
      if (!check.ok) {
        setError(Object.values(check.errors)[0] ?? 'ตั้งวันและเวลาให้ถูกก่อน');
        return;
      }
    }
    setBusy(true);
    try {
      if (modeChanged && !fieldsChanged && rounds.isoTimes.length === 0) {
        const out = await replaceFollowSchedule(entry.id, scheduleReplaceBody(editable, draft));
        onSaved(modeChangedMessage(mode, out.lumos));
        onClose();
        return;
      }
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
      /* จับคู่ "ช่องที่กรอก → ISO ที่สร้างจริง" เพื่อรู้ว่ารอบไหนให้ใครโทร
         (buildExtraRounds ตัดซ้ำ/เรียงใหม่ — index เดิมใช้ตรง ๆ ไม่ได้ · ซ้ำกัน = ช่องแรกชนะ เหมือนกติกาตัดซ้ำ) */
      const modeOfIso = new Map<string, 'ai' | 'manual'>();
      extraWhen.forEach((raw, i) => {
        const iso = localInputToIso(raw);
        if (iso && !modeOfIso.has(iso)) modeOfIso.set(iso, extraModes[i] ?? 'ai');
      });
      for (const iso of rounds.isoTimes) {
        await createFollowEntry({
          recipient_name: name,
          recipient_phone: phone,
          topic,
          // รอบที่เพิ่มทีหลังอยู่ทีมเดียวกับรายการเดิม (1 ต.ค. 2569) — ไม่งั้นรอบใหม่ของคนส่งแทนไปโผล่แท็บรายชื่อติดตาม
          follow_team: entry.follow_team === 'replacement' ? 'replacement' : undefined,
          note: note || undefined,
          staff_phone: staffPhone || undefined,
          scheduled_at: iso,
          // ใครโทรของรอบใหม่ (3 ต.ค. 2569) — เดิมไม่ส่ง = AI เสมอ
          call_mode: modeOfIso.get(iso) ?? 'ai',
          unit_name: unitName.trim() || undefined,
          site_code: siteCode.trim() || undefined,
        });
        added += 1;
      }

      /**
       * 🔴 **บอกผลการส่งใหม่ให้ Lumos ด้วย** (13 ก.ย. 2569)
       *
       * ของเดิมบอกแค่ว่าแก้คิวฝั่งเราได้กี่สาย ซึ่งไม่ใช่คำถามที่คนกดอยากรู้ —
       * เขาอยากรู้ว่า **AI จะโทรตามเวลาใหม่ไหม** · วัดจริงกับงานวันที่ 14 ก.ย.
       * 3 ใน 10 คนที่ถูกกดแก้ Lumos ยังถือเวลาเดิม (รอบหาย · เวลาเป็น 20:00 ·
       * โดนโทรตามเวลาเดิมไปแล้ว) ⇒ ส่งใหม่ไม่สำเร็จต้องขึ้นบนจอ ห้ามเงียบ
       */
      if (modeChanged) {
        const out = await replaceFollowSchedule(entry.id, scheduleReplaceBody(editable, draft));
        const parts = ['แก้ไขแล้ว', modeChangedMessage(mode, out.lumos)];
        if (added > 0) parts.push(`เพิ่มอีก ${added} สาย`);
        onSaved(parts.join(' · '));
        onClose();
        return;
      }

      const resync = saved.lumos_resync;
      const queueMsg = resync?.pushed
        ? `แก้ไขแล้ว — ส่งแผนใหม่ให้ AI แล้ว ${resync.rounds} รอบ จะโทรตามเวลาใหม่`
        : resync && resync.rounds > 0
          ? `แก้ไขแล้ว — แต่ยังส่งแผนใหม่ให้ AI ไม่สำเร็จ (${resync.reason ?? 'ไม่ทราบเหตุ'}) · ระบบจะลองใหม่ให้เอง`
          : (saved.queue_refreshed ?? 0) > 0
            ? `แก้ไขแล้ว — อัปเดตบทพูดในคิว ${saved.queue_refreshed} สายด้วย`
            : 'แก้ไขแล้ว — แต่สายที่ AI รับไปแล้วยังใช้ข้อมูลเดิม (เรียกคืนไม่ได้)';
      onSaved(added > 0 ? `${queueMsg} · เพิ่มอีก ${added} สาย` : queueMsg);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'แก้ไขไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    /**
     * 🔴 **ใช้ Dialog ของ shadcn** (4 ก.ย. 2569 — เจ้าของสั่ง *"ห้ามหลุด Framework"*)
     * เดิมกล่องนี้ปั้นเอง (`fixed inset-0` + `role="dialog"`) เพราะต้องเปิด picker
     * หน่วยงานซ้อนข้างใน ซึ่งผิดกติกา "ห้าม Dialog ซ้อน Dialog"
     * ⇒ ตอนนี้ picker ฝังเป็นแผงในฟอร์มเดียวกัน (`BoardUnitPickerBody`) ตามแพตเทิร์น
     * `embedded` ของโปรเจกต์ · ปุ่มปิดใช้ตัวที่ DialogContent มีให้อยู่แล้ว
     */
    <Dialog open onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{scheduleEditing ? 'แก้ตารางทั้งชุด' : 'แก้ไขรายการติดตาม'}</DialogTitle>
          <DialogDescription className="text-[11px]">
            เจ้าของข้อมูล{' '}
            <span className="font-medium text-foreground">
              {entry.created_by_name || 'ไม่ทราบ'}
            </span>{' '}
            — แก้ไม่ได้ ใครกรอกคนนั้นเป็นเจ้าของ
          </DialogDescription>
        </DialogHeader>
        {scheduleEditing ? (
          <FollowScheduleEditor
            anchor={entry}
            setRows={setRows}
            cancelledRows={siblings.filter(
              (s) => s.cancelled && (entry.group_id ? s.group_id === entry.group_id : !s.group_id),
            )}
            onBack={() => setScheduleEditing(false)}
            onSaved={(msg) => {
              onSaved(msg);
              onClose();
            }}
          />
        ) : (
        <form onSubmit={save}>

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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUnitPickerOpen((v) => !v)}
                className={cn('gap-1.5', TONE.info.value)}
              >
                <Building2 aria-hidden />
                {unitPickerOpen ? 'ปิดรายชื่อหน่วยงาน' : 'เลือกหน่วยงานจากบอร์ด'}
              </Button>
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
            {/* 🔴 แผงเลือกหน่วยงาน **ฝังในฟอร์มเดียวกัน** — ห้ามเปิด Dialog ซ้อน Dialog
                (ใช้ `BoardUnitPickerBody` ตัวเดียวกับที่ picker แบบเต็มใช้ ตรรกะค้นหาไม่ซ้ำ) */}
            {unitPickerOpen ? (
              <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/30 p-3">
                <BoardUnitPickerBody
                  units={unitOptions}
                  listClassName="max-h-56"
                  onPick={(u: BoardUnitOption) => {
                    setUnitName(u.unitName);
                    setSiteCode(u.siteCode);
                    setUnitPickerOpen(false);
                  }}
                />
              </div>
            ) : null}
            {siteCode ? (
              <p className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Building2 className="h-3 w-3" aria-hidden />
                รหัสไซต์ <span className="font-mono font-medium text-foreground">{siteCode}</span>
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
            {/* 🔴 ห้ามกลับไปใช้ `<input type=datetime-local>` — ขึ้น AM/PM ตามเครื่องคนใช้ */}
            <DateTimeField24 value={when} onChange={setWhen} label="เวลานัด" className="w-full" />
            {/* สายที่ลงแบบ "ยังไม่ชัวร์เวลา" (134) — เวลาที่เห็นเป็นค่าแทน บันทึกเวลาจริงแล้วธงหลุดเอง */}
            {entry.time_tbd === true ? (
              <p className={cn('ml-1 rounded-lg px-2 py-1 text-[11px]', TONE.info.soft, TONE.info.value)}>
                สายนี้ยังไม่ระบุเวลา — เลือกเวลาจริงแล้วกดบันทึก
              </p>
            ) : null}
            {/* สายคนโทรไม่เคยเข้าคิว (call_status = null) — เดิมขึ้นคำเตือนนี้ผิด ๆ ทุกครั้ง */}
            {entry.call_status && entry.call_status !== 'pending' ? (
              <p className={cn('ml-1 rounded-lg px-2 py-1 text-[11px]', TONE.warn.soft, TONE.warn.value)}>
                สายนี้ AI รับไปแล้ว — แก้ที่นี่ไม่ทำให้สายที่ออกไปเปลี่ยนตาม
              </p>
            ) : null}
          </div>
          {modeEditable ? (
            <div className="space-y-1.5">
              <p className="ml-1 text-xs font-medium text-muted-foreground">ใครโทรสายนี้</p>
              <div className="ml-1 flex flex-wrap items-center gap-3">
                {(['ai', 'manual'] as const).map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-1.5">
                    <Checkbox
                      checked={mode === m}
                      onCheckedChange={() => setMode(m)}
                      aria-label={`ใครโทรสายนี้ — ${m === 'ai' ? 'AI โทร' : 'คนโทร'}`}
                    />
                    <span className={cn('text-xs font-medium', mode === m ? 'text-foreground' : 'text-muted-foreground')}>
                      {m === 'ai' ? 'AI โทร' : 'คนโทร'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {/* เพิ่มรอบโทร (เจ้าของสั่ง 18 ส.ค. 2569) — รอบใหม่ = รายการใหม่ที่ลอกข้อมูลนี้ไป
              โชว์รอบที่มีอยู่แล้วให้เห็นก่อน จะได้ไม่ตั้งซ้อนกันเอง */}
          <div className={cn('space-y-2 rounded-xl border p-3', TONE.neutral.soft)}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-xs font-medium text-foreground">สายของคนนี้</span>
              <span className="text-[11px] text-muted-foreground">
                มีอยู่ {(otherRounds.length + 1).toLocaleString('th-TH')} รอบ
                {rounds.isoTimes.length > 0
                  ? ` · กำลังเพิ่มอีก ${rounds.isoTimes.length.toLocaleString('th-TH')}`
                  : ''}
              </span>
            </div>
            {canEditSchedule ? (
              <Button type="button" variant="outline" size="xs" onClick={() => setScheduleEditing(true)}>
                แก้ตารางทั้งชุด
              </Button>
            ) : null}

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
                      {s.call_mode === 'manual' ? 'คนโทร' : s.call_status === 'pending' ? 'รอโทร' : 'ส่ง AI แล้ว'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {extraWhen.map((v, i) => (
              <div key={i} className="space-y-1.5 rounded-xl border border-border/60 p-2">
                <div className="flex items-center gap-2">
                <DateTimeField24
                  value={v}
                  label={`สายที่จะเพิ่ม ${i + 1}`}
                  onChange={(next) =>
                    setExtraWhen((prev) => prev.map((x, idx) => (idx === i ? next : x)))
                  }
                  className="min-h-[44px] flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    setExtraWhen((prev) => prev.filter((_, idx) => idx !== i));
                    setExtraModes((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                  aria-label={`เอาสายที่จะเพิ่ม ${i + 1} ออก`}
                  className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
                </div>
                {/* ใครโทรรอบนี้ (เจ้าของสั่ง 3 ต.ค. 2569: ตั้งรอบเดียวก็ต้องเลือก AI/คนได้) */}
                <div className="ml-1 flex flex-wrap items-center gap-3" role="group" aria-label={`ใครโทรสายที่จะเพิ่ม ${i + 1}`}>
                  {(['ai', 'manual'] as const).map((m) => (
                    <label key={m} className="flex cursor-pointer items-center gap-1.5">
                      <Checkbox
                        checked={(extraModes[i] ?? 'ai') === m}
                        onCheckedChange={() =>
                          setExtraModes((prev) => {
                            const next = [...prev];
                            next[i] = m;
                            return next;
                          })
                        }
                        aria-label={`สายที่จะเพิ่ม ${i + 1} — ${m === 'ai' ? 'AI โทร' : 'คนโทร'}`}
                      />
                      <span className={cn('text-xs font-medium', (extraModes[i] ?? 'ai') === m ? 'text-foreground' : 'text-muted-foreground')}>
                        {m === 'ai' ? 'AI โทร' : 'คนโทร'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                {
                  setExtraWhen((prev) => (prev.length >= 5 ? prev : [...prev, when || '']));
                  setExtraModes((prev) => (prev.length >= 5 ? prev : [...prev, 'ai']));
                }
              }
              disabled={extraWhen.length >= 5}
              className={cn(
                'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-4 text-xs font-medium disabled:opacity-40',
                TONE.info.outline,
              )}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> เพิ่มสาย
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
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-primary px-5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            {rounds.isoTimes.length > 0
              ? `บันทึก + เพิ่ม ${rounds.isoTimes.length} รอบ`
              : 'บันทึกการแก้ไข'}
          </button>
        </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** ข้อความหลังสลับคนโทร — บอกผลกับ AI ตรง ๆ ห้ามเงียบ (ส่งไม่สำเร็จ = AI อาจยังถือแผนเดิม) */
function modeChangedMessage(
  mode: 'ai' | 'manual',
  lumos: { pushed: boolean; reason?: string | null },
): string {
  if (mode === 'manual') {
    return lumos.pushed
      ? 'เปลี่ยนเป็นคนโทรแล้ว — AI ไม่โทรสายนี้'
      : `เปลี่ยนเป็นคนโทรแล้ว — แต่ถอนสายออกจาก AI ไม่สำเร็จ (${lumos.reason ?? 'ไม่ทราบเหตุ'})`;
  }
  return lumos.pushed
    ? 'เปลี่ยนเป็น AI โทรแล้ว — AI โทรตามเวลา'
    : `เปลี่ยนเป็น AI โทรแล้ว — แต่ยังส่งให้ AI ไม่สำเร็จ (${lumos.reason ?? 'ไม่ทราบเหตุ'})`;
}
