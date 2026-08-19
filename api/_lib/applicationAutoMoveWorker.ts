/**
 * ตัวตั้งเวลาย้ายใบสมัครอัตโนมัติ (เจ้าของเคาะ 19 ส.ค. 2569)
 *
 * เส้น `/api/application-auto-move` มีมาตั้งแต่ 098 แต่ไม่มีใครเรียกเอง — ไฟล์นี้คือตัวเรียก
 * แพตเทิร์นเดียวกับ `matchPrecomputeWorker`: วนรอบใน process API on-prem (`server/local-api.ts`)
 * **ปิดโดยค่าเริ่มต้น** เปิดด้วย `APPLICATION_AUTO_MOVE_ENABLED=true`
 *
 * 🔴 **สองสวิตช์ ไม่ใช่สวิตช์เดียว** — เปิด worker แล้วยัง "ลองดูอย่างเดียว" อยู่
 * ต้องสั่ง `APPLICATION_AUTO_MOVE_APPLY=true` อีกตัวถึงจะเขียนจริง
 * เพราะตัวนี้แตะใบสมัครของคนจริง เจ้าของสั่งให้ดูก่อนว่า "รอบนี้จะย้ายใครไปไหน"
 *
 * 🔴 ผลรอบล่าสุดเก็บไว้ในหน่วยความจำของ process — รีสตาร์ตแล้วหาย (ตั้งใจ ไม่ต้องมีตารางใหม่)
 * หน้าเว็บอ่านผ่าน `GET /api/application-auto-move-status`
 */
import { logError, logInfo, logWarn } from './logger.js';
import { listSiamrajUnitRequests } from './siamrajUnitRequests.js';
import { runApplicationAutoMove } from './applicationAutoMoveRunner.js';
import { inferDistrictFromAddress, inferProvinceFromAddress } from '../../src/lib/parseThaiJobAddress.js';
import { publicJobPositionLabel } from '../../src/lib/unitRequestDisplay.js';
import {
  readAutoMoveWorkerConfig,
  type AutoMoveRunState,
  type AutoMoveWorkerConfig,
} from '../../src/lib/applicationAutoMoveReport.js';
import type { AutoMoveTargetJob } from '../../src/lib/applicationAutoMove.js';
import type { JobRequest } from '../../src/types/index.js';

let lastRun: AutoMoveRunState | null = null;
let running = false;
let stopped = false;

export function getAutoMoveWorkerConfig(): AutoMoveWorkerConfig {
  return readAutoMoveWorkerConfig(process.env);
}

/** ผลรอบล่าสุด — null = ยังไม่เคยเดิน */
export function getLastAutoMoveRun(): AutoMoveRunState | null {
  return lastRun;
}

/**
 * แปลงใบขอจาก feed เป็นรูปที่ตัวจับคู่กิน
 * ⚠️ ก๊อปตรรกะเดียวกับ handler โดยตั้งใจ**ไม่ได้** — import จาก handler ไม่ได้เพราะมันพันกับ req/res
 * ถ้าแก้ที่นี่ต้องแก้ `api/_handlers/application-auto-move.ts` ด้วย (จังหวัด/อำเภอที่คนแก้มาก่อนค่าที่เดา)
 */
function toTargetJob(j: JobRequest): AutoMoveTargetJob {
  const addr = j.location_address || '';
  return {
    id: j.id,
    request_no: j.request_no ?? null,
    unit_name: j.unit_name ?? null,
    province: (j.override_province || inferProvinceFromAddress(addr) || '') || null,
    district: (j.override_district || inferDistrictFromAddress(addr) || '') || null,
    position: publicJobPositionLabel(j) || null,
  };
}

/**
 * เดินหนึ่งรอบแล้วเก็บผลไว้ให้หน้าเว็บอ่าน
 * export ไว้ให้ปุ่ม "ลองดูตอนนี้" บนหน้าตั้งค่าเรียกได้ด้วย (ไม่ต้องรอรอบถัดไป)
 */
