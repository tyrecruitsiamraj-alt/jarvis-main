/**
 * ═══ สำเนาข้อมูลของ Dashboard แนวโน้ม — เก็บในฐานฝั่งเรา (ตาราง dashboard_trend_snapshots) ═══
 *
 * ทำไมไม่ใช้ `unitRequestCache` (หน่วยความจำ 90 วิ): ข้อมูลใบขอย้อนหลังหลายปีดึงจาก ERP ใช้ ~24 วิ
 * รีสตาร์ตเซิร์ฟเวอร์แล้วสำเนาในหน่วยความจำหาย คนแรกหลัง deploy ต้องรอทุกครั้ง · สำเนาในฐานรอดรีสตาร์ต
 *
 * กติกา (ต่อยอดจาก `unitRequestCache.ts` ข้อ 1–4):
 * 1. อายุไม่เกิน `ttlMs` = ส่งสำเนาเลย (`snapshot`)
 * 2. เกินอายุแต่ไม่เกิน `maxStaleMs` = ส่งสำเนาเดิมทันที + ดึงใหม่เบื้องหลัง (`stale`) — ไม่มีใครต้องรอ 24 วิ
 * 3. ไม่มีสำเนา / เก่าเกินเพดาน = รอดึงจริง (`fresh`) · ดึงไม่ได้แต่มีของเก่า = ส่งของเก่าพร้อมบอกอายุ
 * 4. 🔴 ไม่มีสำเนาเลยและดึงไม่ได้ = **พังให้เห็น** ห้ามส่งก้อนว่าง (ว่าง = "ไม่มีใบขอ" คนละเรื่องกับ "ยังไม่รู้")
 * 5. ดึงซ้อนกันไม่ได้ — คีย์เดียวดึงทีละรอบ คนที่มาระหว่างนั้นรอผลรอบเดียวกัน
 *
 * ⚠️ ตารางยังไม่ migrate (42P01) = ใช้หน่วยความจำอย่างเดียว ทำงานต่อได้ แค่ไม่รอดรีสตาร์ต
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logInfo, logWarn } from './logger.js';
import type { TrendDataSource } from '../../src/lib/trends/types.js';

const TABLE = tableInAppSchema('dashboard_trend_snapshots');

type Snap<T> = { value: T; fetchedAt: number };

const memory = new Map<string, Snap<unknown>>();
const inflight = new Map<string, Promise<Snap<unknown>>>();

export type SnapshotOutcome<T> = { value: T; fetchedAt: number; source: TrendDataSource };

async function readDb<T>(key: string): Promise<Snap<T> | null> {
  try {
    const { rows } = await dbQuery<{ payload: T; fetched_at: Date | string }>(
      `select payload, fetched_at from ${TABLE} where snapshot_key = $1 limit 1`,
      [key],
    );
    const r = rows[0];
    if (!r) return null;
    const at = new Date(r.fetched_at).getTime();
    return Number.isFinite(at) ? { value: r.payload, fetchedAt: at } : null;
  } catch (e) {
    if (isPgUndefinedTable(e)) return null;
    throw e;
  }
}

async function writeDb(key: string, value: unknown, rowCount: number, durationMs: number): Promise<void> {
  try {
    await dbQuery(
      `insert into ${TABLE} (snapshot_key, payload, row_count, fetched_at, duration_ms)
       values ($1, $2::jsonb, $3, now(), $4)
       on conflict (snapshot_key) do update
         set payload = excluded.payload,
             row_count = excluded.row_count,
             fetched_at = excluded.fetched_at,
             duration_ms = excluded.duration_ms`,
      [key, JSON.stringify(value), rowCount, durationMs],
    );
  } catch (e) {
    // เก็บสำเนาไม่ได้ไม่ใช่เหตุให้จอพัง — ของที่ดึงมาได้ยังส่งให้คนได้
    if (!isPgUndefinedTable(e)) logWarn('trendSnapshots write failed', { key, error: String(e) });
  }
}

function refresh<T>(key: string, load: () => Promise<T>, rowCount: (v: T) => number): Promise<Snap<T>> {
  const running = inflight.get(key);
  if (running) return running as Promise<Snap<T>>;
  const p = (async () => {
    const t0 = Date.now();
    const value = await load();
    const snap: Snap<T> = { value, fetchedAt: Date.now() };
    memory.set(key, snap);
    const ms = Date.now() - t0;
    await writeDb(key, value, rowCount(value), ms);
    logInfo('trendSnapshots refreshed', { key, rows: rowCount(value), ms });
    return snap;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p as Promise<Snap<unknown>>);
  return p;
}

export async function readThroughSnapshot<T>(
  key: string,
  load: () => Promise<T>,
  opts: { ttlMs: number; maxStaleMs: number; rowCount: (v: T) => number; now?: number },
): Promise<SnapshotOutcome<T>> {
  const now = opts.now ?? Date.now();
  let hit = memory.get(key) as Snap<T> | undefined;
  if (!hit) {
    const fromDb = await readDb<T>(key);
    if (fromDb) {
      hit = fromDb;
      memory.set(key, fromDb);
    }
  }
  if (hit) {
    const age = now - hit.fetchedAt;
    if (age < opts.ttlMs) return { value: hit.value, fetchedAt: hit.fetchedAt, source: 'snapshot' };
    if (age < opts.maxStaleMs) {
      void refresh(key, load, opts.rowCount).catch((e) =>
        logWarn('trendSnapshots background refresh failed', { key, error: String(e) }),
      );
      return { value: hit.value, fetchedAt: hit.fetchedAt, source: 'stale' };
    }
  }
  try {
    const snap = await refresh(key, load, opts.rowCount);
    return { value: snap.value, fetchedAt: snap.fetchedAt, source: 'fresh' };
  } catch (e) {
    if (hit) return { value: hit.value, fetchedAt: hit.fetchedAt, source: 'stale' };
    throw e;
  }
}

/** ล้างสำเนาในหน่วยความจำ — ใช้ในเทสต์เท่านั้น */
export function clearTrendSnapshotMemory(): void {
  memory.clear();
  inflight.clear();
}
