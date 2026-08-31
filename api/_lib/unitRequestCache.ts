/**
 * ═══ สำเนาใบขออายุสั้น — กันจอค้างเพราะระบบงานหลักตอบช้า ═══
 *
 * 🔴 **ทำไมต้องมี (วัดจริง 29-31 ส.ค. 2569):**
 * เส้น `/api/siamraj/unit-requests?limit=500` วิ่งไปถาม SQL Server ของระบบงานหลักสด ๆ ทุกครั้ง
 * จับเวลาได้ **10 วินาทีตอนเร็ว · ตาย 60 วินาทีตอนช้า** และตายจริง **4 ครั้งจาก 6 ครั้งที่เปิด**
 * ⇒ คนเปิดกล่องงานเจอจอค้างหรือจอพังบ่อยกว่าจอที่ใช้งานได้
 *
 * กติกาสามข้อของสำเนานี้:
 *
 * 1. **สำเนาสดพอที่จะเชื่อได้** — อายุสั้น (`TTL_MS`) เกินนั้นไปถามใหม่
 * 2. 🔴 **ถามใหม่ไม่สำเร็จ แต่มีสำเนาเก่าอยู่ ⇒ ส่งสำเนาเก่าไป พร้อมบอกอายุ**
 *    ของเก่าที่บอกอายุตรง ๆ ดีกว่าจอพัง — แต่ต้องบอก ห้ามแอบส่งเงียบ ๆ
 * 3. 🔴 **ไม่มีสำเนาเลยและถามใหม่ไม่ได้ ⇒ ต้องพังให้เห็น** ห้ามส่ง `[]`
 *    (ส่งลิสต์ว่างคือบอกว่า "ไม่มีใบขอ" ซึ่งเป็นคนละเรื่องกับ "ยังไม่รู้")
 *
 * ⚠️ เก็บในหน่วยความจำของโปรเซส — รีสตาร์ตแล้วหาย ซึ่งถูกต้องแล้ว
 * (ไม่ใช่ฐานข้อมูลสำรอง เป็นแค่กันถามซ้ำถี่ ๆ)
 */
import { logInfo, logWarn } from './logger.js';

/** อายุของสำเนาที่ยังถือว่าสด */
const TTL_MS = 90_000;

/** เพดานจำนวนคีย์ที่เก็บ — กันหน่วยความจำบวมจาก query แปลก ๆ */
const MAX_KEYS = 24;

type Entry = {
  value: unknown;
  /** เวลาที่ไปถามระบบงานหลักมาได้จริง */
  fetchedAt: number;
};

const store = new Map<string, Entry>();

export type CacheOutcome<T> = {
  value: T;
  fetchedAt: number;
  /** สดจากระบบงานหลัก หรือหยิบสำเนามาให้ */
  source: 'live' | 'cache' | 'stale-after-error';
};

/** อายุของข้อมูลเป็นวินาที — หน้าจอเอาไปเขียนว่า "ข้อมูลเมื่อ X นาทีที่แล้ว" */
export function ageSeconds(fetchedAt: number, now = Date.now()): number {
  return Math.max(0, Math.round((now - fetchedAt) / 1000));
}

function remember(key: string, value: unknown, at: number): void {
  store.set(key, { value, fetchedAt: at });
  // ตัวเก่าสุดออกก่อนเมื่อเกินเพดาน (Map จำลำดับที่ใส่ให้อยู่แล้ว)
  while (store.size > MAX_KEYS) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
  }
}

/**
 * อ่านผ่านสำเนา
 *
 * @param fresh `true` = ข้ามสำเนา ไปถามสดเลย (ปุ่มรีเฟรชบนจอใช้ทางนี้)
 */
export async function readThroughCache<T>(
  key: string,
  load: () => Promise<T>,
  opts: { fresh?: boolean; now?: number } = {},
): Promise<CacheOutcome<T>> {
  const now = opts.now ?? Date.now();
  const hit = store.get(key);

  if (!opts.fresh && hit && now - hit.fetchedAt < TTL_MS) {
    return { value: hit.value as T, fetchedAt: hit.fetchedAt, source: 'cache' };
  }

  try {
    const value = await load();
    remember(key, value, now);
    return { value, fetchedAt: now, source: 'live' };
  } catch (e) {
    if (hit) {
      // ข้อ 2: ของเก่าที่บอกอายุ ดีกว่าจอพัง
      logWarn('unitRequestCache.serveStale', {
        key,
        ageSeconds: ageSeconds(hit.fetchedAt, now),
        message: e instanceof Error ? e.message : String(e),
      });
      return { value: hit.value as T, fetchedAt: hit.fetchedAt, source: 'stale-after-error' };
    }
    // ข้อ 3: ไม่มีสำเนา = ต้องพังให้เห็น ห้ามกลืนเป็นลิสต์ว่าง
    throw e;
  }
}

/** ล้างสำเนาทั้งหมด — ใช้ในเทสต์เท่านั้น */
export function clearUnitRequestCache(): void {
  store.clear();
  logInfo('unitRequestCache.cleared');
}

/** ดูสภาพสำเนาตอนนี้ — ใช้ในเทสต์และตอนไล่ปัญหา */
export function unitRequestCacheSize(): number {
  return store.size;
}