export async function runAutoMoveOnce(opts: { apply?: boolean; limit?: number } = {}): Promise<AutoMoveRunState> {
  const cfg = getAutoMoveWorkerConfig();
  const apply = opts.apply ?? cfg.apply;
  const limit = opts.limit ?? cfg.limit;
  try {
    const items = (await listSiamrajUnitRequests({ limit: 500, mode: 'all' })) as unknown as JobRequest[];
    // ใบที่ยังเปิดอยู่เท่านั้น — ตัวจับคู่เชื่อว่าที่ส่งมาเปิดหมดแล้ว
    const openJobs = items
      .filter((j) => j.status === 'open' || j.status === 'in_progress')
      .map(toTargetJob);
    const res = await runApplicationAutoMove(openJobs, { dryRun: !apply, limit });
    lastRun = {
      at: new Date().toISOString(),
      dryRun: !apply,
      scanned: res.scanned,
      moved: res.moved,
      skipped: res.skipped,
      openJobs: openJobs.length,
      reasons: res.reasons,
      details: res.details,
      error: null,
    };
    logInfo('application.autoMove.worker.run', {
      dryRun: !apply,
      scanned: res.scanned,
      moved: res.moved,
      openJobs: openJobs.length,
    });
  } catch (e) {
    // 🔴 รอบที่ล้มต้องบันทึกว่าล้ม ไม่ใช่ปล่อยให้หน้าเว็บเห็นผลรอบเก่าแล้วนึกว่ายังดีอยู่
    lastRun = {
      at: new Date().toISOString(),
      dryRun: !apply,
      scanned: 0,
      moved: 0,
      skipped: 0,
      openJobs: 0,
      reasons: {},
      details: [],
      error: e instanceof Error ? e.message : String(e),
    };
    logError('application.autoMove.worker.failed', e);
  }
  return lastRun;
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}

/** นอนเป็นช่วง ๆ ละ 1 วิ เพื่อให้สั่งหยุดแล้วหยุดได้เร็ว (ไม่ต้องรอครบ 15 นาที) */
async function sleepInterruptible(ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (!stopped && Date.now() < end) {
    await sleep(Math.min(1_000, end - Date.now()));
  }
}

/**
 * เริ่มตัวตั้งเวลา — เรียกครั้งเดียวตอนบูต process API
 * คืน `false` ถ้าไม่ได้เปิดไว้ (ไม่ใช่ error — ค่าเริ่มต้นคือปิด)
 */
export function startApplicationAutoMoveWorker(): boolean {
  const cfg = getAutoMoveWorkerConfig();
  if (!cfg.enabled) {
    logInfo('application.autoMove.worker.disabled', {
      hint: 'ตั้ง APPLICATION_AUTO_MOVE_ENABLED=true เพื่อเปิด (ย้ายจริงต้อง APPLICATION_AUTO_MOVE_APPLY=true อีกตัว)',
    });
    return false;
  }
  if (running) return true;
  running = true;
  stopped = false;
  logInfo('application.autoMove.worker.start', {
    apply: cfg.apply,
    intervalMs: cfg.intervalMs,
    startupDelayMs: cfg.startupDelayMs,
  });

  void (async () => {
    await sleepInterruptible(cfg.startupDelayMs);
    while (!stopped) {
      // อ่านค่าตั้งใหม่ทุกรอบ — สลับโหมดแล้วมีผลรอบถัดไปโดยไม่ต้องรีสตาร์ต
      const now = getAutoMoveWorkerConfig();
      if (!now.enabled) {
        logWarn('application.autoMove.worker.turnedOff');
        break;
      }
      await runAutoMoveOnce({ apply: now.apply, limit: now.limit });
      await sleepInterruptible(now.intervalMs);
    }
    running = false;
  })();

  return true;
}

/** หยุดตัวตั้งเวลา (ใช้ตอนปิด process / ในเทสต์) */
export function stopApplicationAutoMoveWorker(): void {
  stopped = true;
}
