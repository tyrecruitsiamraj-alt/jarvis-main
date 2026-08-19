/**
 * อ่านสัญญาณสถานะระบบจากฐาน — ตัวตัดสินว่าเขียว/เหลือง/แดงอยู่ที่ `src/lib/systemHealth.ts`
 *
 * ⚠️ **ห้ามยิง ERP จากไฟล์นี้** — ใช้ผลรอบล่าสุดของตัวย้ายใบสมัคร (มันยิงทุก 15 นาทีอยู่แล้ว)
 * ไม่งั้นหน้าสถานะที่คนเปิดรีเฟรชรัว ๆ จะกลายเป็นตัวถล่ม ERP เอง
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError } from './logger.js';
import { getLastAutoMoveRun, getAutoMoveWorkerConfig } from './applicationAutoMoveWorker.js';
import { getLumosDispatchMode } from './lumosDispatchMode.js';
import type { HealthSignals } from '../../src/lib/systemHealth.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');
const batchTable = tableInAppSchema('lumos_call_batches');
const holdTable = tableInAppSchema('candidate_call_holds');

export type SwitchRow = {
  key: string;
  label: string;
  state: 'on' | 'off' | 'partial';
  stateLabel: string;
  note: string;
};

export type StaleItem = {
  kind: 'confirmed_no_owner' | 'batch_pending';
  title: string;
  subtitle: string;
  ageMinutes: number;
  link: string;
};

function truthyEnv(raw: string | undefined): boolean {
  const v = String(raw ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

/** สัญญาณดิบสำหรับไฟ 4 ดวง */
export async function readHealthSignals(): Promise<HealthSignals> {
  const lastRun = getLastAutoMoveRun();
  let lumosPullAt: string | null = null;
  let lumosResultAt: string | null = null;
  let queueDueNow = 0;
  let queueWaiting = 0;

  try {
    const { rows } = await dbQuery<{
      pull_at: string | null;
      result_at: string | null;
      due_now: string;
      waiting: string;
    }>(
      `select max(delivered_at) as pull_at,
              max(last_result_at) as result_at,
              count(*) filter (
                where status = 'pending' and result is null and delivery_count < 5
                  and (next_attempt_at is null or next_attempt_at <= now())
              ) as due_now,
              count(*) filter (where status = 'pending' and next_attempt_at > now()) as waiting
         from ${queueTable}`,
    );
    const r = rows[0];
    lumosPullAt = r?.pull_at ?? null;
    lumosResultAt = r?.result_at ?? null;
    queueDueNow = Number(r?.due_now) || 0;
    queueWaiting = Number(r?.waiting) || 0;
  } catch (e) {
    // อ่านคิวไม่ได้ = ปล่อยค่าเป็น null แล้วให้ตัวตัดสินตีเป็นเหลือง (ไม่รู้สถานะ ≠ ปกติ)
    logError('systemHealth.queue.failed', e);
  }

  return {
    lumosPullAt,
    lumosResultAt,
    queueDueNow,
    queueWaiting,
    // ERP: อ้างผลรอบล่าสุดของตัวย้ายใบสมัคร — `error` ไม่ว่าง = อ่านไม่ได้
    erpOk: lastRun ? !lastRun.error : null,
    erpOpenJobs: lastRun?.openJobs ?? 0,
    erpCheckedAt: lastRun?.at ?? null,
  };
}

