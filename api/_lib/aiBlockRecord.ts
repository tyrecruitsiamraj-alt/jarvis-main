/**
 * จดเหตุที่ยังไม่ส่ง AI ไว้กับใบ (169 · เจ้าของ 28 ต.ค. 2569 "ทำไมไม่โทร") — แท็บผู้สมัครแยกกล่องตามเหตุนี้ (`src/lib/aiBlockReasons.ts`)
 * เรียกจากตัวส่งซ้ำทุก 5 นาที และปุ่ม "ส่ง AI โทร" (26 พ.ย. 2569 · เดิมจดแค่ตัวส่งซ้ำ คนกดแล้วติดเหตุ กล่องไม่เปลี่ยน)
 * เขียนเฉพาะตอนเหตุเปลี่ยน · จดไม่ได้ = ข้าม ไม่ทำให้การส่งล้ม
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError } from './logger.js';

const APPS = tableInAppSchema('public_job_applications');

export async function recordAiBlockReasons(skipped: ReadonlyArray<{ ref: string; reason: string }>): Promise<void> {
  const ids: string[] = [];
  const reasons: string[] = [];
  for (const s of skipped) {
    const m = /^app-([0-9a-f-]{36})$/i.exec(s.ref);
    if (!m) continue;
    ids.push(m[1]);
    reasons.push(s.reason);
  }
  if (ids.length === 0) return;
  try {
    await dbQuery(
      `update ${APPS} a set ai_block_reason = v.reason, ai_block_at = now()
         from unnest($1::uuid[], $2::text[]) as v(id, reason)
        where a.id = v.id and a.ai_block_reason is distinct from v.reason`,
      [ids, reasons],
    );
  } catch (e) {
    logError('applicationDispatchRetry.block_reason_failed', e);
  }
}
