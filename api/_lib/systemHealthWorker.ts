/**
 * ยามเฝ้าระบบ — วนเช็คสถานะแล้ว **เด้งแจ้งเตือนหาคน** เมื่อผิดปกติ
 *
 * 🔴 หลักคิด: **หน้าสถานะไม่ใช่คำตอบ — การเตือนที่วิ่งมาหาต่างหาก**
 * ถ้ามีแต่หน้าให้เข้าไปดู มันจะกลายเป็นอีกหน้าที่ไม่มีใครเปิด แล้วเราจะกลับไปที่เดิม
 * (19 ส.ค. 2569: สวิตช์ส่งใบสมัครปิดอยู่ 4 วันโดยไม่มีใครรู้ · ต้น ส.ค.: Lumos หยุดดึงคิว
 * 3 วันจนคิวบวม 3,400+ กว่าจะรู้ตัว — สองเคสนี้คือเหตุผลทั้งหมดที่ไฟล์นี้มีอยู่)
 *
 * ปิดโดยค่าเริ่มต้น · เปิดด้วย `SYSTEM_HEALTH_WATCH_ENABLED=true` (ตั้งไว้ที่ deploy แล้ว)
 */
import { logError, logInfo } from './logger.js';
import { notifyRoles } from './appNotifications.js';
import { readHealthSignals } from './systemHealthStore.js';
import {
  buildHealthChecks,
  healthAlertFor,
  worstLevel,
  type HealthCheck,
  type HealthCheckKey,
  type HealthLevel,
} from '../../src/lib/systemHealth.js';
import { autoMoveIntEnv } from '../../src/lib/applicationAutoMoveReport.js';

const DEFAULT_INTERVAL_MS = 300_000; // 5 นาที
const MIN_INTERVAL_MS = 60_000;

/** ระดับของรอบก่อน — ใช้เตือนเฉพาะ "ตอนเปลี่ยน" ไม่ใช่ทุกรอบ */
const lastLevels = new Map<HealthCheckKey, HealthLevel>();

let lastChecks: HealthCheck[] = [];
let lastCheckedAt: string | null = null;
let running = false;
let stopped = false;

export function getLastHealthChecks(): { checks: HealthCheck[]; at: string | null } {
  return { checks: lastChecks, at: lastCheckedAt };
}

/**
 * 🔴 **ปิดโดยค่าเริ่มต้น เปิดที่ deploy เท่านั้น** — เดิมตั้งใจให้เปิดเอง แต่ฐาน dev = production
 * ยามเฝ้าบนเครื่องนักพัฒนาจึงเขียนแจ้งเตือนลงฐานจริง (เจอตอนตรวจ 19 ส.ค. 2569:
 * เครื่อง dev ไม่มีข้อมูล ERP → เด้ง "ERP ผิดปกติ" ไปหาแอดมินบน production ทั้งที่ ERP ปกติดี)
 */
function isEnabled(): boolean {
  const raw = String(process.env.SYSTEM_HEALTH_WATCH_ENABLED ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

/**
 * คำนวณสถานะอย่างเดียว — **ไม่แจ้งเตือน**
 * 🔴 หน้าเว็บ/ปุ่ม "ตรวจเดี๋ยวนี้" ต้องเรียกตัวนี้เท่านั้น · การแจ้งเตือนเป็นงานของยามเฝ้าที่เดียว
 * ไม่งั้นใครเปิดหน้าสถานะบนเครื่อง dev ก็ยิงแจ้งเตือนเข้าฐานจริงได้
 */
export async function computeHealthChecks(now = new Date()): Promise<HealthCheck[]> {
  const signals = await readHealthSignals();
  const checks = buildHealthChecks(signals, now);
  lastChecks = checks;
  lastCheckedAt = now.toISOString();
  return checks;
}

/** เดินหนึ่งรอบ **พร้อมแจ้งเตือน** — เฉพาะยามเฝ้าเรียก */
export async function runHealthCheckOnce(now = new Date()): Promise<HealthCheck[]> {
  const checks = await computeHealthChecks(now);
  const stamp = (lastCheckedAt ?? now.toISOString()).slice(0, 13);

  for (const check of checks) {
    const alert = healthAlertFor(check, lastLevels.get(check.key) ?? null);
    lastLevels.set(check.key, check.level);
    if (!alert) continue;
    // แจ้งเตือนล้มห้ามทำให้ยามเฝ้าตาย — notifyRoles กลืน error เองอยู่แล้ว
    await notifyRoles(['admin'], {
      type: alert.kind === 'down' ? 'system_health_down' : 'system_health_recovered',
      title: alert.title,
      body: alert.body,
      link: '/settings?tab=health',
      // เตือนซ้ำได้เมื่อกลับมาพังใหม่ แต่ไม่ซ้ำระหว่างที่ยังพังอยู่
      dedupeKey: `health:${check.key}:${alert.kind}:${stamp}`,
    });
    logInfo('systemHealth.alert', { key: check.key, kind: alert.kind, level: check.level });
  }

  return checks;
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}

async function sleepInterruptible(ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (!stopped && Date.now() < end) {
    await sleep(Math.min(1_000, end - Date.now()));
  }
}

export function startSystemHealthWorker(): boolean {
  if (!isEnabled()) {
    logInfo('systemHealth.worker.disabled');
    return false;
  }
  if (running) return true;
  running = true;
  stopped = false;

  const intervalMs = autoMoveIntEnv(
    process.env.SYSTEM_HEALTH_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    MIN_INTERVAL_MS,
  );
  const startupDelayMs = autoMoveIntEnv(process.env.SYSTEM_HEALTH_STARTUP_DELAY_MS, 45_000, 0);
  logInfo('systemHealth.worker.start', { intervalMs, startupDelayMs });

  void (async () => {
    // หน่วงตอนบูตให้ตัวย้ายใบสมัครได้เดินรอบแรกก่อน — ไฟ ERP อ้างผลของมัน
    await sleepInterruptible(startupDelayMs);
    while (!stopped) {
      try {
        await runHealthCheckOnce();
      } catch (e) {
        logError('systemHealth.worker.failed', e);
      }
      await sleepInterruptible(intervalMs);
    }
    running = false;
  })();

  return true;
}

export function stopSystemHealthWorker(): void {
  stopped = true;
}

/** ระดับรวมของรอบล่าสุด — หน้าเว็บใช้ตัดสินว่าจะขึ้นแถบเตือนบนหัวไหม */
export function currentHealthLevel(): HealthLevel {
  return worstLevel(lastChecks);
}
