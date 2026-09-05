import type { ToneKey } from '@/lib/designTokens';
import type { CallFunnel } from '@/lib/callFunnelApi';

/**
 * แผง "AI โทร" หน้า Matching — 2 แถว (AI · คนเก็บไปโทร) สถานะช่องเดียวกัน ในกรอบเดียว
 * (เจ้าของสั่ง 14 ส.ค. 2569)
 *
 * ทั้งไฟล์เป็นฟังก์ชันล้วน — แยกไว้ให้เทสต์คุมว่าเลขช่องไหนมาจาก field ไหน
 * ⚠️ ทั้งสองแถวใช้ **ลำดับช่องเดียวกันเป๊ะ** เพื่อให้คอลัมน์ตรงกัน (เจ้าของเน้น "ให้ตรงกัน")
 */
export type CallFlowCell = {
  key: string;
  label: string;
  tone: ToneKey;
  /**
   * ช่องนี้ตอบคำถามไหน (แผนแก้จุดงงข้อ 1 · 2 ก.ย. 2569)
   * `where` = "ตอนนี้สายไปถึงขั้นไหน" · `result` = "ผลจากคนที่คุยแล้ว"
   * (คำบนจอเปลี่ยนตามเจ้าของเคาะ 5 ก.ย. 2569 — ชื่อ group ในโค้ดยังคงเดิม)
   *
   * 🔴 Haiku ทดสอบแล้วเอา 7 ช่องมาบวกกันได้ 128 แล้วเทียบกับ "ทั้งหมด 47" แล้วเลิกเชื่อ
   * — ช่องพวกนี้ซ้อนกันได้โดยธรรมชาติ (รับสายแล้ว "สนใจ" อยู่ทั้งสองช่อง) ⇒ ต้องจัดเป็น
   * สองกลุ่มติดหัวให้เห็นว่าตอบคนละคำถาม (ท่าเดียวกับหน้าติดตามที่แก้สำเร็จมาแล้ว)
   */
  group: 'where' | 'result';
  /** ค่าฝั่ง AI (Lumos) · null = ช่องนี้ฝั่งนั้นไม่มีข้อมูล → หน้าจอขึ้นขีด */
  ai: number | null;
  /** ค่าฝั่งคนเก็บไปโทร (candidate_call_holds) */
  human: number | null;
};

/** ผลรวมของหลาย outcome ใน byOutcome (undefined = 0) */
function sumOutcomes(by: Record<string, number>, keys: string[]): number {
  let n = 0;
  for (const k of keys) n += by[k] ?? 0;
  return n;
}

/**
 * 8 ช่องสถานะ เรียงตามที่เจ้าของสั่ง:
 * ทั้งหมด → กำลังโทร → รับสาย → สนใจ → ไม่สนใจ → ไม่รับสาย → ไม่สะดวกคุย → รอ AI โทรใหม่
 *
 * ⚠️ ฝั่ง AI "ไม่รับสาย" = unreached (รวม busy/ไม่ตอบ/โทรไม่สำเร็จ) ·
 * ฝั่งคนมีแค่ no_answer ตรง ๆ (คนบันทึกผลได้ 5 แบบ) — ต่างกันโดยธรรมชาติ ไม่ใช่บั๊ก
 */
export function aiCallFlowCells(funnel: CallFunnel): CallFlowCell[] {
  const ai = funnel.byOutcome;
  const h = funnel.human;
  const hby = h?.byOutcome ?? {};
  return [
    {
      key: 'total',
      label: 'ทั้งหมด',
      tone: 'neutral',
      group: 'where',
      ai: funnel.queuedActive,
      human: h ? h.total : null,
    },
    {
      key: 'calling',
      label: 'กำลังโทร / ถืออยู่',
      tone: 'primary',
      group: 'where',
      ai: funnel.delivered,
      human: h ? h.holding : null,
    },
    {
      key: 'connected',
      label: 'รับสาย / มีผลแล้ว',
      tone: 'info',
      group: 'result',
      ai: funnel.connected,
      human: h ? h.withResult : null,
    },
    {
      key: 'confirmed',
      label: 'สนใจ',
      tone: 'success',
      group: 'result',
      ai: ai.confirmed ?? 0,
      human: h ? (hby.confirmed ?? 0) : null,
    },
    {
      key: 'declined',
      label: 'ไม่สนใจ',
      tone: 'danger',
      group: 'result',
      ai: ai.declined ?? 0,
      human: h ? (hby.declined ?? 0) : null,
    },
    {
      key: 'no_answer',
      label: 'ไม่รับสาย',
      tone: 'warn',
      group: 'result',
      ai: sumOutcomes(ai, ['no_answer', 'busy', 'unresponsive', 'failed']),
      human: h ? (hby.no_answer ?? 0) : null,
    },
    {
      key: 'reschedule',
      label: 'ไม่สะดวกคุย',
      tone: 'orange',
      group: 'result',
      ai: ai.reschedule_requested ?? 0,
      human: h ? (hby.reschedule_requested ?? 0) : null,
    },
    {
      key: 'retry',
      label: 'รอ AI โทรใหม่',
      tone: 'violet',
      group: 'where',
      ai: funnel.retryScheduledState,
      // ฝั่งคน: "คืนให้ AI โทรต่อ" (release_reason='to_ai') = ความหมายเดียวกัน
      human: h ? h.toAi : null,
    },
  ];
}
