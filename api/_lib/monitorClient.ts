/**
 * ส่ง usage log ไปหา AI Systems Central Monitor (ระบบแยกต่างหาก นอก repo นี้)
 * ใช้ SDK: @drcopyman/monitor-sdk
 *
 * ขอบเขต (เจ้าของเคาะ 16 ก.ย. 2569): **เฉพาะตอน login สำเร็จ** — ไม่ใช่ทุก API call
 *
 * ต้องตั้งค่า env vars:
 *   MONITOR_BASE_URL — root URL ของ monitor service
 *   MONITOR_API_KEY  — ingestion API key จาก monitor server
 * ขาดตัวไหนก็ข้ามเงียบ (เหมือน getLumosPushConfig) — ระบบ login ต้องทำงานได้เสมอ
 * ไม่ว่าจะตั้งค่า monitor ไว้หรือไม่
 *
 * ⚠️ ยิงแบบ fire-and-forget เสมอ (ดู logLoginEvent) — monitor ล่ม/ช้า ห้ามกระทบ
 * ผลตอบของ login จริง และห้ามทำให้ login ล้มเด็ดขาด (ใช้ tryLog ไม่ใช่ log)
 */
import { createMonitorClient, type MonitorClient } from '@drcopyman/monitor-sdk';
import { logWarn } from './logger.js';

let cached: MonitorClient | null | undefined;

function getMonitorClient(): MonitorClient | null {
  if (cached !== undefined) return cached;
  const baseUrl = (process.env.MONITOR_BASE_URL || '').trim();
  const apiKey = (process.env.MONITOR_API_KEY || '').trim();
  cached = !baseUrl || !apiKey ? null : createMonitorClient({ baseUrl, apiKey, systemName: 'jarvis', timeoutMs: 5_000 });
  return cached;
}

/**
 * log เหตุการณ์ login สำเร็จ — ไม่ throw ไม่บล็อกผู้เรียก (fire-and-forget)
 * เรียกจาก issueAuthSession/issueAuthSessionRedirect ที่เดียว (ครอบ login ปกติ,
 * magic link, Azure AD SSO — 3 ทางที่ออก session จริงให้ผู้ใช้งานทั่วไป)
 */
export function logLoginEvent(
  user: { id: string; email: string; full_name: string; role: string },
  action: string,
): void {
  const monitor = getMonitorClient();
  if (!monitor) return;
  void monitor
    .tryLog({
      userId: user.id,
      username: user.full_name || user.email,
      action,
      metadata: { email: user.email, role: user.role },
    })
    .then((result) => {
      if (!result.ok) {
        logWarn('monitor.login.log.fail', {
          userId: user.id,
          action,
          code: result.error.code,
          message: result.error.message,
        });
      }
    })
    // tryLog ออกแบบมาไม่ให้ throw อยู่แล้ว แต่กันไว้อีกชั้น — ห้าม unhandled rejection
    // หลุดไปกระทบ process จาก call ที่ fire-and-forget แบบนี้เด็ดขาด
    .catch((e) => {
      logWarn('monitor.login.log.fail', {
        userId: user.id,
        action,
        message: e instanceof Error ? e.message : String(e),
      });
    });
}
