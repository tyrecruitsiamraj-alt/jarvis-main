/**
 * ═══ เติม "รายได้ + สวัสดิการ" ตอนยิงงานให้ Lumos (เจ้าของ 5 ต.ค. 2569: *"ให้บทเสนองานเดิมพูดรายได้ด้วย"*) ═══
 *
 * ของเดิมเติมตอน **Lumos มาดึงคิว** (`takePendingLumosItems`) — ตั้งแต่ 28 ก.ย. Lumos ไม่ดึงแล้ว เราเป็นฝ่ายยิง (push)
 * ⇒ ทุกเส้นที่ยิงไปเงียบเรื่องเงินมาตลอด · ย้ายจังหวะเติมมาที่ตัวยิง (รอบแรก + รอบส่งซ้ำ) ประโยคเดียวกับของเดิมเป๊ะ
 *
 * 🔴 สูตรเดียวกับเดิม: `monthlyGuaranteedIncome` (= หน้าประกาศ) + `speakableBenefitLine` · ERP ล่ม/ช้า = ยิงแบบไม่พูดเรื่องเงิน
 *    (ไม่ให้งานค้าง · "ไม่พูด" ปลอดภัยกว่า "พูดเลขที่ไม่รู้หน่วย")
 * 🔴 ไม่พูดซ้ำ: payload ที่มีคำว่า "บาท" อยู่แล้ว (บทผู้สมัครผ่านลิงก์ใส่รายได้ไว้เองตอนเข้าคิว · หรือเติมไปแล้ว) = ข้าม
 *    + `appendExtraInfoToPayload` กันซ้ำด้วยเครื่องหมายของมันอีกชั้น
 * งานติดตาม (job_ref `follow`) ไม่มีเลขใบขอ ⇒ ไม่โดนเติม (เหมือนเดิม)
 */
import { fetchJobBenefitRates, monthlyGuaranteedIncome, requestNoFromJobRef, speakableBenefitLine } from './siamrajJobBenefits.js';
import { appendExtraInfoToPayload, buildExtraInfoSentence } from './lumosCallScript.js';
import { logError } from './logger.js';

const TIMEOUT_MS = 4000;

/** ใบขอของ payload — รหัสลูกค้าทุกแบบขึ้นต้นด้วย `<jobRef>::` (interview: client_candidate_id · reminder: client_contact_id) */
export function jobRefOfPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const id = typeof p.client_candidate_id === 'string' ? p.client_candidate_id : p.client_contact_id;
  if (typeof id !== 'string' || !id.includes('::')) return null;
  return id.slice(0, id.indexOf('::')).trim() || null;
}

/** บทนี้พูดเรื่องเงินอยู่แล้วไหม */
export function payloadMentionsMoney(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as { questions?: unknown; steps?: unknown };
  const texts: string[] = [];
  if (Array.isArray(p.questions)) for (const q of p.questions) if (typeof q === 'string') texts.push(q);
  if (Array.isArray(p.steps)) {
    for (const s of p.steps) {
      const m = (s as { message?: unknown } | null)?.message;
      if (typeof m === 'string') texts.push(m);
    }
  }
  return texts.some((t) => t.includes('บาท'));
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

/** เติมรายได้ลง payload ที่ยังไม่พูดเรื่องเงิน (แก้ object ที่ส่งมาตรง ๆ) · คืนจำนวนที่เติม · ไม่ throw */
export async function enrichPayloadsWithIncome(payloads: readonly unknown[]): Promise<number> {
  const todo = payloads
    .map((p) => ({ p, no: requestNoFromJobRef(jobRefOfPayload(p) ?? '') }))
    .filter((x): x is { p: unknown; no: string } => Boolean(x.no) && !payloadMentionsMoney(x.p));
  if (todo.length === 0) return 0;
  try {
    const byNo = await withTimeout(
      fetchJobBenefitRates([...new Set(todo.map((x) => x.no))]),
      TIMEOUT_MS,
      new Map(),
    );
    let added = 0;
    for (const { p, no } of todo) {
      const rates = byNo.get(no);
      if (!rates || rates.length === 0) continue;
      const sentence = buildExtraInfoSentence({
        monthlyIncome: monthlyGuaranteedIncome(rates).total,
        benefitLine: speakableBenefitLine(rates),
      });
      if (!sentence) continue;
      appendExtraInfoToPayload(p, sentence);
      added += 1;
    }
    return added;
  } catch (e) {
    logError('lumos.push.income.failed', e, { hint: 'อ่านอัตราจาก ERP ไม่ได้ — ยิงแบบไม่พูดเรื่องเงิน (งานยังส่งปกติ)' });
    return 0;
  }
}
