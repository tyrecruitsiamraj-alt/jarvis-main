import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import {
  FOLLOW_OUTCOMES,
  FOLLOW_OUTCOME_HINT,
  FOLLOW_OUTCOME_LABEL,
  type FollowOutcome,
} from '@/lib/followOutcome';
import type { FollowStopScope } from '@/lib/followApi';

/**
 * ปิดงานติดตาม (migration 095 · ชุดคำใหม่ 101)
 *
 * เจ้าของสั่ง 18 ส.ค. 2569: *"เหลือไว้แค่ปุ่ม เสร็จสิ้น แก้ไข ยกเลิก ปุ่มเสร็จสิ้น
 * เมื่อกดแล้วมีให้เลือกว่าเสร็จสิ้นเพราะไปแล้ว ถึงแล้ว หรือ ยกเลิก ลา เลื่อน"*
 *
 * → **ปุ่มเดียว** ("เสร็จสิ้น") แล้วกางให้เลือก 5 คำ · ปุ่ม "เหตุอื่น…" ถูกถอดออก
 * ⚠️ เดิมกด "เสร็จสิ้น" = ปิดงานทันทีด้วยค่า `done` โดยไม่ถามอะไร — ตอนนี้ **ไม่ปิดทันที**
 * อีกแล้ว ต้องเลือกคำก่อนเสมอ (เจ้าของต้องการรู้ว่า "ไปแล้ว" กับ "ถึงแล้ว" ต่างกัน)
 *
 * ⚠️ **แยกจากปุ่ม "ยกเลิก" ที่อยู่ข้าง ๆ โดยตั้งใจ** — ปุ่มยกเลิก = ตัดสายทิ้งก่อนถึงวัน
 * (ไม่ต้องตามแล้ว · ไปแตะคิว Lumos) · คำ "ยกเลิก" ในนี้ = ตามจนจบแล้วและงานถูกยกเลิก
 * ยุบรวมเมื่อไหร่ สถิติต้นเหตุจะแยกไม่ออกว่า "ไม่ได้ตาม" กับ "ตามแล้วเขาไม่ไป" ต่างกันยังไง
 */
const FollowCompleteControls: React.FC<{
  busy?: boolean;
  /**
   * กาง 5 คำไว้ตั้งแต่แรก + ไม่มีปุ่มพับ — ใช้ในป๊อป "ไม่ย้าย" ของการ์ดติดตามครบ
   * (1 ต.ค. 2569 · ป๊อปมีปุ่มปิดของตัวเองอยู่แล้ว)
   */
  alwaysOpen?: boolean;
  /** `stopScope` — สายที่เหลือหยุดแค่ไหน (5 ต.ค. 2569): ทุกผล = วันนั้น · "ยกเลิก" ให้คนกดเลือก วันนั้น/ทั้งชุด */
  onComplete: (outcome: FollowOutcome, note?: string, stopScope?: FollowStopScope) => void | Promise<void>;
}> = ({ busy = false, alwaysOpen = false, onComplete }) => {
  const [open, setOpen] = useState(alwaysOpen);
  const [note, setNote] = useState('');
  /** กด "ยกเลิก" แล้วถามก่อนว่าหยุดสายที่เหลือแค่วันนี้หรือทั้งชุด (เจ้าของ Choice 5 ต.ค. 2569 "ให้เขาเลือกได้") */
  const [askCancelScope, setAskCancelScope] = useState(false);

  const submit = async (outcome: FollowOutcome, stopScope: FollowStopScope = 'day') => {
    await onComplete(outcome, note.trim() || undefined, stopScope);
    if (!alwaysOpen) setOpen(false);
    setNote('');
    setAskCancelScope(false);
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => setOpen(true)}
        /* กดแล้วยัง**ไม่ปิดทันที** — กางให้เลือกเหตุผลก่อน · คนใหม่ไม่รู้ ต้องบอก */
        title="ปิดงานติดตามรายนี้"
        /**
         * 🔴 **คำบนปุ่มต้องขึ้นต้นด้วยกริยา และห้ามใช้สีเขียวแบบป้ายสถานะ**
         * (เจ้าของทัก 1 ก.ย. 2569: *"ทำไมขึ้นว่าเสร็จสิ้น เพราะในระบบ Lumos บอกยกเลิก
         * งี้จะเชื่อนายได้ไง"* — สิ่งที่อ่านว่าเป็นสถานะ จริง ๆ คือปุ่มสั่งปิดงานใบนี้)
         * คำว่า "เสร็จสิ้น" ยังอยู่ตามที่เจ้าของสั่งไว้ 18 ส.ค. 2569 แค่เติมกริยานำหน้า
         */
        className="min-h-9 gap-1 px-3 text-[11px] font-medium"
      >
        <CheckCircle2 aria-hidden />
        {busy ? 'กำลังบันทึก…' : 'บันทึกว่าเสร็จสิ้น'}
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-border/70 bg-muted/30 p-2.5">
      <p className="text-[11px] font-medium text-foreground">ปิดงานนี้เพราะอะไร</p>
      <div className="flex flex-wrap gap-1.5">
        {FOLLOW_OUTCOMES.map((o) => (
          <Button
            key={o}
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            title={FOLLOW_OUTCOME_HINT[o]}
            onClick={() => (o === 'cancelled' ? setAskCancelScope(true) : void submit(o))}
            className="min-h-8 px-3 text-[11px]"
          >
            {FOLLOW_OUTCOME_LABEL[o]}
          </Button>
        ))}
      </div>
      {askCancelScope ? (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="หยุดสายที่เหลือ" data-testid="cancel-stop-scope">
          <span className="text-[11px] text-muted-foreground">หยุดสายที่เหลือ</span>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void submit('cancelled', 'day')} className="min-h-8 px-3 text-[11px]">
            แค่วันนี้
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void submit('cancelled', 'set')} className="min-h-8 px-3 text-[11px]">
            ทั้งชุด
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setAskCancelScope(false)} className="min-h-8 px-3 text-[11px]">
            ไม่ยกเลิก
          </Button>
        </div>
      ) : null}
      {/* หมายเหตุไม่บังคับแล้ว (ชุดใหม่ไม่มี "อื่น ๆ") — พิมพ์ก่อนกดคำ เดี๋ยวเก็บไปด้วย */}
      <input
        type="text"
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
        placeholder="หมายเหตุ (ถ้ามี)"
        className="min-h-[36px] rounded-lg border border-border bg-background px-2.5 text-[12px]"
      />
      {alwaysOpen ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(false);
            setNote('');
          }}
          className="min-h-8 w-fit px-3 text-[11px]"
        >
          ปิด
        </Button>
      )}
    </div>
  );
};

export default FollowCompleteControls;
