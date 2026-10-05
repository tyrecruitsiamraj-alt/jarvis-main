/**
 * ═══ ตัวดึงส่งคนแทนจาก iRecruit **ทุกเช้า** (เจ้าของเคาะ 2 ต.ค. 2569: "ดึงเองทุกเช้า") ═══
 *
 * เดินทุก 5 นาที ถามว่า "ถึงชั่วโมงที่ตั้ง (เวลาไทย · ค่าเริ่ม 06:00) และวันนี้ยังไม่ได้ดึงหรือยัง" — ถึงแล้วค่อยเรียก
 * `runIrecruitReplaceSync` หนึ่งรอบ · เซิร์ฟเวอร์ดับตอน 06:00 = ดึงทันทีที่กลับมาในวันเดียวกัน · วันเดียวกันไม่ดึงซ้ำ
 * (ดึงซ้ำก็ไม่เป็นไร — `source_ref` กันไว้ที่ฐาน — แต่ไม่ต้องรบกวน iRecruit เปล่า ๆ)
 *
 * 🔴 **เปิดเป็นค่าเริ่มต้น** ตามที่เจ้าของเคาะ · ปิดด้วย `IRECRUIT_REPLACE_SYNC_ENABLED=false` · ไม่มี config iRecruit หรือ
 *    ปิดสวิตช์ `IRECRUIT_ENABLED` = รอบนั้นจดเหตุผลแล้วรอ (ไม่พัง) · รอบที่ล้มลองใหม่อีกทีใน 1 ชั่วโมง ไม่ใช่ทุก 5 นาที
 * ⚠️ สายที่สร้างจะ **ส่งให้ AI** เฉพาะเมื่อสวิตช์ส่งอัตโนมัติของงานติดตาม (`follow_entry`) เปิดอยู่ — คุมที่หน้าตั้งค่าเหมือนเดิม
 */
import { logError, logInfo, logWarn } from './logger.js';
import { enforceReplaceAiFrom, getReplaceSyncSettings, runIrecruitReplaceSync } from './irecruitReplaceSync.js';
import {
  readReplaceSyncConfig,
  REPLACE_SYNC_ACTOR_NAME,
  type ReplaceSyncConfig,
  type ReplaceSyncSummary,
} from '../../src/lib/irecruitReplaceSync.js';


let running = false;
let stopped = false;
/** ผลรอบล่าสุดในหน่วยความจำ — ใช้ตอนฐานยังไม่มีตาราง 133 (จดลงฐานไม่ได้) · รีสตาร์ตแล้วหาย */
let lastRunInMemory: ReplaceSyncSummary | null = null;
/** รอบที่ล้ม — ลองใหม่อีกทีเมื่อผ่านไป 1 ชั่วโมง */
let lastFailedAt: number | null = null;
const RETRY_AFTER_FAIL_MS = 15 * 60_000;

export function getReplaceSyncWorkerConfig(): ReplaceSyncConfig {
  return readReplaceSyncConfig(process.env);
}

export function getLastReplaceSyncInMemory(): ReplaceSyncSummary | null {
  return lastRunInMemory;
}

/** เดินรอบถ้าถึงเวลา — คืน `null` = ยังไม่ถึง/ดึงวันนี้แล้ว */
export async function runReplaceSyncIfDue(
  cfg: ReplaceSyncConfig = getReplaceSyncWorkerConfig(),
  now: Date = new Date(),
): Promise<ReplaceSyncSummary | null> {
  const settings = await getReplaceSyncSettings();
  // "AI เริ่มโทรตั้งแต่" — บังคับทุกรอบ ไม่รอรอบดึงประจำวัน (เจ้าของสั่ง 2 ต.ค. 2569)
  if (settings.rule.aiFrom) {
    try {
      await enforceReplaceAiFrom(settings.rule.aiFrom);
    } catch (e) {
      logError('irecruit.replaceSync.aiFrom: รอบนี้ล้ม', e);
    }
  }
  /**
   * 🔴 ดึงทุกรอบ (ทุก `tickMs` = 5 นาที) — เจ้าของสั่ง 5 ต.ค. 2569: *"ไม่ต้องดึงทุก 6 โมงแล้ว เป็นมีอัปเดตที่ iRecruit แล้วขึ้นเลย"*
   * (Choice "ทุก 5 นาที") · รอบที่ล้ม = เว้น `RETRY_AFTER_FAIL_MS` ก่อนลองใหม่ (ไม่ถล่ม iRecruit ตอนมันล่ม)
   */
  if (lastFailedAt !== null && now.getTime() - lastFailedAt < RETRY_AFTER_FAIL_MS) return null;

  const summary = await runIrecruitReplaceSync({ now, horizonDays: cfg.horizonDays, actorName: REPLACE_SYNC_ACTOR_NAME });
  lastRunInMemory = summary;
  lastFailedAt = summary.error ? now.getTime() : null;
  if (summary.error) logWarn('irecruit.replaceSync.worker.skipped', { reason: summary.error });
  return summary;
}

function sleepInterruptible(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const step = 1_000;
    let left = ms;
    const timer = setInterval(() => {
      left -= step;
      if (stopped || left <= 0) {
        clearInterval(timer);
        resolve();
      }
    }, step);
  });
}

export function startIrecruitReplaceSyncWorker(): boolean {
  const cfg = getReplaceSyncWorkerConfig();
  if (!cfg.enabled) {
    logInfo('irecruit.replaceSync.worker.disabled', {
      hint: 'ลบ IRECRUIT_REPLACE_SYNC_ENABLED หรือตั้งเป็น true เพื่อเปิด',
    });
    return false;
  }
  if (running) return true;
  running = true;
  stopped = false;
  logInfo('irecruit.replaceSync.worker.start', { horizonDays: cfg.horizonDays, tickMs: cfg.tickMs });

  void (async () => {
    await sleepInterruptible(cfg.startupDelayMs);
    while (!stopped) {
      // อ่านค่าตั้งใหม่ทุกรอบ — ปิดสวิตช์แล้วมีผลรอบถัดไปโดยไม่ต้องรีสตาร์ต
      const nowCfg = getReplaceSyncWorkerConfig();
      if (!nowCfg.enabled) {
        logWarn('irecruit.replaceSync.worker.turnedOff');
        break;
      }
      try {
        await runReplaceSyncIfDue(nowCfg);
      } catch (e) {
        logError('irecruit.replaceSync: รอบนี้ล้มทั้งรอบ', e);
        lastFailedAt = Date.now();
      }
      await sleepInterruptible(nowCfg.tickMs);
    }
    running = false;
  })();

  return true;
}

/** หยุดตัวดึง (ใช้ตอนปิด process / ในเทสต์) */
export function stopIrecruitReplaceSyncWorker(): void {
  stopped = true;
}