/** สวิตช์ทั้งระบบ — ที่เดียวที่ตอบได้ว่า "ตอนนี้อะไรเปิดอยู่บ้าง" */
export async function readSwitches(): Promise<SwitchRow[]> {
  const move = getAutoMoveWorkerConfig();
  let modes: Record<string, string> = {};
  try {
    modes = (await getLumosDispatchMode()) as unknown as Record<string, string>;
  } catch (e) {
    logError('systemHealth.modes.failed', e);
  }
  const autoModes = Object.entries(modes).filter(([, v]) => v === 'auto').map(([k]) => k);

  return [
    {
      key: 'applicationAutoDispatch',
      label: 'ใบสมัครหน้าสาธารณะ → AI โทร',
      state: truthyEnv(process.env.APPLICATION_AUTO_DISPATCH_ENABLED) ? 'on' : 'off',
      stateLabel: truthyEnv(process.env.APPLICATION_AUTO_DISPATCH_ENABLED) ? 'เปิด' : 'ปิด',
      note: 'ตั้งที่ APPLICATION_AUTO_DISPATCH_ENABLED',
    },
    {
      key: 'applicationAutoMove',
      label: 'ย้ายใบสมัครอัตโนมัติ',
      state: !move.enabled ? 'off' : move.apply ? 'on' : 'partial',
      stateLabel: !move.enabled ? 'ปิด' : move.apply ? 'ย้ายจริง' : 'ลองดูอย่างเดียว',
      note: move.enabled ? `เดินทุก ${Math.round(move.intervalMs / 60_000)} นาที` : 'ตัวตั้งเวลาไม่ทำงาน',
    },
    {
      key: 'lumosModes',
      label: 'โหมดส่งงานให้ Lumos',
      state: autoModes.length > 0 ? 'partial' : 'off',
      stateLabel: autoModes.length > 0 ? `อัตโนมัติ ${autoModes.length} เส้น` : 'คนกดเองทุกเส้น',
      note: autoModes.length > 0 ? autoModes.join(' · ') : 'ตั้งที่ ตั้งค่า → โหมดส่งงานให้ Lumos',
    },
    {
      key: 'matchPrecompute',
      label: 'คิดผล AI ล่วงหน้า',
      state: truthyEnv(process.env.MATCH_PRECOMPUTE_ENABLED) ? 'on' : 'off',
      stateLabel: truthyEnv(process.env.MATCH_PRECOMPUTE_ENABLED) ? 'เปิด' : 'ปิด',
      note: 'ตั้งที่ MATCH_PRECOMPUTE_ENABLED',
    },
  ];
}

/** เกินกี่นาทีถือว่า "ปล่อยไว้นานเกินไป" สำหรับคนที่ AI บอกว่าสนใจ */
export const CONFIRMED_OWNER_LIMIT_MIN = 120;

/**
 * ของค้างที่ยังไม่มีใครรับ
 * 🔴 "สนใจแล้วไม่มีคนตาม" คือของที่แพงที่สุดที่หลุดมือได้ — เคยเจอจริง 2 คนบนใบ DSO6809001
 * แจ้งเตือนถูกอ่านแล้วทั้งคู่ แต่ไม่มีใครกดรับ ระบบเลยไม่รู้ว่ามีคนทำต่อหรือยัง
 */
export async function readStaleItems(now = new Date()): Promise<StaleItem[]> {
  const out: StaleItem[] = [];

  try {
    const { rows } = await dbQuery<{
      name: string | null;
      job_ref: string;
      at: string | null;
    }>(
      `select coalesce(q.payload->>'candidate_name', q.payload->>'recipient_name') as name,
              q.job_ref, q.last_result_at as at
         from ${queueTable} q
        where coalesce(q.last_outcome, q.result->>'outcome') = 'confirmed'
          and not exists (
            select 1 from ${holdTable} h
             where h.phone_e164 = coalesce(q.payload->>'phone', q.payload->>'recipient_phone')
               and h.released_at is null
          )
        order by q.last_result_at asc nulls last
        limit 20`,
    );
    for (const r of rows) {
      const at = r.at ? new Date(r.at).getTime() : NaN;
      out.push({
        kind: 'confirmed_no_owner',
        title: r.name?.trim() || 'ไม่ทราบชื่อ',
        subtitle: `AI บอกว่าสนใจ · ${r.job_ref.split(':').pop() || r.job_ref}`,
        ageMinutes: Number.isNaN(at) ? 0 : Math.max(0, Math.floor((now.getTime() - at) / 60_000)),
        link: '/matching/contact',
      });
    }
  } catch (e) {
    logError('systemHealth.confirmed.failed', e);
  }

  try {
    const { rows } = await dbQuery<{ id: string; created_at: string; request_no: string | null }>(
      `select id, created_at, request_no from ${batchTable}
        where status = 'pending_approval' order by created_at asc limit 10`,
    );
    for (const r of rows) {
      const at = new Date(r.created_at).getTime();
      out.push({
        kind: 'batch_pending',
        title: 'ชุดส่งงานรออนุมัติ',
        subtitle: r.request_no ? `ใบขอ ${r.request_no}` : 'ยังไม่มีใครอนุมัติหรือยกเลิก',
        ageMinutes: Number.isNaN(at) ? 0 : Math.max(0, Math.floor((now.getTime() - at) / 60_000)),
        link: '/matching/match',
      });
    }
  } catch (e) {
    logError('systemHealth.batches.failed', e);
  }

  return out.sort((a, b) => b.ageMinutes - a.ageMinutes);
}
