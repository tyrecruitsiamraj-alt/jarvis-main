/**
 * โหมดส่งงานให้ Lumos ฝั่ง server — อ่าน/เขียนค่าใน app_lumos_dispatch_mode
 *
 * ความหมายของค่าอยู่ที่ src/lib/lumosDispatchMode.ts ที่เดียว (ใช้ร่วมกับหน้าเว็บ)
 * ไฟล์นี้แค่เก็บกับอ่าน + cache
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import {
  DEFAULT_LUMOS_DISPATCH_MODE,
  normalizeLumosDispatchMode,
  type LumosDispatchModeConfig,
  type LumosDispatchTrigger,
} from '../../src/lib/lumosDispatchMode.js';

const table = tableInAppSchema('app_lumos_dispatch_mode');

/**
 * cache สั้น — isAutoDispatchEnabled() ถูกเรียกทุกครั้งที่แมทเสร็จ/ค้นหา/สร้าง follow
 * ไม่ควรยิง DB ทุกรอบ · 60 วินาทีพอให้กดเปลี่ยนที่หน้าตั้งค่าแล้วเห็นผลเร็ว
 * โดยไม่ต้องรอ deploy (และ setLumosDispatchMode() ล้าง cache ให้ทันทีอยู่แล้ว)
 */
let cached: { value: LumosDispatchModeConfig; expiresAt: number } | null = null;
const TTL_MS = 60 * 1000;

/** ล้าง cache — เรียกหลังเขียนค่า และใช้ในเทสต์ */
export function clearLumosDispatchModeCache(): void {
  cached = null;
}

export async function getLumosDispatchMode(): Promise<LumosDispatchModeConfig> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  let value = DEFAULT_LUMOS_DISPATCH_MODE;
  try {
    const { rows } = await dbQuery<{ payload: unknown }>(
      `select payload from ${table} where id = 'default' limit 1`,
    );
    value = normalizeLumosDispatchMode(rows[0]?.payload ?? null);
  } catch (e) {
    // ตารางยังไม่ migrate / DB ล่ม → manual ทุกจุด (ห้ามเผลอโทรออกเอง)
    if (!isPgUndefinedTable(e)) throw e;
  }
  cached = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

/**
 * จุดนี้ตั้งไว้ให้ส่งอัตโนมัติหรือยัง
 *
 * **ทุก call site ของ auto-send ต้องผ่านฟังก์ชันนี้** — ห้ามเรียก enqueue ตรง ๆ
 * (มีเทสต์กันที่ tests/api/lumosDispatchSelection.test.ts)
 */
export async function isAutoDispatchEnabled(trigger: LumosDispatchTrigger): Promise<boolean> {
  const config = await getLumosDispatchMode();
  return config[trigger] === 'auto';
}

/** จุดนี้ตั้งเป็น assist ไหม (ระบบจัดชุดรออนุมัติแทนการเข้าคิวตรง) */
export async function isAssistDispatchEnabled(trigger: LumosDispatchTrigger): Promise<boolean> {
  const config = await getLumosDispatchMode();
  return config[trigger] === 'assist';
}

export async function setLumosDispatchMode(
  next: LumosDispatchModeConfig,
  updatedByName: string | null,
): Promise<LumosDispatchModeConfig> {
  const { rows } = await dbQuery<{ payload: unknown }>(
    `insert into ${table} (id, payload, updated_at, updated_by_name)
     values ('default', $1::jsonb, now(), $2)
     on conflict (id) do update
       set payload = $1::jsonb, updated_at = now(), updated_by_name = $2
     returning payload`,
    [JSON.stringify(next), updatedByName],
  );
  clearLumosDispatchModeCache();
  return normalizeLumosDispatchMode(rows[0]?.payload ?? null);
}
