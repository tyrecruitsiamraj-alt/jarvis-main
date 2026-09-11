import dns from 'node:dns';
import net from 'node:net';
import { logInfo, logWarn } from './logger.js';

/**
 * ═══ บังคับออกเน็ตทาง IPv4 ก่อน (11 ก.ย. 2569) ═══
 *
 * เจ้าของสั่ง: *"แก้มันต้องไม่มีส่งไม่ถึง lumos แล้ว"*
 *
 * เหตุจริงที่จับได้จาก log ใหม่ (ไม่ใช่เดา):
 * ```
 * fetch failed
 *  | ETIMEDOUT:   connect ETIMEDOUT 192.178.155.121:443
 *  | ENETUNREACH: connect ENETUNREACH 2404:6800:4003:c01::79:443 - Local (:::0)
 * ```
 * `ENETUNREACH ... Local (:::0)` = **เครื่องเราไม่มีทางออก IPv6 เลย** แต่ DNS ของ
 * ปลายทาง (Lumos อยู่หลัง Google Cloud) ตอบทั้ง A และ AAAA ⇒ Node ลองเส้น IPv6 ด้วย
 * ทุกครั้ง แล้วชนกำแพงทุกครั้ง · เวลาที่เสียไปกับเส้นตายนั้นกินโควตาของการเชื่อมต่อ
 * พอเส้น IPv4 ช้าขึ้นนิดเดียวก็หมดเวลาพอดี ⇒ **เป็น ๆ หาย ๆ**
 *
 * แก้สองชั้น:
 *   1. `ipv4first` — เรียงให้ลอง IPv4 ก่อนเสมอ
 *   2. ปิด `autoSelectFamily` — ไม่ต้องแข่งสองเส้นพร้อมกัน (Happy Eyeballs) ให้ไล่ตามลำดับ
 *      บนเครื่องที่ไม่มี IPv6 การแข่งมีแต่เสีย
 *
 * ⚠️ **มีผลทั้ง process** (ไม่ใช่เฉพาะ Lumos) — ตั้งใจ เพราะเครื่องนี้ไม่มี IPv6 จริง ๆ
 * ปลายทางอื่น (Ollama · Postmark · geocode · Azure) ก็ได้ประโยชน์เหมือนกัน
 * ปิดได้ด้วย `NET_PREFER_IPV4=false` เผื่อวันหนึ่งเครื่องมี IPv6 จริง
 *
 * 🔴 **ไม่ใช่ยาครอบจักรวาล** — ถ้า IPv4 เองต่อไม่ติด (firewall/NAT/เน็ตหลุด) ก็ยังล้มอยู่ดี
 * ตัวที่รับประกันว่า "ต้องถึง" คือ `followPushRetryWorker` ที่ส่งซ้ำจนกว่าจะสำเร็จ
 */
export function preferIpv4(env: Record<string, string | undefined> = process.env): boolean {
  const raw = (env.NET_PREFER_IPV4 ?? '').trim().toLowerCase();
  if (['false', '0', 'off', 'no'].includes(raw)) {
    logInfo('net.preferIpv4.disabled', { hint: 'NET_PREFER_IPV4 ถูกตั้งเป็นปิด' });
    return false;
  }
  try {
    dns.setDefaultResultOrder('ipv4first');
    // มีตั้งแต่ Node 20 — เครื่องที่เก่ากว่านั้นข้ามไป (ยังได้ผลจาก ipv4first)
    net.setDefaultAutoSelectFamily?.(false);
    logInfo('net.preferIpv4.on', { order: 'ipv4first', autoSelectFamily: false });
    return true;
  } catch (e) {
    // ตั้งไม่ได้ก็ต้องไม่ทำให้ process ล้ม — แค่ออกเน็ตช้าลงเหมือนเดิม
    logWarn('net.preferIpv4.failed', { reason: e instanceof Error ? e.message : String(e) });
    return false;
  }
}
