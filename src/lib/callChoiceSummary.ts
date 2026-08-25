/**
 * สรุปผลการกด "เก็บไปโทรเอง" / "ส่ง AI โทร" เป็นข้อความเดียวบนจอ
 *
 * 🔴 กติกา: **ทำไม่ได้ต้องเห็น** — บางใบเก็บสำเร็จแต่ล็อกเบอร์ไม่ได้ (ไม่มีเบอร์ /
 * ใบไม่ผูกใบขอ) ซึ่งแปลว่า AI ยังโทรทับได้ · กลืนทิ้งแล้วขึ้นแค่ "สำเร็จ 5 คน"
 * = คนเข้าใจผิดว่าปลอดภัยแล้ว (บทเรียนเดิม: ปุ่มที่กดแล้วเงียบ)
 */
import { CALL_CHOICE_LABEL, type CallChoice } from '@/lib/callChoiceGuard';

export type CallChoiceLike = {
  choice: Extract<CallChoice, 'manual' | 'ai'>;
  done: number;
  skipped: Array<{ name: string; reason: string }>;
};

/** จำนวนชื่อที่พิมพ์ในเหตุผลก่อนยุบเป็น "และอีก N คน" */
const NAMES_SHOWN = 3;

export function summarizeCallChoice(outcome: CallChoiceLike): string {
  const verb = outcome.choice === 'manual' ? CALL_CHOICE_LABEL.manual : CALL_CHOICE_LABEL.ai;
  const head =
    outcome.done > 0
      ? outcome.choice === 'manual'
        ? `${verb} ${outcome.done} คน — จองใบ + ล็อกเบอร์กัน AI โทรทับแล้ว`
        : `${verb} ${outcome.done} คน — เข้าคิวแล้ว`
      : `ยัง${verb}ไม่ได้เลย`;
  if (outcome.skipped.length === 0) return head;

  // จัดกลุ่มตามเหตุผล — เหตุผลเดียวกันหลายคนอ่านง่ายกว่ารายคนยาวเป็นพืด
  const byReason = new Map<string, string[]>();
  for (const s of outcome.skipped) {
    const list = byReason.get(s.reason) ?? [];
    list.push(s.name);
    byReason.set(s.reason, list);
  }
  const detail = [...byReason.entries()]
    .map(([reason, names]) => {
      const shown = names.slice(0, NAMES_SHOWN).join(', ');
      const more = names.length > NAMES_SHOWN ? ` และอีก ${names.length - NAMES_SHOWN} คน` : '';
      return `${shown}${more}: ${reason}`;
    })
    .join(' · ');
  return `${head} · ข้าม ${outcome.skipped.length} คน — ${detail}`;
}
