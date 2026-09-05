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
 *
 * ───────────────────────────────────────────────────────────────────────────
 * 🔴 **ข้อ 4 — ตอบของเก่าก่อน แล้วค่อยเติมของใหม่ (stale-while-revalidate)**
 * เพิ่ม 5 ก.ย. 2569 · Wave 3.1 ของ `docs/plan-quality-100-2569-09-05.md`
 *
 * ของเดิมมีสำเนาแล้วก็จริง แต่ **คนแรกหลังสำเนาหมดอายุต้องรอเองเต็ม ๆ**
 * วัดจริงบนเครื่อง (สำเนาเย็น): `/api/matching/flow-summary` = **4.6 วินาที** ·
 * `/api/siamraj/unit-requests?limit=500` = **4.4 วินาที** — ทุก ๆ 90 วินาที
 * จะมีคนซวยหนึ่งคนจ่ายค่านี้แทนคนอื่นทั้งออฟฟิศ
 *
 * ทางแก้: สำเนาเกินอายุแต่ยัง **ไม่เกินเพดาน** (`STALE_MAX_MS`) ⇒ ตอบสำเนาเดิม
 * ทันที แล้วยิงโหลดใหม่ไว้เบื้องหลัง คนถัดไปได้ของใหม่โดยไม่มีใครต้องรอ
 *
 * ⚠️ **สามข้อบนยังศักดิ์สิทธิ์** — ทางนี้ไม่ได้ทำให้ใครโกหกอายุข้อมูล:
 * `fetchedAt` ที่ส่งกลับยังเป็นเวลาที่ไปถามมาได้จริง (header `x-data-age-seconds`
 * จึงบอกอายุจริงเสมอ) และ `source` เป็น `'stale-revalidating'` ให้แยกออกจาก `'cache'`
 * 🔴 **เกินเพดานเมื่อไหร่ กลับไปรอโหลดจริง** — ของเก่าเกิน 10 นาทีคือของที่ตัดสินใจผิดได้
 * (คนละเรื่องกับข้อ 2 ที่ยอมส่งของเก่าไม่จำกัดอายุ เพราะข้อ 2 คือ "ระบบงานหลักล่ม
 * ตัวเลือกอื่นคือจอพัง" ส่วนข้อ 4 คือ "ระบบงานหลักยังดีอยู่ แค่ช้า")
 *
 * ⚠️ **บนเซิร์ฟเวอร์ที่อยู่ยาว** (`npm run api:local` และ on-prem) โหลดเบื้องหลังวิ่งจบแน่นอน
 * **บน Vercel serverless** คอนเทนเนอร์อาจถูกแช่แข็งหลังตอบ ⇒ โหลดเบื้องหลังอาจไม่จบ
 * ซึ่ง **ไม่เสียหาย**: ธงกันยิงซ้ำมีเพดานเวลา (`REFRESH_DEADLINE_MS`) คนถัดไปยิงใหม่ได้
 * และไม่มีทางที่ค้างแล้วทำให้ระบบตอบของเก่าตลอดกาล เพราะเพดานอายุยังคุมอยู่
 */
import { logInfo, logWarn } from './logger.js';

/** อายุของสำเนาที่ยังถือว่าสด */
const TTL_MS = 90_000;

/**
 * 🔴 เพดานอายุที่ยัง "ยอมตอบของเก่าไปก่อน" ได้ — เกินนี้ต้องรอโหลดจริง
 *
 * 10 นาที: นานพอให้ช่วงเงียบ ๆ (พักเที่ยง) ยังได้ประโยชน์ แต่สั้นพอที่ใบขอที่เพิ่งเข้ามา
 * จะไม่หายไปจากจอนานจนคนตัดสินใจผิด · **ห้ามยืดโดยไม่ถามเจ้าของ**
 */
const STALE_MAX_MS = 600_000;

/**
 * ธงกันยิงโหลดเบื้องหลังซ้อนกันจะถูกทิ้งหลังผ่านไปเท่านี้
 *
 * กันเคสโปรเซสถูกแช่แข็ง/โหลดค้าง แล้วธงติดค้างจนไม่มีใครยิงใหม่ได้อีกเลย
 * ตั้งไว้ยาวกว่าเวลาที่ระบบงานหลักช้าสุดที่เคยวัดได้ (60 วินาที)
 */
const REFRESH_DEADLINE_MS = 120_000;

/** เพดานจำนวนคีย์ที่เก็บ — กันหน่วยความจำบวมจาก query แปลก ๆ */
const MAX_KEYS = 24;

type Entry = {
  value: unknown;
  /** เวลาที่ไปถามระบบงานหลักมาได้จริง */
  fetchedAt: number;
};

const store = new Map<string, Entry>();

/** ผลของการไปถามระบบงานหลักหนึ่งรอบ — **ไม่มีวัน reject** ผลอยู่ในค่าที่คืน */
type LoadResult = { ok: true; entry: Entry } | { ok: false; error: unknown };

/** คีย์ที่กำลังมีการไปถามระบบงานหลักวิ่งอยู่ — หนึ่งคีย์ต่อหนึ่งตัว ห้ามซ้อน */
const refreshing = new Map<string, { startedAt: number; done: Promise<LoadResult> }>();

export type CacheOutcome<T> = {
  value: T;
  fetchedAt: number;
  /**
   * สดจากระบบงานหลัก · สำเนายังสด · **สำเนาเกินอายุแต่ตอบไปก่อนแล้วเติมของใหม่เบื้องหลัง** ·
   * หรือถามใหม่ไม่สำเร็จเลยหยิบสำเนาเก่ามาให้
   */
  source: 'live' | 'cache' | 'stale-revalidating' | 'stale-after-error';
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
 * ไปถามระบบงานหลัก **หนึ่งครั้งต่อหนึ่งคีย์** — ใครมาระหว่างนั้นเกาะตัวเดิม
 *
 * 🔴 ทำไมต้องรวมคิว: ก่อนหน้านี้คนสามคนเปิดกล่องงานพร้อมกันตอนสำเนาเย็น =
 * ยิงถาม SQL Server สามรอบซ้อน (ทั้งที่ผลเหมือนกัน) ระบบงานหลักยิ่งช้าลงไปอีก
 * และตัวอุ่นสำเนาตอนบูตก็ช่วยคนแรกไม่ได้เลยเพราะเขายิงเส้นของตัวเองขนานไป
 *
 * ใช้ทั้งทางที่ต้องรอ (ไม่มีสำเนา/เกินเพดาน) และทางโหลดเบื้องหลังของข้อ 4
 *
 * @param injectedNow เวลาที่เทสต์ยัดเข้ามา (`opts.now`) · ของจริงเป็น `undefined`
 *   ⇒ เวลาที่บันทึกว่า "ถามมาได้เมื่อไหร่" ใช้เวลาตอนโหลดเสร็จจริง
 */
function startLoad<T>(
  key: string,
  load: () => Promise<T>,
  injectedNow: number | undefined,
): Promise<LoadResult> {
  const startedAt = injectedNow ?? Date.now();
  const running = refreshing.get(key);
  // มีตัวหนึ่งวิ่งอยู่แล้วและยังไม่เกินเพดานเวลา ⇒ เกาะตัวนั้น ไม่ยิงซ้อน
  if (running && startedAt - running.startedAt < REFRESH_DEADLINE_MS) return running.done;

  const done: Promise<LoadResult> = (async () => {
    // 🔴 ถอยหนึ่ง microtask ก่อน — ให้ `refreshing.set()` ข้างล่างทำงานเสร็จก่อนเสมอ
    // ไม่งั้น `load()` ที่โยน error แบบ synchronous จะทำให้ `finally` วิ่งก่อนลงทะเบียน
    // แล้วธงค้างในแมปจนหมดเพดานเวลา
    await Promise.resolve();
    try {
      const value = await load();
      const entry: Entry = { value, fetchedAt: injectedNow ?? Date.now() };
      remember(key, entry.value, entry.fetchedAt);
      logInfo('unitRequestCache.loaded', { key, ms: Date.now() - (injectedNow ?? startedAt) });
      return { ok: true, entry };
    } catch (error) {
      // 🔴 ล้ม = **ไม่แตะสำเนาเดิม** ของเก่ายังอยู่ครบพร้อมอายุจริง
      // คนที่รออยู่จะตกไปที่กติกาข้อ 2/3 · คนที่ได้ของเก่าไปแล้วไม่กระทบอะไร
      logWarn('unitRequestCache.loadFailed', {
        key,
        message: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, error };
    } finally {
      if (refreshing.get(key)?.startedAt === startedAt) refreshing.delete(key);
    }
  })();

  refreshing.set(key, { startedAt, done });
  return done;
}

/** ทางลงของกติกาข้อ 2 กับข้อ 3 — มีสำเนาเก่า ⇒ ส่งไปพร้อมบอกอายุ · ไม่มี ⇒ พังให้เห็น */
function serveStaleOrThrow<T>(
  key: string,
  hit: Entry | undefined,
  error: unknown,
  now: number,
): CacheOutcome<T> {
  if (hit) {
    // ข้อ 2: ของเก่าที่บอกอายุ ดีกว่าจอพัง
    logWarn('unitRequestCache.serveStale', {
      key,
      ageSeconds: ageSeconds(hit.fetchedAt, now),
      message: error instanceof Error ? error.message : String(error),
    });
    return { value: hit.value as T, fetchedAt: hit.fetchedAt, source: 'stale-after-error' };
  }
  // ข้อ 3: ไม่มีสำเนา = ต้องพังให้เห็น ห้ามกลืนเป็นลิสต์ว่าง
  throw error;
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

  if (opts.fresh) {
    // ปุ่มรีเฟรชต้องได้ของสดของตัวเอง — ห้ามเกาะคิวของคนอื่นที่เริ่มไปก่อนแล้ว
    try {
      const value = await load();
      remember(key, value, now);
      return { value, fetchedAt: now, source: 'live' };
    } catch (e) {
      return serveStaleOrThrow<T>(key, hit, e, now);
    }
  }

  if (hit) {
    const age = now - hit.fetchedAt;
    if (age < TTL_MS) {
      return { value: hit.value as T, fetchedAt: hit.fetchedAt, source: 'cache' };
    }
    if (age < STALE_MAX_MS) {
      // ข้อ 4: ตอบของเก่าทันที (พร้อมอายุจริง) แล้วเติมของใหม่เบื้องหลัง
      void startLoad(key, load, opts.now);
      return { value: hit.value as T, fetchedAt: hit.fetchedAt, source: 'stale-revalidating' };
    }
    // เกินเพดาน ⇒ ตกลงไปรอโหลดจริงข้างล่าง
  }

  const result = await startLoad(key, load, opts.now);
  if (result.ok) {
    return { value: result.entry.value as T, fetchedAt: result.entry.fetchedAt, source: 'live' };
  }
  // สำเนาอาจถูกเติมโดยคนอื่นระหว่างที่เรารอ — หยิบตัวล่าสุดเสมอ
  return serveStaleOrThrow<T>(key, store.get(key) ?? hit, result.error, now);
}

/** ล้างสำเนาทั้งหมด — ใช้ในเทสต์เท่านั้น */
export function clearUnitRequestCache(): void {
  store.clear();
  refreshing.clear();
  logInfo('unitRequestCache.cleared');
}

/** ดูสภาพสำเนาตอนนี้ — ใช้ในเทสต์และตอนไล่ปัญหา */
export function unitRequestCacheSize(): number {
  return store.size;
}

/** มีโหลดเบื้องหลังวิ่งอยู่กี่ตัว — ใช้ในเทสต์และตอนไล่ปัญหา */
export function unitRequestRefreshCount(): number {
  return refreshing.size;
}

/** รอโหลดเบื้องหลังทุกตัวให้จบ — **ใช้ในเทสต์เท่านั้น** (ของจริงไม่มีใครรอ) */
export async function settleUnitRequestRefreshes(): Promise<void> {
  while (refreshing.size > 0) {
    await Promise.all([...refreshing.values()].map((r) => r.done));
  }
}
