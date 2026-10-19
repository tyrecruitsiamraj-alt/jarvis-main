import React, { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import MoveRoundsEditor from '@/components/follow/MoveRoundsEditor';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { friendlyErrorText } from '@/lib/friendlyError';
import { AFTERCARE_TOPIC } from '@/lib/aftercareRounds';
import { updateAftercare, type AftercarePerson } from '@/lib/aftercareApi';
import { createFollowRounds, replaceFollowSchedule, type FollowEntry } from '@/lib/followApi';
import { erpInformDateOf, fetchErpInformDates } from '@/lib/erpInformDatesApi';
import {
  buildMoveCalls,
  buildScheduleReplaceRounds,
  draftsFromPending,
  firstMoveRoundFor,
  startYmdOfRounds,
  validateMoveRounds,
  type MoveRoundDraft,
} from '@/lib/followAftercareMove';
import { pendingAftercareRounds } from '@/lib/aftercareSchedule';

/**
 * ═══ ป๊อป "ตั้งรอบโทรถามความเป็นอยู่" ของหน้าดูแลหลังเริ่มงาน (เจ้าของ 19 ต.ค. 2569) ═══
 * > *"ไม่เอาหน้าต่างเหมือนแผนติดตาม ต้องการหน้าต่างเหมือนก่อนกดย้ายไปดูแลหลังเริ่มงาน ที่สามารถแก้ไขได้"*
 * + Choice "เปิดมาเห็นรอบที่ตั้งไว้ แก้ได้"
 *
 * - ฟอร์มตัวเดียวกับป๊อปย้าย (`MoveRoundsEditor`)
 * - มีสายที่ยังไม่โทรอยู่แล้ว ⇒ ขึ้นเป็นรอบให้แก้ · บันทึก = แก้ตารางทั้งชุด (`replaceFollowSchedule` — ส่งแผนใหม่ให้ Lumos)
 * - ยังไม่มี ⇒ ตั้งชุดใหม่ (`createFollowRounds` · แผนละวัน group_id เดียว แบบป๊อปย้าย)
 * - เปลี่ยนวันเริ่มงานในป๊อป = บันทึกลงแถวดูแลด้วย
 */
export default function AftercareScheduleDialog({
  person,
  calls,
  now = () => new Date(),
  onClose,
  onDone,
}: {
  person: AftercarePerson | null;
  /** สายหัวข้อถามความเป็นอยู่ทั้งหมดของหน้า (หน้าแม่โหลดไว้แล้ว) */
  calls: readonly FollowEntry[];
  now?: () => Date;
  onClose: () => void;
  onDone: (notice: string) => void;
}) {
  // หน้าแม่ใส่ key ตามคน (remount) — ฟอร์มเริ่มใหม่ทุกครั้งที่เปิด
  const today = now();
  const pending = useMemo(() => (person ? pendingAftercareRounds(calls, person.phone_e164, today) : []), [person, calls]); // eslint-disable-line react-hooks/exhaustive-deps
  const [startYmd, setStartYmd] = useState<string>(() => person?.start_date ?? startYmdOfRounds(pending) ?? '');
  const [rounds, setRounds] = useState<MoveRoundDraft[]>(() =>
    pending.length > 0 && startYmd ? draftsFromPending(pending, startYmd) : [firstMoveRoundFor(startYmd || null, today)],
  );
  const [touched, setTouched] = useState(false);
  const [fromErp, setFromErp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeStart = (v: string, erp = false) => {
    setStartYmd(v);
    setFromErp(erp);
    setError(null);
    if (touched) return;
    // ยังไม่แตะรอบ: มีสายเดิม = นับวันใหม่จากวันเริ่มงานที่เปลี่ยน (เวลาสายเดิมไม่ขยับ) · ไม่มี = รอบแรกคิดใหม่
    setRounds(pending.length > 0 && v ? draftsFromPending(pending, v) : [firstMoveRoundFor(v || null, now())]);
  };
  useEffect(() => {
    if (!person || startYmd) return;
    let alive = true;
    void fetchErpInformDates([person.phone_e164]).then((m) => {
      const d = erpInformDateOf(m, person.phone_e164);
      if (alive && d) changeStart(d, true);
    });
    return () => {
      alive = false;
    };
    // โหลดครั้งเดียวตอนเปิด (remount ต่อคน)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staffPhone = useMemo(() => {
    for (const r of [...pending].reverse()) if ((r.staff_phone ?? '').trim()) return (r.staff_phone ?? '').trim();
    return '';
  }, [pending]);

  const submit = async () => {
    if (!person || busy) return;
    if (!startYmd) {
      setError('เลือกวันเริ่มงานก่อน');
      return;
    }
    const invalid = validateMoveRounds(rounds, startYmd, now());
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (startYmd !== (person.start_date ?? '')) {
        await updateAftercare({ phone: person.phone_e164, start_date: startYmd });
      }
      if (pending.length > 0) {
        const result = await replaceFollowSchedule(pending[0].id, {
          replace_ids: pending.map((r) => r.id),
          rounds: buildScheduleReplaceRounds(rounds, startYmd),
        });
        setBusy(false);
        onDone(
          result.lumos.pushed
            ? `แก้รอบของ ${person.full_name} แล้ว · ${rounds.length} รอบ`
            : `แก้รอบของ ${person.full_name} แล้ว แต่ส่งแผนให้ Lumos ไม่สำเร็จ${result.lumos.reason ? ` (${result.lumos.reason})` : ''}`,
        );
        return;
      }
      const list = buildMoveCalls(rounds, startYmd, staffPhone);
      const first = list[0];
      await createFollowRounds({
        recipient_name: person.full_name,
        recipient_phone: person.phone_e164,
        topic: AFTERCARE_TOPIC,
        staff_phone: first.staffPhone || undefined,
        scheduled_at: first.scheduledAt,
        call_round: first.callRound,
        call_mode: first.callMode,
        group_id: crypto.randomUUID(),
        unit_name: person.unit_name || undefined,
        site_code: person.site_code || undefined,
        start_date: startYmd,
        rounds: list.map((c) => ({
          scheduled_at: c.scheduledAt,
          staff_phone: c.staffPhone || undefined,
          call_round: c.callRound,
          call_mode: c.callMode,
        })),
      });
      setBusy(false);
      onDone(`ตั้งรอบของ ${person.full_name} แล้ว · ${list.length} รอบ`);
    } catch (e) {
      setError(friendlyErrorText(e, 'บันทึกรอบไม่สำเร็จ'));
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(person)} onOpenChange={(o) => (!o && !busy ? onClose() : undefined)}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ตั้งรอบโทรถามความเป็นอยู่</DialogTitle>
          <DialogDescription>
            {person ? `${person.full_name}${person.unit_name ? ` · ${person.unit_name}` : ''}` : ''}
          </DialogDescription>
        </DialogHeader>

        <MoveRoundsEditor
          startYmd={startYmd}
          onStartChange={(v) => changeStart(v)}
          fromErp={fromErp}
          rounds={rounds}
          onRoundsChange={(next) => {
            setTouched(true);
            setRounds(next);
          }}
          busy={busy}
          now={today}
        />

        {error ? (
          <p role="alert" className={cn('text-xs font-medium', TONE.danger.value)}>
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
