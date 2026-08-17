/**
 * นโยบายการโทรตามฝั่ง server — อ่าน/เขียนค่าใน app_call_followup_policy (migration 073)
 *
 * ความหมายของค่า + การ normalize อยู่ที่ src/lib/callFollowupPolicy.ts ที่เดียว
 * ไฟล์นี้แค่เก็บกับอ่าน + cache (แพตเทิร์นเดียวกับ lumosDispatchMode.ts)
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import {
  DEFAULT_CALL_FOLLOWUP_POLICY,
  normalizeCallFollowupPolicy,
  type CallFollowupPolicy,
} from '../../src/lib/callFollowupPolicy.js';

const table = tableInAppSchema('app_call_followup_policy');

/**
 * cache สั้น — นโยบายถูกอ่านทุกครั้งที่มีผลโทรกลับ/เข้าคิว ไม่ควรยิง DB ทุกรอบ
 * 60 วินาทีพอให้แก้ที่หน้า Follow แล้วเห็นผลเร็ว (setCallFollowupPolicy ล้างให้ทันทีอยู่แล้ว)
 */
let cached: { value: CallFollowupPolicy; expiresAt: number } | null = null;
const TTL_MS = 60 * 1000;

/** ล้าง cache — เรียกหลังเขียนค่า และใช้ในเทสต์ */
export function clearCallFollowupPolicyCache(): void {
  cached = null;
}

/**
 * ตารางยังไม่ migrate → ค่าเริ่มต้นในโค้ด (พฤติกรรมเดิมเป๊ะ)
 * DB ล้มด้วยเหตุอื่น → โยนต่อ ไม่กลืน — ไม่งั้นระบบเงียบ ๆ ใช้เพดานโทร/ช่วงเวลา
 * คนละชุดกับที่เจ้าของตั้งไว้ (เช่น ตั้งไว้ 1 ครั้งแต่โทรไป 3)
 */
export async function getCallFollowupPolicy(): Promise<CallFollowupPolicy> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  let value = DEFAULT_CALL_FOLLOWUP_POLICY;
  try {
    const { rows } = await dbQuery<{ payload: unknown }>(
      `select payload from ${table} where id = 'default' limit 1`,
    );
    value = normalizeCallFollowupPolicy(rows[0]?.payload ?? null);
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
  }
  cached = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

export async function setCallFollowupPolicy(
  next: CallFollowupPolicy,
  updatedByName: string | null,
): Promise<CallFollowupPolicy> {
  const { rows } = await dbQuery<{ payload: unknown }>(
    `insert into ${table} (id, payload, updated_at, updated_by_name)
     values ('default', $1::jsonb, now(), $2)
     on conflict (id) do update
       set payload = $1::jsonb, updated_at = now(), updated_by_name = $2
     returning payload`,
    [JSON.stringify(next), updatedByName],
  );
  clearCallFollowupPolicyCache();
  return normalizeCallFollowupPolicy(rows[0]?.payload ?? null);
}
